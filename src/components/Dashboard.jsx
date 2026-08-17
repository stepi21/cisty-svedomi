import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from '../supabaseClient'
import CatchTicket from './CatchTicket.jsx'
import HelpModal from './HelpModal.jsx'
import GalleryModal from './GalleryModal.jsx'
import BaitsModal, { computeBaitsList } from './BaitsModal.jsx'
import { IconVyprava, IconRevir, IconNastraha, IconUlovek, IconMenu } from '../lib/icons.jsx'
import BaitPicker from './BaitPicker.jsx'
import LocationsModal from './LocationsModal.jsx'
import { fetchWeather, moonPhaseName } from '../lib/weather.js'
import { fetchWaterConditions, fetchLiveConditions, findNearestStations, WATER_PRECISION_LABEL, SPA_LEVEL_INFO } from '../lib/hydrology.js'
import { uploadPhoto } from '../lib/storage.js'

const iconCarp = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 12c0-4 5-7 10-7s8 3 8 7-3 7-8 7-10-3-10-7Z" stroke="#2C6E71" stroke-width="1.6"/><circle cx="16" cy="10.5" r="1" fill="#2C6E71"/></svg>`
const iconSpin = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 20 L18 6" stroke="#6B7A4F" stroke-width="1.8"/><circle cx="4" cy="20" r="2" stroke="#6B7A4F" stroke-width="1.6"/><path d="M18 6 l3 -1 -1 3" stroke="#6B7A4F" stroke-width="1.6"/></svg>`
const fishSVG = (color) => `
  <svg viewBox="0 0 64 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,17 C4,8 18,3 32,3 C46,3 58,9 60,17 C58,25 46,31 32,31 C18,31 4,26 4,17 Z" fill="${color}"/>
    <path d="M4,17 L-6,8 L-6,26 Z" fill="${color}"/>
    <circle cx="46" cy="14" r="2.3" fill="#1a1a1a"/>
  </svg>`
const rodColors = ['#2C6E71', '#B97F35', '#6B7A4F', '#D9A054']
const USER_PALETTE = [
  '#2C6E71', '#B4432E', '#6B7A4F', '#8A4B6B', '#3F6B9E', '#C9A227', '#4B7A2E', '#7A3F5E',
  '#2E8B8B', '#D1622F', '#5C4B8A', '#8A2E3E', '#3E8E5A', '#9C4F96', '#4A6B8A', '#A65A2E',
]
const CATEGORY_COLOR = { dravec: '#5C7A85', bila: '#C4A572' }
const SESSION_TYPES = [
  { value: 'kapr', label: 'Kapři (bod)' },
  { value: 'privlac', label: 'Přívlač (oblast)' },
  { value: 'muska', label: 'Muška (bod)' },
  { value: 'plavana', label: 'Plavaná (bod)' },
  { value: 'jine', label: 'Jiné (bod)' },
]
const AREA_TYPES = ['privlac'] // typy, kde se místo bodu kreslí oblast
const TYPE_CATEGORY = { kapr: 'bila', privlac: 'dravec', muska: 'dravec', plavana: 'bila', jine: null }

// --- sloučení názvu/revíru víc katalogových míst do jednoho popisku výpravy ---
// Stejná "voda" (část názvu před " - ") se sloučí do jednoho: "Labe - Vaflák, soutok".
// Různá voda se vypíše zvlášť: "Labe - soutok, Jizera - Otradovice".
function mergeLocationNames(locations) {
  const groups = []
  locations.forEach((loc) => {
    const name = (loc.name || '').trim()
    const dashIdx = name.indexOf(' - ')
    const prefix = dashIdx === -1 ? null : name.slice(0, dashIdx)
    const suffix = dashIdx === -1 ? name : name.slice(dashIdx + 3)
    const existing = prefix ? groups.find((g) => g.prefix === prefix) : null
    if (existing) {
      if (!existing.suffixes.includes(suffix)) existing.suffixes.push(suffix)
    } else {
      groups.push({ prefix, suffixes: [suffix] })
    }
  })
  return groups.map((g) => (g.prefix ? `${g.prefix} - ${g.suffixes.join(', ')}` : g.suffixes[0])).join(', ')
}

// Revíry unikátně, v pořadí prvního výskytu podle výběru.
function mergeLocationRevirs(locations) {
  const seen = []
  locations.forEach((loc) => { if (loc.revir && !seen.includes(loc.revir)) seen.push(loc.revir) })
  return seen.join(', ') || null
}

