"use strict";
/* =======================================================
   ui/filtersheet.js — 絞り込みのシート／並べ替え／探す
   ======================================================= */
var UI = window.UI || {};

/* タグを絞るのに打った文字。シートは札を押すたび開き直すので、外に持つ */
UI.FilterTagQ = UI.FilterTagQ || "";

UI.openFilter = function () {
  var db = Store.current();
  var s = UI.ListState;

  function group(title, items) {
    if (!items.length) return "";
    return '<div class="fgroup"><h4>' + title + '</h4><div class="chipbox">' + items.join("") + '</div></div>';
  }

  var catItems = db.cats.map(function (c) {
    var n = db.people.filter(function (p) { return p.cat === c.k; }).length;
    if (!n) return "";
    return '<button class="chip ' + (s.cat === c.k ? "on" : "") + '" data-fcat="' + UI.esc(c.k) + '">' +
      UI.esc(c.k) + '<span class="n">' + n + '</span></button>';
  }).filter(Boolean);

  /* ★タグは全部並べる（切らない）。数が増えると壁になるので、
     12種類を超えたら「絞る」欄を添えて探せるようにする */
  var tagsAll = Select.allTags(db.people);
  var tagItems = tagsAll.map(function (o) {
    return '<button class="chip ' + (s.tags.indexOf(o.t) >= 0 ? "on" : "") + '" data-ftag="' + UI.esc(o.t) + '">#' +
      UI.esc(o.t) + '<span class="n">' + o.n + '</span></button>';
  });
  var tagFind = tagsAll.length >= 12
    ? '<div class="crow" style="margin:0 0 9px">' +
        '<input id="ftagq" value="' + UI.esc(UI.FilterTagQ || "") + '" placeholder="タグを絞る（例：大学）">' +
      '</div>' +
      '<span class="hlp" id="tagNoHit" hidden>あてはまるタグがありません</span>'
    : '';

  var mbtiItems = MBTI.map(function (m) {
    var n = Select.countType(db.people, "mbti", m.c);
    if (!n) return "";
    return '<button class="chip ' + (s.mbti === m.c ? "on" : "") + '" data-fmbti="' + m.c + '">' +
      m.c + '<span class="n">' + n + '</span></button>';
  }).filter(Boolean);

  var loveItems = LOVE.map(function (l) {
    var n = Select.countType(db.people, "love", l.c);
    if (!n) return "";
    return '<button class="chip ' + (s.love === l.c ? "on" : "") + '" data-flove="' + l.c + '">' +
      l.c + '<span class="n">' + n + '</span></button>';
  }).filter(Boolean);

  var starItems = [5, 4, 3, 2, 1].map(function (n) {
    var c = db.people.filter(function (p) { return p.star >= n; }).length;
    return '<button class="chip ' + (s.star === n ? "on" : "") + '" data-fstar="' + n + '">★' + n + '以上<span class="n">' + c + '</span></button>';
  });

  var nAlert = db.people.filter(function (p) { return p.alert; }).length;

  UI.sheet({
    title: "絞り込み",
    body:
      group("⚑ 注意の印", ['<button class="chip warn ' + (s.alertOnly ? "on" : "") + '" data-falert="1">⚑ 注意<span class="n">' + nAlert + '</span></button>']) +
      group("区分", catItems) +
      (tagsAll.length
        ? '<div class="fgroup"><h4>タグ' + tagsAll.length + '種類ぜんぶ' +
          '（2つ以上なら「両方付いている人」）</h4>' + tagFind +
          '<div class="chipbox">' + tagItems.join("") + '</div></div>'
        : '') +
      group("MBTI", mbtiItems) +
      group("ラブタイプ", loveItems) +
      group("近さ", starItems),
    foot: '<button class="btn ghost" id="fclear">ぜんぶ外す</button>' +
          '<button class="btn primary" data-sheet="close">閉じる</button>',
    bind: function (h) {
      function re() { UI.closeSheet(); App.render(); UI.openFilter(); }
      h.querySelectorAll("[data-fcat]").forEach(function (b) {
        b.onclick = function () { s.cat = (s.cat === b.dataset.fcat) ? "" : b.dataset.fcat; re(); };
      });
      h.querySelectorAll("[data-ftag]").forEach(function (b) {
        b.onclick = function () {
          var t = b.dataset.ftag, i = s.tags.indexOf(t);
          if (i >= 0) s.tags.splice(i, 1); else s.tags.push(t);
          re();
        };
      });
      h.querySelectorAll("[data-fmbti]").forEach(function (b) {
        b.onclick = function () { s.mbti = (s.mbti === b.dataset.fmbti) ? "" : b.dataset.fmbti; re(); };
      });
      h.querySelectorAll("[data-flove]").forEach(function (b) {
        b.onclick = function () { s.love = (s.love === b.dataset.flove) ? "" : b.dataset.flove; re(); };
      });
      h.querySelectorAll("[data-fstar]").forEach(function (b) {
        b.onclick = function () { s.star = (s.star === +b.dataset.fstar) ? 0 : +b.dataset.fstar; re(); };
      });
      h.querySelectorAll("[data-falert]").forEach(function (b) {
        b.onclick = function () { s.alertOnly = !s.alertOnly; re(); };
      });
      /* タグを打った文字で絞る。札の数は減らさず、出す・出さないだけを切り替える */
      var tq = h.querySelector("#ftagq");
      if (tq) {
        tq.addEventListener("input", function () {
          UI.FilterTagQ = tq.value;
          UI.filterTagSuggest(h, tq.value, "ftag");
        });
        if (UI.FilterTagQ) UI.filterTagSuggest(h, UI.FilterTagQ, "ftag");
      }
      h.querySelector("#fclear").onclick = function () {
        UI.FilterTagQ = "";
        UI.clearFilters(); UI.closeSheet(); App.render();
      };
    }
  });
};

