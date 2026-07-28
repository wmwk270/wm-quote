#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_ENDING_SQUARE_FEET = 99999;
const RELEASE_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

function parseCsv(source) {
  if (typeof source !== "string") {
    throw new TypeError("CSV source must be text.");
  }

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("Unexpected quote in an unquoted CSV field.");
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => String(value).trim() !== ""),
  );
}

function normalizeHeader(value) {
  return String(value)
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseMoney(value, description = "price") {
  const original = String(value).trim();
  const isParenthesized =
    original.startsWith("(") && original.endsWith(")");
  const unsigned = isParenthesized ? original.slice(1, -1) : original;
  const normalized = unsigned.replace(/[$,\s]/g, "");

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${description} is not a valid dollar amount: "${original}".`);
  }

  const amount = Number(normalized) * (isParenthesized ? -1 : 1);
  if (!Number.isFinite(amount)) {
    throw new Error(`${description} is not a valid dollar amount: "${original}".`);
  }

  return Math.round(amount * 100) / 100;
}

function parseRange(value, description) {
  const match = String(value)
    .trim()
    .match(/^([\d,]+)\s*-\s*([\d,]+)$/);

  if (!match) {
    throw new Error(`${description} has an invalid Area/Diff range: "${value}".`);
  }

  const minimum = Number(match[1].replaceAll(",", ""));
  const maximum = Number(match[2].replaceAll(",", ""));
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum < 0 ||
    maximum < minimum
  ) {
    throw new Error(`${description} has an invalid Area/Diff range: "${value}".`);
  }

  return { minimum, maximum };
}

function parseSchedule(source, label = "Schedule") {
  const rows = parseCsv(source);
  if (rows.length < 2) {
    throw new Error(`${label} does not contain any pricing rows.`);
  }

  const headers = rows[0].map(normalizeHeader);
  const rangeIndex = headers.indexOf("area/diff");
  const serviceIndex = headers.indexOf("service $");
  const productionIndex = headers.indexOf("production $");

  const missingHeaders = [
    ["Area/Diff", rangeIndex],
    ["Service $", serviceIndex],
    ["Production $", productionIndex],
  ]
    .filter(([, index]) => index === -1)
    .map(([header]) => header);

  if (missingHeaders.length > 0) {
    throw new Error(
      `${label} is missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.`,
    );
  }

  const entries = [];
  const warnings = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const lineNumber = index + 1;
    const rangeText = String(row[rangeIndex] ?? "").trim();
    const serviceText = String(row[serviceIndex] ?? "").trim();
    const productionText = String(row[productionIndex] ?? "").trim();

    if (!rangeText && !serviceText && !productionText) {
      continue;
    }
    if (!rangeText || !serviceText) {
      throw new Error(
        `${label} row ${lineNumber} must include Area/Diff and Service $.`,
      );
    }

    const range = parseRange(rangeText, `${label} row ${lineNumber}`);
    const service = parseMoney(
      serviceText,
      `${label} row ${lineNumber} Service $`,
    );
    if (service <= 0) {
      throw new Error(`${label} row ${lineNumber} Service $ must be positive.`);
    }

    let production = null;
    if (productionText) {
      production = parseMoney(
        productionText,
        `${label} row ${lineNumber} Production $`,
      );
      if (production !== service) {
        warnings.push(
          `${label} row ${lineNumber} (${rangeText}): Service ${formatMoney(service)} differs from Production ${formatMoney(production)}. Service $ will be imported.`,
        );
      }
    }

    entries.push({
      ...range,
      service,
      production,
      sourceLine: lineNumber,
    });
  }

  if (entries.length === 0) {
    throw new Error(`${label} does not contain any pricing rows.`);
  }
  if (entries[0].minimum !== 0) {
    throw new Error(`${label} must begin with the 0 square-foot tier.`);
  }

  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const expectedMinimum = previous.maximum + 1;
    if (current.minimum !== expectedMinimum) {
      throw new Error(
        `${label} has a gap or overlap before ${current.minimum}-${current.maximum}; expected the next range to begin at ${expectedMinimum}.`,
      );
    }
  }

  const endingSquareFeet = entries.at(-1).maximum;
  if (endingSquareFeet !== REQUIRED_ENDING_SQUARE_FEET) {
    throw new Error(
      `${label} must end at ${REQUIRED_ENDING_SQUARE_FEET.toLocaleString("en-US")} square feet; found ${endingSquareFeet.toLocaleString("en-US")}.`,
    );
  }

  return { label, entries, warnings };
}

function combineSchedules({ regular, grub, aeration }) {
  if (!regular || !grub || !aeration) {
    throw new Error("Regular, grub, and OS schedules are all required.");
  }

  const schedules = [grub, aeration];
  for (const schedule of schedules) {
    if (schedule.entries.length !== regular.entries.length) {
      throw new Error(
        `${schedule.label} has ${schedule.entries.length} tiers, but ${regular.label} has ${regular.entries.length}.`,
      );
    }
  }

  const rates = regular.entries.map((regularEntry, index) => {
    const grubEntry = grub.entries[index];
    const aerationEntry = aeration.entries[index];

    for (const [schedule, entry] of [
      [grub, grubEntry],
      [aeration, aerationEntry],
    ]) {
      if (
        entry.minimum !== regularEntry.minimum ||
        entry.maximum !== regularEntry.maximum
      ) {
        throw new Error(
          `${schedule.label} range ${entry.minimum}-${entry.maximum} does not match ${regular.label} range ${regularEntry.minimum}-${regularEntry.maximum}.`,
        );
      }
    }

    return {
      minimum: regularEntry.minimum,
      maximum: regularEntry.maximum,
      regular: regularEntry.service,
      grub: grubEntry.service,
      aeration: aerationEntry.service,
      overseeding: aerationEntry.service,
    };
  });

  return {
    rates,
    threshold: rates.at(-1).maximum,
    bases: {
      regular: rates.at(-1).regular,
      grub: rates.at(-1).grub,
      aeration: rates.at(-1).aeration,
    },
    warnings: [
      ...regular.warnings,
      ...grub.warnings,
      ...aeration.warnings,
    ],
  };
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPriceLiteral(amount) {
  return Number(amount).toFixed(2);
}

function replaceRequired(source, pattern, replacement, description) {
  if (!pattern.test(source)) {
    throw new Error(`Could not find ${description} in the project file.`);
  }
  return source.replace(pattern, replacement);
}

function buildPricingSource(
  currentSource,
  { year, updated, release, combined, perThousand },
) {
  const version = `${year} Pricing`;
  let source = currentSource;

  source = replaceRequired(
    source,
    /^    version: ".*",$/m,
    `    version: ${JSON.stringify(version)},`,
    "the pricing version",
  );
  source = replaceRequired(
    source,
    /^    year: \d+,$/m,
    `    year: ${year},`,
    "the pricing year",
  );
  source = replaceRequired(
    source,
    /^    updated: ".*",$/m,
    `    updated: ${JSON.stringify(updated)},`,
    "the pricing update date",
  );
  source = replaceRequired(
    source,
    /^    release: "\d{4}\.\d{2}\.\d{2}\.\d+",$/m,
    `    release: "${release}",`,
    "the release identifier",
  );
  source = replaceRequired(
    source,
    /^      prepayCutoff: "\d{4}-02-01",$/m,
    `      prepayCutoff: "${year}-02-01",`,
    "the January 31 prepay cutoff",
  );

  const extensionBlock = [
    "    extension: Object.freeze({",
    `      threshold: ${combined.threshold},`,
    `      regular: Object.freeze({ base: ${formatPriceLiteral(combined.bases.regular)}, perThousand: ${formatPriceLiteral(perThousand.regular)} }),`,
    `      grub: Object.freeze({ base: ${formatPriceLiteral(combined.bases.grub)}, perThousand: ${formatPriceLiteral(perThousand.grub)} }),`,
    "      aerationOrOverseeding: Object.freeze({",
    `        base: ${formatPriceLiteral(combined.bases.aeration)},`,
    `        perThousand: ${formatPriceLiteral(perThousand.aeration)},`,
    "      }),",
    "    }),",
  ].join("\n");

  source = replaceRequired(
    source,
    /^    extension: Object\.freeze\(\{\n[\s\S]*?^    \}\),$/m,
    extensionBlock,
    "the large-lawn formula settings",
  );

  const rateRows = combined.rates.map(
    (rate) =>
      `      Object.freeze([${rate.maximum}, ${formatPriceLiteral(rate.regular)}, ${formatPriceLiteral(rate.grub)}, ${formatPriceLiteral(rate.aeration)}]),`,
  );
  const ratesBlock = [
    "    rates: Object.freeze([",
    ...rateRows,
    "    ]),",
  ].join("\n");

  return replaceRequired(
    source,
    /^    rates: Object\.freeze\(\[\n[\s\S]*?^    \]\),$/m,
    ratesBlock,
    "the square-footage rate table",
  );
}

function buildVersionSource(currentSource, { year, updated, release }) {
  let version;
  try {
    version = JSON.parse(currentSource);
  } catch {
    throw new Error("version.json is not valid JSON.");
  }

  version.release = release;
  version.pricingVersion = `${year} Pricing`;
  version.pricingUpdated = updated;
  return `${JSON.stringify(version, null, 2)}\n`;
}

function buildWorkerSource(currentSource, release) {
  return replaceRequired(
    currentSource,
    /^const CACHE_NAME = "wm-quote-\d{4}\.\d{2}\.\d{2}\.\d+";$/m,
    `const CACHE_NAME = "wm-quote-${release}";`,
    "the service-worker cache name",
  );
}

function nextRelease(currentRelease, now = new Date()) {
  const prefix = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join(".");

  const match = String(currentRelease).match(
    /^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/,
  );
  const sequence =
    match && match[1] === prefix ? Number(match[2]) + 1 : 1;
  return `${prefix}.${sequence}`;
}

function parsePositiveDecimal(value, description) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${description} must be a positive number.`);
  }
  return amount;
}

function parseYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Pricing year must be a four-digit year.");
  }
  return year;
}

function parseArguments(argv) {
  const values = {};
  const booleanFlags = new Set(["dry-run", "help"]);
  const knownValueFlags = new Set([
    "config",
    "regular",
    "grub",
    "os",
    "aeration",
    "year",
    "updated",
    "release",
    "regular-per-thousand",
    "grub-per-thousand",
    "aeration-per-thousand",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const name = argument.slice(2);
    if (booleanFlags.has(name)) {
      values[name] = true;
      continue;
    }
    if (!knownValueFlags.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`--${name} requires a value.`);
    }
    values[name] = value;
    index += 1;
  }

  return values;
}

function readConfig(configPath) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw new Error(`Could not read config file: ${error.message}`);
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Pricing config must contain a JSON object.");
  }
  return config;
}

function resolveOptions(argumentsMap, currentPricing, cwd = process.cwd()) {
  const configPath = argumentsMap.config
    ? path.resolve(cwd, argumentsMap.config)
    : null;
  const config = configPath ? readConfig(configPath) : {};
  const configDirectory = configPath ? path.dirname(configPath) : cwd;
  const files = config.files || {};
  const configuredPerThousand = config.perThousand || {};

  function resolveInputFile(cliValue, configuredValue) {
    if (cliValue) return path.resolve(cwd, cliValue);
    if (configuredValue) return path.resolve(configDirectory, configuredValue);
    return null;
  }

  const regularPath = resolveInputFile(
    argumentsMap.regular,
    files.regular,
  );
  const grubPath = resolveInputFile(argumentsMap.grub, files.grub);
  const aerationPath = resolveInputFile(
    argumentsMap.os || argumentsMap.aeration,
    files.os || files.aeration,
  );
  const missingFiles = [
    ["regular F1", regularPath],
    ["grub PGC", grubPath],
    ["OS", aerationPath],
  ]
    .filter(([, value]) => !value)
    .map(([label]) => label);

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing CSV file option${missingFiles.length === 1 ? "" : "s"}: ${missingFiles.join(", ")}.`,
    );
  }

  const year = parseYear(argumentsMap.year ?? config.year);
  const updated = String(argumentsMap.updated ?? config.updated ?? "").trim();
  if (!updated) {
    throw new Error("Pricing update date is required.");
  }
  if (/[\r\n]/.test(updated)) {
    throw new Error("Pricing update date must be a single line.");
  }

  const configuredRelease = argumentsMap.release ?? config.release;
  const release = configuredRelease
    ? String(configuredRelease)
    : nextRelease(currentPricing.release);
  if (!RELEASE_PATTERN.test(release)) {
    throw new Error("Release must use YYYY.MM.DD.N format.");
  }

  const slopeInputs = {
    regular:
      argumentsMap["regular-per-thousand"] ??
      configuredPerThousand.regular,
    grub:
      argumentsMap["grub-per-thousand"] ?? configuredPerThousand.grub,
    aeration:
      argumentsMap["aeration-per-thousand"] ??
      configuredPerThousand.aeration,
  };
  const preservedSlopes = [];
  const perThousand = {};

  for (const [key, currentValue] of [
    ["regular", currentPricing.extension.regular.perThousand],
    ["grub", currentPricing.extension.grub.perThousand],
    [
      "aeration",
      currentPricing.extension.aerationOrOverseeding.perThousand,
    ],
  ]) {
    if (slopeInputs[key] === undefined || slopeInputs[key] === null) {
      perThousand[key] = currentValue;
      preservedSlopes.push(key);
    } else {
      perThousand[key] = parsePositiveDecimal(
        slopeInputs[key],
        `${key} per-thousand amount`,
      );
    }
  }

  return {
    files: {
      regular: regularPath,
      grub: grubPath,
      aeration: aerationPath,
    },
    year,
    updated,
    release,
    perThousand,
    preservedSlopes,
    dryRun: Boolean(argumentsMap["dry-run"]),
  };
}

function readScheduleFile(filePath, label) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} CSV file not found: ${filePath}`);
    }
    throw new Error(`Could not read ${label} CSV: ${error.message}`);
  }
  return parseSchedule(source, label);
}

