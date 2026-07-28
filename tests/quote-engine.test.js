const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pricing = require("../pricing.js");
const engine = require("../quote-engine.js");

function quote(overrides = {}) {
  return engine.calculateQuote({
    squareFeet: 8100,
    program: "Ess",
    applications: 6,
    area: "Entire Lot",
    payment: "autopay_visit",
    promotion: "NONE",
    date: `${pricing.year}-07-28`,
    ...overrides,
  });
}

test("blank and zero square footage are invalid", () => {
  assert.equal(engine.getRates(""), null);
  assert.equal(engine.getRates("0"), null);
  assert.equal(engine.getRates(0), null);
});

test("8,100 square feet uses the correct price tier", () => {
  const rates = engine.getRates(8100);
  const tier = pricing.rates.find((row) => 8100 <= row[0]);

  assert.equal(rates.regularCents, engine.toCents(tier[1]));
  assert.equal(rates.grubCents, engine.toCents(tier[2]));
  assert.equal(rates.aerationCents, engine.toCents(tier[3]));
  assert.equal(rates.overseedingCents, engine.toCents(tier[3]));

  if (pricing.year === 2026) {
    assert.deepEqual(
      [
        rates.regularCents,
        rates.grubCents,
        rates.aerationCents,
        rates.overseedingCents,
      ],
      [7610, 14190, 18155, 18155],
    );
  }
});

test("aeration and overseeding are separate charges", () => {
  const enhanced = quote({ program: "Enh" });
  const expectedSubtotal =
    enhanced.rates.regularCents * enhanced.applications +
    enhanced.rates.aerationCents +
    enhanced.rates.overseedingCents;
  assert.equal(enhanced.subtotalCents, expectedSubtotal);
  assert.equal(
    enhanced.lines.find((line) => line.code === "aeration").amountCents,
    enhanced.rates.aerationCents,
  );
  assert.equal(
    enhanced.lines.find((line) => line.code === "overseeding").amountCents,
    enhanced.rates.overseedingCents,
  );
});

test("all six program totals use the correct included services", () => {
  const rates = engine.getRates(8100);

  for (const program of pricing.programs) {
    const expectedTotal =
      rates.regularCents * 6 +
      rates.aerationCents * program.aeration +
      rates.overseedingCents * program.overseeding +
      rates.grubCents * program.grub;
    assert.equal(
      quote({ program: program.key }).totalCents,
      expectedTotal,
      program.key,
    );
  }
});

test("large lawn formulas return the confirmed 156,000 sq ft prices", () => {
  const squareFeet = 156000;
  const rates = engine.getRates(squareFeet);
  const thousandsOver =
    (squareFeet - pricing.extension.threshold) / 1000;
  const expectedRegular = engine.toCents(
    pricing.extension.regular.base +
      thousandsOver * pricing.extension.regular.perThousand,
  );
  const expectedGrub = engine.toCents(
    pricing.extension.grub.base +
      thousandsOver * pricing.extension.grub.perThousand,
  );
  const expectedAeration = engine.toCents(
    pricing.extension.aerationOrOverseeding.base +
      thousandsOver *
        pricing.extension.aerationOrOverseeding.perThousand,
  );

  assert.equal(rates.regularCents, expectedRegular);
  assert.equal(rates.grubCents, expectedGrub);
  assert.equal(rates.aerationCents, expectedAeration);
  assert.equal(rates.overseedingCents, expectedAeration);
  assert.equal(rates.extrapolated, true);

  if (pricing.year === 2026) {
    assert.deepEqual(
      [
        rates.regularCents,
        rates.grubCents,
        rates.aerationCents,
        rates.overseedingCents,
      ],
      [87581, 139026, 336258, 336258],
    );
  }
});

test("early prepay receives 5 percent through January 31", () => {
  const january31 = quote({
    applications: 5,
    payment: "prepay",
    date: `${pricing.year}-01-31`,
  });
  assert.equal(january31.prepayStatus, "early_discount");
  assert.equal(
    january31.totalCents,
    Math.round(
      january31.subtotalCents *
        (1 - pricing.discounts.prepayPercent / 100),
    ),
  );
});

