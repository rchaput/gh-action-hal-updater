# Update publications in a Hugo website from HAL

This GitHub Action automatically pulls the publications from a given author on
HAL, and compares them to existing publications in a Hugo website (typically,
in the `content/publication/` folder). HAL publications that do not correspond
to local publications are proposed through a Pull Request.

## Build instructions

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the TypeScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  ./index.test.js
     ✓ throws invalid number (3ms)
     ✓ wait 500 ms (504ms)
     ✓ test runs (95ms)

   ...
   ```

Or, use `npm run all` to perform all steps at once.

   ```bash
   npm run all
   ```
