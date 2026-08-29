import { useEffect } from 'react'

// Zamkne scrollovani cele stranky (html/body), zatimco je otevreny
// nejaky celoobrazovkovy panel (ulovkovy listek, nova/ziva vyprava,
// editace vypravy). Bez tohoto na iOS Safari fixni ("position:fixed")
// panel jen VIZUALNE zakryje obrazovku, ale dotykem se dá dal scrollovat
// stranka POD nim (schovana, ale porad aktivni) -- to zpusobovalo pocit,
// ze se panel "zasekava" nebo je "prikotveny" k horni liste, protoze se
// ve skutecnosti hybalo neco jineho, ne panel samotny.
//
// Pouziti: v komponente panelu jen zavolej useLockBodyScroll() -- zamkne
// se pri prvnim vykresleni, odemkne se pri zavreni/zmizeni panelu.
export function useLockBodyScroll() {
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const prevPosition = body.style.position
    const prevTop = body.style.top
    const prevWidth = body.style.width
    const prevOverflow = body.style.overflow

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = prevPosition
      body.style.top = prevTop
      body.style.width = prevWidth
      body.style.overflow = prevOverflow
      window.scrollTo(0, scrollY)
      // iOS/WebKit po vypnutí position:fixed na body někdy špatně
      // přepočítá pozici OSTATNÍCH fixed prvků (typicky spodní
      // navigační lišta appky nainstalované na plochu) -- lišta zůstane
      // posunutá o kousek výš, než je skutečný spodek obrazovky, a pod
      // ní vykoukne podkladová barva stránky.
      //
      // Syntetický "resize" event ani poškubnutí scrollem/meta-viewport
      // appka zkoušela dřív -- na živém testu se ukázalo, že Safari si
      // jich nevšímá. Jediné, co bug spolehlivě opravilo, byl přechod
      // na jinou záložku a zpět -- to totiž mění CSS třídy na .layout
      // (appka přepíná "no-map" <-> plovoucí layout Mapy), tedy
      // SKUTEČNOU změnu DOM, ne jen oznámený event. Appka tenhle
      // mechanismus napodobí přímo na liště: krátce ji vyřadí z
      // vykreslení (display:none), počká na skutečný vykreslovací
      // snímek prohlížeče, a pak ji vrátí zpět -- to WebKit donutí
      // přepočítat její fixed pozici úplně od začátku, stejně jako to
      // udělá přechod mezi záložkami.
      const bar = document.querySelector('.bottom-tab-bar')
      if (bar) {
        const prevDisplay = bar.style.display
        bar.style.display = 'none'
        requestAnimationFrame(() => {
          bar.style.display = prevDisplay
        })
      }
      window.dispatchEvent(new Event('resize'))
    }
  }, [])
}
