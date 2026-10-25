# Spotter

Personal training and nutrition coach. Static web app (GitHub Pages) with a Google Apps Script backend for sync and AI.

- `index.html`: the app (built from the Fitness HQ source; do not hand-edit)
- `config.js`: the Apps Script `/exec` URL
- `food/`: USDA FoodData Central search index (Branded April 2026, Foundation, FNDDS, SR Legacy) plus restaurant data
- `apps-script/Code.gs`: backend. Setup steps are at the top of the file.
- `sw.js`, `manifest.json`, `icons/`: home-screen app support

Install on iPhone: open the site in Safari, Share, Add to Home Screen.
- src/: app source. From src/: python3 build.py (artifact file) then python3 build_pages.py (writes ../index.html).
