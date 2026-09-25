/* =======================================================
   sw.js — 2回目からネット不要にする係
   中身を端末に置いておくだけ。名簿のデータは一切扱わない。
   ======================================================= */
/* ★画面のファイルを直したら必ずここの番号を上げる。
   上げないと、前に置いてあった古いJSがそのまま出て「直したのに変わらない」になる */
var CACHE = "yujincho-v10";

var FILES = [
  "./",
  "index.html",
  "app.webmanifest",
  "css/style.css",
  "ref/mbti.js", "ref/love.js",
  "js/data.js", "js/migrate.js", "js/store.js", "js/photos.js",
  "js/birth.js", "js/select.js", "js/sched.js", "js/nav.js", "js/backup.js", "js/icons.js",
  "js/ios.js",
  "js/ui/parts.js", "js/ui/list.js", "js/ui/person.js", "js/ui/edit.js",
  "js/ui/logedit.js", "js/ui/schededit.js", "js/ui/birthui.js", "js/ui/crop.js", "js/ui/ref.js",
  "js/ui/care.js", "js/ui/memos.js", "js/ui/memo.js", "js/ui/backupview.js",
  "js/ui/filtersheet.js", "js/main.js",
  "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-maskable-192.png", "icons/icon-maskable-512.png",
  "icons/apple-touch-icon-180.png", "icons/favicon-32.png", "icons/favicon-16.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 1つ落とせなくても全体を諦めない */
      return Promise.all(FILES.map(function (f) {
        return c.add(f)["catch"](function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches["delete"](k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  /* 文字（Googleフォント）は、あれば使う・無ければ取りに行く */
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })["catch"](function () { return hit; });
      })
    );
    return;
  }

  /* 自分のファイルは、まず置いてあるものを返す（速い・ネット不要） */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {          /* 裏で新しくしておく */
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res); });
        })["catch"](function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })["catch"](function () {
        return caches.match("index.html");
      });
    })
  );
});
