"use strict";
/* =======================================================
   ui/crop.js — 写真の位置合わせ
   ドラッグで位置、スライダーか指2本で大きさ、↻で90°回す。
   元写真を持っているので、あとから写真を押せば選び直さずに戻れる。
   ======================================================= */
var UI = window.UI || {};

UI.Crop = { pid: null, photoId: null, srcBlob: null, img: null, x: 0, y: 0, zoom: 1, rot: 0, isNew: false };

/* 人の頁で写真を押した時 */
UI.openPhoto = function (p) {
  if (p.photo) {
    Photos.get(p.photo).then(function (r) {
      if (!r || !r.src) { UI.pickPhoto(p); return; }
      var c = r.crop || { x: 0, y: 0, zoom: 1, rot: 0 };
      UI.Crop = { pid: p.id, photoId: p.photo, srcBlob: r.src, img: null,
                  x: c.x || 0, y: c.y || 0, zoom: c.zoom || 1, rot: c.rot || 0, isNew: false };
      Nav.push({ v: "crop" });
    });
  } else {
    UI.pickPhoto(p);
  }
};

UI.pickPhoto = function (p) {
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = function () {
    var f = inp.files && inp.files[0];
    if (!f) return;
    UI.toast("写真を読み込んでいます…");
    Photos.makeSource(f).then(function (blob) {
      UI.Crop = { pid: p.id, photoId: p.photo || Data.nextId(Store.current(), "ph"),
                  srcBlob: blob, img: null, x: 0, y: 0, zoom: 1, rot: 0, isNew: !p.photo };
      Store.mark("meta");
      Nav.push({ v: "crop" });
    })["catch"](function (e) {
      UI.toast("この画像は読み込めませんでした", "warn");
    });
  };
  inp.click();
};

UI.viewCrop = function () {
  return UI.appbar({ title: "位置を合わせる", back: true, backLabel: "やめる" }) +
    '<div class="view"><div class="cropwrap">' +
      '<div class="cropstage" id="cropstage">' +
        '<canvas class="cropimg" id="cropimg" width="300" height="400"></canvas>' +
        '<div class="cropmask"></div><div class="cropring"></div>' +
      '</div>' +
      '<div class="slider"><span>小</span>' +
        '<input ' + UI.NOAUTO + 'type="range" id="zoom" min="100" max="320" value="' + Math.round(UI.Crop.zoom * 100) + '">' +
        '<span>大</span></div>' +
      '<div class="croprow">' +
        '<button class="btn ghost" data-act="rotate">' + IC.rotate + ' 90°回す</button>' +
        '<button class="btn ghost" data-act="cropreset">やり直す</button>' +
        '<button class="btn ghost" data-act="repick">写真を選び直す</button>' +
      '</div>' +
      '<button class="bigbtn primary wide" style="margin-left:0;margin-right:0" data-act="cropok">' +
        '<b>決定する</b><span>丸の中だけが切り取られて保存されます</span></button>' +
      '<button class="bigbtn danger wide" style="margin-left:0;margin-right:0" data-act="cropdel">' +
        '<b>写真を外す</b><span>名前の1文字の丸に戻ります</span></button>' +
      '<div style="height:30px"></div>' +
    '</div></div>';
};

UI.bindCrop = function () {
  var st = UI.el("cropstage"), cv = UI.el("cropimg");
  if (!st || !cv) return;
  var box = st.getBoundingClientRect();
  var side = Math.round(box.width) || 300;
  cv.width = side; cv.height = side;

  function paint() {
    if (!UI.Crop.img) return;
    var g = cv.getContext("2d");
    g.clearRect(0, 0, side, side);
    g.fillStyle = "#0C1119"; g.fillRect(0, 0, side, side);
    var img = UI.Crop.img, rot = ((UI.Crop.rot % 360) + 360) % 360;
    var iw = img.width, ih = img.height;
    var sw = (rot === 90 || rot === 270) ? ih : iw;
    var sh = (rot === 90 || rot === 270) ? iw : ih;
    var sc = (side / Math.min(sw, sh)) * UI.Crop.zoom;
    g.save();
    g.translate(side / 2 + UI.Crop.x * (side / 300), side / 2 + UI.Crop.y * (side / 300));
    g.rotate(rot * Math.PI / 180);
    g.scale(sc, sc);
    g.drawImage(img, -iw / 2, -ih / 2);
    g.restore();
  }
  UI.Crop.paint = paint;

  if (!UI.Crop.img) {
    Photos.loadImage(UI.Crop.srcBlob).then(function (img) { UI.Crop.img = img; paint(); });
  } else paint();

  var drag = false, px = 0, py = 0, pinch = 0, z0 = 1;
  st.addEventListener("pointerdown", function (e) {
    drag = true; px = e.clientX; py = e.clientY;
    st.setPointerCapture(e.pointerId);
  });
  st.addEventListener("pointermove", function (e) {
    if (!drag) return;
    UI.Crop.x += (e.clientX - px) * (300 / side);
    UI.Crop.y += (e.clientY - py) * (300 / side);
    px = e.clientX; py = e.clientY;
    paint();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    st.addEventListener(ev, function () { drag = false; });
  });
  /* 指2本でつまむ */
  st.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) { pinch = dist(e); z0 = UI.Crop.zoom; drag = false; }
  }, { passive: true });
  st.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && pinch) {
      var z = z0 * (dist(e) / pinch);
      UI.Crop.zoom = Math.min(3.2, Math.max(1, z));
      var zi = UI.el("zoom"); if (zi) zi.value = Math.round(UI.Crop.zoom * 100);
      paint();
    }
  }, { passive: true });
  st.addEventListener("touchend", function () { pinch = 0; });
  function dist(e) {
    var a = e.touches[0], b = e.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  var zi = UI.el("zoom");
  if (zi) zi.addEventListener("input", function () { UI.Crop.zoom = this.value / 100; paint(); });
};

UI.saveCrop = function () {
  var c = UI.Crop, db = Store.current();
  var p = Data.findPerson(db, c.pid);
  if (!p) { Nav.pop(); return; }
  UI.toast("切り出しています…");
  Photos.save(c.photoId, c.srcBlob, { x: c.x, y: c.y, zoom: c.zoom, rot: c.rot }).then(function () {
    p.photo = c.photoId;
    Data.touch(p);
    Store.mark("people"); Store.flush();
    Photos.revoke(c.photoId);
    Nav.pop();
    UI.toast("写真を残しました");
  })["catch"](function () {
    UI.toast("写真を保存できませんでした（容量かもしれません）", "warn");
  });
};

UI.deletePhoto = function () {
  var c = UI.Crop, db = Store.current();
  var p = Data.findPerson(db, c.pid);
  UI.confirm("写真を外しますか", "名前の1文字の丸に戻ります。", "外す", function () {
    if (p && p.photo) { Photos.remove(p.photo); p.photo = null; Data.touch(p); Store.mark("people"); Store.flush(); }
    Nav.pop();
    UI.toast("外しました");
  }, true);
};
window.UI = UI;
