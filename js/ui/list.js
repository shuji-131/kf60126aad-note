"use strict";
/* =======================================================
   ui/list.js — 一覧
   50音順が既定。上段のつまみ見出しで行を絞る。
   ======================================================= */
var UI = window.UI || {};

UI.ListState = { row: "全", tags: [], cat: "", alertOnly: false, search: "", mbti: "", love: "", star: 0 };

UI.listCond = function () {
  var s = UI.ListState;
  return { row: s.row, tags: s.tags, cat: s.cat, alertOnly: s.alertOnly, search: s.search,
           mbti: s.mbti, love: s.love, star: s.star };
};
UI.listResult = function () {
  var db = Store.current();
  return Select.sortPeople(Select.filterPeople(db.people, UI.listCond()), db.settings.sort);
};
UI.listActive = function () {
  var s = UI.ListState;
  return !!(s.tags.length || (s.row && s.row !== "全") || s.search || s.cat || s.alertOnly || s.mbti || s.love || s.star);
};
UI.clearFilters = function () {
  UI.ListState = { row: "全", tags: [], cat: "", alertOnly: false, search: "", mbti: "", love: "", star: 0 };
};

UI.personRow = function (p, sub, right) {
  var db = Store.current();
  var col = Data.catColor(db, p.cat);
  var n = Select.daysSince(Select.lastMet(p));
  /* ★タグは3個までで切っていた＝4個目から画面のどこにも出なかった。
     全部入れて、はみ出したぶんは横に流す（.tagrail）。
     札は押せない文字なので、横になぞれば流れ、叩けば人の頁がひらく */
  var tags = UI.tagrail(p.tags.map(function (t) {
    return '<span class="tg">#' + UI.esc(t) + '</span>';
  }), "inrow");
  /* ★button ではなく div。中に横スクロールの帯を入れるため
     （button の中の入れものは、端末によって横になぞれない） */
  return '<div class="person ' + (p.alert ? "alert" : "") + '" role="button" tabindex="0" data-person="' + p.id + '">' +
    UI.avatar(p) +
    '<div class="nm"><h4>' + UI.esc(p.name || "（名前なし）") +
      (p.alert ? '<span class="warnbadge">⚑ 注意</span>' : '') + '</h4>' +
      '<p class="kana">' + UI.esc(sub != null ? sub : (p.kana || (p.nick ? "「" + p.nick + "」" : "ふりがな未入力"))) + '</p>' +
      '<div class="meta">' +
        '<span class="cat"><i style="background-color:' + col + '"></i>' + UI.esc(p.cat) + '</span>' +
        '<span class="stars">' + UI.stars(p.star) + '</span>' +
      '</div>' + tags +
    '</div>' +
    '<span class="ago">' + (right != null ? right : Select.agoText(n)) + '</span></div>';
};