function writeProjectFiles(projectRoot, sources) {
  const targets = [
    ["pricing.js", sources.pricing],
    ["version.json", sources.version],
    ["sw.js", sources.worker],
  ];

  for (const [filename, source] of targets) {
    fs.writeFileSync(path.join(projectRoot, filename), source);
  }
}

function importPricing(options, projectRoot) {
  const regular = readScheduleFile(options.files.regular, "Regular F1");
  const grub = readScheduleFile(options.files.grub, "Grub PGC");
  const aeration = readScheduleFile(options.files.aeration, "OS");
  const combined = combineSchedules({ regular, grub, aeration });

  const pricingPath = path.join(projectRoot, "pricing.js");
  const versionPath = path.join(projectRoot, "version.json");
  const workerPath = path.join(projectRoot, "sw.js");
  const currentPricingSource = fs.readFileSync(pricingPath, "utf8");
  const currentVersionSource = fs.readFileSync(versionPath, "utf8");
  const currentWorkerSource = fs.readFileSync(workerPath, "utf8");
  const metadata = {
    year: options.year,
    updated: options.updated,
    release: options.release,
  };

  const sources = {
    pricing: buildPricingSource(currentPricingSource, {
      ...metadata,
      combined,
      perThousand: options.perThousand,
    }),
    version: buildVersionSource(currentVersionSource, metadata),
    worker: buildWorkerSource(currentWorkerSource, options.release),
  };

  if (!options.dryRun) {
    writeProjectFiles(projectRoot, sources);
  }

  return { regular, grub, aeration, combined, sources };
}

