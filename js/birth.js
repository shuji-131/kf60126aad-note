"use strict";
/* =======================================================
   birth.js — 生年月日
   「分からない」の扱いを、ぜんぶここに閉じ込める。
   b = { y:年, m:月, d:日, age:年齢だけ分かる時, ageAt:その年齢を聞いた日 }
   ======================================================= */
var Birth = (function () {

  function today() { return new Date(); }

  function parseD(s) {
    var a = String(s || "").split("-");
    return new Date(+a[0], +a[1] - 1, +a[2]);
  }

  /* 年齢。{n:歳, approx:「くらい」を付けるか} / 分からなければ null */
  function ageOf(b) {
    b = b || {};
    var T = today();
    if (b.y) {
      var a = T.getFullYear() - b.y;
      if (b.m && b.d) {
        if (T < new Date(T.getFullYear(), b.m - 1, b.d)) a--;
        return { n: a, approx: false };          // 全部分かる＝正確
      }
      if (b.m) {                                  // 日が不明＝月の中で1歳ずれる
        if (T.getMonth() + 1 < b.m) a--;
        return { n: a, approx: true };
      }
      return { n: a, approx: true };              // 年だけ＝誕生日前なら1つ下
    }
    if (b.age != null && b.age !== "") {          // 年齢だけ。聞いた日から年数を足す
      var add = b.ageAt ? Math.floor((T - parseD(b.ageAt)) / 86400000 / 365.25) : 0;
      if (add < 0) add = 0;
      return { n: +b.age + add, approx: true };
    }
    return null;
  }

  function ageText(b) {
    var a = ageOf(b);
    return a ? a.n + "歳" + (a.approx ? "くらい" : "") : "";
  }

  /* 表示。分かっている所だけ並べ、抜けは「不明」と書く */
  function text(b) {
    b = b || {};
    var s;
    if (b.y && b.m && b.d) s = b.y + "年" + b.m + "月" + b.d + "日";
    else if (b.y && b.m)   s = b.y + "年" + b.m + "月（日は不明）";
    else if (b.m && b.d)   s = b.m + "月" + b.d + "日（年は不明）";
    else if (b.y)          s = b.y + "年生まれ（月日は不明）";
    else if (b.m)          s = b.m + "月ごろ（年と日は不明）";
    else if (ageOf(b))     return ageText(b) + "（生年月日は不明）";
    else return "";
    var a = ageText(b);
    return a ? s + " — " + a : s;
  }

  /* 誕生日まであと何日。月と日の両方が分かっている人だけ数える */
  function daysUntil(b) {
    b = b || {};
    if (!b.m || !b.d) return null;
    var T = today();
    T = new Date(T.getFullYear(), T.getMonth(), T.getDate());
    var t = new Date(T.getFullYear(), b.m - 1, b.d);
    if (t < T) t = new Date(T.getFullYear() + 1, b.m - 1, b.d);
    return Math.round((t - T) / 86400000);
  }

  function label(b) { return b.m + "月" + b.d + "日"; }
  function hasMonthDay(b) { return !!(b && b.m && b.d); }

  /* 入力の下書きを、残す形に整える。
     ★月が空で日だけ、は使えないので日を捨てる */
  var LIMITS = { y: [1900, new Date().getFullYear()], m: [1, 12], d: [1, 31], age: [0, 120] };

  function clean(draft, mode) {
    var b = { y: null, m: null, d: null, age: null, ageAt: null };
    if (mode === "age") {
      if (draft.age != null && draft.age !== "") {
        b.age = clamp(+draft.age, "age");
        b.ageAt = Data.todayStr();
      }
    } else {
      if (draft.y) b.y = clamp(+draft.y, "y");
      if (draft.m) b.m = clamp(+draft.m, "m");
      if (draft.m && draft.d) b.d = clamp(+draft.d, "d");
    }
    return b;
  }
  function clamp(v, k) {
    var l = LIMITS[k];
    if (!(v >= l[0])) v = l[0];
    if (v > l[1]) v = l[1];
    return v;
  }
  function isEmpty(b) {
    return !(b && (b.y || b.m || b.d || b.age != null));
  }

  return {
    ageOf: ageOf, ageText: ageText, text: text,
    daysUntil: daysUntil, label: label, hasMonthDay: hasMonthDay,
    clean: clean, clamp: clamp, isEmpty: isEmpty, LIMITS: LIMITS
  };
})();
