// Sigurnosna zaglavlja za sve odgovore; predložak aplikacije nije dostupan direktno.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/app-shell')) return new Response('Not found', { status: 404 });
  const res = await context.next();
  const r = new Response(res.body, res);
  r.headers.set('X-Frame-Options', 'SAMEORIGIN');
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('Referrer-Policy', 'same-origin');
  return r;
}
