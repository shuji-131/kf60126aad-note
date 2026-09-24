"use strict";
/* =======================================================
   ui/person.js — その人の頁
   ======================================================= */
var UI = window.UI || {};

UI.sureBadge = function (o) {
  if (!o.code) return "";
  if (o.sure === "said") return '<span class="sure yes">本人が言っていた</span>';
  if (o.sure === "guess") return '<span class="sure no">たぶんこれ</span>';
  return "";
};

UI.viewPerson = function () {
  var db = Store.current();
  var p = Data.findPerson(db, Nav.top().id);
  if (!p) return UI.appbar({ title: "見つかりません", back: true }) + '<div class="view">' + UI.empty("この人は消されています") + '</div>' + UI.tabbar();

  var col = Data.catColor(db, p.cat);
  var m = mbtiOf(p.mbti.code), l = loveOf(p.love.code);

  var typeblock = '<div class="types">' +
    '<button class="typebtn" data-type="mbti:' + UI.esc(p.mbti.code) + '"><span class="lb">M B T I</span>' +
      '<span class="cd">' + (p.mbti.code || "—") + '</span>' +
      '<span class="nmj">' + UI.esc(m ? m.n : "未記入") + '</span>' + UI.sureBadge(p.mbti) + '</button>' +
    '<button class="typebtn" data-type="love:' + UI.esc(p.love.code) + '"><span class="lb">ラ ブ タ イ プ</span>' +
      '<span class="cd">' + (p.love.code || "—") + '</span>' +
      '<span class="nmj">' + UI.esc(l ? l.n : "未記入") + '</span>' + UI.sureBadge(p.love) + '</button>' +
    '</div>';

  var logs = Select.sortedLog(p).map(function (e) {
    /* ★plan は「予定が過ぎて移ってきたもの」。中身は ○メモ と同じ扱いで、
       会ったことにはしない（ごぶさたの計算を狂わせない） */
    var kind = e.plan ? "予定だった" : (e.t === "met" ? "会った" : "メモ");
    var d = e.d
      ? '<em>' + kind + '</em>' + e.d.replace(/-/g, "/") +
        (e.tm ? '<span>' + UI.esc(e.tm) + '</span>' : '')
      : '<em>' + kind + '</em><span class="blank">日付なし</span>' +
        '<button class="mini" data-setdate="' + e.id + '">日付を足す</button>';
    return '<div class="entry ' + e.t + (e.plan ? " isplan" : "") + '" data-log="' + e.id + '">' +
      '<div class="mk"><span class="dot"></span><span class="ln"></span></div>' +
      '<div class="bd"><div class="d">' + d + '</div>' +
      '<p class="x">' + (e.x ? UI.nl2br(e.x) : '<span class="blank">（本文なし）</span>') + '</p></div></div>';
  }).join("") || UI.empty("まだ記録がありません");

  /* ---- 予定（記録とは別の入れもの） ---- */
  var today = Data.todayStr(), hm = Sched.nowHM();
  var plans = Sched.of(p).map(function (s) {
    var n = Sched.daysUntil(s);
    var over = Sched.isOverdueToday(s, today, hm);
    var when = '<span class="' + (n === 0 ? "now" : (n <= 7 ? "soon" : "")) + '">' +
               Sched.whenText(n) + '</span>';
    return '<div class="plan' + (over ? " over" : "") + '" role="button" tabindex="0" data-sched="' + s.id + '">' +
      '<div class="mk"><span class="dia"></span></div>' +
      '<div class="bd">' +
        '<div class="d"><em>予定</em>' + s.d.replace(/-/g, "/") +
          (s.tm ? '<span>' + UI.esc(s.tm) + '</span>' : '<span class="blank">時刻なし</span>') +
          when + (over ? '<span class="now">時間が過ぎました</span>' : '') +
        '</div>' +
        '<p class="x">' + (s.x ? UI.nl2br(s.x) : '<span class="blank">（内容なし）</span>') + '</p>' +
        (over ? '<div style="margin-top:6px">' +
                  '<button class="mini" data-movesched="' + s.id + '">今すぐ記録へ移す</button>' +
                '</div>' : '') +
      '</div></div>';
  }).join("") || UI.empty("予定はありません。「＋ 入れる」から足せます");

  var ms = Select.memosOfPerson(db, p.id);
  var memoBlock = ms.length
    ? UI.sec("結びついたメモ") +
      '<p class="secnote">名簿と別に書いたもの。この人を挙げているメモが出ます</p>' +
      ms.map(UI.memoRow).join("")
    : "";

  var birth = Birth.text(p.birth);

  return UI.appbar({
    title: p.name || "（名前なし）",
    back: true,
    actions: UI.textbtn("editperson", "直す")
  }) +
  '<div class="view">' +
    '<div class="phead">' +
      '<div class="avwrap" data-act="photo">' + UI.avatar(p, "lg", "page") + '<span class="camic">' + IC.cam + '</span></div>' +
      '<div class="t"><h2>' + UI.esc(p.name || "（名前なし）") + '</h2>' +
        (p.kana ? '<p class="kana">' + UI.esc(p.kana) + '</p>'
                : '<p class="kana blank">ふりがな未入力 →「他」の行</p>') +
        (p.nick ? '<p class="nick">「' + UI.esc(p.nick) + '」と呼んでいる</p>' : '') +
        '<div class="row">' +
          '<span class="chip" style="border-color:' + col + ';color:' + col + '">' +
            '<i style="display:inline-block;width:7px;height:7px;border-radius:2px;background-color:' + col + ';margin-right:6px"></i>' +
            UI.esc(p.cat) + '</span>' +
          '<span class="stars" style="font-size:14px">' + UI.stars(p.star) + '</span>' +
        '</div>' +
        /* ★タグは何個あっても全部出す。折り返して頁の頭を押し広げないよう、
           1行のまま横に流す */
        UI.tagrail(p.tags.map(function (t) {
          return '<span class="chip">#' + UI.esc(t) + '</span>';
        }), "pick") +
        '</div></div>' +
    (p.alert ? '<div class="alertbar"><div class="ic">⚑</div><div class="tx"><b>注 意</b>' +
        (p.alertWhy ? UI.nl2br(p.alertWhy) : "理由は書かれていません") + '</div></div>' : '') +
    typeblock +
    UI.sec("出会い") +
    '<div class="secbody">' +
      UI.field("出会った日", p.met.on ? p.met.on.replace(/-/g, "/") : "") +
      UI.field("場所ときっかけ", p.met.where) +
      UI.field("紹介", p.met.by) +
    '</div>' +
    UI.sec("覚え書き") +
    '<div class="secbody">' +
      UI.field("特徴", p.trait) +
      UI.field("所属", p.org) +
      UI.field("住まい", p.area) +
      UI.field("家族・ペット", p.family) +
      UI.field("好きなもの", p.likes) +
      UI.field("触れない事", p.avoid, true) +
      '<div class="field"><div class="k">生年月日</div><div class="v">' +
        (birth ? UI.esc(birth) : '<span class="blank">不明</span>') +
        (p.birth.ageAt ? '<div class="sub2">' + p.birth.ageAt.replace(/-/g, "/") + 'に聞いた年齢から数えています</div>' : '') +
        (p.birth.m && !p.birth.d ? '<div class="sub2">日が分からないので「誕生日が近い人」には出ません</div>' : '') +
        '<div style="margin-top:7px"><button class="mini" data-act="birth">' + (birth ? "直す" : "入れる") + '</button></div>' +
      '</div></div>' +
    '</div>' +
    UI.sec("連絡先") +
    '<div class="secbody">' +
      (p.contacts.length
        ? p.contacts.map(function (c) { return UI.contactField(c); }).join("")
        : '<div class="field"><div class="v blank">—</div></div>') +
    '</div>' +
    UI.sec("予定", '<button data-act="addsched">＋ 入れる</button>') +
    '<p class="secnote">日付が過ぎると、その内容は下の「記録」へ自動で移って残ります。' +
      '時刻を過ぎても、その日いっぱいはここに出ています</p>' +
    '<div class="plans">' + plans + '</div>' +
    UI.sec("記録", '<button data-act="addlog">＋ 書く</button>') +
    '<div class="log">' + logs + '</div>' +
    memoBlock +
    '<div style="height:26px"></div>' +
    UI.backWide() +
    '<div style="height:20px"></div>' +
  '</div>' + UI.tabbar();
};