UI.viewList = function () {
  var db = Store.current();
  var s = UI.ListState;
  var used = Select.countByRow(db.people);

  var idx = '<div class="index">' +
    ["全"].concat(Select.ROWS.map(function (r) { return r.k; }), ["他"]).map(function (k) {
      var empty = (k !== "全" && !used[k]);
      return '<button data-row="' + k + '" class="' + (s.row === k ? "on" : "") + (empty ? " empty" : "") + '">' + k + '</button>';
    }).join("") + '</div>';

  var nAlert = db.people.filter(function (p) { return p.alert; }).length;
  var strip = '<div class="tagstrip">';
  strip += '<button class="chip warn ' + (s.alertOnly ? "on" : "") + '" data-alert="1">⚑ 注意<span class="n">' + nAlert + '</span></button>';
  db.cats.forEach(function (c) {
    var n = db.people.filter(function (p) { return p.cat === c.k; }).length;
    if (!n) return;
    strip += '<button class="chip ' + (s.cat === c.k ? "on" : "") + '" data-cat="' + UI.esc(c.k) + '">' +
      '<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + c.c + ';margin-right:6px;vertical-align:0"></i>' +
      UI.esc(c.k) + '<span class="n">' + n + '</span></button>';
  });
  var tags = Select.allTags(db.people);
  if (tags.length) strip += '<span class="strip-div"></span>';
  tags.forEach(function (o) {
    strip += '<button class="chip ' + (s.tags.indexOf(o.t) >= 0 ? "on" : "") + '" data-tag="' + UI.esc(o.t) + '">#' +
      UI.esc(o.t) + '<span class="n">' + o.n + '</span></button>';
  });
  strip += '</div>';

  var list = UI.listResult();

  var active = "";
  if (UI.listActive()) {
    var pills = [];
    if (s.row !== "全") pills.push(['row', s.row + "行"]);
    if (s.alertOnly) pills.push(['alert', "⚑注意"]);
    if (s.cat) pills.push(['cat', s.cat]);
    if (s.mbti) pills.push(['mbti', "MBTI " + s.mbti]);
    if (s.love) pills.push(['love', "ラブタイプ " + s.love]);
    if (s.star) pills.push(['star', "近さ★" + s.star + "以上"]);
    s.tags.forEach(function (t) { pills.push(['tag:' + t, "#" + t]); });
    if (s.search) pills.push(['search', "「" + s.search + "」"]);
    active = '<div class="activebar">' + pills.map(function (o) {
      return '<span class="pill"><b>' + UI.esc(o[1]) + '</b><span data-unfilter="' + UI.esc(o[0]) + '">✕</span></span>';
    }).join("") + '<span class="count">' + list.length + '人</span></div>';
  }

  /* 50音順のときだけ行の見出しを挟む */
  var body = "";
  if (!list.length) {
    body = UI.empty(db.people.length ? "あてはまる人がいません" : "まだ誰も登録されていません。右下の＋から足せます");
  } else if (db.settings.sort === "kana") {
    var cur = null;
    list.forEach(function (p) {
      var r = Select.rowOf(p);
      if (r !== cur) { cur = r; body += '<div class="rowhead"><b>' + r + '</b><i></i></div>'; }
      body += UI.personRow(p);
    });
  } else {
    body = list.map(function (p) { return UI.personRow(p); }).join("");
  }

  var sortName = { kana: "50音順", cold: "ごぶさた順", met: "出会った順", star: "近さ順" }[db.settings.sort];

  return UI.appbar({
    title: "友人帳",
    actions: UI.iconbtn("sort", '<span style="font-size:11.5px;letter-spacing:.04em">' + sortName + '</span>', "並べ替え") +
             UI.iconbtn("search", IC.search, "探す") +
             UI.iconbtn("filter", IC.filter, "絞り込み"),
    below: idx + strip
  }) +
    '<div class="view">' + active + body + '<div style="height:88px"></div></div>' +
    '<button class="fab" data-act="addperson" aria-label="人を足す">＋</button>' +
    UI.tabbar();
};

UI.bindList = function (app) {
  app.querySelectorAll("[data-row]").forEach(function (b) {
    b.onclick = function () {
      if (b.classList.contains("empty")) return;
      UI.ListState.row = (UI.ListState.row === b.dataset.row) ? "全" : b.dataset.row;
      App.render();
    };
  });
  app.querySelectorAll("[data-cat]").forEach(function (b) {
    b.onclick = function () {
      UI.ListState.cat = (UI.ListState.cat === b.dataset.cat) ? "" : b.dataset.cat;
      App.render();
    };
  });
  app.querySelectorAll("[data-alert]").forEach(function (b) {
    b.onclick = function () { UI.ListState.alertOnly = !UI.ListState.alertOnly; App.render(); };
  });
  app.querySelectorAll("[data-tag]").forEach(function (b) {
    b.onclick = function () {
      var t = b.dataset.tag, i = UI.ListState.tags.indexOf(t);
      if (i >= 0) UI.ListState.tags.splice(i, 1); else UI.ListState.tags.push(t);
      App.render();
    };
  });
  app.querySelectorAll("[data-unfilter]").forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.unfilter;
      if (k.indexOf("tag:") === 0) UI.ListState.tags.splice(UI.ListState.tags.indexOf(k.slice(4)), 1);
      else if (k === "row") UI.ListState.row = "全";
      else if (k === "alert") UI.ListState.alertOnly = false;
      else if (k === "star") UI.ListState.star = 0;
      else UI.ListState[k] = "";
      App.render();
    };
  });
};
window.UI = UI;
