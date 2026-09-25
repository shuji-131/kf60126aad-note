"use strict";
/* =======================================================
   ui/backupview.js — 控え
   ★ブラウザの保存データを消すと名簿ごと消える。防げないので戻せるようにする
     （消す操作の呼び名が iPhone と Android で違うので Ios.clearName() で出し分ける）
   ======================================================= */
var UI = window.UI || {};

UI.PhotoStat = { count: 0, bytes: 0, loaded: false };

UI.viewBackup = function () {
  var db = Store.current();
  var noKana = Select.noKana(db.people);
  var tags = Select.allTags(db.people);
  var since = Backup.daysSinceBackup();
  var textKB = Math.round(Store.usageBytes() / 1024);
  var phMB = (UI.PhotoStat.bytes / 1048576).toFixed(1);

  var warn = since == null
    ? '<div class="callout">まだ一度も控えを取っていません。<br><b>' + Ios.clearName() + 'を消すと名簿も消えます。</b></div>'
    : (since >= 30
        ? '<div class="callout">最後に控えを取ってから <b>' + since + '日</b>経っています。<br>' + Ios.clearName() + 'を消すと名簿も消えます。</div>'
        : '<div class="callout ok">最後に控えを取ったのは <b>' + since + '日前</b>です。</div>');

  return UI.appbar({ title: "控え" }) +
    '<div class="view">' + warn +
    '<button class="bigbtn primary wide" data-act="exp"><b>控えを書き出す（写真なし）</b>' +
      '<span>文字だけ・約 ' + Math.max(1, Math.round(textKB)) + ' KB。ふだんはこちらで十分</span></button>' +
    '<button class="bigbtn wide" data-act="expp"><b>控えを書き出す（写真あり）</b>' +
      '<span>写真も丸ごと・約 ' + phMB + ' MB。機種変更のときに</span></button>' +
    '<button class="bigbtn wide" data-act="imp"><b>控えから戻す</b>' +
      '<span>書き出したファイルを読み込む</span></button>' +

    /* ★iPhoneだけ。ホーム画面から開いていると「ファイルとして保存」が
       黙って効かないことがある。効かなかった時に中身を取り出せる道を必ず残す */
    (Ios.isIos()
      ? '<button class="bigbtn wide" data-act="exptext"><b>うまく保存できないとき — 文字で出す</b>' +
        '<span>控えを画面に出して、まるごとコピーできます</span></button>'
      : '') +

    UI.sec("使っている容量") +
    '<div class="secbody">' +
      '<div class="usage">文字 ' + db.people.length + '人・' + db.memos.length + '件のメモ ／ ' + textKB + ' KB' +
        '<div class="meter"><i style="width:' + Math.min(100, Math.round(textKB / 5120 * 100)) + '%"></i></div>' +
        '<div class="usub">文字の置き場は約 5 MB まで</div></div>' +
      '<div class="usage" style="margin-top:14px">写真 ' + UI.PhotoStat.count + '枚 ／ ' + phMB + ' MB' +
        '<div class="usub">写真は端末の空きに応じて数百MBまで置けます</div></div>' +
    '</div>' +

    UI.sec("手入れ") +
    '<button class="bigbtn wide" data-act="fixkana"><b>ふりがなが空の人 — ' + noKana.length + '人</b>' +
      '<span>まとめて埋める。埋めるとその行に並びます</span></button>' +
    '<button class="bigbtn wide" data-act="fixtags"><b>タグの整理 — ' + tags.length + '種類</b>' +
      '<span>名前を変える・2つを1つにまとめる・使っていないものを消す</span></button>' +
    '<button class="bigbtn wide" data-act="recrop"><b>写真の丸を作り直す — ' + UI.PhotoStat.count + '枚</b>' +
      '<span>2026-09-10より前に入れた写真は、丸が広すぎて顔が小さく写っています。' +
      '合わせ直した位置はそのまま、丸だけ焼き直します</span></button>' +

    (Ios.shouldOffer()
      ? UI.sec("ホーム画面") +
        '<button class="bigbtn wide" data-act="iosguide"><b>ホーム画面への入れ方</b>' +
        '<span>入れておくと全画面で開き、書いた中身が消えにくくなります</span></button>'
      : '') +

    UI.sec("この帳面について") +
    '<div class="secbody about">' +
      '<p>友人帳 — 個人的なつながりのできた人を、出会いから今日まで残しておく名簿帳。</p>' +
      '<p>書いた内容は<b>この端末の中だけ</b>にあります。外へ送っていません。</p>' +
      '<p class="dim">形の版 ' + db.meta.v + ' ／ アプリの版 ' + UI.esc(App.buildMark()) + '</p>' +
    '</div>' +
    '<div style="height:26px"></div></div>' + UI.tabbar();
};

