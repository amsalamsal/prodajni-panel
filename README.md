# Sarajka – prodajni panel i brošure za klijente

Stranice za klijente (trajni linkovi i QR kodovi), prodajni panel za agente sa šifrom i administracija linkova.
Radi na **Cloudflare Pages** (statične stranice + Pages Functions) s podacima u **Cloudflare KV**.

| Adresa | Ko vidi | Šta je |
|---|---|---|
| `/` | prijavljeni agenti | **cijeli prodajni panel** (bez prijave vodi na `/prijava`) |
| `/?p=stanovi`, `/?p=garaze`, `/?p=poslovni` … | svi (klijenti) | brošure iz jednog paketa – trajni link / QR kod |
| `/?k=lamela-a-12` | svi (klijenti) | jedna brošura ili stranica (link iz panela) |
| `/admin` | administratori | linkovi za klijente, QR kodovi, korisnici |
| `/#upiti` | prijavljeni agenti | upiti klijenata |
| `/prijava`, `/odjava` | – | prijava / odjava |

## Postavljanje na Cloudflare – Workers (preporučeno)

Repozitorij je spreman za **Workers** projekat povezan s GitHubom (deploy komanda `npx wrangler deploy`).

1. *Workers & Pages* → *Create* → *Import a repository* → `prodajni-panel`.
   - Build command: *(prazno)*
   - Deploy command: **`npx wrangler deploy`**
   - Ime Workera: **`prodajni-panel`** (mora odgovarati polju `name` u `wrangler.jsonc`)
2. **KV prostor** `prodajni-panel-sarajka` je vezan kao `SARAJKA` preko ID-a u `wrangler.jsonc`.
   Ne brišite ga – u njemu su korisnici i linkovi za klijente.
3. **Varijable** – Worker → *Settings* → *Variables and Secrets*:
   - `PUBLIC_URL` = javna adresa, npr. **`https://brosure.sarajka.ba/`** (postavite prije štampanja QR kodova).
   - `SESSION_SECRET` *(Secret, preporučeno)* = dug nasumičan tekst.
   Varijable se ne brišu pri novom deployu (`keep_vars`).
4. **Domena** – Worker → *Settings* → *Domains & Routes* → *Add* → *Custom domain* → `brosure.sarajka.ba`
   (DNS za sarajka.ba mora biti na Cloudflareu).
5. Otvorite **`https://brosure.sarajka.ba/prijava`** i kreirajte administratorski račun.

## Postavljanje na Cloudflare – Pages (alternativa)

1. **Pages projekat** – Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → odaberite ovaj repozitorij.
   - Framework preset: **None**
   - Build command: *(prazno)*
   - Build output directory: **`public`**
2. **KV prostor** – *Storage & Databases* → *KV* → *Create namespace*, npr. `sarajka-panel`.
3. **Povezivanje KV-a** – Pages projekat → *Settings* → *Bindings* → *Add* → *KV namespace*:
   - Variable name: **`SARAJKA`** (tačno ovako)
   - KV namespace: `sarajka-panel`
4. **Varijable** – Pages projekat → *Settings* → *Variables and Secrets*:
   - `PUBLIC_URL` = javna adresa, npr. **`https://brosure.sarajka.ba/`** (s kosom crtom na kraju).
     Na ovu adresu vode svi linkovi i QR kodovi – postavite je **prije štampanja QR kodova** i više je ne mijenjajte.
   - `SESSION_SECRET` *(preporučeno, tip Secret)* = dug nasumičan tekst (40+ znakova). Ako ga nema, generiše se automatski.
5. **Ponovno objavljivanje** – *Deployments* → zadnji deployment → *Retry deployment* (da se primijene KV i varijable).
6. **Domena** – Pages projekat → *Custom domains* → *Set up a custom domain* → `brosure.sarajka.ba`.
   Ako je DNS za sarajka.ba na Cloudflareu, sve se podesi samo. Ako nije, kod vašeg DNS providera dodajte
   `CNAME brosure → <ime-projekta>.pages.dev`.
7. Otvorite **`https://brosure.sarajka.ba/prijava`** – prvi put se otvara *Prvo pokretanje* gdje kreirate administratorski račun.

