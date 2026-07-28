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
    date: "2026-07-28",
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
  assert.equal(rates.regularCents, 7610);
  assert.equal(rates.grubCents, 14190);
  assert.equal(rates.aerationCents, 18155);
  assert.equal(rates.overseedingCents, 18155);
});

test("aeration and overseeding are separate charges", () => {
  const enhanced = quote({ program: "Enh" });
  assert.equal(enhanced.subtotalCents, 81970);
  assert.equal(
    enhanced.lines.find((line) => line.code === "aeration").amountCents,
    18155,
  );
  assert.equal(
    enhanced.lines.find((line) => line.code === "overseeding").amountCents,
    18155,
  );
});

test("all six program totals use the correct included services", () => {
  const expected = {
    Ess: 45660,
    Enh: 81970,
    Elite: 96160,
    AG: 59850,
    B: 63815,
    C: 78005,
  };

  for (const [program, totalCents] of Object.entries(expected)) {
    assert.equal(quote({ program }).totalCents, totalCents, program);
  }
});

test("large lawn formulas return the confirmed 156,000 sq ft prices", () => {
  const rates = engine.getRates(156000);
  assert.equal(rates.regularCents, 87581);
  assert.equal(rates.grubCents, 139026);
  assert.equal(rates.aerationCents, 336258);
  assert.equal(rates.overseedingCents, 336258);
  assert.equal(rates.extrapolated, true);
});

test("early prepay receives 5 percent through January 31", () => {
  const january31 = quote({
    applications: 5,
    payment: "prepay",
    date: "2026-01-31",
  });
  assert.equal(january31.prepayStatus, "early_discount");
  assert.equal(january31.totalCents, 36148);
});

test("late prepay deducts one regular application at any app count", () => {
  const fiveApps = quote({
    applications: 5,
    payment: "prepay",
    date: "2026-02-01",
  });
  const sevenApps = quote({
    applications: 7,
    payment: "prepay",
    date: "2026-07-28",
  });

  assert.equal(fiveApps.prepayStatus, "free_lime_bonus");
  assert.equal(fiveApps.prepayDiscountCents, 7610);
  assert.equal(fiveApps.totalCents, 30440);
  assert.equal(sevenApps.prepayDiscountCents, 7610);
  assert.equal(sevenApps.totalCents, 45660);
});

test("prepay removes other promotions and prevents stacking", () => {
  const result = quote({
    payment: "prepay",
    promotion: "Military",
  });
  assert.equal(result.promotion, "NONE");
  assert.equal(result.promotionDiscountCents, 0);
  assert.equal(result.totalCents, 38050);
});

test("DH50, WEB50, and military discounts calculate independently", () => {
  assert.equal(quote({ promotion: "DH50" }).totalCents, 41855);
  assert.equal(quote({ promotion: "WEB50" }).totalCents, 41855);
  assert.equal(quote({ promotion: "Military" }).totalCents, 43377);
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
  assert.match(message, /^2026 Elite program for the entire lot:/);
  assert.match(message, /Season total: \$961\.60\./);
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
  assert.match(worker, new RegExp(`wm-quote-${pricing.release.replaceAll(".", "\\.")}`));
});
