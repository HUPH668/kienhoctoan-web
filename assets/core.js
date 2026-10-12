/* Phần dùng chung cho trang học sinh và trang giáo viên */
(() => {
  "use strict";
  const CFG = window.KT_CONFIG || {};
  const CUR = window.CURRICULUM || {};
  const KT = (window.KT = {});

  /* ---------- DOM ---------- */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  };
  KT.h = h;
  KT.esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  KT.pct = (x) => Math.round((x || 0) * 100);
  KT.fmt = (x) => x == null ? "–" : (Math.round(x * 100) / 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  KT.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  KT.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  KT.dt = (s) => s ? new Date(s).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "–";

  /* ---------- chương trình ---------- */
  KT.CUR = CUR;
  KT.LV = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng", VDC: "Vận dụng cao" };
  KT.TYPES = { MC: "Trắc nghiệm nhiều phương án", TF: "Trắc nghiệm đúng sai", SA: "Trả lời ngắn" };
  KT.TYPE_SHORT = { MC: "Nhiều phương án", TF: "Đúng/Sai", SA: "Trả lời ngắn" };
  KT.PART = { MC: "Phần I", TF: "Phần II", SA: "Phần III" };
  KT.W_STD = { MC: 1, TF: 4, SA: 2 };
  KT.romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const LESSON = (KT.LESSON = {});
  for (const [g, d] of Object.entries(CUR)) for (const ch of d.chapters) for (const ls of ch.lessons)
    LESSON[g + "-" + ls.no] = { g: +g, l: ls.no, name: ls.name, c: ch.no, cname: ch.name };
  KT.lessonName = (key, withGrade) => { const L = LESSON[key]; if (!L) return key; return (withGrade ? "Lớp " + L.g + " · " : "") + "Bài " + L.l + ". " + L.name; };
  KT.lessonsOf = (g) => Object.keys(LESSON).filter((k) => LESSON[k].g === +g);
  KT.lessonsInRange = (g, a, b) => KT.lessonsOf(g).filter((k) => LESSON[k].l >= a && LESSON[k].l <= b);
  KT.chapterLessons = (g, c) => KT.lessonsOf(g).filter((k) => LESSON[k].c === +c);
  KT.GRADES = Object.keys(CUR).map(Number).sort((a, b) => a - b);
  KT.guessGrade = (cls) => { const m = String(cls || "").match(/(?:^|[^0-9])(1[0-2]|[6-9])(?![0-9])/); return m && CUR[+m[1]] ? +m[1] : null; };
  // dồn số câu sang dạng nhiều phương án khi ngân hàng chưa có câu đúng/sai, trả lời ngắn (thường gặp ở lớp 6–9)
  KT.fitCounts = (c, av) => {
    const out = { MC: c.MC || 0, TF: c.TF || 0, SA: c.SA || 0 }; let extra = 0;
    for (const t of ["TF", "SA"]) if (out[t] > (av[t] || 0)) { extra += out[t] - (av[t] || 0); out[t] = av[t] || 0; }
    out.MC = Math.min(av.MC || 0, out.MC + extra);
    return out;
  };
  KT.TERM_NAMES = { GK1: "Giữa học kì I", HK1: "Cuối học kì I", GK2: "Giữa học kì II", HK2: "Cuối học kì II" };

  /* các khuôn đề chuẩn */
  KT.STD = { MC: 12, TF: 4, SA: 6 };
  KT.blueprint = {
    lesson: (g, l) => ({ kind: "Theo bài", grade: g, title: "Kiểm tra " + KT.lessonName(g + "-" + l) + " (Toán " + g + ")", lessons: [g + "-" + l], counts: { MC: 10, TF: 2, SA: 2 }, minutes: 20 }),
    chapter: (g, c) => { const ch = CUR[g].chapters.find((x) => x.no === +c); return { kind: "Theo chương", grade: g, title: "Kiểm tra Chương " + KT.romans[c] + ". " + ch.name + " (Toán " + g + ")", lessons: KT.chapterLessons(g, c), counts: { MC: 12, TF: 2, SA: 4 }, minutes: 45 }; },
    term: (g, code) => { const [a, b] = CUR[g].terms[code]; return { kind: code.startsWith("GK") ? "Giữa kì" : "Học kì", grade: g, title: "Kiểm tra " + KT.TERM_NAMES[code] + " · Toán " + g, lessons: KT.lessonsInRange(g, a, b), counts: { ...KT.STD }, minutes: 90 }; },
    grade: (g) => ({ kind: "Theo khối", grade: g, title: "Đề tổng hợp cả năm · Toán " + g, lessons: KT.lessonsOf(g), counts: { ...KT.STD }, minutes: 90 }),
    tn: () => ({ kind: "Tốt nghiệp THPT", grade: 12, title: "Đề thi thử tốt nghiệp THPT môn Toán", lessons: [10, 11, 12].flatMap(KT.lessonsOf), counts: { ...KT.STD }, minutes: 90,
      mix: [{ g: 12, share: 0.75 }, { g: 11, share: 0.2 }, { g: 10, share: 0.05 }] }),
    ts10: () => ({ kind: "Tuyển sinh 10", grade: 9, title: "Đề ôn thi vào lớp 10 · Toán", lessons: [8, 9].flatMap(KT.lessonsOf), counts: { ...KT.STD }, minutes: 90,
      mix: [{ g: 9, share: 0.8 }, { g: 8, share: 0.2 }] }),
    dgnl: () => ({ kind: "Đánh giá năng lực", grade: 12, title: "Đề luyện thi Đánh giá năng lực · Toán", lessons: [10, 11, 12].flatMap(KT.lessonsOf), counts: { MC: 24, TF: 0, SA: 6 }, minutes: 60,
      weights: { MC: 1, TF: 4, SA: 1 }, mix: [{ g: 12, share: 0.4 }, { g: 11, share: 0.3 }, { g: 10, share: 0.3 }] }),
  };
  KT.bpScope = (bp) => {
    if (bp.tags && bp.tags.length) return "ID " + bp.tags.slice(0, 6).join(", ") + (bp.tags.length > 6 ? "…" : "");
    const ls = bp.lessons || [];
    if (ls.length === 1) return KT.lessonName(ls[0], true);
    const gs = [...new Set(ls.map((k) => k.split("-")[0]))];
    return gs.map((g) => { const mine = ls.filter((k) => k.startsWith(g + "-")); return "Lớp " + g + ": " + (mine.length === KT.lessonsOf(g).length ? "cả năm" : mine.length > 8 ? "Bài " + mine[0].split("-")[1] + "–" + mine[mine.length - 1].split("-")[1] : mine.map((k) => "B" + k.split("-")[1]).join(", ")); }).join(" · ");
  };

  /* ---------- API Supabase ---------- */
  const base = (CFG.SUPABASE_URL || "").replace(/\/(rest\/v1)?\/?$/, "");
  const KEY = CFG.SUPABASE_KEY || "";
  let teacherSess = KT.store.get("kt_teacher_sess", null);
  async function req(path, body, bearer) {
    const headers = { apikey: KEY, "Content-Type": "application/json" };
    if (bearer) headers.Authorization = "Bearer " + bearer;
    else if (KEY.startsWith("eyJ")) headers.Authorization = "Bearer " + KEY;
    let r;
    try { r = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body || {}) }); }
    catch (e) { const er = new Error("Không kết nối được máy chủ. Kiểm tra mạng Internet."); er.network = true; throw er; }
    const txt = await r.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) {
      const msg = (data && (data.message || data.msg || data.error_description || data.error)) || ("Lỗi " + r.status);
      const er = new Error(msg); er.status = r.status; er.data = data; throw er;
    }
    return data;
  }
  KT.api = {
    async rpc(fn, args, asTeacher) {
      let bearer = null;
      if (asTeacher) {
        if (!teacherSess) throw Object.assign(new Error("Chưa đăng nhập"), { auth: true });
        if (Date.now() > teacherSess.expires_at - 60000) await KT.api.refresh();
        bearer = teacherSess.access_token;
      }
      try {
        const d = await req("/rest/v1/rpc/" + fn, args || {}, bearer);
        if (d && typeof d === "object" && !Array.isArray(d) && d.error) throw Object.assign(new Error(d.error), { soft: true, data: d });
        return d;
      } catch (e) {
        if (asTeacher && (e.status === 401 || /JWT/i.test(e.message))) { KT.api.logout(); e.auth = true; }
        throw e;
      }
    },
    async login(email, password) {
      const d = await req("/auth/v1/token?grant_type=password", { email, password });
      teacherSess = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, email: d.user && d.user.email };
      KT.store.set("kt_teacher_sess", teacherSess);
      return teacherSess;
    },
    async refresh() {
      try {
        const d = await req("/auth/v1/token?grant_type=refresh_token", { refresh_token: teacherSess.refresh_token });
        teacherSess = { ...teacherSess, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000 };
        KT.store.set("kt_teacher_sess", teacherSess);
      } catch (e) { KT.api.logout(); throw Object.assign(new Error("Phiên đăng nhập đã hết, vui lòng đăng nhập lại."), { auth: true }); }
    },
    logout() { teacherSess = null; KT.store.del("kt_teacher_sess"); },
    teacher: () => teacherSess,
  };

  /* ---------- toán & hình ---------- */
  const MACROS = {
    "\\hoac": "\\left[\\begin{aligned}#1\\end{aligned}\\right.", "\\heva": "\\left\\{\\begin{aligned}#1\\end{aligned}\\right.",
    "\\vv": "\\overrightarrow{#1}", "\\vec": "\\overrightarrow{#1}", "\\R": "\\mathbb{R}", "\\True": "", "\\False": "",
    "\\hfill": "", "\\centerdot": "\\cdot", "\\tron": "\\circ", "\\allowdisplaybreaks": "", "\\notag": "", "\\nonumber": "",
  };
  KT.typeset = (el, figs) => {
    el.querySelectorAll("img[data-fig]").forEach((img) => {
      const svg = figs && figs[img.dataset.fig];
      if (svg && !img.getAttribute("src")) {
        img.addEventListener("load", () => { if (img.naturalWidth) img.style.width = Math.round(img.naturalWidth * 1.3) + "px"; }, { once: true });
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      }
    });
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true }, { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }],
          macros: Object.assign({}, MACROS), throwOnError: false, strict: "ignore",
        });
      } catch (e) { }
    }
  };

  /* ---------- modal & thông báo ---------- */
  KT.modal = (content, opts = {}) => {
    const root = document.getElementById("modalRoot");
    const box = h("div", { class: "modal" + (opts.wide ? " wide" : ""), role: "dialog", "aria-modal": "true" }, content);
    const bg = h("div", { class: "modal-bg", onclick: (e) => { if (e.target === bg && !opts.sticky) close(); } }, box);
    const onKey = (e) => { if (e.key === "Escape" && !opts.sticky) close(); };
    const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
    document.addEventListener("keydown", onKey);
    root.append(bg);
    KT.typeset(bg, opts.figs);
    return close;
  };
  KT.confirm = (title, html, okLabel, onOk, cancel = "Huỷ") => {
    let close;
    close = KT.modal([h("h3", {}, title), h("p", { html }), h("div", { class: "acts" },
      h("button", { class: "btn ghost", onclick: () => close() }, cancel),
      h("button", { class: "btn", onclick: () => { close(); onOk(); } }, okLabel))]);
  };
  KT.toast = (msg, kind = "") => {
    let root = document.getElementById("toastRoot");
    if (!root) { root = h("div", { id: "toastRoot", class: "toasts", "aria-live": "polite" }); document.body.append(root); }
    const t = h("div", { class: "toast " + kind }, msg);
    root.append(t);
    setTimeout(() => t.remove(), kind === "bad" ? 6000 : 3000);
  };

  /* ---------- theme ---------- */
  KT.initTheme = (btn) => {
    const apply = (t) => { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); };
    apply(KT.store.get("kt_theme", null));
    btn && btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const nx = cur === "dark" ? "light" : "dark"; apply(nx); KT.store.set("kt_theme", nx);
    });
  };

  /* ---------- thống kê & đa giác ---------- */
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
  KT.short = short;
  /** list: [{key:"g-l", m(0..1), w}] -> trục nội dung (theo bài, hoặc gom theo chương nếu > 9 bài) */
  KT.contentAxes = (list) => {
    list = list.filter((x) => LESSON[x.key] && x.w > 0);
    const multiG = new Set(list.map((x) => x.key.split("-")[0])).size > 1;
    if (list.length <= 9) return list.sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true })).map((x) => {
      const L = LESSON[x.key];
      return { key: x.key, m: x.m, w: x.w, label: (multiG ? L.g + "·" : "") + "B" + L.l + " " + short(L.name, 20), full: KT.lessonName(x.key, multiG) };
    });
    const C = {};
    for (const x of list) { const L = LESSON[x.key]; const ck = L.g + "-C" + L.c; (C[ck] = C[ck] || { m: 0, w: 0, L }); C[ck].m += x.m * x.w; C[ck].w += x.w; }
    return Object.entries(C).sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true })).map(([k, v]) => ({ key: k, m: v.m / v.w, w: v.w,
      label: (multiG ? v.L.g + "·" : "") + "C" + KT.romans[v.L.c] + " " + short(v.L.cname, 18), full: "Lớp " + v.L.g + " · Chương " + KT.romans[v.L.c] + ". " + v.L.cname }));
  };
  KT.skillAxes = (levels, types) => {
    const out = [];
    for (const k of ["NB", "TH", "VD", "VDC"]) { const x = levels[k]; if (x && x.w) out.push({ key: k, m: x.m / x.w, label: KT.LV[k] }); }
    for (const k of ["MC", "TF", "SA"]) { const x = types[k]; if (x && x.w) out.push({ key: k, m: x.m / x.w, label: KT.TYPE_SHORT[k] }); }
    return out;
  };
  /** gom bảng mastery [{g,l,lv,t,m,w}] (m đã nhân trọng số) */
  KT.aggMastery = (rows, gFilter) => {
    const L = {}, Lv = {}, T = {};
    const add = (o, k, m, w) => { (o[k] = o[k] || { m: 0, w: 0 }); o[k].m += +m; o[k].w += +w; };
    for (const r of rows || []) {
      if (gFilter && r.g !== gFilter) continue;
      add(L, r.g + "-" + r.l, r.m, r.w); add(Lv, r.lv, r.m, r.w); add(T, r.t, r.m, r.w);
    }
    return { lessons: Object.entries(L).map(([key, v]) => ({ key, m: v.w ? v.m / v.w : 0, w: v.w })), levels: Lv, types: T };
  };
  function wrap(s, n) { const ws = s.split(" "); const out = []; let cur = ""; for (const w of ws) { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) out.push(cur); return out.slice(0, 2); }
  KT.radar = (axes, axes2) => {
    const N = axes.length, S = 380, cx = S / 2, cy = S / 2 + 4, R = 118;
    const ns = "http://www.w3.org/2000/svg";
    const el = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
    const svg = el("svg", { viewBox: "-90 0 " + (S + 180) + " " + (S + 8), role: "img", "aria-label": "Biểu đồ đa giác: " + axes.map((a) => a.label + " " + KT.pct(a.v) + "%").join(", ") });
    const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / N;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    [0.25, 0.5, 0.75, 1].forEach((f) => svg.append(el("polygon", { points: axes.map((_, i) => pt(i, R * f).join(",")).join(" "), fill: f === 1 ? "var(--surface-2)" : "none", stroke: "var(--line-2)", "stroke-width": f === 1 ? 1.2 : 0.8, "stroke-dasharray": f === 1 ? "" : "3 3" })));
    axes.forEach((_, i) => { const [x, y] = pt(i, R); svg.append(el("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "var(--line-2)", "stroke-width": 0.8 })); });
    [50, 100].forEach((v) => svg.append(el("text", { x: cx + 4, y: cy - R * v / 100 + 11, class: "radar-val" }, v + "%")));
    const poly = (vals, color, op, dash) => svg.append(el("polygon", { points: vals.map((v, i) => pt(i, R * Math.max(0.02, v || 0)).join(",")).join(" "), fill: color, "fill-opacity": op, stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-dasharray": dash || "" }));
    if (axes2) poly(axes2.map((a) => a.v ?? 0), "var(--radar-2)", 0.08, "5 4");
    poly(axes.map((a) => a.v), "var(--radar-1)", 0.2);
    axes.forEach((a, i) => {
      const [x, y] = pt(i, R * Math.max(0.02, a.v));
      const c = el("circle", { cx: x, cy: y, r: 4, fill: "var(--radar-1)", stroke: "var(--surface)", "stroke-width": 1.5 });
      c.append(el("title", {}, a.label + ": " + KT.pct(a.v) + "%")); svg.append(c);
      const [lx, ly] = pt(i, R + 18);
      const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
      const words = wrap(a.label, 20);
      const t = el("text", { x: lx, y: ly - (words.length - 1) * 6.5 + (ly > cy + 10 ? 8 : ly < cy - 10 ? -4 : 3), "text-anchor": anchor, class: "radar-axis" });
      words.forEach((w, j) => t.append(el("tspan", { x: lx, dy: j ? 13 : 0 }, w)));
      t.append(el("tspan", { x: lx, dy: 13, "font-weight": 700, fill: a.v >= 0.8 ? "var(--ok)" : a.v < 0.5 ? "var(--bad)" : "var(--warn)" }, KT.pct(a.v) + "%"));
      svg.append(t);
    });
    return svg;
  };
  KT.radarPanel = (title, sub, axes, axes2, legend2) => {
    const p = h("div", { class: "panel radar-box" }, h("h3", {}, title), sub ? h("p", { class: "sub" }, sub) : null);
    if (axes.length >= 3) {
      p.append(KT.radar(axes.map((a) => ({ label: a.label, v: a.m })), axes2));
      p.append(h("div", { class: "lg" }, h("span", {}, h("i", { style: "background:var(--radar-1)" }), legend2 ? "Bài làm này" : "Tỉ lệ đạt"), axes2 ? h("span", {}, h("i", { style: "background:var(--radar-2)" }), legend2 || "") : null));
    } else if (axes.length) {
      const ul = h("ul", { class: "bars" });
      axes.forEach((a) => ul.append(h("li", {}, h("div", { class: "bl" }, h("span", {}, a.full || a.label), h("b", {}, KT.pct(a.m) + "%")), h("div", { class: "bar" }, h("i", { style: "width:" + KT.pct(a.m) + "%" })))));
      p.append(ul);
    } else p.append(h("div", { class: "empty" }, "Chưa có dữ liệu."));
    return p;
  };

  /* ---------- hiển thị một câu hỏi ---------- */
  /** it: item từ máy chủ; mode: 'exam' | 'review'; onChange() khi trả lời */
  KT.qBlock = (it, num, mode, onChange, opt = {}) => {
    const box = h("article", { class: "q", id: "q" + num });
    const head = h("div", { class: "qh" }, h("span", { class: "qn" }, "Câu " + (num + 1) + "."),
      h("span", { class: "lvl", title: "Mức độ" + (it.lg ? " (ước lượng)" : "") }, KT.LV[it.lv] + (it.lg ? "*" : "")),
      it.rv ? h("span", { class: "lvl rvtag", title: "Câu cùng dạng với câu em từng làm sai" }, "Ôn lại") : null);
    if (mode === "exam") {
      const fb = h("button", { class: "flag" + (it.flag ? " on" : ""), type: "button", onclick: () => { it.flag = !it.flag; fb.classList.toggle("on", it.flag); fb.textContent = it.flag ? "★ Đã đánh dấu" : "☆ Đánh dấu"; onChange && onChange(it, true); } }, it.flag ? "★ Đã đánh dấu" : "☆ Đánh dấu");
      head.append(fb);
    } else if (it.status) {
      head.append(h("span", { class: "verdict " + it.status }, { ok: "Đúng", bad: "Sai", part: "Đúng " + Math.round(it.m * 4) + "/4 ý", skip: "Chưa làm" }[it.status]));
      if (it.conf === 1 && (it.status === "bad" || it.status === "part")) head.append(h("span", { class: "conftag cw", title: "Em chọn Chắc chắn nhưng làm sai: cần xem kĩ lời giải" }, "Tưởng đúng mà sai"));
      else if (it.conf === 1) head.append(h("span", { class: "conftag" }, "Chắc chắn"));
      else if (it.conf === 0) head.append(h("span", { class: "conftag" }, it.status === "ok" ? "Đoán đúng" : "Đoán"));
      head.append(h("span", { class: "qsrc" }, KT.lessonName(it.g + "-" + it.l, opt.withGrade) + (opt.pts ? " · " + KT.fmt(opt.pts[0]) + "/" + KT.fmt(opt.pts[1]) + " đ" : "")));
      if (opt.onReport) {
        const rb = h("button", { type: "button", class: "repbtn" + (opt.reported ? " done" : ""), title: "Báo cho thầy nếu đáp án hoặc đề bị sai", disabled: !!opt.reported,
          onclick: () => opt.onReport(it, rb) }, opt.reported ? "✓ Đã báo lỗi" : "⚑ Báo lỗi");
        head.append(rb);
      }
    }
    box.append(head, h("div", { class: "qtext", html: it.q }));
    const hasKey = it.key !== undefined;
    if (it.t === "MC") {
      const long = it.o.some((o) => String(o).replace(/<[^>]+>|\$[^$]*\$/g, "x").length > 40 || /img/.test(o));
      const wrapEl = h("div", { class: "opts" + (long ? " one" : "") });
      it.o.forEach((o, i) => {
        let cls = "opt";
        if (it.ans === i) cls += mode === "exam" ? " sel" : (hasKey ? (i === it.key ? "" : " wrong") : " sel");
        if (mode === "review" && hasKey && i === it.key) cls += " right";
        wrapEl.append(h("button", { class: cls, type: "button", disabled: mode !== "exam", onclick: () => {
          it.ans = it.ans === i ? null : i; wrapEl.querySelectorAll(".opt").forEach((x, j) => x.classList.toggle("sel", it.ans === j)); onChange && onChange(it);
        } }, h("span", { class: "L" }, "ABCD"[i]), h("span", { class: "v", html: o })));
      });
      box.append(wrapEl);
      if (mode === "review") box.append(h("div", { class: "keyline", html: (hasKey ? "Đáp án đúng: <b>" + "ABCD"[it.key] + "</b> · " : "") + (it.ans == null ? "Chưa chọn" : "Đã chọn " + "ABCD"[it.ans]) }));
    } else if (it.t === "TF") {
      if (!Array.isArray(it.ans)) it.ans = [null, null, null, null];
      const wrapEl = h("div", { class: "tf" });
      it.o.forEach((o, i) => {
        const row = h("div", { class: "r" });
        if (mode === "review" && hasKey && it.ans[i] != null) row.classList.add(it.ans[i] === it.key[i] ? "right" : "wrong");
        const bt = h("button", { type: "button", class: "t" + (it.ans[i] === true ? " on" : ""), disabled: mode !== "exam" }, "Đúng");
        const bf = h("button", { type: "button", class: "f" + (it.ans[i] === false ? " on" : ""), disabled: mode !== "exam" }, "Sai");
        const set = (v) => { it.ans[i] = it.ans[i] === v ? null : v; bt.classList.toggle("on", it.ans[i] === true); bf.classList.toggle("on", it.ans[i] === false); onChange && onChange(it); };
        bt.addEventListener("click", () => set(true)); bf.addEventListener("click", () => set(false));
        const sw = h("div", { class: "sw" }, bt, bf);
        if (mode === "review" && hasKey) sw.append(h("span", { class: "key", style: "color:var(--" + (it.key[i] ? "ok" : "bad") + ")" }, "→ " + (it.key[i] ? "Đúng" : "Sai")));
        row.append(h("span", { class: "k" }, "abcd"[i] + ")"), h("div", { class: "v", html: o }), sw);
        wrapEl.append(row);
      });
      box.append(wrapEl);
    } else {
      const inp = h("input", { type: "text", inputmode: "decimal", value: it.ans ?? "", placeholder: "Nhập đáp số", disabled: mode !== "exam", "aria-label": "Đáp số câu " + (num + 1),
        oninput: (e) => { it.ans = e.target.value; onChange && onChange(it); } });
      box.append(h("div", { class: "sa" }, inp, mode === "exam" ? h("span", { class: "hint" }, "Số thập phân dùng dấu phẩy hoặc chấm, ví dụ −1,5") : null));
      if (mode === "review" && hasKey) box.append(h("div", { class: "keyline", html: "Đáp án: <b>" + KT.esc(String(it.key).replace(/\\[dt]?frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2").replace(/\$/g, "")) + "</b>" }));
    }
    if (mode === "exam" && opt.conf !== false) {
      const mk = (v, lab) => h("button", { type: "button", class: "cf" + (it.conf === v ? " on" : ""), "aria-pressed": String(it.conf === v), onclick: (e) => {
        it.conf = it.conf === v ? null : v;
        e.currentTarget.parentNode.querySelectorAll(".cf").forEach((b, j) => { const on = it.conf === (j === 0 ? 1 : 0); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
        onChange && onChange(it, false, true);
      } }, lab);
      box.append(h("div", { class: "confrow" }, h("span", {}, "Em chắc chắn với câu trả lời này?"), mk(1, "Chắc chắn"), mk(0, "Còn đoán")));
    }
    if (mode === "review" && it.s) box.append(h("details", { class: "sol" }, h("summary", {}, "Xem lời giải"), h("div", { html: it.s })));
    return box;
  };
  KT.answered = (it) => {
    if (it.t === "TF") { const a = Array.isArray(it.ans) ? it.ans : []; const n = a.filter((x) => x != null).length; return n === 4 ? 2 : n ? 1 : 0; }
    return it.ans != null && String(it.ans).trim() !== "" ? 2 : 0;
  };

  /** thống kê một bài đã chấm (payload có m,w,status) */
  KT.evalPayload = (p) => {
    const byL = {}, byLv = {}, byT = {};
    const add = (o, k, m, w, ok) => { (o[k] = o[k] || { m: 0, w: 0, n: 0, ok: 0 }); o[k].m += m * w; o[k].w += w; o[k].n++; if (ok) o[k].ok++; };
    let U = 0, M = 0;
    for (const it of p.items) { U += +it.u || 0; M += +it.w || 0; }
    for (const it of p.items) {
      const w = KT.W_STD[it.t], m = +it.m || 0;
      add(byL, it.g + "-" + it.l, m, w, it.status === "ok"); add(byLv, it.lv, m, w); add(byT, it.t, m, w);
      it.pts = [10 * (+it.u || 0) / (M || 1), 10 * (+it.w || 0) / (M || 1)];
    }
    return { byL, byLv, byT, U, M };
  };
  /* ---------------- thương hiệu ---------------- */
  KT.BRAND = { name: CFG.SCHOOL || "Kiến Học Toán", teacher: CFG.TEACHER || "", phone: String(CFG.PHONE || "").replace(/\D/g, "") };
  KT.phoneFmt = (p) => String(p || "").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
  KT.MARK_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 22.5l4.2-2.6 5.6 10.6L27.6 9H34" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  KT.PHONE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/></svg>';
  KT.brandPanel = (who) => {
    const B = KT.BRAND;
    return h("aside", { class: "brandpanel" },
      h("div", { class: "bp-logo" }, h("span", { class: "mark lg", html: KT.MARK_SVG }), h("span", { class: "bp-name" }, B.name)),
      h("p", { class: "bp-saying" }, "Kiến tha lâu cũng đầy tổ."),
      h("p", { class: "bp-text" }, who === "teacher"
        ? "Giao đề, theo dõi lớp làm bài trực tiếp và xem đa giác điểm mạnh – điểm yếu của từng em."
        : "Mỗi ngày một bài kiểm tra ngắn. Nộp bài xong em biết ngay mình vững phần nào, cần luyện thêm phần nào."),
      B.teacher || B.phone ? h("div", { class: "bp-contact" },
        B.teacher ? h("b", {}, B.teacher) : null,
        B.phone ? h("a", { class: "bp-call", href: "tel:" + B.phone, html: KT.PHONE_SVG + "<span>" + KT.phoneFmt(B.phone) + "</span>" }) : null) : null);
  };
  (() => {
    const B = KT.BRAND;
    const hp = document.getElementById("hPhone");
    if (hp && B.phone) { hp.href = "tel:" + B.phone; hp.innerHTML = KT.PHONE_SVG + "<span>" + KT.phoneFmt(B.phone) + "</span>"; hp.title = "Gọi " + (B.teacher || "") ; hp.hidden = false; }
    const ft = document.getElementById("siteFoot");
    if (ft) ft.append(h("div", { class: "wrap" },
      h("div", { class: "f-brand" }, h("span", { class: "mark sm", html: KT.MARK_SVG }), h("b", {}, B.name)),
      h("div", { class: "f-contact" }, B.teacher ? h("span", {}, B.teacher) : null,
        B.phone ? h("a", { href: "tel:" + B.phone }, KT.phoneFmt(B.phone)) : null)));
  })();
  /* ---------------- thăng cấp ---------------- */
  KT.TITLES = [[1, "Kiến Tập Sự"], [3, "Kiến Chăm Chỉ"], [5, "Kiến Thợ"], [8, "Kiến Lính"], [11, "Kiến Trinh Sát"],
    [15, "Kiến Đội Trưởng"], [20, "Kiến Tướng"], [25, "Kiến Chúa"], [30, "Huyền Thoại Kiến Học"]];
  KT.lvOf = (xp) => Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * Math.max(0, xp || 0))) / 2));
  KT.lvXp = (L) => 50 * L * (L - 1);
  KT.titleOf = (L) => { let t = KT.TITLES[0][1]; for (const [m, n] of KT.TITLES) if (L >= m) t = n; return t; };
  KT.tierOf = (L) => KT.TITLES.filter(([m]) => L >= m).length - 1;
  KT.levelInfo = (xp) => {
    xp = xp || 0; const L = KT.lvOf(xp), a = KT.lvXp(L), b = KT.lvXp(L + 1);
    const nx = KT.TITLES.find(([m]) => m > L);
    return { L, xp, title: KT.titleOf(L), cur: xp - a, need: b - a, toNext: b - xp, pct: (xp - a) / (b - a), nextTitle: nx ? nx[1] : null, nextTitleAt: nx ? nx[0] : null };
  };
  KT.num = (n) => (n || 0).toLocaleString("vi-VN");
  KT.levelBadge = (L, cls) => {
    const tier = KT.tierOf(L);
    return h("span", { class: "lvbadge t" + tier + (cls ? " " + cls : ""), title: "Cấp " + L + " · " + KT.titleOf(L), html:
      '<svg viewBox="0 0 60 66" aria-hidden="true"><path d="M30 2 56 17v32L30 64 4 49V17z"/></svg><b>' + L + "</b>" });
  };
  KT.rankList = (rows, key, opt = {}) => {
    if (!rows || !rows.length) return h("div", { class: "empty" }, opt.empty || "Chưa có ai trên bảng. Làm bài để ghi tên mình đầu tiên!");
    return h("ol", { class: "ranks" }, rows.map((r, i) => {
      const L = KT.lvOf(r.xp);
      return h("li", { class: i < 3 ? "top" + (i + 1) : "" },
        h("span", { class: "rk" }, String(i + 1)),
        KT.levelBadge(L, "sm"),
        h("span", { class: "nm" }, h("b", {}, r.name), h("small", {}, KT.titleOf(L) + (r.class ? " · Lớp " + r.class : ""))),
        h("span", { class: "xpv" }, KT.num(r[key]), h("small", {}, " KN")));
    }));
  };

  /* ---------- biểu đồ (SVG/HTML thuần, có chú giải khi rê chuột) ---------- */
  let tipEl = null;
  const tipShow = (e) => {
    const t = e.currentTarget.getAttribute("data-tip"); if (!t) return;
    if (!tipEl) { tipEl = h("div", { class: "ktip", role: "tooltip" }); document.body.append(tipEl); }
    tipEl.innerHTML = t; tipEl.style.display = "block";
    const r = e.currentTarget.getBoundingClientRect(), w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - hh - 8;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8)); if (y < 8) y = r.bottom + 8;
    tipEl.style.left = x + "px"; tipEl.style.top = y + "px";
  };
  const tipHide = () => { if (tipEl) tipEl.style.display = "none"; };
  KT.tipify = (root) => { root.querySelectorAll("[data-tip]").forEach((el) => {
    el.addEventListener("mouseenter", tipShow); el.addEventListener("mouseleave", tipHide);
    el.addEventListener("focus", tipShow); el.addEventListener("blur", tipHide);
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  }); return root; };
  KT.level3 = (m) => (m >= 0.8 ? "ok" : m >= 0.5 ? "warn" : "bad");
  KT.LEVEL3_LABEL = { ok: "Vững", warn: "Chưa chắc", bad: "Yếu" };
  KT.statusLegend = () => h("div", { class: "chart-legend" },
    ["ok", "warn", "bad"].map((k) => h("span", {}, h("i", { class: "sw " + k }), KT.LEVEL3_LABEL[k] + (k === "ok" ? " (≥ 80%)" : k === "warn" ? " (50–79%)" : " (< 50%)"))));
  // thanh ngang: rows = [{label, m (0..1), sub, tip}]
  KT.hbars = (rows, opt = {}) => {
    const box = h("div", { class: "hbars" });
    rows.forEach((r) => {
      const st = opt.status === false ? "brand" : KT.level3(r.m);
      box.append(h("div", { class: "hb", "data-tip": r.tip || (KT.esc(r.label) + ": <b>" + KT.pct(r.m) + "%</b>" + (r.sub ? "<br>" + KT.esc(r.sub) : "")) },
        h("div", { class: "hb-l" }, h("span", {}, r.label), r.sub ? h("small", {}, r.sub) : null),
        h("div", { class: "hb-t" }, h("i", { class: st, style: "width:" + Math.max(1.5, KT.pct(r.m)) + "%" })),
        h("div", { class: "hb-v" }, KT.pct(r.m) + "%", opt.status === false ? null : h("small", { class: "st " + st }, KT.LEVEL3_LABEL[st]))));
    });
    if (!rows.length) box.append(h("div", { class: "empty" }, opt.empty || "Chưa có dữ liệu."));
    return KT.tipify(box);
  };
  // phân bố điểm 0–10 (10 cột)
  KT.histo = (scores) => {
    const bins = Array(10).fill(0); scores.forEach((s) => { if (s == null) return; bins[Math.min(9, Math.max(0, Math.floor(+s)))]++; });
    const W = 520, H = 220, L = 34, B = 30, T = 14, R = 8, mx = Math.max(1, ...bins), step = Math.max(1, Math.ceil(mx / 4));
    const top = Math.ceil(mx / step) * step, cw = (W - L - R) / 10, bw = Math.max(6, cw - 10);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    let g = "";
    for (let v = 0; v <= top; v += step) g += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    let bars = "";
    bins.forEach((n, i) => {
      const x = L + i * cw + (cw - bw) / 2, yy = y(n), hh = Math.max(0, y(0) - yy);
      const col = i < 5 ? "bad" : i < 8 ? "warn" : "ok";
      bars += '<g class="hit" data-tip="Điểm ' + i + (i === 9 ? "–10" : " đến dưới " + (i + 1)) + ": <b>" + n + " bài</b>\"><rect class=\"bg\" x=\"" + (L + i * cw) + '" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '"/>'
        + (n ? '<path class="bar ' + col + '" d="M' + x + "," + (yy + hh) + "V" + (yy + Math.min(4, hh)) + "Q" + x + "," + yy + " " + (x + Math.min(4, bw / 2)) + "," + yy + "H" + (x + bw - Math.min(4, bw / 2)) + "Q" + (x + bw) + "," + yy + " " + (x + bw) + "," + (yy + Math.min(4, hh)) + "V" + (yy + hh) + 'Z"/>' : "")
        + '<text class="ax" x="' + (L + i * cw + cw / 2) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + i + "</text></g>";
    });
    const el = h("div", { class: "chart", html: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Phân bố điểm">' + g + '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>' + bars + "</svg>" });
    return KT.tipify(el);
  };
  // đường: pts = [{x: nhãn, y: số, tip}], thang 0..10
  KT.lineChart = (pts, opt = {}) => {
    const W = 520, H = 220, L = 34, B = 30, T = 14, R = 14, lo = opt.min ?? 0, hi = opt.max ?? 10;
    const n = pts.length, xs = (i) => (n <= 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (n - 1)), y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    let g = "";
    for (let v = lo; v <= hi; v += (hi - lo) / 5) g += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + "</text>";
    const every = Math.max(1, Math.ceil(n / 6));
    pts.forEach((p, i) => { if (i % every === 0 || i === n - 1) g += '<text class="ax" x="' + xs(i) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + KT.esc(p.x) + "</text>"; });
    const path = pts.map((p, i) => (i ? "L" : "M") + xs(i).toFixed(1) + "," + y(p.y).toFixed(1)).join("");
    let dots = "";
    pts.forEach((p, i) => { dots += '<g class="hit" data-tip="' + KT.esc(p.tip || (p.x + ": " + p.y)).replace(/&lt;(\/?b|br)&gt;/g, "<$1>") + '"><line class="xh" x1="' + xs(i) + '" x2="' + xs(i) + '" y1="' + T + '" y2="' + y(lo) + '"/><circle class="hz" cx="' + xs(i) + '" cy="' + y(p.y) + '" r="14"/><circle class="dot" cx="' + xs(i) + '" cy="' + y(p.y) + '" r="4.5"/></g>'; });
    const el = h("div", { class: "chart", html: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + KT.esc(opt.label || "Biểu đồ đường") + '">' + g + '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(lo) + '" y2="' + y(lo) + '"/>' + (n > 1 ? '<path class="ln" d="' + path + '"/>' : "") + dots + "</svg>" });
    if (!n) el.innerHTML = '<div class="empty">Chưa có dữ liệu.</div>';
    return KT.tipify(el);
  };
  KT.spark = (vals) => {
    if (!vals || !vals.length) return h("span", { class: "muted" }, "—");
    const W = 90, H = 26, n = vals.length, xs = (i) => (n <= 1 ? W / 2 : 3 + (W - 6) * i / (n - 1)), y = (v) => 3 + (H - 6) * (1 - v / 10);
    const d = vals.map((v, i) => (i ? "L" : "M") + xs(i).toFixed(1) + "," + y(+v).toFixed(1)).join("");
    const last = vals[n - 1];
    return h("span", { class: "spark", "data-tip": "Các bài gần đây: " + vals.map((v) => KT.fmt(v)).join(" → "),
      html: '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' + (n > 1 ? '<path d="' + d + '"/>' : "") + '<circle cx="' + xs(n - 1) + '" cy="' + y(+last) + '" r="3"/></svg>' });
  };
})();
