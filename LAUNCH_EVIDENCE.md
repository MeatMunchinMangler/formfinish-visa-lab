# Launch evidence — 2026-11-11

## States verified separately
- Local implementation exists in this repo. Git SHA 76e7f71 was first release.
- GitHub Pages build: status `built`, public URL https://meatmunchinmangler.github.io/formfinish-visa-lab/.
- Public HTTPS checked: 200, correct HTML title, JS/CSS/core.js assets each 200.
- Tests: 8/8 Node built-in unit tests passed.
- Full Chromium browser test, local: successfully imported a synthetic PNG and exported a real 600x900 JPEG under 49 KB.
- Full Chromium browser test, hosted HTTPS: synthetic portrait PNG -> downloaded real JPEG (600x900, 7,514 bytes), and synthetic rotated passport page -> downloaded real JPEG (1200x845, 11,009 bytes). Both files had MIME image/jpeg and FF D8 FF signatures. Stay calendar output for 90 days starting Dec 1, 2026: Feb 28, 2027.
- No verified customers, checkout, purchase, payment, revenue, or production analytics. The app is free.
- Photos are not uploaded to a backend: browser Canvas and Blob, no third-party analytics or calls intentionally added.

## Research and choice integrity
Several existing sites (OpenFaces, MakeIDPic, VisaPicResizer, Ohata) already offer free private visa-photo preparation. Treat this as a small shipped technical experiment **not** a validated high-upside business and **not** the default winner of future opportunity research. No artificial revenue targets or calendar ceilings.

## Execution continuity
The first Lovable implementation had components but a blank index route; subsequent Lovable messages were blocked by workspace credits. A separate dependency-free codebase was built on the user's authorized Mac, tested in Chromium, and deployed to GitHub Pages without new paid services. Do not assume Lovable preview is this release.

## Quality gates
Before claiming a future release is paid or successful: demonstrate a valid customer-facing paid offering, verified checkout/access flow, real settlement, reproducible monitoring, and customer value. Do not claim immigration approval from image file checks. Current evisa.gov.vn is the official destination; published specifications may vary and old government help pages cite smaller upload limits.
