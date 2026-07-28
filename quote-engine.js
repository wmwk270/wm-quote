(function (root, factory) {
  const pricing =
    root && root.WM_PRICING
      ? root.WM_PRICING
      : typeof require === "function"
        ? require("./pricing.js")
        : null;
  const engine = factory(pricing);

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  }

  if (root) {
    root.WMQuoteEngine = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (pricing) {
  "use strict";

  if (!pricing) {
    throw new Error("Pricing data is required.");
  }

  const PAYMENT_LABELS = Object.freeze({
    autopay_visit: "Autopay per visit",
    monthly_installment: "Monthly autopay",
    prepay: "Prepay",
  });

  const PROMOTION_LABELS = Object.freeze({
    NONE: "None",
    Military: "Military / First Responder",
    DH50: "DH50",
    WEB50: "WEB50",
  });

  function toCents(dollars) {
    return Math.round((Number(dollars) + Number.EPSILON) * 100);
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format((Number(cents) || 0) / 100);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function parseSquareFeet(input) {
    if (typeof input === "number") {
      return Number.isInteger(input) && input > 0 ? input : null;
    }

    const digits = String(input || "").replace(/[^\d]/g, "");
    const value = Number.parseInt(digits, 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function getRates(input) {
    const squareFeet = parseSquareFeet(input);
    if (!squareFeet) {
      return null;
    }

    let minimum = 1;
    for (const row of pricing.rates) {
      if (squareFeet <= row[0]) {
        return Object.freeze({
          squareFeet,
          minimum,
          maximum: row[0],
          tier: `${formatNumber(minimum)} to ${formatNumber(row[0])} sq ft`,
          extrapolated: false,
          regularCents: toCents(row[1]),
          grubCents: toCents(row[2]),
          aerationCents: toCents(row[3]),
          overseedingCents: toCents(row[3]),
        });
      }
      minimum = row[0] + 1;
    }

    const extension = pricing.extension;
    const thousandsOver =
      (squareFeet - extension.threshold) / 1000;

    return Object.freeze({
      squareFeet,
      minimum: extension.threshold + 1,
      maximum: null,
      tier: `${formatNumber(squareFeet)} sq ft formula`,
      extrapolated: true,
      regularCents: toCents(
        extension.regular.base +
          thousandsOver * extension.regular.perThousand,
      ),
      grubCents: toCents(
        extension.grub.base + thousandsOver * extension.grub.perThousand,
      ),
      aerationCents: toCents(
        extension.aerationOrOverseeding.base +
          thousandsOver * extension.aerationOrOverseeding.perThousand,
      ),
      overseedingCents: toCents(
        extension.aerationOrOverseeding.base +
          thousandsOver * extension.aerationOrOverseeding.perThousand,
      ),
    });
  }

  function getProgram(key) {
    return (
      pricing.programs.find((program) => program.key === key) ||
      pricing.programs[0]
    );
  }

  function cleanDate(value) {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        12,
      );
    }

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T12:00:00`);
    }

    const parsed = new Date(value || Date.now());
    return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
  }

  function localDateKey(value) {
    const date = cleanDate(value);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function isEarlyPrepay(date) {
    return localDateKey(date) < pricing.discounts.prepayCutoff;
  }

  function clampInteger(value, minimum, maximum, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, number));
  }

  function discountLine(label, amountCents, code) {
    return Object.freeze({
      kind: "discount",
      code,
      label,
      amountCents: -Math.abs(amountCents),
    });
  }

  function chargeLine(label, amountCents, code, quantity, unitCents) {
    return Object.freeze({
      kind: "charge",
      code,
      label,
      quantity,
      unitCents,
      amountCents,
    });
  }

  function calculateQuote(options) {
    const settings = options || {};
    const rates = getRates(settings.squareFeet);
    if (!rates) {
      return null;
    }

    const program = getProgram(settings.program);
    const applications = clampInteger(settings.applications, 1, 7, 6);
    const payment = PAYMENT_LABELS[settings.payment]
      ? settings.payment
      : "autopay_visit";
    const requestedPromotion = PROMOTION_LABELS[settings.promotion]
      ? settings.promotion
      : "NONE";
    const promotion = payment === "prepay" ? "NONE" : requestedPromotion;
    const date = cleanDate(settings.date);
    const lines = [];

    const regularTotal = rates.regularCents * applications;
    lines.push(
      chargeLine(
        `Regular applications (${formatMoney(rates.regularCents)} × ${applications})`,
        regularTotal,
        "regular",
        applications,
        rates.regularCents,
      ),
    );

    if (program.aeration) {
      lines.push(
        chargeLine(
          "Aeration",
          rates.aerationCents,
          "aeration",
          1,
          rates.aerationCents,
        ),
      );
    }

    if (program.overseeding) {
      lines.push(
        chargeLine(
          "Overseeding",
          rates.overseedingCents,
          "overseeding",
          1,
          rates.overseedingCents,
        ),
      );
    }

    if (program.grub) {
      lines.push(
        chargeLine(
          "Grub control",
          rates.grubCents,
          "grub",
          1,
          rates.grubCents,
        ),
      );
    }

    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.amountCents,
      0,
    );
    let totalCents = subtotalCents;
    let promotionDiscountCents = 0;
    let prepayDiscountCents = 0;
    let prepayStatus = "none";

    if (promotion === "DH50" || promotion === "WEB50") {
      const discountedTotalCents = Math.round(
        totalCents -
          rates.regularCents *
            (pricing.discounts.firstAppPercent / 100),
      );
      promotionDiscountCents = totalCents - discountedTotalCents;
      totalCents = discountedTotalCents;
      lines.push(
        discountLine(
          `${promotion} first application discount`,
          promotionDiscountCents,
          promotion.toLowerCase(),
        ),
      );
    } else if (promotion === "Military") {
      const discountedTotalCents = Math.round(
        totalCents *
          (1 - pricing.discounts.militaryPercent / 100),
      );
      promotionDiscountCents = totalCents - discountedTotalCents;
      totalCents = discountedTotalCents;
      lines.push(
        discountLine(
          `Military / First Responder (${pricing.discounts.militaryPercent}%)`,
          promotionDiscountCents,
          "military",
        ),
      );
    }

    if (payment === "prepay") {
      if (isEarlyPrepay(date)) {
        prepayStatus = "early_discount";
        const discountedTotalCents = Math.round(
          totalCents *
            (1 - pricing.discounts.prepayPercent / 100),
        );
        prepayDiscountCents = totalCents - discountedTotalCents;
        totalCents = discountedTotalCents;
        lines.push(
          discountLine(
            `Prepay discount (${pricing.discounts.prepayPercent}%)`,
            prepayDiscountCents,
            "prepay",
          ),
        );
      } else {
        prepayStatus = "free_lime_bonus";
        prepayDiscountCents = rates.regularCents;
        totalCents -= prepayDiscountCents;
        lines.push(
          discountLine(
            "Free Lime Prepay Bonus",
            prepayDiscountCents,
            "free_lime",
          ),
        );
      }
    }

    totalCents = Math.max(0, totalCents);

    return Object.freeze({
      squareFeet: rates.squareFeet,
      applications,
      area: settings.area || "Entire Lot",
      payment,
      promotion,
      program,
      rates,
      lines: Object.freeze(lines),
      subtotalCents,
      promotionDiscountCents,
      prepayDiscountCents,
      prepayStatus,
      totalCents,
      visits:
        applications +
        program.aeration +
        program.overseeding +
        program.grub,
      date,
    });
  }

  function ordinal(value) {
    const number = Number(value);
    const mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) {
      return `${number}th`;
    }
    if (number % 10 === 1) return `${number}st`;
    if (number % 10 === 2) return `${number}nd`;
    if (number % 10 === 3) return `${number}rd`;
    return `${number}th`;
  }

  function monthRangeLabel(installments) {
    const first = installments[0];
    const last = installments[installments.length - 1];
    const formatter = new Intl.DateTimeFormat("en-US", { month: "long" });
    const firstMonth = formatter.format(first.date);
    const lastMonth = formatter.format(last.date);
    return firstMonth === lastMonth
      ? firstMonth
      : `${firstMonth} through ${lastMonth}`;
  }

  function createMonthlySchedule(totalCents, draftDay, value) {
    const date = cleanDate(value);
    const day = clampInteger(draftDay, 1, 28, 15);
    let startMonth =
      date.getDate() <= day ? date.getMonth() : date.getMonth() + 1;

    if (startMonth > 11) {
      startMonth = 11;
    }

    const count = Math.max(1, 12 - startMonth);
    const basePaymentCents = Math.floor(totalCents / count);
    const installments = [];

    for (let index = 0; index < count; index += 1) {
      const amountCents =
        index === count - 1
          ? totalCents - basePaymentCents * (count - 1)
          : basePaymentCents;
      installments.push(
        Object.freeze({
          date: new Date(date.getFullYear(), startMonth + index, day, 12),
          amountCents,
        }),
      );
    }

    let summary;
    if (count === 1) {
      const dateLabel = new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
      }).format(installments[0].date);
      summary = `1 payment of ${formatMoney(totalCents)} on ${dateLabel}.`;
    } else {
      const finalPaymentCents = installments[count - 1].amountCents;
      const range = monthRangeLabel(installments);
      if (finalPaymentCents === basePaymentCents) {
        summary = `${count} monthly payments of ${formatMoney(basePaymentCents)} on the ${ordinal(day)}, ${range}.`;
      } else {
        summary = `${count - 1} monthly payments of ${formatMoney(basePaymentCents)} and a final payment of ${formatMoney(finalPaymentCents)} on the ${ordinal(day)}, ${range}.`;
      }
    }

    return Object.freeze({
      count,
      day,
      basePaymentCents,
      finalPaymentCents: installments[count - 1].amountCents,
      installments: Object.freeze(installments),
      summary,
    });
  }

  function includedServices(quote) {
    const services = [];
    if (quote.program.aeration) {
      services.push(`aeration at ${formatMoney(quote.rates.aerationCents)}`);
    }
    if (quote.program.overseeding) {
      services.push(
        `overseeding at ${formatMoney(quote.rates.overseedingCents)}`,
      );
    }
    if (quote.program.grub) {
      services.push(`grub control at ${formatMoney(quote.rates.grubCents)}`);
    }
    return services;
  }

  function joinServices(services) {
    if (services.length === 0) return "";
    if (services.length === 1) return services[0];
    if (services.length === 2) return `${services[0]} and ${services[1]}`;
    return `${services.slice(0, -1).join(", ")}, and ${services.at(-1)}`;
  }

  function createCustomerText(quote, draftDay) {
    if (!quote) return "";

    const area = String(quote.area || "Entire Lot").toLowerCase();
    const appWord = quote.applications === 1 ? "application" : "applications";
    const parts = [
      `${pricing.year} ${quote.program.name} program for the ${area}: ${quote.applications} remaining regular ${appWord} at ${formatMoney(quote.rates.regularCents)} each.`,
    ];
    const services = includedServices(quote);

    if (services.length) {
      parts.push(`Included: ${joinServices(services)}.`);
    }

    if (quote.promotion === "DH50" || quote.promotion === "WEB50") {
      parts.push(
        `${quote.promotion} saves ${formatMoney(quote.promotionDiscountCents)} on the first regular application.`,
      );
    } else if (quote.promotion === "Military") {
      parts.push(
        `Military / First Responder discount: ${formatMoney(quote.promotionDiscountCents)}.`,
      );
    }

    if (quote.prepayStatus === "early_discount") {
      parts.push(
        `Prepay discount: ${formatMoney(quote.prepayDiscountCents)}.`,
      );
    } else if (quote.prepayStatus === "free_lime_bonus") {
      parts.push(
        `Free Lime Prepay Bonus: ${formatMoney(quote.prepayDiscountCents)}.`,
      );
    }

    parts.push(`Season total: ${formatMoney(quote.totalCents)}.`);

    if (quote.payment === "monthly_installment") {
      parts.push(
        `Monthly autopay: ${createMonthlySchedule(quote.totalCents, draftDay, quote.date).summary}`,
      );
    } else if (quote.payment === "autopay_visit") {
      parts.push("Autopay is processed after each service.");
    } else {
      parts.push("Payment arrangement: prepay.");
    }

    return parts.join(" ");
  }

  function createInternalNote(quote, draftDay) {
    if (!quote) return "";

    const parts = [
      String(pricing.year),
      quote.program.name,
      quote.area,
      PAYMENT_LABELS[quote.payment],
    ];

    if (quote.payment === "monthly_installment") {
      parts.push(ordinal(clampInteger(draftDay, 1, 28, 15)));
    }

    if (quote.promotion !== "NONE") {
      parts.push(PROMOTION_LABELS[quote.promotion]);
    }

    if (quote.prepayStatus === "free_lime_bonus") {
      parts.push("Free Lime Prepay Bonus");
    } else if (quote.prepayStatus === "early_discount") {
      parts.push(`${pricing.discounts.prepayPercent}% Prepay Discount`);
    }

    return parts.join(" ");
  }

  return Object.freeze({
    PAYMENT_LABELS,
    PROMOTION_LABELS,
    calculateQuote,
    createCustomerText,
    createInternalNote,
    createMonthlySchedule,
    formatMoney,
    formatNumber,
    getProgram,
    getRates,
    isEarlyPrepay,
    ordinal,
    parseSquareFeet,
    toCents,
  });
});
