// Prodajni panel – samo za prijavljene agente
import { currentUser, redirect, renderApp } from '../lib/sarajka.js';
export async function onRequestGet(context) {
  const user = await currentUser(context.request, context.env);
  if (!user) return redirect('/prijava');
  return renderApp(context, 'panel', user);
}
