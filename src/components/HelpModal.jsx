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
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu (v tom samém prohlížeči, kde jsi ho žádal). Bez hesla. Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda (ten vygeneruješ přes „+ pozvat parťáka“).</p>

          <h3>2. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, revír, u přívlače i cíl)</div>
          <div className="help-def"><strong>Prut</strong> — nastavení/technika, může mít víc nástrah v čase</div>
          <div className="help-def"><strong>Oblast</strong> — u přívlače: vyšrafovaná plocha/trasa, klidně i víc oddělených ploch v jedné výpravě</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, vlastní přesná pozice, čas, foto</div>
          <div className="help-def"><strong>Cíl</strong> — u přívlače: na co jsi cílil ("Obecně dravci" nebo konkrétní druh) — appka počítá úspěšnost</div>

          <h3>3. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ</li>
            <li>Klikáš na mapu — pro Prut 1, pak „+ Další prut“ a klikáš pro Prut 2, atd. → „Hotovo, pokračovat“</li>
            <li>Vyplň název, revír, datum, čas</li>
            <li>„🌤 Doplnit počasí automaticky“ — teplota/tlak/vítr podle data a pozice (funguje i zpětně), fáze měsíce se dopočítá sama</li>
            <li>U prutu nástraha (klidně „+ další nástraha“, foto se zapamatuje pro příště)</li>
          </ol>

          <h3>4. Výprava — oblast (přívlač)</h3>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač → klikej podél trasy (aspoň 3 body)</li>
            <li>Chytal jsi i jinde? „+ Další oblast“ a nakresli další</li>
            <li>„Hotovo, pokračovat“ → formulář, volitelně vyplň <strong>Cíl</strong></li>
          </ol>

          <h3>5. Nástrahy</h3>
          <p>Appka nabízí při psaní jen nástrahy z výprav <strong>stejné kategorie</strong> (u přívlače neuvidíš boilies z kapří výpravy). Foto k nástraze přidáš jednou, appka ho doplní i ke starším záznamům se stejným jménem (jen u tvých vlastních).</p>

          <h3>6. Zápis a úprava úlovku</h3>
          <p>„+ úlovek“ → zvol pozici prutu nebo klikni na jinou pozici mapy → druh, kategorie, míry, čas, revír, foto ryby i nástrahy. V detailu úlovku: ✏️ Upravit, 📍 Změnit pozici na mapě, 🗑 Smazat. Klik na „Lokace“ nebo „Výprava" tě zavede přímo na mapu k té výpravě a konkrétnímu bodu.</p>

          <h3>7. Úprava, mazání, rychlý zápis</h3>
          <p><strong>Celá výprava:</strong> „✏️ Upravit výpravu“ — název, datum, počasí, cíl, 🗺 přesun bodu/překreslení oblasti, 🗑 smazat.<br/>
          <strong>„📋 Nová jako tahle“</strong> — předvyplní novou výpravu stejnou lokací, pruty i nástrahami — hodí se pro opakovaná místa, jen doplníš datum a čas.</p>
          <p className="help-note">Upravit/smazat může jen ten, komu záznam patří. Ostatní vidí všechno, ale měnit si můžou jen svoje.</p>

          <h3>8. Filtry a mapa</h3>
          <p><strong>Vše / Dravci / Bílá ryba</strong> — agregovaný pohled přes všechny výpravy najednou. Klik na konkrétní výpravu zúží mapu na ni.<br/>
          <strong>Kdo</strong> — filtr podle osoby, kombinovatelný s kategorií.<br/>
          <strong>📍 Moje pozice</strong> — skočí na tvoji aktuální GPS pozici.</p>

          <h3>9. Barvy, seznam výprav</h3>
          <p>Výplň kolečka = kategorie, rámeček = kdo chytil (barva v profilu ⚙️). Výpravy jsou seskupené podle roku/měsíce — „Rozbalit/Sbalit vše“ nahoře.</p>

          <h3>10. Statistiky, rekordy, galerie</h3>
          <p>📊 <strong>Statistiky</strong> — návštěvy, úlovky podle druhu, úspěšnost podle cíle, a <strong>„📈 Kdy se daří“</strong> (úlovky podle fáze měsíce a tlaku).<br/>
          🏆 <strong>Rekordy</strong> — největší úlovek (podle délky) od každého druhu, s datem, revírem a kdo ho chytil.<br/>
          🖼 <strong>Galerie</strong> — mřížka všech fotek ryb a nástrah.</p>

          <h3>11. Export a nastavení</h3>
          <p>⬇️ <strong>Export dat</strong> — stáhne JSON se všemi výpravami/úlovky jako záloha.<br/>
          ⚙️ <strong>Nastavení</strong> — jméno a barva profilu.</p>

          <p className="help-note" style={{ marginTop: 16 }}>
            💡 Klidně zapisuj i starší výpravy zpětně — appka dohledá historické počasí podle data i zpětně, jen u starších/lokálních jevů jde spíš o odhad pro oblast než přesné měření z místa.
          </p>
        </div>
      </div>
    </div>
  )
}