UI.refreshPhotoStat = function () {
  return Promise.all([Photos.count(), Photos.totalBytes()]).then(function (a) {
    UI.PhotoStat = { count: a[0], bytes: a[1], loaded: true };
  })["catch"](function () { UI.PhotoStat.loaded = true; });
};

/* ---- 控えから戻す ---- */
UI.importBackup = function () {
  var inp = document.createElement("input");
  inp.type = "file";
  /* ★わざと絞らない。
     控えは .json で書き出しているが、Androidの選ぶ画面は拡張子ではなく
     渡し元が名乗る種類で絞る。Googleドライブやメール経由で受け取ると
     application/octet-stream と名乗ることがあり、accept を json に絞ると
     控えのファイルが灰色になって選べなくなる。
     選び間違えても中身を見て弾ける（restore が app:"yujincho" を確かめる）ので、
     「選べない」より「選んでから断る」ほうが安全。 */
  inp.accept = "";
  inp.onchange = function () {
    var f = inp.files && inp.files[0];
    if (!f) return;
    Backup.readFile(f).then(function (text) {
      UI.sheet({
        title: "控えから戻す",
        body: '<p class="sheet-msg">' + UI.esc(f.name) + '<br><br>' +
              '<b>全部入れ替える</b>… 今の中身を捨てて、控えの通りにします（ふつうはこちら）<br>' +
              '<b>足りない人だけ足す</b>… 今の中身を残したまま、控えにしかいない人とメモを足します</p>',
        foot: '<button class="btn ghost" id="impMerge">足りない分だけ足す</button>' +
              '<button class="btn primary" id="impRep">全部入れ替える</button>',
        bind: function (h) {
          h.querySelector("#impRep").onclick = function () { run("replace"); };
          h.querySelector("#impMerge").onclick = function () { run("merge"); };
          function run(mode) {
            UI.closeSheet();
            UI.toast("読み込んでいます…");
            Backup.restore(text, mode).then(function (r) {
              UI.refreshPhotoStat().then(function () {
                Nav.goTab("list");
                UI.toast(r.people + "人・" + r.memos + "件のメモを戻しました");
              });
            })["catch"](function (e) {
              UI.toast(e.message || "戻せませんでした", "warn");
            });
          }
        }
      });
    })["catch"](function (e) { UI.toast(e.message, "warn"); });
  };
  inp.click();
};

/* ---- 写真の丸を焼き直す ----
   ★人・メモ・タグには一切触らない。IndexedDB の写真だけを作り直す。
     元写真(src)と切り取り方(crop)は残してあるので、選び直さなくてよい */
UI.recropAll = function () {
  if (!UI.PhotoStat.count) { UI.toast("写真がまだありません"); return; }
  UI.confirm("写真の丸を作り直しますか",
    UI.PhotoStat.count + "枚を焼き直します。\n合わせた位置・大きさ・向きはそのままです。\n名簿の中身には触りません。",
    "作り直す", function () {
      UI.toast("作り直しています…");
      Photos.recropAll(function (n, total) {
        if (n % 5 === 0 || n === total) UI.toast("作り直しています… " + n + "/" + total);
      }).then(function (r) {
        Photos.revokeAll();
        UI.PhotoStat.loaded = false;
        App.render();
        if (r.failed) UI.toast(r.done + "枚を作り直しました（" + r.failed + "枚は元写真が無く飛ばしました）", "warn");
        else UI.toast(r.done + "枚を作り直しました");
      })["catch"](function () {
        UI.toast("作り直せませんでした（容量かもしれません）", "warn");
      });
    });
};

