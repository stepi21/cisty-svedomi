import { IconClose } from '../lib/icons.jsx'
export default function HelpModal({ onClose }) {
  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket help-ticket">
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}><IconClose size={16} /></button>
          <div className="eyebrow">Návod</div>
          <h2>Jak appka funguje</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body help-body">

          <h3>1. Přihlášení a skupina</h3>
          <p>Zadej e-mail → <strong>Poslat přihlašovací link</strong> → klikni na odkaz v e-mailu (v tom samém prohlížeči, kde jsi ho žádal). Bez hesla. Při prvním přihlášení buď <strong>založíš skupinu</strong>, nebo zadáš <strong>kód pozvánky</strong> od kamaráda (ten vygeneruješ přes „+ pozvat parťáka“ v menu ☰ vpravo nahoře).</p>

          <h3>2. Základní pojmy</h3>
          <div className="help-def"><strong>Výprava</strong> — jedna návštěva u vody (datum, čas, počasí, vodní stav, revír, u přívlače i cíl)</div>
          <div className="help-def"><strong>Prut</strong> — nastavení/technika, může mít víc nástrah v čase</div>
          <div className="help-def"><strong>Oblast</strong> — u přívlače: vyšrafovaná plocha/trasa, klidně i víc oddělených ploch v jedné výpravě</div>
          <div className="help-def"><strong>Úlovek</strong> — konkrétní chycená ryba, vlastní přesná pozice, čas, foto</div>
          <div className="help-def"><strong>Cíl</strong> — u přívlače: buď zaškrtneš „Obecně dravci", nebo napíšeš konkrétní druh — appka počítá úspěšnost</div>
          <div className="help-def"><strong>Katalogové místo (revír)</strong> — uložený bod nebo oblast v katalogu, který jde znovu použít u víc výprav, ať nezadáváš pořád to samé</div>

          <h3>3. Čtyři panely v hlavičce</h3>
          <p>Appka má čtyři přepínače: <strong>Výpravy</strong> (výchozí pohled), <strong>Revíry</strong> (katalog míst, mapa ukáže jen revíry), <strong>Nástrahy</strong> a <strong>Úlovky</strong> (plochý seznam se stejným hledáním jako u výprav). Zapnutí jednoho panelu automaticky vypne předchozí. Hledací pole se při přepnutí panelu vždy vyprázdní. Zbytek (Galerie, Rekordy, Statistiky, Export, Návod, Nastavení) najdeš v menu <strong>☰</strong> vpravo nahoře — zavře se kliknutím mimo něj, ne jen opětovným kliknutím na ☰.</p>

          <h3>4. Výprava — bod (kapr, muška, plavaná, jiné)</h3>
          <ol>
            <li>„+ nová výprava“ → vyber typ</li>
            <li>Appka se zeptá na místo — buď <strong>vyber z katalogu</strong> (revír/název se předvyplní), nebo <strong>naklikej nové</strong> na mapě</li>
            <li>Klikáš na mapu — pro Prut 1, pak „+ Další prut“ a klikáš pro Prut 2, atd. → „Hotovo, pokračovat“</li>
            <li>Vyplň název, revír, datum, čas</li>
            <li>Podmínky (počasí i vodní stav) appka zkusí natáhnout sama, jakmile vyplníš datum; tlačítko zůstává pro ruční přepočet</li>
            <li>U prutu nástraha (klidně „+ další nástraha“, foto se zapamatuje pro příště)</li>
          </ol>

          <h3>5. Výprava — oblast (přívlač)</h3>
          <ol>
            <li>„+ nová výprava“ → typ Přívlač → z katalogu (klidně víc míst najednou) nebo klikej podél trasy (aspoň 3 body)</li>
            <li>Chytal jsi i jinde? „+ Další oblast“ — appka se zeptá, jestli chceš vybrat další místo z katalogu, nebo naklikat novou plochu ručně</li>
            <li>„Hotovo, pokračovat“ → formulář, volitelně zaškrtni <strong>Obecně dravci</strong> nebo napiš konkrétní druh jako cíl</li>
          </ol>

          <h3>6. Katalog míst (Revíry)</h3>
          <p>Panel <strong>Revíry</strong> přepne appku do režimu katalogu: seznam míst vlevo/dole, na mapě jen vyšrafované revíry a body (bez úlovků a výprav), s hledáním v názvu i čísle revíru. Klikni na místo → detail s úlovky a výpravami, co se k němu vážou, aktuálním vodním stavem a možností zobrazit na hlavní mapě.</p>
          <p><strong>+ Přidat místo</strong> — naklikáš bod nebo oblast stejně jako u nové výpravy.<br/>
          <strong>Zpětné napojení už existující výpravy na katalog:</strong> u výpravy „Místo“ → buď „Aktualizovat podle katalogu“ (osvěží souřadnice/tvar podle katalogu, když ses jednou napojil), nebo „+ Přidat/změnit místa“ (checklist, vybereš znovu) — appka podle výběru přepíše název i revír (např. dvě místa na Labi → „Labe – Vaflák, soutok“; místa z různých řek → vyjmenuje obě zvlášť).</p>
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
          <p>„+ úlovek“ → pokud je ve výpravě jen jeden prut, appka ho rovnou přiřadí bez ptaní; při víc prutech zvol pozici nebo klikni na jinou pozici mapy → druh, kategorie, míry, čas, revír, foto ryby i nástrahy. Nabídka nástrah je omezená jen na ty, co jsou <strong>zapsané u prutů téhle výpravy</strong> — ne celý katalog. Podmínky se dotáhnou samy, jakmile vyplníš čas. V detailu úlovku: Upravit, Změnit pozici na mapě, Smazat. Klik na „Lokace“ nebo „Výprava" tě zavede přímo na mapu k té výpravě a konkrétnímu bodu.</p>

          <h3>10. Úprava, mazání, rychlý zápis</h3>
          <p><strong>Celá výprava:</strong> „Upravit výpravu“ — název, datum, počasí, cíl, přesun bodu/překreslení oblasti, smazat.<br/>
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
      </div>
    </div>
  )
}
