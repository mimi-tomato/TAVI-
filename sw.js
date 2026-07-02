const CACHE_NAME = "tavi-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// インストール時に、主要ファイルを手元に保存する
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 古い保存を片付ける
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ページ本体(HTML・ナビゲーション)は、まずネットから最新を取りに行き、
// 取れなければ手元の保存を使う(オフライン対応)。これにより、GitHub更新が
// sw.js自体を変更しなくても、次にページを開いたときにすぐ反映される。
// アイコンやマニフェストのようなほぼ変わらないものだけ、従来通りキャッシュ優先にする。
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const isNavigation = req.mode === "navigate" || (req.destination === "document");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // 取得に成功したら、次回オフライン用に手元の保存も更新しておく
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // それ以外(アイコン等の静的ファイル)は、これまで通りキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
