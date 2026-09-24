"use strict";
/* =======================================================
   sched.js — 人ごとの予定と、過ぎたぶんの片づけ
   ★画面を一切触らない。入れたら返すだけ（select.js と同じ決まり）

   決めごと:
     ・予定は p.sched に持つ。記録（p.log）とは別の入れもの。
       混ぜると「これから会う」と「もう会った」が見分けられなくなる
     ・日付は必須。時刻は空でよい（「その日のどこか」を表せるように）
     ・★記録へ移すのは「その日が終わってから」。時刻を過ぎた瞬間ではない。
       14:00 の予定が 14:01 に消えると、当日の予定表として使えなくなる。
       時刻を過ぎたぶんは、その日のうちは「時間が過ぎました」と見せておき、
       すぐ片づけたい時だけ手で移せるようにする（moveOne）
     ・★移したものは log の ○メモ（plan の印つき）にする。●会った にはしない。
       会えたかどうかは分からないので、ごぶさたの計算を狂わせてはいけない
       （select.js の lastMet は t==="met" だけを見る）。
       実際に会えたのなら、記録を押して「● 会った」に付け替える
     ・★t は増やさない。古い版のアプリで開いても ○メモ として素直に読めるように、
       印は plan:true という別の欄で持つ（normalize が t を met/note に丸めるため）
   ======================================================= */
var Sched = (function () {

  function p2(n) { return (n < 10 ? "0" : "") + n; }

  /* いまの時刻 "HH:MM"。予定の tm と同じ形 */
  function nowHM(d) {
    d = d || new Date();
    return p2(d.getHours()) + ":" + p2(d.getMinutes());
  }

  /* 日付の早い順。同じ日なら時刻の早い順。
     時刻なし（その日のどこか）は、その日の先頭に置く */
  function sorted(list) {
    return (list || []).slice().sort(function (a, b) {
      if (a.d !== b.d) return a.d < b.d ? -1 : 1;
      if (!a.tm && !b.tm) return a.at < b.at ? -1 : 1;
      if (!a.tm) return -1;
      if (!b.tm) return 1;
      if (a.tm !== b.tm) return a.tm < b.tm ? -1 : 1;
      return a.at < b.at ? -1 : 1;
    });
  }

  function of(p) { return sorted(p && p.sched); }

  function find(p, id) {
    var a = (p && p.sched) || [];
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }

  /* 今日まであと何日。今日なら 0、過ぎていれば負 */
  function daysUntil(s) {
    if (!s || !s.d) return null;
    var n = Select.daysSince(s.d);
    return n == null ? null : -n;
  }

  /* その日が終わっているか＝記録へ移す合図 */
  function isPast(s, today) {
    return !!(s && s.d && s.d < (today || Data.todayStr()));
  }

  /* 今日のぶんで、時刻だけもう過ぎているか（移さずに印だけ付ける） */
  function isOverdueToday(s, today, hm) {
    if (!s || !s.d) return false;
    return s.d === (today || Data.todayStr()) && !!s.tm && s.tm < (hm || nowHM());
  }

  /* 予定 → 記録。中身はそのまま持っていく */
  function toLog(db, s) {
    return {
      id: Data.nextId(db, "l"),
      t: "note",          /* ★met にしない。会えたかは分からない */
      plan: true,         /* 「予定だったもの」の印 */
      d: s.d,
      tm: s.tm || "",
      x: s.x || "",
      at: Data.nowStr()
    };
  }

  /* ★日が過ぎた予定を、まとめて記録へ移す。
     何度呼んでも同じ結果になる（移したぶんは sched から消えるので二重にならない）。
     返すのは移した件数。0 なら保存しに行かなくてよい */
  function sweep(db, today) {
    today = today || Data.todayStr();
    var moved = 0;
    (db.people || []).forEach(function (p) {
      if (!Array.isArray(p.sched) || !p.sched.length) return;
      var keep = [];
      sorted(p.sched).forEach(function (s) {
        if (isPast(s, today)) { p.log.push(toLog(db, s)); moved++; }
        else keep.push(s);
      });
      if (keep.length !== p.sched.length) { p.sched = keep; Data.touch(p); }
    });
    return moved;
  }

  /* 1件だけ手で移す（「今すぐ記録へ」） */
  function moveOne(db, p, id) {
    var s = find(p, id);
    if (!s) return false;
    p.log.push(toLog(db, s));
    p.sched = p.sched.filter(function (x) { return x.id !== id; });
    Data.touch(p);
    return true;
  }

  function remove(p, id) {
    var before = (p.sched || []).length;
    p.sched = (p.sched || []).filter(function (x) { return x.id !== id; });
    return p.sched.length !== before;
  }

  /* 名簿ぜんぶを見て、近い予定を日付の早い順に並べる（気にかける画面用） */
  function upcoming(db, ahead, today) {
    today = today || Data.todayStr();
    var out = [];
    (db.people || []).forEach(function (p) {
      (p.sched || []).forEach(function (s) {
        var n = daysUntil(s);
        if (n == null || n < 0) return;               /* 過ぎたぶんは sweep が片づける */
        if (ahead != null && n > ahead) return;
        out.push({ p: p, s: s, n: n });
      });
    });
    return out.sort(function (a, b) {
      if (a.s.d !== b.s.d) return a.s.d < b.s.d ? -1 : 1;
      if (!a.s.tm && !b.s.tm) return 0;
      if (!a.s.tm) return -1;
      if (!b.s.tm) return 1;
      return a.s.tm < b.s.tm ? -1 : (a.s.tm > b.s.tm ? 1 : 0);
    });
  }

  function countAll(db) {
    var n = 0;
    (db.people || []).forEach(function (p) { n += (p.sched || []).length; });
    return n;
  }
  function countToday(db, today) {
    today = today || Data.todayStr();
    var n = 0;
    (db.people || []).forEach(function (p) {
      (p.sched || []).forEach(function (s) { if (s.d === today) n++; });
    });
    return n;
  }

  /* ---- 言葉にする ---- */
  function label(s) {
    if (!s || !s.d) return "";
    return s.d.replace(/-/g, "/") + (s.tm ? "　" + s.tm : "");
  }
  function whenText(n) {
    if (n == null) return "";
    if (n < 0) return "過ぎています";
    if (n === 0) return "今日";
    if (n === 1) return "あす";
    if (n < 30) return "あと" + n + "日";
    if (n < 365) return "あと" + Math.floor(n / 30) + "か月";
    return "あと" + Math.floor(n / 365) + "年";
  }

  return {
    nowHM: nowHM, sorted: sorted, of: of, find: find,
    daysUntil: daysUntil, isPast: isPast, isOverdueToday: isOverdueToday,
    toLog: toLog, sweep: sweep, moveOne: moveOne, remove: remove,
    upcoming: upcoming, countAll: countAll, countToday: countToday,
    label: label, whenText: whenText
  };
})();