/* ---- ふりがなをまとめて埋める ---- */
UI.fixKana = function () {
  var db = Store.current();
  var list = Select.noKana(db.people);
  if (!list.length) { UI.toast("ふりがなが空の人はいません"); return; }
  var vals = {};
  UI.sheet({
    title: "ふりがなをまとめて埋める",
    body: '<p class="sheet-msg">埋めると、その人が一覧の「他」の行から出て、ちゃんとの行に並びます。<br>分からない人は空のままで大丈夫です。</p>' +
      '<div class="kanalist">' + list.map(function (p) {
        return '<div class="krow"><span class="knm">' + UI.esc(p.name) + '</span>' +
          '<input ' + UI.NOAUTO + 'data-kana="' + p.id + '" placeholder="ひらがなで" value=""></div>';
      }).join("") + '</div>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn primary" id="kanaOk">埋める</button>',
    bind: function (h) {
      h.querySelectorAll("[data-kana]").forEach(function (n) {
        n.oninput = function () { vals[n.dataset.kana] = n.value; };
      });
      h.querySelector("#kanaOk").onclick = function () {
        var n = 0;
        Object.keys(vals).forEach(function (id) {
          var v = String(vals[id] || "").trim();
          if (!v) return;
          var p = Data.findPerson(db, id);
          if (p) { p.kana = v; Data.touch(p); n++; }
        });
        if (n) { Store.mark("people"); Store.flush(); }
        UI.closeSheet(); App.render();
        UI.toast(n ? n + "人ぶん埋めました" : "変わりませんでした");
      };
    }
  });
};

/* ---- タグの手入れ ---- */
UI.fixTags = function () {
  var db = Store.current();
  var tags = Select.allTags(db.people);
  if (!tags.length) { UI.toast("タグがまだありません"); return; }
  UI.sheet({
    title: "タグの整理",
    body: '<p class="sheet-msg">名前を変えると、そのタグが付いている人ぜんぶで変わります。<br>同じ名前に変えれば、2つを1つにまとめられます。</p>' +
      '<div class="kanalist">' + tags.map(function (o) {
        return '<div class="krow"><input ' + UI.NOAUTO + 'data-tagname="' + UI.esc(o.t) + '" value="' + UI.esc(o.t) + '">' +
          '<span class="tnum">' + o.n + '人</span>' +
          '<button class="iconbtn sm" data-deltag="' + UI.esc(o.t) + '" aria-label="消す">' + IC.trash + '</button></div>';
      }).join("") + '</div>',
    foot: '<button class="btn ghost" data-sheet="close">やめる</button>' +
          '<button class="btn primary" id="tagOk">直す</button>',
    bind: function (h) {
      h.querySelectorAll("[data-deltag]").forEach(function (b) {
        b.onclick = function () {
          var t = b.dataset.deltag;
          db.people.forEach(function (p) {
            var i = p.tags.indexOf(t);
            if (i >= 0) { p.tags.splice(i, 1); Data.touch(p); }
          });
          db.memos.forEach(function (m) {
            var i = m.tags.indexOf(t);
            if (i >= 0) { m.tags.splice(i, 1); Data.touch(m); }
          });
          Store.mark(); Store.flush();
          UI.closeSheet(); App.render();
          UI.toast("「" + t + "」を消しました");
        };
      });
      h.querySelector("#tagOk").onclick = function () {
        var n = 0;
        h.querySelectorAll("[data-tagname]").forEach(function (i) {
          var from = i.dataset.tagname, to = String(i.value || "").trim().replace(/^#/, "");
          if (!to || to === from) return;
          db.people.forEach(function (p) {
            var k = p.tags.indexOf(from);
            if (k >= 0) {
              p.tags.splice(k, 1);
              if (p.tags.indexOf(to) < 0) p.tags.push(to);
              Data.touch(p); n++;
            }
          });
          db.memos.forEach(function (m) {
            var k = m.tags.indexOf(from);
            if (k >= 0) {
              m.tags.splice(k, 1);
              if (m.tags.indexOf(to) < 0) m.tags.push(to);
              Data.touch(m);
            }
          });
        });
        if (n) { Store.mark(); Store.flush(); }
        UI.closeSheet(); App.render();
        UI.toast(n ? "直しました" : "変わりませんでした");
      };
    }
  });
};
window.UI = UI;
