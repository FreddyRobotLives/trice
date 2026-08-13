# Trice — complete fixed package

Everything in this folder is ready. The sync fix is already inside
(netlify/functions/sync.mjs — replaced, done, don't touch it).

## Upload (GitHub → auto-deploys to trice.live)
1. github.com → your `trice` repository → Add file → Upload files
   (First time? Create the repo first: + → New repository → name: trice → Create)
2. Drag EVERYTHING in this folder into the upload box — including the `netlify` folder itself
3. Check the file list shows: netlify/functions/sync.mjs and netlify/functions/analyze.mjs
4. Commit changes
5. Netlify deploys it automatically (if the repo is linked: Netlify → Site configuration →
   Build & deploy → Link repository → GitHub → trice → leave build settings empty → Save)
6. Test: open trice.live/api/sync
   - {"ok":true,...}  → done. Phones: reload once, tap Sync.
   - {"error":...}    → the message names the missing env var. Add it:
     Netlify → Site configuration → Environment variables:
       NETLIFY_SITE_ID    = Site configuration → General → Site ID
       NETLIFY_BLOBS_TOKEN = app.netlify.com/user/applications → New access token
     Then Deploys → Trigger deploy. Test again.

## Why not drag-and-drop onto Netlify?
Drag-and-drop deploys throw away the functions folder — that is the whole reason
sync never worked. GitHub deploys keep it. Always upload here from now on.
