# Trice Tree Survey — Netlify package (v10)

## Deploy (2 minutes)
1. Go to https://app.netlify.com/drop and drag this UNZIPPED folder onto the page (the folder containing index.html and netlify.toml). You get a live HTTPS URL immediately.
2. **Turn on AI — once, for the whole team.** In Netlify: Site configuration → Environment variables → Add a variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from console.anthropic.com (set a spend cap there)
   Then Deploys → Trigger deploy → Deploy site, so the function picks it up.
3. Optional: rename the site (Site settings → Change site name) or attach your own domain.

Nothing else to configure. netlify.toml grants camera/GPS/compass/mic permissions on the origin, blocks iframe embedding, and sets no-cache on index.html so phones always load the newest build.

## Where the API key lives now (important)
The app itself contains **no API key** — not in the code, not in Settings, not on any phone. Every analysis call goes to `/api/analyze`, a small function in this package that reads `ANTHROPIC_API_KEY` from the site's environment and relays the request to Anthropic (streamed, so long analyses don't time out). Any key that an older build saved on a phone is deleted automatically the first time this build loads. If the key is ever compromised you rotate it in one place: Netlify env vars.

If the key isn't set yet, the app says so plainly and keeps working — captures save with photo, GPS, and timestamp; every pending tree can be analyzed after the key is added.

## On each crew phone (tonight, outdoors)
1. Open the URL → Survey tab → "Run the 60-second check" → approve every permission prompt.
2. Start a walk: your name + the property. That's the whole setup.
3. Share → Add to Home Screen (installs it like an app and protects on-device data from OS cleanup).

## Updating later
Drag the folder onto your site's Deploys page — live in seconds; phones pick it up on next open. Always drag the WHOLE folder: a deploy replaces everything, so dropping index.html alone removes the functions (sync + AI relay).

## Troubleshooting the readiness check
- **AI analysis: "Off — add ANTHROPIC_API_KEY"** — the relay is deployed but the env var isn't set (or was added without a redeploy). Add it, then Deploys → Trigger deploy.
- **AI analysis: "Relay not deployed" / service error 404** — the deploy is missing `netlify/functions/analyze.mjs`. Re-drop the whole unzipped folder, not just index.html.
- **GPS fix red** — that's the phone, not the site: iPhone → tap ᴬᴬ in the address bar → Website Settings → Location → Allow, and Settings → Privacy → Location Services → Safari Websites → While Using + Precise ON. Then Retry.

## Team sync & data
Every phone that opens the site URL feeds one shared register (Netlify Blobs on your site): records push/pull automatically (~25 s cycle and after every log/edit), grouped in the Register by assessor name. If the host has no sync function (local file, plain static server) the app says "This device only" and the backup/merge flow still works. Report → Data has: device check, full backup (photos included), restore/merge, download last archived job, and "Archive & start a fresh register" — which archives to the server and every phone before wiping anything. Photos ride along with records, so keep the register to working-job scale and archive finished jobs.

- **v10.7 — Shared projects.** Projects sync to the whole team: create one on any phone and it appears in everyone's Projects list (and the map/report toggles) within ~25 seconds. Starting a fresh register clears the shared list; active phones re-seed the projects they still have locally.
- **v10.9 — Client round (WTR).** Everything under the AI assessment is editable: quick "Adjust the AI read" right on the capture screen (species, DBH, height, recommendation) and an Edit button on every record's AI card — overrides are signed, the original AI stays on the record. Import photos from the camera roll (location + time read from each photo's EXIF; no-GPS photos get "Place pin on satellite"). Report tab gains a Hole/zone filter — run one hole as its own report or all holes rolled into one with per-hole subtotals and a by-hole rollup table. New "Sub work scope" deliverable: photos, damage and recommendations with blank price lines — no client pricing. Inspection-type dropdown (Routine / Storm Response / Post-Loss…) lives in the report header; XLSX spreadsheet export unchanged.
- **v11.0 — WTR round two.** New **Sheet tab**: the live spreadsheet — every capture writes a row the moment it logs, per-project toggle, hazard/zone/DBH charts that update live, XLSX + CSV export and one-tap "Copy for Google Sheets." **Target picker**: when the AI finds several trees in a frame it asks which is the target — tap thumbnails to include/exclude, or take all; excluded trees simply don't log (nothing deleted). **The app learns from its users**: signed overrides (species, DBH, height, hazard) feed the next analyses as calibration. **Big dictate button** under every note field. **Review & submit the package** on Report: the full report opens on screen, every line editable, then print/PDF + XLSX. Projects card gains a **↻ Sync** button so a project created on one phone shows on every device on demand.
- **v11.1 — Crosshair targeting + scale accuracy.** The live camera shows a center crosshair: aim it at the target trunk. When a frame contains several trees, the one under the crosshair is auto-selected (the picker still lets you change it). Scale got a full protocol: the AI must anchor DBH/height to a visible reference (flagstick, cart, person, path width…), work camera-distance geometry, resist its underestimating bias, and report what it scaled from — shown on every assessment as "Scaled from: …". Your corrections keep feeding back as calibration.
- **v11.2 — Profiles, admin, and a design refresh.** **User profiles live on the server**: the sign-in screen lists every teammate — tap "That's me" on any phone or desktop and you resume exactly where that profile left off (last project auto-rejoined, all your records attributed). "Switch user" lives on Report. **Admin mode (desktop only)**: an Admin pill in the header unlocks assessor filters on Register and Report, plus bulk move-to-project and double-confirmed bulk delete on the filtered register — reports and exports can be scoped per assessor. **Design refresh**: the whole app moved to a warm paper-and-ink palette (washi ground, sumi ink, vermillion only for action) with quieter hairlines and tightened labels — European/Japanese minimal throughout.
- **v11.3 — Dynamic reports.** Build the report before you send it: section toggles (charts, the read, money summary, by-hole rollup, register, photo journal, certification) on the Submit block — off means out of the print. And the review screen is now interactive: filter the whole report by hole, hazard, or assessor from the top bar; filters carry into the print/PDF. Share image (og.png) included — links to trice.live unfurl with the brand card.
## What changed in v10
- **v10.2 — Projects.** Walks now start from a project: create or select one on the Survey page before the camera unlocks; every capture files under it. The map and the Report tab both toggle between one project and all projects, and exports/reports carry the scope. Storm layer removed. Print report redesigned — hazard mix, DBH distribution and cost-by-zone charts on a cleaner sheet. Disabled rows stay readable; the readiness check now names a rejected key (401) vs a missing relay (404) vs a missing env var (503).
- **Anthropic key removed from the app entirely** — server-side relay at /api/analyze; the Settings key field is gone; previously stored keys are purged from phones on first load.
- **Color coding removed** — the register groups by assessor name; map pins color by hazard only (red/amber/green).
- **Fixed: Export XLSX crashed** (undefined helper + stale field names). The workbook now also carries pricing columns (removal / disposal / stump / line total) and arborist notes.
- Streamed AI responses end-to-end — long multi-tree analyses no longer risk gateway timeouts.
- Dead code removed (orphaned setup form, unused device-tag plumbing); clearer offline / AI-off states.
