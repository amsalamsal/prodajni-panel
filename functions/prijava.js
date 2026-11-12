// Prijava agenata. Kad još nema nijednog korisnika, ovdje se kreira prvi administrator.
import { getUsers, saveUsers, hashPassword, verifyPassword, currentUser, sessionCookie, sameOrigin,
         tooManyAttempts, noteAttempt, layout, html, redirect, h } from '../lib/sarajka.js';

function page(setup, err, vals = {}, info = '') {
  return layout(setup ? 'Prvo pokretanje – Sarajka' : 'Prijava – Sarajka prodajni panel', `
<div class="box">
  <header><img src="/img/logo-light.svg" alt="Sarajka – stambeno-poslovni centar" width="140" height="84"><span>Prodajni panel</span></header>
  <form method="post" autocomplete="on">
    ${setup ? '<h1>Prvo pokretanje</h1><p>Kreirajte administratorski račun. Administrator može dodavati agente i uređivati linkove za klijente.</p>'
            : '<h1>Prijava</h1>'}
    ${info ? `<div class="msg">${h(info)}</div>` : ''}
    ${err ? `<div class="msg err">${h(err)}</div>` : ''}
    <label>Korisničko ime<input type="text" name="user" id="user" required autocomplete="username" autocapitalize="none" value="${h(vals.user)}"></label>
    ${setup ? `<label>Ime i prezime<input type="text" name="name" id="name" autocomplete="name" value="${h(vals.name)}"></label>` : ''}
    <label>Šifra<input type="password" name="pass" id="pass" required autocomplete="${setup ? 'new-password' : 'current-password'}"></label>
    ${setup ? '<label>Ponovite šifru<input type="password" name="pass2" id="pass2" required autocomplete="new-password"><span class="hint">Najmanje 10 znakova.</span></label>' : ''}
    <button class="btn pri" type="submit">${setup ? 'Kreiraj račun' : 'Prijavi se'}</button>
  </form>
</div>`, 'login');
}

export async function onRequestGet({ request, env }) {
  if (await currentUser(request, env)) return redirect('/');
  const setup = !Object.keys(await getUsers(env)).length;
  const info = new URL(request.url).searchParams.has('odjava') ? 'Odjavljeni ste.' : '';
  return html(page(setup, '', {}, info));
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return html('Zahtjev odbijen.', 403);
  const f = await request.formData();
  const user = String(f.get('user') || '').trim().toLowerCase();
  const pass = String(f.get('pass') || '');
  const users = await getUsers(env);
  const setup = !Object.keys(users).length;

  if (setup) {
    const name = String(f.get('name') || '').trim();
    let err = '';
    if (!/^[a-z0-9._-]{3,32}$/.test(user)) err = 'Korisničko ime: 3–32 znaka, samo mala slova, brojevi, tačka, crtica.';
    else if (pass.length < 10) err = 'Šifra mora imati najmanje 10 znakova.';
    else if (pass !== String(f.get('pass2') || '')) err = 'Šifre se ne poklapaju.';
    if (err) return html(page(true, err, { user, name }), 400);
    users[user] = { name: name || user, role: 'admin', hash: await hashPassword(pass), ver: 1 };
    await saveUsers(env, users);
    return redirect('/admin?ok=' + encodeURIComponent('Administratorski račun je kreiran.'), { 'Set-Cookie': await sessionCookie(env, user, 1) });
  }

  if (await tooManyAttempts(request, env))
    return html(page(false, 'Previše neuspjelih pokušaja. Pokušajte ponovo za 15 minuta.', { user }), 429);
  const u = users[user];
  if (u && await verifyPassword(pass, u.hash)) {
    await noteAttempt(request, env, true);
    return redirect('/', { 'Set-Cookie': await sessionCookie(env, user, u.ver || 0) });
  }
  await noteAttempt(request, env, false);
  return html(page(false, 'Pogrešno korisničko ime ili šifra.', { user }), 401);
}
