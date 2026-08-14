import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { supabase } from '../supabaseClient'
import CatchTicket from './CatchTicket.jsx'
import HelpModal from './HelpModal.jsx'
import GalleryModal from './GalleryModal.jsx'
import BaitsModal from './BaitsModal.jsx'
import BaitPicker from './BaitPicker.jsx'
import LocationsModal from './LocationsModal.jsx'
import { fetchWeather, moonPhaseName } from '../lib/weather.js'
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
  const [areaDraft, setAreaDraft] = useState(null)               // {areas:[], current:[]} během kreslení oblasti
  const [rodPointsDraft, setRodPointsDraft] = useState(null)     // [{lat,lng}, ...] během sbírání pozic prutů (bodové typy)
  const [placementTarget, setPlacementTarget] = useState(null)   // 'session-point' | 'area-point' | 'rod-<i>' | 'catch-point'
  const [draftSession, setDraftSession] = useState(null)         // otevřený formulář nové výpravy
  const [draftCatch, setDraftCatch] = useState(null)             // otevřený formulář nového úlovku
  const [catchChoosing, setCatchChoosing] = useState(false)      // mini panel "na jaké pozici?"
  const [editingRodId, setEditingRodId] = useState(null)         // id prutu, co se právě edituje inline
  const [editingSession, setEditingSession] = useState(null)     // rozepsaná editace výpravy (datum, počasí...)
  const [editingAreasSession, setEditingAreasSession] = useState(null) // {id, areas:[]} — správa oblastí u uložené výpravy

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
    if (data) setLocationsCatalog(data)
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
          if (found) { setBaitsInitialKey(null); setTicketCatch(found); break }
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
    if (area[0] && typeof area[0].lat === 'number') return [area] // starý formát: jeden plochý seznam bodů
    return area // nový formát: pole polygonů
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

  // --- render markerů: agregovaný pohled (podle filtrů, přes všechny výpravy) nebo detail jedné výpravy ---
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return
    markersLayer.current.clearLayers()
    const map = mapInstance.current

    if (viewMode === 'detail' && activeSession) {
      if (pendingMapFocusRef.current && pendingMapFocusRef.current.sessionId === activeSession.id) {
        const f = pendingMapFocusRef.current
        map.setView([f.lat, f.lng], f.zoom || 16)
        pendingMapFocusRef.current = null
      } else {
        map.setView([activeSession.lat, activeSession.lng], 14)
      }

      normalizeAreas(activeSession.area).forEach((pts, ai) => {
        L.polygon(pts.map((p) => [p.lat, p.lng]), {
          color: '#6B7A4F', weight: 2, fillColor: '#6B7A4F', fillOpacity: 0.12,
        }).addTo(markersLayer.current)
        const c = areaCentroid(pts)
        L.circleMarker([c.lat, c.lng], {
          radius: 7, color: '#6B7A4F', weight: 2, fillColor: '#EDE9DC', fillOpacity: 1,
        }).bindPopup(`Oblast ${ai + 1}`).addTo(markersLayer.current)
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
        marker.on('click', () => { setBaitsInitialKey(null); setTicketCatch(c) })
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
      marker.on('click', () => { setBaitsInitialKey(null); setTicketCatch(c) })
      marker.addTo(markersLayer.current)
    })

    if (matches.length > 0) {
      const bounds = L.latLngBounds(matches.map(({ c, s }) => [c.lat ?? s.lat, c.lng ?? s.lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else {
      map.setView([49.8, 15.5], 8)
    }
  }, [activeSession, activeCategory, activeUserFilter, viewMode, sessions])

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
    const area = source.area || null
    const lat = source.point ? source.point.lat : source.lat
    const lng = source.point ? source.point.lng : source.lng
    setSavingLocationFor({ title: source.title || '', revir: source.revir || '', area, lat, lng })
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
      const areas = areaLocations.map((l) => l.area)
      updates.area = areas
      const c = areaCentroid(areas.flat())
      updates.lat = c.lat
      updates.lng = c.lng
    } else if (linked[0]) {
      updates.lat = linked[0].lat
      updates.lng = linked[0].lng
    }
    const { error } = await supabase.from('sessions').update(updates).eq('id', session.id)
    if (error) { alert(error.message); return }
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
      point: { lat: s.lat, lng: s.lng }, area: s.area || null,
      rods: rods.length ? rods : [{ name: 'Prut 1', lat: s.lat, lng: s.lng, baits: [{ name: '', photoFile: null }] }],
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
  function startNewSession() { pendingLiveRef.current = false; setPickingType(true); setMobileSheetOpen(false) }
  function startNewSessionLive() { pendingLiveRef.current = true; setPickingType(true); setMobileSheetOpen(false) }

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
    if (AREA_TYPES.includes(type)) {
      setAreaDraft({ areas: [], current: [] })
      setPlacementTarget('area-point')
    } else {
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
    setDraftSession({
      type: pendingTypeRef.current,
      title: '', date: live.date, timeFrom: live.timeFrom, timeTo: '', revir: '', target_species: '',
      temp: '', pressure: '', wind: '', desc: '',
      point: first, area: null,
      rods,
      live: live.live,
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
    const areas = areaDraft.current.length >= 3 ? [...areaDraft.areas, areaDraft.current] : areaDraft.areas
    if (areas.length === 0) return
    const overallCentroid = areaCentroid(areas.flat())
    const firstAreaCentroid = areaCentroid(areas[0])
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
    const s = draftSession
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({
        group_id: groupId, user_id: userId, type: s.type, title: s.title, revir: s.revir || null, target_species: s.target_species || null,
        session_date: s.date, time_from: s.timeFrom || null, time_to: s.timeTo || null,
        lat: s.point.lat, lng: s.point.lng, area: s.area,
        weather_temp_c: s.temp || null, weather_pressure_hpa: s.pressure || null,
        weather_wind: s.wind || null, weather_desc: s.desc || null,
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
  }

  async function saveCatch() {
    const c = draftCatch
    const session = activeSession
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
    const { error } = await supabase.from('catches').insert({
      session_id: session.id, group_id: groupId, rod_id: c.rodId || null,
      species: c.species, category: c.category, length_cm: c.length || null, weight_kg: c.weight || null,
      bait: c.bait, caught_at: caughtAt, lat: c.point.lat, lng: c.point.lng, photo_url, bait_photo_url, revir: c.revir || null,
      weather_temp_c: c.weather_temp_c ?? null, weather_pressure_hpa: c.weather_pressure_hpa ?? null,
      weather_wind: c.weather_wind || null, weather_desc: c.weather_desc || null,
    })
    if (error) { alert(error.message); return }
    setDraftCatch(null)
    await loadSessions()
  }

  function startEditSession(s) {
    setEditingSession({
      id: s.id, type: s.type, title: s.title, date: s.session_date, revir: s.revir || '', target_species: s.target_species || '',
      timeFrom: s.time_from || '', timeTo: s.time_to || '',
      temp: s.weather_temp_c ?? '', pressure: s.weather_pressure_hpa ?? '',
      wind: s.weather_wind || '', desc: s.weather_desc || '',
      lat: s.lat, lng: s.lng,
    })
  }

  async function saveEditSession() {
    const e = editingSession
    const { error } = await supabase.from('sessions').update({
      title: e.title, session_date: e.date, revir: e.revir || null, target_species: e.target_species || null, time_from: e.timeFrom || null, time_to: e.timeTo || null,
      weather_temp_c: e.temp || null, weather_pressure_hpa: e.pressure || null,
      weather_wind: e.wind || null, weather_desc: e.desc || null,
    }).eq('id', e.id)
    if (error) { alert(error.message); return }
    setEditingSession(null)
    await loadSessions()
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
    setEditingAreasSession({ id: session.id, areas: normalizeAreas(session.area).map((a) => [...a]) })
    setEditingSession(null)
    setMobileSheetOpen(false)
  }

  function removeManagedArea(idx) {
    setEditingAreasSession((prev) => ({ ...prev, areas: prev.areas.filter((_, i) => i !== idx) }))
  }

  function addAreasToManaged(newAreas) {
    setEditingAreasSession((prev) => ({ ...prev, areas: [...prev.areas, ...newAreas] }))
  }

  async function saveManagedAreas() {
    const { id, areas } = editingAreasSession
    const updates = { area: areas.length ? areas : null }
    if (areas.length) {
      const overallCentroid = areaCentroid(areas.flat())
      updates.lat = overallCentroid.lat
      updates.lng = overallCentroid.lng
    }
    await supabase.from('sessions').update(updates).eq('id', id)
    if (areas.length) {
      const firstAreaCentroid = areaCentroid(areas[0])
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

  function proceedRelocateArea() {
    const areas = areaDraft.current.length >= 3 ? [...areaDraft.areas, areaDraft.current] : areaDraft.areas
    if (areas.length === 0) return
    const overallCentroid = areaCentroid(areas.flat())
    const firstAreaCentroid = areaCentroid(areas[0])
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

  const visibleSessions = sessions.filter((s) => {
    const catOk = activeCategory === 'all' || TYPE_CATEGORY[s.type] === activeCategory || filteredCatches(s).length > 0
    const userOk = activeUserFilter === 'all' || s.user_id === activeUserFilter
    return catOk && userOk
  })

  function peekLabel() {
    if (viewMode === 'detail' && activeSession) return activeSession.title
    const parts = []
    if (activeCategory !== 'all') parts.push(activeCategory === 'dravec' ? 'Dravci' : 'Bílá ryba')
    if (activeUserFilter !== 'all') parts.push(userName(activeUserFilter))
    const catchCount = visibleSessions.reduce((sum, s) => sum + filteredCatches(s).length, 0)
    const prefix = parts.length ? parts.join(' · ') + ' · ' : ''
    return `${prefix}${visibleSessions.length} výprav · ${catchCount} úlovků`
  }

  const isPlacingSomething = placementTarget === 'session-point' || placementTarget === 'catch-point' || placementTarget === 'relocate-session-point' || placementTarget === 'relocate-catch' || areaDraft || rodPointsDraft || (placementTarget && (placementTarget.startsWith('rod-') || placementTarget.startsWith('edit-rod-')))

  function renderSessionList() {
    return (
      <>
          <div className="sb-head">
            <span>Výpravy</span>
            <button className="new-btn" onClick={startNewSession}>+ nová výprava</button>
          </div>
          <div className="sb-toolbar">
            <button className="new-btn" onClick={expandAll}>Rozbalit vše</button>
            <button className="new-btn" onClick={collapseAll}>Sbalit vše</button>
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
                    <button className="new-btn" onClick={() => startSaveLocation(activeSession)}>📌 Uložit místo do katalogu</button>
                    {(activeSession.session_locations || []).length > 0 && canEdit && (
                      <button className="new-btn" onClick={() => updateSessionFromLocations(activeSession)}>🔄 Aktualizovat podle katalogu</button>
                    )}
                    {canEdit && <button className="new-btn" onClick={() => startEditSession(activeSession)}>✏️ Upravit výpravu</button>}
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                  📅 {activeSession.session_date}{activeSession.time_from ? ` · ${activeSession.time_from}–${activeSession.time_to || '?'}` : ''}
                </div>
                <div className="weather-row" style={{ marginTop: 8 }}>
                  <div className="w-item"><div className="num">{activeSession.weather_temp_c ?? '—'}°C</div><div className="lab">teplota</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_pressure_hpa ?? '—'} hPa</div><div className="lab">tlak</div></div>
                  <div className="w-item"><div className="num">{activeSession.weather_wind || '—'}</div><div className="lab">vítr</div></div>
                </div>
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
                    normalizeAreas(activeSession.area).map((pts, i) => {
                      const c = areaCentroid(pts)
                      return (
                        <button key={i} className="coord-chip" type="button" onClick={() => focusOnArea(pts)}>
                          🎯 Oblast {i + 1}: {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
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
                      <div className="catch-row" key={c.id} onClick={() => { setBaitsInitialKey(null); setTicketCatch(c) }}>
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
          <div className="head-actions-wrap">
            <span className="whoami">{myProfile?.display_name}</span>
            <div className="head-actions">
              <button className="new-btn" onClick={() => setShowLocations(true)} title="Revíry">📍</button>
              <button className="new-btn" onClick={() => { setBaitsInitialKey(null); setShowBaits(true) }} title="Nástrahy">🪱</button>
              <button className="new-btn" onClick={() => setShowGallery(true)} title="Galerie">🖼</button>
              <button className="new-btn" onClick={() => setShowRecords(true)} title="Rekordy">🏆</button>
              <button className="new-btn" onClick={() => setShowHelp(true)} title="Návod">❓</button>
              <button className="new-btn" onClick={exportData} title="Export dat">⬇️</button>
              <button className="new-btn" onClick={() => setShowStats(true)} title="Statistiky">📊</button>
              <button className="new-btn" onClick={() => setShowSettings(true)} title="Nastavení">⚙️</button>
              <button className="new-btn" onClick={createInvite}>+ pozvat parťáka</button>
              <button className="new-btn" onClick={onSignOut}>Odhlásit</button>
            </div>
          </div>
        </div>
        {inviteInfo && (
          <div className="invite-banner">
            Kód pro kamaráda: <strong>{inviteInfo.code}</strong> (platný 7 dní) — ať ho zadá po přihlášení do appky na obrazovce "Mám kód pozvánky".
            <button className="ticket-close" onClick={() => setInviteInfo(null)}>✕</button>
          </div>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          {renderSessionList()}
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

          {editingAreasSession && !areaDraft && (
            <div className="type-picker" style={{ minWidth: 260 }}>
              <div className="type-picker-title">Oblasti výpravy ({editingAreasSession.areas.length})</div>
              {editingAreasSession.areas.map((pts, idx) => (
                <div key={idx} className="rod-edit-row" style={{ marginBottom: 4 }}>
                  <span className="hint-text" style={{ margin: 0, flex: 1 }}>Oblast {idx + 1} ({pts.length} bodů)</span>
                  <button className="new-btn danger-btn" onClick={() => removeManagedArea(idx)}>🗑</button>
                </div>
              ))}
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
            {renderDetailStrip()}
          </div>
        </main>
      </div>

      <div className={`mobile-sheet ${mobileSheetOpen ? 'expanded' : ''}`}>
        <div className="mobile-peek-bar" onClick={() => setMobileSheetOpen((v) => !v)}>
          <span>{peekLabel()}</span>
          <span className="peek-chevron">{mobileSheetOpen ? '▾' : '▴'}</span>
        </div>
        <div className="mobile-sheet-body">
          {viewMode === 'detail' && activeSession && !draftSession ? (
            <>
              <button className="new-btn" onClick={() => setViewMode('aggregate')} style={{ margin: '0 18px 8px' }}>← Zpět na seznam</button>
              {renderDetailStrip()}
            </>
          ) : renderSessionList()}
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
        <RecordsModal sessions={sessions} userName={userName} userColor={userColor} onClose={() => setShowRecords(false)} onOpenCatch={(c) => { setBaitsInitialKey(null); setTicketCatch(c); setShowRecords(false) }} />
      )}

      {showGallery && (
        <GalleryModal
          sessions={sessions}
          onClose={() => setShowGallery(false)}
          onOpenCatch={(c) => { setBaitsInitialKey(null); setTicketCatch(c); setShowGallery(false) }}
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
          onCatalogChanged={loadBaitCatalog}
          onRenamePropagate={renameBaitEverywhere}
          onRemoveFromRods={removeBaitFromMyRods}
          onBackfillBaitPhoto={backfillBaitPhoto}
          onClose={() => { setShowBaits(false); setBaitsInitialKey(null) }}
          onOpenCatch={(c, key) => { setShowBaits(false); setBaitsInitialKey(key); setTicketCatch(c) }}
          onOpenSession={(sessionId) => { setShowBaits(false); setActiveId(sessionId); setViewMode('detail') }}
        />
      )}

      {showLocations && (
        <LocationsModal
          locations={locationsCatalog}
          userId={userId}
          onUpdate={updateLocationsCatalogEntry}
          onDelete={deleteLocationFromCatalog}
          onClose={() => setShowLocations(false)}
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
          canEdit={sessionForCatch(ticketCatch)?.user_id === userId}
          baitPhotoMap={baitPhotoLookup()}
          baitListId={baitListId(sessionForCatch(ticketCatch)?.type)}
          baitCatalog={mergedBaitOptions(baitCategoryFor(sessionForCatch(ticketCatch)?.type))}
          baitCategory={baitCategoryFor(sessionForCatch(ticketCatch)?.type)}
          onAddBait={addBaitToCatalog}
          onBackfillBaitPhoto={backfillBaitPhoto}
          onRelocate={() => startRelocateCatch(ticketCatch.id)}
          onFocusLocation={() => {
            const c = ticketCatch
            const s = sessionForCatch(c)
            setTicketCatch(null)
            setMobileSheetOpen(false)
            if (!s) { mapInstance.current?.setView([c.lat, c.lng], 16); return }
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
            if (s) { setTicketCatch(null); setMobileSheetOpen(false); setActiveId(s.id); setViewMode('detail') }
          }}
          onClose={() => {
            setTicketCatch(null)
            if (baitsInitialKey) setShowBaits(true)
          }}
          onUpdated={loadSessions}
          onDeleted={() => { setTicketCatch(null); loadSessions() }}
        />
      )}
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

  // --- vzorce: fáze měsíce a tlak vs úlovky ---
  const byMoonPhase = {}
  const byPressureBucket = {}
  const pressureOrder = ['<1000 hPa', '1000–1010 hPa', '1010–1020 hPa', '1020+ hPa']
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
  })
  const moonRows = Object.entries(byMoonPhase).sort((a, b) => b[1] - a[1])
  const pressureRows = pressureOrder.filter((k) => byPressureBucket[k]).map((k) => [k, byPressureBucket[k]])

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

          {(moonRows.length > 0 || pressureRows.length > 0) && (
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
              <p className="help-note" style={{ marginTop: 10 }}>Počítáno jen z toho, co máte zapsané — čím víc výprav, tím spolehlivější vzorec.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SessionEditModal({ draft, setDraft, onSave, onClose, onDelete, onRelocate, onManageAreas }) {
  const [busy, setBusy] = useState(false)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [weatherError, setWeatherError] = useState(null)

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  async function handleFetchWeather() {
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.lat, draft.lng, draft.date, draft.timeFrom)
      setDraft((d) => ({ ...d, temp: w.temp, pressure: w.pressure, wind: w.wind, desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
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
              {weatherBusy ? 'Zjišťuji počasí…' : '🌤 Přepočítat počasí pro nové datum'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}

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

  function toggleLocation(loc) {
    setDraft((d) => {
      const linked = d.linkedLocationIds || []
      if (linked.includes(loc.id)) {
        return { ...d, linkedLocationIds: linked.filter((id) => id !== loc.id) }
      }
      const next = { ...d, linkedLocationIds: [...linked, loc.id] }
      if (loc.area) {
        next.area = [...(d.area || []), loc.area]
      } else {
        onZoomToPoint?.(loc.lat, loc.lng)
      }
      if (!d.revir) next.revir = loc.revir || ''
      if (!d.title) next.title = loc.name
      else if (!d.title.includes(loc.name)) next.title = `${d.title}, ${loc.name}`
      return next
    })
  }

  async function handleFetchWeather() {
    if (!draft.date) { setWeatherError('Nejdřív vyplň datum.'); return }
    setWeatherBusy(true); setWeatherError(null)
    try {
      const w = await fetchWeather(draft.point.lat, draft.point.lng, draft.date, draft.timeFrom)
      setDraft((d) => ({ ...d, temp: w.temp, pressure: w.pressure, wind: w.wind, desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
    }
    setWeatherBusy(false)
  }

  useEffect(() => {
    if (draft.live && draft.temp === '') { handleFetchWeather() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            {locationsCatalog.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <label className="field-label" style={{ marginTop: 0 }}>Místa z katalogu</label>
                {locationsCatalog
                  .filter((loc) => (draft.area ? !!loc.area : !loc.area))
                  .map((loc) => {
                    const checked = (draft.linkedLocationIds || []).includes(loc.id)
                    return (
                      <label key={loc.id} className="location-check-row">
                        <input type="checkbox" checked={checked} onChange={() => toggleLocation(loc)} />
                        <span>{loc.name}{loc.revir ? ` (${loc.revir})` : ''}</span>
                      </label>
                    )
                  })}
              </div>
            )}
            {draft.area ? (
              <div style={{ marginBottom: 10 }}>
                <label className="field-label" style={{ marginTop: 0 }}>Oblasti ({draft.area.length})</label>
                {draft.area.map((pts, idx) => (
                  <div key={idx} className="rod-edit-row" style={{ marginBottom: 4 }}>
                    <span className="hint-text" style={{ margin: 0, flex: 1 }}>Oblast {idx + 1} ({pts.length} bodů)</span>
                    <button
                      type="button" className="new-btn danger-btn"
                      onClick={() => set('area', draft.area.filter((_, i) => i !== idx))}
                    >🗑</button>
                  </div>
                ))}
                <button
                  type="button" className="new-btn"
                  onClick={() => onStartAddArea((newAreas) => set('area', [...(draft.area || []), ...newAreas]))}
                >+ Přidat oblast</button>
              </div>
            ) : (
              <p className="hint-text">Pozice: {draft.point.lat.toFixed(4)}, {draft.point.lng.toFixed(4)}</p>
            )}
            <button type="button" className="new-btn" onClick={() => onSaveLocation(draft)} style={{ marginBottom: 10 }}>📌 Uložit toto místo do katalogu</button>
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
              {weatherBusy ? 'Zjišťuji počasí…' : '🌤 Doplnit počasí automaticky'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}
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

function CatchFormPanel({ draft, setDraft, rods, session, onSave, onClose, baitPhotoMap = {}, baitListId = 'known-baits-all', baitCatalog = [], baitCategory = null, onAddBait }) {
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
      setDraft((d) => ({ ...d, weather_temp_c: w.temp, weather_pressure_hpa: w.pressure, weather_wind: w.wind, weather_desc: w.desc }))
    } catch (e) {
      setWeatherError(e.message)
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
              {weatherBusy ? 'Zjišťuji…' : '🌤 Dopočítat počasí pro tento čas'}
            </button>
            {weatherError && <p className="error-text">{weatherError}</p>}
            {draft.weather_temp_c != null && (
              <p className="hint-text" style={{ marginBottom: 10 }}>
                {draft.weather_temp_c}°C · {draft.weather_pressure_hpa} hPa · {draft.weather_wind} · {draft.weather_desc}
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
