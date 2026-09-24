"use strict";
/* =======================================================
   ui/parts.js — 画面の共通部品
   ======================================================= */
var UI = window.UI || {};

UI.esc = function (s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};
UI.el = function (id) { return document.getElementById(id); };
UI.nl2br = function (s) { return UI.esc(s).replace(/\n/g, "<br>"); };

/* 名前から色を決める。同じ人はいつも同じ色になる */
UI.AVCOL = ["#28497A", "#3A6EA8", "#3E8C9E", "#4B6A8C", "#5B7FA6", "#2F6B7A", "#6B7FA0", "#356184"];
UI.hue = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/* 写真がある人は後から貼る（hydratePhotos）。無い人は名前の1文字＋色付きの丸 */
UI.avatar = function (p, cls, which) {
  var ch = (p.name || "？").charAt(0);
  var col = UI.AVCOL[UI.hue(p.name || "？") % UI.AVCOL.length];
  return '<div class="av ' + (cls || "") + '"' +
    (p.photo ? ' data-photo="' + UI.esc(p.photo) + '" data-which="' + (which || "thumb") + '"' : '') +
    /* ★必ず background-color と書く。短縮形の background で書いてはいけない。
       短縮形は background-size / background-position も初期値に戻してしまい、
       しかも style 属性なので css の .av{background-size:cover;background-position:center}
       に勝つ。すると写真は「左上の角を等倍で」貼られ、合わせた丸が出なくなる。
       （2026-09-10 に実際にこれで出ていなかった） */
    ' style="background-color:' + col + '">' + UI.esc(ch) + '</div>';
};

/* 描いたあとで写真を貼る */
UI.hydratePhotos = function (root) {
  (root || document).querySelectorAll("[data-photo]").forEach(function (n) {
    if (n.dataset.done) return;
    n.dataset.done = "1";
    Photos.urlFor(n.dataset.photo, n.dataset.which || "thumb").then(function (u) {
      if (!u) return;
      n.style.backgroundImage = "url(" + u + ")";
      /* ★貼る時にも念を押す。丸の中を「切り取った正方形いっぱい・中心そろえ」で
         出すための3つ。どこかで background の短縮形が混ざっても、ここで戻る */
      n.style.backgroundSize = "cover";
      n.style.backgroundPosition = "center";
      n.style.backgroundRepeat = "no-repeat";
      n.classList.add("hasimg");
      n.textContent = "";
    })["catch"](function () {});
  });
};

/* ★戻る札。アイコンだけにしない。必ず行き先の名前を書く */
UI.backBtn = function (label) {
  return '<button class="backbtn" data-nav="back">' + IC.back + '<span>' + UI.esc(label || Nav.backLabel()) + '</span></button>';
};
UI.backWide = function (label) {
  return '<button class="backwide" data-nav="back">' + IC.back + '<span>' + UI.esc(label || Nav.backLabel()) + 'にもどる</span></button>';
};

UI.appbar = function (o) {
  var left = o.back ? UI.backBtn(o.backLabel) : "";
  var right = Array.isArray(o.actions) ? o.actions.join("") : (o.actions || "");
  return '<div class="appbar"><div class="appbar-row">' + left +
    '<h1 class="appbar-title' + (o.back ? " sm" : "") + '">' + UI.esc(o.title) + '</h1>' + right +
    '</div>' + (o.below || '<div style="height:8px"></div>') + '</div>';
};

UI.iconbtn = function (act, svg, label) {
  return '<button class="iconbtn" data-act="' + act + '" aria-label="' + UI.esc(label || act) + '">' + svg + '</button>';
};
UI.textbtn = function (act, label, cls) {
  return '<button class="iconbtn txt ' + (cls || "") + '" data-act="' + act + '">' + UI.esc(label) + '</button>';
};

UI.tabbar = function () {
  var db = Store.current();
  var on = Nav.tabOf();
  var cold = Select.coldPeople(db.people, db.settings.coldDays).length;
  var todo = Select.openTodos(db).length;
  function b(k, ic, lb, badge) {
    return '<button data-tab="' + k + '" class="' + (on === k ? "on" : "") + '">' + ic +
      '<span>' + lb + '</span>' + (badge ? '<span class="badge">' + badge + '</span>' : '') + '</button>';
  }
  return '<nav class="tabbar">' +
    b("list", IC.list, "一覧") +
    b("care", IC.care, "気にかける", cold) +
    b("memos", IC.memo, "メモ", todo) +
    b("ref", IC.ref, "早見表") +
    b("backup", IC.back2, "控え") + '</nav>';
};

UI.sec = function (title, right) {
  return '<div class="sec"><h3>' + UI.esc(title) + '<i></i>' + (right || "") + '</h3></div>';
};
UI.field = function (k, v, warn) {
  /* ★改行はそのまま出す。特徴・触れない事・場所ときっかけは複数行で書ける欄なので、
     一行に潰すと書いたとおりに読めない */
  return '<div class="field"><div class="k">' + UI.esc(k) + '</div><div class="v ' + (warn ? "warnv" : "") + '">' +
    (v ? UI.nl2br(v) : '<span class="blank">—</span>') + '</div></div>';
};

/* ★連絡先の1件。SNSなどのURLが入っていたら押して開けるようにする。
   開けるかどうかの判定は Data.linkOf の1か所だけ（http / https のみ通す）。
   リンクにする時も href は esc を通す＝貼り付けた文字で属性を抜けられないように。
   target="_blank" + rel="noopener" はPC版（ブラウザ）用。
   Androidでは同じ窓に来た住所を MainActivity が受け取って、端末のブラウザに渡す */
