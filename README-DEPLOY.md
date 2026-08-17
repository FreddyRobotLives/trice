# Trice Tree Survey — v11.6

## Deploy — GitHub only. Never drag-and-drop.
1. Copy every file in this folder into the FreddyRobotLives/trice repo root (same layout: index.html, sw.js, netlify.toml, netlify/functions/).
2. Commit and push to the branch Netlify watches. Netlify builds trice.live automatically.
3. Do NOT use app.netlify.com/drop. Drop deploys silently discard netlify/functions and break sync. Do NOT create a new site. trice.live is the only deploy target.

## v11.6 — sync you can trust
- Fixed the bug behind mismatched counts (one phone shows 137, another 116). A scope error froze each device's sync watermark; pull responses then grew until they exceeded the server reply limit and devices quietly stopped receiving records. Watermarks now advance every cycle.
- Pull responses are paged. A long backlog arrives in slices, so no reply can ever exceed the limit again. First sync after this deploy may take a minute while devices catch up. That is the backlog clearing.
- Verify & repair. Report → Data → "Verify team data" checks every record id against the server and repairs both ways: missing here → pulled, missing on the server → re-sent. Nothing is ever deleted by verification. It also runs automatically whenever a phone's count disagrees with the server.
- The Data screen shows "This phone: X · Server: Y". When every device shows the same two numbers, the team is consistent. That is the check to run with AJ.
- Server now stamps its own time on legacy records, so captures hidden by a wrong phone clock become visible to everyone.
- Projects can now nest more than one level deep (site → course → hole). Reports, the map, and the Sheet roll up through every level.

## After deploying — the AJ recovery procedure
1. On AJ's phone: open trice.live, wait for the sync chip, then Report → Data → Verify team data. His 21 missing records upload.
2. On your device: Verify team data. Both screens should read the same "This phone / Server" number.
3. Repeat on each crew phone. Same number everywhere = done.

## Standing rules
- No Safari Private mode on crew phones. Private mode destroys all storage when the session ends.
- Add to Home Screen on every crew phone (protects on-device data from OS cleanup).
- ANTHROPIC_API_KEY lives only in Netlify env vars. Rotate it there if compromised.
- Daily server snapshots and reset archives are under Report → Data → Team backups. Download one weekly and keep it off-phone.
