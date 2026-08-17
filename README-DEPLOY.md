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