UI.contactField = function (c) {
  var k = c.k || "連絡先";
  var v = c.v || "";
  var url = (window.Data && Data.linkOf) ? Data.linkOf(v) : "";
  if (!url) return UI.field(k, v);
  return '<div class="field"><div class="k">' + UI.esc(k) + '</div><div class="v">' +
    '<a class="clink" href="' + UI.esc(url) + '" target="_blank" rel="noopener noreferrer">' +
    '<span class="u">' + UI.esc(v) + '</span><span class="go">開く ↗</span></a>' +
    '</div></div>';
};
UI.stars = function (n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); };
UI.empty = function (msg) { return '<div class="emptybox">' + UI.esc(msg) + '</div>'; };

/* ★タグの帯。1行に並べて、はみ出したぶんは横に流す。
   ここを通せば「何個までしか出さない」を書く場所が無くなる。
   （前は一覧で3個・入力の候補で12個までで切っていて、
     それを超えたタグは画面のどこからも見えなかった） */
UI.tagrail = function (chips, cls) {
  var h = Array.isArray(chips) ? chips.join("") : (chips || "");
  if (!h) return "";
  return '<div class="tagrail' + (cls ? " " + cls : "") + '">' + h + '</div>';
};
/* 「何種類あるか」を見出しの右に出す小さな札。多い時ほど要る */
UI.tagcount = function (n) {
  return n ? '<span class="seccount">' + n + '種類</span>' : "";
};

/* 候補の帯を、打った文字で絞る。
   ★「全部並べる」だけでは多い時に見つけられないので、探す手段を必ず添える。
   ★隠すのは hidden。css に [hidden]{display:none!important} を置いてある
     （.chip が display を持つので、ブラウザ既定の [hidden] だけでは勝てない）
   which: "addtag"（人のタグ）／"maddtag"（メモのタグ） */
UI.filterTagSuggest = function (root, q, which) {
  which = which || "addtag";
  root = root || document;
  q = String(q || "").trim().replace(/^#/, "").toLowerCase();
  var all = 0, hit = 0;
  root.querySelectorAll("[data-" + which + "]").forEach(function (b) {
    all++;
    var show = !q || String(b.dataset[which] || "").toLowerCase().indexOf(q) >= 0;
    b.hidden = !show;
    if (show) hit++;
  });
  var note = root.querySelector(which === "maddtag" ? "#mtagNoHit" : "#tagNoHit");
  if (note) note.hidden = !(all && q && !hit);
  return hit;
};

/* ---- 知らせ（画面下に出て自然に消える） ---- */
UI.toast = function (msg, kind) {
  var box = UI.el("toast");
  if (!box) return;
  box.className = "toast show " + (kind || "");
  box.textContent = msg;
  clearTimeout(UI._tt);
  UI._tt = setTimeout(function () { box.className = "toast"; }, 2800);
};

/* ---- 下から出る紙（選ぶ・確かめる） ---- */
UI.sheet = function (o) {
  var host = UI.el("sheet");
  host.innerHTML =
    '<div class="sheet-bg" data-sheet="close"></div>' +
    '<div class="sheet-card" role="dialog" aria-modal="true">' +
      '<div class="sheet-head"><h2>' + UI.esc(o.title) + '</h2>' +
        '<button class="iconbtn" data-sheet="close" aria-label="閉じる">' + IC.close + '</button></div>' +
      '<div class="sheet-body">' + o.body + '</div>' +
      (o.foot ? '<div class="sheet-foot">' + o.foot + '</div>' : '') +
    '</div>';
  host.classList.add("open");
  host.querySelectorAll('[data-sheet="close"]').forEach(function (n) {
    n.onclick = function () { UI.closeSheet(); };
  });
  if (o.bind) o.bind(host);
  return host;
};
UI.closeSheet = function () {
  var host = UI.el("sheet");
  host.classList.remove("open");
  setTimeout(function () { if (!host.classList.contains("open")) host.innerHTML = ""; }, 200);
};

/* 確かめる。yes を押した時だけ cb が動く */
UI.confirm = function (title, msg, yesLabel, cb, danger) {
  UI.sheet({
    title: title,
    body: '<p class="sheet-msg">' + UI.nl2br(msg) + '</p>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn ' + (danger ? "danger" : "primary") + '" id="sheetYes">' + UI.esc(yesLabel) + '</button>',
    bind: function (h) {
      h.querySelector("#sheetYes").onclick = function () { UI.closeSheet(); cb(); };
    }
  });
};

/* 入力欄の組み立て（入力画面で使い回す） */
UI.input = function (o) {
  var t = o.type || "text";
  if (t === "textarea") {
    return '<label class="fld"><span class="lb">' + UI.esc(o.label) + '</span>' +
      '<textarea data-f="' + o.name + '" rows="' + (o.rows || 4) + '" placeholder="' + UI.esc(o.ph || "") + '">' +
      UI.esc(o.value || "") + '</textarea>' +
      (o.help ? '<span class="hlp">' + o.help + '</span>' : '') + '</label>';
  }
  return '<label class="fld"><span class="lb">' + UI.esc(o.label) + (o.req ? '<em>必須</em>' : '') + '</span>' +
    '<input type="' + t + '" data-f="' + o.name + '" value="' + UI.esc(o.value || "") + '" ' +
    (o.inputmode ? 'inputmode="' + o.inputmode + '" ' : '') +
    'placeholder="' + UI.esc(o.ph || "") + '">' +
    (o.help ? '<span class="hlp">' + o.help + '</span>' : '') + '</label>';
};

window.UI = UI;
