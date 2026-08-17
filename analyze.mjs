// Server-side Anthropic relay. The API key lives ONLY here, read from the
// site's environment (Netlify → Site configuration → Environment variables →
// ANTHROPIC_API_KEY). Phones never see, store, or send a key.
const MODEL = 'claude-sonnet-4-6';
export default async (req) => {
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  const key = (globalThis.Netlify && Netlify.env && Netlify.env.get('ANTHROPIC_API_KEY')) || (globalThis.process && process.env.ANTHROPIC_API_KEY) || '';
  if (req.method === 'GET') return json({ configured: !!key });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!key) return json({ error: 'not_configured' }, 503);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad_json' }, 400); }
  const headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (b.ping === true) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify({ model: MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }) });
      return json({ ok: r.ok }, r.ok ? 200 : r.status);
    } catch (e) { return json({ error: 'upstream_unreachable' }, 502); }
  }
  if (!Array.isArray(b.messages) || !b.messages.length) return json({ error: 'bad_request' }, 400);
  const payload = { model: MODEL, stream: true, max_tokens: Math.max(1, Math.min(4000, parseInt(b.max_tokens, 10) || 2200)), messages: b.messages };
  if (b.system) payload.system = String(b.system);
  let r;
  try { r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(payload) }); }
  catch (e) { return json({ error: 'upstream_unreachable' }, 502); }
  if (!r.ok) return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  // Stream the SSE straight through — long analyses never hit the buffered-function time limit.
  return new Response(r.body, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
};
// No custom path: served at /.netlify/functions/analyze; netlify.toml maps /api/analyze onto it.
