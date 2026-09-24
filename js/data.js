"use strict";
/* =======================================================
   data.js — 中身の形（何を残すか）
   ここが一次資料。ほかのファイルはこの形を前提に動く。
   ★空を許す欄は、空のまま持つ（0章の考え方）
   ======================================================= */
var Data = (function () {

  var DEFAULT_CATS = [
    { k: "会社関連",  c: "#3A6EA8" },
    { k: "取引先",    c: "#6E6AA8" },
    { k: "友人",      c: "#3E8C9E" },
    { k: "家族・親戚", c: "#4F8A5B" },
    { k: "その他",    c: "#8895A6" }
  ];

  var DEFAULT_SETTINGS = {
    coldDays: 90,     // ごぶさたとみなす日数
    bdayAhead: 60,    // 誕生日を何日先まで出すか
    schedAhead: 30,   // 予定を何日先まで「気にかける」に出すか
    sort: "kana"      // kana | cold | met | star
  };

  function p2(n) { return (n < 10 ? "0" : "") + n; }

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  }
  function nowStr() {
    var d = new Date();
    return todayStr(d) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
  }

  /* 空のいれもの */
  function emptyDB() {
    return {
      people: [],
      memos: [],
      cats: DEFAULT_CATS.slice(),
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      meta: { v: 1, seq: 1, lastBackupAt: "" }
    };
  }

  /* id は一度決めたら変えない。控えを戻す時の目印になる */
  function nextId(db, prefix) {
    var n = db.meta.seq || 1;
    db.meta.seq = n + 1;
    return prefix + "_" + ("000" + n).slice(-4);
  }

  function blankPerson(db) {
    return {
      id: nextId(db, "p"),
      name: "", kana: "", nick: "",
      cat: DEFAULT_CATS[2].k,
      alert: false, alertWhy: "",
      star: 3,
      org: "", area: "", family: "", trait: "", likes: "", avoid: "",
      contacts: [],
      tags: [],
      mbti: { code: "", sure: "" },     // sure: "said" | "guess" | ""
      love: { code: "", sure: "" },
      birth: { y: null, m: null, d: null, age: null, ageAt: null },
      met: { on: "", where: "", by: "" },
      photo: null,
      log: [],
      sched: [],
      createdAt: nowStr(), updatedAt: nowStr()
    };
  }

  function blankMemo(db) {
    return {
      id: nextId(db, "m"),
      title: "", body: "",
      d: todayStr(),
      tags: [], who: [],
      pin: false, todo: false, done: false,
      createdAt: nowStr(), updatedAt: nowStr()
    };
  }

  function blankLog(db, kind) {
    return {
      id: nextId(db, "l"),
      t: kind || "met",                 // "met" = ●会った / "note" = ○メモ
      plan: false,                      // ★true = 予定が過ぎて移ってきたもの（◇予定だった）
      d: kind === "note" ? "" : todayStr(),   // ★メモは空を許す
      tm: "",                           // 時刻。空でよい（予定から移った時だけ入る）
      x: "",
      at: nowStr()
    };
  }

  /* 予定（記録とは別の入れもの）。
     ★日付は必須・時刻は空でよい。日が過ぎたら sched.js が記録へ移す */
  function blankSched(db) {
    return {
      id: nextId(db, "s"),
      d: todayStr(),
      tm: "",
      x: "",
      at: nowStr()
    };
  }

  function touch(o) { o.updatedAt = nowStr(); }

  /* 読み込んだものに欠けている欄を足す。
     版上げ（migrate）とは別で、こちらは「新しい欄が空でも動く」ための保険 */
  function normalize(db) {
    if (!db || typeof db !== "object") db = emptyDB();
    if (!Array.isArray(db.people)) db.people = [];
    if (!Array.isArray(db.memos)) db.memos = [];
    if (!Array.isArray(db.cats) || !db.cats.length) db.cats = DEFAULT_CATS.slice();
    db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
    db.meta = Object.assign({ v: 1, seq: 1, lastBackupAt: "" }, db.meta || {});

    db.people.forEach(function (p) {
      if (typeof p.name !== "string") p.name = "";
      ["kana", "nick", "org", "area", "family", "trait", "likes", "avoid", "alertWhy"].forEach(function (k) {
        if (typeof p[k] !== "string") p[k] = "";
      });
      if (!p.cat) p.cat = DEFAULT_CATS[4].k;
      p.alert = !!p.alert;
      p.star = +p.star || 3;
      /* 連絡先。1人に何件でも入る。中身が {k,v} の形で揃っていないと
         リンクの判定（Data.linkOf）が転ぶので、ここで整える */
      if (!Array.isArray(p.contacts)) p.contacts = [];
      p.contacts = p.contacts.filter(function (c) { return c && typeof c === "object"; });
      p.contacts.forEach(function (c) {
        ["k", "v"].forEach(function (k) {
          if (typeof c[k] === "string") return;
          /* 手で直した控えだと番号が数字で入っていることがある。
             文字に直して残す（捨てると連絡先そのものが消える）。
             それ以外（入れ子など）は空にする */
          c[k] = (typeof c[k] === "number" || typeof c[k] === "boolean") ? String(c[k]) : "";
        });
      });
      if (!Array.isArray(p.tags)) p.tags = [];
      if (!p.mbti || typeof p.mbti !== "object") p.mbti = { code: "", sure: "" };
      if (!p.love || typeof p.love !== "object") p.love = { code: "", sure: "" };
      if (!p.birth || typeof p.birth !== "object") p.birth = {};
      ["y", "m", "d", "age"].forEach(function (k) {
        p.birth[k] = (p.birth[k] === 0 || p.birth[k]) ? +p.birth[k] : null;
      });
      if (!p.birth.ageAt) p.birth.ageAt = null;
      if (!p.met || typeof p.met !== "object") p.met = { on: "", where: "", by: "" };
      if (!Array.isArray(p.log)) p.log = [];
      p.log.forEach(function (l) {
        if (l.t !== "note") l.t = "met";
        if (typeof l.d !== "string") l.d = "";
        if (typeof l.x !== "string") l.x = "";
        if (typeof l.tm !== "string") l.tm = "";
        /* ★予定から移ってきた印。●会った には付かない
           （会えたかどうかは分からないので、ごぶさたの計算に混ぜない） */
        l.plan = (l.t === "note") && !!l.plan;
      });

      /* 予定。新しい欄なので、古い名簿には無い。空で足す */
      if (!Array.isArray(p.sched)) p.sched = [];
      p.sched = p.sched.filter(function (s) { return s && typeof s === "object"; });
      p.sched.forEach(function (s) {
        ["d", "tm", "x"].forEach(function (k) { if (typeof s[k] !== "string") s[k] = ""; });
        if (!s.at) s.at = nowStr();
      });
      if (!p.photo) p.photo = null;
      if (!p.createdAt) p.createdAt = nowStr();
      if (!p.updatedAt) p.updatedAt = p.createdAt;
    });

    db.memos.forEach(function (m) {
      ["title", "body", "d"].forEach(function (k) { if (typeof m[k] !== "string") m[k] = ""; });
      if (!Array.isArray(m.tags)) m.tags = [];
      if (!Array.isArray(m.who)) m.who = [];
      m.pin = !!m.pin; m.todo = !!m.todo; m.done = !!m.done;
      if (!m.createdAt) m.createdAt = nowStr();
      if (!m.updatedAt) m.updatedAt = m.createdAt;
    });

    /* 消えた人を指しているメモの who を掃除する */
    var alive = {};
    db.people.forEach(function (p) { alive[p.id] = 1; });
    db.memos.forEach(function (m) {
      m.who = m.who.filter(function (id) { return alive[id]; });
    });

    /* seq が小さすぎると id がぶつかる。使われている番号の最大＋1 に直す */
    var mx = 0;
    function scan(id) {
      var n = +String(id || "").split("_")[1];
      if (n && n > mx) mx = n;
    }
    db.people.forEach(function (p) {
      scan(p.id);
      p.log.forEach(function (l) { scan(l.id); });
      p.sched.forEach(function (s) { scan(s.id); });
    });
    db.memos.forEach(function (m) { scan(m.id); });
    if (!(db.meta.seq > mx)) db.meta.seq = mx + 1;

    /* ★id が無いものに番号を振るのは、seq を直したあと。
       先に振ると、使われている番号とぶつかる */
    db.people.forEach(function (p) {
      p.log.forEach(function (l) { if (!l.id) l.id = nextId(db, "l"); });
      p.sched.forEach(function (s) { if (!s.id) s.id = nextId(db, "s"); });
    });

    return db;
  }

  /* 人を消す。メモの結びつけと写真も一緒に始末する（呼ぶのはここだけ） */
  function removePerson(db, id) {
    var p = findPerson(db, id);
    db.people = db.people.filter(function (x) { return x.id !== id; });
    db.memos.forEach(function (m) {
      var i = m.who.indexOf(id);
      if (i >= 0) { m.who.splice(i, 1); touch(m); }
    });
    if (p && p.photo && window.Photos) Photos.remove(p.photo);
    return p;
  }

  function removeMemo(db, id) {
    db.memos = db.memos.filter(function (m) { return m.id !== id; });
  }

  function findPerson(db, id) {
    for (var i = 0; i < db.people.length; i++) if (db.people[i].id === id) return db.people[i];
    return null;
  }
  function findMemo(db, id) {
    for (var i = 0; i < db.memos.length; i++) if (db.memos[i].id === id) return db.memos[i];
    return null;
  }
  /* ★連絡先に貼られた文字が「開けるリンク」かどうかを決める（ここ1か所だけ）。
     通すのは http / https だけ。javascript: や data: を通すと、
     貼り付けた文字がそのまま命令として動いてしまう。
     戻り値は開く先のURL。リンクでなければ空文字 */
  function linkOf(v) {
    var t = String(v == null ? "" : v).trim();
    if (!t || /\s/.test(t)) return "";          // 途中に空白があるものは住所ではない
    if (/^https?:\/\/[^\s]+$/i.test(t)) return t;
    if (/^www\.[^\s]+\.[^\s]+$/i.test(t)) return "https://" + t;   // www. で始まるものは補う
    return "";
  }

  function catColor(db, k) {
    for (var i = 0; i < db.cats.length; i++) if (db.cats[i].k === k) return db.cats[i].c;
    return "#8895A6";
  }

  return {
    DEFAULT_CATS: DEFAULT_CATS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    emptyDB: emptyDB, normalize: normalize,
    nextId: nextId, blankPerson: blankPerson, blankMemo: blankMemo, blankLog: blankLog,
    blankSched: blankSched,
    touch: touch, todayStr: todayStr, nowStr: nowStr,
    findPerson: findPerson, findMemo: findMemo, catColor: catColor, linkOf: linkOf,
    removePerson: removePerson, removeMemo: removeMemo
  };
})();