UI.openSort = function () {
  var db = Store.current();
  var opts = [["kana", "50音順", "既定。ふりがなの無い人は「他」"],
              ["cold", "ごぶさた順", "会っていない日数が長い順"],
              ["met", "出会った順", "出会った日が新しい順"],
              ["star", "近さ順", "★の多い順"]];
  UI.sheet({
    title: "並べ替え",
    body: '<div class="optlist">' + opts.map(function (o) {
      return '<button class="opt ' + (db.settings.sort === o[0] ? "on" : "") + '" data-sort="' + o[0] + '">' +
        '<b>' + o[1] + '</b><span>' + o[2] + '</span></button>';
    }).join("") + '</div>',
    bind: function (h) {
      h.querySelectorAll("[data-sort]").forEach(function (b) {
        b.onclick = function () {
          db.settings.sort = b.dataset.sort;
          Store.mark("settings"); Store.flush();
          UI.closeSheet(); App.render();
        };
      });
    }
  });
};

UI.openSearch = function (which) {
  var isMemo = which === "memo";
  var cur = isMemo ? UI.MemoState.search : UI.ListState.search;
  UI.sheet({
    title: isMemo ? "メモを探す" : "名簿を探す",
    body: '<label class="fld"><span class="lb">言葉</span>' +
      '<input id="sq" value="' + UI.esc(cur) + '" placeholder="' +
      (isMemo ? "題名・中身・タグ・結びつけた人の名前" : "名前・呼び方・所属・場所・タグ・記録の中身") + '" enterkeyhint="search"></label>' +
      '<p class="sheet-msg">' + (isMemo
        ? "結びつけた人の名前でも当たります。"
        : "記録の中身まで探します。行や区分の絞りとも重ねられます。") + '</p>',
    foot: '<button class="btn ghost" id="sclear">空にする</button>' +
          '<button class="btn primary" id="sok">探す</button>',
    bind: function (h) {
      var i = h.querySelector("#sq");
      setTimeout(function () { i.focus(); }, 60);
      function go() {
        var v = i.value.trim();
        if (isMemo) UI.MemoState.search = v;
        else { UI.ListState.search = v; if (v) UI.ListState.row = "全"; }
        UI.closeSheet(); App.render();
      }
      i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      h.querySelector("#sok").onclick = go;
      h.querySelector("#sclear").onclick = function () { i.value = ""; go(); };
    }
  });
};
window.UI = UI;
