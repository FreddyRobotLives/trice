// Trice full-function sweep. Lives in the repo so it survives workspace resets.
// Run: node gates/sweep.js   (from the trice folder)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ck = (name, ok, note) => { if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (note ? ' \u2014 ' + note : '')); } };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].filter(m => !m[0].includes('src=')).map(m => m[1]);
const js = scripts.join('\n');

// 1 · every script block parses
let parseOk = true;
scripts.forEach((s, i) => { try { new Function(s); } catch (e) { parseOk = false; console.log('  script', i, e.message); } });
ck('all inline script blocks parse', parseOk);
try { new Function(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')); ck('service worker parses', true); } catch (e) { ck('service worker parses', false, e.message); }

// 2 · every inline handler calls a defined function
const defined = new Set([...html.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1])
  .concat([...html.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]))
  .concat([...html.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1])));
const handlerCalls = new Set();
for (const m of html.matchAll(/\son(?:click|change|input|submit|load|error)\s*=\s*"([A-Za-z_$][\w$]*)\s*\(/g)) handlerCalls.add(m[1]);
for (const m of html.matchAll(/\son(?:click|change|input|submit|load|error)\s*=\s*'([A-Za-z_$][\w$]*)\s*\(/g)) handlerCalls.add(m[1]);
const KW = ['if','for','while','switch','return','JSON','S','window','event','alert','confirm','this','function'];
 const missing = [...handlerCalls].filter(n => !defined.has(n) && !KW.includes(n));
ck('every inline handler is a defined function (' + handlerCalls.size + ' handlers)', missing.length === 0, missing.slice(0, 8).join(', '));

// 3 · camera path: the four hardening measures are present
ck('camera: render() reattaches the live stream after every paint', html.includes('if (S.camOpen && camStream)') && html.includes('cv.srcObject = camStream'));
ck('camera: shutter self-heals a stream-less video element', js.includes("toast('Camera restarting"));
ck('camera: gesture-dead fallback explains the second tap', js.includes('opening the phone camera'));
ck('camera: dead tracks on resume close cleanly', js.includes("readyState === 'ended'"));
ck('camera: viewfinder element exists in camView', html.includes('camVideo') && html.includes('function camView'));
ck('camera: fallback input is a capture-enabled file picker', js.includes("inp.setAttribute('capture', 'environment')"));

// 4 · photo pipeline continuity: capture -> draft -> record -> upload
for (const fn of ['openCamera', 'closeCamera', 'shutter', 'fallbackFile', 'framePicked', 'pumpPhotos']) {
  ck('photo pipeline: ' + fn + ' defined', new RegExp('function ' + fn + '\\b').test(html));
}
ck('photo pipeline: photos ride sync with confirmed saves', js.includes('savedPhotos'));

// 5 · self-heal + register integrity (v32.2 repair machinery intact)
for (const fn of ['restoreEsio10', 'esioGap', 'applyRegisterRev', 'runCountAudit', 'runDeepScan']) {
  ck('register machinery: ' + fn + ' defined', new RegExp('function ' + fn + '\\b').test(html));
}
ck('register machinery: repair wired into boot and sync', /applyRegisterRev\(\);\s*\n\s*restoreEsio10\(\);/.test(html) && /restoreEsio10\(\);\s*\n\s*pumpPhotos\(\);/.test(html));

// 6 · public surfaces: sub link + map link resilience intact
ck('links: only a true 404 is terminal on the sub page', html.includes('if (r.status === 404) { WOS.err'));
ck('links: viewer keeps the map through hiccups', html.includes('MVS.retryT = setTimeout(mvFetch'));
ck('links: truncated tokens get their own message', (html.match(/looks incomplete/g) || []).length === 2);

// 7 · service worker discipline
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ck('sw: standalone pages bypass the shell', sw.includes("url.pathname !== '/' && url.pathname !== '/index.html' && req.mode === 'navigate'"));
ck('sw: versioned shell cache present', /trice-shell-v\d+/.test(sw));

// 8 · deploy hygiene
ck('version beacon matches the app', fs.readFileSync(path.join(ROOT, 'version.txt'), 'utf8').trim() === html.match(/trice-v[\d.]+/)[0]);
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
ck('netlify: api route + mv card + spa catch-all present', toml.includes('/api/sync') && toml.includes('mvcard') && toml.includes('/index.html'));
for (const f of ['netlify/functions/sync.mjs', 'netlify/functions/mvcard.mjs', 'netlify/functions/analyze.mjs']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ck('functions: ' + f + ' has zero npm imports', !/^\s*import\s+.*from\s+["'][^./]/m.test(src));
}
ck('vendor: leaflet + sheetjs + exceljs + font committed', ['leaflet.min.js','leaflet.min.css','xlsx.full.min.js','exceljs.min.js','InterVariable.woff2'].every(f => fs.existsSync(path.join(ROOT, 'vendor', f))));
ck('manifest + icons present', ['manifest.webmanifest', 'icon-192.png', 'icon-512.png'].every(f => fs.existsSync(path.join(ROOT, f))));


// 9 · real-browser boot check (runs when jsdom is installed anywhere on this machine)
try {
  const { JSDOM, VirtualConsole } = require(require('path').resolve(process.env.JSDOM_PATH || '/tmp/jd/node_modules/jsdom'));
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', (e) => errs.push(e.message));
  const dom = new JSDOM(html, { url: 'https://app.trice.live/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.localStorage.setItem('trice_gate', '1630778633'); w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} }); w.scrollTo = () => {}; } });
  setTimeout(() => {
    const app = dom.window.document.getElementById('app');
    const rendered = app && app.innerHTML.length > 1000 && errs.length === 0;
    if (rendered) pass++; else fail++;
    console.log((rendered ? 'PASS' : 'FAIL') + ' boot: the module renders signed in with zero errors' + (errs.length ? ' \u2014 ' + errs[0] : ''));
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  }, 2000);
} catch (e) {
  console.log('SKIP boot check (jsdom not available here)');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
