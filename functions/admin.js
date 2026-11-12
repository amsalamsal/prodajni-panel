// Administracija: linkovi za klijente (paketi brošura) i korisnici panela
import { BROCHURES, getPacks, savePacks, getUsers, saveUsers, hashPassword, currentUser, sessionCookie,
         sameOrigin, publicUrl, packLink, layout, html, redirect, h } from '../lib/sarajka.js';

async function requireAdmin(request, env) {
  const u = await currentUser(request, env);
  if (!u) return { res: redirect('/prijava') };
  if (u.role !== 'admin') return { res: html(layout('Zabranjeno', '<main><div class="msg err">Pristup dozvoljen samo administratoru. <a href="/panel">Nazad na panel</a></div></main>'), 403) };
  return { me: u };
}
const back = (type, msg, anchor = '', headers = {}) =>
  redirect('/admin?' + type + '=' + encodeURIComponent(msg) + (anchor ? '#' + anchor : ''), headers);

export async function onRequestPost({ request, env }) {
  const { me, res } = await requireAdmin(request, env); if (res) return res;
  if (!sameOrigin(request)) return html('Zahtjev odbijen.', 403);
  const f = await request.formData();
  const a = f.get('a');
  const str = k => String(f.get(k) || '').trim();

  if (a === 'pack_save' || a === 'pack_new') {
    const packs = await getPacks(env);
    if (a === 'pack_save') {
      const id = str('id'), p = packs.find(x => x.id === id);
      if (!p) return back('err', 'Link nije pronađen.');
      const title = str('title');
      if (!title) return back('err', 'Naslov ne može biti prazan.', 'p-' + id);
      const sel = Object.keys(BROCHURES).filter(b => f.get(`b[${b}]`))
        .map((b, i) => [b, parseInt(f.get(`o[${b}]`), 10) || 99 + i]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
      Object.assign(p, { title: title.slice(0, 80), lead: str('lead').slice(0, 400), ids: sel, active: !!f.get('active') });
      await savePacks(env, packs);
      return back('ok', `Link „${title}“ je sačuvan. Adresa i QR kod su ostali isti.`, 'p-' + id);
    }
    const title = str('title'), id = str('slug').toLowerCase();
    if (!title) return back('err', 'Upišite naslov novog linka.', 'novi');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 40) return back('err', 'Adresa linka: samo mala slova bez kvačica, brojevi i crtice (npr. stanovi-lamela-d).', 'novi');
    if (packs.some(x => x.id === id)) return back('err', `Link s adresom „${id}“ već postoji. Izaberite drugu.`, 'novi');
    packs.push({ id, title: title.slice(0, 80), lead: '', ids: [], active: true, created: new Date().toISOString() });
    await savePacks(env, packs);
    return back('ok', `Novi link „${title}“ je kreiran. Odaberite brošure koje će klijent vidjeti.`, 'p-' + id);
  }

  const users = await getUsers(env);
  if (a === 'user_add') {
    const u = str('user').toLowerCase(), pass = String(f.get('pass') || '');
    if (!/^[a-z0-9._-]{3,32}$/.test(u)) return back('err', 'Korisničko ime: 3–32 znaka, samo mala slova, brojevi, tačka, crtica.', 'korisnici');
    if (users[u]) return back('err', `Korisnik „${u}“ već postoji.`, 'korisnici');
    if (pass.length < 10) return back('err', 'Šifra mora imati najmanje 10 znakova.', 'korisnici');
    users[u] = { name: str('name') || u, role: f.get('role') === 'admin' ? 'admin' : 'agent', hash: await hashPassword(pass), ver: 1 };
    await saveUsers(env, users);
    return back('ok', `Korisnik „${u}“ je dodan.`, 'korisnici');
  }
  if (a === 'user_pass') {
    const u = str('user'), pass = String(f.get('pass') || '');
    if (!users[u]) return back('err', 'Korisnik nije pronađen.', 'korisnici');
    if (pass.length < 10) return back('err', 'Nova šifra mora imati najmanje 10 znakova.', 'korisnici');
    users[u].hash = await hashPassword(pass);
    users[u].ver = (users[u].ver || 0) + 1;            // odjavljuje korisnika na svim uređajima
    await saveUsers(env, users);
    const extra = u === me.username ? { 'Set-Cookie': await sessionCookie(env, u, users[u].ver) } : {};
    return back('ok', `Šifra za „${u}“ je promijenjena.`, 'korisnici', extra);
  }
  if (a === 'user_del') {
    const u = str('user');
    if (u === me.username) return back('err', 'Ne možete obrisati sami sebe.', 'korisnici');
    delete users[u];
    await saveUsers(env, users);
    return back('ok', `Korisnik „${u}“ je obrisan.`, 'korisnici');
  }
  return back('err', 'Nepoznata radnja.');
}

