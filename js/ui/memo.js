"use strict";
/* =======================================================
   ui/memo.js — メモを読む・書く・直す
   ======================================================= */
var UI = window.UI || {};

UI.MemoDraft = null;

UI.viewMemo = function () {
  var db = Store.current();
  var m = Data.findMemo(db, Nav.top().id);
  if (!m) return UI.appbar({ title: "メモ", back: true }) + '<div class="view">' + UI.empty("このメモは消されています") + '</div>' + UI.tabbar();

  var who = m.who.map(function (id) {
    var p = Data.findPerson(db, id);
    if (!p) return "";
    return '<button data-person="' + p.id + '">' + UI.avatar(p) + '<span>' + UI.esc(p.name) + '</span></button>';
  }).join("");

  return UI.appbar({
    title: Select.memoTitle(m),
    back: true,
    actions: UI.textbtn("editmemo", "直す")
  }) +
  '<div class="view">' +
    UI.sec(m.d.replace(/-/g, "/") + " に書いた", '<button data-act="mpin">' + (m.pin ? "ピンを外す" : "上に留める") + '</button>') +
    '<div class="memobody">' + (m.body ? UI.nl2br(m.body) : '<span class="blank">（本文なし）</span>') + '</div>' +
    (m.todo
      ? UI.sec("やること") +
        '<button class="bigbtn wide" data-act="mdone"><b>' + (m.done ? "済にしてあります" : "まだ済んでいません") + '</b>' +
        '<span>' + (m.done ? "押すと未済に戻します" : "押すと済にします。済は「気にかける」から消えます") + '</span></button>'
      : '') +
    UI.sec("結びつけた人") +
    '<div class="linkrow">' + who +
      '<button class="add" data-act="mlink">' + (m.who.length ? "＋ 足す" : "＋ 人に結びつける") + '</button></div>' +
    (m.who.length ? '' : '<p class="secnote" style="padding:8px 18px 0">結びつけなくてかまいません。誰の話か分かった時に足せます。</p>') +
    UI.sec("タグ") +
    '<div class="linkrow">' +
      (m.tags.length ? m.tags.map(function (t) { return '<span class="chip">#' + UI.esc(t) + '</span>'; }).join("")
        : '<span class="chip dashed">まだ無い</span>') +
    '</div>' +
    '<div style="height:26px"></div>' + UI.backWide() + '<div style="height:20px"></div>' +
  '</div>' + UI.tabbar();
};

/* ---- 書く・直す ---- */
UI.openMemoEdit = function (id) {
  var db = Store.current();
  if (id) {
    UI.MemoDraft = JSON.parse(JSON.stringify(Data.findMemo(db, id)));
    UI.MemoDraft._new = false;
  } else {
    var m = Data.blankMemo(db);
    m._new = true;
    UI.MemoDraft = m;
    Store.mark("meta");
  }
  Nav.push({ v: "memoedit" });
};

