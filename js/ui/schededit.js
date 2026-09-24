"use strict";
/* =======================================================
   ui/schededit.js — 予定を入れる・直す（下から出る紙）
   日付は必須（過ぎたかどうかを数えるため）。
   時刻は空でよい＝「その日のどこか」を表せるようにしてある。
   ★ここで入れたものは、日付が過ぎたら sched.js が記録へ移す
   ======================================================= */
var UI = window.UI || {};

UI.openSchedEdit = function (p, schedId) {
  var db = Store.current();
  var isNew = !schedId;
  var s = isNew ? Data.blankSched(db) : (function () {
    var f = Sched.find(p, schedId);
    return f ? JSON.parse(JSON.stringify(f)) : null;
  })();
  if (!s) return;
  if (isNew) Store.mark("meta");        // seq を進めたので書いておく

  function body() {
    var n = Sched.daysUntil(s);
    var note = !s.d ? "日付を入れてください"
      : (n < 0 ? "この日はもう過ぎています。残すとそのまま「記録」へ入ります"
               : Sched.whenText(n) + "（" + s.d.replace(/-/g, "/") + "）");
    return '<label class="fld"><span class="lb">日付<em>必須</em></span>' +
        '<input type="date" id="scDate" value="' + UI.esc(s.d) + '">' +
        '<span class="hlp">' + UI.esc(note) + '</span></label>' +
      '<label class="fld"><span class="lb">時刻（空でよい）</span>' +
        '<div class="crow"><input type="time" id="scTime" value="' + UI.esc(s.tm) + '">' +
        (s.tm ? '<button class="btn ghost sm" id="scNoTime">時刻なしにする</button>' : '') +
        '</div>' +
        '<span class="hlp">空のままだと「その日のどこか」になります。' +
        '<b>時刻を過ぎても、その日いっぱいは予定に残ります</b></span></label>' +
      '<label class="fld"><span class="lb">内容</span>' +
        '<textarea id="scText" rows="4" placeholder="天神で打ち合わせ。前に話していた件の返事をもらう">' +
        UI.esc(s.x) + '</textarea></label>' +
      '<p class="sheet-msg">日付が過ぎると、この内容は自動で「記録」へ移って残ります。' +
      '会えたのなら、移った記録を押して<b>「● 会った」</b>に付け替えてください' +
      '（そうすると、ごぶさたの数え直しに入ります）。</p>';
  }

  function grabText(h) { var t = h.querySelector("#scText"); if (t) s.x = t.value; }
  function grab(h) {
    grabText(h);
    var d = h.querySelector("#scDate"), t = h.querySelector("#scTime");
    if (d) s.d = d.value;
    if (t) s.tm = t.value;
  }

  function open() {
    UI.sheet({
      title: isNew ? "予定を入れる" : "予定を直す",
      body: body(),
      foot: (isNew ? '' : '<button class="btn danger ghost" id="scDel">消す</button>') +
            '<button class="btn ghost" data-sheet="close">やめる</button>' +
            '<button class="btn primary" id="scSave">残す</button>',
      bind: function (h) {
        var nt = h.querySelector("#scNoTime");
        if (nt) nt.onclick = function () { grab(h); s.tm = ""; open(); };

        /* 日付を入れ替えたら「あと何日」の言葉もその場で直す */
        var dn = h.querySelector("#scDate");
        if (dn) dn.addEventListener("change", function () { grab(h); open(); });

        h.querySelector("#scSave").onclick = function () {
          grab(h);
          if (!s.d) { UI.toast("予定は日付が要ります", "warn"); return; }
          s.at = Data.nowStr();
          if (!Array.isArray(p.sched)) p.sched = [];
          if (isNew) p.sched.push(s);
          else for (var i = 0; i < p.sched.length; i++) if (p.sched[i].id === s.id) p.sched[i] = s;
          Data.touch(p);

          /* ★過去の日付で入れられたら、その場で記録へ送る。
             予定の欄に過ぎたものを置いたままにしない */
          var moved = Sched.sweep(db);
          Store.mark("people"); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast(moved ? "日が過ぎているので、記録へ入れました"
                         : (isNew ? "予定を入れました" : "直しました"));
        };

        var del = h.querySelector("#scDel");
        if (del) del.onclick = function () {
          UI.closeSheet();
          UI.confirm("この予定を消しますか",
            "記録には残りません。元に戻せません。\n（過ぎるのを待てば、中身は記録へ移って残ります）",
            "消す", function () {
              if (!Sched.remove(p, s.id)) return;
              Data.touch(p);
              Store.mark("people"); Store.flush();
              App.render(); UI.toast("消しました");
            }, true);
        };
      }
    });
  }

  open();
};
window.UI = UI;
