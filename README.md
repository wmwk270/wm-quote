# Weed Man Sales Quote

A maintainable, offline-ready quote calculator for Weed Man sales
representatives.

## Run locally

Serve the repository with any static web server:

```sh
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Test pricing

```sh
npm test
```

The test suite covers CSV importing, the rate table, all program combinations,
large-lawn formulas, promotions, Prepay rules, monthly payment rounding,
customer copy, and release synchronization.

## Update pricing

The safest yearly update is to import the three schedules exported by the
pricing system:

1. Rename the exports `F1 Schedule.csv`, `PGC Schedule.csv`, and
   `OS Schedule.csv`, then place them in the repository root. The FAE
   schedule has the same prices as OS, so an FAE export can be used as the OS
   file (in the config's `os` entry, or with `--os`).
2. Copy `pricing-update.example.json` to `pricing-update.json`.
3. In `pricing-update.json`, enter the new pricing year, update date, and the
   three per-1,000-square-foot amounts used above 99,999 sq ft.
4. Validate everything without changing the app:

   ```sh
   npm run import-pricing -- --config pricing-update.json --dry-run
   ```

5. If the summary is correct, import the pricing and run the full test suite:

   ```sh
   npm run import-pricing -- --config pricing-update.json
   npm test
   ```

The importer validates that all three schedules begin at zero, have no gaps or
overlaps, use matching square-footage tiers, and end at 99,999 sq ft. `Service
$` controls the quote prices. Any difference in `Production $` is reported as
a warning but is not imported. The OS schedule is used for both aeration and
overseeding.

The final price in each CSV automatically becomes the base for that service's
large-lawn formula. If a per-1,000 amount is left out of the config, its
current value is kept and reported in the import summary. The January 31
Prepay cutoff also advances automatically to the imported pricing year.

The importer also sets a new release identifier and updates the offline cache,
so representatives will receive the app's automatic update prompt after the
new files are published.

## Publish an app update

Set a new release identifier before publishing:

```sh
npm run release -- 2026.08.01.1
```

The command updates the app version and offline cache together. Reps with an
older version will see a refresh prompt after the new release is deployed.

## Saved quotes

Saved quotes remain in the representative's current browser using local
storage. They are not synced to other browsers or users.
