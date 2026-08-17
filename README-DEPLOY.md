# Trice Tree Survey — v11.7

## Deploy — GitHub only. Never drag-and-drop.
Commit EVERY file in this folder to FreddyRobotLives/trice, same layout. The two that matter most this round:
- index.html
- netlify/functions/sync.mjs  ← this one is easy to miss. If it doesn't reach GitHub, phones cannot pull past a large backlog and Verify shows "server function out of date."
Also: sw.js, netlify.toml, manifest.webmanifest, icons, og.png. Push, and Netlify builds trice.live.

## The stuck phone (37 vs 74) — what happened and the fix
That phone is very likely talking to the OLD server function. The old function sends the whole backlog in one reply; with photos, a 37-record deficit exceeds the reply limit, the reply fails, and the phone can't pull. The new function pages replies, so this cannot happen. After this deploy, open the phone and tap Verify team data. If it says "server function out of date," sync.mjs never reached GitHub — commit it and redeploy.

## v11.7 — projects and sub-projects, rebuilt
The old method asked the server for permission on every move and could silently refuse. Gone. Filing is now data, like a tree record:
- Tap Organize → Move on any project → tap where it belongs. Applies instantly on the phone, no signal needed.
- Changes ride along with normal sync. Newest change wins, every device converges within a cycle.
- Nesting goes multiple levels (site → course → hole). Map, Sheet, and reports roll up through every level.
- Nothing can disappear: even a conflicting move made on two phones at once resolves cleanly, and every project always stays listed.

## Verify team data (Report → Data)
- Shows "This phone: X · Server: Y" on every device. Same numbers everywhere = the team is consistent.
- Tap it to repair both ways: missing here → pulled, missing on the server → re-sent. Never deletes.
- Runs by itself whenever a phone's count disagrees with the server.

## Updates now reach phones by themselves
The service worker and manifest are served with no-cache, the app checks for a new build on every open, every return-to-foreground, and every 20 minutes, and reloads itself once the moment a new version installs (never mid-capture or mid-typing). One old-version generation remains in the field: phones must load v11.7 once the old way (open the site or force refresh) — every deploy after that applies automatically.

## Standing rules
- No Safari Private mode on crew phones.
- Add to Home Screen on every crew phone.
- ANTHROPIC_API_KEY lives only in Netlify env vars.
- Team backups: download one weekly, keep it off-phone.
