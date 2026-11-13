// Zajednička logika za Sarajka prodajni panel na Cloudflare Pages Functions.
// Podaci (linkovi za klijente i korisnici) čuvaju se u KV prostoru vezanom kao "SARAJKA".

export const BROCHURES = {
  'sarajka':   'Sarajka – glavna brošura',
  'vanjsko':   'Vanjsko uređenje (situacija)',
  'lamela-a':  'Lamela A',
  'lamela-bc': 'Lamela B-C',
  'lamela-d':  'Lamela D',
  'lamela-e':  'Lamela E',
  'poslovni':  'Poslovni prostori',
  'podzemne':  'Parking i ostave',
};

const DEFAULT_PACKS = [
  { id: 'stanovi', title: 'Stanovi – Lamele A i B-C', active: true,
    ids: ['sarajka', 'lamela-a', 'lamela-bc', 'vanjsko', 'podzemne'],
    lead: 'Pronađite svoj novi dom u Sarajki. Pogledajte stanove u Lamelama A i B-C s tlocrtom svakog sprata, raspored objekata i ulaza, te parking mjesta i ostave u podzemnoj garaži.' },
  { id: 'garaze', title: 'Parking mjesta i ostave', active: true, ids: ['podzemne'],
    lead: 'Sigurno parking mjesto i ostava u podzemnoj garaži Sarajke, na etažama −1 do −4.' },
  { id: 'poslovni', title: 'Poslovni prostori', active: true, ids: ['poslovni'],
    lead: 'Poslovni prostori u prizemlju i na prvim etažama Sarajke, na prometnoj lokaciji u srcu Sarajeva.' },
];

const SESSION_HOURS = 12;
const PBKDF2_ITER = 100000;          // najviše što Cloudflare Workers dozvoljava
const COOKIE = 'sarajka_s';

/* ---------- KV ---------- */
export class SetupError extends Error {}
function kv(env) {
  if (!env.SARAJKA || typeof env.SARAJKA.get !== 'function')
    throw new SetupError('KV prostor "SARAJKA" nije povezan s projektom.');
  return env.SARAJKA;
}
export async function getPacks(env) {
  if (!env.SARAJKA) return DEFAULT_PACKS;   // stranice za klijente rade i prije povezivanja KV-a
  return (await kv(env).get('paketi', 'json')) || DEFAULT_PACKS;
}
export async function savePacks(env, p) { await kv(env).put('paketi', JSON.stringify(p)); }
export async function getUsers(env) { return (await kv(env).get('korisnici', 'json')) || {}; }
export async function saveUsers(env, u) { await kv(env).put('korisnici', JSON.stringify(u)); }

