"use strict";
/* =======================================================
   backup.js — 控えの書き出し・読み込み
   ★Chromeの「閲覧データの削除」で名簿ごと消える。これは防げない。
     だから「戻せる」ようにしておく
   ======================================================= */
var Backup = (function () {

  function stamp() {
    return Data.todayStr().replace(/-/g, "");
  }

  function build(withPhotos) {
    var db = Store.current();
    var out = {
      app: "yujincho",
      v: db.meta.v,
      exportedAt: Data.nowStr(),
      withPhotos: !!withPhotos,
      people: db.people,
      memos: db.memos,
      cats: db.cats,
      settings: db.settings,
      meta: { v: db.meta.v, seq: db.meta.seq, lastBackupAt: db.meta.lastBackupAt }
    };
    if (!withPhotos) return Promise.resolve(out);

    return Photos.all().then(function (recs) {
      var jobs = recs.map(function (r) {
        return Promise.all([
          r.thumb ? Photos.blobToDataURL(r.thumb) : null,
          r.page ? Photos.blobToDataURL(r.page) : null,
          r.src ? Photos.blobToDataURL(r.src) : null
        ]).then(function (a) {
          return { id: r.id, thumb: a[0], page: a[1], src: a[2], crop: r.crop || null };
        });
      });
      return Promise.all(jobs).then(function (list) {
        out.photos = {};
        list.forEach(function (p) { out.photos[p.id] = p; });
        return out;
      });
    });
  }

  function download(withPhotos) {
    return build(withPhotos).then(function (out) {
      var name = "友人帳_控え_" + stamp() + (withPhotos ? "_写真あり" : "") + ".json";
      var text = JSON.stringify(out);

      /* Androidアプリの中では、端末の「ダウンロード」へ直に書き出す。
         ブラウザの download はアプリの中だと受け止める先が無く、黙って消える */
      if (window.Yujincho && window.Yujincho.saveFile) {
        var saved = window.Yujincho.saveFile(name, text);
        if (!saved) throw new Error("端末に書き出せませんでした");
        name = saved;
      } else {
        var blob = new Blob([text], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      }

      var db = Store.current();
      db.meta.lastBackupAt = Data.todayStr();
      Store.mark("meta");
      Store.flush();
      return name;
    });
  }

  /* 読み込み。mode = "replace"（全部入れ替え・既定）/ "merge"（足りない人だけ足す） */
  function restore(text, mode) {
    var data;
    try { data = JSON.parse(text); }
    catch (e) { return Promise.reject(new Error("控えのファイルとして読めませんでした")); }
    if (!data || data.app !== "yujincho" || !Array.isArray(data.people)) {
      return Promise.reject(new Error("友人帳の控えではないようです"));
    }

    var incoming = {
      people: data.people,
      memos: Array.isArray(data.memos) ? data.memos : [],
      cats: Array.isArray(data.cats) && data.cats.length ? data.cats : Data.DEFAULT_CATS.slice(),
      settings: data.settings || {},
      meta: Object.assign({ v: data.v || 1, seq: 1, lastBackupAt: "" }, data.meta || {})
    };
    incoming.meta.v = data.v || incoming.meta.v || 1;

    var next;
    if (mode === "merge") {
      var db = Store.current();
      var have = {};
      db.people.forEach(function (p) { have[p.id] = 1; });
      var addP = incoming.people.filter(function (p) { return !have[p.id]; });
      var haveM = {};
      db.memos.forEach(function (m) { haveM[m.id] = 1; });
      var addM = incoming.memos.filter(function (m) { return !haveM[m.id]; });
      next = {
        people: db.people.concat(addP),
        memos: db.memos.concat(addM),
        cats: db.cats,
        settings: db.settings,
        meta: db.meta
      };
    } else {
      next = incoming;
    }

    /* 版が古ければ階段を通してから入れる */
    next = Migrate.run(Data.normalize(next));

    var photoWork = Promise.resolve();
    if (data.photos) {
      var ids = Object.keys(data.photos);
      photoWork = (mode === "merge" ? Promise.resolve() : Photos.clearAll()).then(function () {
        return Promise.all(ids.map(function (id) {
          var p = data.photos[id];
          var rec = { id: id, crop: p.crop || { x: 0, y: 0, zoom: 1, rot: 0 } };
          ["thumb", "page", "src"].forEach(function (k) {
            if (p[k]) rec[k] = Photos.dataURLtoBlob(p[k]);
          });
          return Photos.put(rec);
        }));
      });
    } else if (mode !== "merge") {
      /* 写真なしの控えで入れ替える場合、写真は残しておく。
         指している人が消えていれば、その写真はもう使われないだけ */
    }

    return photoWork.then(function () {
      Photos.revokeAll();
      var ok = Store.replaceAll(next);
      if (!ok) throw new Error(Store.lastSaveError() || "保存できませんでした");
      return { people: next.people.length, memos: next.memos.length };
    });
  }

  function readFile(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result)); };
      r.onerror = function () { rej(new Error("ファイルを読めませんでした")); };
      r.readAsText(file);
    });
  }

  function daysSinceBackup() {
    var d = Store.current().meta.lastBackupAt;
    if (!d) return null;
    return Select.daysSince(d);
  }

  return { build: build, download: download, restore: restore, readFile: readFile, daysSinceBackup: daysSinceBackup };
})();
