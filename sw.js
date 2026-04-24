// BellMaster Pro — Service Worker
// גרסה: יש לעדכן כל פעם שמעלים HTML חדש
const CACHE_NAME = 'bellmaster-v1';

// קבצים לשמור במטמון
const CACHE_FILES = [
  '/bellmaster/',
  '/bellmaster/index.html',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
];

// התקנה — שמור קבצים במטמון
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // שמור קבצים מקומיים — Firebase/CDN נשמרים רק אם זמינים
      return cache.addAll(['/bellmaster/index.html']).then(() => {
        // נסה לשמור קבצים חיצוניים — אם נכשל, המשך בכל זאת
        return Promise.allSettled(
          CACHE_FILES.slice(2).map(url =>
            cache.add(url).catch(() => {
              console.log('[SW] לא ניתן לשמור:', url);
            })
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// הפעלה — מחק מטמון ישן
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// בקשת רשת — Cache First עם fallback לרשת
self.addEventListener('fetch', event => {
  // דלג על בקשות Firebase (realtime DB) — חייבות לעבור דרך הרשת
  if (event.request.url.includes('firebasedatabase.app') ||
      event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('cloudinary.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // יש במטמון — החזר מיד ורענן ברקע
        fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }

      // אין במטמון — נסה רשת
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // שמור במטמון לשימוש עתידי
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(() => {
        // אין רשת ואין מטמון — החזר דף offline
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// הודעה מהאפליקציה — עדכון מטמון
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
