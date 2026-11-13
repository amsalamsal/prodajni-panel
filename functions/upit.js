// Upit s klijentske stranice ("Zainteresovan sam"): sprema se u KV i, ako je podešeno, šalje e-mailom.
import { sameOrigin, json, rateLimit, newId, putLead, getPacks, h } from '../lib/sarajka.js';

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env, waitUntil, ctx }) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'Zahtjev odbijen.' }, 403);
  let d; try { d = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (d.web) return json({ ok: true });                       // zamka za spam robote
  const name = clean(d.name, 80), phone = clean(d.phone, 30), email = clean(d.email, 120);
  const interest = clean(d.interest, 200), message = String(d.message ?? '').trim().slice(0, 1000);
  if (name.length < 2) return json({ ok: false, error: 'Upišite ime i prezime.' }, 400);
  if ((phone.match(/\d/g) || []).length < 6) return json({ ok: false, error: 'Upišite ispravan broj telefona.' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'E-mail adresa nije ispravna.' }, 400);
  if (d.consent !== true) return json({ ok: false, error: 'Potrebna je saglasnost za kontakt.' }, 400);
  if (!await rateLimit(request, env, 'urate', 5, 3600))
    return json({ ok: false, error: 'Poslali ste više upita zaredom. Pozovite nas na 033 762 222.' }, 429);

  const c = d.ctx || {};
  const packs = await getPacks(env);
  const pack = packs.find(p => p.id === c.pack);
  const source = [pack ? 'Link: ' + pack.title : '', clean(c.page, 160)]
    .filter(Boolean).join(' · ');
  const lead = { id: newId(), t: Date.now(), name, phone, email, interest, message, source, status: 'novo', note: '' };
  await putLead(env, lead);

  const mail = sendMail(env, lead);
  if (mail) (waitUntil || (p => ctx && ctx.waitUntil(p)))(mail);
  return json({ ok: true });
}

// Obavijest e-mailom preko Resend (resend.com). Uključuje se varijablama RESEND_API_KEY i UPIT_EMAIL.
function sendMail(env, l) {
  if (!env.RESEND_API_KEY || !env.UPIT_EMAIL) return null;
  const rows = [['Ime', l.name], ['Telefon', l.phone], ['E-mail', l.email], ['Zanima ga', l.interest], ['Poruka', l.message], ['Izvor', l.source]]
    .filter(r => r[1]).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B6259">${k}</td><td style="padding:4px 0"><b>${h(v)}</b></td></tr>`).join('');
  const panel = (env.PUBLIC_URL || '').replace(/\/?$/, '/') + '#upiti';
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.UPIT_FROM || 'Sarajka panel <onboarding@resend.dev>',
      to: env.UPIT_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
      reply_to: l.email || undefined,
      subject: `Novi upit: ${l.name} – ${l.interest || 'Sarajka'}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#16231E"><h2 style="color:#134A3A;font-weight:normal">Novi upit s klijentske stranice</h2>
        <table>${rows}</table><p style="margin-top:18px"><a href="${h(panel)}" style="color:#134A3A">Otvori upite u prodajnom panelu</a></p></div>`,
    }),
  }).then(r => { if (!r.ok) return r.text().then(t => console.error('Resend:', r.status, t)); })
    .catch(e => console.error('Resend:', e));
}