export async function onRequestGet({ request, env }) {
  const { me, res } = await requireAdmin(request, env); if (res) return res;
  const q = new URL(request.url).searchParams;
  const packs = await getPacks(env), users = await getUsers(env);
  const base = publicUrl(request, env);

  const packHtml = packs.map(p => {
    const link = packLink(request, env, p), id = h(p.id);
    const bro = Object.entries(BROCHURES).map(([bid, name]) => {
      const pos = p.ids.indexOf(bid), on = pos >= 0;
      return `<label><input type="checkbox" name="b[${h(bid)}]" value="1"${on ? ' checked' : ''}><span>${h(name)}</span>
        <input type="number" name="o[${h(bid)}]" value="${on ? pos + 1 : ''}" min="1" max="99" aria-label="Redoslijed za ${h(name)}"></label>`;
    }).join('');
    return `
  <form class="card${p.active ? '' : ' off'}" id="p-${id}" method="post">
    <input type="hidden" name="a" value="pack_save"><input type="hidden" name="id" value="${id}">
    <div class="head"><h3>${h(p.title)}</h3><span class="tag${p.active ? '' : ' off'}">${p.active ? 'Aktivan' : 'Isključen'}</span></div>
    <div class="pack">
      <div class="f">
        <label>Trajna adresa (ne mijenja se)
          <span class="linkrow"><input type="text" value="${h(link)}" readonly id="l-${id}"><button class="btn" type="button" data-copy="l-${id}">Kopiraj</button><a class="btn" href="${h(link)}" target="_blank" rel="noopener">Otvori</a></span>
        </label>
        <label>Naslov koji klijent vidi<input type="text" name="title" value="${h(p.title)}" maxlength="80" required></label>
        <label>Tekst za klijente<textarea name="lead" maxlength="400">${h(p.lead)}</textarea></label>
        <div>
          <label style="margin-bottom:8px">Brošure na ovom linku <span class="hint">Označite brošure; broj desno određuje redoslijed.</span></label>
          <div class="bro">${bro}</div>
        </div>
        <div class="row">
          <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" name="active" value="1"${p.active ? ' checked' : ''} style="width:16px;height:16px;accent-color:var(--green)"> Link je aktivan</label>
          <span class="hint">Isključen link prikazuje klijentu poruku da ponuda trenutno nije dostupna i kontakt.</span>
          <button class="btn pri" type="submit" style="margin-left:auto">Sačuvaj izmjene</button>
        </div>
      </div>
      <div class="qr">
        <div class="code" data-qr="${h(link)}"></div>
        <button class="btn" type="button" data-dl="${id}">Preuzmi QR (PNG)</button>
        <span class="hint">Za štampu: 1200 × 1200 px</span>
      </div>
    </div>
  </form>`;
  }).join('');

  const userRows = Object.entries(users).map(([un, u]) => `
    <tr>
      <td><b>${h(un)}</b>${un === me.username ? ' <span class="hint">(vi)</span>' : ''}</td>
      <td>${h(u.name)}</td>
      <td><span class="tag">${u.role === 'admin' ? 'Administrator' : 'Agent'}</span></td>
      <td><form method="post"><input type="hidden" name="a" value="user_pass"><input type="hidden" name="user" value="${h(un)}">
        <input type="password" name="pass" minlength="10" placeholder="najmanje 10 znakova" required autocomplete="new-password" aria-label="Nova šifra za ${h(un)}"><button class="btn" type="submit">Promijeni</button></form></td>
      <td>${un !== me.username ? `<form method="post" data-confirm="Potvrdi brisanje"><input type="hidden" name="a" value="user_del"><input type="hidden" name="user" value="${h(un)}"><button class="btn danger" type="submit">Obriši</button></form>` : ''}</td>
    </tr>`).join('');

  return html(layout('Administracija – Sarajka prodajni panel', `
<div class="bar">
  <img src="/img/logo-light.svg" alt="Sarajka" width="84" height="50"><b>Administracija</b>
  <nav><a href="/panel">← Prodajni panel</a><a href="#korisnici">Korisnici</a><a href="/odjava">Odjava</a></nav>
</div>
<main>
  <div>
    <h1>Linkovi za klijente</h1>
    <p class="intro">Svaki link ima trajnu adresu i QR kod. Ovdje mijenjate šta klijent vidi na linku (naslov, tekst i brošure), a adresa i QR kod ostaju isti, pa već odštampani QR kodovi i poslani linkovi uvijek rade. Link se ne može obrisati, samo privremeno isključiti. Izmjene su kod klijenata vidljive u roku od oko minute.</p>
  </div>
  ${q.get('ok') ? `<div class="msg">${h(q.get('ok'))}</div>` : ''}
  ${q.get('err') ? `<div class="msg err">${h(q.get('err'))}</div>` : ''}
  ${packHtml}
  <form class="card" id="novi" method="post">
    <input type="hidden" name="a" value="pack_new">
    <div class="head"><h3>Novi link za klijente</h3></div>
    <div class="grid2">
      <label>Naslov<input type="text" name="title" id="newTitle" maxlength="80" placeholder="npr. Stanovi – Lamela D" required></label>
      <label>Adresa linka<input type="text" name="slug" id="newSlug" maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="npr. stanovi-lamela-d" required></label>
      <button class="btn pri" type="submit">Kreiraj link</button>
    </div>
    <p class="hint">Link će biti <b id="newPreview" data-base="${h(base)}">${h(base)}?p=…</b>. Adresa se nakon kreiranja više ne može promijeniti.</p>
  </form>
  <div id="korisnici" style="scroll-margin-top:80px;display:grid;gap:16px">
    <h2>Korisnici panela</h2>
    <div class="card tbl">
      <table>
        <thead><tr><th>Korisničko ime</th><th>Ime</th><th>Uloga</th><th>Nova šifra</th><th></th></tr></thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>
    <form class="card" method="post">
      <input type="hidden" name="a" value="user_add">
      <div class="head"><h3>Dodaj korisnika</h3></div>
      <div class="grid2">
        <label>Korisničko ime<input type="text" name="user" required pattern="[a-z0-9._-]{3,32}" autocapitalize="none" placeholder="npr. amra.h"></label>
        <label>Ime i prezime<input type="text" name="name" placeholder="npr. Amra Hodžić"></label>
        <label>Šifra<input type="password" name="pass" minlength="10" required autocomplete="new-password"></label>
        <label>Uloga<select name="role"><option value="agent">Agent – samo panel</option><option value="admin">Administrator – panel i administracija</option></select></label>
        <button class="btn pri" type="submit">Dodaj</button>
      </div>
    </form>
  </div>
</main>
<script src="/assets/qrcode.js"></script>
<script src="/assets/admin.js"></script>`, 'adm'));
}
