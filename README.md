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

The test suite covers the rate table, all program combinations, large-lawn
formulas, promotions, Prepay rules, monthly payment rounding, customer copy,
and release synchronization.

## Update pricing

Edit `pricing.js`. The file contains:

- The pricing year and update date
- Discount percentages and the January 31 cutoff
- Program inclusions
- The square footage rate table
- The formulas used above 99,999 sq ft

Run `npm test` after every pricing change.

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
