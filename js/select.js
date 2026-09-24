"use strict";
/* =======================================================
   select.js — 絞り込み・並べ替え・数える
   ★画面を一切触らない。入れたら返すだけ
   ======================================================= */
var Select = (function () {

  var ROWS = [
    { k: "ア", r: "アイウエオヴ" },
    { k: "カ", r: "カキクケコガギグゲゴ" },
    { k: "サ", r: "サシスセソザジズゼゾ" },
    { k: "タ", r: "タチツテトダヂヅデド" },
    { k: "ナ", r: "ナニヌネノ" },
    { k: "ハ", r: "ハヒフヘホバビブベボパピプペポ" },
    { k: "マ", r: "マミムメモ" },
    { k: "ヤ", r: "ヤユヨ" },
    { k: "ラ", r: "ラリルレロ" },
    { k: "ワ", r: "ワヲン" }
  ];

  /* ひらがな→カタカナ。小書きも大きい字に寄せる */
  function kata(s) {
    return String(s || "")
      .replace(/[ぁ-ゖ]/g, function (m) { return String.fromCharCode(m.charCodeAt(0) + 0x60); })
      .replace(/[ァィゥェォッャュョヮ]/g, function (m) {
        return { "ァ": "ア", "ィ": "イ", "ゥ": "ウ", "ェ": "エ", "ォ": "オ", "ッ": "ツ", "ャ": "ヤ", "ュ": "ユ", "ョ": "ヨ", "ヮ": "ワ" }[m];
      });
  }

  /* ふりがなが無い人は「他」の行。消さない */
  function rowOf(p) {
    var h = kata(p.kana).replace(/[\s　]/g, "").charAt(0);
    if (!h) return "他";
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].r.indexOf(h) >= 0) return ROWS[i].k;
    return "他";
  }

  function countByRow(people) {
    var c = {};
    people.forEach(function (p) { var r = rowOf(p); c[r] = (c[r] || 0) + 1; });
    return c;
  }

  function daysSince(s) {
    if (!s) return null;
    var a = String(s).split("-");
    var T = new Date(); T = new Date(T.getFullYear(), T.getMonth(), T.getDate());
    return Math.round((T - new Date(+a[0], +a[1] - 1, +a[2])) / 86400000);
  }

  /* ★「●会った」だけを見る。○メモ は数えない。
     ここを混ぜると、見ただけの人が「最近会った人」に化けて計算が狂う */
  function lastMet(p) {
    var best = "";
    p.log.forEach(function (l) {
      if (l.t === "met" && l.d && l.d > best) best = l.d;
    });
    if (!best && p.met && p.met.on) best = p.met.on;
    return best;
  }

  /* 日付なしを先頭に、あとは新しい順 */
  function sortedLog(p) {
    return p.log.slice().sort(function (a, b) {
      if (!a.d && !b.d) return a.at < b.at ? 1 : -1;
      if (!a.d) return -1;
      if (!b.d) return 1;
      if (a.d === b.d) return a.at < b.at ? 1 : -1;
      return a.d < b.d ? 1 : -1;
    });
  }

  function agoText(n) {
    if (n == null) return "";
    if (n <= 0) return "今日";
    if (n === 1) return "きのう";
    if (n < 30) return n + "日";
    if (n < 365) return Math.floor(n / 30) + "か月";
    return Math.floor(n / 365) + "年";
  }

  function allTags(people) {
    var c = {};
    people.forEach(function (p) { p.tags.forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, "ja"); })
      .map(function (t) { return { t: t, n: c[t] }; });
  }

  function haystack(p) {
    return [p.name, p.kana, p.nick, p.org, p.area, p.met.where, p.met.by, p.trait, p.likes, p.dislikes, p.family,
      p.tags.join(" "), p.log.map(function (l) { return l.x; }).join(" ")].join(" ").toLowerCase();
  }

  /* 行・注意・区分・タグ・型・近さ・検索を重ねて絞る */
  function filterPeople(people, c) {
    c = c || {};
    return people.filter(function (p) {
      if (c.row && c.row !== "全" && rowOf(p) !== c.row) return false;
      if (c.alertOnly && !p.alert) return false;
      if (c.cat && p.cat !== c.cat) return false;
      if (c.mbti && p.mbti.code !== c.mbti) return false;
      if (c.love && p.love.code !== c.love) return false;
      if (c.star && p.star < c.star) return false;
      if (c.tags && c.tags.length) {
        for (var i = 0; i < c.tags.length; i++) if (p.tags.indexOf(c.tags[i]) < 0) return false;
      }
      if (c.search && haystack(p).indexOf(String(c.search).toLowerCase()) < 0) return false;
      return true;
    });
  }

  function sortPeople(people, how) {
    var a = people.slice();
    if (how === "cold") {
      return a.sort(function (x, y) {
        var nx = daysSince(lastMet(x)), ny = daysSince(lastMet(y));
        if (nx == null) return 1;
        if (ny == null) return -1;
        return ny - nx;
      });
    }
    if (how === "met") {
      return a.sort(function (x, y) { return (y.met.on || "") < (x.met.on || "") ? -1 : 1; });
    }
    if (how === "star") {
      return a.sort(function (x, y) { return y.star - x.star || kata(x.kana).localeCompare(kata(y.kana), "ja"); });
    }
    /* 既定は50音順。ふりがなが無い人はうしろ */
    return a.sort(function (x, y) {
      var kx = kata(x.kana), ky = kata(y.kana);
      if (!kx && !ky) return x.name.localeCompare(y.name, "ja");
      if (!kx) return 1;
      if (!ky) return -1;
      return kx.localeCompare(ky, "ja");
    });
  }

  function coldPeople(people, days) {
    return people.map(function (p) { return { p: p, n: daysSince(lastMet(p)) }; })
      .filter(function (o) { return o.n != null && o.n >= days; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  /* 月と日が揃っている人だけ */
  function upcomingBirthdays(people, ahead) {
    return people.map(function (p) { return { p: p, n: Birth.daysUntil(p.birth) }; })
      .filter(function (o) { return o.n != null && o.n <= ahead; })
      .sort(function (a, b) { return a.n - b.n; });
  }
  function noMonthDay(people) {
    return people.filter(function (p) { return !Birth.hasMonthDay(p.birth); }).length;
  }
  function noKana(people) {
    return people.filter(function (p) { return !p.kana; });
  }
  function countType(people, kind, code) {
    var n = 0;
    people.forEach(function (p) { if ((kind === "mbti" ? p.mbti.code : p.love.code) === code) n++; });
    return n;
  }

  /* ---- メモ ---- */
  function memoTitle(m) {
    if (m.title) return m.title;
    var head = (m.body || "").split("\n")[0];
    if (!head) return "（題名なし）";
    return head.length > 22 ? head.slice(0, 22) + "…" : head;
  }
  function allMemoTags(memos) {
    var c = {};
    memos.forEach(function (m) { m.tags.forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, "ja"); })
      .map(function (t) { return { t: t, n: c[t] }; });
  }
  function filterMemos(db, c) {
    c = c || {};
    return db.memos.filter(function (m) {
      if (c.todoOnly && !(m.todo && !m.done)) return false;
      if (c.tags && c.tags.length) {
        for (var i = 0; i < c.tags.length; i++) if (m.tags.indexOf(c.tags[i]) < 0) return false;
      }
      if (c.search) {
        var names = m.who.map(function (id) {
          var p = Data.findPerson(db, id); return p ? p.name + " " + p.kana + " " + p.nick : "";
        }).join(" ");
        var hay = [m.title, m.body, m.tags.join(" "), names].join(" ").toLowerCase();
        if (hay.indexOf(String(c.search).toLowerCase()) < 0) return false;
      }
      return true;
    });
  }
  /* ◆ピンが上、あとは新しい順 */
  function sortMemos(memos) {
    return memos.slice().sort(function (a, b) {
      if (!!a.pin !== !!b.pin) return a.pin ? -1 : 1;
      if (a.d !== b.d) return a.d < b.d ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }
  function memosOfPerson(db, id) {
    return sortMemos(db.memos.filter(function (m) { return m.who.indexOf(id) >= 0; }));
  }
  function openTodos(db) {
    return sortMemos(db.memos.filter(function (m) { return m.todo && !m.done; }));
  }

  return {
    ROWS: ROWS, kata: kata, rowOf: rowOf, countByRow: countByRow,
    daysSince: daysSince, lastMet: lastMet, sortedLog: sortedLog, agoText: agoText,
    allTags: allTags, filterPeople: filterPeople, sortPeople: sortPeople,
    coldPeople: coldPeople, upcomingBirthdays: upcomingBirthdays,
    noMonthDay: noMonthDay, noKana: noKana, countType: countType,
    memoTitle: memoTitle, allMemoTags: allMemoTags, filterMemos: filterMemos,
    sortMemos: sortMemos, memosOfPerson: memosOfPerson, openTodos: openTodos
  };
})();