// Pokud má výprava/úlovek navázané právě jedno katalogové místo a to místo má
// ručně potvrzenou/přiřazenou stanici ČHMÚ, použije se ta -- appka pak
// NEPŘEPOČÍTÁVÁ nejbližší stanici znovu podle souřadnic (to by přepsalo
// ruční opravu v katalogu).
// Hledání appky ignoruje diakritiku i velikost písmen ("dousa" najde "Douša").
function normalizeSearchText(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function resolveHydroStation(linkedLocationIds, locationsCatalog) {
  if (!linkedLocationIds || linkedLocationIds.length !== 1) return null
  const loc = locationsCatalog.find((l) => l.id === linkedLocationIds[0])
  if (!loc?.hydro_station_id) return null
  return { objID: loc.hydro_station_id, name: loc.hydro_station_name, stream: loc.hydro_stream_name }
}

// Stejné jako výše, ale vrací VŠECHNY odlišné potvrzené stanice napříč
// navázanými místy (bez duplicit) -- pro výpravu složenou z víc míst, kde
// každé může mít svou vlastní stanici (jiný revír, jiná řeka).
function resolveHydroStations(linkedLocationIds, locationsCatalog) {
  if (!linkedLocationIds?.length) return []
  const seen = new Map()
  linkedLocationIds.forEach((id) => {
    const loc = locationsCatalog.find((l) => l.id === id)
    if (loc?.hydro_station_id && !seen.has(loc.hydro_station_id)) {
      seen.set(loc.hydro_station_id, { objID: loc.hydro_station_id, name: loc.hydro_station_name, stream: loc.hydro_stream_name })
    }
  })
  return Array.from(seen.values())
}

export default function Dashboard({ groupId, userId, profile, onSignOut }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const activeIdRef = useRef(null)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeUserFilter, setActiveUserFilter] = useState('all')
  const [members, setMembers] = useState([])
  const [viewMode, setViewMode] = useState('aggregate') // 'aggregate' | 'detail'
  const [myProfile, setMyProfile] = useState(profile)
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showRecords, setShowRecords] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [showBaits, setShowBaits] = useState(false)
  const [showLocations, setShowLocations] = useState(false)
  const [baitsInitialKey, setBaitsInitialKey] = useState(null)
  const [locationsReturnId, setLocationsReturnId] = useState(null)
  const [baitCatalog, setBaitCatalog] = useState([])
  const [locationsCatalog, setLocationsCatalog] = useState([])
  const [savingLocationFor, setSavingLocationFor] = useState(null) // {title, revir, area, lat, lng} — normalizovaný zdroj pro uložení do katalogu
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ticketCatch, setTicketCatch] = useState(null)
  const pendingTicketCatchIdRef = useRef(null)
  const [inviteInfo, setInviteInfo] = useState(null)

  // --- flow state pro vytváření nové výpravy ---
  const [pickingType, setPickingType] = useState(false)         // ukazuje mini panel "jaký typ?"
  const [locationPickerStep, setLocationPickerStep] = useState(null) // null | 'choose' | 'catalog' | 'attach'
  const [pickingCatalogIds, setPickingCatalogIds] = useState([])
  const [locationActionMenuFor, setLocationActionMenuFor] = useState(null) // uložená výprava, pro kterou se ukazuje menu 📍 Místo
  const [attachingLocationsSessionId, setAttachingLocationsSessionId] = useState(null) // id výpravy, které se dodatečně mění navázaná místa
  const [areaDraft, setAreaDraft] = useState(null)               // {areas:[], current:[]} během kreslení oblasti
  const [rodPointsDraft, setRodPointsDraft] = useState(null)     // [{lat,lng}, ...] během sbírání pozic prutů (bodové typy)
  const [placementTarget, setPlacementTarget] = useState(null)   // 'session-point' | 'area-point' | 'rod-<i>' | 'catch-point'
  const [draftSession, setDraftSession] = useState(null)         // otevřený formulář nové výpravy
  const [draftCatch, setDraftCatch] = useState(null)             // otevřený formulář nového úlovku
  const [catchChoosing, setCatchChoosing] = useState(false)      // mini panel "na jaké pozici?"
  const [editingRodId, setEditingRodId] = useState(null)         // id prutu, co se právě edituje inline
  const [editingSession, setEditingSession] = useState(null)     // rozepsaná editace výpravy (datum, počasí...)
  const [editingAreasSession, setEditingAreasSession] = useState(null) // {id, areas:[]} — správa oblastí u uložené výpravy
  const [editingAreasLocation, setEditingAreasLocation] = useState(null) // {id, areas:[]} — správa oblastí u místa v katalogu
  const [activePanel, setActivePanel] = useState(null) // null | 'locations' | 'baits' | 'catches' — jen jeden panel může být aktivní najednou
  const [baitsStartAdding, setBaitsStartAdding] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false) // "☰ Více" — méně časté akce schované z hlavičky
  const moreMenuRef = useRef(null)
  useEffect(() => {
    if (!showMoreMenu) return
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setShowMoreMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMoreMenu])
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [toast, setToast] = useState(null) // krátké potvrzení "✓ Uloženo" po akci
  const [searchQuery, setSearchQuery] = useState('') // hledání ve výpravách (název, revír, druh, nástraha)

  useEffect(() => {
    function goOnline() { setIsOnline(true) }
    function goOffline() { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  const placementTargetRef = useRef(null)
  useEffect(() => { placementTargetRef.current = placementTarget }, [placementTarget])

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersLayer = useRef(null)
  const draftLayer = useRef(null)

  useEffect(() => { loadSessions(); loadMembers(); loadBaitCatalog(); loadLocationsCatalog() }, [groupId])

  async function loadBaitCatalog() {
    const { data } = await supabase
      .from('baits')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    if (data) setBaitCatalog(data)
  }

  async function loadLocationsCatalog() {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('group_id', groupId)
      .order('name')
    if (data) {
      setLocationsCatalog(data)
      for (const loc of data) {
        if (loc.area && (loc.lat == null || loc.lng == null)) {
          const c = areaCentroid(loc.area.flat())
          await supabase.from('locations').update({ lat: c.lat, lng: c.lng }).eq('id', loc.id)
          loc.lat = c.lat
          loc.lng = c.lng
        }
      }
    }
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, joined_at, profiles(display_name, color)')
      .eq('group_id', groupId)
      .order('joined_at')
    if (data) setMembers(data.map((m) => ({ id: m.user_id, name: m.profiles?.display_name || '?', color: m.profiles?.color || null })))
  }

  function userColor(uid) {
    const m = members.find((mm) => mm.id === uid)
    if (m?.color) return m.color
    const idx = members.findIndex((mm) => mm.id === uid)
    return idx === -1 ? '#5B5F52' : USER_PALETTE[idx % USER_PALETTE.length]
  }
  function userName(uid) {
    return members.find((m) => m.id === uid)?.name || '?'
  }

  // --- obnovení rozepsaného formuláře i toho, kde jsi byl (filtry, otevřená výprava/úlovek) ---
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const savedSession = localStorage.getItem(`draft_session_${groupId}`)
      if (savedSession) setDraftSession(JSON.parse(savedSession))
      const savedCatch = localStorage.getItem(`draft_catch_${groupId}`)
      if (savedCatch) setDraftCatch(JSON.parse(savedCatch))
      const savedNav = localStorage.getItem(`nav_state_${groupId}`)
      if (savedNav) {
        const nav = JSON.parse(savedNav)
        if (nav.activeCategory) setActiveCategory(nav.activeCategory)
        if (nav.activeUserFilter) setActiveUserFilter(nav.activeUserFilter)
        if (nav.activeId) setActiveId(nav.activeId)
        if (nav.viewMode) setViewMode(nav.viewMode)
        if (nav.ticketCatchId) pendingTicketCatchIdRef.current = nav.ticketCatchId
      }
    } catch { /* ignore */ }
  }, [groupId])

  useEffect(() => {
    localStorage.setItem(`nav_state_${groupId}`, JSON.stringify({
      activeCategory, activeUserFilter, activeId, viewMode, ticketCatchId: ticketCatch?.id || null,
    }))
  }, [activeCategory, activeUserFilter, activeId, viewMode, ticketCatch, groupId])

  useEffect(() => {
    if (draftSession) {
      const stripped = { ...draftSession, rods: draftSession.rods.map((r) => ({ ...r, baits: (r.baits || []).map((b) => ({ name: b.name })) })) }
      localStorage.setItem(`draft_session_${groupId}`, JSON.stringify(stripped))
    } else {
      localStorage.removeItem(`draft_session_${groupId}`)
    }
  }, [draftSession, groupId])

  useEffect(() => {
    if (draftCatch) {
      const stripped = { ...draftCatch, photoFile: null }
      localStorage.setItem(`draft_catch_${groupId}`, JSON.stringify(stripped))
    } else {
      localStorage.removeItem(`draft_catch_${groupId}`)
    }
  }, [draftCatch, groupId])

  async function loadSessions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*, rods(*), catches(*), session_locations(location_id)')
      .eq('group_id', groupId)
      .order('session_date', { ascending: false })
    if (!error) {
      setSessions(data)
      if (data.length && !activeIdRef.current) setActiveId(data[0].id)
      if (pendingTicketCatchIdRef.current) {
        const targetId = pendingTicketCatchIdRef.current
        for (const s of data) {
          const found = (s.catches || []).find((c) => c.id === targetId)
          if (found) { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(found); break }
        }
        pendingTicketCatchIdRef.current = null
      }
    }
    setLoading(false)
  }

  const activeSession = sessions.find((s) => s.id === activeId) || null
  const canEdit = activeSession && activeSession.user_id === userId
  const activeSessionRef = useRef(null)
  useEffect(() => { activeSessionRef.current = activeSession }, [activeSession])
  const relocateSessionIdRef = useRef(null)
  const relocateCatchIdRef = useRef(null)
  const pendingMapFocusRef = useRef(null)

  function filteredCatches(session) {
    if (!session) return []
    if (activeCategory === 'all') return session.catches
    return session.catches.filter((c) => c.category === activeCategory)
  }

  // --- init map jednou ---
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const map = L.map(mapRef.current).setView([49.8, 15.5], 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Podklad: OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    markersLayer.current = L.layerGroup().addTo(map)
    draftLayer.current = L.layerGroup().addTo(map)

    map.on('click', (e) => handleMapClick(e.latlng))
    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [])

  function handleMapClick(latlng) {
    const target = placementTargetRef.current
    if (!target) return
    const point = { lat: latlng.lat, lng: latlng.lng }

    if (target === 'session-point') {
      setRodPointsDraft((prev) => [...(prev || []), point])
      return
    }

    if (target === 'area-point' || target === 'relocate-area-point' || target === 'area-point-append') {
      setAreaDraft((prev) => ({ areas: prev?.areas || [], current: [...(prev?.current || []), point] }))
      return
    }

    if (target === 'relocate-session-point') {
      setPlacementTarget(null)
      const sid = relocateSessionIdRef.current
      supabase.from('sessions').update({ lat: point.lat, lng: point.lng }).eq('id', sid).then(({ error }) => {
        if (error) alert(error.message)
        loadSessions()
      })
      return
    }

    if (target === 'relocate-catch') {
      setPlacementTarget(null)
      const cid = relocateCatchIdRef.current
      supabase.from('catches').update({ lat: point.lat, lng: point.lng }).eq('id', cid).then(({ error }) => {
        if (error) alert(error.message)
        loadSessions()
      })
      return
    }

    if (target === 'new-location-point') {
      setPlacementTarget(null)
      setSavingLocationFor({ title: '', revir: '', area: null, lat: point.lat, lng: point.lng })
      return
    }

    if (target === 'catch-point') {
      setPlacementTarget(null)
      const s = activeSessionRef.current
      setDraftCatch({ point, species: '', category: TYPE_CATEGORY[s?.type] || 'dravec', length: '', weight: '', bait: '', rodId: '', time: '', photoFile: null, baitPhotoFile: null, revir: s?.revir || '' })
      return
    }

    if (target.startsWith('rod-')) {
      const idx = Number(target.split('-')[1])
      setDraftSession((prev) => {
        if (!prev) return prev
        const rods = [...prev.rods]
        rods[idx] = { ...rods[idx], lat: point.lat, lng: point.lng }
        return { ...prev, rods }
      })
      setPlacementTarget(null)
      return
    }

    if (target.startsWith('edit-rod-')) {
      const rodId = target.slice('edit-rod-'.length)
      setPlacementTarget(null)
      supabase.from('rods').update({ lat: point.lat, lng: point.lng }).eq('id', rodId).then(({ error }) => {
        if (error) alert(error.message)
        else loadSessions()
      })
      return
    }
  }

  const pendingTypeRef = useRef('kapr')
  const pendingLiveRef = useRef(false)
  const pendingPointModeCatalogRef = useRef(null)

  // --- kreslení preview polygonu(ů) při tvorbě oblasti ---
  useEffect(() => {
    if (!draftLayer.current) return
    draftLayer.current.clearLayers()
    if (!areaDraft) return

    areaDraft.areas.forEach((pts) => {
      L.polygon(pts.map((p) => [p.lat, p.lng]), {
        color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.15,
      }).addTo(draftLayer.current)
    })

    const cur = areaDraft.current
    if (cur.length) {
      const latlngs = cur.map((p) => [p.lat, p.lng])
      if (latlngs.length === 1) {
        L.circleMarker(latlngs[0], { radius: 6, color: '#6B7A4F' }).addTo(draftLayer.current)
      } else {
        L.polyline(latlngs, { color: '#6B7A4F', weight: 3, dashArray: '6 6' }).addTo(draftLayer.current)
        latlngs.forEach((ll) => L.circleMarker(ll, { radius: 5, color: '#6B7A4F', fillOpacity: 1 }).addTo(draftLayer.current))
      }
    }
  }, [areaDraft])

  // --- kreslení náhledu pozic prutů při zakládání bodové výpravy ---
  useEffect(() => {
    if (!draftLayer.current) return
    draftLayer.current.clearLayers()
    if (!rodPointsDraft) return
    rodPointsDraft.forEach((p, i) => {
      const color = rodColors[i % rodColors.length]
      L.circleMarker([p.lat, p.lng], { radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.6 })
        .bindPopup(`Prut ${i + 1}`).addTo(draftLayer.current)
    })
  }, [rodPointsDraft])

  function sessionForCatch(c) {
    return sessions.find((s) => s.id === c.session_id)
  }

  function normalizeAreas(area) {
    if (!area || area.length === 0) return []
    const raw = (area[0] && typeof area[0].lat === 'number') ? [area] : area
    // obranně: vyřaď cokoli, co není platné pole bodů {lat, lng} — appka tak nikdy nespadne na poškozených datech
    return raw
      .filter((pts) => Array.isArray(pts))
      .map((pts) => pts.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number'))
      .filter((pts) => pts.length >= 3)
  }

  // Stejné jako normalizeAreas, ale pro sessions.area, kde si každý polygon
  // navíc pamatuje location_id katalogového místa, ze kterého vznikl (nebo
  // null, pokud je nakreslený ručně). Zvládne i starší data uložená ve
  // starém "plochém" formátu (pole polí bodů bez location_id) — ta se
  // zobrazí jako "Oblast N" dokud výpravu znovu neaktualizuješ/nepřiřadíš
  // z katalogu, kdy se location_id doplní.
  function normalizeSessionAreas(area) {
    if (!area || area.length === 0) return []
    const raw = (area[0] && typeof area[0].lat === 'number') ? [area] : area
    return raw
      .map((entry) => {
        if (entry && !Array.isArray(entry) && Array.isArray(entry.points)) {
          const points = entry.points.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
          if (points.length < 3) return null
          return { location_id: entry.location_id || null, points }
        }
        if (Array.isArray(entry)) {
          const points = entry.filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
          if (points.length < 3) return null
          return { location_id: null, points }
        }
        return null
      })
      .filter(Boolean)
  }

  function areaCentroid(pts) {
    return {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    }
  }

  function focusOnPoint(lat, lng) {
    if (!mapInstance.current || lat == null || lng == null) return
    setMobileSheetOpen(false)
    mapInstance.current.setView([lat, lng], 16)
  }

  function focusOnArea(pts) {
    if (!mapInstance.current || !pts.length) return
    setMobileSheetOpen(false)
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]))
    mapInstance.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
  }

  // Přiblíží dominantní mapu na katalogové místo, ALE zůstává v režimu
  // "📍 Revíry" (na rozdíl od otevření konkrétní výpravy, které režim opouští).
  function focusOnLocation(location) {
    if (!mapInstance.current) return
    setShowLocations(false)
    setLocationsReturnId(null)
    setMobileSheetOpen(false)
    if (location.area) {
      const areas = normalizeAreas(location.area)
      const bounds = areas.flat().map((p) => [p.lat, p.lng])
      if (bounds.length) mapInstance.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
    } else if (location.lat != null && location.lng != null) {
      mapInstance.current.setView([location.lat, location.lng], 16)
    }
  }

  // --- render markerů: agregovaný pohled (podle filtrů, přes všechny výpravy) nebo detail jedné výpravy ---
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return
    markersLayer.current.clearLayers()
    const map = mapInstance.current

    if (activePanel === 'locations') {
      const bounds = []
      locationsCatalog.forEach((loc) => {
        if (loc.area) {
          const areas = normalizeAreas(loc.area)
          areas.forEach((pts) => {
            const polygon = L.polygon(pts.map((p) => [p.lat, p.lng]), {
              color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.18,
            }).bindPopup(`${loc.name}${loc.revir ? ` (${loc.revir})` : ''}`)
            polygon.on('click', () => { setLocationsReturnId(loc.id); setBaitsInitialKey(null); setShowLocations(true) })
            polygon.addTo(markersLayer.current)
            pts.forEach((p) => bounds.push([p.lat, p.lng]))
          })
          // pevně velký puntík uprostřed -- vyšrafovaná plocha se zmenšováním mapy
          // fyzicky zmenšuje (na rozdíl od úlovků), při oddálení bývá skoro neviditelná
          const c = areaCentroid(areas.flat())
          const centroidMarker = L.circleMarker([c.lat, c.lng], {
            radius: 7, color: '#6B7A4F', weight: 2, fillColor: '#EDE9DC', fillOpacity: 1,
          }).bindPopup(`${loc.name}${loc.revir ? ` (${loc.revir})` : ''}`)
          centroidMarker.on('click', () => { setLocationsReturnId(loc.id); setBaitsInitialKey(null); setShowLocations(true) })
          centroidMarker.addTo(markersLayer.current)
        } else if (loc.lat != null && loc.lng != null) {
          const marker = L.circleMarker([loc.lat, loc.lng], {
            radius: 8, color: '#B97F35', weight: 2, fillColor: '#D9A054', fillOpacity: 0.8,
          }).bindPopup(`${loc.name}${loc.revir ? ` (${loc.revir})` : ''}`)
          marker.on('click', () => { setLocationsReturnId(loc.id); setBaitsInitialKey(null); setShowLocations(true) })
          marker.addTo(markersLayer.current)
          bounds.push([loc.lat, loc.lng])
        }
      })
      if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      else map.setView([49.8, 15.5], 8)
      return
    }

    if (viewMode === 'detail' && activeSession) {
      if (pendingMapFocusRef.current && pendingMapFocusRef.current.sessionId === activeSession.id) {
        const f = pendingMapFocusRef.current
        map.setView([f.lat, f.lng], f.zoom || 16)
        pendingMapFocusRef.current = null
      } else {
        map.setView([activeSession.lat, activeSession.lng], 14)
      }

      normalizeSessionAreas(activeSession.area).forEach((entry, ai) => {
        const pts = entry.points
        L.polygon(pts.map((p) => [p.lat, p.lng]), {
          color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.12,
        }).addTo(markersLayer.current)
        const c = areaCentroid(pts)
        const loc = entry.location_id ? locationsCatalog.find((l) => l.id === entry.location_id) : null
        const label = loc ? loc.name : `Oblast ${ai + 1}`
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: 7, color: '#6B7A4F', weight: 2, fillColor: '#EDE9DC', fillOpacity: 1,
        }).bindPopup(loc ? `${label} <br><i>(klikni pro detail v katalogu)</i>` : label)
        marker.addTo(markersLayer.current)
        if (loc) {
          marker.on('click', () => { setLocationsReturnId(loc.id); setShowLocations(true) })
        }
      })

      if (!AREA_TYPES.includes(activeSession.type)) {
        (activeSession.rods || []).forEach((r, i) => {
          const color = rodColors[i % rodColors.length]
          L.circleMarker([r.lat ?? activeSession.lat, r.lng ?? activeSession.lng], {
            radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.5,
          }).bindPopup(`<b>${r.name}</b>`).addTo(markersLayer.current)
        })
      }

      filteredCatches(activeSession).forEach((c) => {
        const fillColor = CATEGORY_COLOR[c.category]
        const ringColor = userColor(activeSession.user_id)
        const html = `<div style="width:32px;height:32px;background:${fillColor};border-radius:50%;display:flex;align-items:center;justify-content:center;border:5px solid ${ringColor};box-shadow:0 2px 6px rgba(0,0,0,.35)">${fishSVG('#fff')}</div>`
        const icon = L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] })
        const marker = L.marker([c.lat ?? activeSession.lat, c.lng ?? activeSession.lng], { icon })
        marker.on('click', () => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c) })
        marker.addTo(markersLayer.current)
      })
      return
    }

    // --- agregovaný pohled ---
    const matches = []
    sessions.forEach((s) => {
      if (activeUserFilter !== 'all' && s.user_id !== activeUserFilter) return
      ;(s.catches || []).forEach((c) => {
        if (activeCategory !== 'all' && c.category !== activeCategory) return
        matches.push({ c, s })
      })
    })

    matches.forEach(({ c, s }) => {
      const fillColor = CATEGORY_COLOR[c.category]
      const ringColor = userColor(s.user_id)
      const html = `<div style="width:28px;height:28px;background:${fillColor};border-radius:50%;display:flex;align-items:center;justify-content:center;border:5px solid ${ringColor};box-shadow:0 2px 6px rgba(0,0,0,.35)">${fishSVG('#fff')}</div>`
      const icon = L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
      const marker = L.marker([c.lat ?? s.lat, c.lng ?? s.lng], { icon })
      marker.on('click', () => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c) })
      marker.addTo(markersLayer.current)
    })

    if (matches.length > 0) {
      const bounds = L.latLngBounds(matches.map(({ c, s }) => [c.lat ?? s.lat, c.lng ?? s.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else {
      map.setView([49.8, 15.5], 8)
    }
  }, [activeSession, activeCategory, activeUserFilter, viewMode, sessions, locationsCatalog, activePanel])

  async function backfillBaitPhoto(baitName, photoUrl) {
    const key = (baitName || '').trim().toLowerCase()
    if (!key || !photoUrl) return { updated: 0, blocked: 0 }
    let updated = 0, blocked = 0
    for (const s of sessions) {
      for (const r of (s.rods || [])) {
        const baits = r.baits || []
        let changed = false
        const newBaits = baits.map((b) => {
          if (b.name && b.name.trim().toLowerCase() === key && !b.photo_url) {
            changed = true
            return { ...b, photo_url: photoUrl }
          }
          return b
        })
        if (changed) {
          const { data, error } = await supabase.from('rods').update({ baits: newBaits }).eq('id', r.id).select()
          if (!error && data && data.length > 0) updated++
          else blocked++
        }
      }
      for (const c of (s.catches || [])) {
        if (c.bait && c.bait.trim().toLowerCase() === key && !c.bait_photo_url) {
          const { data, error } = await supabase.from('catches').update({ bait_photo_url: photoUrl }).eq('id', c.id).select()
          if (!error && data && data.length > 0) updated++
          else blocked++
        }
      }
    }
    await loadSessions()
    return { updated, blocked }
  }

  async function renameBaitEverywhere(oldName, newName) {
    const oldKey = (oldName || '').trim().toLowerCase()
    const newKey = (newName || '').trim().toLowerCase()
    if (!oldKey || !newName || oldKey === newKey) return
    for (const s of sessions) {
      for (const r of (s.rods || [])) {
        const baits = r.baits || []
        let changed = false
        const newBaits = baits.map((b) => {
          if (b.name && b.name.trim().toLowerCase() === oldKey) {
            changed = true
            return { ...b, name: newName }
          }
          return b
        })
        if (changed) {
          const legacyBait = newBaits.map((b) => b.name).filter(Boolean).join(', ') || null
          await supabase.from('rods').update({ baits: newBaits, bait: legacyBait }).eq('id', r.id)
        }
      }
      for (const c of (s.catches || [])) {
        if (c.bait && c.bait.trim().toLowerCase() === oldKey) {
          await supabase.from('catches').update({ bait: newName }).eq('id', c.id)
        }
      }
    }
    await loadSessions()
  }

  async function removeBaitFromMyRods(name) {
    const key = (name || '').trim().toLowerCase()
    if (!key) return
    for (const s of sessions) {
      for (const r of (s.rods || [])) {
        const baits = r.baits || []
        if (!baits.some((b) => b.name && b.name.trim().toLowerCase() === key)) continue
        const newBaits = baits.filter((b) => !(b.name && b.name.trim().toLowerCase() === key))
        const legacyBait = newBaits.map((b) => b.name).filter(Boolean).join(', ') || null
        await supabase.from('rods').update({ baits: newBaits, bait: legacyBait }).eq('id', r.id)
      }
    }
    await loadSessions()
  }

  function startSaveLocation(source) {
    // source může být draftSession (má .point) nebo uložená výprava (má .lat/.lng přímo)
    // sessions.area má u polygonů navíc location_id — katalogové místo to nepotřebuje, bereme jen body
    const area = source.area ? normalizeSessionAreas(source.area).map((entry) => entry.points) : null
    const lat = source.point ? source.point.lat : source.lat
    const lng = source.point ? source.point.lng : source.lng
    setSavingLocationFor({ title: source.title || '', revir: source.revir || '', area, lat, lng })
  }

  function startAddLocationArea() {
    setShowLocations(false)
    startAddAreaPoint((newAreas) => {
      const c = areaCentroid(newAreas.flat())
      setSavingLocationFor({ title: '', revir: '', area: newAreas, lat: c.lat, lng: c.lng })
    })
  }

  function startAddLocationPoint() {
    setShowLocations(false)
    setPlacementTarget('new-location-point')
  }

  async function saveLocationToCatalog(name, revir) {
    const s = savingLocationFor
    const { error } = await supabase.from('locations').insert({
      group_id: groupId, created_by: userId, name, revir: revir || null,
      area: s.area, lat: s.lat, lng: s.lng,
    })
    if (error) { alert(error.message); return }
    setSavingLocationFor(null)
    await loadLocationsCatalog()
  }

  async function updateLocationsCatalogEntry(id, fields) {
    const { error } = await supabase.from('locations').update(fields).eq('id', id)
    if (error) { alert(error.message); return }
    await loadLocationsCatalog()
  }

  async function deleteLocationFromCatalog(id) {
    const { error } = await supabase.from('locations').delete().eq('id', id)
    if (error) { alert(error.message); return }
    await loadLocationsCatalog()
  }

  async function updateSessionFromLocations(session) {
    const linkedIds = (session.session_locations || []).map((sl) => sl.location_id)
    if (linkedIds.length === 0) return
    const linked = locationsCatalog.filter((l) => linkedIds.includes(l.id))
    const areaLocations = linked.filter((l) => l.area)
    const updates = {}
    if (areaLocations.length > 0) {
      const areas = areaLocations.flatMap((l) => normalizeAreas(l.area).map((points) => ({ location_id: l.id, points })))
      updates.area = areas
      const c = areaCentroid(areas.flatMap((a) => a.points))
      updates.lat = c.lat
      updates.lng = c.lng
    } else if (linked[0]) {
      updates.lat = linked[0].lat
      updates.lng = linked[0].lng
    }
    const { error } = await supabase.from('sessions').update(updates).eq('id', session.id)
    if (error) { alert(error.message); return }
    // jednoznačný případ -> refresh revíru i u úlovků (kdyby se revír katalogového místa mezitím změnil)
    if (linked.length === 1) {
      await supabase.from('catches').update({ location_id: linked[0].id, revir: linked[0].revir || null }).eq('session_id', session.id)
    }
    await loadSessions()
  }

  function openLocationMenu(session) {
    setMobileSheetOpen(false)
    const hasLinked = (session.session_locations || []).length > 0
    if (!hasLinked) { startAttachLocationsToSession(session); return }
    setLocationActionMenuFor(session)
  }

  function startAttachLocationsToSession(session) {
    const linkedIds = (session.session_locations || []).map((sl) => sl.location_id)
    setAttachingLocationsSessionId(session.id)
    setPickingCatalogIds(linkedIds)
    setLocationPickerStep('attach')
  }

  async function proceedAttachLocations() {
    const sessionId = attachingLocationsSessionId
    const pickedIds = pickingCatalogIds
    setLocationPickerStep(null)
    setAttachingLocationsSessionId(null)
    setPickingCatalogIds([])
    if (!sessionId) return

    // nahradí navázaná místa přesně tím, co je zaškrtnuté (i odškrtnutí něčeho stávajícího)
    await supabase.from('session_locations').delete().eq('session_id', sessionId)
    if (pickedIds.length > 0) {
      await supabase.from('session_locations').insert(
        pickedIds.map((location_id) => ({ session_id: sessionId, location_id }))
      )
    }

    const picked = locationsCatalog.filter((l) => pickedIds.includes(l.id))
    const updates = {}
    if (picked.length > 0) {
      updates.title = mergeLocationNames(picked)
      updates.revir = mergeLocationRevirs(picked)
      const areaLocations = picked.filter((l) => l.area)
      if (areaLocations.length > 0) {
        const areas = areaLocations.flatMap((l) => normalizeAreas(l.area).map((points) => ({ location_id: l.id, points })))
        updates.area = areas
        const c = areaCentroid(areas.flatMap((a) => a.points))
        updates.lat = c.lat
        updates.lng = c.lng
      } else {
        updates.area = null
        updates.lat = picked[0].lat
        updates.lng = picked[0].lng
      }
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('sessions').update(updates).eq('id', sessionId)
      if (error) { alert(error.message); return }
    }
    // jednoznačný případ (přesně 1 vybrané místo) -> rovnou propsat revír/vazbu do všech úlovků výpravy
    if (picked.length === 1) {
      await supabase.from('catches').update({ location_id: picked[0].id, revir: picked[0].revir || null }).eq('session_id', sessionId)
    }
    await loadSessions()
  }

  async function setCatchLocation(catchId, locationId, revir) {
    const { error } = await supabase.from('catches').update({ location_id: locationId, revir }).eq('id', catchId)
    if (error) { alert(error.message); return }
    setTicketCatch((prev) => (prev && prev.id === catchId ? { ...prev, location_id: locationId, revir } : prev))
    await loadSessions()
  }

  function goToMyLocation() {
    if (!navigator.geolocation) { alert('Tento prohlížeč neumí zjistit pozici.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { mapInstance.current?.setView([pos.coords.latitude, pos.coords.longitude], 16) },
      () => alert('Nepodařilo se zjistit pozici. Zkontroluj, že appka má povolení k lokaci.'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  function duplicateSession(s) {
    const rods = (s.rods || []).map((r) => ({
      name: r.name, lat: r.lat, lng: r.lng,
      baits: (r.baits && r.baits.length
        ? r.baits
        : (r.bait ? [{ name: r.bait, photo_url: r.bait_photo_url }] : [{ name: '' }])
      ).map((b) => ({ name: b.name, photo_url: b.photo_url || null, photoFile: null })),
    }))
    setDraftSession({
      type: s.type, title: s.title, date: '', timeFrom: '', timeTo: '',
      revir: s.revir || '', target_species: s.target_species || '',
      temp: '', pressure: '', wind: '', desc: '',
      point: { lat: s.lat, lng: s.lng }, area: s.area ? normalizeSessionAreas(s.area) : null,
      rods: rods.length ? rods : [{ name: 'Prut 1', lat: s.lat, lng: s.lng, baits: [{ name: '', photoFile: null }] }],
      linkedLocationIds: (s.session_locations || []).map((sl) => sl.location_id),
    })
  }

  function exportData() {
    const payload = sessions.map((s) => ({
      typ: s.type, nazev: s.title, revir: s.revir, cil: s.target_species,
      datum: s.session_date, cas_od: s.time_from, cas_do: s.time_to,
      autor: userName(s.user_id),
      pocasi: { teplota_c: s.weather_temp_c, tlak_hpa: s.weather_pressure_hpa, vitr: s.weather_wind, popis: s.weather_desc },
      pozice: { lat: s.lat, lng: s.lng },
      oblast: s.area || null,
      pruty: (s.rods || []).map((r) => ({
        nazev: r.name, pozice: { lat: r.lat, lng: r.lng },
        nastrahy: (r.baits || []).map((b) => ({ nazev: b.name, foto: b.photo_url })),
      })),
      ulovky: (s.catches || []).map((c) => ({
        druh: c.species, kategorie: c.category, delka_cm: c.length_cm, vaha_kg: c.weight_kg,
        nastraha: c.bait, cas: c.caught_at, revir: c.revir,
        pozice: { lat: c.lat, lng: c.lng }, foto: c.photo_url, foto_nastrahy: c.bait_photo_url,
      })),
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cisty-svedomi-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function createInvite() {
    const { data, error } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, created_by: userId })
      .select()
      .single()
    if (!error) setInviteInfo(data)
  }

  // --- začátek tvorby nové výpravy ---
  function startNewSession() { pendingLiveRef.current = false; setPickingType(true); setMobileSheetOpen(false); setActivePanel(null) }
  function startNewSessionLive() { pendingLiveRef.current = true; setPickingType(true); setMobileSheetOpen(false); setActivePanel(null) }

  async function endLiveSession(session) {
    const now = new Date()
    const timeStr = now.toTimeString().slice(0, 5)
    const { error } = await supabase.from('sessions').update({ time_to: timeStr, status: 'completed' }).eq('id', session.id)
    if (error) { alert(error.message); return }
    await loadSessions()
  }

  function chooseType(type) {
    setPickingType(false)
    pendingTypeRef.current = type
    setLocationPickerStep('choose')
  }

  function startDrawNew() {
    setLocationPickerStep(null)
    pendingPointModeCatalogRef.current = null
    const type = pendingTypeRef.current
    if (AREA_TYPES.includes(type)) {
      setAreaDraft({ areas: [], current: [] })
      setPlacementTarget('area-point')
    } else {
      setRodPointsDraft([])
      setPlacementTarget('session-point')
    }
  }

  function togglePickingCatalogId(id) {
    setPickingCatalogIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function proceedFromCatalogSelection() {
    const type = pendingTypeRef.current
    const picked = locationsCatalog.filter((l) => pickingCatalogIds.includes(l.id))
    setLocationPickerStep(null)
    setPickingCatalogIds([])
    if (picked.length === 0) return

    const revir = mergeLocationRevirs(picked)
    const title = mergeLocationNames(picked)

    if (AREA_TYPES.includes(type)) {
      const areaPicked = picked.filter((l) => l.area)
      if (areaPicked.length === 0) {
        alert('Žádné z vybraných míst nemá uloženou oblast — pro přívlač zvol místo s vyšrafovanou plochou, nebo nakresli novou.')
        return
      }
      const areas = areaPicked.flatMap((l) => normalizeAreas(l.area).map((points) => ({ location_id: l.id, points })))
      const overallCentroid = areaCentroid(areas.flatMap((a) => a.points))
      const firstAreaCentroid = areaCentroid(areas[0].points)
      const live = liveDefaults()
      setDraftSession({
        type, title, date: live.date, timeFrom: live.timeFrom, timeTo: '', revir, target_species: '',
        temp: '', pressure: '', wind: '', desc: '',
        point: overallCentroid, area: areas,
        rods: [{ name: 'Prut 1', lat: firstAreaCentroid.lat, lng: firstAreaCentroid.lng, baits: [{ name: '', photoFile: null }] }],
        live: live.live,
        linkedLocationIds: picked.map((l) => l.id),
      })
    } else {
      const first = picked[0]
      if (first && first.lat != null && first.lng != null) mapInstance.current?.setView([first.lat, first.lng], 15)
      pendingPointModeCatalogRef.current = { revir, title, locationIds: picked.map((l) => l.id) }
      setRodPointsDraft([])
      setPlacementTarget('session-point')
    }
  }

  function undoAreaPoint() {
    setAreaDraft((prev) => ({ ...prev, current: prev.current.slice(0, -1) }))
  }

  function cancelAreaOrPoint() {
    setAreaDraft(null)
    setRodPointsDraft(null)
    setPlacementTarget(null)
    pendingPointModeCatalogRef.current = null
  }

  function undoRodPoint() {
    setRodPointsDraft((prev) => (prev || []).slice(0, -1))
  }

  function finishRodPoints() {
    if (!rodPointsDraft || rodPointsDraft.length === 0) return
    const first = rodPointsDraft[0]
    const rods = rodPointsDraft.map((p, i) => ({ name: `Prut ${i + 1}`, lat: p.lat, lng: p.lng, baits: [{ name: '', photoFile: null }] }))
    setPlacementTarget(null)
    setRodPointsDraft(null)
    const live = liveDefaults()
    const catalogInfo = pendingPointModeCatalogRef.current
    pendingPointModeCatalogRef.current = null
    setDraftSession({
      type: pendingTypeRef.current,
      title: catalogInfo?.title || '', date: live.date, timeFrom: live.timeFrom, timeTo: '',
      revir: catalogInfo?.revir || '', target_species: '',
      temp: '', pressure: '', wind: '', desc: '',
      point: first, area: null,
      rods,
      live: live.live,
      linkedLocationIds: catalogInfo?.locationIds || [],
    })
  }

  function finishCurrentArea() {
    if (areaDraft.current.length < 3) return
    setAreaDraft({ areas: [...areaDraft.areas, areaDraft.current], current: [] })
  }

  function liveDefaults() {
    if (!pendingLiveRef.current) return { live: false, date: '', timeFrom: '' }
    const now = new Date()
    return {
      live: true,
      date: now.toISOString().slice(0, 10),
      timeFrom: now.toTimeString().slice(0, 5),
    }
  }

  function proceedToForm() {
    const rawAreas = areaDraft.current.length >= 3 ? [...areaDraft.areas, areaDraft.current] : areaDraft.areas
    if (rawAreas.length === 0) return
    const areas = rawAreas.map((points) => ({ location_id: null, points }))
    const overallCentroid = areaCentroid(areas.flatMap((a) => a.points))
    const firstAreaCentroid = areaCentroid(areas[0].points)
    setAreaDraft(null)
    setPlacementTarget(null)
    const live = liveDefaults()
    setDraftSession({
      type: pendingTypeRef.current,
      title: '', date: live.date, timeFrom: live.timeFrom, timeTo: '', revir: '', target_species: '',
      temp: '', pressure: '', wind: '', desc: '',
      point: overallCentroid, area: areas,
      rods: [{ name: 'Prut 1', lat: firstAreaCentroid.lat, lng: firstAreaCentroid.lng, baits: [{ name: '', photoFile: null }] }],
      live: live.live,
    })
  }

  // --- obecné "přidej mi jednu nebo víc oblastí" — použitelné jak v rozepsaném formuláři, tak u už uložené výpravy ---
  const pendingAreaAppendRef = useRef(null)

  function startAddAreaPoint(onComplete) {
    pendingAreaAppendRef.current = onComplete
    setAreaDraft({ areas: [], current: [] })
    setPlacementTarget('area-point-append')
  }

  function finishAppendArea() {
    const areas = areaDraft.current.length >= 3 ? [...areaDraft.areas, areaDraft.current] : areaDraft.areas
    if (areas.length === 0) return
    setAreaDraft(null)
    setPlacementTarget(null)
    const cb = pendingAreaAppendRef.current
    pendingAreaAppendRef.current = null
    cb?.(areas)
  }

  function startAddCatch() {
    setCatchChoosing(true)
    setMobileSheetOpen(false)
  }

  function chooseCatchOnRod(rod) {
    setCatchChoosing(false)
    const knownPhoto = rod.bait ? baitPhotoLookup()[rod.bait.trim().toLowerCase()] : null
    setDraftCatch({ point: { lat: rod.lat, lng: rod.lng }, species: '', category: TYPE_CATEGORY[activeSession?.type] || 'dravec', length: '', weight: '', bait: rod.bait || '', rodId: rod.id, time: '', photoFile: null, baitPhotoFile: null, bait_photo_url: knownPhoto || null, revir: activeSession?.revir || '' })
  }

  function chooseCatchOnMap() {
    setCatchChoosing(false)
    setPlacementTarget('catch-point')
  }

  async function saveSession() {
    if (!navigator.onLine) {
      alert('Nejsi připojený k internetu. Zkus to znovu, až se signál vrátí — rozepsaná výprava zůstává vyplněná, nic se neztratilo.')
      return
    }
    const s = draftSession
    try {
      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert({
          group_id: groupId, user_id: userId, type: s.type, title: s.title, revir: s.revir || null, target_species: s.target_species || null,
          session_date: s.date, time_from: s.timeFrom || null, time_to: s.timeTo || null,
          lat: s.point.lat, lng: s.point.lng, area: s.area,
          weather_temp_c: s.temp || null, weather_pressure_hpa: s.pressure || null, weather_pressure_trend: s.pressureTrend ?? null,
          weather_wind: s.wind || null, weather_desc: s.desc || null,
          water_level_cm: s.waterLevel ?? null, water_flow_m3s: s.waterFlow ?? null, water_temp_c: s.waterTemp ?? null,
          water_station_name: s.waterStationName || null, water_data_precision: s.waterPrecision || null, water_spa_level: s.waterSpaLevel ?? null,
          water_stations: s.waterStations || null,
          status: s.live ? 'in_progress' : 'completed',
        }).select().single()
      if (sErr) { alert(sErr.message); return }

      if (s.linkedLocationIds && s.linkedLocationIds.length > 0) {
        await supabase.from('session_locations').insert(
          s.linkedLocationIds.map((location_id) => ({ session_id: session.id, location_id }))
        )
      }

      for (const r of s.rods.filter((r) => r.name)) {
        const baitsPayload = []
        for (const b of (r.baits || [])) {
          if (!b.name && !b.photoFile && !b.photo_url) continue
          let photo_url = b.photo_url || null
          if (b.photoFile) {
            photo_url = await uploadPhoto(b.photoFile, `baits/${session.id}`)
            if (photo_url) backfillBaitPhoto(b.name, photo_url)
          }
          baitsPayload.push({ name: b.name, photo_url })
        }
        await supabase.from('rods').insert({
          session_id: session.id, group_id: groupId, name: r.name,
          bait: baitsPayload.map((b) => b.name).filter(Boolean).join(', ') || null,
          lat: r.lat, lng: r.lng, baits: baitsPayload,
        })
      }

      setDraftSession(null)
      await loadSessions()
      setActiveId(session.id)
      setViewMode('detail')
      showToast('✓ Výprava uložena')
    } catch (err) {
      alert('Uložení se nepovedlo (možná vypadlo připojení). Formulář zůstává vyplněný, zkus to prosím znovu.\n\n' + err.message)
    }
  }

  async function saveCatch() {
    if (!navigator.onLine) {
      alert('Nejsi připojený k internetu. Zkus to znovu, až se signál vrátí — rozepsaný úlovek zůstává vyplněný, nic se neztratilo.')
      return
    }
    const c = draftCatch
    const session = activeSession
    try {
      const caughtAt = c.time && session
        ? new Date(`${session.session_date}T${c.time}:00`).toISOString()
        : null
      let photo_url = null
      if (c.photoFile) {
        photo_url = await uploadPhoto(c.photoFile, `catches/${session.id}`)
      }
      let bait_photo_url = c.bait_photo_url || null
      if (c.baitPhotoFile) {
        bait_photo_url = await uploadPhoto(c.baitPhotoFile, `catches/${session.id}`)
        if (bait_photo_url) backfillBaitPhoto(c.bait, bait_photo_url)
      }
      // jednoznačný případ (výprava má navázané jen jedno katalogové místo) -> rovnou přiřadit i novému úlovku
      const linkedIds = (session.session_locations || []).map((sl) => sl.location_id)
      let location_id = null
      let revir = c.revir || null
      if (linkedIds.length === 1) {
        const loc = locationsCatalog.find((l) => l.id === linkedIds[0])
        if (loc) { location_id = loc.id; revir = loc.revir || null }
      }
      const { error } = await supabase.from('catches').insert({
        session_id: session.id, group_id: groupId, rod_id: c.rodId || null,
        species: c.species, category: c.category, length_cm: c.length || null, weight_kg: c.weight || null,
        bait: c.bait, caught_at: caughtAt, lat: c.point.lat, lng: c.point.lng, photo_url, bait_photo_url,
        location_id, revir,
        weather_temp_c: c.weather_temp_c ?? null, weather_pressure_hpa: c.weather_pressure_hpa ?? null, weather_pressure_trend: c.weather_pressure_trend ?? null,
        weather_wind: c.weather_wind || null, weather_desc: c.weather_desc || null,
        water_level_cm: c.water_level_cm ?? null, water_flow_m3s: c.water_flow_m3s ?? null, water_temp_c: c.water_temp_c ?? null,
        water_station_name: c.water_station_name || null, water_data_precision: c.water_data_precision || null, water_spa_level: c.water_spa_level ?? null,
      })
      if (error) { alert(error.message); return }
      setDraftCatch(null)
      await loadSessions()
      showToast('✓ Úlovek uložen')
    } catch (err) {
      alert('Uložení se nepovedlo (možná vypadlo připojení). Formulář zůstává vyplněný, zkus to prosím znovu.\n\n' + err.message)
    }
  }

  function startEditSession(s) {
    setEditingSession({
      id: s.id, type: s.type, title: s.title, date: s.session_date, revir: s.revir || '', target_species: s.target_species || '',
      timeFrom: s.time_from || '', timeTo: s.time_to || '',
      temp: s.weather_temp_c ?? '', pressure: s.weather_pressure_hpa ?? '', pressureTrend: s.weather_pressure_trend ?? null,
      wind: s.weather_wind || '', desc: s.weather_desc || '',
      waterLevel: s.water_level_cm ?? null, waterFlow: s.water_flow_m3s ?? null, waterTemp: s.water_temp_c ?? null,
      waterStationName: s.water_station_name || null, waterPrecision: s.water_data_precision || null, waterSpaLevel: s.water_spa_level ?? null,
      waterStations: s.water_stations || null,
      linkedLocationIds: (s.session_locations || []).map((sl) => sl.location_id),
      lat: s.lat, lng: s.lng,
    })
  }

  async function saveEditSession() {
    if (!navigator.onLine) {
      alert('Nejsi připojený k internetu. Zkus to znovu, až se signál vrátí — rozepsané úpravy zůstávají vyplněné, nic se neztratilo.')
      return
    }
    const e = editingSession
    try {
      const { error } = await supabase.from('sessions').update({
        title: e.title, session_date: e.date, revir: e.revir || null, target_species: e.target_species || null, time_from: e.timeFrom || null, time_to: e.timeTo || null,
        weather_temp_c: e.temp || null, weather_pressure_hpa: e.pressure || null, weather_pressure_trend: e.pressureTrend ?? null,
        weather_wind: e.wind || null, weather_desc: e.desc || null,
        water_level_cm: e.waterLevel ?? null, water_flow_m3s: e.waterFlow ?? null, water_temp_c: e.waterTemp ?? null,
        water_station_name: e.waterStationName || null, water_data_precision: e.waterPrecision || null, water_spa_level: e.waterSpaLevel ?? null,
        water_stations: e.waterStations || null,
      }).eq('id', e.id)
      if (error) { alert(error.message); return }
      setEditingSession(null)
      await loadSessions()
      showToast('✓ Uloženo')
    } catch (err) {
      alert('Uložení se nepovedlo (možná vypadlo připojení). Zkus to prosím znovu.\n\n' + err.message)
    }
  }

  function monthLabel(dateStr) {
    const d = new Date(dateStr)
    const label = d.toLocaleDateString('cs-CZ', { month: 'long' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  function buildGroups(list) {
    const years = []
    let curYear = null, curMonth = null
    list.forEach((s) => {
      const d = new Date(s.session_date)
      const y = d.getFullYear()
      const monthKey = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!curYear || curYear.year !== y) {
        curYear = { year: y, key: `year:${y}`, months: [] }
        years.push(curYear)
        curMonth = null
      }
      if (!curMonth || curMonth.key !== `month:${monthKey}`) {
        curMonth = { key: `month:${monthKey}`, label: monthLabel(s.session_date), sessions: [] }
        curYear.months.push(curMonth)
      }
      curMonth.sessions.push(s)
    })
    return years
  }

  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const collapseInitRef = useRef(false)
  useEffect(() => {
    if (collapseInitRef.current || sessions.length === 0) return
    collapseInitRef.current = true
    const groups = buildGroups(sessions)
    const allKeys = new Set()
    groups.forEach((y) => { allKeys.add(y.key); y.months.forEach((m) => allKeys.add(m.key)) })
    // nejnovější rok a měsíc necháme rozbalené, zbytek sbalíme
    if (groups.length) {
      allKeys.delete(groups[0].key)
      if (groups[0].months.length) allKeys.delete(groups[0].months[0].key)
    }
    setCollapsedGroups(allKeys)
  }, [sessions])

  // Při aktivním hledání appka dočasně rozbalí úplně vše (ať vidíš všechny
  // výsledky napříč lety/měsíci bez ručního rozklikávání) a po smazání textu
  // se vrátí přesně na to, co bylo rozbalené/sbalené předtím.
  const savedCollapsedGroupsRef = useRef(null)
  useEffect(() => {
    if (searchQuery.trim()) {
      if (savedCollapsedGroupsRef.current === null) savedCollapsedGroupsRef.current = collapsedGroups
      setCollapsedGroups(new Set())
    } else if (savedCollapsedGroupsRef.current !== null) {
      setCollapsedGroups(savedCollapsedGroupsRef.current)
      savedCollapsedGroupsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  function toggleGroup(key) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function expandAll() { setCollapsedGroups(new Set()) }
  function collapseAll() {
    const groups = buildGroups(visibleSessions)
    const allKeys = new Set()
    groups.forEach((y) => { allKeys.add(y.key); y.months.forEach((m) => allKeys.add(m.key)) })
    setCollapsedGroups(allKeys)
  }

  // Přepnutí panelu v hlavičce (Výpravy/Revíry/Nástrahy/Úlovky) -- vždycky
  // vyčistí hledání, ať nezůstane text z jednoho seznamu omylem ve druhém.
  // "null" (Výpravy) není přepínací -- vždycky vede domů, ne toggle sama na sebe.
  function switchPanel(panel) {
    setActivePanel((p) => (panel === null ? null : (p === panel ? null : panel)))
    setSearchQuery('')
    setMobileSheetOpen(true)
  }

  // Rychlý skok zpátky na nejnovější výpravu (appka je řadí sestupně podle data,
  // takže sessions[0] je vždycky ta nejnovější) -- ať se z hlubší historie/
  // statistik/galerie dá rychle vrátit "nahoru", bez ručního hledání roku/měsíce.
  function jumpToNewest() {
    if (sessions.length === 0) return
    const newest = sessions[0]
    setSearchQuery('')
    setActiveCategory('all')
    setActiveUserFilter('all')
    const groups = buildGroups(sessions)
    if (groups.length) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev)
        next.delete(groups[0].key)
        if (groups[0].months.length) next.delete(groups[0].months[0].key)
        return next
      })
    }
    setActiveId(newest.id)
    setViewMode('detail')
    setActivePanel(null)
    setMobileSheetOpen(true)
  }

  function startRelocateCatch(catchId) {
    relocateCatchIdRef.current = catchId
    setTicketCatch(null)
    setMobileSheetOpen(false)
    setPlacementTarget('relocate-catch')
  }

  async function handleRelocateSession() {
    const s = editingSession
    await saveEditSession()
    relocateSessionIdRef.current = s.id
    setMobileSheetOpen(false)
    setPlacementTarget('relocate-session-point')
  }

  function startManageAreas(session) {
    setEditingAreasSession({ id: session.id, areas: normalizeSessionAreas(session.area) })
    setEditingSession(null)
    setMobileSheetOpen(false)
  }

  function removeManagedArea(idx) {
    setEditingAreasSession((prev) => ({ ...prev, areas: prev.areas.filter((_, i) => i !== idx) }))
  }

  function addAreasToManaged(newAreas) {
    setEditingAreasSession((prev) => ({ ...prev, areas: [...prev.areas, ...newAreas.map((points) => ({ location_id: null, points }))] }))
  }

  async function saveManagedAreas() {
    const { id, areas } = editingAreasSession
    const updates = { area: areas.length ? areas : null }
    if (areas.length) {
      const overallCentroid = areaCentroid(areas.flatMap((a) => a.points))
      updates.lat = overallCentroid.lat
      updates.lng = overallCentroid.lng
    }
    await supabase.from('sessions').update(updates).eq('id', id)
    if (areas.length) {
      const firstAreaCentroid = areaCentroid(areas[0].points)
      const { data: rods } = await supabase.from('rods').select('id').eq('session_id', id).order('created_at').limit(1)
      if (rods && rods[0]) {
        await supabase.from('rods').update({ lat: firstAreaCentroid.lat, lng: firstAreaCentroid.lng }).eq('id', rods[0].id)
      }
    }
    setEditingAreasSession(null)
    await loadSessions()
    setActiveId(id)
    setViewMode('detail')
  }

  function startManageLocationAreas(location) {
    const areas = normalizeAreas(location.area)
    setEditingAreasLocation({ id: location.id, areas: areas.map((a) => [...a]) })
    setShowLocations(false)
    const bounds = areas.flat().map((p) => [p.lat, p.lng])
    if (bounds.length) mapInstance.current?.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
  }

  function removeManagedLocationArea(idx) {
    setEditingAreasLocation((prev) => ({ ...prev, areas: prev.areas.filter((_, i) => i !== idx) }))
  }

  function addAreasToManagedLocation(newAreas) {
    setEditingAreasLocation((prev) => ({ ...prev, areas: [...prev.areas, ...newAreas] }))
  }

  async function saveManagedLocationAreas() {
    const { id, areas } = editingAreasLocation
    const updates = { area: areas.length ? areas : null }
    if (areas.length) {
      const c = areaCentroid(areas.flat())
      updates.lat = c.lat
      updates.lng = c.lng
    }
    await supabase.from('locations').update(updates).eq('id', id)
    setEditingAreasLocation(null)
    await loadLocationsCatalog()
    setShowLocations(true)
  }

  function proceedRelocateArea() {
    const rawAreas = areaDraft.current.length >= 3 ? [...areaDraft.areas, areaDraft.current] : areaDraft.areas
    if (rawAreas.length === 0) return
    const areas = rawAreas.map((points) => ({ location_id: null, points }))
    const overallCentroid = areaCentroid(areas.flatMap((a) => a.points))
    const firstAreaCentroid = areaCentroid(areas[0].points)
    const sid = relocateSessionIdRef.current
    setAreaDraft(null)
    setPlacementTarget(null)
    ;(async () => {
      await supabase.from('sessions').update({ area: areas, lat: overallCentroid.lat, lng: overallCentroid.lng }).eq('id', sid)
      const { data: rods } = await supabase.from('rods').select('id').eq('session_id', sid).order('created_at').limit(1)
      if (rods && rods[0]) {
        await supabase.from('rods').update({ lat: firstAreaCentroid.lat, lng: firstAreaCentroid.lng }).eq('id', rods[0].id)
      }
      await loadSessions()
    })()
  }

  async function deleteSession() {
    if (!window.confirm('Opravdu smazat celou výpravu včetně všech úlovků a prutů? Nedá se to vrátit zpět.')) return
    const { error } = await supabase.from('sessions').delete().eq('id', editingSession.id)
    if (error) { alert(error.message); return }
    setEditingSession(null)
    if (activeId === editingSession.id) { setActiveId(null); setViewMode('aggregate') }
    await loadSessions()
  }

  function allKnownBaits(category) {
    const set = new Set()
    sessions.forEach((s) => {
      if (category && TYPE_CATEGORY[s.type] !== category) return
      ;(s.rods || []).forEach((r) => {
        ;(r.baits || []).forEach((b) => { if (b.name) set.add(b.name.trim()) })
        if ((!r.baits || r.baits.length === 0) && r.bait) r.bait.split(',').forEach((n) => { const t = n.trim(); if (t) set.add(t) })
      })
    })
    baitCatalog.forEach((b) => {
      if (category && b.category && b.category !== category) return
      if (b.name) set.add(b.name.trim())
    })
    return Array.from(set).sort()
  }

  async function addBaitToCatalog(name, category) {
    const { data, error } = await supabase.from('baits')
      .insert({ group_id: groupId, created_by: userId, name, category })
      .select()
      .single()
    if (error) { alert(error.message); return null }
    await loadBaitCatalog()
    return data
  }

  function baitListId(type) {
    const cat = TYPE_CATEGORY[type]
    if (cat === 'dravec') return 'known-baits-dravec'
    if (cat === 'bila') return 'known-baits-bila'
    return 'known-baits-all'
  }

  function baitCategoryFor(type) {
    return TYPE_CATEGORY[type] || null
  }

  function mergedBaitOptions(category) {
    const map = {}
    baitCatalog.forEach((b) => {
      if (category && b.category && b.category !== category) return
      map[b.name.trim().toLowerCase()] = { id: b.id, name: b.name.trim(), photo_url: b.photo_url, category: b.category }
    })
    sessions.forEach((s) => {
      const guessCategory = TYPE_CATEGORY[s.type] || null
      ;(s.rods || []).forEach((r) => {
        const entries = []
        ;(r.baits || []).forEach((b) => { if (b.name) entries.push({ name: b.name.trim(), photo_url: b.photo_url || null }) })
        if ((!r.baits || r.baits.length === 0) && r.bait) entries.push({ name: r.bait.trim(), photo_url: r.bait_photo_url || null })
        entries.forEach(({ name, photo_url }) => {
          if (category && guessCategory && guessCategory !== category) return
          const key = name.toLowerCase()
          if (!key || map[key]) return
          map[key] = { id: key, name, photo_url, category: guessCategory }
        })
      })
      ;(s.catches || []).forEach((c) => {
        if (!c.bait) return
        if (category && c.category !== category) return
        const key = c.bait.trim().toLowerCase()
        if (map[key]) return
        map[key] = { id: key, name: c.bait.trim(), photo_url: c.bait_photo_url || null, category: c.category }
      })
    })
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }

  function allKnownSpecies() {
    const set = new Set(['Obecně dravci'])
    sessions.forEach((s) => {
      ;(s.catches || []).forEach((c) => { if (c.species) set.add(c.species.trim()) })
    })
    return Array.from(set).sort()
  }

  function baitPhotoLookup() {
    const map = {}
    baitCatalog.forEach((b) => { if (b.name && b.photo_url) map[b.name.trim().toLowerCase()] = b.photo_url })
    sessions.forEach((s) => {
      ;(s.rods || []).forEach((r) => {
        ;(r.baits || []).forEach((b) => { if (b.name && b.photo_url) map[b.name.trim().toLowerCase()] = b.photo_url })
      })
      ;(s.catches || []).forEach((c) => { if (c.bait && c.bait_photo_url) map[c.bait.trim().toLowerCase()] = c.bait_photo_url })
    })
    return map
  }

  function sessionMatchesSearch(s, query) {
    const q = normalizeSearchText(query)
    if (!q) return true
    if (normalizeSearchText(s.title).includes(q)) return true
    if (normalizeSearchText(s.revir).includes(q)) return true
    if (normalizeSearchText(s.target_species).includes(q)) return true
    if ((s.catches || []).some((c) => normalizeSearchText(c.species).includes(q) || normalizeSearchText(c.bait).includes(q))) return true
    return false
  }

  const visibleSessions = sessions.filter((s) => {
    const catOk = activeCategory === 'all' || TYPE_CATEGORY[s.type] === activeCategory || filteredCatches(s).length > 0
    const userOk = activeUserFilter === 'all' || s.user_id === activeUserFilter
    const searchOk = sessionMatchesSearch(s, searchQuery)
    return catOk && userOk && searchOk
  })

  function peekLabel() {
    if (activePanel === 'locations') return `📍 Revíry · ${locationsCatalog.length}`
    if (activePanel === 'baits') return `🪱 Nástrahy`
    if (activePanel === 'catches') return `🐟 Úlovky`
    if (viewMode === 'detail' && activeSession) return activeSession.title
    const parts = []
    if (activeCategory !== 'all') parts.push(activeCategory === 'dravec' ? 'Dravci' : 'Bílá ryba')
    if (activeUserFilter !== 'all') parts.push(userName(activeUserFilter))
    const catchCount = visibleSessions.reduce((sum, s) => sum + filteredCatches(s).length, 0)
    const prefix = parts.length ? parts.join(' · ') + ' · ' : ''
    return `${prefix}${visibleSessions.length} výprav · ${catchCount} úlovků`
  }

  const isPlacingSomething = placementTarget === 'session-point' || placementTarget === 'catch-point' || placementTarget === 'relocate-session-point' || placementTarget === 'relocate-catch' || placementTarget === 'new-location-point' || areaDraft || rodPointsDraft || (placementTarget && (placementTarget.startsWith('rod-') || placementTarget.startsWith('edit-rod-')))

  // --- postranní panel/mobilní lišta v režimu "📍 Revíry" — nezávislé na viewMode/activeId výprav, ty se drží beze změny v pozadí ---
  function renderLocationsList() {
    const q = normalizeSearchText(searchQuery)
    const sorted = [...locationsCatalog]
      .filter((l) => !q || normalizeSearchText(l.name).includes(q) || normalizeSearchText(l.revir).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
    return (
      <>
        <div className="sb-head">
          <span>Revíry</span>
          <button className="new-btn" onClick={startAddLocationArea}>+ Přidat místo</button>
        </div>
        <div style={{ padding: '0 18px 10px' }}>
          <input
            className="text-input"
            placeholder="🔎 Hledat revír (název, číslo)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: '20px 18px', color: 'var(--ink-soft)', fontSize: 13 }}>
            {locationsCatalog.length === 0 ? 'Katalog je zatím prázdný. Zkus přidat první přes „+ Přidat místo".' : 'Nic nenalezeno.'}
          </div>
        ) : (
          sorted.map((l) => {
            const linkedSessions = sessions.filter((s) => (s.session_locations || []).some((sl) => sl.location_id === l.id))
            const catchCount = linkedSessions.reduce((sum, s) => sum + (s.catches || []).filter((c) => c.location_id === l.id).length, 0)
            return (
              <div key={l.id} className="record-row" onClick={() => { setLocationsReturnId(l.id); setBaitsInitialKey(null); setShowLocations(true) }}>
                <div className="record-head">
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <IconRevir size={16} color="var(--water-deep)" dotColor="var(--paper)" /> {l.name}
                  </strong>
                  {l.revir && <span className="revir-chip">{l.revir}</span>}
                </div>
                <div className="c-sub" style={{ marginTop: 4 }}>{linkedSessions.length} výprav · {catchCount} úlovků</div>
              </div>
            )
          })
        )}
      </>
    )
  }

  // --- postranní panel "🪱 Nástrahy" — stejný vzor jako Revíry/Výpravy: hledání + seznam, detail se otevírá jako modal (BaitsModal) ---
  function renderBaitsList() {
    const q = normalizeSearchText(searchQuery)
    const baits = computeBaitsList(sessions, baitCatalog)
      .filter((b) => !q || normalizeSearchText(b.label).includes(q))
      .sort((a, b) => b.catches.length - a.catches.length)
    return (
      <>
        <div className="sb-head">
          <span>Nástrahy</span>
          <button className="new-btn" onClick={() => { setBaitsInitialKey(null); setBaitsStartAdding(true); setShowBaits(true) }}>+ Přidat nástrahu</button>
        </div>
        <div style={{ padding: '0 18px 10px' }}>
          <input
            className="text-input"
            placeholder="🔎 Hledat nástrahu…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {baits.length === 0 ? (
          <div style={{ padding: '20px 18px', color: 'var(--ink-soft)', fontSize: 13 }}>
            {searchQuery ? 'Nic nenalezeno.' : 'Zatím žádné. Zkus přidat první přes „+ Přidat nástrahu".'}
          </div>
        ) : (
          baits.map((b) => (
            <div
              key={b.key} className="record-row"
              onClick={() => { setBaitsInitialKey(b.key); setBaitsStartAdding(false); setShowBaits(true) }}
            >
              <div className="record-head">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {b.photo_url
                    ? <img src={b.photo_url} alt="" className="bait-thumb" style={{ marginLeft: 0, flex: 'none' }} />
                    : <span style={{ flex: 'none', display: 'flex' }}><IconNastraha size={18} color={b.category === 'dravec' ? 'var(--water-deep)' : 'var(--amber-deep)'} /></span>}
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</strong>
                </span>
                <span className="record-length">{b.catches.length}×</span>
              </div>
            </div>
          ))
        )}
      </>
    )
  }

  // --- postranní panel "🐟 Úlovky" — plochý seznam (bez seskupení podle měsíce), hledání jako primární způsob navigace ---
  function renderCatchesList() {
    const q = normalizeSearchText(searchQuery)
    const all = []
    sessions.forEach((s) => {
      ;(s.catches || []).forEach((c) => all.push({ ...c, sessionRef: s }))
    })
    const filtered = all
      .filter((c) => !q
        || normalizeSearchText(c.species).includes(q)
        || normalizeSearchText(c.bait).includes(q)
        || normalizeSearchText(c.revir).includes(q)
        || normalizeSearchText(c.sessionRef.title).includes(q))
      .sort((a, b) => (b.caught_at || b.sessionRef.session_date || '').localeCompare(a.caught_at || a.sessionRef.session_date || ''))
    return (
      <>
        <div className="sb-head"><span>Úlovky</span></div>
        <div style={{ padding: '0 18px 10px' }}>
          <input
            className="text-input"
            placeholder="🔎 Hledat úlovek (druh, nástraha, revír)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 18px', color: 'var(--ink-soft)', fontSize: 13 }}>
            {searchQuery ? 'Nic nenalezeno.' : 'Zatím žádný úlovek.'}
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id} className="record-row"
              onClick={() => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c) }}
            >
              <div className="record-head">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div className="fish-mini" style={{ flex: 'none', width: 26, height: 26 }} dangerouslySetInnerHTML={{ __html: fishSVG(CATEGORY_COLOR[c.category]) }} />
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.species}</strong>
                </span>
                <span className="record-length">{c.length_cm ?? '—'} cm</span>
              </div>
              <div className="c-sub" style={{ marginTop: 4 }}>
                {c.caught_at ? c.caught_at.slice(0, 10) : c.sessionRef.session_date} · {c.sessionRef.title}{c.revir ? ` · ${c.revir}` : ''}
              </div>
            </div>
          ))
        )}
      </>
    )
  }

  function renderSessionList() {
    return (
      <>
          <div className="sb-head">
            <span>Výpravy</span>
            <button className="new-btn" onClick={startNewSession}>+ nová výprava</button>
          </div>
          <div style={{ padding: '0 18px 10px' }}>
            <input
              className="text-input"
              placeholder="🔎 Hledat (název, revír, druh, nástraha)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sb-toolbar">
            <button className="new-btn" onClick={expandAll}>Rozbalit vše</button>
            <button className="new-btn" onClick={collapseAll}>Sbalit vše</button>
            <button className="new-btn" onClick={jumpToNewest}>⬆️ Nejnovější</button>
          </div>
          <div className="filter-row">
            {['all', 'dravec', 'bila'].map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${activeCategory === cat ? `active ${cat}` : ''}`}
                onClick={() => { setActiveCategory(cat); setViewMode('aggregate') }}
              >
                {cat === 'all' ? 'Vše' : cat === 'dravec' ? 'Dravci' : 'Bílá ryba'}
              </button>
            ))}
          </div>
          {members.length >= 1 && (
            <div className="filter-row">
              <button
                className={`filter-chip ${activeUserFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setActiveUserFilter('all'); setViewMode('aggregate') }}
              >Kdo: Vše</button>
              {members.map((m) => (
                <button
                  key={m.id}
                  className={`filter-chip user-chip ${activeUserFilter === m.id ? 'active' : ''}`}
                  style={activeUserFilter === m.id ? { background: userColor(m.id), borderColor: userColor(m.id) } : {}}
                  onClick={() => { setActiveUserFilter(m.id); setViewMode('aggregate') }}
                >
                  <span className="user-dot" style={{ background: userColor(m.id) }} />
                  {m.name}{m.id === userId ? ' (já)' : ''}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="loader-text" style={{ padding: 18 }}>Načítám…</div>
          ) : visibleSessions.length === 0 ? (
            <div style={{ padding: '20px 18px', color: 'var(--ink-soft)', fontSize: 13 }}>
              Žádná výprava. Zkus přidat první přes "+ nová výprava".
            </div>
          ) : (
            buildGroups(visibleSessions).map((yearGroup) => {
              const yearCollapsed = collapsedGroups.has(yearGroup.key)
              return (
                <div key={yearGroup.key}>
                  <div className="year-header" onClick={() => toggleGroup(yearGroup.key)}>
                    <span className="chevron">{yearCollapsed ? '▸' : '▾'}</span> {yearGroup.year}
                  </div>
                  {!yearCollapsed && yearGroup.months.map((m) => {
                    const monthCollapsed = collapsedGroups.has(m.key)
                    return (
                      <div key={m.key}>
                        <div className="month-header clickable" onClick={() => toggleGroup(m.key)}>
                          <span className="chevron">{monthCollapsed ? '▸' : '▾'}</span> {m.label} <span className="month-count">({m.sessions.length})</span>
                        </div>
                        {!monthCollapsed && m.sessions.map((s) => (
                          <div
                            key={s.id}
                            className={`session-item ${viewMode === 'detail' && s.id === activeId ? 'active' : ''} ${s.status === 'in_progress' ? 'live' : ''}`}
                            style={{ borderLeft: `3px solid ${userColor(s.user_id)}`, paddingLeft: 15 }}
                            onClick={() => { setActiveId(s.id); setViewMode('detail') }}
                          >
                            <div className="s-icon" dangerouslySetInnerHTML={{ __html: s.type === 'kapr' ? iconCarp : iconSpin }} />
                            <div className="s-body">
                              <div className="s-title">{s.title}</div>
                              <div className="s-sub">{s.session_date} · {s.time_from}–{s.time_to} · {userName(s.user_id)}{s.revir ? ` · ${s.revir}` : ''}</div>
                              <div className="s-tags">
                                {s.status === 'in_progress' && <span className="s-tag live-tag">🔴 Probíhá</span>}
                                <span className="s-tag">{s.type}</span>
                                {s.target_species && <span className="s-tag target">🎯 {s.target_species}</span>}
                                <span className="s-tag catch">{filteredCatches(s).length} úlovky</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
      </>
    )
  }

  function renderDetailStrip() {
    return (
          activeSession && viewMode === 'detail' && !draftSession && (
            <div className="detail-strip">
              {activeSession.status === 'in_progress' && (
                <div className="live-banner" style={{ gridColumn: '1 / -1' }}>
                  <span>🔴 Výprava právě probíhá</span>
                  {canEdit && <button className="new-btn" onClick={() => endLiveSession(activeSession)}>Ukončit výpravu</button>}
                </div>
              )}
              <div className="det-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <h3>Podmínky</h3>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="new-btn" onClick={() => duplicateSession(activeSession)}>📋 Nová jako tahle</button>
                    {activeSession.area && (activeSession.session_locations || []).length === 0 && (
                      <button className="new-btn" onClick={() => startSaveLocation(activeSession)}>📌 Uložit místo do katalogu</button>
                    )}
                    {canEdit && <button className="new-btn" onClick={() => openLocationMenu(activeSession)}>📍 Místo</button>}
                    {canEdit && <button className="new-btn" onClick={() => startEditSession(activeSession)}>✏️ Upravit výpravu</button>}
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                  📅 {activeSession.session_date}{activeSession.time_from ? ` · ${activeSession.time_from}–${activeSession.time_to || '?'}` : ''}
                </div>
                <div className="weather-row" style={{ marginTop: 8 }}>
                  <div className="w-item"><div className="num">{activeSession.weather_temp_c ?? '—'}°C</div><div className="lab">teplota</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_pressure_hpa ?? '—'} hPa{activeSession.weather_pressure_trend > 0 ? ' ↗️' : activeSession.weather_pressure_trend < 0 ? ' ↘️' : ''}</div><div className="lab">tlak</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_wind || '—'}</div><div className="lab">vítr</div></div>
                </div>
                {activeSession.water_stations?.length > 0 ? (
                  activeSession.water_stations.map((ws) => (
                    <div key={ws.station_id}>
                      <div className="weather-row" style={{ marginTop: 8 }}>
                        <div className="w-item"><div className="num">💧 {ws.level_cm ?? '—'} cm</div><div className="lab">vodní stav</div></div>
                        <div className="w-item"><div className="num">{ws.flow_m3s ?? '—'} m³/s</div><div className="lab">průtok</div></div>
                        {ws.temp_c != null && <div className="w-item"><div className="num">{ws.temp_c}°C</div><div className="lab">teplota vody</div></div>}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                        {ws.station_name}{ws.precision ? ` · ${WATER_PRECISION_LABEL[ws.precision]}` : ''}
                        {ws.spa_level != null && SPA_LEVEL_INFO[ws.spa_level] && ` · ${SPA_LEVEL_INFO[ws.spa_level].icon} ${SPA_LEVEL_INFO[ws.spa_level].label}`}
                      </div>
                    </div>
                  ))
                ) : activeSession.water_station_name && (
                  <>
                    <div className="weather-row" style={{ marginTop: 8 }}>
                      <div className="w-item"><div className="num">💧 {activeSession.water_level_cm ?? '—'} cm</div><div className="lab">vodní stav</div></div>
                      <div className="w-item"><div className="num">{activeSession.water_flow_m3s ?? '—'} m³/s</div><div className="lab">průtok</div></div>
                      {activeSession.water_temp_c != null && <div className="w-item"><div className="num">{activeSession.water_temp_c}°C</div><div className="lab">teplota vody</div></div>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {activeSession.water_station_name}{activeSession.water_data_precision ? ` · ${WATER_PRECISION_LABEL[activeSession.water_data_precision]}` : ''}
                      {activeSession.water_spa_level != null && SPA_LEVEL_INFO[activeSession.water_spa_level] && ` · ${SPA_LEVEL_INFO[activeSession.water_spa_level].icon} ${SPA_LEVEL_INFO[activeSession.water_spa_level].label}`}
                    </div>
                  </>
                )}
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>{activeSession.weather_desc}</div>
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-soft)' }}>🌙 {moonPhaseName(activeSession.session_date)}</div>
              </div>
              <div className="det-block">
                <h3>Pruty a nástrahy</h3>
                {(activeSession.rods || []).map((r, i) => (
                  editingRodId === r.id && canEdit ? (
                    <RodEditRow
                      key={r.id}
                      rod={r}
                      color={rodColors[i % rodColors.length]}
                      baitPhotoMap={baitPhotoLookup()}
                      baitListId={baitListId(activeSession.type)}
                      baitCatalog={mergedBaitOptions(baitCategoryFor(activeSession.type))}
                      baitCategory={baitCategoryFor(activeSession.type)}
                      onAddBait={addBaitToCatalog}
                      onBackfillBaitPhoto={backfillBaitPhoto}
                      onArmPosition={() => setPlacementTarget(`edit-rod-${r.id}`)}
                      onDone={() => { setEditingRodId(null); loadSessions() }}
                      onCancel={() => setEditingRodId(null)}
                    />
                  ) : (
                    <div className="rod-row" key={r.id}>
                      <div className="rod-dot" style={{ background: rodColors[i % rodColors.length] }} />
                      <div className="rod-name">{r.name}</div>
                      <div className="rod-baits">
                        {(r.baits && r.baits.length > 0 ? r.baits : (r.bait ? [{ name: r.bait, photo_url: r.bait_photo_url }] : [])).map((b, bi) => (
                          <span className="bait-chip" key={bi}>
                            {b.name}
                            {b.photo_url && <img src={b.photo_url} alt="nástraha" className="bait-thumb" />}
                          </span>
                        ))}
                        {(!r.baits || r.baits.length === 0) && !r.bait && <span className="rod-bait">—</span>}
                      </div>
                      {canEdit && <button className="new-btn" onClick={() => setEditingRodId(r.id)}>✏️</button>}
                    </div>
                  )
                ))}
                {(!activeSession.rods || activeSession.rods.length === 0) && (
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Bez prutů</div>
                )}
                <div className="coord-list">
                  {AREA_TYPES.includes(activeSession.type) ? (
                    normalizeSessionAreas(activeSession.area).map((entry, i) => {
                      const pts = entry.points
                      const c = areaCentroid(pts)
                      const loc = entry.location_id ? locationsCatalog.find((l) => l.id === entry.location_id) : null
                      const label = loc ? loc.name : `Oblast ${i + 1}`
                      return (
                        <button key={i} className="coord-chip" type="button" onClick={() => focusOnArea(pts)}>
                          🎯 {label}: {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                        </button>
                      )
                    })
                  ) : (
                    (activeSession.rods || []).map((r) => (
                      <button key={r.id} className="coord-chip" type="button" onClick={() => focusOnPoint(r.lat, r.lng)}>
                        🎯 {r.name}: {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="det-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3>Úlovky</h3>
                  {canEdit && <button className="new-btn" onClick={startAddCatch}>+ úlovek</button>}
                </div>
                <div className="catch-list">
                  {filteredCatches(activeSession).map((c) => {
                    const target = (activeSession.target_species || '').trim().toLowerCase()
                    const isGeneral = target.includes('obecně')
                    const matchesTarget = target && (isGeneral ? c.category === 'dravec' : c.species?.trim().toLowerCase() === target)
                    return (
                      <div className="catch-row" key={c.id} onClick={() => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c) }}>
                        <div className="fish-mini" dangerouslySetInnerHTML={{ __html: fishSVG(CATEGORY_COLOR[c.category]) }} />
                        <div>
                          <div className="c-name">{c.species} {matchesTarget && <span title="Odpovídá cíli výpravy">🎯</span>}</div>
                          <div className="c-sub">{c.length_cm} cm · {c.weight_kg} kg</div>
                        </div>
                      </div>
                    )
                  })}
                  {filteredCatches(activeSession).length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Žádný úlovek.</div>
                  )}
                </div>
              </div>
            </div>
          )
    )
  }

  return (
    <div className="app">
      <datalist id="known-baits-dravec">
        {allKnownBaits('dravec').map((b) => <option key={b} value={b} />)}
      </datalist>
      <datalist id="known-baits-bila">
        {allKnownBaits('bila').map((b) => <option key={b} value={b} />)}
      </datalist>
      <datalist id="known-baits-all">
        {allKnownBaits(null).map((b) => <option key={b} value={b} />)}
      </datalist>
      <datalist id="known-species">
        {allKnownSpecies().map((s) => <option key={s} value={s} />)}
      </datalist>
      <header>
        <div className="head-row">
          <h1>Čistý<span className="accent">svědomí</span></h1>
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <button className="new-btn hamburger-btn" onClick={() => setShowMoreMenu((v) => !v)} title="Více">
              <IconMenu size={19} color="var(--water-deep)" />
            </button>
            {showMoreMenu && (
              <div className="type-picker" style={{ position: 'absolute', top: '100%', right: 0, left: 'auto', transform: 'none', marginTop: 6, minWidth: 190, zIndex: 500 }}>
                <div className="type-picker-title">{myProfile?.display_name}</div>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); createInvite() }}>+ pozvat parťáka</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); onSignOut() }}>Odhlásit</button>
                <div style={{ height: 1, background: 'var(--paper-line)', margin: '6px 0' }} />
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); setShowGallery(true) }}>🖼 Galerie</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); setShowRecords(true) }}>🏆 Rekordy</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); setShowStats(true) }}>📊 Statistiky</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); exportData() }}>⬇️ Export dat</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); setShowHelp(true) }}>❓ Návod</button>
                <button className="type-btn" onClick={() => { setShowMoreMenu(false); setShowSettings(true) }}>⚙️ Nastavení</button>
              </div>
            )}
          </div>
        </div>
        <div className="head-secondary-row">
          <div className="head-actions-primary">
            <button
              className={`new-btn ${activePanel === null ? 'active-toggle' : ''}`}
              onClick={() => switchPanel(null)}
              title="Výpravy"
            ><IconVyprava size={15} /> Výpravy</button>
            <button
              className={`new-btn ${activePanel === 'locations' ? 'active-toggle' : ''}`}
              onClick={() => switchPanel('locations')}
              title="Revíry"
            ><IconRevir size={15} dotColor="var(--water-deep)" /> Revíry</button>
            <button
              className={`new-btn ${activePanel === 'baits' ? 'active-toggle' : ''}`}
              onClick={() => switchPanel('baits')}
              title="Nástrahy"
            ><IconNastraha size={15} /> Nástrahy</button>
            <button
              className={`new-btn ${activePanel === 'catches' ? 'active-toggle' : ''}`}
              onClick={() => switchPanel('catches')}
              title="Úlovky"
            ><IconUlovek size={15} eyeColor="var(--water-deep)" /> Úlovky</button>
          </div>
        </div>
        {inviteInfo && (
          <div className="invite-banner">
            Kód pro kamaráda: <strong>{inviteInfo.code}</strong> (platný 7 dní) — ať ho zadá po přihlášení do appky na obrazovce "Mám kód pozvánky".
            <button className="ticket-close" onClick={() => setInviteInfo(null)}>✕</button>
          </div>
        )}
        {!isOnline && (
          <div className="offline-banner">📡 Nejsi připojený k internetu — rozepsaná data zůstávají vyplněná, zkus uložit až se signál vrátí.</div>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          {activePanel === 'locations' ? renderLocationsList()
            : activePanel === 'baits' ? renderBaitsList()
            : activePanel === 'catches' ? renderCatchesList()
            : renderSessionList()}
        </aside>


        <main>
          <div ref={mapRef} id="map" style={{ cursor: isPlacingSomething ? 'crosshair' : '' }} />
          <button className="my-location-btn" onClick={goToMyLocation} title="Moje pozice">📍<span className="btn-label"> Moje pozice</span></button>
          <button className="live-session-btn" onClick={startNewSessionLive} title="Výprava teď">▶️<span className="btn-label"> Výprava teď</span></button>

          {pickingType && (
            <div className="type-picker">
              <div className="type-picker-title">Jaký typ výpravy?</div>
              {SESSION_TYPES.map((t) => (
                <button key={t.value} className="type-btn" onClick={() => chooseType(t.value)}>{t.label}</button>
              ))}
              <button className="type-cancel" onClick={() => setPickingType(false)}>Zrušit</button>
            </div>
          )}

          {locationPickerStep === 'choose' && (
            <div className="type-picker">
              <div className="type-picker-title">Jak zadat místo?</div>
              <button className="type-btn" onClick={() => setLocationPickerStep('catalog')}>📍 Z katalogu</button>
              <button className="type-btn" onClick={startDrawNew}>🖊 Naklikat nové na mapě</button>
              <button className="type-cancel" onClick={() => setLocationPickerStep(null)}>Zrušit</button>
            </div>
          )}

          {locationActionMenuFor && (
            <div className="type-picker">
              <div className="type-picker-title">📍 Místo výpravy</div>
              <button
                className="type-btn"
                onClick={() => { const s = locationActionMenuFor; setLocationActionMenuFor(null); updateSessionFromLocations(s) }}
              >🔄 Aktualizovat podle katalogu</button>
              <button
                className="type-btn"
                onClick={() => { const s = locationActionMenuFor; setLocationActionMenuFor(null); startAttachLocationsToSession(s) }}
              >+ Přidat/změnit místa</button>
              <button className="type-cancel" onClick={() => setLocationActionMenuFor(null)}>Zrušit</button>
            </div>
          )}

          {locationPickerStep === 'attach' && (
            <div className="type-picker" style={{ minWidth: 260 }}>
              <div className="type-picker-title">Vyber místa z katalogu</div>
              {locationsCatalog.length === 0 && <p className="hint-text">Katalog je zatím prázdný.</p>}
              <div className="location-checklist">
                {locationsCatalog.map((loc) => (
                  <label key={loc.id} className="location-check-row">
                    <input type="checkbox" checked={pickingCatalogIds.includes(loc.id)} onChange={() => togglePickingCatalogId(loc.id)} />
                    <span>{loc.area ? '🎯' : '📍'} {loc.name}{loc.revir ? ` (${loc.revir})` : ''}</span>
                  </label>
                ))}
              </div>
              <button className="btn-primary" style={{ margin: '8px 0 0', width: '100%' }} onClick={proceedAttachLocations} disabled={pickingCatalogIds.length === 0}>Uložit výběr</button>
              <button
                className="type-cancel"
                onClick={() => { setLocationPickerStep(null); setPickingCatalogIds([]); setAttachingLocationsSessionId(null) }}
              >Zrušit</button>
            </div>
          )}

          {locationPickerStep === 'catalog' && (
            <div className="type-picker" style={{ minWidth: 260 }}>
              <div className="type-picker-title">Vyber místa z katalogu</div>
              {locationsCatalog.length === 0 && <p className="hint-text">Katalog je zatím prázdný.</p>}
              <div className="location-checklist">
                {locationsCatalog.map((loc) => (
                  <label key={loc.id} className="location-check-row">
                    <input type="checkbox" checked={pickingCatalogIds.includes(loc.id)} onChange={() => togglePickingCatalogId(loc.id)} />
                    <span>{loc.area ? '🎯' : '📍'} {loc.name}{loc.revir ? ` (${loc.revir})` : ''}</span>
                  </label>
                ))}
              </div>
              <button className="btn-primary" style={{ margin: '8px 0 0', width: '100%' }} onClick={proceedFromCatalogSelection} disabled={pickingCatalogIds.length === 0}>Pokračovat</button>
              <button className="new-btn" style={{ marginTop: 6 }} onClick={() => setLocationPickerStep('choose')}>← Zpět</button>
              <button className="type-cancel" onClick={() => { setLocationPickerStep(null); setPickingCatalogIds([]) }}>Zrušit</button>
            </div>
          )}

          {editingAreasSession && !areaDraft && (
            <div className="type-picker" style={{ minWidth: 260 }}>
              <div className="type-picker-title">Oblasti výpravy ({editingAreasSession.areas.length})</div>
              {editingAreasSession.areas.map((entry, idx) => {
                const loc = entry.location_id ? locationsCatalog.find((l) => l.id === entry.location_id) : null
                return (
                  <div key={idx} className="rod-edit-row" style={{ marginBottom: 4 }}>
                    <span className="hint-text" style={{ margin: 0, flex: 1 }}>{loc ? loc.name : `Oblast ${idx + 1}`} ({entry.points.length} bodů)</span>
                    <button className="new-btn danger-btn" onClick={() => removeManagedArea(idx)}>🗑</button>
                  </div>
                )
              })}
              {editingAreasSession.areas.length === 0 && (
                <p className="hint-text">Žádná oblast — přidej aspoň jednu, nebo zruš úpravu.</p>
              )}
              <button className="new-btn" onClick={() => startAddAreaPoint((newAreas) => addAreasToManaged(newAreas))} style={{ marginTop: 6 }}>+ Přidat oblast</button>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="new-btn" onClick={() => setEditingAreasSession(null)}>Zrušit</button>
                <button className="btn-primary" style={{ margin: 0 }} onClick={saveManagedAreas} disabled={editingAreasSession.areas.length === 0}>Uložit</button>
              </div>
            </div>
          )}

          {editingAreasLocation && !areaDraft && (
            <div className="type-picker" style={{ minWidth: 260 }}>
              <div className="type-picker-title">Oblasti místa ({editingAreasLocation.areas.length})</div>
              {editingAreasLocation.areas.map((pts, idx) => (
                <div key={idx} className="rod-edit-row" style={{ marginBottom: 4 }}>
                  <span className="hint-text" style={{ margin: 0, flex: 1 }}>Oblast {idx + 1} ({pts.length} bodů)</span>
                  <button className="new-btn danger-btn" onClick={() => removeManagedLocationArea(idx)}>🗑</button>
                </div>
              ))}
              {editingAreasLocation.areas.length === 0 && (
                <p className="hint-text">Žádná oblast — přidej aspoň jednu, nebo zruš úpravu.</p>
              )}
              <button className="new-btn" onClick={() => startAddAreaPoint((newAreas) => addAreasToManagedLocation(newAreas))} style={{ marginTop: 6 }}>+ Přidat oblast</button>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="new-btn" onClick={() => { setEditingAreasLocation(null); setShowLocations(true) }}>Zrušit</button>
                <button className="btn-primary" style={{ margin: 0 }} onClick={saveManagedLocationAreas} disabled={editingAreasLocation.areas.length === 0}>Uložit</button>
              </div>
            </div>
          )}

          {catchChoosing && activeSession && (
            <div className="type-picker">
              <div className="type-picker-title">Kde jsi rybu chytil?</div>
              {(activeSession.rods || []).map((r) => (
                <button key={r.id} className="type-btn" onClick={() => chooseCatchOnRod(r)}>
                  Na pozici: {r.name}{r.bait ? ` (${r.bait})` : ''}
                </button>
              ))}
              <button className="type-btn" onClick={chooseCatchOnMap}>📍 Kliknout na jinou pozici mapy</button>
              <button className="type-cancel" onClick={() => setCatchChoosing(false)}>Zrušit</button>
            </div>
          )}

          {placementTarget === 'relocate-session-point' && (
            <div className="place-hint">
              Klikni na mapu, kam přesunout výpravu.
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          {placementTarget === 'new-location-point' && (
            <div className="place-hint">
              Klikni na mapu — orientační bod pro nové místo.
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          {rodPointsDraft && (
            <div className="place-hint area-hint">
              Klikni na mapu, kam jsi nahodil Prut {rodPointsDraft.length + 1}{rodPointsDraft.length > 0 ? ` (zatím nastaveno: ${rodPointsDraft.length})` : ''}.
              <div className="area-controls">
                <button className="new-btn" onClick={undoRodPoint} disabled={!rodPointsDraft.length}>Zpět o prut</button>
                <button className="btn-primary" style={{ margin: 0 }} onClick={finishRodPoints} disabled={!rodPointsDraft.length}>Hotovo, pokračovat</button>
                <button className="new-btn" onClick={cancelAreaOrPoint}>Zrušit</button>
              </div>
            </div>
          )}

          {(placementTarget === 'catch-point' || placementTarget === 'relocate-catch') && (
            <div className="place-hint">
              {placementTarget === 'relocate-catch' ? 'Klikni na mapu, kam přesunout úlovek.' : 'Klikni na mapu, kde jsi rybu chytil.'}
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          {areaDraft && (
            <div className="place-hint area-hint">
              Klikej podél trasy/oblasti ({areaDraft.current.length} bodů v aktuální, potřeba aspoň 3){areaDraft.areas.length > 0 ? ` · hotových oblastí: ${areaDraft.areas.length}` : ''}.
              <div className="area-controls">
                <button className="new-btn" onClick={undoAreaPoint} disabled={!areaDraft.current.length}>Zpět o bod</button>
                <button className="new-btn" onClick={finishCurrentArea} disabled={areaDraft.current.length < 3}>+ Další oblast</button>
                <button
                  className="btn-primary" style={{ margin: 0 }}
                  onClick={placementTarget === 'relocate-area-point' ? proceedRelocateArea : placementTarget === 'area-point-append' ? finishAppendArea : proceedToForm}
                  disabled={areaDraft.areas.length === 0 && areaDraft.current.length < 3}
                >
                  {placementTarget === 'relocate-area-point' ? 'Uložit novou oblast' : placementTarget === 'area-point-append' ? 'Přidat oblast(i)' : 'Hotovo, pokračovat'}
                </button>
                <button className="new-btn" onClick={placementTarget === 'area-point-append' ? () => { setAreaDraft(null); setPlacementTarget(null); pendingAreaAppendRef.current = null } : cancelAreaOrPoint}>Zrušit</button>
              </div>
            </div>
          )}

          {placementTarget && (placementTarget.startsWith('rod-') || placementTarget.startsWith('edit-rod-')) && (
            <div className="place-hint">
              Klikni na mapu pro pozici prutu.
              <button className="ticket-close" onClick={() => setPlacementTarget(null)}>✕</button>
            </div>
          )}

          <div className="desktop-detail-wrap">
            {activePanel !== 'locations' && renderDetailStrip()}
          </div>
        </main>
      </div>

      <div className={`mobile-sheet ${mobileSheetOpen ? 'expanded' : ''}`}>
        <div className="mobile-peek-bar" onClick={() => setMobileSheetOpen((v) => !v)}>
          <span>{peekLabel()}</span>
          <span className="peek-chevron">{mobileSheetOpen ? '▾' : '▴'}</span>
        </div>
        <div className="mobile-sheet-body">
          {activePanel === 'locations' ? renderLocationsList()
            : activePanel === 'baits' ? renderBaitsList()
            : activePanel === 'catches' ? renderCatchesList()
            : (
              viewMode === 'detail' && activeSession && !draftSession ? (
                <>
                  <button className="new-btn" onClick={() => setViewMode('aggregate')} style={{ margin: '0 18px 8px' }}>← Zpět na seznam</button>
                  {renderDetailStrip()}
                </>
              ) : renderSessionList()
            )}
        </div>
      </div>

      {draftSession && (
        <SessionFormPanel
          draft={draftSession}
          setDraft={setDraftSession}
          onArmRod={(i) => setPlacementTarget(`rod-${i}`)}
          onSave={saveSession}
          onClose={() => setDraftSession(null)}
          baitPhotoMap={baitPhotoLookup()}
          baitListId={baitListId(draftSession.type)}
          baitCatalog={mergedBaitOptions(baitCategoryFor(draftSession.type))}
          baitCategory={baitCategoryFor(draftSession.type)}
          onAddBait={addBaitToCatalog}
          onStartAddArea={startAddAreaPoint}
          locationsCatalog={locationsCatalog}
          onSaveLocation={startSaveLocation}
          onZoomToPoint={(lat, lng) => mapInstance.current?.setView([lat, lng], 15)}
        />
      )}

      {draftCatch && activeSession && (
        <CatchFormPanel
          draft={draftCatch}
          setDraft={setDraftCatch}
          rods={activeSession.rods || []}
          session={activeSession}
          onSave={saveCatch}
          onClose={() => setDraftCatch(null)}
          baitPhotoMap={baitPhotoLookup()}
          baitListId={baitListId(activeSession.type)}
          baitCatalog={mergedBaitOptions(baitCategoryFor(activeSession.type))}
          baitCategory={baitCategoryFor(activeSession.type)}
          onAddBait={addBaitToCatalog}
          locationsCatalog={locationsCatalog}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {savingLocationFor && (
        <SaveLocationForm
          source={savingLocationFor}
          onCancel={() => setSavingLocationFor(null)}
          onSave={saveLocationToCatalog}
        />
      )}

      {showRecords && (
        <RecordsModal sessions={sessions} userName={userName} userColor={userColor} onClose={() => setShowRecords(false)} onOpenCatch={(c) => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c); setShowRecords(false) }} />
      )}

      {showGallery && (
        <GalleryModal
          sessions={sessions}
          onClose={() => setShowGallery(false)}
          onOpenCatch={(c) => { setBaitsInitialKey(null); setLocationsReturnId(null); setTicketCatch(c); setShowGallery(false) }}
          onOpenBait={(label) => { setShowGallery(false); setBaitsInitialKey(label.trim().toLowerCase()); setShowBaits(true) }}
        />
      )}

      {showBaits && (
        <BaitsModal
          sessions={sessions}
          baitCatalog={baitCatalog}
          groupId={groupId}
          userId={userId}
          initialBaitKey={baitsInitialKey}
          startAdding={baitsStartAdding}
          onCatalogChanged={loadBaitCatalog}
          onRenamePropagate={renameBaitEverywhere}
          onRemoveFromRods={removeBaitFromMyRods}
          onBackfillBaitPhoto={backfillBaitPhoto}
          onClose={() => { setShowBaits(false); setBaitsInitialKey(null); setBaitsStartAdding(false) }}
          onOpenCatch={(c, key) => { setShowBaits(false); setBaitsStartAdding(false); setBaitsInitialKey(key); setLocationsReturnId(null); setTicketCatch(c) }}
          onOpenSession={(sessionId) => { setShowBaits(false); setBaitsStartAdding(false); setActivePanel(null); setActiveId(sessionId); setViewMode('detail') }}
        />
      )}

      {showLocations && (
        <LocationsModal
          locations={locationsCatalog}
          sessions={sessions}
          userId={userId}
          initialLocationId={locationsReturnId}
          onUpdate={updateLocationsCatalogEntry}
          onDelete={deleteLocationFromCatalog}
          onClose={() => { setShowLocations(false); setLocationsReturnId(null) }}
          onAddArea={startAddLocationArea}
          onManageAreas={startManageLocationAreas}
          onOpenCatch={(c, locId) => {
            setShowLocations(false); setLocationsReturnId(locId); setBaitsInitialKey(null)
            setActivePanel(null); setActiveId(c.session_id); setViewMode('detail')
            setTicketCatch(c)
          }}
          onOpenSession={(sessionId) => {
            setShowLocations(false); setActivePanel(null)
            setActiveId(sessionId); setViewMode('detail')
          }}
          onFocusLocation={focusOnLocation}
        />
      )}

      {showStats && (
        <StatsModal sessions={sessions} members={members} userColor={userColor} onClose={() => setShowStats(false)} />
      )}

      {editingSession && (
        <SessionEditModal
          draft={editingSession}
          setDraft={setEditingSession}
          onSave={saveEditSession}
          onClose={() => setEditingSession(null)}
          onDelete={deleteSession}
          onRelocate={handleRelocateSession}
          onManageAreas={() => startManageAreas(sessions.find((s) => s.id === editingSession.id))}
          locationsCatalog={locationsCatalog}
        />
      )}

      {showSettings && (
        <SettingsModal
          userId={userId}
          profile={myProfile}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => { setMyProfile(updated); setShowSettings(false); loadMembers() }}
        />
      )}

      {ticketCatch && (
        <CatchTicket
          catchData={ticketCatch}
          session={sessionForCatch(ticketCatch)}
          catcherName={sessionForCatch(ticketCatch) ? userName(sessionForCatch(ticketCatch).user_id) : null}
          onShowToast={showToast}
          canEdit={sessionForCatch(ticketCatch)?.user_id === userId}
          baitPhotoMap={baitPhotoLookup()}
          baitListId={baitListId(sessionForCatch(ticketCatch)?.type)}
          baitCatalog={mergedBaitOptions(baitCategoryFor(sessionForCatch(ticketCatch)?.type))}
          baitCategory={baitCategoryFor(sessionForCatch(ticketCatch)?.type)}
          onAddBait={addBaitToCatalog}
          onBackfillBaitPhoto={backfillBaitPhoto}
          locationsCatalog={locationsCatalog}
          onSetCatchLocation={setCatchLocation}
          onRelocate={() => startRelocateCatch(ticketCatch.id)}
          onFocusLocation={() => {
            const c = ticketCatch
            const s = sessionForCatch(c)
            setTicketCatch(null)
            setMobileSheetOpen(false)
            if (!s) { mapInstance.current?.setView([c.lat, c.lng], 16); return }
            setActivePanel(null)
            if (activeId === s.id && viewMode === 'detail') {
              mapInstance.current?.setView([c.lat, c.lng], 16)
            } else {
              pendingMapFocusRef.current = { sessionId: s.id, lat: c.lat, lng: c.lng, zoom: 16 }
              setActiveId(s.id)
              setViewMode('detail')
            }
          }}
          onOpenSession={() => {
            const s = sessionForCatch(ticketCatch)
            if (s) { setTicketCatch(null); setMobileSheetOpen(false); setActivePanel(null); setActiveId(s.id); setViewMode('detail') }
          }}
          onClose={() => {
            setTicketCatch(null)
            if (baitsInitialKey) setShowBaits(true)
            if (locationsReturnId) setShowLocations(true)
          }}
          onUpdated={loadSessions}
          onDeleted={() => { setTicketCatch(null); loadSessions() }}
        />
      )}
      {toast && <div className="save-toast">{toast}</div>}
    </div>
  )
}

function SaveLocationForm({ source, onCancel, onSave }) {
  const [name, setName] = useState(source.title || '')
  const [revir, setRevir] = useState(source.revir || '')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave(name, revir)
    setBusy(false)
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onCancel}>✕</button>
          <div className="eyebrow">Katalog míst</div>
          <h2>📌 Uložit toto místo</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <p className="help-note" style={{ marginBottom: 10 }}>
            {source.area ? `Uloží se vyšrafovaná oblast (${source.area.length} ploch).` : 'Uloží se orientační bod pro rychlé přiblížení mapy.'}
          </p>
          <form onSubmit={handleSubmit}>
            <label className="field-label">Název místa</label>
            <input className="text-input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Labe - Vaflák" />
            <label className="field-label">Revír</label>
            <input className="text-input" value={revir} onChange={(e) => setRevir(e.target.value)} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Ukládám…' : 'Uložit do katalogu'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function RecordsModal({ sessions, userName, userColor, onClose, onOpenCatch }) {
  const bySpecies = {}
  sessions.forEach((s) => {
    ;(s.catches || []).forEach((c) => {
      if (!c.species || c.length_cm == null || c.length_cm === '') return
      const key = c.species.trim().toLowerCase()
      const len = Number(c.length_cm)
      if (!bySpecies[key] || len > Number(bySpecies[key].catchData.length_cm)) {
        bySpecies[key] = {
          label: c.species.trim(),
          catchData: c,
          session: s,
        }
      }
    })
  })
  const records = Object.values(bySpecies).sort((a, b) => Number(b.catchData.length_cm) - Number(a.catchData.length_cm))

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 480 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Rekordy</div>
          <h2>🏆 Rekordy party</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          {records.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Zatím žádný úlovek s uvedenou délkou.</p>
          )}
          {records.map((r) => {
            const c = r.catchData
            const revir = c.revir || r.session.revir
            return (
              <div key={r.label} className="record-row" onClick={() => onOpenCatch(c)}>
                <div className="record-head">
                  <strong>{r.label}</strong>
                  <span className="record-length">{c.length_cm} cm</span>
                </div>
                <div className="record-sub">
                  <span className="user-dot" style={{ background: userColor(r.session.user_id) }} />
                  {userName(r.session.user_id)} · {c.caught_at ? c.caught_at.slice(0, 10) : r.session.session_date}
                  {revir ? ` · ${revir}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatsModal({ sessions, members, userColor, onClose }) {
  const byUser = {}
  sessions.forEach((s) => {
    const uid = s.user_id
    if (!byUser[uid]) byUser[uid] = { visits: 0, species: {} }
    byUser[uid].visits += 1
    ;(s.catches || []).forEach((c) => {
      const sp = c.species || 'Neuvedeno'
      byUser[uid].species[sp] = (byUser[uid].species[sp] || 0) + 1
    })
  })

  const totalVisits = sessions.length
  const totalSpecies = {}
  Object.values(byUser).forEach((u) => {
    Object.entries(u.species).forEach(([sp, n]) => { totalSpecies[sp] = (totalSpecies[sp] || 0) + n })
  })
  const totalCatches = Object.values(totalSpecies).reduce((a, b) => a + b, 0)

  function speciesTotal(speciesObj) {
    return Object.values(speciesObj).reduce((a, b) => a + b, 0)
  }

  const targetStats = {}
  const targetStatsByUser = {}
  sessions.forEach((s) => {
    const t = (s.target_species || '').trim()
    if (!t) return
    const key = t.toLowerCase()
    const isGeneral = key.includes('obecně')
    const success = (s.catches || []).some((c) => isGeneral ? c.category === 'dravec' : c.species?.trim().toLowerCase() === key)

    if (!targetStats[key]) targetStats[key] = { label: t, attempts: 0, successes: 0 }
    targetStats[key].attempts += 1
    if (success) targetStats[key].successes += 1

    const uid = s.user_id
    if (!targetStatsByUser[uid]) targetStatsByUser[uid] = {}
    if (!targetStatsByUser[uid][key]) targetStatsByUser[uid][key] = { label: t, attempts: 0, successes: 0 }
    targetStatsByUser[uid][key].attempts += 1
    if (success) targetStatsByUser[uid][key].successes += 1
  })
  const targetRows = Object.values(targetStats)

  // --- vzorce: fáze měsíce, tlak (úroveň i trend) a vodní stav (SPA stupeň) vs úlovky ---
  const byMoonPhase = {}
  const byPressureBucket = {}
  const byPressureTrend = {}
  const bySpaLevel = {}
  const pressureOrder = ['<1000 hPa', '1000–1010 hPa', '1010–1020 hPa', '1020+ hPa']
  const trendOrder = ['klesá', 'stabilní', 'roste']
  const spaOrder = [-1, 0, 1, 2, 3]
  sessions.forEach((s) => {
    const catchCount = (s.catches || []).length
    if (catchCount === 0) return
    const phase = moonPhaseName(s.session_date)
    if (phase) byMoonPhase[phase] = (byMoonPhase[phase] || 0) + catchCount
    const p = s.weather_pressure_hpa
    if (p != null && p !== '') {
      const bucket = p < 1000 ? '<1000 hPa' : p < 1010 ? '1000–1010 hPa' : p < 1020 ? '1010–1020 hPa' : '1020+ hPa'
      byPressureBucket[bucket] = (byPressureBucket[bucket] || 0) + catchCount
    }
    const trend = s.weather_pressure_trend
    if (trend != null) {
      const key = trend > 0 ? 'roste' : trend < 0 ? 'klesá' : 'stabilní'
      byPressureTrend[key] = (byPressureTrend[key] || 0) + catchCount
    }
    // u výprav složených z víc stanic bereme první -- je to jen orientační přehled, ne přesná analýza
    const spa = s.water_stations?.length > 0 ? s.water_stations[0].spa_level : s.water_spa_level
    if (spa != null) bySpaLevel[spa] = (bySpaLevel[spa] || 0) + catchCount
  })
  const moonRows = Object.entries(byMoonPhase).sort((a, b) => b[1] - a[1])
  const pressureRows = pressureOrder.filter((k) => byPressureBucket[k]).map((k) => [k, byPressureBucket[k]])
  const trendRows = trendOrder.filter((k) => byPressureTrend[k]).map((k) => [k, byPressureTrend[k]])
  const spaRows = spaOrder.filter((k) => bySpaLevel[k]).map((k) => [k, bySpaLevel[k]])

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 480 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Přehled</div>
          <h2>Statistiky party</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          {members.map((m) => {
            const u = byUser[m.id] || { visits: 0, species: {} }
            return (
              <div className="stats-row" key={m.id}>
                <div className="stats-row-head">
                  <span className="user-dot" style={{ background: userColor(m.id) }} />
                  <strong>{m.name}</strong>
                  <span className="stats-visits">{u.visits} výprav</span>
                </div>
                <div className="stats-species">
                  {Object.entries(u.species).length === 0 && <span className="rod-bait">zatím žádný úlovek</span>}
                  {Object.entries(u.species).map(([sp, n]) => (
                    <span className="bait-chip" key={sp}>{sp} ×{n}</span>
                  ))}
                </div>
                <div className="stats-total">Celkem úlovků: {speciesTotal(u.species)}</div>
                {targetStatsByUser[m.id] && (
                  <div className="stats-species" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginTop: 6 }}>
                    {Object.values(targetStatsByUser[m.id]).map((t) => (
                      <span key={t.label} className="bait-chip" style={{ width: '100%' }}>
                        🎯 {t.label}: {t.successes} z {t.attempts} ({Math.round((t.successes / t.attempts) * 100)}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="stats-row stats-total-row">
            <div className="stats-row-head"><strong>Celkem (celá parta)</strong><span className="stats-visits">{totalVisits} výprav</span></div>
            <div className="stats-species">
              {Object.entries(totalSpecies).map(([sp, n]) => (
                <span className="bait-chip" key={sp}>{sp} ×{n}</span>
              ))}
            </div>
            <div className="stats-total">Celkem úlovků: {totalCatches}</div>
            {targetRows.length > 0 && (
              <div className="stats-species" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, marginTop: 6 }}>
                {targetRows.map((t) => (
                  <span key={t.label} className="bait-chip" style={{ width: '100%' }}>
                    🎯 {t.label}: {t.successes} z {t.attempts} ({Math.round((t.successes / t.attempts) * 100)}%)
                  </span>
                ))}
              </div>
            )}
          </div>

          {(moonRows.length > 0 || pressureRows.length > 0 || trendRows.length > 0 || spaRows.length > 0) && (
            <div className="stats-row" style={{ borderBottom: 'none' }}>
              <div className="stats-row-head"><strong>📈 Kdy se daří</strong></div>
              {moonRows.length > 0 && (
                <>
                  <div className="stats-total" style={{ marginTop: 8 }}>Podle fáze měsíce</div>
                  <div className="stats-species" style={{ marginTop: 4 }}>
                    {moonRows.map(([phase, n]) => (
                      <span className="bait-chip" key={phase}>🌙 {phase} — {n}×</span>
                    ))}
                  </div>
                </>
              )}
              {pressureRows.length > 0 && (
                <>
                  <div className="stats-total" style={{ marginTop: 10 }}>Podle tlaku</div>
                  <div className="stats-species" style={{ marginTop: 4 }}>
                    {pressureRows.map(([bucket, n]) => (
                      <span className="bait-chip" key={bucket}>📊 {bucket} — {n}×</span>
                    ))}
                  </div>
                </>
              )}
              {trendRows.length > 0 && (
                <>
                  <div className="stats-total" style={{ marginTop: 10 }}>Podle trendu tlaku</div>
                  <div className="stats-species" style={{ marginTop: 4 }}>
                    {trendRows.map(([trend, n]) => (
                      <span className="bait-chip" key={trend}>
                        {trend === 'roste' ? '↗️' : trend === 'klesá' ? '↘️' : '➡️'} {trend} — {n}×
                      </span>
                    ))}
                  </div>
                </>
              )}
              {spaRows.length > 0 && (
                <>
                  <div className="stats-total" style={{ marginTop: 10 }}>Podle vodního stavu</div>
                  <div className="stats-species" style={{ marginTop: 4 }}>
                    {spaRows.map(([level, n]) => (
                      <span className="bait-chip" key={level}>{SPA_LEVEL_INFO[level]?.icon} {SPA_LEVEL_INFO[level]?.label} — {n}×</span>
                    ))}
                  </div>
                </>
              )}
              <p className="help-note" style={{ marginTop: 10 }}>Počítáno jen z toho, co máte zapsané — čím víc výprav, tím spolehlivější vzorec.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SessionEditModal({ draft, setDraft, onSave, onClose, onDelete, onRelocate, onManageAreas, locationsCatalog = [] }) {
  const [busy, setBusy] = useState(false)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [weatherError, setWeatherError] = useState(null)

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  async function handleFetchWeather() {
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.lat, draft.lng, draft.date, draft.timeFrom)
      setDraft((d) => ({ ...d, temp: w.temp, pressure: w.pressure, pressureTrend: w.pressureTrend, wind: w.wind, desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
    }
    // vodní stav — nezávisle na počasí, tiché selhání (žádná chyba nezobrazená uživateli)
    try {
      const stations = resolveHydroStations(draft.linkedLocationIds, locationsCatalog)
      const targets = stations.length > 0 ? stations : await findNearestStations(draft.lat, draft.lng, 1)
      const results = (await Promise.all(targets.map(async (station) => {
        const water = await fetchWaterConditions(station.objID, draft.date, draft.timeFrom)
        return water ? { station_id: station.objID, station_name: station.name, level_cm: water.level_cm, flow_m3s: water.flow_m3s, temp_c: water.temp_c, spa_level: water.spa_level, precision: water.precision } : null
      }))).filter(Boolean)
      if (results.length > 0) {
        setDraft((d) => ({
          ...d,
          waterStations: results,
          waterLevel: results[0].level_cm, waterFlow: results[0].flow_m3s, waterTemp: results[0].temp_c,
          waterStationName: results[0].station_name, waterPrecision: results[0].precision, waterSpaLevel: results[0].spa_level,
        }))
      }
    } catch (err) {
      console.warn('ČHMÚ se nepovedlo (appka to nechá prázdné):', err)
    }
    setWeatherBusy(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave()
    setBusy(false)
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 400 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Úprava výpravy</div>
          <h2>{draft.title || 'Výprava'}</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <label className="field-label">Název výpravy</label>
            <input className="text-input" required value={draft.title} onChange={(e) => set('title', e.target.value)} />
            <label className="field-label">Revír / lokalita</label>
            <input className="text-input" value={draft.revir} onChange={(e) => set('revir', e.target.value)} placeholder="např. Labe 19, Jizera - Kárany" />
            {AREA_TYPES.includes(draft.type) && (
              <>
                <label className="field-label">Cíl (nepovinné)</label>
                <input className="text-input" value={draft.target_species || ''} onChange={(e) => set('target_species', e.target.value)} placeholder="Obecně dravci, nebo konkrétní druh" list="known-species" autoComplete="off" />
              </>
            )}
            <div className="input-row">
              <div>
                <label className="field-label">Datum</label>
                <input className="text-input" type="date" required value={draft.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Od</label>
                <input className="text-input" type="time" value={draft.timeFrom} onChange={(e) => set('timeFrom', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Do</label>
                <input className="text-input" type="time" value={draft.timeTo} onChange={(e) => set('timeTo', e.target.value)} />
              </div>
            </div>
            <p className="hint-text">🌙 {moonPhaseName(draft.date)}</p>
            {AREA_TYPES.includes(draft.type) ? (
              <button type="button" className="new-btn" onClick={onManageAreas} style={{ marginBottom: 10 }}>
                🗺 Upravit oblasti (přidat / smazat)
              </button>
            ) : (
              <button type="button" className="new-btn" onClick={onRelocate} style={{ marginBottom: 10 }}>
                🗺 Změnit bod nahození na mapě
              </button>
            )}

            <button type="button" className="new-btn" onClick={handleFetchWeather} disabled={weatherBusy}>
              {weatherBusy ? 'Zjišťuji…' : '🌤 Přepočítat podmínky pro nové datum'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}
            {draft.waterStations?.length > 0 ? (
              draft.waterStations.map((ws) => (
                <p key={ws.station_id} className="hint-text" style={{ marginTop: 6 }}>
                  💧 {ws.level_cm != null ? `${ws.level_cm} cm` : '—'} · {ws.flow_m3s != null ? `${ws.flow_m3s} m³/s` : '—'}
                  {ws.temp_c != null ? ` · ${ws.temp_c} °C` : ''} ({ws.station_name}{ws.precision ? `, ${WATER_PRECISION_LABEL[ws.precision]}` : ''})
                  {ws.spa_level != null && SPA_LEVEL_INFO[ws.spa_level] ? ` · ${SPA_LEVEL_INFO[ws.spa_level].icon} ${SPA_LEVEL_INFO[ws.spa_level].label}` : ''}
                </p>
              ))
            ) : draft.waterStationName && (
              <p className="hint-text" style={{ marginTop: 6 }}>
                💧 {draft.waterLevel != null ? `${draft.waterLevel} cm` : '—'} · {draft.waterFlow != null ? `${draft.waterFlow} m³/s` : '—'}
                {draft.waterTemp != null ? ` · ${draft.waterTemp} °C` : ''} ({draft.waterStationName}{draft.waterPrecision ? `, ${WATER_PRECISION_LABEL[draft.waterPrecision]}` : ''})
                {draft.waterSpaLevel != null && SPA_LEVEL_INFO[draft.waterSpaLevel] ? ` · ${SPA_LEVEL_INFO[draft.waterSpaLevel].icon} ${SPA_LEVEL_INFO[draft.waterSpaLevel].label}` : ''}
              </p>
            )}

            <div className="input-row" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">Teplota °C</label>
                <input className="text-input" type="number" value={draft.temp} onChange={(e) => set('temp', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tlak hPa</label>
                <input className="text-input" type="number" value={draft.pressure} onChange={(e) => set('pressure', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vítr</label>
                <input className="text-input" value={draft.wind} onChange={(e) => set('wind', e.target.value)} />
              </div>
            </div>
            <label className="field-label">Popis počasí</label>
            <input className="text-input" value={draft.desc} onChange={(e) => set('desc', e.target.value)} />

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn-primary" style={{ margin: 0, flex: 1 }} type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit změny'}</button>
              <button type="button" className="new-btn danger-btn" onClick={onDelete}>🗑 Smazat výpravu</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({ userId, profile, onClose, onSaved }) {
  const [name, setName] = useState(profile?.display_name || '')
  const [color, setColor] = useState(profile?.color || USER_PALETTE[0])
  const [busy, setBusy] = useState(false)

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMessage, setPwMessage] = useState(null)
  const [pwError, setPwError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.from('profiles')
      .update({ display_name: name, color })
      .eq('id', userId)
      .select()
      .single()
    setBusy(false)
    if (error) { alert(error.message); return }
    onSaved(data)
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    setPwError(null)
    setPwMessage(null)
    if (password.length < 6) { setPwError('Heslo musí mít aspoň 6 znaků.'); return }
    if (password !== password2) { setPwError('Hesla se neshodují.'); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPwBusy(false)
    if (error) { setPwError(error.message); return }
    setPassword(''); setPassword2('')
    setPwMessage('Heslo je nastaveno. Od teď se můžeš přihlašovat i heslem, bez čekání na e-mail.')
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket" style={{ maxWidth: 360 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nastavení</div>
          <h2>Tvůj profil</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSave}>
            <label className="field-label">Jméno, pod kterým budeš uveden</label>
            <input className="text-input" required value={name} onChange={(e) => setName(e.target.value)} />
            <label className="field-label" style={{ marginTop: 14 }}>Tvoje barva (úlovky, mapa, seznam výprav)</label>
            <div className="color-swatches">
              {USER_PALETTE.map((c) => (
                <button
                  key={c} type="button"
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 16 }}>{busy ? 'Ukládám…' : 'Uložit'}</button>
          </form>

          <div style={{ borderTop: '1px dashed var(--paper-line)', marginTop: 20, paddingTop: 16 }}>
            <label className="field-label" style={{ marginTop: 0 }}>Přihlašovací heslo (nepovinné)</label>
            <p className="help-note">Nastav si heslo, ať se nemusíš pokaždé přihlašovat přes e-mail — hodí se hlavně na appku na ploše telefonu.</p>
            <form onSubmit={handleSetPassword}>
              <input className="text-input" type="password" placeholder="nové heslo (aspoň 6 znaků)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 8 }} />
              <input className="text-input" type="password" placeholder="zopakuj heslo" value={password2} onChange={(e) => setPassword2(e.target.value)} style={{ marginTop: 8 }} />
              {pwError && <p className="error-text">{pwError}</p>}
              {pwMessage && <p className="hint-text" style={{ marginTop: 8 }}>{pwMessage}</p>}
              <button className="new-btn" type="submit" disabled={pwBusy} style={{ marginTop: 10 }}>{pwBusy ? 'Ukládám…' : 'Nastavit heslo'}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function RodEditRow({ rod, color, baitPhotoMap = {}, baitListId = 'known-baits-all', baitCatalog = [], baitCategory = null, onAddBait, onBackfillBaitPhoto, onArmPosition, onDone, onCancel }) {
  const [name, setName] = useState(rod.name)
  const initialBaits = (rod.baits && rod.baits.length > 0)
    ? rod.baits.map((b) => ({ name: b.name, photo_url: b.photo_url, photoFile: null }))
    : (rod.bait ? [{ name: rod.bait, photo_url: rod.bait_photo_url, photoFile: null }] : [{ name: '', photo_url: null, photoFile: null }])
  const [baits, setBaits] = useState(initialBaits)
  const [busy, setBusy] = useState(false)

  function updateBait(i, field, value) {
    setBaits((prev) => {
      const next = [...prev]
      let entry = { ...next[i], [field]: value }
      if (field === 'name' && !entry.photoFile) {
        const match = baitPhotoMap[value.trim().toLowerCase()]
        if (match) entry.photo_url = match
      }
      next[i] = entry
      return next
    })
  }
  function addBait() { setBaits((prev) => [...prev, { name: '', photo_url: null, photoFile: null }]) }
  function removeBait(i) { setBaits((prev) => prev.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    setBusy(true)
    const baitsPayload = []
    for (const b of baits) {
      if (!b.name && !b.photo_url && !b.photoFile) continue
      let photo_url = b.photo_url
      if (b.photoFile) {
        const url = await uploadPhoto(b.photoFile, `baits/${rod.session_id}`)
        if (url) {
          photo_url = url
          onBackfillBaitPhoto?.(b.name, url)
        }
      }
      baitsPayload.push({ name: b.name, photo_url })
    }
    const { error } = await supabase.from('rods').update({
      name, baits: baitsPayload,
      bait: baitsPayload.map((b) => b.name).filter(Boolean).join(', ') || null,
    }).eq('id', rod.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onDone()
  }

  return (
    <div className="rod-edit-block">
      <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 8 }} />
      {baits.map((b, i) => (
        <div key={i} className="bait-edit-row">
          <BaitPicker
            value={b.name}
            category={baitCategory}
            catalog={baitCatalog}
            onChange={(name) => updateBait(i, 'name', name)}
            onAddBait={onAddBait}
            placeholder="nástraha"
          />
          <label className="photo-label">
            📷 {b.photoFile ? b.photoFile.name : (b.photo_url ? 'změnit' : 'foto')}
            <input type="file" accept="image/*" hidden onChange={(e) => updateBait(i, 'photoFile', e.target.files[0])} />
          </label>
          {b.photo_url && !b.photoFile && <img src={b.photo_url} alt="" className="bait-thumb" />}
          {baits.length > 1 && <button type="button" className="ticket-close" style={{ position: 'static', color: 'var(--ink-soft)' }} onClick={() => removeBait(i)}>✕</button>}
        </div>
      ))}
      <button type="button" className="new-btn" onClick={addBait} style={{ marginTop: 4 }}>+ další nástraha</button>
      <div className="rod-edit-row" style={{ marginTop: 8 }}>
        <button type="button" className="new-btn" onClick={onArmPosition}>📍 změnit pozici na mapě</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="new-btn" onClick={onCancel}>Zrušit</button>
        <button className="btn-primary" style={{ margin: 0 }} onClick={handleSave} disabled={busy}>{busy ? 'Ukládám…' : 'Uložit'}</button>
      </div>
    </div>
  )
}

function SessionFormPanel({ draft, setDraft, onArmRod, onSave, onClose, baitPhotoMap = {}, baitListId = 'known-baits-all', baitCatalog = [], baitCategory = null, onAddBait, onStartAddArea, locationsCatalog = [], onSaveLocation, onZoomToPoint }) {
  const [busy, setBusy] = useState(false)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [weatherError, setWeatherError] = useState(null)

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }
  function setRod(i, field, value) {
    setDraft((d) => {
      const rods = [...d.rods]; rods[i] = { ...rods[i], [field]: value }
      return { ...d, rods }
    })
  }
  function addRod() {
    setDraft((d) => ({
      ...d,
      rods: [...d.rods, { name: `Prut ${d.rods.length + 1}`, lat: d.point.lat, lng: d.point.lng, baits: [{ name: '', photoFile: null }] }],
    }))
  }
  function updateBait(rodIndex, baitIndex, field, value) {
    setDraft((d) => {
      const rods = [...d.rods]
      const baits = [...rods[rodIndex].baits]
      let entry = { ...baits[baitIndex], [field]: value }
      if (field === 'name' && !entry.photoFile) {
        const match = baitPhotoMap[value.trim().toLowerCase()]
        if (match) entry.photo_url = match
      }
      baits[baitIndex] = entry
      rods[rodIndex] = { ...rods[rodIndex], baits }
      return { ...d, rods }
    })
  }
  function addBait(rodIndex) {
    setDraft((d) => {
      const rods = [...d.rods]
      rods[rodIndex] = { ...rods[rodIndex], baits: [...rods[rodIndex].baits, { name: '', photoFile: null }] }
      return { ...d, rods }
    })
  }
  function removeBait(rodIndex, baitIndex) {
    setDraft((d) => {
      const rods = [...d.rods]
      rods[rodIndex] = { ...rods[rodIndex], baits: rods[rodIndex].baits.filter((_, i) => i !== baitIndex) }
      return { ...d, rods }
    })
  }

  async function handleFetchWeather() {
    if (!draft.date) { setWeatherError('Nejdřív vyplň datum.'); return }
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.point.lat, draft.point.lng, draft.date, draft.timeFrom)
      setDraft((d) => ({ ...d, temp: w.temp, pressure: w.pressure, pressureTrend: w.pressureTrend, wind: w.wind, desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
    }
    try {
      const stations = resolveHydroStations(draft.linkedLocationIds, locationsCatalog)
      const targets = stations.length > 0 ? stations : await findNearestStations(draft.point.lat, draft.point.lng, 1)
      const results = (await Promise.all(targets.map(async (station) => {
        const water = await fetchWaterConditions(station.objID, draft.date, draft.timeFrom)
        return water ? { station_id: station.objID, station_name: station.name, level_cm: water.level_cm, flow_m3s: water.flow_m3s, temp_c: water.temp_c, spa_level: water.spa_level, precision: water.precision } : null
      }))).filter(Boolean)
      if (results.length > 0) {
        setDraft((d) => ({
          ...d,
          waterStations: results,
          waterLevel: results[0].level_cm, waterFlow: results[0].flow_m3s, waterTemp: results[0].temp_c,
          waterStationName: results[0].station_name, waterPrecision: results[0].precision, waterSpaLevel: results[0].spa_level,
        }))
      }
    } catch (err) {
      console.warn('ČHMÚ se nepovedlo (appka to nechá prázdné):', err)
    }
    setWeatherBusy(false)
  }

  useEffect(() => {
    if (draft.date) { handleFetchWeather() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.date])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave()
    setBusy(false)
  }

  return (
    <div className="side-panel">
      <div className="ticket" style={{ maxWidth: 400 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nová výprava</div>
          <h2>Zápis do deníku</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            {draft.area ? (
              <div style={{ marginBottom: 10 }}>
                <label className="field-label" style={{ marginTop: 0 }}>Oblasti ({draft.area.length})</label>
                {draft.area.map((entry, idx) => {
                  const loc = entry.location_id ? locationsCatalog.find((l) => l.id === entry.location_id) : null
                  return (
                    <div key={idx} className="rod-edit-row" style={{ marginBottom: 4 }}>
                      <span className="hint-text" style={{ margin: 0, flex: 1 }}>{loc ? loc.name : `Oblast ${idx + 1}`} ({entry.points.length} bodů)</span>
                      <button
                        type="button" className="new-btn danger-btn"
                        onClick={() => set('area', draft.area.filter((_, i) => i !== idx))}
                      >🗑</button>
                    </div>
                  )
                })}
                <button
                  type="button" className="new-btn"
                  onClick={() => onStartAddArea((newAreas) => set('area', [...(draft.area || []), ...newAreas.map((points) => ({ location_id: null, points }))]))}
                >+ Přidat oblast</button>
              </div>
            ) : (
              <p className="hint-text">Pozice: {draft.point.lat.toFixed(4)}, {draft.point.lng.toFixed(4)}</p>
            )}
            {draft.area && (
              <button type="button" className="new-btn" onClick={() => onSaveLocation(draft)} style={{ marginBottom: 10 }}>📌 Uložit toto místo do katalogu</button>
            )}
            <label className="field-label">Název výpravy</label>
            <input className="text-input" required value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="např. Orlík — zátoka pod hrází" />
            <label className="field-label">Revír / lokalita</label>
            <input className="text-input" value={draft.revir} onChange={(e) => set('revir', e.target.value)} placeholder="např. Labe 19, Jizera - Kárany" />
            {AREA_TYPES.includes(draft.type) && (
              <>
                <label className="field-label">Cíl (nepovinné)</label>
                <input className="text-input" value={draft.target_species || ''} onChange={(e) => set('target_species', e.target.value)} placeholder="Obecně dravci, nebo konkrétní druh" list="known-species" autoComplete="off" />
              </>
            )}
            <div className="input-row">
              <div>
                <label className="field-label">Datum</label>
                <input className="text-input" type="date" required value={draft.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Od</label>
                <input className="text-input" type="time" value={draft.timeFrom} onChange={(e) => set('timeFrom', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Do</label>
                <input className="text-input" type="time" value={draft.timeTo} onChange={(e) => set('timeTo', e.target.value)} />
              </div>
            </div>

            <button type="button" className="new-btn" onClick={handleFetchWeather} disabled={weatherBusy} style={{ marginTop: 10 }}>
              {weatherBusy ? 'Zjišťuji…' : '🌤 Doplnit podmínky automaticky'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}
            {draft.waterStations?.length > 0 ? (
              draft.waterStations.map((ws) => (
                <p key={ws.station_id} className="hint-text" style={{ marginTop: 6 }}>
                  💧 {ws.level_cm != null ? `${ws.level_cm} cm` : '—'} · {ws.flow_m3s != null ? `${ws.flow_m3s} m³/s` : '—'}
                  {ws.temp_c != null ? ` · ${ws.temp_c} °C` : ''} ({ws.station_name}{ws.precision ? `, ${WATER_PRECISION_LABEL[ws.precision]}` : ''})
                  {ws.spa_level != null && SPA_LEVEL_INFO[ws.spa_level] ? ` · ${SPA_LEVEL_INFO[ws.spa_level].icon} ${SPA_LEVEL_INFO[ws.spa_level].label}` : ''}
                </p>
              ))
            ) : draft.waterStationName && (
              <p className="hint-text" style={{ marginTop: 6 }}>
                💧 {draft.waterLevel != null ? `${draft.waterLevel} cm` : '—'} · {draft.waterFlow != null ? `${draft.waterFlow} m³/s` : '—'}
                {draft.waterTemp != null ? ` · ${draft.waterTemp} °C` : ''} ({draft.waterStationName}{draft.waterPrecision ? `, ${WATER_PRECISION_LABEL[draft.waterPrecision]}` : ''})
                {draft.waterSpaLevel != null && SPA_LEVEL_INFO[draft.waterSpaLevel] ? ` · ${SPA_LEVEL_INFO[draft.waterSpaLevel].icon} ${SPA_LEVEL_INFO[draft.waterSpaLevel].label}` : ''}
              </p>
            )}
            {draft.date && <p className="hint-text" style={{ marginTop: 8 }}>🌙 {moonPhaseName(draft.date)}</p>}

            <div className="input-row" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">Teplota °C</label>
                <input className="text-input" type="number" value={draft.temp} onChange={(e) => set('temp', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Tlak hPa</label>
                <input className="text-input" type="number" value={draft.pressure} onChange={(e) => set('pressure', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Vítr</label>
                <input className="text-input" value={draft.wind} onChange={(e) => set('wind', e.target.value)} placeholder="3 m/s SV" />
              </div>
            </div>
            <label className="field-label">Popis počasí</label>
            <input className="text-input" value={draft.desc} onChange={(e) => set('desc', e.target.value)} placeholder="jasno, ráno mlha" />

            <label className="field-label">Pruty</label>
            {draft.rods.map((r, i) => (
              <div key={i} className="rod-edit-block">
                <input className="text-input" value={r.name} onChange={(e) => setRod(i, 'name', e.target.value)} placeholder="Prut 1" style={{ marginBottom: 8 }} />
                {r.baits.map((b, bi) => (
                  <div key={bi} className="bait-edit-row">
                    <BaitPicker
                      value={b.name}
                      category={baitCategory}
                      catalog={baitCatalog}
                      onChange={(name) => updateBait(i, bi, 'name', name)}
                      onAddBait={onAddBait}
                      placeholder="nástraha"
                    />
                    <label className="photo-label">
                      📷 {b.photoFile ? b.photoFile.name : (b.photo_url ? 'nalezeno z historie' : 'foto')}
                      <input type="file" accept="image/*" hidden onChange={(e) => updateBait(i, bi, 'photoFile', e.target.files[0])} />
                    </label>
                    {b.photo_url && !b.photoFile && <img src={b.photo_url} alt="" className="bait-thumb" />}
                    {r.baits.length > 1 && <button type="button" className="ticket-close" style={{ position: 'static', color: 'var(--ink-soft)' }} onClick={() => removeBait(i, bi)}>✕</button>}
                  </div>
                ))}
                <button type="button" className="new-btn" onClick={() => addBait(i)} style={{ marginTop: 4 }}>+ další nástraha</button>
                <div className="rod-edit-row" style={{ marginTop: 8 }}>
                  <button type="button" className="new-btn" onClick={() => onArmRod(i)}>📍 pozice na mapě: {r.lat.toFixed(4)}, {r.lng.toFixed(4)}</button>
                </div>
              </div>
            ))}
            <button type="button" className="new-btn" onClick={addRod} style={{ marginBottom: 12 }}>+ další prut</button>

            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit výpravu'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function CatchFormPanel({ draft, setDraft, rods, session, onSave, onClose, baitPhotoMap = {}, baitListId = 'known-baits-all', baitCatalog = [], baitCategory = null, onAddBait, locationsCatalog = [] }) {
  const [busy, setBusy] = useState(false)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [weatherError, setWeatherError] = useState(null)
  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  function handleBaitChange(value) {
    setDraft((d) => {
      const next = { ...d, bait: value }
      if (!d.baitPhotoFile) {
        const match = baitPhotoMap[value.trim().toLowerCase()]
        if (match) next.bait_photo_url = match
      }
      return next
    })
  }

  async function handleFetchWeather() {
    if (!draft.time) { setWeatherError('Nejdřív vyplň čas úlovku.'); return }
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.point.lat, draft.point.lng, session.session_date, draft.time)
      setDraft((d) => ({ ...d, weather_temp_c: w.temp, weather_pressure_hpa: w.pressure, weather_pressure_trend: w.pressureTrend, weather_wind: w.wind, weather_desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
    }
    try {
      const linkedIds = (session.session_locations || []).map((sl) => sl.location_id)
      const linkedStation = resolveHydroStation(linkedIds, locationsCatalog)
      const station = linkedStation || (await findNearestStations(draft.point.lat, draft.point.lng, 1))[0]
      if (station) {
        const water = await fetchWaterConditions(station.objID, session.session_date, draft.time)
        if (water) {
          setDraft((d) => ({
            ...d,
            water_level_cm: water.level_cm, water_flow_m3s: water.flow_m3s, water_temp_c: water.temp_c,
            water_station_name: station.name, water_data_precision: water.precision, water_spa_level: water.spa_level,
          }))
        }
      }
    } catch (err) {
      console.warn('ČHMÚ se nepovedlo (appka to nechá prázdné):', err)
    }
    setWeatherBusy(false)
  }

  useEffect(() => {
    if (draft.time) { handleFetchWeather() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.time])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSave()
    setBusy(false)
  }

  return (
    <div className="side-panel">
      <div className="ticket" style={{ maxWidth: 380 }}>
        <div className="ticket-top">
          <button className="ticket-close" onClick={onClose}>✕</button>
          <div className="eyebrow">Nový úlovek</div>
          <h2>Zapsat rybu</h2>
        </div>
        <div className="perforation"></div>
        <div className="ticket-body">
          <form onSubmit={handleSubmit}>
            <p className="hint-text">Pozice: {draft.point.lat.toFixed(4)}, {draft.point.lng.toFixed(4)}</p>
            <label className="field-label">Druh ryby</label>
            <input className="text-input" required value={draft.species} onChange={(e) => set('species', e.target.value)} placeholder="Kapr obecný" />
            <label className="field-label">Revír / lokalita</label>
            <input className="text-input" value={draft.revir} onChange={(e) => set('revir', e.target.value)} placeholder="např. Labe 19" />
            <label className="field-label">Kategorie</label>
            <select className="text-input" value={draft.category} onChange={(e) => set('category', e.target.value)}>
              <option value="dravec">Dravec</option>
              <option value="bila">Bílá ryba</option>
            </select>
            <div className="input-row">
              <div>
                <label className="field-label">Délka (cm)</label>
                <input className="text-input" type="number" value={draft.length} onChange={(e) => set('length', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Váha (kg)</label>
                <input className="text-input" type="number" step="0.1" value={draft.weight} onChange={(e) => set('weight', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Čas</label>
                <input className="text-input" type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />
              </div>
            </div>
            <button type="button" className="new-btn" onClick={handleFetchWeather} disabled={weatherBusy} style={{ marginBottom: 8 }}>
              {weatherBusy ? 'Zjišťuji…' : '🌤 Dopočítat podmínky pro tento čas'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}
            {draft.weather_temp_c != null && (
              <p className="hint-text" style={{ marginBottom: 6 }}>
                {draft.weather_temp_c}°C · {draft.weather_pressure_hpa} hPa · {draft.weather_wind} · {draft.weather_desc}
              </p>
            )}
            {draft.water_station_name && (
              <p className="hint-text" style={{ marginBottom: 10 }}>
                💧 {draft.water_level_cm != null ? `${draft.water_level_cm} cm` : '—'} · {draft.water_flow_m3s != null ? `${draft.water_flow_m3s} m³/s` : '—'}
                {draft.water_temp_c != null ? ` · ${draft.water_temp_c} °C` : ''} ({draft.water_station_name}{draft.water_data_precision ? `, ${WATER_PRECISION_LABEL[draft.water_data_precision]}` : ''})
              </p>
            )}
            <label className="field-label">Nástraha</label>
            <BaitPicker
              value={draft.bait}
              category={baitCategory}
              catalog={baitCatalog}
              onChange={handleBaitChange}
              onAddBait={onAddBait}
              placeholder="boilie tuňák 20mm"
            />
            <label className="photo-label" style={{ display: 'inline-block', marginTop: 4, marginRight: 8 }}>
              📷 {draft.baitPhotoFile ? draft.baitPhotoFile.name : (draft.bait_photo_url ? 'nalezeno z historie' : 'foto nástrahy')}
              <input type="file" accept="image/*" hidden onChange={(e) => set('baitPhotoFile', e.target.files[0])} />
            </label>
            {draft.bait_photo_url && !draft.baitPhotoFile && <img src={draft.bait_photo_url} alt="" className="bait-thumb" />}
            <label className="field-label">Foto úlovku</label>
            <label className="photo-label" style={{ display: 'inline-block', marginTop: 4 }}>
              📷 {draft.photoFile ? draft.photoFile.name : 'vybrat foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => set('photoFile', e.target.files[0])} />
            </label>
            <br />
            {rods.length > 0 && (
              <>
                <label className="field-label">Prut</label>
                <select className="text-input" value={draft.rodId} onChange={(e) => set('rodId', e.target.value)}>
                  <option value="">— nevybráno —</option>
                  {rods.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </>
            )}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Ukládám…' : 'Uložit úlovek'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
