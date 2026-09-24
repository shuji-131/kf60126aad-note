"use strict";
/* =======================================================
   ui/edit.js — 人を足す・直す
   名前だけ入れれば登録できる。残りは後から埋められる。
   ======================================================= */
var UI = window.UI || {};

UI.EditDraft = null;

UI.openEdit = function (id) {
  var db = Store.current();
  if (id) {
    var p = Data.findPerson(db, id);
    UI.EditDraft = JSON.parse(JSON.stringify(p));
    UI.EditDraft._new = false;
  } else {
    var np = Data.blankPerson(db);
    np._new = true;
    UI.EditDraft = np;
    Store.mark("meta");     // seq を進めたので書いておく
  }
  Nav.push({ v: "edit", id: UI.EditDraft.id });
};

UI.viewEdit = function () {
  var db = Store.current();
  var d = UI.EditDraft;
  if (!d) return UI.appbar({ title: "入力", back: true }) + '<div class="view">' + UI.empty("入力が失われました") + '</div>';

  var catOpts = db.cats.map(function (c) {
    return '<option value="' + UI.esc(c.k) + '"' + (d.cat === c.k ? " selected" : "") + '>' + UI.esc(c.k) + '</option>';
  }).join("");

  function typeSel(kind, list, cur) {
    var opts = '<option value="">— 未記入 —</option>' + list.map(function (x) {
      return '<option value="' + x.c + '"' + (cur.code === x.c ? " selected" : "") + '>' + x.c + '　' + x.n + '</option>';
    }).join("");
    return '<label class="fld"><span class="lb">' + (kind === "mbti" ? "MBTI" : "ラブタイプ") + '</span>' +
      '<select data-f="' + kind + '.code">' + opts + '</select>' +
      '<div class="seg small" style="margin-top:8px">' +
        ['', 'said', 'guess'].map(function (v) {
          var lb = v === "" ? "確度なし" : (v === "said" ? "本人が言っていた" : "たぶんこれ");
          return '<button type="button" data-sure="' + kind + ':' + v + '" class="' + (cur.sure === v ? "on" : "") + '">' + lb + '</button>';
        }).join("") +
      '</div></label>';
  }

  var tagChips = d.tags.map(function (t) {
    return '<span class="chip on">#' + UI.esc(t) + '<span class="x" data-untag="' + UI.esc(t) + '">✕</span></span>';
  });
  /* ★12種類までで切っていた＝それを超えたタグは選べず、打ち直して表記が割れていた。
     全部並べて、はみ出したぶんは横に流す。多い時は上の欄に打つと絞り込める */
  var suggest = Select.allTags(db.people).filter(function (o) { return d.tags.indexOf(o.t) < 0; });

  /* ★何件でも足せる。SNSはURLをそのまま貼れば、人の頁で押して開ける形になる。
     開ける形になっているかは、入れている最中もここで見える（下の「開けます」の印） */
  var contacts = d.contacts.map(function (c, i) {
    var url = Data.linkOf(c.v);
    return '<div class="crow cwrap">' +
      '<input class="ck" data-c="' + i + ':k" value="' + UI.esc(c.k) + '" placeholder="LINE / X / 携帯">' +
      '<input class="cv" data-c="' + i + ':v" value="' + UI.esc(c.v) + '" placeholder="ID・番号・URL">' +
      '<button class="iconbtn sm" data-delc="' + i + '" aria-label="消す">' + IC.trash + '</button>' +
      (url ? '<span class="clinkmark">↗ 押して開ける住所として入っています</span>' : '') +
      '</div>';
  }).join("");

  var birth = Birth.text(d.birth);

  return UI.appbar({
    title: d._new ? "新しい人" : "直す",
    back: true, backLabel: "やめる",
    actions: UI.textbtn("saveperson", "保存", "primary")
  }) +
  '<div class="view form">' +
    UI.sec("名前") +
    '<div class="formbody">' +
      UI.input({ label: "名前", name: "name", value: d.name, req: true, ph: "例）相沢 ひなた" }) +
      UI.input({ label: "ふりがな", name: "kana", value: d.kana, ph: "あいざわ ひなた",
                 help: "空でも登録できます。その時は一覧の<b>「他」の行</b>に入ります" }) +
      UI.input({ label: "呼び方", name: "nick", value: d.nick, ph: "ひなちゃん" }) +
    '</div>' +

    UI.sec("区分と印") +
    '<div class="formbody">' +
      '<label class="fld"><span class="lb">区分（1人に1つ）</span><select data-f="cat">' + catOpts + '</select></label>' +
      '<div class="fld"><span class="lb">近さ</span>' +
        '<div class="starpick">' + [1,2,3,4,5].map(function (n) {
          return '<button type="button" data-star="' + n + '" class="' + (d.star >= n ? "on" : "") + '">★</button>';
        }).join("") + '<span class="starnum">' + d.star + '</span></div></div>' +
      '<div class="fld"><span class="lb">⚑ 注意の印</span>' +
        '<div class="seg small"><button type="button" data-alert="0" class="' + (!d.alert ? "on" : "") + '">付けない</button>' +
        '<button type="button" data-alert="1" class="' + (d.alert ? "on warn" : "") + '">付ける</button></div>' +
        '<span class="hlp">区分とは別の印です。会社関連で、かつ注意、も表せます</span></div>' +
      (d.alert ? UI.input({ label: "注意の理由", name: "alertWhy", type: "textarea", rows: 2,
                            value: d.alertWhy, ph: "金額の話は必ず○○さんを通す" }) : '') +
    '</div>' +

    UI.sec("タグ", UI.tagcount(d.tags.length + suggest.length)) +
    '<div class="formbody">' +
      (tagChips.length ? UI.tagrail(tagChips, "pick")
                       : '<div class="chipbox"><span class="blank">まだありません</span></div>') +
      '<div class="crow"><input id="tagInput" placeholder="タグを足す・下の候補を絞る（例：大学）" enterkeyhint="done">' +
        '<button class="btn ghost sm" data-act="addtag">足す</button></div>' +
      (suggest.length
        ? UI.tagrail(suggest.map(function (o) {
            return '<button class="chip" data-addtag="' + UI.esc(o.t) + '">#' + UI.esc(o.t) +
              '<span class="n">' + o.n + '</span></button>';
          }), "pick sug") +
          '<span class="hlp" id="tagNoHit" hidden>あてはまるタグがありません。' +
          'そのまま「足す」を押すと、新しいタグとして作れます</span>' +
          '<span class="hlp">すでにあるタグは<b>' + suggest.length + '種類ぜんぶ</b>並んでいます。' +
          '横になぞって探すか、上の欄に打つと絞り込めます</span>'
        : '<span class="hlp">まだ他の人にもタグが付いていません。ここで作ったものが次から候補に出ます</span>') +
    '</div>' +

    UI.sec("覚え書き") +
    '<div class="formbody">' +
      UI.input({ label: "特徴", name: "trait", type: "textarea", rows: 3, value: d.trait,
                 ph: "話し方がゆっくり／メガネ／犬を2匹飼っている",
                 help: "見た目・話し方・人柄など、その人を思い出せることを何行でも。検索にも効きます" }) +
      UI.input({ label: "所属・仕事", name: "org", value: d.org }) +
      UI.input({ label: "住まい", name: "area", value: d.area }) +
      UI.input({ label: "家族・ペット", name: "family", value: d.family }) +
      UI.input({ label: "好きなもの・話題", name: "likes", value: d.likes }) +
      UI.input({ label: "触れない方がいいこと", name: "avoid", type: "textarea", rows: 2, value: d.avoid }) +
      '<div class="fld"><span class="lb">生年月日</span>' +
        '<button class="btn ghost wide" data-act="birth">' + (birth ? UI.esc(birth) : "不明のまま（押すと入れられます）") + '</button>' +
        '<span class="hlp">年が分からなくても、年齢だけでも登録できます</span></div>' +
    '</div>' +

    UI.sec("連絡先") +
    '<div class="formbody">' + (contacts || '<p class="blank" style="margin:0 0 8px">まだありません</p>') +
      '<button class="btn ghost wide" data-act="addcontact">＋ 連絡先を足す</button>' +
      '<span class="hlp">何件でも足せます。SNSは<b>ページのURLをそのまま貼る</b>と、' +
      'この人の頁から押して開けるようになります（<b>http…</b> か <b>www.</b> で始まるもの）</span></div>' +

    UI.sec("型（目安）") +
    '<div class="formbody">' + typeSel("mbti", MBTI, d.mbti) + typeSel("love", LOVE, d.love) +
      '<span class="hlp">どちらも目安です。本人から聞いた型と、こちらの推測は分けて残します</span></div>' +

    UI.sec("出会い") +
    '<div class="formbody">' +
      UI.input({ label: "出会った日", name: "met.on", type: "date", value: d.met.on }) +
      UI.input({ label: "場所ときっかけ", name: "met.where", type: "textarea", rows: 2, value: d.met.where,
                 ph: "大学のサークルの歓迎会", help: "ここがいちばん後から効きます" }) +
      UI.input({ label: "紹介してくれた人", name: "met.by", value: d.met.by }) +
    '</div>' +

    '<div style="height:10px"></div>' +
    '<button class="bigbtn primary wide" data-act="saveperson"><b>保存する</b><span>名前だけでも登録できます</span></button>' +
    (d._new ? '' :
      '<button class="bigbtn danger wide" data-act="delperson"><b>この人を消す</b><span>記録も写真も一緒に消えます。元に戻せません</span></button>') +
    '<div style="height:30px"></div>' +
  '</div>';
};