UI.viewMemoEdit = function () {
  var db = Store.current();
  var d = UI.MemoDraft;
  if (!d) return UI.appbar({ title: "メモ", back: true }) + '<div class="view">' + UI.empty("入力が失われました") + '</div>';

  var tagChips = d.tags.map(function (t) {
    return '<span class="chip on">#' + UI.esc(t) + '<span class="x" data-untag="' + UI.esc(t) + '">✕</span></span>';
  });
  /* ★12種類までで切っていた＝それを超えたタグは選べなかった。全部並べて横に流す */
  var sug = Select.allMemoTags(db.memos).concat(Select.allTags(db.people))
    .filter(function (o, i, a) {
      return d.tags.indexOf(o.t) < 0 && a.findIndex(function (x) { return x.t === o.t; }) === i;
    });

  var who = d.who.map(function (id) {
    var p = Data.findPerson(db, id);
    if (!p) return "";
    return '<span class="chip on">' + UI.esc(p.name) + '<span class="x" data-unwho="' + p.id + '">✕</span></span>';
  }).join("");

  return UI.appbar({
    title: d._new ? "メモを書く" : "メモを直す",
    back: true, backLabel: "やめる",
    actions: UI.textbtn("savememo", "保存", "primary")
  }) +
  '<div class="view form">' +
    '<div class="formbody" style="padding-top:14px">' +
      UI.input({ label: "題名（空でよい）", name: "title", value: d.title, ph: "空なら本文の頭が題名がわりに出ます" }) +
      UI.input({ label: "中身", name: "body", type: "textarea", rows: 8, value: d.body,
                 ph: "薬院に静かなカフェができたと聞いた。誰から聞いたか思い出せない。" }) +
      UI.input({ label: "日付", name: "d", type: "date", value: d.d }) +
    '</div>' +

    UI.sec("印") +
    '<div class="formbody">' +
      '<div class="fld"><span class="lb">◆ ピン</span>' +
        '<div class="seg small"><button type="button" data-pin="0" class="' + (!d.pin ? "on" : "") + '">留めない</button>' +
        '<button type="button" data-pin="1" class="' + (d.pin ? "on" : "") + '">上に留める</button></div></div>' +
      '<div class="fld"><span class="lb">やること</span>' +
        '<div class="seg small"><button type="button" data-todo="0" class="' + (!d.todo ? "on" : "") + '">ただのメモ</button>' +
        '<button type="button" data-todo="1" class="' + (d.todo ? "on" : "") + '">やること</button></div>' +
        '<span class="hlp">やることは「気にかける」と下タブの印に出ます</span></div>' +
      (d.todo ? '<div class="fld"><span class="lb">今の状態</span>' +
        '<div class="seg small"><button type="button" data-done="0" class="' + (!d.done ? "on" : "") + '">未済</button>' +
        '<button type="button" data-done="1" class="' + (d.done ? "on" : "") + '">済</button></div></div>' : '') +
    '</div>' +

    UI.sec("結びつけた人（後からでよい）") +
    '<div class="formbody">' +
      '<div class="chipbox">' + (who || '<span class="blank">結びつけていません</span>') + '</div>' +
      '<button class="btn ghost wide" data-act="mlink">＋ 名簿から選ぶ</button>' +
      '<span class="hlp">誰の話か分からないままでかまいません</span>' +
    '</div>' +

    UI.sec("タグ", UI.tagcount(d.tags.length + sug.length)) +
    '<div class="formbody">' +
      (tagChips.length ? UI.tagrail(tagChips, "pick")
                       : '<div class="chipbox"><span class="blank">まだありません</span></div>') +
      '<div class="crow"><input ' + UI.NOAUTO + 'id="mtagInput" placeholder="タグを足す・下の候補を絞る" enterkeyhint="done">' +
        '<button class="btn ghost sm" data-act="maddtag">足す</button></div>' +
      (sug.length
        ? UI.tagrail(sug.map(function (o) {
            return '<button class="chip" data-maddtag="' + UI.esc(o.t) + '">#' + UI.esc(o.t) + '</button>';
          }), "pick sug") +
          '<span class="hlp" id="mtagNoHit" hidden>あてはまるタグがありません。' +
          'そのまま「足す」を押すと、新しいタグとして作れます</span>' +
          '<span class="hlp">名簿とメモのタグを<b>' + sug.length + '種類ぜんぶ</b>並べています。' +
          '横になぞって探すか、上の欄に打つと絞り込めます</span>'
        : '') +
    '</div>' +

    '<div style="height:10px"></div>' +
    '<button class="bigbtn primary wide" data-act="savememo"><b>保存する</b><span>題名は空でも大丈夫です</span></button>' +
    (d._new ? '' : '<button class="bigbtn danger wide" data-act="delmemo"><b>このメモを消す</b><span>元に戻せません</span></button>') +
    '<div style="height:30px"></div>' +
  '</div>';
};

UI.bindMemoEdit = function (app) {
  var d = UI.MemoDraft;
  if (!d) return;
  app.querySelectorAll("[data-f]").forEach(function (n) {
    n.addEventListener("input", function () { d[n.dataset.f] = n.value; });
  });
  [["pin", "pin"], ["todo", "todo"], ["done", "done"]].forEach(function (pair) {
    app.querySelectorAll("[data-" + pair[0] + "]").forEach(function (b) {
      b.onclick = function () { d[pair[1]] = b.dataset[pair[0]] === "1"; App.render(); };
    });
  });
  app.querySelectorAll("[data-untag]").forEach(function (b) {
    b.onclick = function () { d.tags.splice(d.tags.indexOf(b.dataset.untag), 1); App.render(); };
  });
  app.querySelectorAll("[data-maddtag]").forEach(function (b) {
    b.onclick = function () { UI.addMemoTag(b.dataset.maddtag); };
  });
  app.querySelectorAll("[data-unwho]").forEach(function (b) {
    b.onclick = function () { d.who.splice(d.who.indexOf(b.dataset.unwho), 1); App.render(); };
  });
  var ti = UI.el("mtagInput");
  if (ti) {
    ti.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); UI.addMemoTag(ti.value); }
    });
    /* ★候補は全部並べてある。多い時に見つけられるよう、打った文字で絞る */
    ti.addEventListener("input", function () { UI.filterTagSuggest(app, ti.value, "maddtag"); });
  }
};

