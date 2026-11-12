// Glavna adresa:
//   /?p=naziv  ili  /?k=brosura-strana  → stranica za klijente (javno, bez šifre)
//   /                                   → prodajni panel za prijavljene; ostali idu na prijavu
import { currentUser, renderApp } from '../lib/sarajka.js';
export async function onRequestGet(context) {
  const q = new URL(context.request.url).searchParams;
  if (q.has('p') || q.has('k')) return renderApp(context, 'client');
  const user = await currentUser(context.request, context.env);
  if (user) return renderApp(context, 'panel', user);
  // bez prijave: stari linkovi s #k-… i #z-… i dalje rade, a sve ostalo vodi na prijavu
  return renderApp(context, 'client', null, { loginUrl: '/prijava' });
}