UI.bindEdit = function (app) {
  var d = UI.EditDraft;
  if (!d) return;

  function setPath(path, val) {
    var a = path.split(".");
    if (a.length === 1) d[a[0]] = val;
    else d[a[0]][a[1]] = val;
  }

  app.querySelectorAll("[data-f]").forEach(function (n) {
    var ev = (n.tagName === "SELECT") ? "change" : "input";
    n.addEventListener(ev, function () { setPath(n.dataset.f, n.value); });
  });
  app.querySelectorAll("[data-star]").forEach(function (b) {
    b.onclick = function () { d.star = +b.dataset.star; App.render(); };
  });
  app.querySelectorAll("[data-alert]").forEach(function (b) {
    b.onclick = function () { d.alert = b.dataset.alert === "1"; App.render(); };
  });
  app.querySelectorAll("[data-sure]").forEach(function (b) {
    b.onclick = function () {
      var a = b.dataset.sure.split(":");
      d[a[0]].sure = a[1];
      App.render();
    };
  });
  app.querySelectorAll("[data-untag]").forEach(function (b) {
    b.onclick = function () { d.tags.splice(d.tags.indexOf(b.dataset.untag), 1); App.render(); };
  });
  app.querySelectorAll("[data-addtag]").forEach(function (b) {
    b.onclick = function () { UI.addTag(b.dataset.addtag); };
  });
  var ti = UI.el("tagInput");
  if (ti) {
    ti.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); UI.addTag(ti.value); }
    });
    /* ★候補は全部並べてある。多い時に見つけられるよう、打った文字で絞る */
    ti.addEventListener("input", function () { UI.filterTagSuggest(app, ti.value); });
  }
  app.querySelectorAll("[data-c]").forEach(function (n) {
    n.addEventListener("input", function () {
      var a = n.dataset.c.split(":");
      d.contacts[+a[0]][a[1]] = n.value;
      /* ★ここで App.render() を呼ばない＝打っている途中に入力欄が作り直されて
         カーソルが飛ぶ。印だけ、その場で付け外しする */
      if (a[1] === "v") {
        var row = n.parentNode, mark = row.querySelector(".clinkmark");
        var ok = !!Data.linkOf(n.value);
        if (ok && !mark) {
          mark = document.createElement("span");
          mark.className = "clinkmark";
          mark.textContent = "↗ 押して開ける住所として入っています";
          row.appendChild(mark);
        } else if (!ok && mark) {
          row.removeChild(mark);
        }
      }
    });
  });
  app.querySelectorAll("[data-delc]").forEach(function (b) {
    b.onclick = function () { d.contacts.splice(+b.dataset.delc, 1); App.render(); };
  });
};

