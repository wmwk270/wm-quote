const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const importer = require("../scripts/import-pricing.js");

function scheduleCsv(ranges, prices, productionPrices = prices) {
  const rows = ["Area/Diff,Service $,Production $"];
  for (let index = 0; index < ranges.length; index += 1) {
    rows.push(
      `${ranges[index]},${prices[index]},${productionPrices[index]}`,
    );
  }
  return `${rows.join("\n")}\n`;
}

test("CSV parsing preserves quoted prices containing thousands commas", () => {
  const rows = importer.parseCsv(
    'Area/Diff,Service $,Production $\r\n99000-99999,"1,906.55","1,906.55"\r\n',
  );

  assert.deepEqual(rows[1], ["99000-99999", "1,906.55", "1,906.55"]);
  assert.equal(importer.parseMoney(rows[1][1]), 1906.55);
});

test("schedule parsing uses Service $ and warns about Production $ differences", () => {
  const schedule = importer.parseSchedule(
    scheduleCsv(
      ["0-499", "500-99999"],
      ["54.15", "567.80"],
      ["54.15", "567.75"],
    ),
    "Regular F1",
  );

  assert.equal(schedule.entries.at(-1).service, 567.8);
  assert.equal(schedule.entries.at(-1).production, 567.75);
  assert.equal(schedule.warnings.length, 1);
  assert.match(schedule.warnings[0], /Service \$ will be imported/);
});

test("schedule validation rejects gaps and overlaps", () => {
  assert.throws(
    () =>
      importer.parseSchedule(
        scheduleCsv(
          ["0-499", "501-99999"],
          ["54.15", "567.80"],
        ),
        "Regular F1",
      ),
    /gap or overlap/,
  );
});

test("all three schedules must use identical ranges", () => {
  const regular = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["54.15", "567.80"]),
    "Regular F1",
  );
  const grub = importer.parseSchedule(
    scheduleCsv(["0-999", "1000-99999"], ["76.90", "802.25"]),
    "Grub PGC",
  );
  const aeration = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["101.00", "1906.55"]),
    "OS",
  );

  assert.throws(
    () => importer.combineSchedules({ regular, grub, aeration }),
    /does not match/,
  );
});

test("OS prices are mapped to both aeration and overseeding", () => {
  const regular = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["54.15", "567.80"]),
    "Regular F1",
  );
  const grub = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["76.90", "802.25"]),
    "Grub PGC",
  );
  const aeration = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["101.00", "1906.55"]),
    "OS",
  );
  const combined = importer.combineSchedules({ regular, grub, aeration });

  assert.equal(combined.rates.at(-1).aeration, 1906.55);
  assert.equal(combined.rates.at(-1).overseeding, 1906.55);
  assert.equal(combined.bases.aeration, 1906.55);
});

test("automatic releases increment on the same day and reset on a new day", () => {
  const sameDay = new Date(2026, 6, 28, 12);
  const nextDay = new Date(2026, 6, 29, 12);

  assert.equal(importer.nextRelease("2026.07.28.2", sameDay), "2026.07.28.3");
  assert.equal(importer.nextRelease("2026.07.28.2", nextDay), "2026.07.29.1");
});

test("a new pricing year also advances the January 31 prepay cutoff", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const currentSource = fs.readFileSync(
    path.join(projectRoot, "pricing.js"),
    "utf8",
  );
  const regular = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["54.15", "567.80"]),
    "Regular F1",
  );
  const grub = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["76.90", "802.25"]),
    "Grub PGC",
  );
  const aeration = importer.parseSchedule(
    scheduleCsv(["0-499", "500-99999"], ["101.00", "1906.55"]),
    "OS",
  );
  const combined = importer.combineSchedules({ regular, grub, aeration });
  const updatedSource = importer.buildPricingSource(currentSource, {
    year: 2027,
    updated: "January 15, 2027",
    release: "2027.01.15.1",
    combined,
    perThousand: { regular: 5.5, grub: 10.5, aeration: 26 },
  });

  assert.match(updatedSource, /prepayCutoff: "2027-02-01"/);
});
