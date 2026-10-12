/* Trang giáo viên */
(() => {
  "use strict";
  const { h, esc, fmt, pct, store, api, LV, TYPES, TYPE_SHORT, CUR, LESSON, romans } = KT;
  const app = document.getElementById("app");
  const who = document.getElementById("who");
  KT.initTheme(document.getElementById("themeBtn"));
  const T = (fn, args) => api.rpc(fn, args || {}, true);
  const figCache = {};
  let ov = null, tab = store.get("kt_t_tab", "monitor"), poll = null, curAsg = null, curClass = store.get("kt_t_class", null);

  function fail(e) {
    if (e.auth) { renderLogin(e.message); return; }
    KT.toast(e.message || String(e), "bad");
  }
  function stopPoll() { clearInterval(poll); poll = null; }
  function setWho() {
    who.innerHTML = "";
    const s = api.teacher(); if (!s) return;
    who.append(h("span", { class: "who-n" }, h("b", {}, "Giáo viên"), h("small", {}, s.email || "")),
      h("button", { class: "btn ghost sm", onclick: () => { api.logout(); stopPoll(); renderLogin(); } }, "Đăng xuất"));
  }

  /* ---------------- đăng nhập ---------------- */
  function renderLogin(msg) {
    stopPoll(); setWho(); app.innerHTML = "";
    const em = h("input", { id: "em", type: "email", autocomplete: "username", required: true });
    const pw = h("input", { id: "pw", type: "password", autocomplete: "current-password", required: true });
    const err = h("div", { class: "note bad" + (msg ? "" : " hidden") }, msg || "");
    const btn = h("button", { class: "btn", type: "submit" }, "Đăng nhập");
    app.append(h("section", { class: "wrap center" }, h("div", { class: "auth" }, KT.brandPanel("teacher"), h("form", { class: "login panel", onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; err.classList.add("hidden");
      try { await api.login(em.value.trim(), pw.value); await load(); }
      catch (ex) { err.textContent = /invalid/i.test(ex.message) ? "Sai email hoặc mật khẩu." : ex.message; err.classList.remove("hidden"); }
      btn.disabled = false;
    } }, h("h1", {}, "Đăng nhập"),
      h("div", { class: "roles", role: "tablist", "aria-label": "Chọn vai trò" },
        h("a", { href: "./", role: "tab", "aria-selected": "false" }, "Học sinh"),
        h("button", { type: "button", class: "on", role: "tab", "aria-selected": "true" }, "Giáo viên")),
      h("p", { class: "sub" }, "Đăng nhập bằng email và mật khẩu tài khoản giáo viên."),
      h("label", { for: "em" }, "Email"), em, h("label", { for: "pw" }, "Mật khẩu"), pw, err, btn))));
    em.focus();
  }

  async function load() {
    try { ov = await T("t_overview"); } catch (e) { api.logout(); renderLogin(e.message); return; }
    render();
  }
  function render() {
    stopPoll(); setWho(); app.innerHTML = "";
    const w = h("section", { class: "wrap" });
    const tabs = [["monitor", "Theo dõi & báo cáo"], ["assign", "Giao đề"], ["classes", ov.n_pending ? h("span", {}, "Lớp & học sinh ", h("span", { class: "tabbadge" }, String(ov.n_pending))) : "Lớp & học sinh"], ["bank", "Ngân hàng câu hỏi"]];
    w.append(h("div", { class: "tabs", role: "tablist" }, tabs.map(([k, lab]) => h("button", { class: tab === k ? "on" : "", role: "tab", "aria-selected": String(tab === k),
      onclick: () => { tab = k; store.set("kt_t_tab", k); curAsg = null; render(); } }, lab))));
    const body = h("div", {}); w.append(body); app.append(w);
    ({ monitor: tabMonitor, assign: tabAssign, classes: tabClasses, bank: tabBank })[tab](body);
  }

  /* ---------------- THEO DÕI ---------------- */
  function tabMonitor(el) {
    if (curAsg) return monitorView(el, curAsg);
    if (ov.n_pending) el.append(h("div", { class: "bknote", style: "margin-bottom:14px" }, h("span", {}, "Có " + ov.n_pending + " học sinh tự đăng ký đang chờ thầy duyệt."),
      h("button", { class: "btn sm", onclick: () => { tab = "classes"; store.set("kt_t_tab", tab); render(); } }, "Xem và duyệt")));
    const list = ov.assignments || [];
    el.append(h("div", { class: "review-t" }, h("h2", { style: "margin:0" }, "Bài đã giao"), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: load }, "Làm mới"), h("button", { class: "btn sm", onclick: () => { tab = "assign"; render(); } }, "+ Giao đề mới")));
    if (!list.length) { el.append(h("div", { class: "panel empty", style: "margin-top:14px" }, "Chưa giao bài nào. Vào mục “Giao đề” để bắt đầu.")); return; }
    const now = new Date(ov.server_now).getTime();
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Bài", "Lớp", "Thời gian", "Trạng thái", "Đã nộp", "Đang làm", "Điểm TB"].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    list.forEach((a) => {
      const op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
      const st = now < op ? h("span", { class: "pill" }, "Chưa mở") : now > cl ? h("span", { class: "pill" }, "Đã đóng") : h("span", { class: "pill ok" }, "Đang mở");
      tbody.append(h("tr", { class: "click", onclick: () => { curAsg = a.id; render(); } },
        h("td", {}, h("b", {}, a.title), h("div", { style: "font-size:12.5px;color:var(--ink-3)" }, a.kind + " · " + a.minutes + " phút")),
        h("td", {}, a.class), h("td", {}, KT.dt(a.opens_at) + " → " + KT.dt(a.closes_at)), h("td", {}, st),
        h("td", { class: "num" }, a.n_done + "/" + a.n_students), h("td", { class: "num" }, String(a.n_doing)), h("td", { class: "num" }, fmt(a.avg))));
    });
    tb.append(tbody);
    el.append(h("div", { class: "tbl-wrap", style: "margin-top:14px" }, tb));
  }

  async function monitorView(el, id) {
    el.append(h("div", { class: "loading" }, "Đang tải…"));
    let m, rep;
    let lastDone = -1;
    const refresh = async (withReport) => {
      try {
        m = await T("t_monitor", { p_assignment: id });
        const nd = m.rows.filter((r) => r.status === "done").length;
        if (withReport || !rep || nd !== lastDone) { rep = await T("t_report", { p_assignment: id }); lastDone = nd; }
        draw();
      } catch (e) { fail(e); stopPoll(); }
    };
    let repTick = 0;
    const draw = () => {
      el.innerHTML = "";
      const a = m.assignment, rows = m.rows;
      const now = new Date(m.server_now).getTime(), cl = new Date(a.closes_at).getTime(), open = now >= new Date(a.opens_at).getTime() && now < cl;
      el.append(h("div", { class: "review-t" },
        h("button", { class: "btn ghost sm", onclick: () => { curAsg = null; load(); } }, "← Danh sách"),
        h("h2", { style: "margin:0;font-size:20px" }, a.title), h("span", { class: "sp" }),
        h("span", { class: "pill " + (open ? "ok" : "") }, open ? "Đang mở · đóng lúc " + KT.dt(a.closes_at) : now < cl ? "Mở lúc " + KT.dt(a.opens_at) : "Đã đóng")));
      el.append(h("p", { class: "sub", style: "margin:6px 0 12px" }, "Lớp " + a.class + " · " + a.kind + " · " + (a.blueprint.minutes) + " phút · " + KT.bpScope(a.blueprint) + " · tự cập nhật mỗi 5 giây"));
      el.append(h("div", { class: "row noprint", style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px" },
        open ? h("button", { class: "btn acc sm", onclick: () => KT.confirm("Đóng bài và thu bài?", "Các em đang làm sẽ được nộp ngay với những câu đã trả lời.", "Thu bài", async () => { await T("t_assignment_update", { p_id: id, p_closes: new Date().toISOString() }).catch(fail); refresh(true); }) }, "Thu bài ngay") : null,
        h("button", { class: "btn ghost sm", onclick: async () => { await T("t_assignment_update", { p_id: id, p_closes: new Date(Math.max(cl, now) + 10 * 60000).toISOString() }).catch(fail); KT.toast("Đã gia hạn thêm 10 phút", "ok"); refresh(); } }, "Gia hạn +10 phút"),
        h("button", { class: "btn ghost sm", onclick: async () => { await T("t_assignment_update", { p_id: id, p_show: !a.show_answers }).catch(fail); refresh(); } }, a.show_answers ? "Ẩn đáp án với HS" : "Cho HS xem đáp án"),
        h("button", { class: "btn ghost sm", onclick: () => exportScores(a, rows) }, "Xuất bảng điểm (Excel)"),
        h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá bài này?", "Xoá bài giao và <b>toàn bộ bài làm</b> của học sinh. Không thể hoàn tác.", "Xoá", async () => { await T("t_assignment_update", { p_id: id, p_delete: true }).catch(fail); curAsg = null; load(); }) }, "Xoá")));
      const done = rows.filter((r) => r.status === "done"), doing = rows.filter((r) => r.status === "doing"), none = rows.filter((r) => !r.status);
      const sc = done.map((r) => +r.score);
      const kp = h("div", { class: "kpis" });
      const k = (n, l) => h("div", { class: "kpi" }, h("div", { class: "n" }, n), h("div", { class: "l" }, l));
      kp.append(k(done.length + "/" + rows.length, "Đã nộp"), k(String(doing.length), "Đang làm"), k(String(none.length), "Chưa vào"),
        k(sc.length ? fmt(sc.reduce((x, y) => x + y, 0) / sc.length) : "–", "Điểm trung bình"), k(sc.length ? fmt(Math.max(...sc)) + " / " + fmt(Math.min(...sc)) : "–", "Cao nhất / thấp nhất"));
      el.append(kp);
      // bảng học sinh
      const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Mã", "Họ tên", "Trạng thái", "Tiến độ", "Điểm", "Bắt đầu", "Nộp lúc", ""].map((x) => h("th", {}, x)))));
      const tbody = h("tbody");
      rows.forEach((r) => {
        let st;
        if (!r.status) st = h("span", { class: "pill" }, "Chưa vào");
        else if (r.status === "doing") { const left = Math.max(0, Math.round((new Date(r.ends_at) - now) / 60000)); const idle = (now - new Date(r.last_seen)) / 1000 > 120; st = h("span", { class: "pill warn" }, "Đang làm · còn " + left + "′" + (idle ? " · không hoạt động" : "")); }
        else st = h("span", { class: "pill ok" }, "Đã nộp");
        tbody.append(h("tr", { class: r.attempt ? "click" : "", onclick: () => r.attempt && viewAttempt(r.attempt) },
          h("td", { class: "mono" }, r.code), h("td", {}, r.name), h("td", {}, st),
          h("td", {}, r.n_items ? [h("span", { class: "prog-mini" }, h("i", { style: "width:" + pct(r.n_answered / r.n_items) + "%" })), r.n_answered + "/" + r.n_items] : "–"),
          h("td", { class: "num" }, r.status === "done" ? h("b", {}, fmt(r.score)) : "–"),
          h("td", {}, r.started_at ? KT.dt(r.started_at) : "–"), h("td", {}, r.submitted_at ? KT.dt(r.submitted_at) : "–"),
          h("td", {}, r.attempt ? h("span", { style: "color:var(--brand);font-size:13px" }, "Xem bài →") : "")));
      });
      tb.append(tbody);
      el.append(h("div", { class: "section-t" }, "Tình hình từng học sinh"), h("div", { class: "tbl-wrap" }, tb));
      // báo cáo lớp
      el.append(h("div", { class: "section-t" }, "Báo cáo cả lớp (" + done.length + " bài đã nộp)"));
      if (!done.length) { el.append(h("div", { class: "panel empty" }, "Báo cáo hiện khi có học sinh nộp bài.")); return; }
      const bins = Array(10).fill(0); sc.forEach((s) => bins[Math.min(9, Math.floor(s))]++);
      const mx = Math.max(...bins, 1);
      const hist = h("div", { class: "panel" }, h("h3", {}, "Phổ điểm"), h("div", { class: "hist-bars" }, bins.map((b) => h("div", { style: "height:" + (100 * b / mx) + "%" }, h("span", {}, b ? String(b) : "")))),
        h("div", { class: "hist-x" }, bins.map((_, i) => h("span", {}, i + "–" + (i + 1)))));
      const agg = KT.aggMastery(rep.mastery);
      el.append(h("div", { class: "radars" }, KT.radarPanel("Đa giác cả lớp theo nội dung", "Tỉ lệ đạt trung bình theo bài/chương", KT.contentAxes(agg.lessons)),
        KT.radarPanel("Theo mức độ & dạng câu", "", KT.skillAxes(agg.levels, agg.types))));
      el.append(h("div", { style: "height:16px" }), hist);
      // câu hỏi khó
      const qs = rep.questions.filter((q) => q.n >= 1).slice(0, 15);
      const qt = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Câu hỏi", "Bài", "Mức", "Dạng", "Số HS", "Tỉ lệ đạt", "Tưởng đúng mà sai"].map((x) => h("th", {}, x)))));
      const qb = h("tbody");
      qs.forEach((q) => qb.append(h("tr", {}, h("td", {}, h("div", { class: "qmini", html: q.q })), h("td", {}, "L" + q.g + "·B" + q.l), h("td", {}, q.lv), h("td", {}, TYPE_SHORT[q.t]),
        h("td", { class: "num" }, String(q.n)), h("td", { class: "num" }, h("b", { style: "color:var(--" + (q.m < 0.35 ? "bad" : q.m < 0.6 ? "warn" : "ok") + ")" }, pct(q.m) + "%")),
        h("td", { class: "num", title: "Số em chọn Chắc chắn nhưng làm sai câu này" }, q.cw ? h("b", { style: "color:var(--pen)" }, String(q.cw)) : "–"))));
      qt.append(qb);
      const need = [...new Set(qs.flatMap((q) => [...(q.q || "").matchAll(/data-fig="([0-9a-f]+)"/g)].map((m) => m[1])))].filter((x) => !figCache[x]);
      if (need.length) api.rpc("get_figs", { p_ids: need }).then((f) => { Object.assign(figCache, f); KT.typeset(qt, figCache); }).catch(() => { });
      el.append(h("div", { class: "section-t" }, "Các câu lớp làm kém nhất"), h("div", { class: "tbl-wrap" }, qt));
      KT.typeset(el, figCache);
    };
    await refresh(true);
    stopPoll();
    poll = setInterval(() => { if (document.visibilityState === "visible") { repTick++; refresh(repTick % 3 === 0); } }, 5000);
  }
  async function viewAttempt(id) {
    try {
      const p = await T("t_attempt", { p_attempt: id });
      const ev = p.status === "done" ? KT.evalPayload(p) : null;
      const box = h("div", {});
      box.append(h("h3", {}, p.student + " — " + p.title), h("p", {}, p.status === "done" ? "Điểm: " + fmt(p.score) + " · nộp lúc " + KT.dt(p.submitted_at) : "Đang làm · đã lưu các câu trả lời đến thời điểm hiện tại"));
      if (ev) box.append(h("div", { class: "radars" }, KT.radarPanel("Theo nội dung", "", KT.contentAxes(Object.entries(ev.byL).map(([k, v]) => ({ key: k, m: v.m / v.w, w: v.w })))),
        KT.radarPanel("Theo mức độ & dạng câu", "", KT.skillAxes(ev.byLv, ev.byT))));
      p.items.forEach((it, i) => box.append(KT.qBlock(it, i, "review", null, { pts: it.pts, withGrade: true })));
      let close;
      close = KT.modal([box, h("div", { class: "acts" }, h("button", { class: "btn", onclick: () => close() }, "Đóng"))], { wide: true, figs: p.figs });
    } catch (e) { fail(e); }
  }
  function exportScores(a, rows) {
    const data = [["Mã HS", "Họ tên", "Trạng thái", "Số câu đã làm", "Tổng số câu", "Điểm", "Bắt đầu", "Nộp lúc"]].concat(rows.map((r) => [r.code, r.name, r.status === "done" ? "Đã nộp" : r.status === "doing" ? "Đang làm" : "Chưa làm", r.n_answered ?? "", r.n_items ?? "", r.score != null ? String(r.score).replace(".", ",") : "", r.started_at ? KT.dt(r.started_at) : "", r.submitted_at ? KT.dt(r.submitted_at) : ""]));
    download("Diem_" + a.class + "_" + a.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40) + ".csv", data);
  }
  function download(name, rows) {
    const csv = "\ufeff" + rows.map((r) => r.map((x) => '"' + String(x ?? "").replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  /* ---------------- GIAO ĐỀ ---------------- */
  function bankCounts(lessons) {
    const set = new Set(lessons), c = { MC: 0, TF: 0, SA: 0 };
    for (const s of ov.bank || []) if (set.has(s.g + "-" + s.l)) c[s.t] += s.n;
    return c;
  }
  function tabAssign(el) {
    if (!ov.classes.length) { el.append(h("div", { class: "panel empty" }, "Cần tạo lớp và nhập học sinh trước (mục “Lớp & học sinh”).")); return; }
    const f = {};
    const pad = (n) => String(n).padStart(2, "0");
    const local = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    f.cls = h("select", { id: "fCls" }, ov.classes.map((c) => h("option", { value: c.id }, c.name + " (" + c.n + " HS)")));
    f.grade = h("select", { id: "fGrade" }, [10, 11, 12].map((g) => h("option", { value: g }, "Toán " + g)));
    const c0 = ov.classes[0]; if (c0.grade && CUR[c0.grade]) f.grade.value = c0.grade;
    f.kind = h("select", { id: "fKind" }, [["lesson", "Theo bài"], ["chapter", "Theo chương"], ["GK1", "Giữa học kì I"], ["HK1", "Cuối học kì I"], ["GK2", "Giữa học kì II"], ["HK2", "Cuối học kì II"],
      ["grade", "Theo khối (cả năm)"], ["tn", "Thi thử tốt nghiệp THPT"], ["dgnl", "Đánh giá năng lực"], ["custom", "Tự chọn nhiều bài"], ["tags", "Chọn theo ID câu hỏi"]].map(([v, l]) => h("option", { value: v }, l)));
    f.sub = h("select", { id: "fSub" });
    const subWrap = h("div", {}, h("label", { for: "fSub" }, "Bài / chương"), f.sub);
    const pick = h("div", { class: "lesson-pick full hidden" });
    // --- chọn theo ID câu hỏi
    const parseTags = (txt) => [...new Set(String(txt || "").split(/[\s,;]+/).map((x) => x.replace(/[\[\]]/g, "").trim().toUpperCase()).filter(Boolean))];
    f.tags = h("textarea", { id: "fTags", rows: 2, placeholder: "VD: 10B02-TH, 2D1V4, 11B04", style: "min-height:64px" });
    const tagSearch = h("input", { type: "search", placeholder: "Lọc danh sách ID…", "aria-label": "Lọc danh sách ID", style: "max-width:260px" });
    const tagList = h("div", { class: "tag-list" });
    const tagInfo = h("div", { class: "tag-info" });
    let tagGroups = {}, tagMatch = null, tagTimer = null, tagSeq = 0;
    const tagWrap = h("div", { class: "full tagbox hidden" },
      L0("fTags", "ID câu hỏi cần kiểm tra"), f.tags,
      h("p", { class: "sub", style: "margin:4px 0 10px" }, "Nhập một hoặc nhiều ID, cách nhau bằng dấu phẩy. Nhập phần đầu là lấy cả nhóm: “2D1” = mọi câu có ID bắt đầu bằng 2D1. Dấu * thay cho đoạn bất kỳ: “2D1*-2”. Hoặc tích chọn trong danh sách bên dưới."),
      h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px" }, tagSearch,
        h("button", { type: "button", class: "btn ghost sm", onclick: () => previewTags() }, "Xem trước câu hỏi")),
      tagList, tagInfo);
    function L0(id, t) { return h("label", { for: id }, t); }
    const drawTagList = () => {
      const g = +f.grade.value, rows = tagGroups[g] || [], cur = new Set(parseTags(f.tags.value)), qy = tagSearch.value.trim().toUpperCase();
      tagList.innerHTML = "";
      const shown = rows.filter((r) => !qy || r.tag.includes(qy));
      if (!rows.length) { tagList.append(h("div", { class: "empty", style: "padding:10px" }, "Khối này chưa có câu nào gắn ID trong file .tex.")); return; }
      shown.slice(0, 400).forEach((r) => {
        const cb = h("input", { type: "checkbox", checked: cur.has(r.tag), onchange: () => {
          const now = parseTags(f.tags.value).filter((x) => x !== r.tag);
          if (cb.checked) now.push(r.tag);
          f.tags.value = now.join(", "); onTags();
        } });
        const parts = [["MC", "NPA"], ["TF", "Đ/S"], ["SA", "TLN"]].filter(([t]) => r[t]).map(([t, l]) => l + " " + r[t]).join(" · ");
        tagList.append(h("label", { class: "chk tag-row" }, cb, h("b", { class: "mono" }, r.tag), h("small", {}, r.n + " câu (" + parts + ") · Bài " + r.l.join(", "))));
      });
      if (shown.length > 400) tagList.append(h("div", { class: "sub" }, "… còn " + (shown.length - 400) + " nhóm, gõ để lọc."));
    };
    const loadTagGroups = async () => {
      const g = +f.grade.value;
      if (!tagGroups[g]) { tagList.innerHTML = ""; tagList.append(h("div", { class: "loading", style: "padding:14px" }, "Đang tải danh sách ID…")); try { tagGroups[g] = await T("t_tag_groups", { p_g: g }); } catch (e) { fail(e); tagGroups[g] = []; } }
      drawTagList();
    };
    const levelsSel = () => { const l = Object.entries(f.levels).filter(([, x]) => x.checked).map(([k]) => k); return l.length === 4 ? null : l; };
    const onTags = () => {
      clearTimeout(tagTimer);
      tagTimer = setTimeout(async () => {
        const tags = parseTags(f.tags.value), my = ++tagSeq;
        if (!tags.length) { tagMatch = null; update(false); drawTagList(); return; }
        try { const m = await T("t_tag_match", { p_tags: tags, p_levels: levelsSel() }); if (my === tagSeq) { tagMatch = m; update(false); drawTagList(); } } catch (e) { fail(e); }
      }, 350);
    };
    f.tags.addEventListener("input", onTags);
    tagSearch.addEventListener("input", drawTagList);
    async function previewTags() {
      const tags = parseTags(f.tags.value);
      if (!tags.length) return KT.toast("Nhập hoặc chọn ít nhất một ID.", "bad");
      let m; try { m = await T("t_tag_match", { p_tags: tags, p_levels: levelsSel(), p_preview: 60 }); } catch (e) { return fail(e); }
      const box = h("div", {}, h("h3", {}, "Các câu khớp với ID đã chọn"), h("p", {}, (m.counts.MC + m.counts.TF + m.counts.SA) + " câu" + (m.preview.length < m.counts.MC + m.counts.TF + m.counts.SA ? " · hiện " + m.preview.length + " câu đầu" : "")));
      const list = h("div", {});
      m.preview.forEach((q, i) => list.append(h("div", { class: "prev-q" }, h("div", { class: "bk-meta" }, h("b", { class: "mono" }, q.tag), h("span", { class: "lvl" }, KT.LV[q.lv] || q.lv), h("span", {}, TYPE_SHORT[q.t]), h("span", {}, KT.lessonName(q.g + "-" + q.l, true))),
        h("div", { class: "qmini", html: q.q }),
        q.t !== "SA" && q.o && q.o.length ? h("ol", { class: "prev-o", type: q.t === "MC" ? "A" : "a" }, q.o.map((o) => h("li", { html: o }))) : null)));
      box.append(list);
      let close; close = KT.modal([box, h("div", { class: "acts" }, h("button", { class: "btn", onclick: () => close() }, "Đóng"))], { wide: true });
      const need = [...new Set(m.preview.flatMap((q) => [...((q.q || "") + JSON.stringify(q.o || "")).matchAll(/data-fig=\\?"([0-9a-f]+)/g)].map((x) => x[1])))];
      let figs = {}; if (need.length) { try { figs = await api.rpc("get_figs", { p_ids: need }); } catch (e) { } }
      KT.typeset(list, figs);
    }
    f.title = h("input", { id: "fTitle" });
    f.mc = h("input", { type: "number", min: 0, max: 60, id: "fMC" }); f.tf = h("input", { type: "number", min: 0, max: 30, id: "fTF" }); f.sa = h("input", { type: "number", min: 0, max: 30, id: "fSA" });
    f.min = h("input", { type: "number", min: 5, max: 240, id: "fMin" });
    const now = new Date();
    f.open = h("input", { type: "datetime-local", id: "fOpen", value: local(now) });
    f.close = h("input", { type: "datetime-local", id: "fClose" });
    f.max = h("input", { type: "number", min: 1, max: 20, value: 1, id: "fMax" });
    f.show = h("input", { type: "checkbox", id: "fShow", checked: true });
    f.levels = {}; ["NB", "TH", "VD", "VDC"].forEach((k) => (f.levels[k] = h("input", { type: "checkbox", checked: true, id: "lv" + k })));
    const avail = h("div", { class: "avail full" });
    let bp = null;
    const fillSub = () => {
      const g = +f.grade.value, k = f.kind.value;
      f.sub.innerHTML = ""; subWrap.classList.toggle("hidden", !(k === "lesson" || k === "chapter"));
      pick.classList.toggle("hidden", k !== "custom");
      tagWrap.classList.toggle("hidden", k !== "tags");
      if (k === "tags") { loadTagGroups(); onTags(); }
      if (k === "lesson") CUR[g].chapters.forEach((ch) => { const og = h("optgroup", { label: "Chương " + romans[ch.no] }); ch.lessons.forEach((L) => { const c = bankCounts([g + "-" + L.no]); og.append(h("option", { value: L.no }, "Bài " + L.no + ". " + L.name + " (" + (c.MC + c.TF + c.SA) + " câu)")); }); f.sub.append(og); });
      if (k === "chapter") CUR[g].chapters.forEach((ch) => { const c = bankCounts(KT.chapterLessons(g, ch.no)); f.sub.append(h("option", { value: ch.no }, "Chương " + romans[ch.no] + ". " + ch.name + " (" + (c.MC + c.TF + c.SA) + ")")); });
      if (k === "custom") { pick.innerHTML = ""; KT.lessonsOf(g).forEach((key) => { const c = bankCounts([key]); pick.append(h("label", { class: "chk" }, h("input", { type: "checkbox", value: key, onchange: () => update(false) }), KT.lessonName(key) + " (" + (c.MC + c.TF + c.SA) + ")")); }); }
      update(true);
    };
    const update = (resetCounts) => {
      const g = +f.grade.value, k = f.kind.value, B = KT.blueprint;
      if (k === "lesson") bp = B.lesson(g, +f.sub.value || 1);
      else if (k === "chapter") bp = B.chapter(g, +f.sub.value || 1);
      else if (["GK1", "HK1", "GK2", "HK2"].includes(k)) bp = B.term(g, k);
      else if (k === "grade") bp = B.grade(g);
      else if (k === "tn") bp = B.tn();
      else if (k === "dgnl") bp = B.dgnl();
      else if (k === "tags") { const tg = parseTags(f.tags.value); bp = { kind: "Theo ID", grade: g, title: "Kiểm tra theo ID " + (tg.length ? tg.slice(0, 4).join(", ") + (tg.length > 4 ? "…" : "") : "") , lessons: tagMatch ? tagMatch.lessons : [], tags: tg, counts: { MC: 10, TF: 2, SA: 2 }, minutes: 30 }; }
      else { const ls = [...pick.querySelectorAll("input:checked")].map((x) => x.value); bp = { kind: "Tự chọn", grade: g, title: "Kiểm tra " + (ls.length ? ls.map((x) => "B" + x.split("-")[1]).join(", ") : "") + " · Toán " + g, lessons: ls, counts: { MC: 12, TF: 4, SA: 6 }, minutes: 45 }; }
      if (k === "tags" && !resetCounts && f.title.dataset.auto !== "0") f.title.value = bp.title;
      if (resetCounts) { f.title.dataset.auto = "1"; f.title.value = bp.title; f.mc.value = bp.counts.MC; f.tf.value = bp.counts.TF; f.sa.value = bp.counts.SA; f.min.value = bp.minutes; setClose(); }
      avail.innerHTML = "";
      if (k === "tags") {
        if (!bp.tags.length) { avail.append("Nhập hoặc tích chọn ID câu hỏi ở trên."); return; }
        if (!tagMatch) { avail.append("Đang đếm số câu khớp…"); return; }
        const tc = tagMatch.counts;
        avail.append("Khớp " + (tc.MC + tc.TF + tc.SA) + " câu: " + tc.MC + " nhiều phương án · " + tc.TF + " đúng/sai · " + tc.SA + " trả lời ngắn" + (tagMatch.lessons.length ? " (" + KT.bpScope({ lessons: tagMatch.lessons }) + "). " : ". "));
        const lk = [["MC", f.mc], ["TF", f.tf], ["SA", f.sa]].filter(([t, inp]) => +inp.value > tc[t]);
        if (lk.length) avail.append(h("b", { style: "color:var(--bad)" }, "Không đủ câu: " + lk.map(([t]) => TYPE_SHORT[t]).join(", ") + " — đề sẽ ít câu hơn."));
        else avail.append(h("span", { style: "color:var(--ok)" }, "Mỗi em bốc ngẫu nhiên đúng số câu đã nhập từ các câu khớp. Muốn cả lớp làm đủ mọi câu thì nhập số câu bằng số câu khớp."));
        return;
      }
      const c = bankCounts(bp.lessons);
      avail.append("Ngân hàng hiện có cho phạm vi này: " + c.MC + " câu nhiều phương án · " + c.TF + " đúng/sai · " + c.SA + " trả lời ngắn. ");
      const lack = [["MC", f.mc], ["TF", f.tf], ["SA", f.sa]].filter(([t, inp]) => +inp.value > c[t]);
      if (lack.length) avail.append(h("b", { style: "color:var(--bad)" }, "Không đủ câu: " + lack.map(([t]) => TYPE_SHORT[t]).join(", ") + " — đề sẽ ít câu hơn."));
      else avail.append(h("span", { style: "color:var(--ok)" }, "Đủ câu để mỗi học sinh nhận một đề ngẫu nhiên."));
    };
    const setClose = () => { const o = new Date(f.open.value); f.close.value = local(new Date(o.getTime() + ((+f.min.value || 45) + 10) * 60000)); };
    f.grade.onchange = fillSub; f.kind.onchange = fillSub; f.sub.onchange = () => update(true);
    f.title.addEventListener("input", () => (f.title.dataset.auto = "0"));
    Object.values(f.levels).forEach((x) => x.addEventListener("change", () => { if (f.kind.value === "tags") onTags(); }));
    [f.mc, f.tf, f.sa].forEach((x) => (x.oninput = () => update(false)));
    f.min.oninput = setClose; f.open.onchange = setClose;
    f.cls.onchange = () => { const c = ov.classes.find((x) => x.id === +f.cls.value); if (c && c.grade && CUR[c.grade]) { f.grade.value = c.grade; fillSub(); } };
    const L = (id, t) => h("label", { for: id }, t);
    const form = h("div", { class: "form" },
      h("div", {}, L("fCls", "Lớp"), f.cls), h("div", {}, L("fGrade", "Khối kiến thức"), f.grade), h("div", {}, L("fKind", "Loại đề"), f.kind), subWrap, pick, tagWrap,
      h("div", { class: "full" }, L("fTitle", "Tên bài kiểm tra"), f.title),
      h("div", {}, L("fMC", "Số câu nhiều phương án"), f.mc), h("div", {}, L("fTF", "Số câu đúng/sai"), f.tf), h("div", {}, L("fSA", "Số câu trả lời ngắn"), f.sa), h("div", {}, L("fMin", "Thời gian làm (phút)"), f.min),
      avail,
      h("div", {}, L("fOpen", "Mở lúc"), f.open), h("div", {}, L("fClose", "Đóng lúc (hết giờ thì tự thu bài)"), f.close), h("div", {}, L("fMax", "Số lần được làm"), f.max),
      h("div", {}, h("label", {}, "Mức độ được bốc"), h("div", { style: "display:flex;gap:12px;flex-wrap:wrap" }, ["NB", "TH", "VD", "VDC"].map((k) => h("label", { class: "chk" }, f.levels[k], k)))),
      h("label", { class: "chk full" }, f.show, "Cho học sinh xem đáp án và lời giải sau khi nộp"),
      h("div", { class: "full" }, h("button", { class: "btn", onclick: submitAssign }, "Giao đề")));
    async function submitAssign(e) {
      if (f.kind.value === "tags") { if (!bp.tags.length) return KT.toast("Chưa nhập ID câu hỏi nào.", "bad"); if (tagMatch && !(tagMatch.counts.MC + tagMatch.counts.TF + tagMatch.counts.SA)) return KT.toast("Không có câu nào khớp với ID đã nhập.", "bad"); }
      else if (!bp.lessons.length) return KT.toast("Chưa chọn bài nào.", "bad");
      const levels = Object.entries(f.levels).filter(([, x]) => x.checked).map(([k]) => k);
      const b2 = Object.assign({}, bp, { title: f.title.value.trim() || bp.title, counts: { MC: +f.mc.value || 0, TF: +f.tf.value || 0, SA: +f.sa.value || 0 }, minutes: +f.min.value || bp.minutes,
        levels: levels.length === 4 ? null : levels });
      if (!b2.counts.MC && !b2.counts.TF && !b2.counts.SA) return KT.toast("Đề chưa có câu nào.", "bad");
      e.target.disabled = true;
      try {
        const r = await T("t_assign", { p_class: +f.cls.value, p_title: b2.title, p_kind: b2.kind, p_grade: b2.grade, p_blueprint: b2,
          p_opens: new Date(f.open.value).toISOString(), p_closes: new Date(f.close.value).toISOString(), p_max: +f.max.value || 1, p_show: f.show.checked });
        KT.toast("Đã giao đề cho lớp", "ok");
        ov = await T("t_overview"); tab = "monitor"; store.set("kt_t_tab", tab); curAsg = r.id; render();
      } catch (ex) { fail(ex); e.target.disabled = false; }
    }
    el.append(h("div", { class: "panel" }, h("h3", {}, "Giao đề kiểm tra"), h("p", { class: "sub" }, "Mỗi học sinh nhận một đề bốc ngẫu nhiên riêng theo cấu trúc này, cùng số câu từng phần, rải đều các bài và mức độ; thứ tự phương án được xáo."), form));
    fillSub();
  }

  /* ---------------- LỚP & HỌC SINH ---------------- */
  async function pendingPanel(el) {
    let d;
    try { d = await T("t_pending"); } catch (e) { fail(e); return; }
    const box = h("div", { class: "panel pending" });
    const sw = h("input", { type: "checkbox", id: "regOpen", checked: d.open, onchange: async () => {
      try { await T("t_register_open", { p_open: sw.checked }); KT.toast(sw.checked ? "Đã mở cho học sinh tự đăng ký" : "Đã tạm đóng đăng ký", "ok"); } catch (e) { fail(e); sw.checked = !sw.checked; }
    } });
    box.append(h("div", { class: "review-t" }, h("h3", { style: "margin:0" }, "Học sinh tự đăng ký" + (d.items.length ? " – chờ duyệt (" + d.items.length + ")" : "")), h("span", { class: "sp" }),
      h("label", { class: "chk" }, sw, "Cho phép học sinh tự đăng ký trên trang đăng nhập")));
    if (!d.items.length) { box.append(h("p", { class: "sub", style: "margin:8px 0 0" }, d.open ? "Chưa có đăng ký mới. Học sinh bấm “Đăng ký” ở trang đăng nhập, tài khoản chỉ dùng được sau khi thầy duyệt ở đây." : "Đăng ký đang tạm đóng.")); el.append(box); return; }
    const act = async (ids, ok, cls) => {
      try { const r = await T("t_approve", { p_ids: ids, p_approve: ok, p_class: cls || null }); KT.toast((ok ? "Đã duyệt " : "Đã từ chối ") + r.n + " học sinh", "ok"); ov = await T("t_overview"); render(); } catch (e) { fail(e); }
    };
    const sels = {};
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Mã", "Họ tên", "Xếp vào lớp", "Điện thoại", "Lời nhắn", "Đăng ký lúc", ""].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    d.items.forEach((x) => {
      const cur0 = ov.classes.find((c) => c.name === x.class);
      const sel = sels[x.id] = h("select", { class: "mini" }, h("option", { value: "" }, "— chọn lớp —"), ov.classes.map((c) => h("option", { value: c.id, selected: cur0 && c.id === cur0.id }, c.name)));
      tbody.append(h("tr", {}, h("td", { class: "mono" }, x.code), h("td", {}, h("b", {}, x.name)), h("td", {}, sel),
        h("td", {}, x.phone ? h("a", { href: "tel:" + x.phone }, x.phone) : "–"), h("td", { style: "white-space:normal;max-width:240px" }, x.note || "–"), h("td", {}, KT.dt(x.at)),
        h("td", {}, h("div", { style: "display:flex;gap:6px" },
          h("button", { class: "btn sm", onclick: () => { if (!sel.value) return KT.toast("Chọn lớp cho em này trước khi duyệt.", "bad"); act([x.id], true, +sel.value); } }, "Duyệt"),
          h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Từ chối đăng ký?", "Xoá đăng ký của <b>" + esc(x.name) + "</b>. Em có thể đăng ký lại sau.", "Từ chối", () => act([x.id], false)) }, "Từ chối")))));
    });
    tb.append(tbody);
    box.append(h("div", { class: "tbl-wrap", style: "margin-top:12px" }, tb));
    box.append(h("div", { style: "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap" }, h("button", { class: "btn sm", onclick: async () => {
      const groups = {};
      d.items.forEach((x) => { const v = sels[x.id].value; if (v) (groups[v] = groups[v] || []).push(x.id); });
      if (!Object.keys(groups).length) return KT.toast("Chưa em nào được chọn lớp.", "bad");
      for (const [c, ids] of Object.entries(groups)) await T("t_approve", { p_ids: ids, p_approve: true, p_class: +c }).catch(fail);
      KT.toast("Đã duyệt các em đã chọn lớp", "ok"); ov = await T("t_overview"); render();
    } }, "Duyệt tất cả (đã chọn lớp)")));
    el.append(box);
  }
  async function tabClasses(el) {
    await pendingPanel(el);
    const name = h("input", { id: "cName", placeholder: "VD: 12A1" });
    const gr = h("select", { id: "cGr" }, [10, 11, 12, 6, 7, 8, 9].map((g) => h("option", { value: g }, "Khối " + g)));
    el.append(h("div", { class: "panel" }, h("h3", {}, "Tạo lớp mới"), h("div", { class: "form", style: "align-items:end" },
      h("div", {}, h("label", { for: "cName" }, "Tên lớp"), name), h("div", {}, h("label", { for: "cGr" }, "Khối"), gr),
      h("div", {}, h("button", { class: "btn", onclick: async () => { if (!name.value.trim()) return; try { const r = await T("t_class_save", { p_name: name.value, p_grade: +gr.value }); curClass = r.id; store.set("kt_t_class", r.id); ov = await T("t_overview"); render(); } catch (e) { fail(e); } } }, "Tạo lớp")))));
    if (!ov.classes.length) return;
    if (!ov.classes.some((c) => c.id === curClass)) curClass = ov.classes[0].id;
    const sel = h("select", { id: "cSel", onchange: () => { curClass = +sel.value; store.set("kt_t_class", curClass); render(); } }, ov.classes.map((c) => h("option", { value: c.id, selected: c.id === curClass }, c.name + " (" + c.n + " HS)")));
    const box = h("div", { class: "panel", style: "margin-top:16px" });
    el.append(box);
    box.append(h("div", { class: "review-t" }, h("h3", { style: "margin:0" }, "Danh sách lớp"), sel, h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá lớp?", "Xoá lớp, toàn bộ học sinh, bài giao và bài làm của lớp này.", "Xoá lớp", async () => { await T("t_class_delete", { p_id: curClass }).catch(fail); ov = await T("t_overview"); render(); }) }, "Xoá lớp")));
    let sts = [];
    try { sts = await T("t_students", { p_class: curClass }); } catch (e) { fail(e); return; }
    const cname = ov.classes.find((c) => c.id === curClass).name;
    const ta = h("textarea", { id: "names", placeholder: "Dán danh sách họ tên từ Excel, mỗi dòng một học sinh" });
    box.append(h("div", { class: "form", style: "margin-top:12px" }, h("div", { class: "full" }, h("label", { for: "names" }, "Thêm học sinh"), ta),
      h("div", {}, h("button", { class: "btn", onclick: async () => {
        const names = ta.value.split(/\r?\n/).map((x) => x.split("\t").filter((y) => y.trim() && !/^\d+$/.test(y.trim()))[0] || "").map((x) => x.trim()).filter(Boolean);
        if (!names.length) return;
        try { await T("t_students_add", { p_class: curClass, p_names: names }); KT.toast("Đã thêm " + names.length + " học sinh", "ok"); ov = await T("t_overview"); render(); } catch (e) { fail(e); }
      } }, "Thêm vào lớp"))));
    if (!sts.length) { box.append(h("div", { class: "empty" }, "Lớp chưa có học sinh.")); return; }
    box.append(h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 10px" },
      h("button", { class: "btn sm", onclick: () => printCards(cname, sts) }, "In phiếu đăng nhập"),
      h("button", { class: "btn ghost sm", onclick: () => download("DanhSach_" + cname + ".csv", [["Mã HS", "Họ tên", "PIN"]].concat(sts.map((s) => [s.code, s.name, "'" + s.pin]))) }, "Xuất danh sách (Excel)")));
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Mã HS", "Họ tên", "Cấp", "PIN", "Trạng thái", ""].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    const act = async (s, args, msg) => { try { await T("t_student_update", Object.assign({ p_id: s.id }, args)); if (msg) KT.toast(msg, "ok"); render(); } catch (e) { fail(e); } };
    sts.forEach((s) => tbody.append(h("tr", {}, h("td", { class: "mono" }, s.code), h("td", {}, s.name),
      h("td", {}, h("span", { class: "lvcell" }, KT.levelBadge(KT.lvOf(s.xp), "xs"), KT.titleOf(KT.lvOf(s.xp)) + " · " + KT.num(s.xp) + " KN", s.hide_rank ? h("span", { class: "pill", title: "Không hiện trên bảng vinh danh" }, "Ẩn") : null)),
      h("td", { class: "mono" }, s.pin),
      h("td", {}, s.failed >= 10 ? h("span", { class: "pill bad" }, "Bị khoá") : !s.active ? h("span", { class: "pill" }, "Ngừng") : h("span", { class: "pill ok" }, "Hoạt động")),
      h("td", {}, h("div", { style: "display:flex;gap:6px" },
        s.failed >= 10 ? h("button", { class: "btn ghost sm", onclick: () => act(s, { p_unlock: true }, "Đã mở khoá") }, "Mở khoá") : null,
        h("button", { class: "btn ghost sm", onclick: () => act(s, { p_reset_pin: true }, "Đã đổi PIN") }, "Đổi PIN"),
        h("button", { class: "btn ghost sm", title: "Hiện/ẩn tên em này trên bảng vinh danh", onclick: () => act(s, { p_hide_rank: !s.hide_rank }, s.hide_rank ? "Đã hiện lại trên bảng vinh danh" : "Đã ẩn khỏi bảng vinh danh") }, s.hide_rank ? "Hiện vinh danh" : "Ẩn vinh danh"),
        h("button", { class: "btn ghost sm", onclick: () => { const n = prompt("Sửa họ tên", s.name); if (n) act(s, { p_name: n }); } }, "Sửa tên"),
        h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá học sinh?", "Xoá <b>" + esc(s.name) + "</b> và các bài làm của em này.", "Xoá", () => act(s, { p_delete: true })) }, "Xoá"))))));
    tb.append(tbody);
    box.append(h("div", { class: "tbl-wrap" }, tb));
  }
  function printCards(cname, sts) {
    const url = location.href.replace(/giaovien\.html.*$/, "");
    const wnd = window.open("", "_blank");
    if (!wnd) return KT.toast("Trình duyệt chặn cửa sổ in. Cho phép pop-up rồi thử lại.", "bad");
    wnd.document.write('<!doctype html><meta charset="utf-8"><title>Phiếu đăng nhập ' + esc(cname) + '</title><style>body{font-family:Segoe UI,Arial,sans-serif;margin:16px;color:#000}h2{margin:0 0 10px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.c{border:1px dashed #888;border-radius:8px;padding:10px;font-size:13px;break-inside:avoid}.c b{font-size:15px}.k{font-family:Consolas,monospace;font-size:16px}</style>' +
      "<h2>" + esc(KT.BRAND.name) + " – Phiếu đăng nhập lớp " + esc(cname) + "</h2><p style=\"margin:-4px 0 12px\">" + esc(KT.BRAND.teacher) + (KT.BRAND.phone ? " – ĐT " + esc(KT.phoneFmt(KT.BRAND.phone)) : "") + "</p><div class=g>" + sts.map((s) => '<div class=c><b>' + esc(s.name) + '</b><br>Trang web: ' + esc(url) + '<br>Mã HS: <span class=k>' + esc(s.code) + '</span><br>PIN: <span class=k>' + esc(s.pin) + "</span></div>").join("") + "</div><script>print()<\/script>");
    wnd.document.close();
  }

  /* ---------------- NGÂN HÀNG ---------------- */
  function tabBank(el) {
    const bank = ov.bank || [];
    const tot = { MC: 0, TF: 0, SA: 0 }; bank.forEach((b) => (tot[b.t] += b.n));
    el.append(h("div", { class: "kpis" }, ["MC", "TF", "SA"].map((t) => h("div", { class: "kpi" }, h("div", { class: "n" }, String(tot[t])), h("div", { class: "l" }, TYPE_SHORT[t]))),
      h("div", { class: "kpi" }, h("div", { class: "n" }, String(ov.n_figs)), h("div", { class: "l" }, "Hình vẽ"))));
    // tải lên
    const fb = h("input", { type: "file", id: "fBank", accept: ".js,.json" }), ff = h("input", { type: "file", id: "fFigs", accept: ".js,.json" });
    const deact = h("input", { type: "checkbox", id: "fDeact" });
    const prog = h("div", { class: "progress hidden" }, h("i", {})), msg = h("p", { class: "sub" });
    el.append(h("div", { class: "panel", style: "margin-top:16px" }, h("h3", {}, "Tải ngân hàng câu hỏi lên"),
      h("p", { class: "sub" }, "Chạy tools\\CAP_NHAT_DU_LIEU.bat trên máy để tạo data\\bank.js và data\\figs.js từ các file LaTeX, rồi chọn hai file đó ở đây. Câu đã có (cùng ID) sẽ được cập nhật, câu mới được thêm."),
      h("div", { class: "form", style: "align-items:end" }, h("div", {}, h("label", { for: "fBank" }, "File bank.js"), fb), h("div", {}, h("label", { for: "fFigs" }, "File figs.js (hình vẽ)"), ff),
        h("label", { class: "chk full" }, deact, "Ẩn các câu đang có trên máy chủ nhưng không còn trong file bank.js (chỉ chọn khi file chứa đủ cả 3 khối)"),
        h("div", {}, h("button", { class: "btn", onclick: async (e) => {
          if (!fb.files[0] && !ff.files[0]) return KT.toast("Chọn ít nhất một file.", "bad");
          e.target.disabled = true; prog.classList.remove("hidden");
          try { await upload(fb.files[0], ff.files[0], deact.checked, (x, s) => { prog.firstChild.style.width = pct(x) + "%"; msg.textContent = s; }); KT.toast("Đã tải lên xong", "ok"); ov = await T("t_overview"); render(); }
          catch (ex) { fail(ex); msg.textContent = "Lỗi: " + ex.message; }
          e.target.disabled = false;
        } }, "Tải lên"))), prog, msg));
    // thống kê
    const tbl = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Bài", "Nhiều PA", "Đúng/Sai", "TL ngắn", "Tổng"].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    for (const g of [10, 11, 12]) {
      tbody.append(h("tr", {}, h("td", { colspan: 5, style: "background:var(--surface-2);font-weight:750" }, "Toán " + g)));
      KT.lessonsOf(g).forEach((key) => {
        const c = { MC: 0, TF: 0, SA: 0 }; bank.forEach((b) => { if (b.g + "-" + b.l === key) c[b.t] += b.n; });
        const n = c.MC + c.TF + c.SA;
        tbody.append(h("tr", {}, h("td", {}, KT.lessonName(key)), h("td", { class: "num" }, String(c.MC)), h("td", { class: "num" }, String(c.TF)), h("td", { class: "num" }, String(c.SA)),
          h("td", { class: "num" }, h("b", { style: "color:var(--" + (n >= 150 ? "ok" : n >= 30 ? "warn" : "bad") + ")" }, String(n)))));
      });
    }
    tbl.append(tbody);
    el.append(h("div", { class: "section-t" }, "Số câu theo bài (mục tiêu ~200 câu/bài)"), h("div", { class: "tbl-wrap" }, tbl));
  }
  const readJsVar = (text, name) => {
    const i = text.indexOf("window." + name + "=");
    if (i < 0) return null;
    let s = text.slice(i + name.length + 8);
    const nl = s.indexOf(";\n"); if (nl >= 0) s = s.slice(0, nl); else s = s.replace(/;\s*$/, "");
    return JSON.parse(s);
  };
  const dek = (k) => { const bin = atob(k); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[bin.length - 1 - i] = bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); };
  async function upload(fBank, fFigs, deact, onp) {
    let steps = 0, done = 0;
    let rows = [], figs = [];
    if (fBank) { const B = readJsVar(await fBank.text(), "BANK"); if (!B) throw new Error("File bank.js không đúng định dạng"); rows = B.map((q) => ({ id: q.id, g: q.g, l: q.l, lv: q.lv, lg: !!q.lg, t: q.t, q: q.q, o: q.o, s: q.s, src: q.src, tag: q.tag, k: dek(q.k) })); }
    if (fFigs) { const F = readJsVar(await fFigs.text(), "FIGS"); if (!F) throw new Error("File figs.js không đúng định dạng"); figs = Object.entries(F).map(([id, svg]) => ({ id, svg })); }
    const qb = [], fbt = [];
    for (let i = 0; i < rows.length; i += 250) qb.push(rows.slice(i, i + 250));
    let cur = []; let size = 0;
    for (const f of figs) { cur.push(f); size += f.svg.length; if (size > 600000) { fbt.push(cur); cur = []; size = 0; } }
    if (cur.length) fbt.push(cur);
    steps = qb.length + fbt.length + (deact && rows.length ? 1 : 0);
    for (const b of fbt) { await T("t_import_figs", { p_rows: b }); onp(++done / steps, "Hình vẽ: " + done + "/" + fbt.length + " gói"); }
    let nq = 0;
    for (const b of qb) { await T("t_import_questions", { p_rows: b }); nq += b.length; onp(++done / steps, "Câu hỏi: " + nq + "/" + rows.length); }
    if (deact && rows.length) { const r = await T("t_deactivate_except", { p_ids: rows.map((x) => x.id) }); onp(1, "Đã ẩn " + r.n + " câu không còn trong file."); }
    onp(1, "Hoàn tất: " + rows.length + " câu hỏi, " + figs.length + " hình.");
  }

  /* ---------------- khởi động ---------------- */
  if (api.teacher()) load(); else renderLogin();
})();