> Cloudflare Pages se ne može postaviti na putanju `www.sarajka.ba/brosure` ako glavna stranica radi negdje drugo,
> zato se koristi poddomena (npr. `brosure.sarajka.ba` ili `ponuda.sarajka.ba`).

## Upiti klijenata („Zainteresovan sam“)

Na stranicama za klijente postoji dugme **Zainteresovan sam** (na stranici paketa, u gornjoj traci prezentacije i u meniju Kontakt).
Klijent upiše ime, telefon, (e-mail), šta ga zanima i poruku; polje „Šta vas zanima?“ se samo popuni brošurom i stranicom koju gleda.

- Upiti se spremaju u KV i vide u panelu pod **Upiti klijenata** (broj novih je istaknut). Agent mijenja status
  (Novo / U obradi / Završeno) i piše bilješku; brisati može samo administrator.
- Zaštita od spama: skriveno polje za robote i najviše 5 upita na sat s iste IP adrese.
- Novi upit se u listi može pojaviti s kašnjenjem do jedne minute.

**Obavijest e-mailom (opcionalno)** – preko [Resend](https://resend.com) (besplatno do 3.000 e-mailova mjesečno):
1. Napravite račun na resend.com → *API Keys* → *Create API Key*.
2. U Cloudflareu (Settings → Variables and Secrets) dodajte:
   - `RESEND_API_KEY` *(Secret)* = ključ iz Resenda
   - `UPIT_EMAIL` = adresa(e) za obavijesti, npr. `info@sarajka.ba` (više adresa odvojite zarezom)
   - `UPIT_FROM` *(nakon što u Resendu potvrdite domenu sarajka.ba)* = npr. `Sarajka panel <panel@sarajka.ba>`
3. Bez potvrđene domene Resend šalje samo na e-mail adresu s kojom ste otvorili Resend račun.

## Trajni linkovi i QR kodovi

- Adresa linka je `PUBLIC_URL?p=naziv` i nikad se ne mijenja.
- U administraciji se mijenja samo sadržaj linka: naslov, tekst, brošure i redoslijed. QR kod ostaje isti.
- Link se ne može obrisati, samo isključiti (klijent tada vidi poruku i kontakt).
- Izmjene su kod klijenata vidljive u roku od oko minute (KV se širi po Cloudflare mreži).
- QR kod za štampu: *Administracija → Preuzmi QR (PNG)*, 1200 × 1200 px, visoka korekcija grešaka.

## Ažuriranje

Svaki commit na granu `main` automatski objavljuje novu verziju. Korisnici i linkovi su u KV-u i ostaju netaknuti.

## Sigurnost

- Šifre se čuvaju kao PBKDF2-SHA256 (100.000 iteracija, sa solju). Prijava se nakon 8 pogrešnih pokušaja s iste IP adrese blokira na 15 minuta.
- Sesija je potpisani kolačić (HttpOnly, Secure), traje 12 sati. Promjena šifre odjavljuje korisnika sa svih uređaja.
- POST zahtjevi se prihvataju samo s iste domene.
- Slike brošura su javne (klijenti ih moraju vidjeti); šifrom su zaštićeni panel i administracija.

## Struktura

```
public/              statične datoteke (Cloudflare Pages output)
  app-shell.txt      aplikacija (panel + stranice za klijente); nije dostupna direktno
  img/ zoom/ sprite/ stranice brošura (standardne, za zum, sličice)
  assets/            administracija (CSS/JS), QR biblioteka
  _routes.json       samo ove putanje pokreću Functions; slike se služe direktno
functions/           obrada zahtjeva: index (klijenti), panel, prijava, odjava, admin, upit, api/upiti, _middleware
worker.js            ulaz za Cloudflare Workers (koristi functions/)
wrangler.jsonc       postavke za Workers (assets, KV)
lib/sarajka.js       zajednička logika: KV, šifre, sesije, prikaz
```

Brošure su navedene u `lib/sarajka.js` (`BROCHURES`) i u `public/app-shell.txt` (`BROS`, `LABELS`).
Nova brošura traži slike u `img/`, `zoom/` i `sprite/` te upis na oba mjesta.

Lokalni test (opcionalno): `npx wrangler dev`.