UI.bindPerson = function (app) {
  var db = Store.current();
  var p = Data.findPerson(db, Nav.top().id);
  if (!p) return;

  app.querySelectorAll("[data-type]").forEach(function (b) {
    b.onclick = function () {
      var a = b.dataset.type.split(":");
      if (!a[1]) { UI.toast("まだ型が入っていません。「直す」から入れられます"); return; }
      Nav.push({ v: "ref", kind: a[0], code: a[0] + ":" + a[1] });
    };
  });
  app.querySelectorAll("[data-setdate]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      UI.openLogEdit(p, b.dataset.setdate);
    };
  });
  app.querySelectorAll("[data-log]").forEach(function (b) {
    b.onclick = function () { UI.openLogEdit(p, b.dataset.log); };
  });

  /* 予定。行を叩けば直せる */
  app.querySelectorAll("[data-sched]").forEach(function (b) {
    function open() { UI.openSchedEdit(p, b.dataset.sched); }
    b.onclick = open;
    b.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    };
  });
  /* 時刻を過ぎたぶんを、その日のうちに手で片づける */
  app.querySelectorAll("[data-movesched]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();          /* 行を開く動きに化けさせない */
      if (!Sched.moveOne(db, p, b.dataset.movesched)) return;
      Store.mark("people"); Store.flush();
      App.render();
      UI.toast("記録へ移しました");
    };
  });
};
window.UI = UI;
