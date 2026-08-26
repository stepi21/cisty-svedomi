export default function HelpModal() {
  return (
    <>
      <div className="sb-head"><span>Jak appka funguje</span></div>
      <div className="help-body" style={{ padding: '0 18px 20px' }}>

          <h3>1. Přihlášení a skupina</h3>
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu (v tom samém prohlížeči, kde jsi ho žádal). Bez hesla. Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda (ten vygeneruješ přes „+ pozvat parťáka“ v menu ☰ vpravo nahoře).</p>

          <h3>2. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, vodní stav, revír, u přívlače i cíl)</div>
          <div className="help-def"><strong>Bod na břehu</strong> — kde stojíš při chytání (appka podle něj hledá revír a vodní stav); u kapra/mušky/plavané odděleně od pozic prutů ve vodě</div>
          <div className="help-def"><strong>Prut</strong> — u kapra/mušky/plavané: nastavení/technika ve vodě, může mít víc nástrah v čase</div>
          <div className="help-def"><strong>Místo</strong> — u přívlače: stanoviště, odkud házíš (žádná přesná pozice záběru, tu appka zjišťuje zvlášť u každého úlovku)</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, vlastní přesná pozice, čas, foto</div>
          <div className="help-def"><strong>Cíl</strong> — u přívlače: buď zaškrtneš „Obecně dravci", nebo napíšeš konkrétní druh — appka počítá úspěšnost</div>
          <div className="help-def"><strong>Katalogové místo (revír)</strong> — uložené jméno/revír, appka ho nabídne automaticky, když jsi poblíž místa, kde už jednou appka o tobě/partě ví</div>

          <h3>3. Panely v hlavičce</h3>
          <p>Appka má čtyři hlavní záložky nahoře: <strong>Domů</strong> (feed posledních úlovků party), <strong>Mapa</strong> (přepínatelné vrstvy — moje/party výpravy, moje/party úlovky — s hledáním míst), <strong>Výpravy</strong> a <strong>Úlovky</strong> (plochý seznam s hledáním). Zvoneček 🔔 appka ukazuje jen pro věci vyžadující tvoje potvrzení (revír upravený kamarádem, co se týká tvých výprav) — obecné novinky appka nechává na Domů. Zbytek appka schová do menu <strong>☰</strong> vpravo nahoře: <strong>Nástrahy</strong>, <strong>Měrné stanice</strong>, <strong>Rekordy</strong>, <strong>Statistiky</strong>, <strong>Export dat</strong>, <strong>Návod</strong> a <strong>Nastavení</strong> — všechny se otevřou jako plnohodnotná samostatná obrazovka (stejně jako Domů/Mapa/Výpravy/Úlovky), ne jako malé vyskakovací okno.</p>

          <h3>4. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ</li>
            <li><strong>Živá výprava</strong> (▶️ Výprava teď): appka rovnou zkusí zjistit tvoji GPS polohu.<br/>
            <strong>Zpětná výprava</strong>: appka GPS nevolá (nejsi fyzicky na místě) — necháš appku kliknout bod na břehu ručně na mapě.</li>
            <li>Appka nabídne nejbližší podobná místa z historie (appka nikdy nerozhoduje sama, jen nabídne na výběr — u soutoku dvou řek uvidíš obě možnosti) — vyber, nebo napiš nové jméno</li>
            <li>Appka spustí klikání pozic prutů do vody — Prut 1, pak „+ Další prut“, atd. → „Hotovo, pokračovat“</li>
            <li>Podmínky (počasí i vodní stav) appka zkusí natáhnout sama, jakmile appka pozná datum; tlačítko zůstává pro ruční přepočet</li>
            <li>U prutu nástraha (klidně „+ další nástraha“, foto se zapamatuje pro příště)</li>
          </ol>

          <h3>5. Výprava — místa (přívlač)</h3>
          <p>Stejný GPS/klikací mechanismus jako u bodových typů výše (appka nabídne nejbližší z historie), jen appka místo prutů ve vodě pracuje s <strong>místy na břehu</strong> — žádná plocha, žádné kreslení.</p>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač → appka zjistí polohu (živá), nebo necháš appku kliknout ručně (zpětná)</li>
            <li>Chytal jsi i jinde? „+ další místo“ ve formuláři — appka přidá další stanoviště, pozici mu nastavíš kliknutím na mapu</li>
            <li>Formulář: volitelně zaškrtni <strong>Obecně dravci</strong> nebo napiš konkrétní druh jako cíl</li>
            <li>U úlovku appka <strong>vždy</strong> vyžaduje přesný klik na mapu — místo appce neříká, kde přesně došlo k záběru, jen odkud jsi házel</li>
          </ol>

          <h3>6. Katalog míst (Revíry)</h3>
          <p>Appka katalog míst nabízí přes záložku <strong>Mapa</strong> — hledací pole nahoře najde místo podle jména/čísla revíru, klik na výsledek (nebo na tečku přímo na mapě) otevře detail s úlovky a výpravami, co se k němu vážou, a aktuálním vodním stavem. Appka katalog u NOVÉ výpravy sama nevyžaduje — funguje jen jako podklad pro "nejbližší z historie" (viz body 4-5 výše).</p>
          <p className="help-note">U úlovku na výpravě s víc revíry přibude tlačítko „Revír“ — vybereš, na kterém z nich jsi konkrétně chytal. Při jediném navázaném místě se to nastaví samo.</p>

          <h3>7. Počasí a vodní stav</h3>
          <p>Tlačítko „Doplnit/Přepočítat podmínky“ natáhne obojí najednou: počasí (teplota, tlak, vítr — <strong>i směr</strong>, např. „12 km/h SV“) z Open-Meteo a vodní stav/průtok/teplotu vody z otevřených dat ČHMÚ podle nejbližší (nebo katalogem potvrzené) měrné stanice. Uvidíš i:</p>
          <div className="help-def">šipka vedle tlaku — jestli od včerejška roste, klesá, nebo je stabilní</div>
          <div className="help-def">barevný odznak — stupeň povodňové aktivity/sucha podle prahů ČHMÚ pro tu stanici</div>
          <div className="help-def">"živě dnes" / "z toho dne" / "měsíční průměr" — jak přesná data jsou; u starších dat appka dostane jen orientační měsíční průměr (a u vodního stavu často nic, ČHMÚ ho tak zpětně neposkytuje)</div>
          <p className="help-note">Výprava složená z víc revírů s různou stanicí zobrazí data za obě zvlášť. Když <strong>přepočítáš podmínky u celé výpravy</strong>, appka je zároveň přepíše i u všech jejích úlovků (vodní stav zůstává specifický — úlovek si může držet přesnější vlastní revír). V katalogu míst appka navíc ukazuje vodní stav <strong>živě, teď</strong> — bez ukládání, na rozdíl od výprav/úlovků, kde se hodnota jednou natažená uloží natrvalo.</p>

          <h3>8. Nástrahy</h3>
          <p>Appka nabízí při psaní jen nástrahy z výprav <strong>stejné kategorie</strong> (u přívlače neuvidíš boilies z kapří výpravy). Foto k nástraze přidáš jednou, appka ho doplní i ke starším záznamům se stejným jménem (jen u tvých vlastních).</p>

          <h3>9. Zápis a úprava úlovku</h3>
          <p>„+ úlovek“ → u kapra/mušky/plavané appka rovnou přiřadí pozici jediného prutu bez ptaní; při víc prutech zvol pozici nebo klikni na jinou pozici mapy. <strong>U přívlače appka vždy vyžaduje přesný klik na mapu</strong> — místo appce neříká, kde přesně došlo k záběru. Dál appka chce druh, kategorii, míry, čas, revír, foto ryby i nástrahy. Nabídka nástrah je omezená jen na ty, co jsou <strong>zapsané u prutů/míst téhle výpravy</strong> — ne celý katalog. Podmínky se dotáhnou samy, jakmile vyplníš čas. V detailu úlovku: Upravit, Změnit pozici na mapě, Smazat. Klik na „Lokace“ nebo „Výprava" tě zavede přímo na mapu k té výpravě a konkrétnímu bodu.</p>

          <h3>10. Úprava, mazání, rychlý zápis</h3>
          <p><strong>Celá výprava:</strong> „Upravit výpravu“ — název, datum, počasí, cíl, přesun bodu na břehu na mapě, smazat.<br/>
          <strong>„Nová jako tahle“</strong> — předvyplní novou výpravu stejnou lokací, pruty i nástrahami — hodí se pro opakovaná místa, jen doplníš datum a čas.</p>
          <p className="help-note">Upravit/smazat může jen ten, komu záznam patří. Ostatní vidí všechno, ale měnit si můžou jen svoje.</p>

          <h3>11. Filtry, mapa, hledání</h3>
          <p><strong>Vše / Dravci / Bílá ryba</strong> — agregovaný pohled přes všechny výpravy najednou (stejný filtr má i panel Úlovky). Klik na konkrétní výpravu zúží mapu na ni.<br/>
          <strong>Kdo</strong> — filtr podle osoby, kombinovatelný s kategorií.<br/>
          <strong>Hledat</strong> — nad každým seznamem, hledá bez ohledu na diakritiku a velikost písmen; při psaní se automaticky rozbalí všechny skupiny s výsledkem a po smazání textu se appka vrátí přesně tam, kde jsi byl.<br/>
          <strong>Nejnovější</strong> — rychlý skok zpátky na poslední výpravu, když se zatoulá v historii.<br/>
          <strong>Moje pozice</strong> — skočí na tvoji aktuální GPS pozici.</p>

          <h3>12. Barvy, seznam výprav</h3>
          <p>Výplň kolečka = kategorie, rámeček = kdo chytil (barva v profilu, v menu ☰ → Nastavení). Výpravy jsou seskupené podle roku/měsíce — „Rozbalit/Sbalit vše“ nahoře.</p>

          <h3>13. Statistiky, rekordy, galerie</h3>
          <p><strong>Statistiky</strong> — návštěvy, úlovky podle druhu, úspěšnost podle cíle, a <strong>„Kdy se daří“</strong> (úlovky podle fáze měsíce, tlaku, trendu tlaku a vodního stavu).<br/>
          <strong>Rekordy</strong> — největší úlovek (podle délky) od každého druhu, s datem, revírem a kdo ho chytil.<br/>
          <strong>Galerie</strong> — mřížka všech fotek ryb a nástrah.<br/>
          Všechny tři najdeš v menu ☰ vpravo nahoře.</p>

          <h3>14. Export a nastavení</h3>
          <p><strong>Export dat</strong> — stáhne JSON se všemi výpravami/úlovky jako záloha.<br/>
          <strong>Nastavení</strong> — jméno a barva profilu.<br/>
          Obojí je v menu ☰.</p>

          <h3>15. Připojení u vody</h3>
          <p>Appka pozná, když ztratíš signál, a ukáže banner nahoře. Rozepsaný formulář (výprava i úlovek) se v tu chvíli <strong>neztratí</strong> — zůstane vyplněný, dokud se ukládání nepovede. Po úspěšném uložení appka krátce potvrdí „Uloženo“.</p>

          <p className="help-note" style={{ marginTop: 16 }}>
            Klidně zapisuj i starší výpravy zpětně — appka dohledá historické počasí i vodní stav podle data, jen u starších/lokálních jevů jde spíš o odhad pro oblast/měsíc než přesné měření z místa a dne.
          </p>
      </div>
    </>
  )
}
