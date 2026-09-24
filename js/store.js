"use strict";
/* =======================================================
   store.js — 文字の保存（localStorage）
   ★読み書きをするのはこのファイルだけ。画面から直接触らない
   ★書く前にひとつ前を写す。壊れていたらそちらで開く
   ======================================================= */
var Store = (function () {

  var K = {
    v:        "yujincho.v",
    people:   "yujincho.people",
    memos:    "yujincho.memos",
    cats:     "yujincho.cats",
    settings: "yujincho.settings",
    meta:     "yujincho.meta",
    peoplePrev: "yujincho.people.prev",
    memosPrev:  "yujincho.memos.prev"
  };

  var db = null;
  var timer = null;
  var dirty = {};          // どの鍵を書き直すか
  var recovered = [];      // ひとつ前で開いた鍵（画面で知らせる）
  var lastError = "";

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function put(key, val) {
    localStorage.setItem(key, val);   // 失敗は呼び出し元で受ける
  }

  /* JSONとして読む。壊れていたら prev を読む */
  function readJSON(key, prevKey, fallback) {
    var raw = get(key);
    if (raw === null) return fallback;
    try {
      var v = JSON.parse(raw);
      if (v === null || typeof v !== "object") throw new Error("形が違う");
      return v;
    } catch (e) {
      if (prevKey) {
        var praw = get(prevKey);
        if (praw !== null) {
          try {
            var pv = JSON.parse(praw);
            recovered.push(key);
            return pv;
          } catch (e2) { /* prev も駄目なら諦める */ }
        }
      }
      recovered.push(key);
      return fallback;
    }
  }

  function load() {
    recovered = [];
    var raw = Data.emptyDB();
    raw.people   = readJSON(K.people,   K.peoplePrev, []);
    raw.memos    = readJSON(K.memos,    K.memosPrev,  []);
    raw.cats     = readJSON(K.cats,     null, Data.DEFAULT_CATS.slice());
    raw.settings = readJSON(K.settings, null, {});
    raw.meta     = readJSON(K.meta,     null, { v: null, seq: 1, lastBackupAt: "" });
    if (!Array.isArray(raw.people)) raw.people = [];
    if (!Array.isArray(raw.memos)) raw.memos = [];

    var stored = get(K.v);
    if (raw.meta.v == null) raw.meta.v = stored ? +stored : Migrate.CURRENT;

    db = Migrate.run(Data.normalize(raw));
    return db;
  }

  function current() { return db; }
  function recoveredKeys() { return recovered.slice(); }
  function lastSaveError() { return lastError; }

  /* 書くのは「最後の操作から0.4秒後」。連打しても1回にまとまる */
  function mark(what) {
    if (what) dirty[what] = 1; else { dirty.people = dirty.memos = dirty.cats = dirty.settings = 1; }
    dirty.meta = 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 400);
  }

  /* ★「ひとつ前」を持つと置き場を2倍使う。
     ふだんは持つ。いっぱいになった時だけ手放して、書けるほうを優先する */
  var keepPrev = true;

  function writeOne(key, prevKey, value) {
    var next = JSON.stringify(value);
    if (prevKey && keepPrev) {
      var old = get(key);
      /* 初回はまだ「ひとつ前」が無い。その時は今書くものを控えにしておく。
         そうしないと、一度も上書きしていない状態で壊れた時に戻せない */
      put(prevKey, old !== null ? old : next);
    }
    put(key, next);
  }

  function writeAll() {
    if (dirty.people)   writeOne(K.people,   K.peoplePrev, db.people);
    if (dirty.memos)    writeOne(K.memos,    K.memosPrev,  db.memos);
    if (dirty.cats)     writeOne(K.cats,     null, db.cats);
    if (dirty.settings) writeOne(K.settings, null, db.settings);
    if (dirty.meta)     writeOne(K.meta,     null, db.meta);
    put(K.v, String(db.meta.v));
  }

  function isQuota(e) {
    return !!e && (e.name === "QuotaExceededError"
      || e.name === "NS_ERROR_DOM_QUOTA_REACHED"
      || e.code === 22 || e.code === 1014);
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!db) return true;
    try {
      writeAll();
      dirty = {};
      lastError = "";
      return true;
    } catch (e) {
      /* いっぱいになった時は、まず「ひとつ前」を手放してもう一度だけ試す。
         置き場が倍使えるようになる。書けずに消えるより、控えを失うほうがまし */
      if (isQuota(e) && keepPrev) {
        keepPrev = false;
        try { localStorage.removeItem(K.peoplePrev); } catch (e2) {}
        try { localStorage.removeItem(K.memosPrev); } catch (e2) {}
        try {
          writeAll();
          dirty = {};
          lastError = "";
          if (window.App && App.showSaveError) {
            App.showSaveError("置き場が狭くなってきたので、やり直し用の控えを手放しました。控えの書き出しをしてください。");
          }
          return true;
        } catch (e3) { e = e3; }
      }
      /* ★握りつぶさない */
      lastError = isQuota(e)
        ? "端末の保存場所がいっぱいです。控えを書き出してから、要らない写真や人を減らしてください。"
        : "保存できませんでした（" + (e && e.message ? e.message : "原因不明") + "）";
      if (window.App && App.showSaveError) App.showSaveError(lastError);
      return false;
    }
  }

  /* 画面から見えるように。true なら「やり直し用の控え」をまだ持っている */
  function hasPrev() { return keepPrev; }

  /* 使っている量（文字のぶん） */
  function usageBytes() {
    var n = 0;
    Object.keys(K).forEach(function (k) {
      var v = get(K[k]);
      if (v) n += v.length * 2;   // UTF-16 でおよそ2バイト
    });
    return n;
  }

  /* 端末に「勝手に消さない」印を頼む（付かなくても動く） */
  function askPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (localStorage.getItem("yujincho.persistAsked")) return;
        localStorage.setItem("yujincho.persistAsked", "1");
        navigator.storage.persist();
      }
    } catch (e) { /* 何もしない */ }
  }

  /* 控えから丸ごと入れ替える */
  function replaceAll(next) {
    db = Data.normalize(next);
    dirty = { people: 1, memos: 1, cats: 1, settings: 1, meta: 1 };
    return flush();
  }

  /* 画面を閉じる時・裏に回る時は必ず書き切る（スマホは急に止められる） */
  window.addEventListener("pagehide", function () { flush(); });
  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  return {
    KEYS: K,
    load: load, current: current, mark: mark, flush: flush,
    recoveredKeys: recoveredKeys, lastSaveError: lastSaveError, hasPrev: hasPrev,
    usageBytes: usageBytes, askPersist: askPersist, replaceAll: replaceAll
  };
})();
