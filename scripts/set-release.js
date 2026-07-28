const fs = require("node:fs");
const path = require("node:path");

const release = process.argv[2];
if (!release || !/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release)) {
  console.error("Usage: npm run release -- YYYY.MM.DD.N");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const pricingPath = path.join(root, "pricing.js");
const versionPath = path.join(root, "version.json");
const workerPath = path.join(root, "sw.js");

const pricing = fs
  .readFileSync(pricingPath, "utf8")
  .replace(/release: "\d{4}\.\d{2}\.\d{2}\.\d+"/, `release: "${release}"`);
fs.writeFileSync(pricingPath, pricing);

const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
version.release = release;
fs.writeFileSync(versionPath, `${JSON.stringify(version, null, 2)}\n`);

const worker = fs
  .readFileSync(workerPath, "utf8")
  .replace(/wm-quote-\d{4}\.\d{2}\.\d{2}\.\d+/, `wm-quote-${release}`);
fs.writeFileSync(workerPath, worker);

console.log(`Release set to ${release}.`);
