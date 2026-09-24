"use strict";
/* =======================================================
   ui/care.js — 気にかける
   ごぶさた／メモのやること／誕生日が近い人
   ======================================================= */
var UI = window.UI || {};

UI.viewCare = function () {
  var db = Store.current();
  var days = db.settings.coldDays, ahead = db.settings.bdayAhead;
  var sAhead = db.settings.schedAhead;

  /* 近い予定。日が過ぎたぶんは起動時に記録へ移っているので、ここには出ない */
  var plans = Sched.upcoming(db, sAhead);
  var nToday = Sched.countToday(db);
  var planHtml = plans.length
    ? plans.map(function (o) {
        return UI.personRow(o.p,
          "予定　" + Sched.label(o.s) + (o.s.x ? "　" + o.s.x : ""),
          '<span class="' + (o.n === 0 ? "cold" : "") + '">' + Sched.whenText(o.n) + '</span>');
      }).join("")
    : UI.empty(sAhead + "日先までに予定はありません。人の頁の「予定」から入れられます");

  var cold = Select.coldPeople(db.people, days);
  var coldHtml = cold.length
    ? cold.map(function (o) {
        return UI.personRow(o.p, "最後に会ったのは " + (Select.lastMet(o.p) || "—").replace(/-/g, "/"),
          '<span class="cold">' + Select.agoText(o.n) + '</span>');
      }).join("")
    : UI.empty(days + "日以上会っていない人はいません");

  var todos = Select.openTodos(db);
  var todoHtml = todos.length
    ? UI.sec("メモのやること") + '<p class="secnote">済にすると、ここから消えます</p>' + todos.map(UI.memoRow).join("")
    : "";

  var bd = Select.upcomingBirthdays(db.people, ahead);
  var noMD = Select.noMonthDay(db.people);
  var bdHtml = bd.length
    ? bd.map(function (o) {
        var ag = Birth.ageText(o.p.birth);
        return UI.personRow(o.p, Birth.label(o.p.birth) + (ag ? "　" + ag : ""),
          (o.n === 0 ? "今日" : "あと" + o.n + "日"));
      }).join("")
    : UI.empty(ahead + "日先までにはいません");

  return UI.appbar({ title: "気にかける" }) +
    '<div class="view">' +
      (nToday
        ? '<div class="callout">今日の予定が <b>' + nToday + '件</b>あります。</div>'
        : '') +
      UI.sec("近い予定（" + sAhead + "日先まで）", '<button data-act="schedahead">日数を変える</button>') +
      '<p class="secnote">日付が過ぎたぶんは、その人の「記録」へ自動で移ります</p>' +
      planHtml +
      (cold.length
        ? '<div class="callout">しばらく会っていない人が <b>' + cold.length + '人</b>います。<br>「○メモ」だけの人は会ったことにしていません。</div>'
        : '') +
      UI.sec("ごぶさた（" + days + "日以上）", '<button data-act="colddays">日数を変える</button>') +
      coldHtml +
      todoHtml +
      UI.sec("誕生日が近い（" + ahead + "日先まで）") +
      (noMD ? '<p class="secnote">月と日が揃っていない人が ' + noMD + '人 います。ここには出てきません</p>' : '') +
      bdHtml +
      '<div style="height:26px"></div>' +
    '</div>' + UI.tabbar();
};

UI.askColdDays = function () {
  var db = Store.current();
  var opts = [30, 60, 90, 180, 365];
  UI.sheet({
    title: "ごぶさたとみなす日数",
    body: '<div class="pickrow">' + opts.map(function (n) {
        return '<button class="btn ' + (db.settings.coldDays === n ? "primary" : "ghost") + '" data-cd="' + n + '">' + n + '日</button>';
      }).join("") + '</div>' +
      '<p class="sheet-msg">この日数より長く会っていない人が「ごぶさた」に並びます。<br>下タブの印の数もこれで変わります。</p>',
    bind: function (h) {
      h.querySelectorAll("[data-cd]").forEach(function (b) {
        b.onclick = function () {
          db.settings.coldDays = +b.dataset.cd;
          Store.mark("settings"); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast(b.dataset.cd + "日にしました");
        };
      });
    }
  });
};

UI.askSchedAhead = function () {
  var db = Store.current();
  var opts = [7, 14, 30, 60, 90];
  UI.sheet({
    title: "予定を何日先まで出すか",
    body: '<div class="pickrow">' + opts.map(function (n) {
        return '<button class="btn ' + (db.settings.schedAhead === n ? "primary" : "ghost") + '" data-sa="' + n + '">' + n + '日</button>';
      }).join("") + '</div>' +
      '<p class="sheet-msg">この日数より先の予定は、ここには出しません。<br>' +
      'その人の頁の「予定」には、先の日付のものも全部出ています。</p>',
    bind: function (h) {
      h.querySelectorAll("[data-sa]").forEach(function (b) {
        b.onclick = function () {
          db.settings.schedAhead = +b.dataset.sa;
          Store.mark("settings"); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast(b.dataset.sa + "日にしました");
        };
      });
    }
  });
};
window.UI = UI;
