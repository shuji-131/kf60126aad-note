"use strict";
/* =======================================================
   ui/memos.js — メモ（名簿と別建て）
   ★誰の話か分からないまま置いておける。分かったら人に結びつける
   ======================================================= */
var UI = window.UI || {};

UI.MemoState = { todoOnly: false, tags: [], search: "" };

UI.memoRow = function (m) {
  var db = Store.current();
  var who = m.who.map(function (id) {
    var p = Data.findPerson(db, id);
    return p ? UI.avatar(p) : "";
  }).join("");
  var title = Select.memoTitle(m);
  return '<button class="memo ' + (m.pin ? "pinned" : "") + '" data-memo="' + m.id + '">' +
    '<h4 class="ttl ' + (m.title ? "" : "untitled") + '">' +
      (m.pin ? '<span class="pinic">◆</span>' : '') + UI.esc(title) + '</h4>' +
    (m.title && m.body ? '<p class="bd">' + UI.esc(m.body.replace(/\n/g, " / ")) + '</p>' : '') +
    '<div class="mt">' +
      (m.todo ? '<span class="todo ' + (m.done ? "done" : "") + '">' + (m.done ? "済" : "やること") + '</span>' : '') +
      (who ? '<span class="whodots">' + who + '</span>' : '<span class="free">— 誰にも結びつけていない</span>') +
      m.tags.map(function (t) { return '<span class="tg">#' + UI.esc(t) + '</span>'; }).join("") +
      '<span class="when">' + m.d.replace(/-/g, "/") + '</span>' +
    '</div></button>';
};

UI.viewMemos = function () {
  var db = Store.current();
  var s = UI.MemoState;
  var list = Select.sortMemos(Select.filterMemos(db, {
    todoOnly: s.todoOnly, tags: s.tags, search: s.search
  }));
  var nTodo = Select.openTodos(db).length;

  var strip = '<div class="tagstrip">' +
    '<button class="chip ' + (s.todoOnly ? "on" : "") + '" data-mtodo="1">やること<span class="n">' + nTodo + '</span></button>';
  var tags = Select.allMemoTags(db.memos);
  if (tags.length) strip += '<span class="strip-div"></span>';
  tags.forEach(function (o) {
    strip += '<button class="chip ' + (s.tags.indexOf(o.t) >= 0 ? "on" : "") + '" data-mtag="' + UI.esc(o.t) + '">#' +
      UI.esc(o.t) + '<span class="n">' + o.n + '</span></button>';
  });
  strip += '</div>';

  var body = list.length ? list.map(UI.memoRow).join("")
    : UI.empty(db.memos.length ? "あてはまるメモがありません" : "まだメモがありません。右下の＋から書けます");

  var active = "";
  if (s.search) {
    active = '<div class="activebar"><span class="pill"><b>「' + UI.esc(s.search) + '」</b>' +
      '<span data-act="mclear">✕</span></span><span class="count">' + list.length + '件</span></div>';
  }

  return UI.appbar({
    title: "メモ",
    actions: UI.iconbtn("msearch", IC.search, "探す"),
    below: strip
  }) +
  '<div class="view">' +
    '<div class="disclaim">名簿と別の書き置き。<b>誰の話か分からないまま</b>置いておけます。あとで分かったら人に結びつけると、その人の頁にも出てきます。</div>' +
    active + body + '<div style="height:88px"></div></div>' +
  '<button class="fab" data-act="addmemo" aria-label="メモを書く">＋</button>' +
  UI.tabbar();
};

UI.bindMemos = function (app) {
  app.querySelectorAll("[data-mtodo]").forEach(function (b) {
    b.onclick = function () { UI.MemoState.todoOnly = !UI.MemoState.todoOnly; App.render(); };
  });
  app.querySelectorAll("[data-mtag]").forEach(function (b) {
    b.onclick = function () {
      var t = b.dataset.mtag, i = UI.MemoState.tags.indexOf(t);
      if (i >= 0) UI.MemoState.tags.splice(i, 1); else UI.MemoState.tags.push(t);
      App.render();
    };
  });
};
window.UI = UI;