UI.addMemoTag = function (t) {
  t = String(t || "").trim().replace(/^#/, "");
  if (!t) return;
  if (UI.MemoDraft.tags.indexOf(t) < 0) UI.MemoDraft.tags.push(t);
  App.render();
};

/* 名簿から人を選んで結びつける */
UI.pickPeople = function (current, onDone) {
  var db = Store.current();
  var chosen = current.slice();
  function rows(q) {
    var list = Select.sortPeople(Select.filterPeople(db.people, { search: q }), "kana");
    if (!list.length) return '<p class="sheet-msg">あてはまる人がいません</p>';
    return list.map(function (p) {
      var on = chosen.indexOf(p.id) >= 0;
      return '<button class="pickrow-item ' + (on ? "on" : "") + '" data-pick="' + p.id + '">' +
        UI.avatar(p) + '<span class="nm">' + UI.esc(p.name) + '</span>' +
        '<span class="mark">' + (on ? "✓" : "") + '</span></button>';
    }).join("");
  }
  function open(q) {
    UI.sheet({
      title: "人を結びつける",
      body: '<div class="crow" style="margin-bottom:10px"><input ' + UI.NOAUTO + 'id="pickq" placeholder="名前で探す" value="' + UI.esc(q || "") + '"></div>' +
            '<div class="picklist">' + rows(q || "") + '</div>',
      foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
            '<button class="btn primary" id="pickOk">決める（' + chosen.length + '人）</button>',
      bind: function (h) {
        UI.hydratePhotos(h);
        h.querySelectorAll("[data-pick]").forEach(function (b) {
          b.onclick = function () {
            var id = b.dataset.pick, i = chosen.indexOf(id);
            if (i >= 0) chosen.splice(i, 1); else chosen.push(id);
            open(h.querySelector("#pickq").value);
          };
        });
        var qi = h.querySelector("#pickq");
        qi.oninput = function () {
          h.querySelector(".picklist").innerHTML = rows(qi.value);
          UI.hydratePhotos(h);
          h.querySelectorAll("[data-pick]").forEach(function (b) {
            b.onclick = function () {
              var id = b.dataset.pick, i = chosen.indexOf(id);
              if (i >= 0) chosen.splice(i, 1); else chosen.push(id);
              open(qi.value);
            };
          });
        };
        h.querySelector("#pickOk").onclick = function () { UI.closeSheet(); onDone(chosen); };
      }
    });
  }
  open("");
};

UI.saveMemo = function () {
  var d = UI.MemoDraft, db = Store.current();
  d.title = String(d.title || "").trim();
  d.body = String(d.body || "");
  if (!d.title && !d.body.trim()) { UI.toast("題名か中身のどちらかは入れてください", "warn"); return; }
  if (!d.d) d.d = Data.todayStr();
  if (!d.todo) d.done = false;
  Data.touch(d);
  var isNew = d._new;
  delete d._new;
  if (isNew) db.memos.push(d);
  else for (var i = 0; i < db.memos.length; i++) if (db.memos[i].id === d.id) db.memos[i] = d;
  Store.mark("memos"); Store.flush();
  UI.MemoDraft = null;
  Nav.pop();
  if (isNew) Nav.push({ v: "memo", id: d.id });
  UI.toast(isNew ? "書きました" : "直しました");
};

UI.deleteMemo = function () {
  var d = UI.MemoDraft, db = Store.current();
  UI.confirm("このメモを消しますか", "元に戻せません。", "消す", function () {
    Data.removeMemo(db, d.id);
    Store.mark("memos"); Store.flush();
    UI.MemoDraft = null;
    Nav.goTab("memos");
    UI.toast("消しました");
  }, true);
};
window.UI = UI;
