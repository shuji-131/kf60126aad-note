"use strict";
/* =======================================================
   ui/memolockui.js — メモの鍵の紙（番号を決める・開ける・変える・忘れた）
   計算と暗号は memolock.js。ここは画面だけ
   ======================================================= */
var UI = window.UI || {};

/* ★番号の欄は type="text" ＋ 黒丸で隠す（.passin）。
   type="password" にすると、端末が「パスワードを保存しますか」と割り込んでくる */
UI.passInput = function (id, ph) {
  return '<input ' + UI.NOAUTO + 'class="passin" id="' + id + '" type="text" autocapitalize="off" ' +
    'placeholder="' + UI.esc(ph || "") + '" enterkeyhint="done">';
};

UI.lockUnsupported = function () {
  UI.toast("この端末では鍵の仕組みが使えません", "warn");
};

/* 番号を初めて決める */
UI.askNewNumber = function (after) {
  if (!MemoLock.available()) { UI.lockUnsupported(); return; }
  var db = Store.current();
  UI.sheet({
    title: "🔒 鍵の番号を決める",
    body:
      '<p class="sheet-msg">鍵をかけたメモは、この番号を入れないと読めません。<br>' +
      '数字でも文字でもかまいません（' + MemoLock.MIN_LEN + '文字以上）。</p>' +
      '<div class="lockwarn"><b>番号を忘れると、鍵をかけたメモは誰にも開けません。</b>' +
      'アプリを作った側でも開けません。紙などに控えておいてください。</div>' +
      '<div class="crow" style="margin-top:12px">' + UI.passInput("lk1", "番号") + '</div>' +
      '<div class="crow" style="margin-top:8px">' + UI.passInput("lk2", "もう一度") + '</div>' +
      '<p class="lockmsg" id="lkmsg"></p>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn primary" id="lkok">この番号にする</button>',
    bind: function (h) {
      var a = h.querySelector("#lk1"), b = h.querySelector("#lk2"), msg = h.querySelector("#lkmsg");
      var ok = h.querySelector("#lkok");
      function go() {
        var err = MemoLock.checkLen(a.value);
        if (err) { msg.textContent = err; return; }
        if (a.value !== b.value) { msg.textContent = "2つの番号が違います"; return; }
        ok.disabled = true; msg.textContent = "鍵を作っています…";
        MemoLock.setNumber(db, a.value).then(function () {
          Store.mark("settings"); Store.flush();
          UI.closeSheet();
          UI.toast("鍵の番号を決めました");
          if (after) after(); else App.render();
        })["catch"](function (e) { ok.disabled = false; msg.textContent = e.message || "決められませんでした"; });
      }
      ok.onclick = go;
      b.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      setTimeout(function () { try { a.focus(); } catch (e) {} }, 80);
    }
  });
};

/* 番号を入れて開ける */
UI.askUnlock = function (after) {
  if (!MemoLock.available()) { UI.lockUnsupported(); return; }
  var db = Store.current();
  if (!MemoLock.hasNumber(db)) { UI.askNewNumber(after); return; }
  UI.sheet({
    title: "🔒 鍵を開ける",
    body:
      '<p class="sheet-msg">鍵の番号を入れてください。<br>アプリを離れるまで開いたままになります。</p>' +
      '<div class="crow" style="margin-top:6px">' + UI.passInput("lkp", "番号") + '</div>' +
      '<p class="lockmsg" id="lkmsg"></p>' +
      '<button class="linkbtn" id="lkforget">番号を忘れた</button>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn primary" id="lkok">開ける</button>',
    bind: function (h) {
      var p = h.querySelector("#lkp"), msg = h.querySelector("#lkmsg"), ok = h.querySelector("#lkok");
      function go() {
        if (!p.value) { msg.textContent = "番号を入れてください"; return; }
        ok.disabled = true; msg.textContent = "確かめています…";
        MemoLock.unlock(db, p.value).then(function (yes) {
          if (!yes) {
            ok.disabled = false; p.value = ""; msg.textContent = "番号が違います";
            try { p.focus(); } catch (e) {}
            return;
          }
          UI.closeSheet();
          UI.toast("鍵を開けました");
          if (after) after(); else App.render();
        })["catch"](function () { ok.disabled = false; msg.textContent = "開けられませんでした"; });
      }
      ok.onclick = go;
      p.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      h.querySelector("#lkforget").onclick = function () { UI.forgetNumber(); };
      setTimeout(function () { try { p.focus(); } catch (e) {} }, 80);
    }
  });
};

/* 番号を変える（開いている時だけ） */
UI.askChangeNumber = function () {
  var db = Store.current();
  if (!MemoLock.isOpen(db)) { UI.askUnlock(UI.askChangeNumber); return; }
  UI.sheet({
    title: "🔒 鍵の番号を変える",
    body:
      '<p class="sheet-msg">鍵つきのメモを全部、新しい番号でかけ直します。</p>' +
      '<div class="lockwarn">変えたあとは、<b>前に書き出した控え</b>の鍵つきメモは前の番号で開きます。</div>' +
      '<div class="crow" style="margin-top:12px">' + UI.passInput("lk1", "新しい番号") + '</div>' +
      '<div class="crow" style="margin-top:8px">' + UI.passInput("lk2", "もう一度") + '</div>' +
      '<p class="lockmsg" id="lkmsg"></p>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn primary" id="lkok">変える</button>',
    bind: function (h) {
      var a = h.querySelector("#lk1"), b = h.querySelector("#lk2"), msg = h.querySelector("#lkmsg");
      var ok = h.querySelector("#lkok");
      ok.onclick = function () {
        var err = MemoLock.checkLen(a.value);
        if (err) { msg.textContent = err; return; }
        if (a.value !== b.value) { msg.textContent = "2つの番号が違います"; return; }
        ok.disabled = true; msg.textContent = "かけ直しています…";
        MemoLock.changeNumber(db, a.value).then(function () {
          Store.mark("settings"); Store.mark("memos"); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast("鍵の番号を変えました");
        })["catch"](function (e) { ok.disabled = false; msg.textContent = e.message || "変えられませんでした"; });
      };
    }
  });
};

/* 番号を忘れた。鍵つきのメモを消して決め直すしかない */
UI.forgetNumber = function () {
  var db = Store.current();
  var n = MemoLock.lockedCount(db);
  UI.confirm("番号を忘れた時",
    "鍵の番号は、どこにも残していません。思い出せない場合、鍵をかけたメモ（" + n + "件）は誰にも開けません。\n\n" +
    "この" + n + "件を消して、番号を決め直せるようにしますか。\n鍵をかけていないメモは消えません。",
    n + "件を消して決め直す", function () {
      var gone = MemoLock.forget(db);
      Store.mark("memos"); Store.mark("settings"); Store.flush();
      if (Nav.top().v === "memo") Nav.goTab("memos"); else App.render();
      UI.toast("鍵つきのメモ " + gone + "件を消しました");
    }, true);
};

/* 閉める */
UI.lockNow = function () {
  MemoLock.lock();
  App.render();
  UI.toast("鍵を閉めました");
};
window.UI = UI;