test("late prepay deducts one regular application at any app count", () => {
  const fiveApps = quote({
    applications: 5,
    payment: "prepay",
    date: `${pricing.year}-02-01`,
  });
  const sevenApps = quote({
    applications: 7,
    payment: "prepay",
    date: `${pricing.year}-07-28`,
  });

  assert.equal(fiveApps.prepayStatus, "free_lime_bonus");
  assert.equal(
    fiveApps.prepayDiscountCents,
    fiveApps.rates.regularCents,
  );
  assert.equal(
    fiveApps.totalCents,
    fiveApps.rates.regularCents * 4,
  );
  assert.equal(
    sevenApps.prepayDiscountCents,
    sevenApps.rates.regularCents,
  );
  assert.equal(
    sevenApps.totalCents,
    sevenApps.rates.regularCents * 6,
  );
});

test("prepay removes other promotions and prevents stacking", () => {
  const result = quote({
    payment: "prepay",
    promotion: "Military",
  });
  assert.equal(result.promotion, "NONE");
  assert.equal(result.promotionDiscountCents, 0);
  assert.equal(
    result.totalCents,
    result.rates.regularCents * (result.applications - 1),
  );
});

test("DH50, WEB50, and military discounts calculate independently", () => {
  const base = quote();
  const firstAppTotal = Math.round(
    base.subtotalCents -
      base.rates.regularCents *
        (pricing.discounts.firstAppPercent / 100),
  );
  const militaryTotal = Math.round(
    base.subtotalCents *
      (1 - pricing.discounts.militaryPercent / 100),
  );

  assert.equal(quote({ promotion: "DH50" }).totalCents, firstAppTotal);
  assert.equal(quote({ promotion: "WEB50" }).totalCents, firstAppTotal);
  assert.equal(quote({ promotion: "Military" }).totalCents, militaryTotal);
});

test("monthly schedule starts next month after the draft day and sums exactly", () => {
  const schedule = engine.createMonthlySchedule(
    45660,
    15,
    "2026-07-28",
  );
  assert.equal(schedule.count, 5);
  assert.equal(schedule.installments[0].date.getMonth(), 7);
  assert.equal(schedule.installments.at(-1).date.getMonth(), 11);
  assert.equal(
    schedule.installments.reduce(
      (sum, installment) => sum + installment.amountCents,
      0,
    ),
    45660,
  );
  assert.equal(
    schedule.summary,
    "5 monthly payments of $91.32 on the 15th, August through December.",
  );
});

test("the final monthly payment absorbs any rounding cents", () => {
  const schedule = engine.createMonthlySchedule(
    45661,
    15,
    "2026-07-28",
  );
  assert.deepEqual(
    schedule.installments.map((item) => item.amountCents),
    [9132, 9132, 9132, 9132, 9133],
  );
});

test("customer copy is a concise text message with quote details only", () => {
  const result = quote({
    program: "Elite",
    payment: "monthly_installment",
  });
  const message = engine.createCustomerText(result, 15);
  assert.match(
    message,
    new RegExp(`^${pricing.year} Elite program for the entire lot:`),
  );
  assert.ok(
    message.includes(`Season total: ${engine.formatMoney(result.totalCents)}.`),
  );
  assert.match(message, /Monthly autopay:/);
  assert.doesNotMatch(message, /checking in|following up|https?:|click here/i);
  assert.doesNotMatch(message, /\?$/);
});

test("release identifiers stay synchronized for update detection", () => {
  const root = path.resolve(__dirname, "..");
  const version = JSON.parse(
    fs.readFileSync(path.join(root, "version.json"), "utf8"),
  );
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

  assert.equal(version.release, pricing.release);
  assert.equal(pricing.discounts.prepayCutoff, `${pricing.year}-02-01`);
  assert.match(worker, new RegExp(`wm-quote-${pricing.release.replaceAll(".", "\\.")}`));
});
