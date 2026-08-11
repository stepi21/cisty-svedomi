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
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu. Bez hesla. Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda (ten vygeneruješ přes „+ pozvat parťáka“).</p>

          <h3>2. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, revír, u přívlače i cíl)</div>
          <div className="help-def"><strong>Prut</strong> — nastavení/technika, může mít víc nástrah v čase</div>
          <div className="help-def"><strong>Oblast</strong> — u přívlače: vyšrafovaná plocha, klidně i víc oddělených ploch v jedné výpravě</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, vlastní přesná pozice, čas, foto</div>

          <h3>3. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ → klikni na mapu, kam jsi nahodil</li>
            <li>Vyplň název, revír/lokalitu, datum, čas</li>
            <li>„🌤 Doplnit počasí automaticky“ — teplota/tlak/vítr podle data a pozice (funguje i zpětně), fáze měsíce se dopočítá sama</li>
            <li>U prutu nástraha (klidně „+ další nástraha“, foto se zapamatuje pro příště), „+ další prut“ pro víc prutů se samostatnou pozicí</li>
          </ol>

          <h3>4. Výprava — oblast (přívlač)</h3>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač → klikej podél trasy (aspoň 3 body)</li>
            <li>Chytal jsi i jinde? „+ Další oblast“ a nakresli další — klidně víc oddělených ploch v jedné výpravě</li>
            <li>„Hotovo, pokračovat“ → vyplň formulář</li>
            <li>Volitelně vyplň <strong>Cíl</strong> — „Obecně dravci“ nebo konkrétní druh (např. „Bolen“). Appka pak sama pozná a označí 🎯, když se úlovek s cílem shoduje, a počítá úspěšnost ve statistikách</li>
          </ol>

          <h3>5. Nástrahy — chytřejší než vypadají</h3>
          <p>Appka si pamatuje všechny nástrahy, které kdy kdokoli ve skupině zadal, a při psaní je nabízí — <strong>oddělené pro dravce a bílou rybu</strong>, takže u přívlače neuvidíš boilies z kapří výpravy. Přidáš fotku k nástraze jednou, a appka ji automaticky doplní i ke starším záznamům se stejným jménem (jen u tvých vlastních).</p>

          <h3>6. Zápis úlovku</h3>
          <p>„+ úlovek“ → zvol pozici prutu (rychlé) nebo klikni na jinou pozici mapy (přesné) → druh, kategorie, míry, čas, revír, foto ryby i nástrahy.</p>
          <p className="help-note">Kategorie se přednastaví podle typu výpravy, klidně ji ale změň, pokud jsi chytil něco netypického.</p>

          <h3>7. Úprava, mazání, přesun</h3>
          <p><strong>Úlovek:</strong> klik na rybu → ✏️ Upravit (i datum/čas, kategorii, foto, revír), 📍 změnit pozici na mapě, nebo 🗑 Smazat<br/>
          <strong>Prut:</strong> tužka ✏️ v detailu výpravy<br/>
          <strong>Celá výprava:</strong> „✏️ Upravit výpravu“ u počasí — název, datum, čas, počasí, revír, cíl, 🗺 přesun bodu/překreslení oblasti, nebo 🗑 Smazat výpravu</p>
          <p className="help-note">Upravit/smazat může jen ten, komu výprava patří. Ostatní ve skupině vidí všechno, ale jen svoje si můžou měnit.</p>

          <h3>8. Filtry a pohled na mapě</h3>
          <p><strong>Vše / Dravci / Bílá ryba</strong> — hned ukáže úlovky té kategorie ze všech výprav najednou (agregovaný pohled). Klik na konkrétní výpravu v sidebaru zúží mapu jen na ni (detailní pohled).<br/>
          <strong>Kdo</strong> — filtr podle osoby, kombinovatelný s kategorií (např. „Dravci“ + „Petr“).</p>

          <h3>9. Barvy na mapě</h3>
          <p>Výplň kolečka = kategorie (dravec/bílá ryba). Barevný rámeček kolem = kdo rybu chytil (barvu nastavíš v profilu ⚙️).</p>

          <h3>10. Seznam výprav</h3>
          <p>Výpravy jsou seskupené podle <strong>roku a měsíce</strong>, nejnovější rozbalené, starší sbalené. „Rozbalit vše“ / „Sbalit vše“ nahoře, nebo klikni na název měsíce/roku jednotlivě.</p>

          <h3>11. Nastavení a statistiky</h3>
          <p>⚙️ — jméno a barva profilu<br/>
          📊 — přehled za celou partu: návštěvy, úlovky podle druhu, a u přívlače i <strong>úspěšnost podle cíle</strong> (celkově i pro každého člena)</p>

          <p className="help-note" style={{ marginTop: 16 }}>
            💡 Klidně zapisuj i starší výpravy zpětně — appka dohledá historické počasí podle data, jen u starších/lokálních jevů jde spíš o odhad pro oblast než přesné měření z místa.
          </p>
        </div>
      </div>
    </div>
  )
}