UI.addTag = function (t) {
  t = String(t || "").trim().replace(/^#/, "");
  if (!t) return;
  var d = UI.EditDraft;
  if (d.tags.indexOf(t) < 0) d.tags.push(t);
  App.render();
};

UI.savePerson = function () {
  var d = UI.EditDraft, db = Store.current();
  d.name = String(d.name || "").trim();
  if (!d.name) { UI.toast("名前だけは入れてください", "warn"); return; }
  d.contacts = d.contacts.filter(function (c) { return (c.k || "").trim() || (c.v || "").trim(); });
  Data.touch(d);
  var isNew = d._new;
  delete d._new;
  if (isNew) db.people.push(d);
  else {
    for (var i = 0; i < db.people.length; i++) if (db.people[i].id === d.id) db.people[i] = d;
  }
  Store.mark("people");
  Store.flush();
  UI.EditDraft = null;
  Nav.pop();
  if (isNew) Nav.push({ v: "person", id: d.id });   /* 足したらそのまま頁を開く */
  UI.toast(isNew ? "登録しました" : "直しました");
};

UI.deletePerson = function () {
  var d = UI.EditDraft, db = Store.current();
  UI.confirm("この人を消しますか", (d.name || "この人") + " の記録と写真も一緒に消えます。\n元に戻せません。",
    "消す", function () {
      Data.removePerson(db, d.id);
      Store.mark();
      Store.flush();
      UI.EditDraft = null;
      Nav.goTab("list");
      UI.toast("消しました");
    }, true);
};
window.UI = UI;
