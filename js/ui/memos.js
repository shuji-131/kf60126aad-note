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
  /* ★鍵つきのメモは、閉じていれば題名も中身も出さない（textOf が null を返す） */
  var locked = MemoLock.isLocked(m);
  var t = MemoLock.textOf(m);
  var title = t ? Select.memoTitle(t) : "鍵つきのメモ";
  return '<button class="memo ' + (m.pin ? "pinned" : "") + (locked ? " locked" + (t ? "" : " shut") : "") + '" data-memo="' + m.id + '">' +
    '<h4 class="ttl ' + (t && t.title ? "" : "untitled") + '">' +
      (m.pin ? '<span class="pinic">◆</span>' : '') +
      (locked ? '<span class="lockic" aria-label="鍵つき">' + (t ? "🔓" : "🔒") + '</span>' : '') + UI.esc(title) + '</h4>' +
    (t && t.title && t.body ? '<p class="bd">' + UI.esc(t.body.replace(/\n/g, " / ")) + '</p>' : '') +
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

  /* 鍵つきのメモがある時だけ、開ける・閉める の札を出す */
  var nLocked = MemoLock.lockedCount(db);
  var lockBtn = nLocked
    ? (MemoLock.isOpen(db) ? UI.textbtn("mlockshut", "🔒 閉める") : UI.textbtn("munlock", "🔓 開ける"))
    : "";
  var lockFoot = MemoLock.hasNumber(db)
    ? '<div class="lockfoot"><span>🔒 鍵つき ' + nLocked + '件</span>' +
        '<button data-act="mlockchange">鍵の番号を変える</button>' +
        '<button data-act="mlockforget">番号を忘れた</button></div>'
    : "";

  return UI.appbar({
    title: "メモ",
    actions: lockBtn + UI.iconbtn("msearch", IC.search, "探す"),
    below: strip
  }) +
  '<div class="view">' +
    '<div class="disclaim">名簿と別の書き置き。<b>誰の話か分からないまま</b>置いておけます。あとで分かったら人に結びつけると、その人の頁にも出てきます。' +
      '<br>人に見られたくないメモは、書く画面の「🔒 鍵」で鍵をかけられます。</div>' +
    active + body + lockFoot + '<div style="height:88px"></div></div>' +
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
