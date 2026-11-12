// Sigurnosna zaglavlja za sve odgovore; predložak aplikacije nije dostupan direktno.
// Greške u postavkama (npr. nepovezan KV) prikazuju se kao jasna poruka umjesto "Error 1101".
import { SetupError, layout, h } from '../lib/sarajka.js';

function errorPage(e) {
  const setup = e instanceof SetupError;
  const body = setup ? `
<main style="max-width:680px;margin:0 auto;padding:40px 16px;display:grid;gap:16px">
  <h1>Postavke nisu završene</h1>
  <div class="msg err">${h(e.message)}</div>
  <p>Za Cloudflare <b>Pages</b>: <i>Workers &amp; Pages</i> → projekat <b>prodajni-panel</b> → <i>Settings</i> → <i>Bindings</i> → <i>Add</i> → <i>KV namespace</i>.
     Variable name: <b>SARAJKA</b>, a KV namespace odaberite (ili ga prvo kreirajte u <i>Storage &amp; Databases → KV</i>).
     Zatim <i>Deployments</i> → <i>Retry deployment</i>.</p>
  <p>Za Cloudflare <b>Workers</b>: KV se veže u <code>wrangler.jsonc</code> (kv_namespaces, binding SARAJKA).</p>
</main>` : `
<main style="max-width:680px;margin:0 auto;padding:40px 16px;display:grid;gap:16px">
  <h1>Došlo je do greške</h1>
  <div class="msg err">Stranica se trenutno ne može prikazati. Pokušajte ponovo za nekoliko trenutaka.</div>
  <p class="hint">Detalji su zapisani u Cloudflare logovima projekta.</p>
</main>`;
  return new Response(layout(setup ? 'Postavke nisu završene' : 'Greška', body), {
    status: setup ? 503 : 500, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/app-shell')) return new Response('Not found', { status: 404 });
  let res;
  try { res = await context.next(); }
  catch (e) { console.error('Sarajka panel:', e && e.stack || e); res = errorPage(e); }
  const r = new Response(res.body, res);
  r.headers.set('X-Frame-Options', 'SAMEORIGIN');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('Referrer-Policy', 'same-origin');
  return r;
}
