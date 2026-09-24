"use strict";
/* =======================================================
   main.js — 起動して組み立てる
   ======================================================= */
var App = (function () {

  var booted = false;

  /* ★アプリの版。Androidの入れ物を作り直す時は、この4つを必ずそろえる:
       ここ ／ sw.js の CACHE ／ app/build.gradle の versionCode・versionName ／ MainActivity.BUILD_MARK */
  var BUILD = "v9";

  /* 今動いている版。アプリの中なら入れ物が名乗る版を優先する
     （画面だけ差し替わって入れ物が古い、という食い違いに気付けるように） */
  function buildMark() {
    try {
      if (window.Yujincho && window.Yujincho.buildMark) return window.Yujincho.buildMark() + "（アプリ）";
    } catch (e) { /* 名乗れなくても困らない */ }
    return BUILD;
  }

  /* ★アプリを新しくした直後の身の守り方。
     上書きで入れ直すぶんには中身は消えない（同じ入れ物・同じ署名なので、
     端末は「同じアプリの新しい版」として扱い、名簿も写真もそのまま残る）。
     消えるのは「一度消してから入れ直した」時だけ。そこで、版が変わったのを
     見つけたら、まず控えを端末のダウンロードへ黙って1つ書き出しておく。
     ★ここで「控えを取りますか？」とは聞かない。聞くと、返事をしないまま
       使い始めて控えが無いまま、という一番まずい形になる */
  function guardUpdate(db) {
    var now = buildMark(), seen = null;
    try { seen = localStorage.getItem("yujincho.buildSeen"); } catch (e) { return; }
    try { localStorage.setItem("yujincho.buildSeen", now); } catch (e) { /* 書けなくても進む */ }

    if (!seen || seen === now) return;      // 初めて入れた時／版が同じ時は何もしない
    if (!db.people.length && !db.memos.length) return;   // 守るものが無い

    /* 端末へ直に書けるのはアプリの中だけ。ブラウザで黙って落とすと驚かせるので、
       そちらは「取ってください」と伝えるだけにする */
    if (window.Yujincho && window.Yujincho.saveFile) {
      Backup.download(false).then(function (name) {
        UI.toast("新しい版になったので、念のため控えを書き出しました：" + name);
      })["catch"](function () {
        UI.toast("新しい版になりました。控えの画面から控えを書き出してください", "warn");
      });
    } else {
      setTimeout(function () {
        UI.toast("新しい版になりました。控えの画面から控えを書き出しておいてください", "warn");
      }, 600);
    }
  }

  /* ★日が過ぎた予定を「記録」へ移す係。
     起動した時と、裏から戻ってきた時に通す
     （開いたまま日付が変わることがあるので、起動時だけでは足りない）。
     ★ここに「移しますか？」の確認は付けない。返事待ちのあいだ、
       過ぎた予定が予定の欄に居座って、何が控えているのか読めなくなる */
  function sweepSched(tell) {
    var db = Store.current();
    if (!db) return 0;
    var n = Sched.sweep(db);
    if (!n) return 0;
    Store.mark("people");
    Store.flush();
    if (tell) {
      setTimeout(function () {
        UI.toast("日が過ぎた予定 " + n + "件を、記録へ移しました");
      }, 700);
    }
    return n;
  }

  /* ---- 描く ---- */
  function render() {
    var app = UI.el("app");
    var f = Nav.top();
    var html;

    switch (f.v) {
      case "list":     html = UI.viewList(); break;
      case "person":   html = UI.viewPerson(); break;
      case "edit":     html = UI.viewEdit(); break;
      case "birth":    html = UI.viewBirth(); break;
      case "crop":     html = UI.viewCrop(); break;
      case "care":     html = UI.viewCare(); break;
      case "memos":    html = UI.viewMemos(); break;
      case "memo":     html = UI.viewMemo(); break;
      case "memoedit": html = UI.viewMemoEdit(); break;
      case "ref":      html = f.code ? UI.viewRefDetail() : UI.viewRef(); break;
      case "backup":   html = UI.viewBackup(); break;
      default:         html = UI.viewList();
    }
    app.innerHTML = html;

    bindCommon(app);
    if (f.v === "list") UI.bindList(app);
    if (f.v === "person") UI.bindPerson(app);
    if (f.v === "edit") UI.bindEdit(app);
    if (f.v === "birth") UI.bindBirth(app);
    if (f.v === "crop") UI.bindCrop();
    if (f.v === "memos") UI.bindMemos(app);
    if (f.v === "memoedit") UI.bindMemoEdit(app);
    if (f.v === "ref") UI.bindRef(app);

    UI.hydratePhotos(app);

    /* 控えの画面に来たら写真の量を測り直す */
    if (f.v === "backup" && !UI.PhotoStat.loaded) {
      UI.refreshPhotoStat().then(function () { if (Nav.top().v === "backup") render(); });
    }
  }

  /* ---- 共通の操作 ---- */
  function bindCommon(app) {
    app.querySelectorAll('[data-nav="back"]').forEach(function (b) {
      b.onclick = function () { Nav.pop(); };
    });
    app.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { Nav.goTab(b.dataset.tab); };
    });
    app.querySelectorAll("[data-person]").forEach(function (b) {
      function go() { Nav.push({ v: "person", id: b.dataset.person }); }
      b.onclick = go;
      /* ★一覧の行は button ではなく div（中にタグの横スクロールを入れるため）。
         キーボードと読み上げから押せるようにするのは、こちらの仕事になる */
      b.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      };
    });
    app.querySelectorAll("[data-memo]").forEach(function (b) {
      b.onclick = function () { Nav.push({ v: "memo", id: b.dataset.memo }); };
    });
    app.querySelectorAll("[data-act]").forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); act(b.dataset.act); };
    });
  }

  function act(a) {
    var db = Store.current();
    var f = Nav.top();
    var person = (f.v === "person") ? Data.findPerson(db, f.id) : null;

    switch (a) {
      /* 一覧 */
      case "addperson": UI.openEdit(null); break;
      case "search":    UI.openSearch("list"); break;
      case "filter":    UI.openFilter(); break;
      case "sort":      UI.openSort(); break;

      /* 人の頁 */
      case "editperson": UI.openEdit(f.id); break;
      case "photo":      if (person) UI.openPhoto(person); break;
      case "addlog":     if (person) UI.openLogEdit(person, null); break;
      case "addsched":   if (person) UI.openSchedEdit(person, null); break;
      case "birth":
        UI.openBirth(f.v === "edit" ? "draft" : "person:" + f.id);
        break;

      /* 入力 */
      case "saveperson": UI.savePerson(); break;
      case "delperson":  UI.deletePerson(); break;
      case "addtag":     UI.addTag(UI.el("tagInput") ? UI.el("tagInput").value : ""); break;
      case "addcontact":
        UI.EditDraft.contacts.push({ k: "", v: "" });
        render();
        break;

      /* 生年月日 */
      case "birthok": UI.saveBirth(); break;

      /* 写真 */
      case "cropok":    UI.saveCrop(); break;
      case "cropdel":   UI.deletePhoto(); break;
      case "rotate":    UI.Crop.rot = ((UI.Crop.rot || 0) + 90) % 360; if (UI.Crop.paint) UI.Crop.paint(); break;
      case "cropreset": UI.Crop.x = 0; UI.Crop.y = 0; UI.Crop.zoom = 1; UI.Crop.rot = 0;
                        if (UI.el("zoom")) UI.el("zoom").value = 100;
                        if (UI.Crop.paint) UI.Crop.paint(); break;
      case "repick": {
        var p2 = Data.findPerson(db, UI.Crop.pid);
        if (p2) { Nav.pop(); UI.pickPhoto(p2); }
        break;
      }

      /* 気にかける */
      case "colddays":   UI.askColdDays(); break;
      case "schedahead": UI.askSchedAhead(); break;

      /* メモ */
      case "addmemo":  UI.openMemoEdit(null); break;
      case "editmemo": UI.openMemoEdit(f.id); break;
      case "savememo": UI.saveMemo(); break;
      case "delmemo":  UI.deleteMemo(); break;
      case "msearch":  UI.openSearch("memo"); break;
      case "mclear":   UI.MemoState.search = ""; render(); break;
      case "maddtag":  UI.addMemoTag(UI.el("mtagInput") ? UI.el("mtagInput").value : ""); break;
      case "mpin": {
        var m = Data.findMemo(db, f.id);
        m.pin = !m.pin; Data.touch(m);
        Store.mark("memos"); Store.flush(); render();
        UI.toast(m.pin ? "上に留めました" : "ピンを外しました");
        break;
      }
      case "mdone": {
        var m2 = Data.findMemo(db, f.id);
        m2.done = !m2.done; Data.touch(m2);
        Store.mark("memos"); Store.flush(); render();
        UI.toast(m2.done ? "済にしました" : "未済に戻しました");
        break;
      }
      case "mlink": {
        if (f.v === "memoedit") {
          UI.pickPeople(UI.MemoDraft.who, function (list) { UI.MemoDraft.who = list; render(); });
        } else {
          var m3 = Data.findMemo(db, f.id);
          UI.pickPeople(m3.who, function (list) {
            m3.who = list; Data.touch(m3);
            Store.mark("memos"); Store.flush(); render();
          });
        }
        break;
      }

      /* 控え */
      case "exp":  Backup.download(false).then(function (n) { UI.toast("書き出しました：" + n); render(); })
                     ["catch"](function () { UI.toast("書き出せませんでした", "warn"); }); break;
      case "expp": UI.toast("写真も入れて作っています…");
                   Backup.download(true).then(function (n) { UI.toast("書き出しました：" + n); render(); })
                     ["catch"](function () { UI.toast("書き出せませんでした", "warn"); }); break;
      case "imp":  UI.importBackup(); break;
      /* iPhone用。ファイルとして保存が滑ったときの逃げ道と、入れ方の案内 */
      case "exptext":  Ios.textBackup(); break;
      case "iosguide": Ios.guide(); break;
      case "fixkana": UI.fixKana(); break;
      case "fixtags": UI.fixTags(); break;
      case "recrop":  UI.recropAll(); break;
    }
  }

  function showSaveError(msg) { UI.toast(msg, "warn"); }

  /* ---- 起動 ---- */
  function boot() {
    if (booted) return;
    booted = true;

    /* ★画面を組む前に。置かれ方によっては <head> の名札が
       <body> に落ちている。iPhoneの「ホーム画面に追加」が
       それを見に行くので、先に戻しておく */
    try { Ios.liftHead(); } catch (e) { /* 戻せなくても本体は動く */ }

    var db;
    try {
      db = Store.load();
    } catch (e) {
      UI.el("app").innerHTML = '<div class="bootfail"><h1>開けませんでした</h1><p>' + UI.esc(e.message) + '</p></div>';
      return;
    }

    Store.askPersist();
    /* ★画面を出す前に片づける。出したあとに動かすと、
       予定の欄に一瞬だけ過ぎたものが見えてしまう */
    sweepSched(true);
    Nav.start(render);
    guardUpdate(db);

    /* 開いたまま日付が変わることがある。裏から戻ってきたらもう一度見る */
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (sweepSched(true)) render();
    });

    /* ひとつ前の状態で開いた時は必ず知らせる */
    var rec = Store.recoveredKeys();
    if (rec.length) {
      setTimeout(function () {
        UI.toast("保存されていた中身が読めなかったので、ひとつ前の状態で開きました", "warn");
      }, 400);
    }

    /* 控えの催促（30人を超えていて、まだ一度も取っていない時に一度だけ） */
    var since = Backup.daysSinceBackup();
    if (db.people.length >= 30 && since == null && !sessionStorage.getItem("yujincho.nagged")) {
      sessionStorage.setItem("yujincho.nagged", "1");
      setTimeout(function () {
        UI.confirm("控えを取りませんか",
          "登録が " + db.people.length + "人になりました。\n" + Ios.clearName() + "を消すと名簿ごと消えます。これは作り方では防げません。\n\n控えを書き出しておくと戻せます。",
          "控えの画面へ", function () { Nav.goTab("backup"); });
      }, 900);
    }

    UI.refreshPhotoStat();

    /* iPhone は「インストール」ボタンを作れないので、入れ方を案内する。
       ★画面を出したあとに出す。先に出すと組み直しで消える */
    setTimeout(function () { try { Ios.bar(); } catch (e) { /* 案内が出なくても本体は動く */ } }, 1200);

    /* ネットが無くても開けるようにする係。
       1ファイルにまとめた版には sw.js が無いので登録しない */
    if (!window.__SINGLE_FILE__ && "serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
      navigator.serviceWorker.register("sw.js")["catch"](function () {});
    }
  }

  return { BUILD: BUILD, buildMark: buildMark,
           boot: boot, render: render, act: act, showSaveError: showSaveError };
})();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", App.boot);
else App.boot();
