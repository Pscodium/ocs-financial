const CACHE_NAME = 'ocs-financial-v2'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  const isSameOrigin = url.origin === self.location.origin
  const isApiRequest = url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')

  if (!isSameOrigin || isApiRequest) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached
      }

      return fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache))
          }
          return response
        })
        .catch(() => cached)
    })
  )
})
