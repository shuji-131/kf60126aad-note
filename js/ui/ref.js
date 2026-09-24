"use strict";
/* =======================================================
   ui/ref.js — 早見表（MBTI16 / ラブタイプ16）
   どちらも目安。決めつけではない、と頭に必ず出す。
   ======================================================= */
var UI = window.UI || {};

UI.viewRef = function () {
  var db = Store.current();
  var f = Nav.top();
  var kind = f.kind || "mbti";
  var body = "";

  if (kind === "mbti") {
    var g = "";
    MBTI.forEach(function (m) {
      if (m.g !== g) { g = m.g; body += '<div class="grouphead">' + g + '</div>'; }
      var n = Select.countType(db.people, "mbti", m.c);
      body += '<button class="tyrow" data-ty="mbti:' + m.c + '"><span class="cd">' + m.c + '</span>' +
        '<span class="nmj">' + m.n + '</span>' +
        '<span class="cnt ' + (n ? "" : "zero") + '">' + (n ? n + "人" : "—") + '</span></button>';
    });
  } else {
    body += '<div class="axis">' + LOVE_AXES.slice(0, 2).map(function (a) {
      return '<div class="axcard"><b>' + a.k + '</b><span>' + a.v + '</span></div>';
    }).join("") + '</div>';
    body += '<div class="axis" style="margin-top:-6px">' + LOVE_AXES.slice(2).map(function (a) {
      return '<div class="axcard"><b>' + a.k + '</b><span>' + a.v + '</span></div>';
    }).join("") + '</div>';
    LOVE.forEach(function (l) {
      var n = Select.countType(db.people, "love", l.c);
      body += '<button class="tyrow" data-ty="love:' + l.c + '"><span class="cd">' + l.c + '</span>' +
        '<span class="nmj">' + l.n + '</span>' +
        '<span class="cnt ' + (n ? "" : "zero") + '">' + (n ? n + "人" : "—") + '</span></button>';
    });
  }

  return UI.appbar({
    title: "早見表",
    below: '<div class="seg"><button data-refkind="mbti" class="' + (kind === "mbti" ? "on" : "") + '">MBTI</button>' +
           '<button data-refkind="love" class="' + (kind === "love" ? "on" : "") + '">ラブタイプ</button></div>'
  }) +
  '<div class="view">' +
    '<div class="disclaim">どちらも<b>目安</b>であって決めつけではありません。本人が言っていた型と、こちらが推測した型は分けて残しています。</div>' +
    body + '<div style="height:24px"></div></div>' + UI.tabbar();
};

UI.viewRefDetail = function () {
  var db = Store.current();
  var f = Nav.top();
  var a = f.code.split(":"), kind = a[0], code = a[1];
  var who = db.people.filter(function (p) { return (kind === "mbti" ? p.mbti.code : p.love.code) === code; });

  var whoHtml = who.length
    ? Select.sortPeople(who, "kana").map(function (p) { return UI.personRow(p); }).join("")
    : UI.empty("この型の人はまだ登録されていません");

  var main;
  if (kind === "mbti") {
    var m = mbtiOf(code);
    if (!m) return UI.appbar({ title: "早見表", back: true }) + '<div class="view">' + UI.empty("その型は見つかりません") + '</div>' + UI.tabbar();
    main = '<div class="tybig"><div class="cd">' + m.c + '</div><div class="nmj">' + m.n + '</div>' +
      '<div class="one">' + m.o + '</div></div>' +
      '<div class="sec plain"><h3>接するときのコツ<i></i></h3>' +
      '<p class="reftext">' + m.t + '</p></div>' +
      '<div class="sec plain"><h3>分類<i></i></h3><p class="refsub">' + m.g + 'グループ</p></div>';
  } else {
    var l = loveOf(code);
    if (!l) return UI.appbar({ title: "早見表", back: true }) + '<div class="view">' + UI.empty("その型は見つかりません") + '</div>' + UI.tabbar();
    main = '<div class="tybig"><div class="cd">' + l.c + '</div><div class="nmj">' + l.n + '</div>' +
      '<div class="one">' + l.f + '</div></div>' +
      '<div class="sec plain"><h3>恋愛の傾向<i></i></h3><p class="reftext">' + l.t + '</p></div>' +
      '<div class="matchgrid">' +
        '<div class="matchbox good"><div class="lb">相 性 ◎</div><div class="cds">' +
          l.g.map(function (c) { return '<button class="mini" data-ty="love:' + c + '">' + c + '</button>'; }).join("") + '</div></div>' +
        '<div class="matchbox bad"><div class="lb">相 性 ✕</div><div class="cds">' +
          l.b.map(function (c) { return '<button class="mini" data-ty="love:' + c + '">' + c + '</button>'; }).join("") + '</div></div>' +
      '</div>';
  }

  return UI.appbar({ title: kind === "mbti" ? "MBTI" : "ラブタイプ", back: true }) +
    '<div class="view"><div class="tydetail">' + main + '</div>' +
    UI.sec("この型の人") + whoHtml +
    UI.backWide() +
    '<div style="height:22px"></div></div>' + UI.tabbar();
};

UI.bindRef = function (app) {
  app.querySelectorAll("[data-refkind]").forEach(function (b) {
    b.onclick = function () { Nav.replace({ v: "ref", kind: b.dataset.refkind }); };
  });
  app.querySelectorAll("[data-ty]").forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.ty.split(":")[0];
      Nav.push({ v: "ref", kind: k, code: b.dataset.ty });
    };
  });
};
window.UI = UI;
