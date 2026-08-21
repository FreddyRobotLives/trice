import { getStore } from '@netlify/blobs';

/* ---- Link preview for view-only map links ----
   Messaging apps and mail clients fetch the URL and read its meta tags. They do
   not run JavaScript, so the app cannot set these itself — a /?mv= link would
   otherwise show whatever tags index.html carries, which are the Trice product
   tags. This serves the same app shell with map-specific tags swapped in, so a
   client sees the WTR crest and plain language about what the link is.

   Only /?mv=TOKEN is routed here (see netlify.toml). The token is used solely to
   look up the project name for the title; nothing else is exposed. */

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const store = () => {
  try { return getStore('trice-shared'); } catch (e) {
    const env = (k) => (globalThis.Netlify && Netlify.env && Netlify.env.get(k)) || (globalThis.process && process.env && process.env[k]) || '';
    const siteID = env('NETLIFY_SITE_ID') || env('SITE_ID');
    const token = env('NETLIFY_BLOBS_TOKEN') || env('NETLIFY_API_TOKEN');
    if (siteID && token) return getStore({ name: 'trice-shared', siteID, token });
    return null;
  }
};

async function projectFor(token) {
  if (!/^[A-Za-z0-9]{12,40}$/.test(token || '')) return '';
  try {
    const s = store();
    if (!s) return '';
    const links = (await s.get('meta/maplinks', { type: 'json' })) || {};
    const ml = links[token];
    if (!ml || ml.revoked) return '';
    return String(ml.project || '').slice(0, 80);
  } catch (e) { return ''; }
}

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('mv') || '';
  const origin = url.origin;

  // The app shell itself, unmodified, straight from the CDN.
  let html = '';
  try {
    const r = await fetch(origin + '/index.html', { headers: { 'x-mvcard': '1' } });
    if (!r.ok) throw new Error('shell ' + r.status);
    html = await r.text();
  } catch (e) {
    return new Response('Map temporarily unavailable. Please try again.', { status: 502, headers: { 'Content-Type': 'text/plain' } });
  }

  const project = await projectFor(token);
  const title = project ? 'Live tree map \u00b7 ' + project : 'Live tree map \u00b7 WTR Group';
  const desc = (project
    ? 'Every tree we assessed at ' + project + ', with photos, species and condition. '
    : 'Every tree we assessed, with photos, species and condition. ')
    + 'The map updates as our crews complete the work. View only, no login.';
  const img = origin + '/og-map.png?v=1';
  const here = origin + '/?mv=' + encodeURIComponent(token);

  const tags = [
    ['<title>', '</title>', '<title>' + esc(title) + '</title>'],
  ];
  // Swap the product tags for map tags. Anything not present is appended.
  const set = (attr, key, value) => {
    const re = new RegExp('<meta\\s+' + attr + '="' + key.replace(/:/g, ':') + '"[^>]*>', 'i');
    const tag = '<meta ' + attr + '="' + key + '" content="' + esc(value) + '">';
    html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>');
  };
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(title) + '</title>');
  set('property', 'og:title', title);
  set('property', 'og:description', desc);
  set('property', 'og:image', img);
  set('property', 'og:image:width', '2400');
  set('property', 'og:image:height', '1260');
  set('property', 'og:url', here);
  set('property', 'og:site_name', 'WTR Group');
  set('property', 'og:type', 'website');
  set('name', 'description', desc);
  set('name', 'twitter:card', 'summary_large_image');
  set('name', 'twitter:title', title);
  set('name', 'twitter:description', desc);
  set('name', 'twitter:image', img);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
