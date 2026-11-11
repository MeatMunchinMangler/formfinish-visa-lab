# FormFinish — independent consumer travel utility
Browser-only photo and passport-page crop, rotate, JPEG export, optional size constraints (including legacy limits), inclusive 90-day stay calculator, and personal checklist. No photo upload or tracking; no accounts, API calls or runtime dependencies.

## Run
- npm test
- python3 -m http.server 8765
- Open http://localhost:8765

## Release
Static files only. GitHub Pages from main root. No payment features or revenue are claimed. Independent of any government agency. Check current official evisa.gov.vn form rules before relying on file sizing. This is a small, low-cost shipping experiment, not the selected long-term moonshot.

## Safety & privacy
- Passport/portrait photos processed using browser Image and Canvas APIs only.
- No app-hosted collection of files or analytics.
- JPEG byte signature, MIME and size limit checked before offering download.
- Browser unsupported HEIC decoded only where the browser itself supports it.
- No guarantees of immigration acceptance.
