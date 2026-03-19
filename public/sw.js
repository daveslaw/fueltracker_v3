// Service Worker stub — full offline queue implemented in Slice 15
const CACHE_NAME = 'fueltracker-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass-through: offline support added in Slice 15
  event.respondWith(fetch(event.request))
})
