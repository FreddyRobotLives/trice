/* ---- Link preview for view-only map links ----
   Messaging apps and mail clients fetch the URL and read its meta tags. They do
   not run JavaScript, so the app cannot set these itself — a /?mv= link would
   otherwise preview with whatever tags index.html carries, which are the Trice
   product tags. This serves the same app shell with map tags swapped in, so the
   client sees the WTR crest and plain language about what the link is.

   NO IMPORTS. This site has no package.json, so every function here must be
   self-contained; an npm import fails the build and takes the whole deploy with
   it. The project name comes from sync's mvmeta lookup over plain fetch.

   Nothing in here may break a link. Every failure path still returns a working
   page — generic card, app intact. */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function projectFor(origin, token) {
  if (!/^[A-Za-z0-9]{12,40}$/.test(token || '')) return '';
  try {
    const r = await fetch(origin + '/.netlify/functions/sync?mvmeta=' + encodeURIComponent(token));
    if (!r || !r.ok) return '';
    const j = await r.json();
    return String((j && j.project) || '').slice(0, 80);
  } catch (e) { return ''; }
}

export default async (req) => {
  let origin = 'https://trice.live', token = '';
  try {
    const url = new URL(req.url);
    origin = url.origin;
    token = url.searchParams.get('mv') || '';
  } catch (e) {}

  const project = await projectFor(origin, token);
  const title = project ? 'Live tree map \u00b7 ' + project : 'Live tree map \u00b7 WTR Group';
  const desc = (project
    ? 'Every tree we assessed at ' + project + ', with photos, species and condition. '
    : 'Every tree we assessed, with photos, species and condition. ')
    + 'The map updates as our crews complete the work. View only, no login.';
  const img = origin + '/og-map.png?v=2';
  const here = origin + '/?mv=' + encodeURIComponent(token);

  const metas = [
    ['property', 'og:title', title],
    ['property', 'og:description', desc],
    ['property', 'og:image', img],
    ['property', 'og:image:secure_url', img],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '2400'],
    ['property', 'og:image:height', '1260'],
    ['property', 'og:image:alt', 'WTR Group live tree map'],
    ['property', 'og:url', here],
    ['property', 'og:site_name', 'WTR Group'],
    ['property', 'og:type', 'website'],
    ['name', 'description', desc],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', desc],
    ['name', 'twitter:image', img],
    ['name', 'twitter:image:alt', 'WTR Group live tree map'],
  ];
  const tagFor = (attr, key, value) => '<meta ' + attr + '="' + key + '" content="' + esc(value) + '">';

  // The app shell, unmodified, straight from the CDN.
  let html = '';
  try {
    const r = await fetch(origin + '/index.html', { headers: { 'x-mvcard': '1' } });
    if (r && r.ok) html = await r.text();
  } catch (e) {}

  if (html) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(title) + '</title>');
    // Drop the product's social tags outright, then insert the map's.
    html = html.replace(/[ \t]*<meta\s+(?:property|name)="(?:og:[a-z:_]+|twitter:[a-z:_]+|description)"[^>]*>\s*\n?/gi, '');
    html = html.replace('</head>', metas.map((m) => tagFor(m[0], m[1], m[2])).join('\n') + '\n</head>');
  } else {
    /* Shell unreachable: still hand back a correct preview and send the person
       to the app. A link must never come back broken. */
    html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(title) + '</title>'
      + metas.map((m) => tagFor(m[0], m[1], m[2])).join('')
      + '<meta http-equiv="refresh" content="0;url=/index.html?mv=' + encodeURIComponent(token) + '">'
      + '</head><body style="font:15px -apple-system,Helvetica,Arial,sans-serif;padding:40px;text-align:center">'
      + 'Opening your live tree map\u2026 <a href="/index.html?mv=' + encodeURIComponent(token) + '">tap here</a> if it does not open.'
      + '</body></html>';
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
