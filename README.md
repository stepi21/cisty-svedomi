# Nahodit — appka

React appka napojená na Supabase. Postup níže nepotřebuje žádný terminál.

## 0) Než appku aktualizuješ — spusť migraci v Supabase

V **SQL Editoru** spusť soubor `migration_2.sql` (přidá pole pro oblast výprav, foto nástrahy a úložiště na fotky).

## 1) Nahrát kód na GitHub

1. Jdi na **github.com** → přihlas se / založ účet (přes e-mail, žádný terminál potřeba)
2. **+** vpravo nahoře → **New repository**
3. Název např. `nahodit`, ponech **Public** nebo **Private** (obojí je pro Vercel free tier v pořádku)
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
3. Vyber repozitář `nahodit` → **Import**
4. V sekci **Environment Variables** přidej:
   - `VITE_SUPABASE_URL` = (Project URL z kroku 2)
   - `VITE_SUPABASE_ANON_KEY` = (anon public klíč z kroku 2)
5. **Deploy**
6. Po pár minutách appka poběží na adrese typu `nahodit.vercel.app`

## 4) Doladit Supabase pro tuhle adresu

V Supabase: **Authentication → URL Configuration**:
- **Site URL**: vlož adresu appky z kroku 3 (např. `https://nahodit.vercel.app`)
- **Redirect URLs**: přidej stejnou adresu (klidně i s `/**` na konci)

Bez tohoto kroku by přihlašovací magic link posílal lidi na špatnou adresu.

## Jak appka funguje

- Přihlášení přes magic link (e-mail)
- Při prvním přihlášení: založit skupinu, nebo se přidat pomocí kódu pozvánky
- **Nová výprava:** "+ nová výprava" → zvolíš typ → u bodových typů (kapr/muška/plavaná/jiné) klikneš na mapu, kde jsi chytal → u přívlače klikáš víc bodů po oblasti a potvrdíš "Dokončit oblast" → pak se otevře formulář s detaily
- **Pozice prutů:** v formuláři u každého prutu je tlačítko s aktuální pozicí — klikni na něj a pak na mapu, kam přesně jsi ho nahodil
- **Foto nástrahy:** u každého prutu lze přiložit fotku
- **Automatické počasí:** tlačítko "Doplnit počasí automaticky" stáhne teplotu/tlak/vítr z Open-Meteo podle data a pozice (funguje i zpětně)
- **Úlovek:** "+ úlovek" → klikneš na mapu přesně tam, kde jsi rybu vytáhl → formulář s detaily
- Filtr Vše/Dravci/Bílá ryba nad seznamem výprav
- "+ pozvat parťáka" v appce vygeneruje kód, který kamarád zadá po svém přihlášení

## Co bude potřeba později

- Foto úlovků (teď jen placeholder text v detailu úlovku — infrastruktura na fotky už běží, jen to ještě nemá formulářové pole)
- Mapy.com podklad místo OpenStreetMap
