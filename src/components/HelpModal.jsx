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

          <h3>1. Přihlášení</h3>
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu. Bez hesla.</p>

          <h3>2. Vstup do skupiny</h3>
          <p>Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda. Kód pro kamaráda vygeneruješ přes „+ pozvat parťáka“ v hlavičce.</p>

          <h3>3. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, revír)</div>
          <div className="help-def"><strong>Prut</strong> — nastavení/technika s nástrahou (klidně víc nástrah za výpravu)</div>
          <div className="help-def"><strong>Oblast</strong> — u přívlače: vyšrafovaná plocha, kde jsi chodil a chytal</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, s vlastní přesnou pozicí</div>

          <h3>4. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ</li>
            <li>Klikni na mapu, kam jsi nahodil</li>
            <li>Vyplň název, revír, datum, čas</li>
            <li>„🌤 Doplnit počasí automaticky“ — dotáhne teplotu/tlak/vítr (funguje i zpětně)</li>
            <li>Nástraha u prutu, foto, klidně „+ další nástraha“ nebo „+ další prut“</li>
            <li>Uložit výpravu</li>
          </ol>

          <h3>5. Výprava — oblast (přívlač)</h3>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač</li>
            <li>Klikej podél trasy (aspoň 3 body)</li>
            <li>Chytal jsi i jinde? „+ Další oblast“ a nakresli další</li>
            <li>„Hotovo, pokračovat“ → vyplň formulář</li>
          </ol>

          <h3>6. Zápis úlovku</h3>
          <p>„+ úlovek“ v detailu výpravy → zvol pozici prutu (rychlé) nebo klikni na jinou pozici mapy (přesné) → druh, kategorie (Dravec/Bílá ryba), míry, čas, foto ryby i nástrahy.</p>
          <p className="help-note">Kategorie se přednastaví podle typu výpravy, klidně ji ale změň, pokud jsi chytil něco netypického.</p>

          <h3>7. Úprava a mazání</h3>
          <p><strong>Úlovek:</strong> klik na rybu → ✏️ Upravit nebo 🗑 Smazat<br/>
          <strong>Prut:</strong> tužka ✏️ v detailu výpravy<br/>
          <strong>Celá výprava:</strong> „✏️ Upravit výpravu“ u počasí, nebo 🗑 Smazat výpravu</p>

          <h3>8. Filtry</h3>
          <p><strong>Vše / Dravci / Bílá ryba</strong> — hned ukáže úlovky té kategorie ze všech výprav. Klik na konkrétní výpravu zúží mapu jen na ni.<br/>
          <strong>Kdo</strong> — filtr podle konkrétní osoby, kombinovatelný s kategorií.</p>

          <h3>9. Barvy na mapě</h3>
          <p>Výplň kolečka = kategorie. Barevný rámeček = kdo rybu chytil (barva se nastavuje v profilu).</p>

          <h3>10. Nastavení a statistiky</h3>
          <p>⚙️ — jméno a barva profilu &nbsp;·&nbsp; 📊 — přehled úlovků a výprav za celou partu</p>

          <p className="help-note" style={{ marginTop: 16 }}>
            💡 Klidně zapisuj i starší výpravy zpětně — appka dohledá historické počasí podle data, jen u starších/lokálních jevů jde spíš o odhad pro oblast než přesné měření z místa.
          </p>
        </div>
      </div>
    </div>
  )
}
