// فیبرکار — Service Worker برای عملکرد کامل آفلاین (فعال در بیلد production)
// v2: فقط پاسخ‌های سالم (res.ok) کش می‌شوند + پشتیبانی SKIP_WAITING برای به‌روزرسانی فوری
const CACHE = 'fiberkar-v2'
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// پیام از صفحه (مثلاً «نسخه جدید آماده است») → فعال‌سازی فوری SW جدید
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // ناوبری: اول شبکه، در نبود اینترنت از کش
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    )
    return
  }

  // استاتیک‌ها (فونت/آیکون/چانک‌های هش‌دار): کش‌اول — فقط پاسخ‌های سالم کش می‌شوند
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname.startsWith('/fonts')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
      )
    )
  }
})
