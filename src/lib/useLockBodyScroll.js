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
    }
  }, [])
}
