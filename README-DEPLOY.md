# Trice Tree Survey — v16 · desktop admin

## New: Team tab (desktop, Admin mode)
On a desktop browser, turn on Admin in the header. A Team tab appears with:
- **Employees** — roster with role, ISA cert #, phone, email, hourly rate, active toggle. Edits sync to every device.
- **Assignments** — assign any employee to any project with a date and note.
- **Time & hours** — log hours per employee/project/day, weekly grid with per-day cells, weekly totals with overtime flagged past 40h, labor cost when rates are set, approval checkboxes, CSV export (week or all).
- **Sheet editing** — in Admin mode the Sheet tab becomes directly editable: project, hole/zone, qty, DBH, height, hazard, cause, IP/OP, all pricing, assessor, notes. Every change syncs to the team like a normal capture.
Mobile is untouched — crews see exactly the app they know.

# v12 sync core (unchanged underneath)

## Deploy — GitHub only. Never drag-and-drop.
Commit EVERY file to FreddyRobotLives/trice. Both index.html and netlify/functions/sync.mjs are required this round — they speak a new protocol together. Push; Netlify builds trice.live.

## What changed underneath — why sync is now exact
The old design kept the whole register in one big server file that every phone rewrote on every sync. Phones could collide, replies could exceed size limits, and bookkeeping could drift — every sync problem you have seen traces to that one design.

v12 replaces it:
- Every record revision and every photo is its own small, permanent server object. Nothing is ever overwritten or destroyed. Two phones can never collide, because nothing is shared-written.
- Sync is a set comparison, not a stream of updates. The phone lists the server's record ids (a few KB), pulls exactly what it lacks, and re-sends anything the server lacks. Every 25-second cycle is a full consistency check and repair. There is no bookkeeping left to drift.
- Photos travel exactly once each way, ever. Record data syncs in seconds even on one bar; photos fill in quietly in the background and are then kept on the phone.
- Every edit revision is retained on the server — a full audit trail per tree, which matters for insurance work.
- Fresh register = the server turns a page (an "epoch"). Everything before stays exactly where it is, forever, downloadable under Team backups. Wiping data is now structurally impossible.
- Even if the server storage were emptied entirely, the phones re-seed it automatically — records and photos both.

## Migration — automatic, nothing to do
The old server data file is read once, split into the new format in background slices over the first few minutes of use, and then left in place permanently as one more backup. Phones also re-contribute everything they hold. Verify will say "server is still upgrading older records" until it settles, then counts match everywhere.

Old phones that haven't picked up the new app yet: their pushes are still accepted (nothing waits, nothing is lost), and they auto-update to v12 on next open.

## The check that matters
Report → Data → Verify team data on any two phones. Same "This phone / Server" number on both = the whole team is consistent. That is now guaranteed to converge on every cycle, not just when Verify is tapped.

## Standing rules
- No Safari Private mode on crew phones.
- Add to Home Screen on every crew phone.
- ANTHROPIC_API_KEY lives only in Netlify env vars.


## v21 — 17 Aug 2026
- Prune added as a fourth cost column (Prune / Take-down / Debris / Stump) across grid, edit, detail, XLSX and report. Old records untouched; V5 CSV unchanged.
- SHEETS: full-screen grid. Search, hazard chips, column sort, arrow-key cell navigation. Summary & exports in a slide-over.
- AI pricing predictions: calibrated on the rate card, Amy's ten priced rows and the Lexington 2017 schedule. Amber until accepted; excluded from all totals and exports; accepted lines stamped "Priced via AI prediction".
- Report: cost-composition bars per hole, species and failure-mode panels, 4-line money table, computed register totals row, auto "Findings and open items", relabeled photo-journal pricing.
- Redesign: landing screen, Home dashboard (glance / pricing / sync-offline cards), bottom nav with center Capture button, navy primary buttons.
- PWA install metadata refreshed (theme color, apple-touch-icon). SW cache v22 — phones pick the build up on next online load.

Deploy: commit these files to FreddyRobotLives/trice, push, let Netlify build trice.live. NEVER drag-and-drop (it drops netlify/functions).

## v21.2 — 17 Aug 2026
- Landing page first: hero (mark, tagline, mountains) -> Get Started / Team Access -> company list -> WTR password -> profile picker. One password entry per device.
- Sheets: "⛶ Full screen" puts the grid alone on screen; Predict pricing and Accept all stay in the fullscreen bar. Leaving the tab closes it.
- Desktop rail: Capture removed (mobile center Capture button unchanged).

## Build watchdog (v21.8+)
Every device compares its running build against the server on boot, on every
return to the foreground, and every 10 minutes. When the server has a newer
build, the device pushes unsynced records, purges its caches, and reloads.
For this to trigger, the `<meta name="version">` in index.html must change on
every release (the delivered zips always bump it). Records, drafts, projects
and the team password live in IndexedDB/localStorage and are never touched.
