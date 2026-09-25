"use strict";
/* =======================================================
   ui/birthui.js — 生年月日を入れる画面
   分かっている欄だけ埋める。空の欄は「不明」のまま残る。
   ======================================================= */
var UI = window.UI || {};

UI.BD = null;       // 下書き {y,m,d,age}
UI.BMode = "ymd";   // "ymd" | "age"
UI.BTarget = null;  // "person:<id>" か "draft"（入力画面から開いた時）

UI.openBirth = function (target) {
  var b;
  if (target === "draft") b = UI.EditDraft.birth;
  else {
    var p = Data.findPerson(Store.current(), target.split(":")[1]);
    b = p ? p.birth : {};
  }
  UI.BTarget = target;
  UI.BD = { y: b.y || null, m: b.m || null, d: b.d || null, age: b.age != null ? b.age : null };
  UI.BMode = (UI.BD.age != null && !UI.BD.y && !UI.BD.m) ? "age" : "ymd";
  Nav.push({ v: "birth" });
};

UI.bdDraft = function () { return Birth.clean(UI.BD, UI.BMode); };

UI.bdPreview = function () {
  var b = UI.bdDraft(), t = Birth.text(b), notes = [];
  if (UI.BMode === "ymd") {
    if (UI.BD.d && !UI.BD.m) notes.push(["warn", "月が分からないと、日だけでは使えません。月も入れるか、日を「不明」にしてください"]);
    if (b.m && b.d) notes.push(["", "この日が来る" + Store.current().settings.bdayAhead + "日前から「気にかける」に出ます"]);
    else notes.push(["", "月と日が揃っていないので「気にかける」の誕生日には出ません"]);
    if (!b.y && !b.m) notes.push(["", "全部「不明」でも登録できます。あとから分かった所だけ足せます"]);
  } else {
    if (b.age != null) notes.push(["", "今日（" + Data.todayStr().replace(/-/g, "/") + "）の年齢として残します。年が変われば自動で1つ増えます"]);
    else notes.push(["", "年齢も分からなければ空のままで大丈夫です"]);
  }
  return '<div class="lb">こ う 残 り ま す</div>' +
    '<div class="tx">' + (t ? UI.esc(t) : "不明") + '</div>' +
    notes.map(function (n) { return '<div class="note ' + n[0] + '">' + n[1] + '</div>'; }).join("");
};

UI.viewBirth = function () {
  function num(f, lb, unit, ph) {
    var v = UI.BD[f], unk = (v == null || v === "");
    return '<div class="brow"><label>' + lb + '</label>' +
      '<input ' + UI.NOAUTO + 'type="number" inputmode="numeric" data-bf="' + f + '" placeholder="' + ph + '" value="' + (unk ? "" : v) + '">' +
      '<span class="unit">' + unit + '</span>' +
      '<button class="unkbtn ' + (unk ? "on" : "") + '" data-unk="' + f + '">不明</button></div>';
  }
  var form = (UI.BMode === "ymd")
    ? num("y", "年", "年", "不明のまま") + num("m", "月", "月", "不明のまま") + num("d", "日", "日", "不明のまま")
    : num("age", "年齢", "歳", "不明のまま");

  return UI.appbar({ title: "生年月日", back: true, backLabel: "やめる" }) +
    '<div class="view">' +
    '<div class="callout info">分かっている所だけで大丈夫です。<br><b>年が分からなくても、年齢だけでも</b>登録できます。空の欄は「不明」のまま残ります。</div>' +
    '<div style="padding:0 18px"><div class="seg">' +
      '<button data-bmode="ymd" class="' + (UI.BMode === "ymd" ? "on" : "") + '">年・月・日で入れる</button>' +
      '<button data-bmode="age" class="' + (UI.BMode === "age" ? "on" : "") + '">年齢だけ入れる</button>' +
    '</div></div>' +
    '<div class="bform">' + form + '</div>' +
    '<div class="bprev" id="bprev">' + UI.bdPreview() + '</div>' +
    '<button class="bigbtn primary wide" data-act="birthok"><b>この内容で残す</b><span>あとから何度でも直せます</span></button>' +
    '<div style="height:30px"></div></div>';
};

UI.bindBirth = function (app) {
  app.querySelectorAll("[data-bmode]").forEach(function (b) {
    b.onclick = function () { UI.BMode = b.dataset.bmode; App.render(); };
  });
  app.querySelectorAll("[data-unk]").forEach(function (b) {
    b.onclick = function () { UI.BD[b.dataset.unk] = null; App.render(); };
  });
  app.querySelectorAll("[data-bf]").forEach(function (i) {
    i.oninput = function () {
      var f = i.dataset.bf, v = i.value.replace(/[^0-9]/g, "");
      var lim = Birth.LIMITS[f];
      if (v !== "" && +v > lim[1]) v = String(lim[1]);
      if (v !== i.value) i.value = v;
      UI.BD[f] = (v === "" ? null : +v);
      var pv = UI.el("bprev");
      if (pv) pv.innerHTML = UI.bdPreview();
      var ub = app.querySelector('[data-unk="' + f + '"]');
      if (ub) ub.className = "unkbtn" + (v === "" ? " on" : "");
    };
    i.onblur = function () {
      var f = i.dataset.bf, lim = Birth.LIMITS[f];
      if (i.value !== "" && +i.value < lim[0]) { UI.BD[f] = lim[0]; App.render(); }
    };
  });
};

UI.saveBirth = function () {
  var b = UI.bdDraft();
  if (UI.BTarget === "draft") {
    UI.EditDraft.birth = b;
  } else {
    var p = Data.findPerson(Store.current(), UI.BTarget.split(":")[1]);
    if (p) { p.birth = b; Data.touch(p); Store.mark("people"); Store.flush(); }
  }
  Nav.pop();
  UI.toast(Birth.isEmpty(b) ? "不明のままにしました" : "残しました");
};
window.UI = UI;
