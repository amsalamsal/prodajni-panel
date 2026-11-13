// Upiti klijenata za prodajni panel (samo prijavljeni korisnici)
import { currentUser, sameOrigin, json, listLeads, putLead, getUsers } from '../../lib/sarajka.js';

const STATUSES = ['novo', 'obrada', 'zavrseno'];

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!u) return json({ ok: false, error: 'Prijavite se ponovo.' }, 401);
  const leads = (await listLeads(env)).map(({ key, ...l }) => l);
  return json({ ok: true, leads });
}

export async function onRequestPost({ request, env }) {
  const u = await currentUser(request, env);
  if (!u) return json({ ok: false, error: 'Prijavite se ponovo.' }, 401);
  if (!sameOrigin(request)) return json({ ok: false, error: 'Zahtjev odbijen.' }, 403);
  let d; try { d = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  const all = await listLeads(env, 2000);
  const lead = all.find(l => l.id === d.id);
  if (!lead) return json({ ok: false, error: 'Upit nije pronađen.' }, 404);
  if (d.del) {
    if (u.role !== 'admin') return json({ ok: false, error: 'Brisanje može samo administrator.' }, 403);
    await env.SARAJKA.delete(lead.key);
    return json({ ok: true });
  }
  if (d.status && STATUSES.includes(d.status)) lead.status = d.status;
  if (typeof d.note === 'string') lead.note = d.note.slice(0, 1000);
  lead.by = u.name || u.username; lead.updated = Date.now();
  await putLead(env, lead);
  const { key, ...out } = lead;
  return json({ ok: true, lead: out });
}
