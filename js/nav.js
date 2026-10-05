"use strict";
/* =======================================================
   nav.js — 画面の積み重ねと「戻る」
   来た道をそのまま積む。戻り先は必ず一つ手前。
   Androidの戻る操作（端のスワイプ・戻るボタン）にも繋ぐ。
   ======================================================= */
var Nav = (function () {

  var stack = [{ v: "list" }];
  var onChange = function () {};
  var pushes = 0;        // こちらが積んだ履歴の数
  var suppress = 0;      // 自分で history を動かした時、その回数ぶん popstate を無視する

  function top() { return stack[stack.length - 1]; }
  function under() { return stack.length > 1 ? stack[stack.length - 2] : null; }
  function depth() { return stack.length; }

  /* 今どのタブにいるか（下タブの色を決める） */
  function tabOf() {
    for (var i = 0; i < stack.length; i++) {
      var v = stack[i].v;
      if (v === "list" || v === "care" || v === "memos" || v === "ref" || v === "backup") return v;
    }
    return "list";
  }

  /* ★戻る札に書く文字。来た道から自動で決まる */
  function backLabel() {
    var u = under();
    if (!u) return "";
    var db = Store.current();
    switch (u.v) {
      case "list":   return "一覧";
      case "care":   return "気にかける";
      case "memos":  return "メモ";
      case "backup": return "控え";
      case "ref":
        if (!u.code) return "早見表";
        return (u.code.split(":")[0] === "mbti" ? "MBTI " : "ラブタイプ ") + u.code.split(":")[1];
      case "memo": {
        var m = db && Data.findMemo(db, u.id);
        return m ? Select.memoTitle(m) : "メモ";
      }
      case "person": {
        var p = db && Data.findPerson(db, u.id);
        return p ? (p.name || "この人") : "この人";
      }
      case "edit":   return "入力";
      default:       return "もどる";
    }
  }

  function push(frame) {
    stack.push(frame);
    pushes++;
    try { history.pushState({ d: stack.length }, ""); } catch (e) {}
    onChange();
  }

  /* 今の画面を差し替える（履歴は増やさない） */
  function replace(frame) {
    stack[stack.length - 1] = frame;
    onChange();
  }

  /* 画面の中の「戻る」札 */
  function pop() {
    if (stack.length <= 1) return false;
    stack.pop();
    if (pushes > 0) { pushes--; suppress++; try { history.back(); } catch (e) {} }
    onChange();
    return true;
  }

  /* 途中まで戻る（入力を保存したら人の頁まで、など） */
  function popTo(v) {
    var n = 0;
    while (stack.length > 1 && top().v !== v) { stack.pop(); n++; }
    if (n) {
      var back = Math.min(n, pushes);
      pushes -= back;
      if (back) { suppress += 1; try { history.go(-back); } catch (e) {} }
    }
    onChange();
  }

  /* 下のタブ。積み直す */
  function goTab(v) {
    var back = pushes;
    stack = [{ v: v }];
    pushes = 0;
    if (back) { suppress += 1; try { history.go(-back); } catch (e) {} }
    onChange();
  }

  function start(cb) {
    onChange = cb || function () {};
    try { history.replaceState({ d: 1 }, ""); } catch (e) {}
    window.addEventListener("popstate", function () {
      if (suppress > 0) { suppress--; return; }
      /* 端末の戻る操作。積んでいれば一つ戻る。一覧まで戻っていればアプリを閉じる */
      if (stack.length > 1) {
        stack.pop();
        if (pushes > 0) pushes--;
        onChange();
      }
    });
    onChange();
  }

  return {
    top: top, under: under, depth: depth, tabOf: tabOf, backLabel: backLabel,
    push: push, replace: replace, pop: pop, popTo: popTo, goTab: goTab, start: start
  };
})();
