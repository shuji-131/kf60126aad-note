"use strict";
/* =======================================================
   memolock.js — メモの鍵（画面を触らない。計算と暗号だけ）

   決めごと:
     ・鍵をかけたメモは、題名と中身を暗号にして m.lk に持つ。
       m.title と m.body は空にする＝控えのファイルに書き出しても読めない
       （画面で隠すだけだと、控えを開けば全部見えてしまう）
     ・番号は1つ。全部の鍵つきメモで共通。
       番号そのものは保存しない。合っているかは settings.memoLock.check
       （決まった文字を暗号にしたもの）が開けるかどうかで確かめる
     ・★番号を忘れたら、誰にも開けない。作った側にも開けない。
       逃げ道は「鍵つきのメモを消して、番号を決め直す」だけ
     ・メモごとに、どの塩（salt）で鍵を作ったかを lk.s に書いておく。
       控えを「足す」で取り込んだ時、別の端末で作った鍵つきメモが混ざっても
       同じ番号なら開けるように（塩ごとに鍵を作り直して試す）
     ・開けた鍵は、アプリを離れるまでメモリにだけ置く（保存しない）
     ・暗号は PBKDF2-SHA256 20万回 ＋ AES-256-GCM（ブラウザの標準の道具）
   ======================================================= */
