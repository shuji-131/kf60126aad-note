"use strict";
/* =======================================================
   ui/logedit.js — 記録を書く・直す（下から出る紙）
   ●会った は日付が要る（会っていない日数を数えるため）
   ○メモ は日付を空のままでも登録できる
   ======================================================= */
var UI = window.UI || {};

UI.openLogEdit = function (p, logId) {
  var db = Store.current();
  var isNew = !logId;
  var e = isNew ? Data.blankLog(db, "met") : (function () {
    for (var i = 0; i < p.log.length; i++) if (p.log[i].id === logId) return JSON.parse(JSON.stringify(p.log[i]));
    return null;
  })();
  if (!e) return;

  /* ★t は met / note の2つだけ。「予定だった」は note に plan の印を足して表す
     （t を増やすと、古い版のアプリが読んだ時に met に丸められて
       「会った」に化け、ごぶさたの計算が狂う） */
  function kindOf() { return e.plan ? "plan" : e.t; }
  function setKind(k) {
    if (k === "plan") { e.t = "note"; e.plan = true; }
    else { e.t = k; e.plan = false; }
  }

  function body() {
    var k = kindOf();
    return '<div class="seg three" style="margin-bottom:14px">' +
        '<button type="button" data-kind="met" class="' + (k === "met" ? "on" : "") + '">● 会った</button>' +
        '<button type="button" data-kind="note" class="' + (k === "note" ? "on" : "") + '">○ メモ</button>' +
        '<button type="button" data-kind="plan" class="' + (k === "plan" ? "on" : "") + '">◇ 予定だった</button>' +
      '</div>' +
      (k === "plan"
        ? '<p class="sheet-msg">過ぎた予定が移ってきたものです。' +
          '<b>実際に会えたのなら「● 会った」に付け替えてください</b>' +
          '（ごぶさたの数え直しに入ります）。◇のままだと会ったことにはなりません。</p>'
        : '') +
      '<label class="fld"><span class="lb">日付' + (k === "met" ? '<em>必須</em>' : '（空でよい）') + '</span>' +
        '<div class="crow"><input ' + UI.NOAUTO + 'type="date" id="logDate" value="' + UI.esc(e.d) + '">' +
        (k !== "met" ? '<button class="btn ghost sm" id="logNoDate">日付なしにする</button>' : '') +
        '</div>' +
        '<span class="hlp">' + (k === "met"
          ? "会っていない日数を数えるので、日付が要ります"
          : "空のままだと記録の<b>一番上</b>にまとまります。あとから足せます") + '</span></label>' +
      (k === "plan"
        ? '<label class="fld"><span class="lb">時刻（空でよい）</span>' +
          '<input ' + UI.NOAUTO + 'type="time" id="logTime" value="' + UI.esc(e.tm) + '"></label>'
        : '') +
      '<label class="fld"><span class="lb">内容</span>' +
        '<textarea ' + UI.NOAUTO + 'id="logText" rows="5" placeholder="' +
        (k === "met" ? "薬院のカフェで2時間。仕事を続けるか迷っていると。次に会ったら聞く"
         : k === "plan" ? "天神で打ち合わせ"
                       : "インスタで猫を飼い始めたと投稿。名前はもなか") + '">' + UI.esc(e.x) + '</textarea></label>';
  }

  function open() {
    UI.sheet({
      title: isNew ? "記録を書く" : "記録を直す",
      body: body(),
      foot: (isNew ? '' : '<button class="btn danger ghost" id="logDel">消す</button>') +
            '<button class="btn ghost" data-sheet="close">やめる</button>' +
            '<button class="btn primary" id="logSave">残す</button>',
      bind: function (h) {
        h.querySelectorAll("[data-kind]").forEach(function (b) {
          b.onclick = function () {
            grab(h);
            setKind(b.dataset.kind);
            if (e.t === "met" && !e.d) e.d = Data.todayStr();
            open();
          };
        });
        var nd = h.querySelector("#logNoDate");
        if (nd) nd.onclick = function () { e.d = ""; grabText(h); open(); };

        h.querySelector("#logSave").onclick = function () {
          grab(h);
          if (e.t === "met" && !e.d) { UI.toast("「会った」は日付が要ります", "warn"); return; }
          if (!e.x.trim() && !e.d) { UI.toast("内容か日付のどちらかは入れてください", "warn"); return; }
          e.at = Data.nowStr();
          if (isNew) p.log.push(e);
          else for (var i = 0; i < p.log.length; i++) if (p.log[i].id === e.id) p.log[i] = e;
          Data.touch(p);
          Store.mark("people"); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast(isNew ? "書きました" : "直しました");
        };
        var del = h.querySelector("#logDel");
        if (del) del.onclick = function () {
          UI.closeSheet();
          UI.confirm("この記録を消しますか", "元に戻せません。", "消す", function () {
            p.log = p.log.filter(function (l) { return l.id !== e.id; });
            Data.touch(p);
            Store.mark("people"); Store.flush();
            App.render(); UI.toast("消しました");
          }, true);
        };
      }
    });
  }

  function grabText(h) { var t = h.querySelector("#logText"); if (t) e.x = t.value; }
  function grab(h) {
    grabText(h);
    var d = h.querySelector("#logDate");
    if (d) e.d = d.value;
    var tm = h.querySelector("#logTime");
    if (tm) e.tm = tm.value;
  }

  open();
};
window.UI = UI;