function printSummary(options, result) {
  const first = result.combined.rates[0];
  const last = result.combined.rates.at(-1);
  const labels = {
    regular: "Regular",
    grub: "Grub",
    aeration: "Aeration/overseeding",
  };

  console.log(
    `${result.combined.rates.length} matching square-footage tiers validated.`,
  );
  console.log(
    `Regular: ${formatMoney(first.regular)} to ${formatMoney(last.regular)}.`,
  );
  console.log(`Grub: ${formatMoney(first.grub)} to ${formatMoney(last.grub)}.`);
  console.log(
    `OS: ${formatMoney(first.aeration)} to ${formatMoney(last.aeration)}; applied to both aeration and overseeding.`,
  );
  console.log(
    `Large-lawn formulas: regular ${formatMoney(options.perThousand.regular)}, grub ${formatMoney(options.perThousand.grub)}, and aeration/overseeding ${formatMoney(options.perThousand.aeration)} per additional 1,000 sq ft.`,
  );

  if (options.preservedSlopes.length > 0) {
    console.log(
      `Unchanged per-thousand amounts: ${options.preservedSlopes.map((key) => labels[key]).join(", ")}.`,
    );
  }

  if (result.combined.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.combined.warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log(
    `\n${options.dryRun ? "Dry run complete; no files changed." : `Pricing updated to ${options.year} with release ${options.release}.`}`,
  );
}

function printHelp() {
  console.log(`Usage:
  npm run import-pricing -- --config pricing-update.json [--dry-run]

Or provide the values directly:
  npm run import-pricing -- \\
    --regular "F1 Schedule.csv" \\
    --grub "PGC Schedule.csv" \\
    --os "OS Schedule.csv" \\
    --year 2027 \\
    --updated "January 15, 2027" \\
    [--regular-per-thousand 5.50] \\
    [--grub-per-thousand 10.50] \\
    [--aeration-per-thousand 26.00] \\
    [--release 2027.01.15.1] \\
    [--dry-run]

Service $ controls quote prices. Production $ differences are reported as
warnings. If a per-thousand amount is omitted, its current value is kept.`);
}

function main() {
  try {
    const argumentsMap = parseArguments(process.argv.slice(2));
    if (argumentsMap.help) {
      printHelp();
      return;
    }

    const projectRoot = path.resolve(__dirname, "..");
    const pricingPath = path.join(projectRoot, "pricing.js");
    delete require.cache[require.resolve(pricingPath)];
    const currentPricing = require(pricingPath);
    const options = resolveOptions(argumentsMap, currentPricing);
    const result = importPricing(options, projectRoot);
    printSummary(options, result);
  } catch (error) {
    console.error(`Pricing import failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPricingSource,
  buildVersionSource,
  buildWorkerSource,
  combineSchedules,
  formatMoney,
  importPricing,
  nextRelease,
  parseArguments,
  parseCsv,
  parseMoney,
  parseSchedule,
  resolveOptions,
};
