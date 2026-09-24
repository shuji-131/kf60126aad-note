"use strict";
/* =======================================================
   photos.js — 写真の保存（IndexedDB）
   ★読み書きをするのはこのファイルだけ
   1人3枚 + どう切り取ったか を持つ:
     thumb 96px / page 400px / src 800px（位置合わせをやり直す用）
   ======================================================= */
var Photos = (function () {

  var DBNAME = "yujincho-photos", STORE = "photos", VER = 1;
  var dbp = null;
  var urls = {};      // 画面に貼った URL。離れる時に返す

  /* ★丸の大きさ。位置合わせの画面の正方形に対する「切り取る丸」の直径。
     ここを変えたら css/style.css の .cropstage{--ring} も同じ値にすること。
     ---------------------------------------------------------------
     2026-09-10 に直した:
       それまで、暗くする穴が 57.98%・白い輪が 82%・実際に保存される丸が
       100% と三つバラバラだった。穴に合わせて顔を置くと、出来上がりは
       1.725 倍も広い丸になり、顔が小さく・中心寄りにズレて見えていた。
       原因は二つ。
       ① .cropmask の radial-gradient に大きさを書いていなかったので
          既定の farthest-corner（＝半対角線 0.7071）が基準になり、
          41% と書いた穴が実際には 0.41×0.7071＝直径 57.98% になっていた。
       ② renderCrop が「輪の中」ではなく正方形まるごとを書き出していた。
     --------------------------------------------------------------- */
  var RING = 0.82;

  /* 位置合わせの画面は、実際の大きさに関わらず一辺 300 の正方形として数える。
     crop の x/y はこの 300 のものさしで持っている */
  var STAGE = 300;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DBNAME, VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }

  function tx(mode) {
    return open().then(function (d) { return d.transaction(STORE, mode).objectStore(STORE); });
  }
  function wrap(req) {
    return new Promise(function (res, rej) {
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function get(id) {
    if (!id) return Promise.resolve(null);
    return tx("readonly").then(function (s) { return wrap(s.get(id)); });
  }
  function put(rec) {
    rec.updatedAt = Data.nowStr();
    return tx("readwrite").then(function (s) { return wrap(s.put(rec)); });
  }
  function remove(id) {
    if (!id) return Promise.resolve();
    revoke(id);
    return tx("readwrite").then(function (s) { return wrap(s["delete"](id)); });
  }
  function all() {
    return tx("readonly").then(function (s) { return wrap(s.getAll()); });
  }
  function count() {
    return tx("readonly").then(function (s) { return wrap(s.count()); });
  }
  function totalBytes() {
    return all().then(function (rs) {
      var n = 0;
      rs.forEach(function (r) {
        ["thumb", "page", "src"].forEach(function (k) { if (r[k] && r[k].size) n += r[k].size; });
      });
      return n;
    });
  }

  /* ---- 画面に貼るための URL ---- */
  function urlFor(id, which) {
    var key = id + ":" + (which || "thumb");
    if (urls[key]) return Promise.resolve(urls[key]);
    return get(id).then(function (r) {
      if (!r || !r[which || "thumb"]) return null;
      var u = URL.createObjectURL(r[which || "thumb"]);
      urls[key] = u;
      return u;
    });
  }
  function revoke(id) {
    Object.keys(urls).forEach(function (k) {
      if (!id || k.indexOf(id + ":") === 0) { URL.revokeObjectURL(urls[k]); delete urls[k]; }
    });
  }
  function revokeAll() { revoke(null); }

  /* ---- 画像を読み込む ----
     ★スマホの写真は「実は横倒し」の情報が別に付いている。
       読み込んだ直後に一度だけ直しておくと、あとの工程が全部その前提で動ける */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var done = function (bmp) { res(bmp); };
      if (window.createImageBitmap) {
        createImageBitmap(file, { imageOrientation: "from-image" }).then(done)["catch"](function () {
          fallback();
        });
      } else fallback();

      function fallback() {
        var img = new Image();
        var u = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(u); res(img); };
        img.onerror = function () { URL.revokeObjectURL(u); rej(new Error("画像を読み込めませんでした")); };
        img.src = u;
      }
    });
  }

  function toBlob(canvas, q) {
    return new Promise(function (res) {
      if (canvas.toBlob) canvas.toBlob(function (b) { res(b); }, "image/jpeg", q || 0.86);
      else res(dataURLtoBlob(canvas.toDataURL("image/jpeg", q || 0.86)));
    });
  }
  function dataURLtoBlob(u) {
    var a = u.split(","), mime = a[0].match(/:(.*?);/)[1], bin = atob(a[1]);
    var n = bin.length, arr = new Uint8Array(n);
    while (n--) arr[n] = bin.charCodeAt(n);
    return new Blob([arr], { type: mime });
  }

  /* 長辺800pxに縮めた「元写真」を作る */
  function makeSource(file) {
    return loadImage(file).then(function (img) {
      var w = img.width, h = img.height, max = 800;
      var s = Math.min(1, max / Math.max(w, h));
      var cw = Math.round(w * s), ch = Math.round(h * s);
      var c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      c.getContext("2d").drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      return toBlob(c, 0.9);
    });
  }

  /* crop = {x, y, zoom, rot} を当てて、丸の中を切り出す */
  function renderCrop(srcBlob, crop, size) {
    return loadImage(srcBlob).then(function (img) {
      var c = document.createElement("canvas");
      c.width = size; c.height = size;
      var g = c.getContext("2d");
      g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, size, size);

      var rot = ((crop.rot || 0) % 360 + 360) % 360;
      var iw = img.width, ih = img.height;
      var sw = (rot === 90 || rot === 270) ? ih : iw;
      var sh = (rot === 90 || rot === 270) ? iw : ih;

      /* ★出来上がりの正方形は「位置合わせの画面まるごと」ではなく
         「白い輪がぴったり入る正方形」に当てる。
         こうすると border-radius:50% で丸く見せた時の丸＝画面の輪 になる。
         k = 300のものさし1つぶん が 出来上がりの何ピクセルにあたるか */
      var k = size / (STAGE * RING);

      /* 位置合わせの画面と同じ計算: 短辺が画面いっぱいになる倍率 × zoom */
      var base = STAGE / Math.min(sw, sh);
      var sc = base * (crop.zoom || 1) * k;

      g.save();
      g.translate(size / 2 + (crop.x || 0) * k, size / 2 + (crop.y || 0) * k);
      g.rotate(rot * Math.PI / 180);
      g.scale(sc, sc);
      g.drawImage(img, -iw / 2, -ih / 2);
      g.restore();
      if (img.close) img.close();
      return toBlob(c, size <= 96 ? 0.82 : 0.88);
    });
  }

  /* 元写真＋切り取り方 から 3枚を作って保存する */
  function save(id, srcBlob, crop) {
    return Promise.all([
      renderCrop(srcBlob, crop, 400),
      renderCrop(srcBlob, crop, 96)
    ]).then(function (a) {
      revoke(id);
      return put({ id: id, page: a[0], thumb: a[1], src: srcBlob, crop: crop });
    });
  }

  /* ★丸のズレを直す前に保存した写真は、切り取り方はそのままに
     「広すぎる丸」で焼かれている。元写真(src)と切り取り方(crop)は
     残してあるので、選び直さずに焼き直せる。
     ★人の情報には一切触らない。IndexedDB の写真だけを作り直す */
  function recrop(id) {
    return get(id).then(function (r) {
      if (!r || !r.src) return false;
      return save(id, r.src, r.crop || { x: 0, y: 0, zoom: 1, rot: 0 })
        .then(function () { return true; });
    });
  }

  /* 1枚ずつ順番に。まとめてやると端末の記憶が足りなくなることがある */
  function recropAll(onEach) {
    return all().then(function (rs) {
      var ids = rs.filter(function (r) { return r && r.src; })
                  .map(function (r) { return r.id; });
      var done = 0, failed = 0;
      return ids.reduce(function (chain, id) {
        return chain.then(function () {
          return recrop(id).then(function (ok) {
            if (ok) done++; else failed++;
            if (onEach) onEach(done + failed, ids.length);
          })["catch"](function () { failed++; });
        });
      }, Promise.resolve()).then(function () {
        return { total: ids.length, done: done, failed: failed };
      });
    });
  }

  function clearAll() {
    revokeAll();
    return tx("readwrite").then(function (s) { return wrap(s.clear()); });
  }

  /* 控え用: Blob → data URL / data URL → Blob */
  function blobToDataURL(b) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.readAsDataURL(b);
    });
  }

  return {
    RING: RING, STAGE: STAGE,
    get: get, put: put, remove: remove, all: all, count: count, totalBytes: totalBytes,
    urlFor: urlFor, revoke: revoke, revokeAll: revokeAll,
    loadImage: loadImage, makeSource: makeSource, renderCrop: renderCrop, save: save,
    recrop: recrop, recropAll: recropAll,
    clearAll: clearAll, blobToDataURL: blobToDataURL, dataURLtoBlob: dataURLtoBlob
  };
})();
