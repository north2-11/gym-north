/* 健身打卡 Service Worker
   ---------------------------------------------------------------
   作用：把页面和图标存到手机本地，断网也能打开（PWA 离线能力）。

   关于更新：页面本身走「网络优先」，只要联网打开就会自动拿到最新版；
   但图标、manifest 这些静态资源是「缓存优先」，改了它们才需要把下面的
   VERSION 加 1（v3 -> v4）强制换新。
   --------------------------------------------------------------- */

const VERSION = 'v3';
const CACHE = 'gym-' + VERSION;

/* 第一次安装时预先存下来的文件 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* 安装：预缓存。用 addAll 会因为任何一个文件缺失导致整体失败，
   所以这里逐个 add，缺一个也不影响其它文件。 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        PRECACHE.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* 激活：清掉旧版本缓存 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('gym-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 取用策略：
   - 只处理同源的 GET 请求，其它一律放过（不碰跨域、不碰非 GET）
   - 页面导航：先联网拿最新版，失败才用缓存（保证能收到更新）
   - 其它静态资源：先用缓存，同时后台更新（快且省流量）  */
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  /* 页面本身：网络优先 */
  if (req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 静态资源：缓存优先 + 后台更新 */
  event.respondWith(
    caches.match(req).then(hit => {
      const fetching = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fetching;
    })
  );
});
