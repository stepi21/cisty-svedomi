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
      // Appka na Mapě (a jiném "plovoucím" layoutu) vynucuje na .app
      // pevné min-height:100dvh (viz styles.css), ať appka na krátkém
      // obsahu (prázdná mapa) pořád sahá přesně na doraz obrazovky.
      // Přesně tahle hodnota se po přepnutí <body> na position:fixed a
      // zpět na WebKitu (Safari/Android) občas "zatuchne" -- prohlížeč
      // použije starou velikost viewportu, dokud ho něco nedonutí
      // přepočítat. Projevuje se to jako kousek podkladové barvy navíc
      // pod spodní lištou. Na Domů/Úlovcích appka žádné takové vynucené
      // min-height nemá (obsah jen přirozeně scrolluje), takže se tam
      // stejná neshoda ztratí v běžném scrollu -- appka to tam dřív
      // považovala za "vyřešené", ve skutečnosti šlo jen o to, že to
      // nešlo vidět.
      //
      // Oprava: appka na okamžik zruší inline min-height na .app a hned
      // ho vrátí zpátky na prázdnou hodnotu -- to donutí WebKit
      // přepočítat CSS pravidlo (100dvh) úplně od začátku, s aktuálním
      // (už odemčeným) viewportem, místo aby appka jela se starou
      // zapamatovanou hodnotou.
      const appEl = document.querySelector('.app')
      if (appEl) {
        appEl.style.minHeight = '0px'
        void appEl.offsetHeight // vynutit synchronní přepočet layoutu
        appEl.style.minHeight = ''
      }
    }
  }, [])
}
