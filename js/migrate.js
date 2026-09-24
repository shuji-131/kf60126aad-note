"use strict";
/* =======================================================
   migrate.js — 版上げ（後から形を変える時の階段）
   決めごと:
     ・欄を消さない（要らなくなっても残して、使わないだけにする）
     ・新しい欄は空でも動くように足す
     ・上げる前に必ず丸ごと控えを1つ残す
   ======================================================= */
var Migrate = {

  CURRENT: 1,

  /* 1 → 2 を作る時はここに足す。
     Migrate.STEPS[2] = function(db){ ... ; return db; }  */
  STEPS: {},

  run: function (db) {
    var cur = Migrate.CURRENT;
    var v = +db.meta.v || 1;
    if (v === cur) return db;

    if (v > cur) {                 /* 新しい端末で作った控えを、古いアプリで開いた */
      db.meta.v = cur;
      return db;
    }

    try {
      localStorage.setItem("yujincho.backup.v" + v, JSON.stringify(db));
    } catch (e) { /* 控えが取れなくても版上げは進める */ }

    while (v < cur) {
      v++;
      if (Migrate.STEPS[v]) db = Migrate.STEPS[v](db);
    }
    db.meta.v = cur;
    return db;
  }
};
