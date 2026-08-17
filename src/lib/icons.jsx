// Sdílené ikony appky — organický "razítkový" styl (plná silueta, mírně
// nepravidelná křivka), ne generická čárová knihovna. Úlovek přebírá přesně
// tu samou rybku, kterou appka už kreslí na úlovkovém lístku (fishSVG),
// jen zabalenou jako komponenta pro použití v menší velikosti.
//
// Každá ikona bere `color` (hlavní barva) -- appka je používá s `currentColor`
// všude, kde stačí zdědit barvu textu/tlačítka, a s konkrétní barvou tam, kde
// je potřeba jiná barva než okolní text (typicky na tmavé hlavičce).

export function IconVyprava({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.2 21.4c-.9.6-1.7-.4-1-1.2C6.6 16.6 11 12 14.7 8c1-1 1.6-2.2 2.6-3.1.6-.6 1.6.2 1.2 1-1.1 2.2-2.7 4-4.3 5.8-3.4 3.7-6.1 7-9 9.7Z" fill={color} />
      <ellipse cx="6.6" cy="18.6" rx="1.7" ry="1.3" fill="none" stroke={color} strokeWidth="1.2" transform="rotate(-30 6.6 18.6)" />
      <path d="M3 20.8c1.6-1 3.3-.9 4.6.4s3 1.4 4.6.3" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}

export function IconRevir({ size = 20, color = 'currentColor', dotColor = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c3.6.1 6.7 2.9 6.9 6.6.2 3.6-2.6 7.4-4.9 10.4-.6.8-1 1.6-1.9 2-1.1.5-1.7-.7-2.3-1.5-2.4-3.1-5.4-6.9-5-10.7C5.2 5.1 8.3 2.4 12 2.2Z" fill={color} />
      <circle cx="12.4" cy="9.3" r="2" fill={dotColor} />
    </svg>
  )
}

export function IconNastraha({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.8 12.6c.4-3.8 3.6-6.9 7.7-7.1 3.4-.2 6.6 1.5 7.7 3.6-1 2.8-3.7 5.2-7.4 6-4 .9-7.6-.7-8-2.5Z" fill={color} />
      <path d="M17.3 8.4c1.1-1.2 2.6-1.9 3.9-3" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Stejná silueta jako appka dnes používá na úlovkovém lístku (fishSVG),
// jen jako komponenta -- žádná změna tvaru, jen sjednocené použití.
export function IconUlovek({ size = 20, color = 'currentColor', eyeColor = '#fff' }) {
  const h = Math.round((size * 34) / 64)
  return (
    <svg width={size} height={h} viewBox="0 0 64 34" aria-hidden="true">
      <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill={color} />
      <path d="M4,17 L-6,8 L-6,26 Z" fill={color} />
      <circle cx="46" cy="14" r="2.3" fill={eyeColor} />
    </svg>
  )
}

// Zůstává neutrální, nebarevné, i na bílé ploše (viz rozklikávací menu) --
// jemný vlnitý tah místo dokonale rovných čar, ať patří ke stejné rodině.
export function IconMenu({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6.3c4-.5 12-.5 16 .1" />
      <path d="M4 12.1c5 .4 11 .4 16-.1" />
      <path d="M4 17.8c4 .4 12 .4 16-.2" />
    </svg>
  )
}
