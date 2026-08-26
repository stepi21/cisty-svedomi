// Minimalni service worker. Appka ho potrebuje jen proto, aby ji Chrome
// na Androidu nabidl jako plnohodnotnou appku k INSTALACI ("Instalovat
// aplikaci" -- bezi bez adresniho radku), ne jen jako zalozku ("Pridat
// na plochu" -- otevre se v odlehcenem prohlizeci s adresnim radkem).
// iOS Safari tohle nepotrebuje, Android Chrome ano.
//
// Schvalne nic necachuje (viz "fetch" nize -- prazdny listener, bez
// event.respondWith(), takze prohlizec pozadavek zpracuje normalne,
// jako by tu service worker vubec nebyl). Uz jsme resili problem se
// starou zacachovanou verzi appky (viz vercel.json) -- agresivni
// cachovani pres service worker by to riziko jen znovu otevrelo.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Prazdno -- prohlizec si pozadavek obslouzi sam, normalne pres sit.
})
