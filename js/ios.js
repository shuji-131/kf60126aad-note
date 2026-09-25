"use strict";
/* =======================================================
   ios.js — iPhone / iPad で使うときの手当て

   iPhone には Android のような「インストール」ボタンが作れない。
   ページ側から「入れますか？」を出す合図を Apple が用意していないので、
   本人に 共有 → ホーム画面に追加 を押してもらうしかない。
   ここはその案内を出す係。

   ★ホーム画面に追加してもらうのは、見た目のためだけではない。
     Safari でただ開いているだけだと、しばらく使わない期間があったときに
     中身（名簿の置き場）が消されることがある。ホーム画面に追加したものは
     その対象から外れる。つまり「追加してもらう」は名簿を守る工程でもある。

   ★ここは案内を出すだけ。名簿のデータには一切触らない。
   ======================================================= */
var Ios = (function () {

  var KEY = "yujincho.iosGuideHidden";

  /* ---- 置かれ方の手当て ----
     ★置き場所によっては、こちらのページが「外側の入れ物」に包まれて配られる。
       そうなると <head> に書いた名札（アイコン・アプリ名・全画面の指定）が
       <body> の中に落ちる。iPhone は「ホーム画面に追加」を押したその時に
       これらを見に行くので、落ちたままだとアイコンが付かず全画面にもならない。
       そこで、body に落ちていたら head へ移し直す。
       ふつうに置いた時は最初から head にあるので、何も起きない */
  function liftHead() {
    var head = document.head;
    if (!head || !document.body) return 0;
    var sel = 'title,' +
      'link[rel="manifest"],link[rel="apple-touch-icon"],link[rel="icon"],' +
      'meta[name="theme-color"],meta[name="mobile-web-app-capable"],' +
      'meta[name="apple-mobile-web-app-capable"],' +
      'meta[name="apple-mobile-web-app-title"],' +
      'meta[name="apple-mobile-web-app-status-bar-style"]';
    var moved = 0;
    var list = document.body.querySelectorAll(sel);
    Array.prototype.forEach.call(list, function (n) {
      head.appendChild(n);   /* 動かすだけ。同じものが2つにはならない */
      moved++;
    });
    return moved;
  }

  /* ---- 見分け ---- */

  /* iPhone / iPad か。
     ★iPadOS 13以降の iPad は自分を Mac と名乗るので、名前だけでは見分けられない。
       「Mac と名乗っているのに指で触れる」ものは iPad として扱う */
  function isIos() {
    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && typeof document.ontouchend !== "undefined";
  }

  /* もうホーム画面から開いている（＝案内は要らない） */
  function isStandalone() {
    if (window.navigator.standalone === true) return true;      /* iOS はこの印 */
    try { return window.matchMedia("(display-mode: standalone)").matches; }
    catch (e) { return false; }
  }

  /* LINE や Instagram の中で開いた画面。
     ここの共有ボタンには「ホーム画面に追加」が無いので、先に Safari で開いてもらう */
  function inApp() {
    var ua = navigator.userAgent || "";
    return /Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK/i.test(ua);
  }

  /* Safari そのものか。
     ★iOS の Chrome・Edge・Firefox は中身が Safari と同じで、
       「ホーム画面に追加」も持っている。ただし共有ボタンの位置が違い、
       こちらからは相手の画面を確かめられない。
       確かめられない画面の手順は書かず、Safari で開いてもらう */
  function isSafari() {
    var ua = navigator.userAgent || "";
    if (inApp()) return false;
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  }

  /* 案内を出す場面か（iPhoneで・まだホーム画面に入れていない） */
  function shouldOffer() { return isIos() && !isStandalone(); }

  function hidden() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function hide() {
    try { localStorage.setItem(KEY, "1"); } catch (e) { /* 覚えられなくても困らない */ }
  }

  /* ---- 画面に出すもの ---- */

  /* iOS の共有ボタンの絵（四角から上に矢印）。見た目で名指しできるように */
  var SHARE_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"/>' +
    '<path d="M6.5 11H5.2A1.2 1.2 0 0 0 4 12.2v7.6A1.2 1.2 0 0 0 5.2 21h13.6a1.2 1.2 0 0 0 1.2-1.2v-7.6A1.2 1.2 0 0 0 18.8 11h-1.3"/>' +
    "</svg>";

  /* 下に出る帯。#app の外に置くので、画面を組み直しても消えない */
  function bar() {
    if (!shouldOffer() || hidden()) return;
    if (document.getElementById("iosbar")) return;

    var d = document.createElement("div");
    d.id = "iosbar";
    d.className = "iosbar";

    if (!isSafari()) {
      /* Safari 以外。ここで手順を書いても押すものが違うので、開き直してもらう */
      d.innerHTML =
        '<div class="iosbar-t">Safari で開いてください</div>' +
        '<div class="iosbar-b">この画面のままだと、ホーム画面に入れられません。<br>' +
        'アドレスをコピーして、Safari に貼り付けて開いてください。</div>' +
        '<div class="iosbar-f">' +
          '<button class="btn ghost sm" data-ios="later">あとで</button>' +
          '<button class="btn primary sm" data-ios="copy">アドレスをコピー</button>' +
        "</div>";
    } else {
      d.innerHTML =
        '<div class="iosbar-t">ホーム画面に入れて使ってください</div>' +
        '<div class="iosbar-b">' +
          '<span class="iosbar-n">1</span>下の真ん中の ' + SHARE_SVG + ' を押す<br>' +
          '<span class="iosbar-n">2</span>出てきた一覧を下にたどる<br>' +
          '<span class="iosbar-n">3</span>「ホーム画面に追加」を押す' +
        "</div>" +
        '<div class="iosbar-w">入れておくと全画面で開き、<b>書いた中身が消えにくくなります</b>。' +
        'Safari で開いたままだと、しばらく使わない期間があったときに消されることがあります。</div>' +
        '<div class="iosbar-f">' +
          '<button class="btn ghost sm" data-ios="later">あとで</button>' +
          '<button class="btn primary sm" data-ios="done">入れた</button>' +
        "</div>";
    }

    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("on"); });

    d.querySelectorAll("[data-ios]").forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.ios;
        if (k === "copy") { copyUrl(); return; }
        if (k === "done") hide();          /* 入れたなら二度と出さない */
        close();
      };
    });
  }

  function close() {
    var d = document.getElementById("iosbar");
    if (!d) return;
    d.classList.remove("on");
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 200);
  }

  function copyUrl() {
    var url = location.href;
    var done = function () { if (window.UI) UI.toast("アドレスをコピーしました"); };
    var fail = function () { if (window.UI) UI.toast("コピーできませんでした。アドレス欄から手でコピーしてください", "warn"); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done)["catch"](fail);
        return;
      }
    } catch (e) { /* 下の手で拾う */ }
    fail();
  }

  /* 帯を「あとで」で閉じたあと、もう一度見たい時の入口（控えの画面から呼ぶ） */
  function guide() {
    if (!window.UI) return;
    var body = isSafari()
      ? '<p class="sheet-msg"><b>1.</b> 下の真ん中の共有ボタン（四角から上に矢印が出ている絵）を押します<br><br>' +
        '<b>2.</b> 出てきた一覧を下にたどります<br><br>' +
        '<b>3.</b> 「ホーム画面に追加」を押します<br><br>' +
        'ホーム画面にアイコンが並びます。押すと全画面で開き、アドレス欄も出ません。<br><br>' +
        '入れておくと<b>書いた中身が消えにくくなります</b>。Safari で開いたままだと、' +
        'しばらく使わない期間があったときに消されることがあります。</p>'
      : '<p class="sheet-msg">いま見ているのは Safari ではありません。<br>' +
        'この画面からはホーム画面に入れられないので、アドレスをコピーして Safari に貼り付けて開いてください。</p>';
    UI.sheet({
      title: "ホーム画面への入れ方",
      body: body,
      foot: isSafari()
        ? '<button class="btn primary" data-sheet="close">閉じる</button>'
        : '<button class="btn ghost" data-sheet="close">閉じる</button>' +
          '<button class="btn primary" id="iosCopy">アドレスをコピー</button>',
      bind: function (h) {
        var c = h.querySelector("#iosCopy");
        if (c) c.onclick = copyUrl;
      }
    });
  }

  /* ---- 控えの書き出しが滑ったときの逃げ道 ----
     ★iPhone の「ファイルとして保存」は、ホーム画面から開いた状態だと
       黙って何も起きないことがある。こちらからは実機を確かめられないので、
       落ちたときに中身を取り出せる道を必ず用意しておく。
       文字だけの控え（写真なし）を画面に出して、丸ごとコピーできるようにする */
  function textBackup() {
    if (!window.UI || !window.Backup) return;
    UI.toast("控えを作っています…");
    Backup.build(false).then(function (out) {
      var text = JSON.stringify(out);
      UI.sheet({
        title: "文字で控えを出す",
        body: '<p class="sheet-msg">下の文字が控えそのものです。まるごとコピーして、' +
              'メモ帳やメールなど、消えない所に貼って残してください。<br>' +
              '戻すときは、その文字を <b>.json</b> という名前のファイルにして「控えから戻す」で読み込みます。</p>' +
              '<textarea autocomplete="off" id="iosBkText" class="bktext" readonly rows="8"></textarea>' +
              '<p class="sheet-msg dim">' + Math.max(1, Math.round(text.length / 1024)) + " KB ぶんの文字です。</p>",
        foot: '<button class="btn ghost" data-sheet="close">閉じる</button>' +
              '<button class="btn primary" id="iosBkCopy">まるごとコピー</button>',
        bind: function (h) {
          var ta = h.querySelector("#iosBkText");
          ta.value = text;
          h.querySelector("#iosBkCopy").onclick = function () {
            ta.focus();
            ta.setSelectionRange(0, ta.value.length);
            var ok = false;
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                  UI.toast("コピーしました");
                })["catch"](function () {
                  UI.toast("長押しして「すべてを選択」→「コピー」してください", "warn");
                });
                return;
              }
              ok = document.execCommand("copy");
            } catch (e) { ok = false; }
            UI.toast(ok ? "コピーしました" : "長押しして「すべてを選択」→「コピー」してください", ok ? "" : "warn");
          };
        }
      });
    })["catch"](function (e) {
      UI.toast(e && e.message ? e.message : "控えを作れませんでした", "warn");
    });
  }

  /* ---- 言い回しを端末に合わせる ----
     「これを消すと名簿も消える」の“これ”が、iPhone と Android で違う */
  function clearName() {
    return isIos() ? "Safariの履歴とWebサイトデータ" : "Chromeの閲覧データ";
  }

  return {
    liftHead: liftHead,
    isIos: isIos, isStandalone: isStandalone, isSafari: isSafari,
    shouldOffer: shouldOffer, bar: bar, close: close,
    guide: guide, textBackup: textBackup, clearName: clearName
  };
})();
window.Ios = Ios;
