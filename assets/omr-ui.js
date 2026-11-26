/* Tab "Chấm phiếu" của trang giáo viên: quét phiếu trả lời giấy bằng camera hoặc ảnh, máy chủ chấm và lưu điểm.
   Dùng: KT.omrTab(el, { T, ov, curClass, setClass, fail }) */
(() => {
  "use strict";
  const { h, esc, store } = KT;
  const L = () => window.OMR.layout;
  const PART = { mcq: "Phần I", tf: "Phần II", short: "Phần III" };
  const num = (v) => (v == null || v === "" ? "" : String(Math.round(+v * 100) / 100).replace(".", ","));

  // chuyển kết quả đọc ảnh -> dữ liệu gửi máy chủ, theo số câu của đề
  function toMarks(r, ex) {
    const c = ex.counts || {};
    return {
      mcq: r.p1.slice(0, c.mcq || 0),
      tf: r.p2.slice(0, c.tf || 0),
      short: r.p3.slice(0, c.short || 0),
    };
  }
  // chỉ giữ cờ nghi ngờ thuộc phần đề có dùng
  function usedFlags(r, ex) {
    const c = ex.counts || {};
    return r.flags.filter((f) => {
      if (/^(sbd|made)/.test(f)) return true;
      const m = f.match(/^p(\d)_(\d+)/); if (!m) return true;
      const n = { 1: c.mcq, 2: c.tf, 3: c.short }[m[1]] || 0;
      return +m[2] < n;
    });
  }
  function readFile(file, maxSide) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.getContext("2d").getImageData(0, 0, c.width, c.height));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Không mở được ảnh " + file.name)); };
      img.src = url;
    });
  }
  // ảnh phiếu đã nắn thẳng + vòng đánh dấu các ô đọc được
  function sheetCanvas(img, r, ex, k) {
    const c = document.createElement("canvas"), id = OMR.warp(img, r.H, k);
    c.width = id.width; c.height = id.height; const x = c.getContext("2d"); x.putImageData(id, 0, 0);
    const lay = L(), R = lay.r * k * 1.15, fl = new Set(usedFlags(r, ex)), cnt = ex.counts || {};
    const ring = (p, col) => { x.beginPath(); x.arc(p[0] * k, p[1] * k, R, 0, 7); x.lineWidth = Math.max(1.5, 3 * k); x.strokeStyle = col; x.stroke(); };
    const doubt = (p) => { x.fillStyle = "rgba(255,170,0,.28)"; x.fillRect(p[0] * k - R * 1.6, p[1] * k - R * 1.6, R * 3.2, R * 3.2); };
    const blue = "#1565c0", orange = "#e65100";
    [...r.sbd].forEach((d, i) => { if (/\d/.test(d)) ring(lay.sbd[i][+d], fl.has("sbd" + i) ? orange : blue); else if (fl.has("sbd" + i)) doubt(lay.sbd[i][0]); });
    [...r.made].forEach((d, i) => { if (/\d/.test(d)) ring(lay.made[i][+d], fl.has("made" + i) ? orange : blue); });
    r.p1.slice(0, cnt.mcq || 0).forEach((a, i) => { const f = fl.has("p1_" + i); if (f) doubt(lay.p1[i][0]); if ("ABCD".includes(a) && a) ring(lay.p1[i]["ABCD".indexOf(a)], f ? orange : blue); });
    r.p2.slice(0, cnt.tf || 0).forEach((q, i) => q.forEach((a, j) => { const f = fl.has(`p2_${i}_${j}`); if (f) doubt(lay.p2[i][j][0]); if (a === "D" || a === "S") ring(lay.p2[i][j][a === "D" ? 0 : 1], f ? orange : blue); }));
    r.p3.slice(0, cnt.short || 0).forEach((s, i) => { const f = fl.has("p3_" + i); if (f) doubt(lay.p3[i].digits[0][0]);
      let col = 0; for (const ch of s) { const c3 = lay.p3[i]; const p = ch === "-" ? c3.minus : ch === "," ? c3.comma[col - 1] : /\d/.test(ch) ? c3.digits[col][+ch] : null; if (p) ring(p, f ? orange : blue); col++; } });
    return c;
  }

  /* ---------- hộp xem & sửa một phiếu ---------- */
  function editSheet(ctx, ex, cls, item, onDone) {
    const { T, fail } = ctx;
    const st = { sbd: item.r.sbd, made: item.r.made, marks: JSON.parse(JSON.stringify(item.marks)), tl: item.tl ?? "", student: item.student || null };
    const fl = new Set(usedFlags(item.r, ex));
    const scoreBox = h("div", { class: "omr-score" });
    const sbd = h("input", { id: "oSbd", class: "mono", inputmode: "numeric", maxlength: 6, value: st.sbd.replace(/[^\d]/g, ""), oninput: () => { st.sbd = sbd.value; st.student = null; regrade(); } });
    const made = h("select", { id: "oMade" }, (ex.made || []).map((m) => h("option", { value: m, selected: m === st.made }, m)));
    if (!(ex.made || []).includes(st.made)) made.prepend(h("option", { value: st.made, selected: true }, (st.made || "trống") + " (không có)"));
    made.onchange = () => { st.made = made.value; regrade(); };
    const pick = h("select", { id: "oPick", class: "hidden" });
    pick.onchange = () => { st.student = pick.value || null; regrade(); };
    const tl = ex.essay != null && !ex.thang_10 ? h("input", { id: "oTl", inputmode: "decimal", value: num(st.tl), placeholder: "0 – " + num(ex.essay), oninput: () => { st.tl = tl.value; regrade(); } }) : null;
    const toggles = (vals, cur, onPick, doubt) => h("span", { class: "omr-tg" + (doubt ? " doubt" : "") }, vals.map(([v, lab]) =>
      h("button", { type: "button", class: cur === v ? "on" : "", onclick: (e) => { const on = e.currentTarget.classList.contains("on"); e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.classList.remove("on")); if (!on) e.currentTarget.classList.add("on"); onPick(on ? "" : v); } }, lab)));
    const rows = h("div", { class: "omr-ans" });
    const qLab = (part, i) => h("b", { class: "omr-q", "data-k": part + i }, String(i + 1));
    if (st.marks.mcq.length) rows.append(h("div", { class: "omr-part" }, h("h4", {}, PART.mcq), h("div", { class: "omr-grid" }, st.marks.mcq.map((a, i) =>
      h("div", { class: "omr-row" }, qLab("mcq", i), toggles([["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]], a, (v) => { st.marks.mcq[i] = v; regrade(); }, fl.has("p1_" + i)))))));
    if (st.marks.tf.length) rows.append(h("div", { class: "omr-part" }, h("h4", {}, PART.tf), h("div", { class: "omr-grid tf" }, st.marks.tf.map((q, i) =>
      h("div", { class: "omr-row" }, qLab("tf", i), q.map((a, j) => h("span", { class: "omr-y" }, "abcd"[j] + ")", toggles([["D", "Đ"], ["S", "S"]], a, (v) => { st.marks.tf[i][j] = v; regrade(); }, fl.has(`p2_${i}_${j}`)))))))));
    if (st.marks.short.length) rows.append(h("div", { class: "omr-part" }, h("h4", {}, PART.short), h("div", { class: "omr-grid sh" }, st.marks.short.map((a, i) =>
      h("div", { class: "omr-row" }, qLab("short", i), h("input", { class: "mono" + (fl.has("p3_" + i) ? " doubt" : ""), value: a, maxlength: 4, "aria-label": "Phần III câu " + (i + 1), oninput: (e) => { st.marks.short[i] = e.target.value.replace(".", ","); regrade(); } }))))));
    let tmr = null, last = null;
    async function regrade() {
      clearTimeout(tmr);
      tmr = setTimeout(async () => {
        try {
          last = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: st.sbd, p_made: st.made, p_marks: st.marks, p_tl: st.tl === "" ? null : +String(st.tl).replace(",", "."), p_save: false, p_student: st.student });
          showScore();
        } catch (e) { fail(e); }
      }, 250);
    }
    function showScore() {
      scoreBox.innerHTML = ""; rows.querySelectorAll(".omr-q").forEach((b) => b.classList.remove("ok", "no", "half"));
      if (last.error) {
        scoreBox.append(h("div", { class: "note bad" }, last.error));
        if (last.need_pick && !pick.options.length) T("t_students", { p_class: cls }).then((sts) => {
          pick.append(h("option", { value: "" }, "— Chọn học sinh của phiếu này —"), ...sts.map((s) => h("option", { value: s.id }, s.name + " · " + s.code + (s.sbd ? " · SBD " + s.sbd : ""))));
          pick.classList.remove("hidden");
        }).catch(fail);
        return;
      }
      const d = last.result;
      ["mcq", "short"].forEach((p) => (d[p] || []).forEach((v, i) => { const b = rows.querySelector(`[data-k="${p}${i}"]`); if (b) b.classList.add(v ? "ok" : "no"); }));
      (d.tf || []).forEach((v, i) => { const b = rows.querySelector(`[data-k="tf${i}"]`); if (b) b.classList.add(v === 4 ? "ok" : v === 0 ? "no" : "half"); });
      scoreBox.append(...[h("div", { class: "omr-who" }, h("b", {}, last.student.name), h("span", {}, last.student.code + " · SBD " + (last.student.sbd || "—") + " · lớp " + (last.student.class || "—"))),
        h("div", { class: "omr-pts" }, h("span", { class: "big" }, num(d.score) + (ex.thang_10 ? "/10" : "")),
          h("span", { class: "sub" }, "Trắc nghiệm " + num(d.tn) + "/" + num(d.max_tn) + (d.max_tl != null && !ex.thang_10 ? " · Tự luận " + (st.tl === "" ? "chưa nhập" : num(st.tl)) : ""))),
        last.prev && !item.student ? h("p", { class: "sub" }, "Em này đã có phiếu đề này (" + num(last.prev.score) + " điểm). Lưu sẽ thay bằng phiếu mới.") : null].filter(Boolean));
    }
    const img = item.img ? sheetCanvas(item.img, item.r, ex, 0.42) : null;
    let close;
    const save = h("button", { class: "btn", onclick: async () => {
      save.disabled = true;
      try {
        const r = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: st.sbd, p_made: st.made, p_marks: st.marks, p_flags: [], p_tl: st.tl === "" ? null : +String(st.tl).replace(",", "."), p_save: true, p_student: st.student });
        if (r.error) { save.disabled = false; return KT.toast(r.error, "bad"); }
        close(); onDone && onDone(r);
      } catch (e) { save.disabled = false; fail(e); }
    } }, "Lưu phiếu");
    close = KT.modal([h("div", { class: "vhead" }, h("h3", {}, "Xem lại phiếu" + (item.name ? " · " + item.name : "")), h("button", { class: "btn ghost sm", onclick: () => close() }, "Đóng")),
      h("div", { class: "omr-edit" + (img ? "" : " noimg") },
        img ? h("div", { class: "omr-img" }, img, h("p", { class: "sub" }, h("span", { class: "dot blue" }), "ô máy đọc được  ", h("span", { class: "dot orange" }), "ô cần xem lại")) : null,
        h("div", { class: "omr-side" },
          h("div", { class: "form omr-id" }, h("div", {}, h("label", { for: "oSbd" }, "Số báo danh"), sbd), h("div", {}, h("label", { for: "oMade" }, "Mã đề"), made),
            tl ? h("div", {}, h("label", { for: "oTl" }, "Điểm tự luận"), tl) : null, h("div", { class: "full" }, pick)),
          scoreBox, rows)),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"), save)], { wide: true });
    regrade();
  }

  /* ---------- quét bằng camera ---------- */
  function camera(ctx, ex, cls, onSaved) {
    const { T, fail } = ctx;
    let stream = null, timer = null, busy = false, stable = 0, prevQ = null, waitClear = false, clearN = 0, n = 0, auto = store.get("kt_t_omr_auto", true);
    const video = h("video", { playsinline: true, muted: true, autoplay: true });
    const ovl = h("canvas", { class: "omr-ovl" });
    const status = h("div", { class: "omr-status" }, "Đang mở camera…");
    const count = h("span", { class: "omr-count" }, "0 phiếu đã lưu");
    const card = h("div", { class: "omr-card hidden" });
    const autoCb = h("input", { type: "checkbox", checked: auto, onchange: () => { auto = autoCb.checked; store.set("kt_t_omr_auto", auto); } });
    const wrap = h("div", { class: "omr-cam", role: "dialog", "aria-modal": "true", "aria-label": "Quét phiếu bằng camera" },
      h("div", { class: "omr-top" }, h("b", {}, ex.title), count, h("label", { class: "chk" }, autoCb, "Tự lưu phiếu rõ ràng"), h("button", { class: "btn sm", onclick: stop }, "Xong")),
      h("div", { class: "omr-view" }, video, ovl), status, card);
    document.body.append(wrap); document.body.style.overflow = "hidden";
    const small = document.createElement("canvas"), big = document.createElement("canvas");
    function stop() { clearInterval(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); wrap.remove(); document.body.style.overflow = ""; onSaved && onSaved(n, true); }
    function drawQuad(q, sc, col) {
      const x = ovl.getContext("2d"); ovl.width = ovl.clientWidth; ovl.height = ovl.clientHeight; x.clearRect(0, 0, ovl.width, ovl.height);
      if (!q) return;
      // video hiển thị kiểu object-fit: contain
      const vw = video.videoWidth, vh = video.videoHeight, s = Math.min(ovl.width / vw, ovl.height / vh), dx = (ovl.width - vw * s) / 2, dy = (ovl.height - vh * s) / 2;
      x.beginPath(); q.forEach(([a, b], i) => { const X = a / sc * s + dx, Y = b / sc * s + dy; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath();
      x.lineWidth = 4; x.strokeStyle = col; x.stroke(); x.fillStyle = col.replace(")", ",.12)").replace("rgb", "rgba"); x.fill();
    }
    function say(t, kind) { status.textContent = t; status.className = "omr-status" + (kind ? " " + kind : ""); }
    async function tick() {
      if (busy || !video.videoWidth) return;
      const vw = video.videoWidth, vh = video.videoHeight, sc = Math.min(1, 720 / Math.max(vw, vh));
      small.width = Math.round(vw * sc); small.height = Math.round(vh * sc);
      const sx = small.getContext("2d", { willReadFrequently: true }); sx.drawImage(video, 0, 0, small.width, small.height);
      const q = OMR.findQuad(sx.getImageData(0, 0, small.width, small.height));
      if (waitClear) {
        drawQuad(q, sc, "rgb(120,120,120)");
        if (!q) { if (++clearN >= 2) { waitClear = false; say("Đưa phiếu tiếp theo vào khung"); } } else { clearN = 0; say("Đã xong phiếu này — lấy phiếu ra, đưa phiếu tiếp theo vào", "ok"); }
        return;
      }
      if (!q) { stable = 0; prevQ = null; drawQuad(null); say("Đưa cả tờ phiếu vào khung, thấy đủ 4 ô vuông đen ở 4 góc"); return; }
      const mv = prevQ ? Math.max(...q.map((p, i) => Math.hypot(p[0] - prevQ[i][0], p[1] - prevQ[i][1]))) / small.width : 1;
      prevQ = q; stable = mv < 0.015 ? stable + 1 : 0;
      drawQuad(q, sc, stable >= 1 ? "rgb(46,160,90)" : "rgb(255,193,7)");
      say(stable >= 1 ? "Giữ yên…" : "Đã thấy phiếu — giữ máy thật yên");
      if (stable >= 2) {
        busy = true; stable = 0; say("Đang đọc phiếu…");
        big.width = vw; big.height = vh; const bx = big.getContext("2d", { willReadFrequently: true }); bx.drawImage(video, 0, 0);
        const img = bx.getImageData(0, 0, vw, vh), r = OMR.read(img);
        if (!r.ok) { busy = false; say(r.msg, "bad"); return; }
        await handle(r, img);
      }
    }
    async function handle(r, img) {
      const marks = toMarks(r, ex), flags = usedFlags(r, ex);
      let g;
      try { g = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: r.sbd, p_made: r.made, p_marks: marks, p_flags: flags, p_save: false }); }
      catch (e) { fail(e); busy = false; return; }
      const item = { r, img, marks, name: g.student && g.student.name };
      const done = (res) => { n++; count.textContent = n + " phiếu đã lưu"; card.className = "omr-card ok"; card.innerHTML = "";
        card.append(h("b", {}, "Đã lưu: " + res.student.name), h("span", {}, " · SBD " + res.student.sbd + " · mã " + res.made + " · " + num(res.result.score) + " điểm"));
        waitClear = true; clearN = 0; busy = false; if (navigator.vibrate) navigator.vibrate(60); };
      if (!g.error && !flags.length && auto && !g.prev) {
        try { const s = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: r.sbd, p_made: r.made, p_marks: marks, p_flags: [], p_save: true }); if (!s.error) return done(s); }
        catch (e) { fail(e); }
      }
      card.className = "omr-card" + (g.error ? " bad" : " warn"); card.innerHTML = "";
      card.append(
        h("div", {}, g.error ? h("b", {}, g.error) : h("span", {}, h("b", {}, g.student.name), " · SBD " + g.student.sbd + " · mã " + r.made + " · " + num(g.result.score) + " điểm"),
          flags.length ? h("div", { class: "sub" }, flags.length + " ô cần xem lại (tô mờ, tô hai ô hoặc chưa tô).") : null,
          g.prev ? h("div", { class: "sub" }, "Em này đã có phiếu đề này (" + num(g.prev.score) + " điểm).") : null),
        h("div", { class: "omr-acts" },
          h("button", { class: "btn ghost sm", onclick: () => { card.className = "omr-card hidden"; busy = false; } }, "Bỏ qua"),
          h("button", { class: "btn ghost sm", onclick: () => editSheet(ctx, ex, cls, item, (res) => done(res)) }, "Xem & sửa"),
          !g.error ? h("button", { class: "btn sm", onclick: async (e) => { e.target.disabled = true; try { const s = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: r.sbd, p_made: r.made, p_marks: marks, p_flags: flags, p_save: true }); if (s.error) { e.target.disabled = false; return KT.toast(s.error, "bad"); } done(s); } catch (ex2) { e.target.disabled = false; fail(ex2); } } }, "Lưu") : null));
      say(g.error ? "Cần xử lí phiếu này" : "Kiểm tra rồi bấm Lưu", g.error ? "bad" : "");
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say("Trình duyệt này không mở được camera. Dùng nút Tải ảnh phiếu.", "bad"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => { stream = s; video.srcObject = s; video.play().catch(() => {}); say("Đưa cả tờ phiếu vào khung"); timer = setInterval(tick, 220); })
      .catch(() => say("Chưa được phép dùng camera. Cho phép camera cho trang này rồi thử lại, hoặc dùng nút Tải ảnh phiếu.", "bad"));
  }

  /* ---------- tải nhiều ảnh ---------- */
  async function upload(ctx, ex, cls, files, box, onSaved) {
    const { T, fail } = ctx;
    const items = [];
    box.innerHTML = "";
    const tb = h("tbody"), saveAll = h("button", { class: "btn sm", disabled: true }, "Lưu các phiếu hợp lệ");
    box.append(h("div", { class: "panel omr-queue" }, h("div", { class: "omr-qhead" }, h("h3", {}, "Ảnh vừa tải (" + files.length + ")"), saveAll),
      h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Ảnh", "Học sinh", "Mã đề", "Điểm", "Tình trạng", ""].map((x) => h("th", {}, x)))), tb)));
    const row = (it) => {
      const tr = it.tr || (it.tr = h("tr")); tr.innerHTML = "";
      const g = it.g;
      tr.append(h("td", { class: "sub" }, it.file.name),
        h("td", {}, g && g.student ? h("span", {}, h("b", {}, g.student.name), h("small", { class: "sub" }, " SBD " + g.student.sbd)) : it.r && it.r.ok ? h("span", { class: "mono" }, "SBD " + it.r.sbd) : "—"),
        h("td", { class: "mono" }, it.r && it.r.ok ? it.r.made : "—"),
        h("td", { class: "mono" }, g && g.result ? num(g.result.score) : "—"),
        h("td", {}, it.saved ? h("span", { class: "pill ok" }, "Đã lưu") : it.err ? h("span", { class: "pill bad", title: it.err }, it.err.length > 46 ? it.err.slice(0, 44) + "…" : it.err)
          : it.flags && it.flags.length ? h("span", { class: "pill warn" }, it.flags.length + " ô cần xem") : g ? h("span", { class: "pill" }, "Sẵn sàng") : h("span", { class: "sub" }, "Đang đọc…")),
        h("td", {}, it.r && it.r.ok && !it.saved ? h("button", { class: "btn ghost sm", onclick: () => editSheet(ctx, ex, cls, { r: it.r, img: it.img, marks: it.marks, name: it.file.name }, (res) => { it.saved = true; it.g = res; row(it); onSaved && onSaved(1); }) }, "Xem & sửa") : null));
      return tr;
    };
    for (const f of files) { const it = { file: f }; items.push(it); tb.append(row(it)); }
    for (const it of items) {
      try {
        const img = await readFile(it.file, 2200); const r = OMR.read(img);
        it.r = r;
        if (!r.ok) { it.err = r.msg; row(it); continue; }
        it.img = img; it.marks = toMarks(r, ex); it.flags = usedFlags(r, ex);
        it.g = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: r.sbd, p_made: r.made, p_marks: it.marks, p_flags: it.flags, p_save: false });
        if (it.g.error) it.err = it.g.error; else if (it.g.prev) it.err = "Em này đã có phiếu (" + num(it.g.prev.score) + " điểm) — bấm Xem & sửa để thay";
      } catch (e) { it.err = e.message || String(e); }
      row(it);
    }
    const ready = () => items.filter((it) => it.g && !it.err && !it.saved && !(it.flags || []).length);
    const upd = () => { const n = ready().length; saveAll.disabled = !n; saveAll.textContent = n ? "Lưu " + n + " phiếu hợp lệ" : "Lưu các phiếu hợp lệ"; };
    upd();
    saveAll.onclick = async () => {
      saveAll.disabled = true; let k = 0;
      for (const it of ready()) {
        try { const s = await T("t_omr_grade", { p_exam: ex.id, p_class: cls, p_sbd: it.r.sbd, p_made: it.r.made, p_marks: it.marks, p_flags: [], p_save: true });
          if (s.error) it.err = s.error; else { it.saved = true; it.g = s; k++; } } catch (e) { it.err = e.message; }
        row(it);
      }
      upd(); KT.toast("Đã lưu " + k + " phiếu", "ok"); onSaved && onSaved(k);
    };
  }

  /* ---------- bảng điểm + thống kê ---------- */
  async function results(ctx, ex, cls, box) {
    const { T, fail } = ctx;
    box.innerHTML = "";
    let d; try { d = await T("t_omr_results", { p_exam: ex.id, p_class: cls }); } catch (e) { fail(e); return; }
    if (d.error) { box.append(h("div", { class: "note bad" }, d.error)); return; }
    const rows = d.rows, sc = rows.map((r) => +r.score).filter((x) => !isNaN(x));
    const avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
    box.append(h("div", { class: "kpis", style: "margin-top:16px" },
      h("div", { class: "kpi" }, h("div", { class: "n" }, rows.length + "/" + (rows.length + d.missing.length)), h("div", { class: "l" }, "Phiếu đã chấm")),
      h("div", { class: "kpi" }, h("div", { class: "n" }, avg == null ? "—" : num(avg)), h("div", { class: "l" }, "Điểm trung bình")),
      h("div", { class: "kpi" }, h("div", { class: "n" }, sc.length ? num(Math.max(...sc)) : "—"), h("div", { class: "l" }, "Cao nhất")),
      h("div", { class: "kpi" }, h("div", { class: "n" }, String(sc.filter((x) => x < (ex.thang_10 ? 5 : 5)).length)), h("div", { class: "l" }, "Dưới 5 điểm"))));
    const essay = d.exam.essay != null && !d.exam.thang_10;
    if (!rows.length) { box.append(h("div", { class: "empty", style: "margin-top:14px" }, "Lớp này chưa có phiếu nào cho đề này. Bấm Quét bằng camera hoặc Tải ảnh phiếu ở trên.")); }
    else {
      const tb = h("tbody");
      rows.forEach((r, i) => {
        const tlIn = essay ? h("input", { class: "omr-tlin mono", inputmode: "decimal", value: num(r.tl), placeholder: "—", "aria-label": "Điểm tự luận " + r.name,
          onchange: async (e) => { const v = e.target.value.trim(); try { const s = await T("t_omr_set_tl", { p_id: r.id, p_tl: v === "" ? null : +v.replace(",", ".") }); if (s.error) return KT.toast(s.error, "bad"); results(ctx, ex, cls, box); } catch (ex2) { fail(ex2); } } }) : null;
        tb.append(h("tr", {}, h("td", {}, String(i + 1)), h("td", { class: "mono" }, r.sbd || ""), h("td", {}, h("b", {}, r.name), h("small", { class: "sub" }, " " + r.code)),
          h("td", { class: "mono" }, r.made), h("td", { class: "mono" }, num(r.tn)), essay ? h("td", {}, tlIn) : null,
          h("td", { class: "mono" }, h("b", {}, num(r.score)), r.need_tl ? h("small", { class: "sub" }, " (chưa có TL)") : null),
          h("td", {}, h("div", { style: "display:flex;gap:6px" },
            h("button", { class: "btn ghost sm", onclick: () => editSheet(ctx, ex, cls, { r: { sbd: r.sbd || "", made: r.made, flags: [] }, marks: r.marks, tl: r.tl, student: r.student, name: r.name }, () => results(ctx, ex, cls, box)) }, "Xem & sửa"),
            h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá phiếu?", "Xoá điểm phiếu giấy của <b>" + esc(r.name) + "</b> cho đề này.", "Xoá", async () => { try { await T("t_omr_delete", { p_id: r.id }); results(ctx, ex, cls, box); } catch (e) { fail(e); } }) }, "Xoá")))));
      });
      box.append(h("div", { class: "panel", style: "margin-top:14px;overflow:auto" },
        h("div", { class: "omr-qhead" }, h("h3", {}, "Bảng điểm"), h("button", { class: "btn ghost sm", onclick: () => ctx.download("Diem_" + ex.id + ".csv",
          [["STT", "SBD", "Mã HS", "Họ tên", "Mã đề", "Trắc nghiệm"].concat(essay ? ["Tự luận"] : [], ["Tổng"])].concat(rows.map((r, i) => [i + 1, r.sbd, r.code, r.name, r.made, num(r.tn)].concat(essay ? [num(r.tl)] : [], [num(r.score)])))) }, "Xuất Excel")),
        h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["#", "SBD", "Học sinh", "Mã đề", "Trắc nghiệm"].concat(essay ? ["Tự luận"] : [], ["Tổng", ""]).map((x) => h("th", {}, x)))), tb)));
    }
    if (d.missing.length) box.append(h("p", { class: "sub", style: "margin-top:10px" }, h("b", {}, "Chưa có phiếu (" + d.missing.length + "): "), d.missing.map((m) => m.name + " (" + (m.sbd || "—") + ")").join(", ")));
    // thống kê câu
    if (rows.length) {
      const part = (k, title) => {
        const arr = d.stats[k] || []; if (!arr.length) return null;
        return h("div", { class: "omr-stat" }, h("h4", {}, title), arr.map((q) => {
          const p = q.n ? q.ok / q.n : 0;
          return h("div", { class: "omr-bar" + (p < 0.5 ? " low" : "") }, h("span", { class: "omr-bq" }, "Câu " + q.cau), h("span", { class: "omr-bt" }, h("i", { style: "width:" + Math.round(p * 100) + "%" })),
            h("span", { class: "omr-bv" }, Math.round(p * 100) + "%"), h("span", { class: "omr-bid" }, (q.id || []).join(", ")));
        }));
      };
      const weak = ["mcq", "tf", "short"].flatMap((k) => (d.stats[k] || []).map((q) => Object.assign({ k }, q))).filter((q) => q.n && q.ok / q.n < 0.5).sort((a, b) => a.ok / a.n - b.ok / b.n);
      box.append(h("div", { class: "panel", style: "margin-top:14px" }, h("h3", {}, "Tỉ lệ làm đúng theo câu (đề gốc)"),
        h("p", { class: "sub" }, "Mọi mã đề được quy về số câu của đề gốc (mã đầu tiên). Phần II tính đúng khi đúng cả 4 ý."),
        weak.length ? h("div", { class: "note", style: "margin:8px 0 12px" }, h("b", {}, "Cần ôn lại: "), weak.slice(0, 6).map((q) => PART[q.k] + " câu " + q.cau + (q.id && q.id.length ? " (" + q.id.join(", ") + ")" : "")).join(" · ")) : null,
        h("div", { class: "omr-stats" }, part("mcq", PART.mcq), part("tf", PART.tf), part("short", PART.short))));
    }
  }

  /* ---------- tab ---------- */
  KT.omrTab = async function (el, ctx0) {
    // lỗi "mềm" từ máy chủ ({error: ...}) trả về như dữ liệu để giao diện tự xử lí
    const ctx = Object.assign({}, ctx0, { T: async (fn, a) => { try { return await ctx0.T(fn, a); } catch (e) { if (e.soft && e.data) return e.data; throw e; } } });
    const { T, ov, fail } = ctx;
    const classes = ov.classes || [];
    el.append(h("div", { class: "panel", style: "margin-top:16px" }, h("p", { class: "sub" }, "Đang tải danh sách đề…")));
    let exams; try { exams = await T("t_omr_exams"); } catch (e) { el.innerHTML = ""; fail(e); return; }
    el.innerHTML = "";
    if (!classes.length) { el.append(h("div", { class: "empty", style: "margin-top:16px" }, "Tạo lớp và thêm học sinh ở tab Lớp & học sinh trước khi chấm phiếu.")); return; }
    if (!exams.length) {
      el.append(h("div", { class: "panel", style: "margin-top:16px" }, h("h3", {}, "Chưa có đề chấm phiếu"),
        h("p", {}, "Đề và đề cương xuất hiện ở đây khi thầy Hùng xuất kèm phiếu trả lời trên máy (kht.bat → mục E: đề kiểm tra, mục F: đề cương theo ID) và công cụ đồng bộ gửi lên.")));
      return;
    }
    let exId = store.get("kt_t_omr", null); if (!exams.some((e) => e.id === exId)) exId = exams[0].id;
    let cls = ctx.curClass && classes.some((c) => c.id === ctx.curClass) ? ctx.curClass : classes[0].id;
    const opt = (e) => h("option", { value: e.id, selected: e.id === exId }, e.title + (e.grade ? " · lớp " + e.grade : ""));
    const dc = exams.filter((e) => e.kieu === "de_cuong"), kt = exams.filter((e) => e.kieu !== "de_cuong");
    const exSel = h("select", { id: "omrEx" }, dc.length && kt.length
      ? [h("optgroup", { label: "Đề cương" }, dc.map(opt)), h("optgroup", { label: "Đề kiểm tra" }, kt.map(opt))]
      : exams.map(opt));
    const clSel = h("select", { id: "omrCl" }, classes.map((c) => h("option", { value: c.id, selected: c.id === cls }, c.name + " (" + c.n + " HS)")));
    const info = h("p", { class: "sub omr-info" }), docs = h("div", { class: "omr-docs" }), queue = h("div"), res = h("div");
    const file = h("input", { type: "file", accept: "image/*", multiple: true, class: "hidden", onchange: () => { if (file.files.length) upload(ctx, cur(), cls, [...file.files], queue, () => results(ctx, cur(), cls, res)); file.value = ""; } });
    const cur = () => exams.find((e) => e.id === exId);
    const showInfo = () => {
      const e = cur(), c = e.counts || {}, parts = [];
      if (c.mcq) parts.push("Phần I: " + c.mcq + " câu"); if (c.tf) parts.push("Phần II: " + c.tf + " câu"); if (c.short) parts.push("Phần III: " + c.short + " câu");
      if (e.essay != null && !e.thang_10) parts.push("Tự luận " + num(e.essay) + " điểm (nhập tay)");
      info.textContent = parts.join(" · ") + " · Mã đề: " + (e.made || []).join(", ") + (e.thang_10 ? " · Quy về thang 10" : "");
      showDocs(e);
    };
    const showDocs = (e) => {
      docs.innerHTML = "";
      if (e.noi_dung) docs.append(h("p", { class: "omr-nd" }, h("b", {}, e.kieu === "de_cuong" ? "Nội dung đề cương: " : "Nội dung: "), e.noi_dung));
      const files = e.files || [];
      if (!files.length) {
        docs.append(h("p", { class: "sub" }, "Chưa có file PDF để tải. File đề sẽ xuất hiện khi công cụ đồng bộ trên máy thầy Hùng gửi lên."));
        return;
      }
      const label = (f) => f.kind === "de" ? "Đề mã " + f.made + " + phiếu" : f.kind === "phieu" ? "Phiếu trả lời" : f.kind === "dapan" ? "Đáp án" : f.kind === "loigiai" ? "Lời giải" : f.name;
      const kb = (n) => n > 1048576 ? (Math.round(n / 104857.6) / 10).toString().replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
      docs.append(h("div", { class: "omr-files" }, h("span", { class: "omr-files-t" }, "Tải về để in:"),
        files.map((f) => h("button", { class: "btn ghost sm omr-file" + (f.kind === "dapan" || f.kind === "loigiai" ? " gv" : ""), title: f.name + " · " + kb(f.size),
          onclick: (ev) => download(e, f, ev.currentTarget) }, label(f)))),
        h("p", { class: "sub" }, "Đáp án và lời giải chỉ dành cho giáo viên, không đưa cho học sinh trước khi làm bài."));
    };
    const download = async (e, f, btn) => {
      const old = btn.textContent; btn.disabled = true; btn.textContent = "Đang tải…";
      try {
        const r = await T("t_omr_file", { p_exam: e.id, p_name: f.name });
        if (!r || r.error) throw new Error((r && r.error) || "Không tải được file");
        const bin = atob(r.b64), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: "application/pdf" }));
        const a = h("a", { href: url, download: f.name }); document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) { fail(err); }
      btn.disabled = false; btn.textContent = old;
    };
    exSel.onchange = () => { exId = exSel.value; store.set("kt_t_omr", exId); showInfo(); queue.innerHTML = ""; results(ctx, cur(), cls, res); };
    clSel.onchange = () => { cls = +clSel.value; ctx.setClass && ctx.setClass(cls); queue.innerHTML = ""; results(ctx, cur(), cls, res); };
    el.append(h("div", { class: "panel omr-head", style: "margin-top:16px" },
      h("h3", {}, "Chấm phiếu trắc nghiệm giấy"),
      h("p", { class: "sub" }, "Học sinh tô số báo danh (6 số, xem ở tab Lớp & học sinh) và mã đề trên phiếu. Ảnh chỉ xử lí trên máy này; máy chủ chỉ nhận các ô đã tô để chấm."),
      h("div", { class: "form", style: "align-items:end" }, h("div", {}, h("label", { for: "omrEx" }, "Đề"), exSel), h("div", {}, h("label", { for: "omrCl" }, "Lớp"), clSel)),
      info, docs,
      h("div", { class: "omr-btns" },
        h("button", { class: "btn", onclick: () => camera(ctx, cur(), cls, () => results(ctx, cur(), cls, res)) }, "Quét bằng camera"),
        h("button", { class: "btn ghost", onclick: () => file.click() }, "Tải ảnh phiếu"), file)),
      queue, res);
    showInfo(); results(ctx, cur(), cls, res);
  };
})();
