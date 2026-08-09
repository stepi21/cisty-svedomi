# Čisté svědomí — appka

React appka napojená na Supabase. Postup níže nepotřebuje žádný terminál.

## 1) Nahrát kód na GitHub

1. Jdi na **github.com** → přihlas se / založ účet (přes e-mail, žádný terminál potřeba)
2. **+** vpravo nahoře → **New repository**
3. Název např. `cisty-svedomi`, ponech **Public** nebo **Private** (obojí je pro Vercel free tier v pořádku)
4. **Create repository**
5. Na stránce repa klikni **uploading an existing file** (nebo Add file → Upload files)
6. **Rozbal si tento zip na svém počítači** a celý obsah složky (ne samotnou složku, ale co je uvnitř — `package.json`, `src`, `index.html` atd.) přetáhni myší do okna GitHubu
7. Dole **Commit changes**

## 2) Nastavit Supabase klíče

V Supabase dashboardu: **Project Settings → API** — najdeš tam:
- **Project URL**
- **anon public** klíč

Tyto dvě hodnoty budeš potřebovat v kroku 3.

## 3) Nasadit na Vercel

1. Jdi na **vercel.com** → přihlas se přes GitHub účet (ten samý, co v kroku 1)
2. **Add New… → Project**
3. Vyber repozitář `cisty-svedomi` → **Import**
4. V sekci **Environment Variables** přidej:
   - `VITE_SUPABASE_URL` = (Project URL z kroku 2)
   - `VITE_SUPABASE_ANON_KEY` = (anon public klíč z kroku 2)
5. **Deploy**
6. Po pár minutách appka poběží na adrese typu `cisty-svedomi.vercel.app`

## 4) Doladit Supabase pro tuhle adresu

V Supabase: **Authentication → URL Configuration**:
- **Site URL**: vlož adresu appky z kroku 3 (např. `https://cisty-svedomi.vercel.app`)
- **Redirect URLs**: přidej stejnou adresu (klidně i s `/**` na konci)

Bez tohoto kroku by přihlašovací magic link posílal lidi na špatnou adresu.

## Jak appka funguje

- Přihlášení přes magic link (e-mail)
- Při prvním přihlášení: založit skupinu, nebo se přidat pomocí kódu pozvánky
- Sdílené výpravy v rámci skupiny — mapa (OpenStreetMap), pruty, úlovky, filtr dravci/bílá ryba
- "+ pozvat parťáka" v appce vygeneruje kód, který kamarád zadá po svém přihlášení

## Co bude potřeba později

- Nahrávání fotek úlovků (Supabase Storage) — teď je jen placeholder text
- Automatické historické/aktuální počasí (Open-Meteo) — teď se zadává manuálně
- Mapy.com podklad místo OpenStreetMap