/* ---------- kriptografija ---------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
function randomB64(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a); }
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export async function hashPassword(pass, salt = randomB64(16), iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iter }, key, 256);
  return `pbkdf2$${iter}$${salt}$${b64u(bits)}`;
}
export async function verifyPassword(pass, stored) {
  const [alg, iter, salt] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  return safeEqual(await hashPassword(pass, salt, +iter), stored);
}
async function secretKey(env) {
  let s = env.SESSION_SECRET;
  if (!s) {
    s = await kv(env).get('secret');
    if (!s) { s = randomB64(32); await kv(env).put('secret', s); }
  }
  return crypto.subtle.importKey('raw', enc.encode(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(env, data) { return b64u(await crypto.subtle.sign('HMAC', await secretKey(env), enc.encode(data))); }

/* ---------- sesija (potpisani kolačić) ---------- */
function getCookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
export async function sessionCookie(env, username, ver) {
  const payload = b64u(enc.encode(JSON.stringify({ u: username, v: ver, e: Date.now() + SESSION_HOURS * 3600e3 })));
  return `${COOKIE}=${payload}.${await sign(env, payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export async function currentUser(request, env) {
  const c = getCookie(request, COOKIE); if (!c) return null;
  const [payload, sig] = c.split('.');
  if (!payload || !sig || !safeEqual(await sign(env, payload), sig)) return null;
  let d; try { d = JSON.parse(new TextDecoder().decode(unb64u(payload))); } catch { return null; }
  if (!d || d.e < Date.now()) return null;
  const u = (await getUsers(env))[d.u];
  if (!u || (u.ver || 0) !== d.v) return null;   // obrisan korisnik ili promijenjena šifra
  return { ...u, username: d.u };
}

/* ---------- zaštita ---------- */
export function sameOrigin(request) {
  const o = request.headers.get('Origin');
  const self = new URL(request.url).origin;
  if (o) return o === self;
  const r = request.headers.get('Referer');
  return !!r && new URL(r).origin === self;
}
const ipOf = request => request.headers.get('CF-Connecting-IP') || 'local';
export async function tooManyAttempts(request, env) {
  return (+(await kv(env).get('att:' + ipOf(request)) || 0)) >= 8;
}
export async function noteAttempt(request, env, ok) {
  const k = 'att:' + ipOf(request);
  if (ok) return kv(env).delete(k);
  const n = +(await kv(env).get(k) || 0) + 1;
  await kv(env).put(k, String(n), { expirationTtl: 900 });
}

/* ---------- pomoćno ---------- */
export const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function publicUrl(request, env) {
  const p = (env.PUBLIC_URL || '').trim();
  return p ? p.replace(/\/?$/, '/') : new URL(request.url).origin + '/';
}
export const packLink = (request, env, p) => publicUrl(request, env) + '?p=' + encodeURIComponent(p.id);
export const redirect = (to, headers = {}) => new Response(null, { status: 303, headers: { Location: to, ...headers } });
export const html = (body, status = 200, headers = {}) => new Response(body, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

/* Aplikacija (panel ili stranica za klijente) s ubačenim postavkama */
export async function renderApp(context, mode, user, extra = {}) {
  const { request, env } = context;
  const shell = await env.ASSETS.fetch(new URL('/app-shell.txt', request.url).toString());
  if (!shell.ok) throw new SetupError('Nije pronađena datoteka public/app-shell.txt (status ' + shell.status + '). Provjerite da je "Build output directory" postavljen na public.');
  let page = await shell.text();
  const packs = (await getPacks(env)).map(p => ({
    id: p.id, title: p.title, lead: p.lead, active: !!p.active, ids: p.ids.filter(i => BROCHURES[i]) }));
  const cfg = { mode, publicUrl: publicUrl(request, env), packs, links: { admin: '/admin', logout: '/odjava' },
    leads: true, leadUrl: '/upit', leadsApi: '/api/upiti' };
  if (user) cfg.user = { name: user.name || user.username, admin: user.role === 'admin' };
  Object.assign(cfg, extra);
  const js = 'window.SARAJKA = ' + JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026') + ';';
  page = page.replace('<script>/*__SARAJKA_CONFIG__*/</script>', '<script>' + js + '</script>');
  if (mode === 'panel') page = page.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
  return html(page, 200, mode === 'client' ? { 'Cache-Control': 'public, max-age=60' } : {});
}

/* Zajednički izgled stranica prijave i administracije */
export function layout(title, body, bodyClass = '') {
  return `<!doctype html>
<html lang="bs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${h(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/admin.css">
</head>
<body class="${h(bodyClass)}">
${body}
</body>
</html>`;
}

/* ---------- upiti klijenata ---------- */
// Ključ "upit:<obrnuto vrijeme>:<id>" – KV list() vraća najnovije prve.
export const leadKey = (t, id) => 'upit:' + String(9e15 - t).padStart(16, '0') + ':' + id;
export function newId() { return randomB64(9); }
export async function listLeads(env, max = 300) {
  const out = []; let cursor;
  do {
    const r = await kv(env).list({ prefix: 'upit:', cursor, limit: 1000 });
    out.push(...r.keys.map(k => k.name)); cursor = r.list_complete ? null : r.cursor;
  } while (cursor && out.length < max);
  const vals = await Promise.all(out.slice(0, max).map(k => kv(env).get(k, 'json').then(v => v && { ...v, key: k })));
  return vals.filter(Boolean);
}
export async function putLead(env, lead) {
  await kv(env).put(lead.key || leadKey(lead.t, lead.id), JSON.stringify({ ...lead, key: undefined }), { metadata: { status: lead.status } });
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
export async function rateLimit(request, env, name, max, ttl) {
  const k = name + ':' + (request.headers.get('CF-Connecting-IP') || 'local');
  const n = +(await kv(env).get(k) || 0);
  if (n >= max) return false;
  await kv(env).put(k, String(n + 1), { expirationTtl: ttl });
  return true;
}