var MemoLock = (function () {

  var ITER = 200000;
  var CHECK_TEXT = "tomolog-memo-lock";
  var MIN_LEN = 4;

  var keys = {};       // 塩 → 開けた鍵（CryptoKey）
  var plain = {};      // メモのid → { title, body }（開けている間だけ）

  function subtle() {
    var c = (typeof crypto !== "undefined") ? crypto : null;
    return c && c.subtle ? c.subtle : null;
  }
  function available() { return !!subtle(); }

  /* ---- 文字 ⇔ 数の並び ---- */
  function b64(buf) {
    var a = new Uint8Array(buf), s = "";
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function rand(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  function derive(pass, saltB64) {
    var enc = new TextEncoder();
    return subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle().deriveKey(
          { name: "PBKDF2", salt: unb64(saltB64), iterations: ITER, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  function seal(key, obj) {
    var iv = rand(12);
    var data = new TextEncoder().encode(JSON.stringify(obj));
    return subtle().encrypt({ name: "AES-GCM", iv: iv }, key, data).then(function (ct) {
      return { iv: b64(iv), ct: b64(ct) };
    });
  }
  function open(key, box) {
    return subtle().decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.ct))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  /* ---- 状態 ---- */
  function conf(db) {
    var c = db && db.settings && db.settings.memoLock;
    return (c && c.s && c.check) ? c : null;
  }
  function hasNumber(db) { return !!conf(db); }
  function isLocked(m) { return !!(m && m.lk && m.lk.ct); }
  function isOpen(db) { var c = conf(db); return !!(c && keys[c.s]); }
  function lockedCount(db) {
    return (db.memos || []).filter(isLocked).length;
  }

  /* 画面に出す中身。鍵が閉じていれば null */
  function textOf(m) {
    if (!isLocked(m)) return { title: m.title, body: m.body };
    return plain[m.id] || null;
  }

  function checkLen(pass) {
    pass = String(pass || "");
    if (pass.length < MIN_LEN) return "番号は" + MIN_LEN + "文字以上にしてください";
    return "";
  }

  /* 番号を初めて決める。鍵はそのまま開いた状態になる */
  function setNumber(db, pass) {
    var err = checkLen(pass);
    if (err) return Promise.reject(new Error(err));
    var s = b64(rand(16));
    return derive(pass, s).then(function (key) {
      return seal(key, { t: CHECK_TEXT }).then(function (check) {
        db.settings.memoLock = { s: s, check: check };
        keys[s] = key;
        return true;
      });
    });
  }

  /* 開けたメモの中身を、全部メモリに取り出しておく。
     塩が違うもの（よそから取り込んだもの）は、同じ番号で鍵を作り直して試す */
  function openAll(db, pass) {
    var salts = {};
    (db.memos || []).forEach(function (m) { if (isLocked(m)) salts[m.lk.s] = 1; });
    delete salts[conf(db).s];
    var extra = Object.keys(salts);
    return Promise.all(extra.map(function (s) {
      if (keys[s]) return null;
      return derive(pass, s).then(function (k) { keys[s] = k; });
    })).then(function () {
      return Promise.all((db.memos || []).filter(isLocked).map(function (m) {
        var k = keys[m.lk.s];
        if (!k) return null;
        return open(k, m.lk).then(function (o) {
          plain[m.id] = { title: String(o.title || ""), body: String(o.body || "") };
        })["catch"](function () { /* 別の番号で作られたもの。閉じたまま */ });
      }));
    });
  }

  /* 番号を確かめて開ける。違えば false */
  function unlock(db, pass) {
    var c = conf(db);
    if (!c) return Promise.resolve(false);
    return derive(String(pass || ""), c.s).then(function (key) {
      return open(key, c.check).then(function (o) {
        if (!o || o.t !== CHECK_TEXT) return false;
        keys[c.s] = key;
        return openAll(db, pass).then(function () { return true; });
      }, function () { return false; });
    });
  }

  /* 閉める＝メモリから消す */
  function lock() { keys = {}; plain = {}; }

  /* メモに鍵をかけて保存する形にする（開いている時だけ呼べる） */
  function sealMemo(db, m, title, body) {
    var c = conf(db);
    if (!c || !keys[c.s]) return Promise.reject(new Error("鍵が閉じています"));
    return seal(keys[c.s], { title: title, body: body }).then(function (box) {
      m.lk = { s: c.s, iv: box.iv, ct: box.ct };
      m.title = ""; m.body = "";
      plain[m.id] = { title: title, body: body };
      return m;
    });
  }

  /* 鍵を外して、ふつうのメモに戻す */
  function unsealMemo(m, title, body) {
    delete m.lk;
    delete plain[m.id];
    m.title = title; m.body = body;
    return m;
  }

  /* 番号を変える。開いているメモを全部、新しい番号でかけ直す。
     開けなかったメモ（別の番号で作られたもの）はそのまま残す */
  function changeNumber(db, pass) {
    var err = checkLen(pass);
    if (err) return Promise.reject(new Error(err));
    if (!isOpen(db)) return Promise.reject(new Error("鍵が閉じています"));
    var s = b64(rand(16));
    return derive(pass, s).then(function (key) {
      return seal(key, { t: CHECK_TEXT }).then(function (check) {
        var targets = (db.memos || []).filter(function (m) { return isLocked(m) && plain[m.id]; });
        return Promise.all(targets.map(function (m) {
          return seal(key, plain[m.id]).then(function (box) {
            m.lk = { s: s, iv: box.iv, ct: box.ct };
          });
        })).then(function () {
          db.settings.memoLock = { s: s, check: check };
          keys = {}; keys[s] = key;
          return targets.length;
        });
      });
    });
  }

  /* 番号を忘れた時。鍵つきのメモを消して、番号も無かったことにする */
  function forget(db) {
    var before = (db.memos || []).length;
    db.memos = (db.memos || []).filter(function (m) { return !isLocked(m); });
    delete db.settings.memoLock;
    lock();
    return before - db.memos.length;
  }

  /* 開けている間だけ、鍵つきメモの中身でも探せるようにする */
  function searchText(m) {
    var t = textOf(m);
    return t ? (t.title + "\n" + t.body) : "";
  }

  return {
    MIN_LEN: MIN_LEN, ITER: ITER,
    available: available, hasNumber: hasNumber, isLocked: isLocked, isOpen: isOpen,
    lockedCount: lockedCount, textOf: textOf, checkLen: checkLen,
    setNumber: setNumber, unlock: unlock, lock: lock,
    sealMemo: sealMemo, unsealMemo: unsealMemo,
    changeNumber: changeNumber, forget: forget, searchText: searchText
  };
})();
