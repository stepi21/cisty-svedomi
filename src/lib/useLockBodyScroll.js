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
      // ní vykoukne podkladová barva stránky. Syntetický "resize" event
      // appka zkoušela dřív, ale WebKit ho v tomhle případě ne vždy
      // bere v potaz. Spolehlivější je krátké poškubnutí scrollem (o
      // 1px a zpět) -- to WebKit donutí přepočítat pozici fixed prvků
      // vůči aktuálnímu viewportu, protože jde o skutečnou změnu
      // scrollování, ne jen o oznámený event.
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY + 1)
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY)
          window.dispatchEvent(new Event('resize'))
        })
      })
      // Scroll appka umí poškubnout jen tam, kde je vůbec čím -- na
      // krátkých stránkách (např. záložka Mapa s min-height:100dvh) se
      // stránka nedá scrollovat vůbec, takže výše by nemělo co
      // pohnout. Jako spolehlivější náhradu appka krátce přepíše obsah
      // <meta name="viewport"> a hned zpátky -- WebKit na tenhle
      // konkrétní podnět reaguje přepočítáním CELÉHO viewportu (včetně
      // pozice fixed prvků jako spodní lišta), bez ohledu na to, jestli
      // appka má co scrollovat.
      const viewportMeta = document.querySelector('meta[name="viewport"]')
      if (viewportMeta) {
        const original = viewportMeta.getAttribute('content')
        viewportMeta.setAttribute('content', original + ', shrink-to-fit=yes')
        requestAnimationFrame(() => viewportMeta.setAttribute('content', original))
      }
    }
  }, [])
}
