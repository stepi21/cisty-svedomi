export default function HelpModal({ onClose }) {
  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket help-ticket">
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Návod</div>
          <h2>Jak appka funguje</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body help-body">

          <h3>1. Přihlášení a skupina</h3>
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu (v tom samém prohlížeči, kde jsi ho žádal). Bez hesla. Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda (ten vygeneruješ přes „+ pozvat parťáka“ v menu „☰ Více“).</p>

          <h3>2. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, vodní stav, revír, u přívlače i cíl)</div>
          <div className="help-def"><strong>Prut</strong> — nastavení/technika, může mít víc nástrah v čase</div>
          <div className="help-def"><strong>Oblast</strong> — u přívlače: vyšrafovaná plocha/trasa, klidně i víc oddělených ploch v jedné výpravě</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, vlastní přesná pozice, čas, foto</div>
          <div className="help-def"><strong>Cíl</strong> — u přívlače: na co jsi cílil ("Obecně dravci" nebo konkrétní druh) — appka počítá úspěšnost</div>
          <div className="help-def"><strong>Katalogové místo (revír)</strong> — uložený bod nebo oblast v katalogu (📍 Revíry), který jde znovu použít u víc výprav, ať nezadáváš pořád to samé</div>

          <h3>3. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ</li>
            <li>Appka se zeptá na místo — buď <strong>vyber z katalogu</strong> (revír/název se předvyplní), nebo <strong>naklikej nové</strong> na mapě</li>
            <li>Klikáš na mapu — pro Prut 1, pak „+ Další prut“ a klikáš pro Prut 2, atd. → „Hotovo, pokračovat“</li>
            <li>Vyplň název, revír, datum, čas</li>
            <li>„🌤 Doplnit podmínky automaticky“ — teplota/tlak/vítr i vodní stav podle data a pozice (funguje i zpětně), fáze měsíce se dopočítá sama. Appka to teď zkusí i sama, jakmile vyplníš datum — tlačítko zůstává pro ruční přepočet</li>
            <li>U prutu nástraha (klidně „+ další nástraha“, foto se zapamatuje pro příště)</li>
          </ol>

          <h3>4. Výprava — oblast (přívlač)</h3>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač → z katalogu (klidně víc míst najednou) nebo klikej podél trasy (aspoň 3 body)</li>
            <li>Chytal jsi i jinde? „+ Další oblast“ a nakresli další</li>
            <li>„Hotovo, pokračovat“ → formulář, volitelně vyplň <strong>Cíl</strong></li>
          </ol>

          <h3>5. Katalog míst (📍 Revíry)</h3>
          <p>Klikni na <strong>📍 Revíry</strong> v hlavičce — přepne appku do režimu katalogu: seznam míst vlevo/dole, na mapě jen vyšrafované revíry a body (bez úlovků a výprav). Klikni na místo v seznamu nebo na mapě → detail s úlovky a výpravami, co se k němu vážou, aktuálním vodním stavem a možností „🔍 Zobrazit na hlavní mapě“. Zpátky do běžného zobrazení tě appka vrátí, jakmile otevřeš konkrétní výpravu z detailu místa; klikem na 📍 Revíry znovu se přepneš tam a zpátky, aniž bys ztratil, kde jsi byl.</p>
          <p><strong>+ Přidat místo</strong> — naklikáš bod nebo oblast stejně jako u nové výpravy.<br/>
          <strong>Zpětné napojení už existující výpravy na katalog:</strong> u výpravy „📍 Místo“ → buď „🔄 Aktualizovat podle katalogu“ (osvěží souřadnice/tvar podle katalogu, když ses jednou napojil), nebo „+ Přidat/změnit místa“ (checklist, vybereš znovu) — appka podle výběru přepíše název i revír (např. dvě místa na Labi → „Labe – Vaflák, soutok“; místa z různých řek → vyjmenuje obě zvlášť).</p>
          <p className="help-note">U úlovku na výpravě s víc revíry přibude tlačítko „📍 Revír“ — vybereš, na kterém z nich jsi konkrétně chytal. Při jediném navázaném místě se to nastaví samo, tlačítko se ani nezobrazí.</p>

          <h3>6. Počasí a vodní stav</h3>
          <p>Tlačítko „🌤 Doplnit podmínky“ natáhne obojí najednou: počasí (Open-Meteo) a vodní stav/průtok/teplotu vody z otevřených dat ČHMÚ podle nejbližší (nebo katalogem potvrzené) měrné stanice. Uvidíš i:</p>
          <div className="help-def">↗️/↘️ vedle tlaku — jestli od včerejška roste, nebo klesá</div>
          <div className="help-def">🟢🟡🟠🔴🟤 odznak — stupeň povodňové aktivity/sucha podle prahů ČHMÚ pro tu stanici</div>
          <div className="help-def">"živě dnes" / "z toho dne" / "měsíční průměr" — jak přesná data jsou; u starších dat appka dostane jen orientační měsíční průměr (a u vodního stavu často nic, ČHMÚ ho tak zpětně neposkytuje)</div>
          <p className="help-note">Výprava složená z víc revírů s různou stanicí zobrazí data za obě zvlášť. V katalogu míst (📍 Revíry → detail místa) appka navíc ukazuje vodní stav <strong>živě, teď</strong> — bez ukládání, na rozdíl od výprav/úlovků, kde se hodnota jednou natažená uloží natrvalo.</p>

          <h3>7. Nástrahy</h3>
          <p>Appka nabízí při psaní jen nástrahy z výprav <strong>stejné kategorie</strong> (u přívlače neuvidíš boilies z kapří výpravy). Foto k nástraze přidáš jednou, appka ho doplní i ke starším záznamům se stejným jménem (jen u tvých vlastních).</p>

          <h3>8. Zápis a úprava úlovku</h3>
          <p>„+ úlovek“ → zvol pozici prutu nebo klikni na jinou pozici mapy → druh, kategorie, míry, čas, revír, foto ryby i nástrahy. Podmínky se dotáhnou samy, jakmile vyplníš čas. V detailu úlovku: ✏️ Upravit, 📍 Změnit pozici na mapě, 🗑 Smazat. Klik na „Lokace“ nebo „Výprava" tě zavede přímo na mapu k té výpravě a konkrétnímu bodu.</p>

          <h3>9. Úprava, mazání, rychlý zápis</h3>
          <p><strong>Celá výprava:</strong> „✏️ Upravit výpravu“ — název, datum, počasí, cíl, 🗺 přesun bodu/překreslení oblasti, 🗑 smazat.<br/>
          <strong>„📋 Nová jako tahle“</strong> — předvyplní novou výpravu stejnou lokací, pruty i nástrahami — hodí se pro opakovaná místa, jen doplníš datum a čas.</p>
          <p className="help-note">Upravit/smazat může jen ten, komu záznam patří. Ostatní vidí všechno, ale měnit si můžou jen svoje.</p>

          <h3>10. Filtry, mapa, hledání</h3>
          <p><strong>Vše / Dravci / Bílá ryba</strong> — agregovaný pohled přes všechny výpravy najednou. Klik na konkrétní výpravu zúží mapu na ni.<br/>
          <strong>Kdo</strong> — filtr podle osoby, kombinovatelný s kategorií.<br/>
          <strong>🔎 Hledat</strong> — nad seznamem výprav, hledá v názvu, revíru, druhu ryby i nástraze.<br/>
          <strong>⬆️ Nejnovější</strong> — rychlý skok zpátky na poslední výpravu, když se zatoulá v historii.<br/>
          <strong>📍 Moje pozice</strong> — skočí na tvoji aktuální GPS pozici.</p>

          <h3>11. Barvy, seznam výprav</h3>
          <p>Výplň kolečka = kategorie, rámeček = kdo chytil (barva v profilu ⚙️). Výpravy jsou seskupené podle roku/měsíce — „Rozbalit/Sbalit vše“ nahoře.</p>

          <h3>12. Statistiky, rekordy, galerie</h3>
          <p>📊 <strong>Statistiky</strong> — návštěvy, úlovky podle druhu, úspěšnost podle cíle, a <strong>„📈 Kdy se daří“</strong> (úlovky podle fáze měsíce, tlaku, trendu tlaku a vodního stavu).<br/>
          🏆 <strong>Rekordy</strong> — největší úlovek (podle délky) od každého druhu, s datem, revírem a kdo ho chytil.<br/>
          🖼 <strong>Galerie</strong> — mřížka všech fotek ryb a nástrah.<br/>
          Všechny tři najdeš v menu <strong>„☰ Více“</strong> vpravo nahoře.</p>

          <h3>13. Export a nastavení</h3>
          <p>⬇️ <strong>Export dat</strong> — stáhne JSON se všemi výpravami/úlovky jako záloha.<br/>
          ⚙️ <strong>Nastavení</strong> — jméno a barva profilu.<br/>
          Obojí je v menu „☰ Více“.</p>

          <h3>14. Připojení u vody</h3>
          <p>Appka pozná, když ztratíš signál, a ukáže banner nahoře. Rozepsaný formulář (výprava i úlovek) se v tu chvíli <strong>neztratí</strong> — zůstane vyplněný, dokud se ukládání nepovede. Po úspěšném uložení appka krátce potvrdí „✓ Uloženo“.</p>

          <p className="help-note" style={{ marginTop: 16 }}>
            💡 Klidně zapisuj i starší výpravy zpětně — appka dohledá historické počasí i vodní stav podle data, jen u starších/lokálních jevů jde spíš o odhad pro oblast/měsíc než přesné měření z místa a dne.
          </p>
        </div>
      </div>
    </div>
  )
}
