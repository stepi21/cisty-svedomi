// Sdílené ikony appky — organický "razítkový" styl (plná silueta, mírně
// nepravidelná křivka), ne generická čárová knihovna. Úlovek přebírá přesně
// tu samou rybku, kterou appka už kreslí na úlovkovém lístku (fishSVG),
// jen zabalenou jako komponenta pro použití v menší velikosti.
//
// Každá ikona bere `color` (hlavní barva) -- appka je používá s `currentColor`
// všude, kde stačí zdědit barvu textu/tlačítka, a s konkrétní barvou tam, kde
// je potřeba jiná barva než okolní text (typicky na tmavé hlavičce).

import { useId } from 'react'

export function IconVyprava({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.1 22.5C4.4 23 3.6 22 4.2 21.3 8.5 16.1 13 10.7 17.6 5.3c.5-.6 1-1.3 1.6-1.9.6-.6 1.7.3 1.2 1-.6.8-1.2 1.5-1.8 2.2C14 12.6 9.5 17.9 5.9 22.4c-.2.2-.5.3-.8.1Z" fill={color} />
      <circle cx="5.6" cy="20.3" r="2.1" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M17.5 5.2c1.5 2.7 1.7 5.9.6 9.2" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".7" />
      <circle cx="18.6" cy="15.5" r="1.2" fill={color} opacity=".7" />
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

// ---------- ☰ menu položky ----------
export function IconGallery({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5c2-1 5-1.4 8-1 3.3.4 6.4 1.6 8 3.2v11c-2-1.4-5-2.3-8-2.6-3-.3-6 .1-8 1V5.5Z" fill={color} />
      <circle cx="9" cy="9.5" r="1.3" fill="#fff" />
    </svg>
  )
}

export function IconTrophy({ size = 20, color = 'currentColor', color2 = 'var(--amber-deep)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10v5c0 3.4-2 6-5 6.6-3-.6-5-3.2-5-6.6v-5Z" fill={color} />
      <path d="M9.5 15.5h5l.6 4.5h-6.2l.6-4.5Z" fill={color2} />
      <path d="M5.5 5.5c-1.5.2-2.5 1.4-2 3s2 2.4 3.5 2" stroke={color2} strokeWidth="1.3" fill="none" />
      <path d="M18.5 5.5c1.5.2 2.5 1.4 2 3s-2 2.4-3.5 2" stroke={color2} strokeWidth="1.3" fill="none" />
    </svg>
  )
}

export function IconChart({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="13" width="3.2" height="7" rx="1" fill={color} />
      <rect x="10.4" y="8" width="3.2" height="12" rx="1" fill={color} />
      <rect x="16.8" y="4" width="3.2" height="16" rx="1" fill={color} />
    </svg>
  )
}

export function IconDownload({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M7.5 11 12 15.5 16.5 11" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function IconHelp({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.3c.3-1.6 1.7-2.3 3-2 1.1.2 2 1.1 1.9 2.2-.1 1.3-1.4 1.7-2.1 2.6-.4.5-.4 1.1-.4 1.4" />
      <circle cx="12" cy="16.3" r=".4" fill={color} />
    </svg>
  )
}

export function IconSettings({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

// ---------- běžné akce ----------
export function IconEdit({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 4.5l3.8 3.8-9.6 9.6-4.6.8.8-4.6 9.6-9.6Z" fill={color} />
      <path d="M13 6l3.8 3.8" stroke="#fff" strokeWidth="1" opacity=".5" />
    </svg>
  )
}

export function IconTrash({ size = 20, color = '#B4432E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5.5c0-.6.4-1 1-1h4c.6 0 1 .4 1 1V7" />
      <path d="M6.5 7l1 12.5c.05.6.55 1 1.15 1h6.7c.6 0 1.1-.4 1.15-1L17.5 7" />
    </svg>
  )
}

export function IconCamera({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8c0-1 .8-1.8 1.8-1.8h1.4l.9-1.4c.2-.3.5-.5.9-.5h6c.4 0 .7.2.9.5l.9 1.4h1.4C19 6.2 19.8 7 19.8 8v9c0 1-.8 1.8-1.8 1.8H5.8C4.8 18.8 4 18 4 17V8Z" fill={color} />
      <circle cx="12" cy="12.5" r="3.2" fill="#fff" />
    </svg>
  )
}

// ---------- výprava / podmínky úlovku ----------
export function IconCalendar({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6c0-1 .8-1.5 1.8-1.5h10.4C18.2 4.5 19 5 19 6v12c0 1-.8 1.5-1.8 1.5H6.8C5.8 19.5 5 19 5 18V6Z" fill={color} />
      <path d="M5 9h14" stroke="#fff" strokeWidth="1" opacity=".6" />
      <circle cx="12" cy="14" r="1.6" fill="var(--amber)" />
    </svg>
  )
}

export function IconDuplicate({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="12" height="14" rx="1.5" fill="var(--paper-line)" />
      <rect x="8" y="4" width="12" height="14" rx="1.5" fill={color} />
      <path d="M11.5 8v6M14.5 11h-6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
    </svg>
  )
}

export function IconTarget({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
    </svg>
  )
}

export function IconThermometer({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" aria-hidden="true">
      <path d="M11 4a1.6 1.6 0 0 1 3.2 0v9.3a3.6 3.6 0 1 1-3.2 0V4Z" />
      <circle cx="12.6" cy="16.5" r="2" fill={color} stroke="none" />
      <path d="M12.6 6v8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function IconGauge({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l3.5-3" />
      <circle cx="12" cy="13" r="1.2" fill={color} stroke="none" />
      <path d="M9 4.5h6" strokeWidth="1.3" />
    </svg>
  )
}

export function IconDroplet({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c2.5 4 5.5 8 5.5 11.5a5.5 5.5 0 1 1-11 0C6.5 11 9.5 7 12 3Z" fill={color} />
    </svg>
  )
}

export function IconWind({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8h11a2.5 2.5 0 1 0-2-4" />
      <path d="M3 12h15a2.5 2.5 0 1 1-2 4" />
      <path d="M3 16h8" />
    </svg>
  )
}

// ---------- ostatní symboly ----------
export function IconCheck({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

export function IconClose({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconArrowLeft({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function IconSearch({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  )
}

export function IconMapEdit({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6l6-2 4 1.5 6-2v14l-6 2-4-1.5-6 2V6Z" fill={color} />
      <path d="M10 4v14M14 5.5V19" stroke="#fff" strokeWidth="1" opacity=".5" />
    </svg>
  )
}

// Malá loďka -- pro velké/úsekové revíry (chytání z lodi na delší trase),
// aby šly v seznamu katalogu na první pohled odlišit od běžných malých míst.
export function IconBoat({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14.5h16l-2.2 4.3c-.2.4-.6.7-1 .7H7.2c-.4 0-.8-.3-1-.7L4 14.5Z" fill={color} />
      <path d="M8 14.5V8.8c0-.4.3-.7.7-.6l6.6 1.8c.5.1.6.7.2 1L11 14.5" fill="none" stroke={color} strokeWidth="1.3" />
      <path d="M2.5 17.3c1.6-1 3.2-.9 4.5.3s2.9 1.3 4.4.3 2.9-1 4.4-.1 2.9 1.2 4.4.2" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}

// "Podle břehu (auto)" -- appka sama dopočítá tvar podle skutečné vodní
// plochy (Overpass/OSM), na rozdíl od ručního klikání (IconMapEdit). Vlnky
// + jiskřička jako vizuální náznak "appka to dopočítá sama".
export function IconRiverAuto({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 15c1.8-1.1 3.6-1.1 5.4 0s3.6 1.1 5.4 0 3.6-1.1 5.4 0" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M3 19c1.8-1.1 3.6-1.1 5.4 0s3.6 1.1 5.4 0 3.6-1.1 5.4 0" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".5" />
      <path d="M17 3.2l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z" fill={color} />
    </svg>
  )
}

export function IconBookmark({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10v17l-5-4-5 4V3Z" fill={color} />
    </svg>
  )
}

export function IconLive({ size = 20, color = '#B4432E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="1.4" opacity=".5" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="1.4" opacity=".75" />
      <circle cx="12" cy="12" r="2.6" fill={color} />
    </svg>
  )
}

export function IconZoom({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
      <path d="M10.5 8v5M8 10.5h5" />
    </svg>
  )
}

export function IconRefresh({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7" />
      <path d="M17 3v4h-4M7 21v-4h4" />
    </svg>
  )
}

export function IconTrend({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17l4-5 3 3 4-7 5 4" />
      <path d="M4 20h16" />
    </svg>
  )
}

export function IconOffline({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8a15 15 0 0 1 18 0M6.5 12a10 10 0 0 1 11 0M10 16a5 5 0 0 1 4 0" />
      <circle cx="12" cy="19.5" r="1.2" fill={color} stroke="none" />
      <path d="M3 3l18 18" stroke="#B4432E" strokeWidth="2" />
    </svg>
  )
}

// ---------- tlačítka na mapě ----------
export function IconPlay({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill={color} />
    </svg>
  )
}

export function IconLocate({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2.3" fill={color} stroke="none" />
    </svg>
  )
}

// Trend tlaku -- roste/klesá/stabilní, barva nese hlavní informaci
// (zelená/červená/šedá), stejně jako appka měla už dřív s emoji šipkami.
export function IconPressureTrend({ trend, size = 14 }) {
  if (trend > 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2E7D46" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 16l6-7 4 4 5-6" />
        <path d="M15 7h5v5" />
      </svg>
    )
  }
  if (trend < 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#B4432E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 8l6 7 4-4 5 6" />
        <path d="M15 17h5v-5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 12h16" />
    </svg>
  )
}

// "⬆️ Nejnovější" -- stejný organický rukopis jako zbytek sady (mírně
// nepravidelný tvar, ne dokonalá geometrie), místo obyčejné šipky nahoru.
export function IconNewest({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c.4 0 .8.2 1 .5l6.5 8.3c.5.6 0 1.5-.8 1.5h-3.7v7.2c0 .7-.6 1.3-1.3 1.3h-3.4c-.7 0-1.3-.6-1.3-1.3v-7.2H5.3c-.8 0-1.3-.9-.8-1.5L11 3c.2-.3.6-.5 1-.5Z" fill={color} />
    </svg>
  )
}

// ---------- fáze měsíce (8 fází, skutečný tvar, ne pořád stejný symbol) ----------
// Technika: dva stejně velké kruhy přes sebe (osvětlený + "stínový" ve
// barvě pozadí), oříznuté do kruhu -- offset stínu určuje, kolik měsíce
// zbyde vidět. Jména odpovídají přesně tomu, co appka počítá v moonPhaseName().
const MOON_OFFSETS = {
  'Nov': 0,
  'Dorůstající srpek': 4,
  'První čtvrť': 8,
  'Dorůstající měsíc': 12,
  'Úplněk': 16,
  'Couvající měsíc': -12,
  'Poslední čtvrť': -8,
  'Couvající srpek': -4,
}

export function IconMoonPhase({ phase, size = 16, litColor = 'var(--amber)', shadowColor = 'var(--paper)', ringColor = 'var(--ink-soft)' }) {
  const reactId = useId()
  const dx = MOON_OFFSETS[phase] ?? 16
  if (dx === 16) {
    // úplněk (nebo neznámá fáze) -- žádný stín, netřeba clipPath
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill={litColor} />
        <circle cx="12" cy="12" r="8" fill="none" stroke={ringColor} strokeWidth="1.2" />
      </svg>
    )
  }
  const clipId = `moonclip-${reactId}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs><clipPath id={clipId}><circle cx="12" cy="12" r="8" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="12" cy="12" r="8" fill={litColor} />
        <circle cx={12 + dx} cy="12" r="8" fill={shadowColor} />
      </g>
      <circle cx="12" cy="12" r="8" fill="none" stroke={ringColor} strokeWidth="1.2" />
    </svg>
  )
}

// Zvoneček -- notifikace (nová výprava/úlovek kamaráda, upravený revír).
// Stejný organický styl jako zbytek sady, ne generická čárová ikona.
export function IconBell({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.4c-.6 0-1 .5-1 1.1v.6C7.9 4.7 6.1 7.2 6.1 10.2v3.7c0 1.4-.6 2.6-1.6 3.6-.7.6-.3 1.7.6 1.7h13.8c.9 0 1.3-1.1.6-1.7-1-.9-1.6-2.2-1.6-3.6v-3.7c0-3-1.8-5.5-4.9-6.1v-.6c0-.6-.4-1.1-1-1.1Z" fill={color} />
      <path d="M9.6 20c.3 1 1.2 1.7 2.4 1.7s2.1-.7 2.4-1.7" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Domeček -- návrat na domovskou stránku (feed úlovků). Mírně nepravidelný
// tvar střechy, ne dokonalý geometrický trojúhelník -- stejný "ručně
// kreslený" duch jako zbytek sady.
export function IconHome({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6 21.3 10.2c.5.4.2 1.2-.4 1.2h-1.4v8.4c0 .5-.4 1-1 1h-4.3v-6.1h-4.4v6.1H5.6c-.6 0-1-.5-1-1v-8.4H3.2c-.6 0-.9-.8-.4-1.2Z" fill={color} />
    </svg>
  )
}

// Mapa -- ne dokonalý geometrický čtverec, mírně "poskládaná" jako
// papírová mapa se záhybem uprostřed, stejný ručně kreslený duch.
export function IconMap({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4 3.6 5.9c-.4.1-.6.5-.6.9v11.7c0 .6.6 1 1.1.8L9 17.5l6 2 5.4-1.9c.4-.1.6-.5.6-.9V5c0-.6-.6-1-1.1-.8L15 6.2 9 4Z" fill={color} opacity=".9" />
      <path d="M9 4v13.5M15 6.2v13.3" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
    </svg>
  )
}
