/* Trang học sinh */
(() => {
  "use strict";
  const { h, esc, fmt, pct, store, api, LV, TYPES, TYPE_SHORT, PART, CUR, LESSON, romans } = KT;
  const app = document.getElementById("app");
  const who = document.getElementById("who");
  KT.initTheme(document.getElementById("themeBtn"));

  let sess = store.get("kt_stu", null);       // {token,name,code,class}
  let vids = null;
  const loadVids = () => vids ? Promise.resolve(vids) : api.rpc("videos_list", {}).then((v) => (vids = v || [])).catch(() => (vids = []));
  // chỗ đặt nút video (điền sau khi tải danh sách video)
  const vSlot = (keys, heading, cls) => { const s = h("span", { class: "vslot" }); loadVids().then((v) => { const b = KT.videoBtn(KT.videosFor(v, keys), heading, cls); if (b) s.append(b); }); return s; };
  let dstats = null;
  let home = null, stats = null, lboard = null, fameTab = "all", grade = store.get("kt_grade", null);
  let cur = null;                              // bài đang làm (payload)
  let timerId = null, saveTimer = null, clockSkew = 0, dirty = new Set(), saving = false;
  let lastCtx = null;                          // ngữ cảnh để "làm đề khác cùng loại"

  const rpc = (fn, args) => api.rpc(fn, Object.assign({ p_token: sess && sess.token }, args || {}));
  function fail(e) {
    if (/SESSION_EXPIRED/.test(e.message)) { logout(true); return; }
    KT.toast(e.message || String(e), "bad");
  }
  function logout(expired) {
    if (sess) api.rpc("student_logout", { p_token: sess.token }).catch(() => { });
    sess = null; gateOk = false; store.del("kt_stu"); stopTimers(); if (window.KHCalc) window.KHCalc.close(); renderLogin(expired ? "Phiên đăng nhập đã hết, em đăng nhập lại nhé." : "");
  }
  let beatId = null, examEnd = 0;
  function stopTimers() { stopLive(); clearInterval(timerId); timerId = null; clearTimeout(saveTimer); clearInterval(beatId); beatId = null; guardOff(); }

  /* ---------------- chống gian lận: ghi lại việc rời trang, chặn sao chép đề ---------------- */
  let guardOff = () => { };
  function startGuard(guardEl) {
    guardOff();
    const aid = cur.id, key = "kt_focus_" + aid;
    const st = Object.assign({ l: 0, a: 0, c: 0 }, store.get(key, {}) || {});
    let leftAt = null, sendT = null, lastToast = 0;
    const save = () => store.set(key, st);
    const send = (now) => {
      clearTimeout(sendT);
      const go = () => rpc("report_focus", { p_attempt: aid, p_leaves: st.l, p_away_s: Math.round(st.a), p_copy: st.c }).catch(() => { });
      if (now) go(); else sendT = setTimeout(go, 400);
    };
    const show = () => {
      guardEl.textContent = st.l ? "Đã rời trang " + st.l + " lần" : "Hệ thống ghi lại việc rời trang";
      guardEl.className = "guard" + (st.l ? " on" : "");
    };
    const inField = (e) => e.target && e.target.closest && e.target.closest("input, textarea");
    const away = () => { if (leftAt == null) leftAt = Date.now(); };
    const back = () => {
      if (leftAt == null) return;
      const d = (Date.now() - leftAt) / 1000; leftAt = null;
      if (d < 2) return;                     // chớp màn hình, bấm nhầm: bỏ qua
      st.l++; st.a += d; save(); show(); send();
      KT.toast("Em vừa rời khỏi trang làm bài (lần " + st.l + "). Thầy sẽ thấy số lần này.", "bad");
    };
    const onVis = () => { if (document.visibilityState === "hidden") away(); else if (document.hasFocus()) back(); };
    const onBlur = () => away();
    const onFocus = () => { if (document.visibilityState === "visible") back(); };
    const tryCopy = (e) => {
      if (inField(e)) return;
      e.preventDefault();
      st.c++; save(); send();
      if (Date.now() - lastToast > 3000) { lastToast = Date.now(); KT.toast("Không được sao chép đề trong lúc làm bài.", "bad"); }
    };
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || inField(e)) return;
      const k = (e.key || "").toLowerCase();
      if (k === "c" || k === "x") tryCopy(e);
      else if (["a", "p", "s", "u"].includes(k)) e.preventDefault();
    };
    const noDrag = (e) => { if (!inField(e)) e.preventDefault(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur); window.addEventListener("focus", onFocus);
    document.addEventListener("copy", tryCopy); document.addEventListener("cut", tryCopy);
    document.addEventListener("contextmenu", tryCopy); document.addEventListener("keydown", onKey);
    document.addEventListener("dragstart", noDrag);
    document.body.classList.add("nocopy");
    show();
    if (st.l || st.c) send(true);
    guardOff = () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur); window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", tryCopy); document.removeEventListener("cut", tryCopy);
      document.removeEventListener("contextmenu", tryCopy); document.removeEventListener("keydown", onKey);
      document.removeEventListener("dragstart", noDrag);
      document.body.classList.remove("nocopy");
      if (sendT) { clearTimeout(sendT); send(true); }
      guardOff = () => { };
    };
  }
  const takeEnd = (r) => { if (r && r.ends_at && cur) { cur.ends_at = r.ends_at; examEnd = new Date(r.ends_at).getTime(); } };
  // hỏi máy chủ giờ hết hạn (thầy có thể vừa cộng giờ / gia hạn)
  async function beat() { if (!cur || cur.status !== "doing") return null; try { const r = await rpc("save_answers", { p_attempt: cur.id, p_answers: [] }); takeEnd(r); return r; } catch (e) { return null; } }
  function setWho() {
    who.innerHTML = "";
    document.querySelector(".top").classList.toggle("has-umenu", !!sess);
    if (!sess) return;
    const inExam = cur && cur.status === "doing";
    const I = home ? KT.levelInfo(home.xp) : null;
    const name = (home && home.student.name) || sess.name, cls = (home && home.student.class) || sess.class;
    const ini = String(name || "?").trim().split(/\s+/).slice(-1)[0].charAt(0).toUpperCase();
    // ô thả xuống dùng chung: mở/đóng bằng chuột, bàn phím, bấm ra ngoài hoặc Esc
    const dd = (btn, panel) => {
      const wrap = h("div", { class: "ddw" }, btn, panel);
      const set = (o) => { wrap.classList.toggle("open", o); btn.setAttribute("aria-expanded", String(o)); if (o) { const f = panel.querySelector("button, a"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30); } };
      btn.addEventListener("click", (e) => { e.stopPropagation(); const o = !wrap.classList.contains("open"); document.querySelectorAll(".ddw.open").forEach((x) => x !== wrap && x.classList.remove("open")); set(o); });
      panel.addEventListener("click", (e) => { if (e.target.closest("button, a")) set(false); });
      document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) set(false); });
      wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { set(false); btn.focus(); } });
      return wrap;
    };
    if (home && !inExam) {
      const items = todoItems();
      const bell = h("button", { type: "button", class: "iconbtn bellbtn", "aria-label": "Việc cần làm" + (items.length ? ", " + items.length + " việc" : ""), "aria-expanded": "false", "aria-haspopup": "true" },
        svg("bell"), items.length ? h("i", { class: "bdg" }, String(items.length)) : null);
      const pn = h("div", { class: "dd dd-bell", role: "menu" }, h("div", { class: "dd-h" }, items.length ? "Em có " + items.length + " việc cần làm" : "Không có việc nào cần làm"),
        items.length ? items.slice(0, 6).map((it) => h("button", { type: "button", class: "dd-i", role: "menuitem", onclick: () => leave(it.go) },
          h("span", { class: "dd-ic m-" + it.k, "aria-hidden": "true" }, MIC[it.k] || "•"), h("span", { class: "dd-t" }, h("b", {}, it.t), h("small", {}, it.st + ". " + it.s))))
          : h("p", { class: "dd-empty" }, "Hôm nay em đã xong hết việc."),
        h("button", { type: "button", class: "dd-more", onclick: () => go("home") }, "Xem trang chủ"));
      who.append(dd(bell, pn));
    }
    if (window.KHCalc) who.append(window.KHCalc.button());
    const av = h("button", { type: "button", class: "avbtn", "aria-label": "Tài khoản của " + name, "aria-expanded": "false", "aria-haspopup": "true" },
      h("span", { class: "av pt" + (I ? KT.tierOf(I.L) : 0) }, ini), h("span", { class: "av-n" }, h("b", {}, name), h("small", {}, I ? "Cấp " + I.L + ", " + I.title : cls ? "Lớp " + cls : sess.code)), svg("chev", "chev"));
    const out = () => { if (inExam) KT.confirm("Đăng xuất?", "Bài đang làm đã được lưu trên máy chủ, đăng nhập lại để làm tiếp.", "Đăng xuất", () => logout()); else logout(); };
    const mi = (ic, t, fn) => h("button", { type: "button", class: "dd-i", role: "menuitem", onclick: fn }, svg(ic), h("span", { class: "dd-t" }, h("b", {}, t)));
    const um = h("div", { class: "dd dd-user", role: "menu" },
      h("div", { class: "dd-prof" }, h("span", { class: "av lg pt" + (I ? KT.tierOf(I.L) : 0) }, ini), h("div", {}, h("b", {}, name), h("small", {}, (cls ? "Lớp " + cls + ", mã " : "Mã ") + sess.code), I ? h("small", {}, "Cấp " + I.L + ", " + I.title + ", " + KT.num(I.xp) + " KN") : null)),
      inExam ? null : [mi("achieve", "Thành tích của em", () => go("achieve")), mi("book", "Sổ câu sai", () => go("book")), mi("tests", "Bài kiểm tra", () => go("tests"))],
      window.KHCalc ? mi("calc", "Máy tính cầm tay", () => window.KHCalc.open()) : null,
      inExam || !nbList.length ? null : mi("book", "Sổ tay kiến thức", () => go("notes")),
      inExam || !credit ? null : mi("learn", "Điểm làm bài: còn " + credit.credits, creditModal),
      inExam ? null : mi("tests", "Học phí" + (feeOwed().length ? " (" + feeOwed().length + " tháng chưa xong)" : ""), feeModal),
      mi("moon", "Đổi giao diện sáng/tối", () => document.getElementById("themeBtn").click()),
      h("div", { class: "dd-sep" }), mi("out", "Đăng xuất", out));
    who.append(dd(av, um));
  }
  document.getElementById("goHome").addEventListener("click", () => { if (cur && cur.status === "doing") { KT.confirm("Rời bài đang làm?", "Bài làm được lưu trên máy chủ, em có thể quay lại làm tiếp (đồng hồ vẫn chạy).", "Về trang chủ", () => { flush(); renderHome(); }); } else if (sess) renderHome(); });

  /* ---------------- đăng nhập ---------------- */
  function renderLogin(msg) {
    cur = null; setWho(); app.innerHTML = "";
    const code = h("input", { id: "code", autocomplete: "username", placeholder: "VD: 12A1-07", autocapitalize: "characters", required: true });
    const pin = h("input", { id: "pin", type: "password", inputmode: "numeric", autocomplete: "current-password", placeholder: "6 chữ số", required: true });
    const err = h("div", { class: "note bad" + (msg ? "" : " hidden") }, msg || "");
    const btn = h("button", { class: "btn", type: "submit" }, "Đăng nhập");
    const form = h("form", { class: "login panel", onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; err.classList.add("hidden");
      try {
        const d = await api.rpc("student_login", { p_code: code.value, p_pin: pin.value });
        sess = d; store.set("kt_stu", d); renderHome();
      } catch (ex) { err.textContent = ex.message; err.classList.remove("hidden"); }
      btn.disabled = false;
    } },
      h("h1", {}, "Đăng nhập"),
      h("div", { class: "roles", role: "tablist", "aria-label": "Chọn vai trò" },
        h("button", { type: "button", class: "on", role: "tab", "aria-selected": "true" }, "Học sinh"),
        h("a", { href: "giaovien.html", role: "tab", "aria-selected": "false" }, "Giáo viên")),
      h("p", { class: "sub" }, "Nhập mã học sinh và mã PIN giáo viên phát cho em."),
      h("label", { for: "code" }, "Mã học sinh"), code, h("label", { for: "pin" }, "Mã PIN"), pin, err, btn,
      h("p", { class: "reg-link" }, "Chưa có tài khoản? ", h("button", { type: "button", class: "linkbtn", onclick: () => renderRegister() }, "Đăng ký")));
    const saved = store.get("kt_reg_code", null); if (saved && !code.value) code.value = saved;
    const fame = h("div", { class: "fame-public hidden" });
    app.append(h("section", { class: "wrap center" }, h("div", { class: "auth" }, KT.brandPanel("student"), form), fame));
    (code.value ? pin : code).focus();
    api.rpc("leaderboard", { p_limit: 5 }).then((lb) => {
      if (!lb.week || !lb.week.length) return;
      fame.append(h("h2", {}, "Bảng vàng tuần này"), KT.rankList(lb.week, "w"));
      fame.classList.remove("hidden");
    }).catch(() => { });
  }

  /* ---------------- tự đăng ký ---------------- */
  async function renderRegister() {
    cur = null; setWho(); app.innerHTML = ""; window.scrollTo(0, 0);
    const B = KT.BRAND;
    const back = h("p", { class: "reg-link" }, "Đã có tài khoản? ", h("button", { type: "button", class: "linkbtn", onclick: () => renderLogin() }, "Đăng nhập"));
    const shell = (inner) => { app.innerHTML = ""; app.append(h("section", { class: "wrap center" }, h("div", { class: "auth" }, KT.brandPanel("student"), inner))); };
    let info;
    try { info = await api.rpc("register_info", {}); } catch (e) { info = { open: false, classes: [], err: e.message }; }
    if (!info.open) {
      shell(h("div", { class: "login panel" }, h("h1", {}, "Đăng ký tài khoản"),
        h("p", { class: "sub" }, info.err || "Hiện thầy chưa mở đăng ký tài khoản mới."),
        B.phone ? h("p", {}, "Em liên hệ ", h("b", {}, B.teacher || "thầy"), " qua số ", h("a", { href: "tel:" + B.phone }, KT.phoneFmt(B.phone)), " để được cấp tài khoản.") : null, back));
      return;
    }
    const name = h("input", { id: "rName", autocomplete: "name", placeholder: "VD: Nguyễn Văn An", required: true, maxlength: 60 });
    const cls = h("select", { id: "rClass", required: true },
      h("option", { value: "", disabled: true, selected: true }, "— Chọn lớp em đang học ở trung tâm —"),
      info.classes.map((c) => h("option", { value: c.id }, c.name + (c.teacher && c.teacher !== "Thầy" ? " (" + c.teacher + ")" : ""))),
      h("option", { value: "none" }, "Chưa có lớp – thầy sẽ xếp lớp"));
    const pin = h("input", { id: "rPin", type: "password", inputmode: "numeric", autocomplete: "new-password", placeholder: "6 chữ số", required: true, maxlength: 6, pattern: "[0-9]{6}" });
    const pin2 = h("input", { id: "rPin2", type: "password", inputmode: "numeric", autocomplete: "new-password", placeholder: "Nhập lại 6 chữ số", required: true, maxlength: 6 });
    const phone = h("input", { id: "rPhone", type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "Không bắt buộc" });
    const note = h("input", { id: "rNote", placeholder: "VD: học ca tối thứ 3 – 5 (không bắt buộc)", maxlength: 200 });
    const err = h("div", { class: "note bad hidden" });
    const btn = h("button", { class: "btn", type: "submit" }, "Gửi đăng ký");
    const form = h("form", { class: "login panel", onsubmit: async (e) => {
      e.preventDefault(); err.classList.add("hidden");
      const bad = (m) => { err.textContent = m; err.classList.remove("hidden"); };
      if (!cls.value) return bad("Em chọn lớp nhé.");
      if (!/^[0-9]{6}$/.test(pin.value)) return bad("Mã PIN phải gồm đúng 6 chữ số.");
      if (pin.value !== pin2.value) return bad("Hai lần nhập mã PIN chưa giống nhau.");
      btn.disabled = true;
      try {
        const r = await api.rpc("student_register", { p_name: name.value, p_class: cls.value === "none" ? null : +cls.value, p_pin: pin.value, p_phone: phone.value || null, p_note: note.value || null });
        store.set("kt_reg_code", r.code);
        shell(h("div", { class: "login panel regdone" },
          h("h1", {}, "Đã gửi đăng ký!"),
          h("p", { class: "sub" }, "Mã học sinh của em là"),
          h("div", { class: "regcode" }, r.code),
          h("p", {}, "Em ghi lại mã này. Khi ", B.teacher || "thầy", " duyệt xong, em đăng nhập bằng mã này và mã PIN em vừa đặt."),
          B.phone ? h("p", { class: "sub" }, "Muốn được duyệt nhanh, em nhắn ", B.teacher || "thầy", " qua số ", h("a", { href: "tel:" + B.phone }, KT.phoneFmt(B.phone)), ".") : null,
          h("button", { class: "btn", type: "button", onclick: () => renderLogin() }, "Về trang đăng nhập")));
      } catch (ex) { bad(ex.message); btn.disabled = false; }
    } },
      h("h1", {}, "Đăng ký tài khoản"),
      h("p", { class: "sub" }, "Điền thông tin bên dưới. Tài khoản dùng được sau khi thầy duyệt."),
      h("label", { for: "rName" }, "Họ và tên"), name,
      h("label", { for: "rClass" }, "Lớp"), cls,
      h("div", { class: "two" }, h("div", {}, h("label", { for: "rPin" }, "Tự đặt mã PIN"), pin), h("div", {}, h("label", { for: "rPin2" }, "Nhập lại mã PIN"), pin2)),
      h("label", { for: "rPhone" }, "Số điện thoại của em hoặc phụ huynh"), phone,
      h("label", { for: "rNote" }, "Lời nhắn cho thầy"), note,
      err, btn, back);
    shell(form);
    name.focus();
  }

  /* ---------------- khu học sinh: 5 mục (Trang chủ, Học tập, Bài kiểm tra, Sổ câu sai, Thành tích) ---------------- */
  let view = "home", homeAt = 0, liveProm = null;
  const NAV = [["home", "Trang chủ"], ["learn", "Học tập"], ["tests", "Bài kiểm tra"], ["book", "Sổ câu sai"], ["achieve", "Thành tích"], ["game", "Linh thú"]];
  const SV = {
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/>',
    learn: '<path d="M3.5 5.5h6A2.5 2.5 0 0 1 12 8v12a2 2 0 0 0-2-2H3.5z"/><path d="M20.5 5.5h-6A2.5 2.5 0 0 0 12 8v12a2 2 0 0 1 2-2h6.5z"/>',
    tests: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
    book: '<path d="M6 3.5h10.5A2.5 2.5 0 0 1 19 6v14.5H7.5A2.5 2.5 0 0 1 5 18V4.5a1 1 0 0 1 1-1z"/><path d="M5 18a2.5 2.5 0 0 1 2.5-2.5H19"/><path d="m9.5 7.5 4 4m0-4-4 4"/>',
    achieve: '<path d="M8 3.5h8V9a4 4 0 0 1-8 0z"/><path d="M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10M8 5H4.5v1.5A3.5 3.5 0 0 0 8 10"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5"/>',
    game: '<path d="M12 20c-3.6 0-6.5-2-6.5-4.6 0-2.2 2.4-4.4 6.5-4.4s6.5 2.2 6.5 4.4C18.5 18 15.6 20 12 20z"/><circle cx="6" cy="8.5" r="2"/><circle cx="18" cy="8.5" r="2"/><circle cx="9.5" cy="5" r="2"/><circle cx="14.5" cy="5" r="2"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    chev: '<path d="m7 10 5 5 5-5"/>', out: '<path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8 6h8v3H8z"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  };
  const svg = (k, cls) => h("span", { class: "si" + (cls ? " " + cls : ""), "aria-hidden": "true", html: '<svg viewBox="0 0 24 24">' + SV[k] + "</svg>" });
  const topEl = document.querySelector(".top");
  const snav = h("nav", { class: "snav", "aria-label": "Mục chính" });
  const bnav = h("nav", { class: "bnav", "aria-label": "Mục chính" });
  topEl.querySelector(".wrap").insertBefore(snav, topEl.querySelector(".sp"));
  document.body.append(bnav);
  // đang làm bài thì hỏi trước khi rời trang
  const leave = (fn) => { if (cur && cur.status === "doing") KT.confirm("Rời bài đang làm?", "Bài làm được lưu trên máy chủ, em có thể quay lại làm tiếp (đồng hồ vẫn chạy).", "Rời bài", () => { flush(); fn(); }); else fn(); };
  const go = (k) => leave(() => renderHome(k, { cache: true }));
  function drawNav() {
    const due = home && home.review ? home.review.due || 0 : 0;
    [snav, bnav].forEach((nv) => {
      nv.innerHTML = "";
      NAV.forEach(([k, l]) => nv.append(h("a", { href: "#" + k, class: k === view ? "on" : "", "aria-current": k === view ? "page" : null,
        onclick: (e) => { e.preventDefault(); go(k); } }, svg(k), h("span", {}, l), k === "book" && due ? h("i", { class: "nbdg", "aria-label": due + " câu đến hạn" }, String(due > 99 ? "99+" : due)) : null)));
    });
  }
  new MutationObserver(() => document.body.classList.toggle("has-nav", !!(sess && app.querySelector(":scope > .view")))).observe(app, { childList: true });

  async function renderHome(v, opt) {
    view = typeof v === "string" && (NAV.some(([k]) => k === v) || v === "notes") ? v : "home";
    stopTimers(); cur = null; window.scrollTo(0, 0);
    const cached = opt && opt.cache && home && Date.now() - homeAt < 60000;
    if (!cached) {
      setWho();
      app.innerHTML = ""; app.append(skeleton());
      try {
        [home, stats, lboard] = await Promise.all([rpc("student_home"), stats ? Promise.resolve(stats) : api.rpc("bank_stats", {}), api.rpc("leaderboard", { p_limit: 50, p_token: sess.token }).catch(() => null), loadVids(),
          dstats ? null : api.rpc("dgnl_stats", {}).then((d) => (dstats = d || {})).catch(() => (dstats = {})),
          rpc("fee_status").then((f) => (fees = (f && f.rows) || [])).catch(() => (fees = [])),
          rpc("my_credits").then((c) => (credit = c)).catch(() => (credit = null)),
          rpc("nb_list").then((l) => (nbList = l || [])).catch(() => (nbList = [])),
          rpc("nb_ticker").then((l) => (nbTick = l || [])).catch(() => (nbTick = []))]);
        clockSkew = new Date(home.server_now).getTime() - Date.now();
        if (grade == null || !CUR[grade]) grade = KT.guessGrade(home.student.class) || (CUR[10] ? 10 : KT.GRADES[0]);
        homeAt = Date.now(); liveProm = rpc("live_list").catch(() => []);
      } catch (e) { app.innerHTML = ""; fail(e); app.append(h("div", { class: "wrap view empty-state" }, h("h2", {}, "Không tải được dữ liệu"), h("p", {}, "Kiểm tra kết nối mạng rồi thử lại."), h("button", { class: "btn", onclick: () => renderHome(view) }, "Thử lại"))); return; }
    }
    setWho(); drawNav();
    if (!cached && !gateOk) rpc("gate_get").then((g) => { if (g && g.need) showGate(g); else gateOk = true; }).catch(() => { });
    try { history.replaceState(null, "", "#" + view); } catch (e) { }
    app.innerHTML = "";
    const w = h("section", { class: "wrap view v-" + view });
    ({ home: viewHome, learn: viewLearn, tests: viewTests, book: viewBook, achieve: viewAchieve, game: viewGame, notes: viewNotes })[view](w);
    if (view !== "notes") { const tk = nbTicker(); if (tk) app.append(tk); }
    app.append(w);
    KT.typeset(app);
    if (!cached) setTimeout(celebrate, 500);
  }
  function skeleton() {
    const b = (cls) => h("div", { class: "skel " + (cls || "") });
    return h("div", { class: "wrap view-skel", "aria-busy": "true", "aria-label": "Đang tải" }, b("sk-hero"), h("div", { class: "sk-row" }, b(), b(), b()), b("sk-wide"));
  }
  const secHead = (t, sub, act) => h("div", { class: "sec-h" }, h("div", {}, h("h2", {}, t), sub ? h("p", {}, sub) : null), act || null);
  const linkBtn = (t, k) => h("button", { class: "btn ghost sm", onclick: () => go(k) }, t);
  const firstName = () => String(home.student.name || "").trim().split(/\s+/).slice(-1)[0];

  // ngày học trong tuần này (thứ Hai → Chủ nhật), tính từ các bài đã nộp
  function weekDays() {
    const t = new Date(), dow = (t.getDay() + 6) % 7, mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow);
    const on = new Set((home.history || []).map((r) => new Date(r.submitted_at).toDateString()));
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); return { d, on: on.has(d.toDateString()), today: i === dow, future: i > dow }; });
  }
  const WEEK_GOAL = 5;
  function weekGoal(days) {
    const n = days.filter((x) => x.on).length, lab = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    return h("div", { class: "wgoal" },
      h("div", { class: "wg-h" }, h("b", {}, "Mục tiêu tuần: học " + WEEK_GOAL + " ngày"), h("span", {}, Math.min(n, WEEK_GOAL) + "/" + WEEK_GOAL + (n >= WEEK_GOAL ? ", đã đạt" : ""))),
      h("ol", { class: "wg-days" }, days.map((x, i) => h("li", { class: (x.on ? "on" : "") + (x.today ? " is-today" : "") + (x.future ? " fut" : ""), title: x.d.toLocaleDateString("vi-VN") + (x.on ? ": có học" : "") },
        h("span", {}, lab[i]), h("i", { "aria-hidden": "true" }, x.on ? svg("check") : null)))));
  }

  /* ----- Trang chủ: bảng hồ sơ học sinh ----- */
  function viewHome(w) {
    w.classList.add("dash");
    const st = home.student, I = KT.levelInfo(home.xp), tier = KT.tierOf(I.L), rk = home.rank || {}, items = todoItems();
    const ini = String(st.name || "?").trim().split(/\s+/).slice(-1)[0].charAt(0).toUpperCase();
    const ds = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" });
    const dueN = (home.review || {}).due || 0, openN = (home.assignments || []).filter((a) => ["todo", "doing", "rem"].includes(tStatus(a))).length;
    // cột hồ sơ bên trái
    const link = (ic, t, n, fn) => h("button", { type: "button", class: "ds-link", onclick: fn }, svg(ic), h("span", {}, t), n ? h("b", { class: "ds-n" }, String(n > 99 ? "99+" : n)) : null);
    const ms = home.mission, msDone = ms && ms.status === "done";
    const side = h("aside", { class: "ds-side" },
      h("div", { class: "ds-prof" },
        h("div", { class: "ds-av pt" + tier, style: "--p:" + Math.round(I.pct * 100) }, h("span", {}, ini), h("i", { class: "ds-lv", title: "Cấp " + I.L }, String(I.L))),
        h("h2", {}, st.name), h("p", { class: "ds-title" }, "Cấp " + I.L + ", " + I.title),
        h("p", { class: "ds-meta" }, (st.class ? "Lớp " + st.class + ", " : "") + "mã " + st.code),
        h("div", { class: "ds-mini" },
          h("div", {}, h("b", { "data-count": home.xp }, KT.num(home.xp)), h("span", {}, "KN")),
          h("div", {}, h("b", {}, String(home.streak || 0)), h("span", {}, "ngày liên tiếp")),
          h("div", {}, h("b", {}, rk.all_rank ? "#" + rk.all_rank : "–"), h("span", {}, "xếp hạng")))),
      KT.game ? (() => { const el = h("div", { class: "pet" }); KT.game.pet(el, { rpc, go }); return el; })() : null,
      h("nav", { class: "ds-links", "aria-label": "Lối tắt" },
        link("tests", "Bài kiểm tra", openN, () => go("tests")),
        link("book", "Sổ câu sai", dueN, () => go("book")),
        link("achieve", "Bảng vinh danh", 0, () => go("achieve")),
        link("learn", "Tự luyện", 0, () => go("learn")),
        window.KHCalc ? link("calc", "Máy tính cầm tay", 0, () => window.KHCalc.open()) : null),
      h("div", { class: "ds-promo" + (msDone ? " done" : "") },
        h("span", { class: "ds-promo-ic", "aria-hidden": "true" }, msDone ? "✓" : "★"),
        h("b", {}, msDone ? "Đã xong nhiệm vụ hôm nay" : "Nhiệm vụ hôm nay"),
        h("p", {}, msDone ? "Hẹn em ngày mai để giữ chuỗi " + (home.streak || 0) + " ngày học." : "Khoảng 12 câu trong 15 phút, thưởng thêm 30 KN."),
        h("button", { class: "btn sm " + (msDone ? "ghost" : "acc"), onclick: msDone ? () => viewAttempt(ms.id) : startMission }, msDone ? "Xem kết quả" : ms ? "Làm tiếp" : "Bắt đầu")));

    // ô tiến độ cấp độ (vòng tròn)
    const R = 52, Cc = 2 * Math.PI * R, pctTxt = Math.round(I.pct * 100);
    const ring = h("div", { class: "ring", html: '<svg viewBox="0 0 128 128" aria-hidden="true"><defs><linearGradient id="rgG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cf2"/><stop offset="1" stop-color="#4527a0"/></linearGradient></defs>'
      + '<circle class="rg-bg" cx="64" cy="64" r="' + R + '"/><circle class="rg-fg" cx="64" cy="64" r="' + R + '" stroke="url(#rgG)" stroke-dasharray="' + Cc.toFixed(1) + '" stroke-dashoffset="' + Cc.toFixed(1) + '" style="--off:' + (Cc * (1 - I.pct)).toFixed(1) + '"/></svg>' },
      h("div", { class: "rg-tx" }, h("b", { "data-count": pctTxt }, String(pctTxt)), h("span", {}, "%")));
    const lvCard = h("section", { class: "dcard d-level", role: "button", tabindex: "0", onclick: () => titleJourney(), onkeydown: (e) => { if (e.key === "Enter") titleJourney(); } },
      h("div", { class: "dc-h" }, h("h3", {}, "Tiến độ cấp độ")),
      h("div", { class: "lv-row" }, h("div", { class: "ring-box" }, ring),
        h("div", { class: "lv-tx" }, h("div", { class: "lv-from" }, KT.levelBadge(I.L, "sm"), h("span", {}, "Cấp " + I.L, h("small", {}, I.title))),
          h("p", {}, "Còn ", h("b", {}, KT.num(I.toNext) + " KN"), " để lên cấp " + (I.L + 1) + "."),
          I.nextTitle ? h("p", { class: "lv-next" }, "Cấp " + I.nextTitleAt + ": " + I.nextTitle) : null)));

    // ô bài cần làm
    const hw = h("section", { class: "dcard d-hw" }, h("div", { class: "dc-h" }, h("h3", {}, "Bài cần làm"), h("button", { class: "dc-more", onclick: () => go("tests") }, "Xem tất cả")));
    const hl = h("ul", { class: "hw-list" });
    items.slice(0, 4).forEach((it) => hl.append(h("li", {}, h("button", { type: "button", class: "hw-i m-" + it.k + (it.urgent ? " urgent" : ""), onclick: it.go },
      h("span", { class: "hw-tx" }, h("b", {}, it.t), h("small", {}, it.st + ". " + it.s)), h("span", { class: "hw-go", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>' })))));
    if (!items.length) hl.append(h("li", { class: "hw-empty" }, h("b", {}, "Hôm nay em đã xong hết việc"), h("span", {}, "Muốn học thêm thì chọn một đề tự luyện.")));
    hw.append(hl);

    // ô hoạt động học tập (biểu đồ đường)
    const act = h("section", { class: "dcard d-act" });
    let span = store.get("kt_act_span", 7);
    const drawAct = () => {
      act.innerHTML = "";
      const sel = h("div", { class: "seg", role: "tablist", "aria-label": "Khoảng thời gian" }, [[7, "7 ngày"], [30, "30 ngày"]].map(([n, l]) =>
        h("button", { class: span === n ? "on" : "", role: "tab", "aria-selected": String(span === n), onclick: () => { span = n; store.set("kt_act_span", n); drawAct(); } }, l)));
      const S = activity(span);
      act.append(h("div", { class: "dc-h" }, h("div", {}, h("h3", {}, "Hoạt động học tập"), h("p", { class: "dc-sub" }, S.total ? KT.num(S.total) + " câu, " + S.nb + " bài trong " + span + " ngày qua" : "Chưa có bài nào trong " + span + " ngày qua")), sel),
        S.total ? smoothChart(S.pts) : h("div", { class: "empty-state" }, h("h3", {}, "Biểu đồ đang chờ em"), h("p", {}, "Mỗi bài em nộp sẽ hiện thành một điểm trên biểu đồ."), linkBtn("Làm bài ngay", "learn")));
    };
    drawAct();

    // cột phải: chương đang học + bài nên luyện thêm
    const courses = h("section", { class: "dcard d-courses" }, h("div", { class: "dc-h" }, h("h3", {}, "Chương em đang học"), h("button", { class: "dc-more", onclick: () => go("learn") }, "Tự luyện")));
    const chs = chapterProgress().slice(0, 3);
    if (!chs.length) courses.append(h("div", { class: "empty-state" }, h("h3", {}, "Chưa có chương nào"), h("p", {}, "Làm bài theo bài hoặc theo chương để thấy tiến độ ở đây.")));
    chs.forEach((c, i) => courses.append(h("button", { type: "button", class: "course c" + (i % 3), onclick: () => setup(KT.blueprint.chapter(c.g, c.c)) },
      h("span", { class: "co-ic", "aria-hidden": "true" }, KT.romans[c.c] || c.c),
      h("span", { class: "co-tx" }, h("b", {}, "Chương " + (KT.romans[c.c] || c.c) + ". " + c.name), h("small", {}, "Toán " + c.g + ", nắm vững " + KT.pct(c.m) + "%"),
        h("span", { class: "co-bar" }, h("i", { style: "--w:" + Math.max(3, KT.pct(c.m)) + "%" })),
        h("span", { class: "co-meta" }, h("span", {}, c.nl + " bài đã làm"), h("span", {}, KT.LEVEL3_LABEL[KT.level3(c.m)]), h("span", {}, Math.round(c.w) + " lượt câu"))),
      h("span", { class: "co-go", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>' }))));
    courses.append(h("button", { type: "button", class: "course-add", onclick: () => go("learn") }, "Luyện chương khác", h("span", { "aria-hidden": "true" }, "+")));

    const agg = KT.aggMastery(home.mastery);
    const weak = agg.lessons.filter((x) => x.w >= 2 && x.m < 0.8 && LESSON[x.key]).sort((a, b) => a.m - b.m).slice(0, 3);
    const sug = h("section", { class: "dcard d-sug" }, h("div", { class: "dc-h" }, h("h3", {}, "Nên luyện thêm"), h("button", { class: "dc-more", onclick: () => go("achieve") }, "Thống kê")));
    if (!weak.length) sug.append(h("p", { class: "dc-sub" }, "Chưa có bài nào dưới 80%. Làm thêm vài bài để hệ thống gợi ý chính xác hơn."));
    weak.forEach((x) => sug.append(h("button", { type: "button", class: "sug-i", onclick: () => setup(improveBp([x.key])) },
      h("span", { class: "sug-pct " + KT.level3(x.m) }, KT.pct(x.m) + "%"), h("span", { class: "sug-tx" }, h("b", {}, KT.lessonName(x.key)), h("small", {}, "Toán " + LESSON[x.key].g + ", luyện 12 câu, ưu tiên câu em từng sai")),
      h("span", { class: "co-go", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>' }))));

    // huy hiệu
    const B = badges().sort((a, b) => (b.ok - a.ok) || (b.cur / b.need - a.cur / a.need));
    const ach = h("section", { class: "dcard d-ach" }, h("div", { class: "dc-h" }, h("h3", {}, "Huy hiệu"), h("span", { class: "dc-sub" }, B.filter((b) => b.ok).length + "/" + B.length + " đã mở khoá"), h("button", { class: "dc-more", onclick: () => go("achieve") }, "Xem tất cả")),
      h("div", { class: "ach-row" }, B.slice(0, 4).map((b) => h("div", { class: "achi" + (b.ok ? " ok" : ""), title: b.d },
        h("span", { class: "bd-ic", "aria-hidden": "true" }, b.ic), h("b", {}, b.n),
        b.ok ? h("small", {}, "Đã mở khoá") : h("span", { class: "mc-prog" }, h("i", { style: "--w:" + Math.round(Math.min(1, b.cur / b.need) * 100) + "%" }))))));

    const main = h("div", { class: "ds-main" },
      h("div", { class: "ds-hello" }, h("div", {}, h("p", { class: "dh-date" }, ds.charAt(0).toUpperCase() + ds.slice(1)),
        h("h1", {}, greet() + " ", h("em", {}, firstName()), "!", h("span", { class: "wave", "aria-hidden": "true" }, " 👋"))),
        h("p", { class: "ds-hsub" }, items.length ? "Em có " + items.length + " việc cần làm hôm nay." : "Em đã xong hết việc hôm nay.")),
      h("div", { class: "ds-grid" },
        h("div", { class: "ds-c1" }, h("div", { class: "ds-row2" }, lvCard, hw), act, ach),
        h("div", { class: "ds-c2" }, courses, sug)));
    w.append(h("div", { class: "ds" }, side, main));
    w.append(liveSlot(liveProm));
    if ((home.remedials || []).length) w.append(remedialBlock());
    // việc đang diễn ra live: thêm vào đầu danh sách bài cần làm
    (liveProm || Promise.resolve([])).then((ls) => (ls || []).filter((x) => x.status === "live").forEach((x) => {
      const e = hl.querySelector(".hw-empty"); if (e) e.remove();
      hl.prepend(h("li", {}, h("button", { type: "button", class: "hw-i m-live", onclick: () => renderLive(x.id) }, h("span", { class: "hw-tx" }, h("b", {}, "Đang dạy live: " + x.title), h("small", {}, "Đang diễn ra. Vào ngay để không lỡ bài.")),
        h("span", { class: "hw-go", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>' }))));
    }));
  }
  // số câu đã làm mỗi ngày (từ các bài đã nộp)
  function activity(n) {
    const t = new Date(), days = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i); days.push({ d, k: d.toDateString(), q: 0, b: 0 }); }
    const by = Object.fromEntries(days.map((x) => [x.k, x]));
    (home.history || []).forEach((r) => { const x = by[new Date(r.submitted_at).toDateString()]; if (x) { x.q += +r.n || 0; x.b++; } });
    const WD2 = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return { total: days.reduce((s, x) => s + x.q, 0), nb: days.reduce((s, x) => s + x.b, 0),
      pts: days.map((x) => ({ lab: n <= 7 ? WD2[x.d.getDay()] : x.d.getDate() + "/" + (x.d.getMonth() + 1), v: x.q,
        tip: x.d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }) + "<br><b>" + x.q + " câu</b>, " + x.b + " bài" })) };
  }
  // biểu đồ đường cong mượt, tô chuyển màu, vẽ dần khi hiện
  function smoothChart(pts) {
    const W = 640, H = 240, L = 36, Rr = 14, T = 16, Bb = 30, n = pts.length;
    const mx = Math.max(4, ...pts.map((p) => p.v)), step = Math.ceil(mx / 4), top = step * 4;
    const x = (i) => L + (W - L - Rr) * (n <= 1 ? 0.5 : i / (n - 1)), y = (v) => T + (H - T - Bb) * (1 - v / top);
    const P = pts.map((p, i) => [x(i), y(p.v)]);
    let d = "M" + P[0][0].toFixed(1) + "," + P[0][1].toFixed(1);
    for (let i = 0; i < P.length - 1; i++) {   // Catmull–Rom → Bézier, kẹp để không vượt dưới trục
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(y(0), p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(y(0), p2[1] - (p3[1] - p1[1]) / 6)];
      d += "C" + c1.map((v) => v.toFixed(1)).join(",") + " " + c2.map((v) => v.toFixed(1)).join(",") + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    let g = "";
    for (let v = 0; v <= top; v += step) g += '<line class="gl" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    const every = n > 10 ? Math.ceil(n / 8) : 1;
    pts.forEach((p, i) => { if (i % every === 0 || i === n - 1) g += '<text class="ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + KT.esc(p.lab) + "</text>"; });
    let hits = "";
    pts.forEach((p, i) => { hits += '<g class="hit" data-tip="' + KT.esc(p.tip).replace(/&lt;(\/?b|br)&gt;/g, "<$1>") + '"><rect x="' + (x(i) - (W - L) / n / 2) + '" y="' + T + '" width="' + ((W - L) / n) + '" height="' + (H - T - Bb) + '" fill="transparent"/><line class="xh" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + y(p.v) + '" y2="' + y(0) + '"/>'
      + (p.v ? '<circle class="dot" cx="' + x(i) + '" cy="' + y(p.v) + '" r="4.5"/>' : "") + "</g>"; });
    const el = h("div", { class: "schart", html: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Số câu em làm mỗi ngày"><defs>'
      + '<linearGradient id="scL" x1="0" x2="1"><stop offset="0" stop-color="#4527a0"/><stop offset=".55" stop-color="#8b4fe0"/><stop offset="1" stop-color="#e44fb4"/></linearGradient>'
      + '<linearGradient id="scA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b4fe0" stop-opacity=".28"/><stop offset="1" stop-color="#8b4fe0" stop-opacity="0"/></linearGradient></defs>'
      + g + '<path class="sc-area" d="' + d + "L" + x(n - 1) + "," + y(0) + "L" + x(0) + "," + y(0) + 'Z" fill="url(#scA)"/><path class="sc-ln" d="' + d + '" stroke="url(#scL)" pathLength="1"/>' + hits + "</svg>" });
    return KT.tipify(el);
  }
  // tiến độ từng chương: gom mức nắm vững các bài theo chương, chương làm nhiều gần đây đứng trước
  function chapterProgress() {
    const agg = KT.aggMastery(home.mastery), M = {};
    agg.lessons.forEach((x) => { const L = LESSON[x.key]; if (!L) return; const k = L.g + "-" + L.c; const o = (M[k] = M[k] || { g: L.g, c: L.c, name: L.cname, m: 0, w: 0, nl: 0 }); o.m += x.m * x.w; o.w += x.w; o.nl++; });
    const recent = {}; (home.history || []).forEach((r, i) => { if (r.grade) recent[r.grade] = Math.max(recent[r.grade] || 0, 60 - i); });
    return Object.values(M).map((o) => Object.assign(o, { m: o.w ? o.m / o.w : 0 })).sort((a, b) => ((recent[b.g] || 0) - (recent[a.g] || 0)) || b.w - a.w);
  }
  // các việc cần làm (dùng cho thẻ nhiệm vụ và chuông thông báo), tính từ dữ liệu thật
  /* học phí: học sinh chỉ xem trạng thái */
  var fees = [];
  const FEE_ST = { paid: "Đã đóng", partial: "Đóng thiếu", late: "Quá hạn", unpaid: "Chưa đóng", free: "Được miễn", nofee: "Chưa có" };
  const vnd = (n) => KT.num(n || 0) + " đ";
  const mLabel = (m) => { const d = new Date(m + "T00:00:00"); return "Tháng " + (d.getMonth() + 1) + "/" + d.getFullYear(); };
  const dLabel = (m) => { const d = new Date(m + "T00:00:00"); return d.getDate() + "/" + (d.getMonth() + 1); };
  const feeOwed = () => fees.filter((f) => ["late", "partial", "unpaid"].includes(f.status));
  /* điểm làm bài: mỗi bài tự luyện hoặc đề có sẵn dùng 1 điểm, thầy cô cấp thêm */
  var credit = null;
  const creditLine = () => !credit ? "" : credit.credits > 0 ? " Bài này dùng <b>1 điểm làm bài</b> (em còn " + credit.credits + " điểm)." : "";
  const noCredit = () => credit && credit.credits <= 0;
  function creditOut() {
    KT.modal(h("div", { class: "cr-out" }, h("h3", {}, "Em đã dùng hết điểm làm bài"),
      h("p", {}, "Mỗi bài tự luyện hoặc đề có sẵn cần 1 điểm. Em nhờ thầy cô cấp thêm điểm nhé."),
      h("p", { class: "sub" }, "Bài thầy cô giao, Ôn câu sai, Nhiệm vụ hôm nay và Bài bổ sung vẫn làm bình thường, không cần điểm.")));
  }
  const afterStart = () => { rpc("my_credits").then((c) => (credit = c)).catch(() => { }); };
  function creditBar() {
    if (!credit) return null;
    const n = credit.credits;
    return h("div", { class: "cr-bar" + (n <= 0 ? " out" : n <= 2 ? " low" : "") },
      h("div", { class: "cr-n" }, h("b", {}, String(n)), h("span", {}, "điểm làm bài")),
      h("p", {}, n <= 0 ? "Em đã dùng hết điểm. Em nhờ thầy cô cấp thêm để làm tiếp bài tự luyện và đề có sẵn. Bài thầy cô giao vẫn làm bình thường."
        : "Mỗi lần bắt đầu một bài tự luyện hoặc một đề có sẵn dùng 1 điểm. Làm tiếp bài đang dở và bài thầy cô giao không mất điểm."),
      h("button", { class: "btn ghost sm", onclick: creditModal }, "Lịch sử"));
  }
  function creditModal() {
    const log = (credit && credit.log) || [];
    KT.modal(h("div", { class: "cr-hist" }, h("h3", {}, "Điểm làm bài của em: " + (credit ? credit.credits : 0)),
      log.length ? h("ul", { class: "cr-list" }, log.map((l) => h("li", {},
        h("span", { class: "cr-d " + (l.d > 0 ? "up" : "dn") }, (l.d > 0 ? "+" : "") + l.d),
        h("div", {}, h("b", {}, l.d > 0 ? (l.reason || "Thầy cô cấp thêm") : l.reason || "Bài tự luyện"), h("small", {}, KT.dt(l.at) + ", còn " + l.bal + " điểm")))))
        : h("p", { class: "sub" }, "Chưa có thay đổi nào."),
      h("p", { class: "sub" }, "Mỗi bài tự luyện hoặc đề có sẵn dùng 1 điểm. Thầy cô là người cấp thêm điểm.")));
  }
  function feeModal() {
    KT.modal(h("div", { class: "fee-st" }, h("h3", {}, "Học phí của em"),
      fees.length ? h("ul", { class: "fee-list" }, fees.map((f) => h("li", {},
        h("div", {}, h("b", {}, mLabel(f.month)), h("small", {}, f.status === "free" ? "Em được miễn học phí tháng này" : f.status === "nofee" ? "Thầy cô chưa đặt học phí" :
          vnd(f.amount) + (f.paid && f.paid < f.amount ? ", đã đóng " + vnd(f.paid) : "") + (["unpaid", "late", "partial"].includes(f.status) ? ", hạn " + dLabel(f.due) : ""))),
        h("span", { class: "fee-badge fs-" + f.status }, FEE_ST[f.status] || f.status))))
        : h("p", { class: "sub" }, "Chưa có thông tin học phí."),
      h("p", { class: "sub" }, "Thông tin do thầy cô cập nhật sau khi nhận học phí. Nếu em thấy chưa đúng, em báo lại thầy cô nhé.")));
  }
  function todoItems() {
    const now = Date.now() + clockSkew, items = [];
    (home.remedials || []).forEach((r) => items.push({ k: "rem", pri: 0, t: "Làm bài bổ sung bắt buộc", s: remNames(r).join("; "), go: () => startRemedial(r.id), cta: r.doing ? "Làm tiếp" : "Làm ngay", st: "Bắt buộc", xp: "KN theo số câu đúng" }));
    (home.assignments || []).forEach((a) => {
      const op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
      if (a.remedial || now < op || now > cl) return;
      if (!a.doing && a.done > 0) return;
      const urgent = cl - now < 864e5;
      items.push({ k: "asg", pri: urgent ? 1 : 2, urgent, t: (a.doing ? "Làm tiếp bài: " : "Bài thầy giao: ") + a.title, s: a.n_q + " câu, " + a.minutes + " phút. Hạn nộp " + KT.dt(a.closes_at),
        go: () => openAssignment(a), cta: a.doing ? "Làm tiếp" : "Làm bài", st: a.doing ? "Đang làm" : urgent ? "Sắp hết hạn" : "Chưa làm", xp: "KN theo số câu đúng" });
    });
    (home.doing || []).forEach((d) => items.push({ k: "doing", pri: 2, t: "Làm tiếp: " + d.title, s: "Hết giờ lúc " + KT.dt(d.ends_at), go: () => viewAttempt(d.id), cta: "Làm tiếp", st: "Đang làm", xp: "KN theo số câu đúng" }));
    const ms = home.mission;
    if (!ms || ms.status === "doing") items.push({ k: "mis", pri: 3, t: "Nhiệm vụ hôm nay", s: ms ? "Em đang làm dở, hết giờ lúc " + hm(ms.ends_at) + "." : "Khoảng 12 câu trong 15 phút: câu em từng sai, bài em đang yếu và 2 câu khó hơn một chút.",
      go: startMission, cta: ms ? "Làm tiếp" : "Bắt đầu", st: ms ? "Đang làm" : "Chưa bắt đầu", xp: "+30 KN thưởng khi xong" });
    const due = (home.review || {}).due || 0;
    if (due) items.push({ k: "rev", pri: 4, t: "Ôn lại " + Math.min(due, 10) + " câu từng làm sai", s: due + " câu trong sổ câu sai đã đến hạn ôn.", go: startReview, cta: "Ôn ngay", st: "Đến hạn", xp: "+5 KN mỗi câu ôn đúng" });
    const owed = feeOwed().filter((f) => f.status !== "unpaid" || new Date(f.due + "T23:59:59").getTime() - now < 3 * 864e5);
    if (owed.length) {
      const f = owed[owed.length - 1], late = owed.some((x) => x.status === "late");
      items.push({ k: "fee", pri: late ? 1 : 5, urgent: late, t: "Học phí " + mLabel(f.month).toLowerCase() + (owed.length > 1 ? " và " + (owed.length - 1) + " tháng khác" : ""),
        s: late ? "Đã quá hạn đóng. Em nhắc bố mẹ đóng học phí giúp thầy cô nhé." : "Sắp đến hạn đóng (" + dLabel(f.due) + "). Em nhắc bố mẹ giúp thầy cô nhé.",
        go: feeModal, cta: "Xem học phí", st: late ? "Quá hạn" : FEE_ST[f.status], xp: "" });
    }
    return items.sort((a, b) => a.pri - b.pri);
  }
  const MIC = { rem: "!", asg: "✎", doing: "↻", mis: "★", rev: "⟲", live: "●", fee: "₫" };
  function missionGrid(items) {
    const grid = h("div", { class: "mgrid" });
    const card = (it, done) => h("article", { class: "mcard m-" + it.k + (done ? " done" : "") + (it.urgent ? " urgent" : "") },
      h("div", { class: "mc-top" }, h("span", { class: "mc-ic", "aria-hidden": "true" }, MIC[it.k] || "•"), h("span", { class: "mc-st" }, done ? "Đã hoàn thành" : it.st)),
      h("h3", {}, it.t), h("p", {}, it.s),
      it.prog != null ? h("div", { class: "mc-prog", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(it.prog * 100)) }, h("i", { style: "--w:" + Math.round(it.prog * 100) + "%" })) : null,
      h("div", { class: "mc-foot" }, it.xp ? h("span", { class: "mc-xp" }, it.xp) : h("span", {}),
        done ? h("span", { class: "mc-end" }, h("span", { class: "mc-done" }, svg("check"), "Xong"), it.go ? h("button", { class: "btn ghost sm", onclick: it.go }, "Xem kết quả") : null)
          : h("button", { class: "btn sm" + (it.pri <= 1 ? " acc" : ""), onclick: it.go }, it.cta)));
    items.forEach((it) => grid.append(card(it)));
    const ms = home.mission, rv = home.review || {};
    if (ms && ms.status === "done") grid.append(card({ k: "mis", t: "Nhiệm vụ hôm nay", s: "Hoàn thành với " + fmt(ms.score) + " điểm. Hẹn em ngày mai để giữ chuỗi " + (home.streak || 0) + " ngày học.", xp: "Đã nhận thưởng", prog: 1,
      go: () => viewAttempt(ms.id) }, true));
    if (!rv.due && (rv.total || rv.mastered)) grid.append(card({ k: "rev", t: "Ôn câu sai", s: "Chưa có câu nào đến hạn. Lần ôn tiếp theo: " + (rv.next ? hm(rv.next) : "–") + ".", xp: "Đã thuộc " + (rv.mastered || 0) + " câu",
      prog: (rv.mastered || 0) / Math.max(1, (rv.total || 0) + (rv.mastered || 0)) }, true));
    if (!grid.children.length) grid.append(h("div", { class: "empty-state" }, h("h3", {}, "Hôm nay chưa có việc nào"), h("p", {}, "Chọn một đề trong mục Học tập để bắt đầu."), linkBtn("Vào Học tập", "learn")));
    (liveProm || Promise.resolve([])).then((ls) => (ls || []).filter((x) => x.status === "live").forEach((x) =>
      grid.prepend(card({ k: "live", pri: -1, t: "Đang dạy live: " + x.title, s: "Lớp đã bắt đầu, vào ngay để không lỡ bài.", go: () => renderLive(x.id), cta: "Vào lớp", st: "Đang diễn ra", xp: "Có điểm danh" }))));
    return grid;
  }
  // số liệu tóm tắt từ bài đã làm (không có dữ liệu thì hiện gạch ngang)
  function learnStats() {
    const hist = home.history || [];
    let m = 0, wt = 0; (home.mastery || []).forEach((r) => { m += +r.m || 0; wt += +r.w || 0; });
    const last = hist.slice(0, 10).filter((r) => r.score != null);
    return { n: hist.length, capped: hist.length >= 60, acc: wt ? m / wt : null, avg: last.length ? last.reduce((s, r) => s + +r.score, 0) / last.length : null, nq: hist.reduce((s, r) => s + (+r.n || 0), 0) };
  }
  function quickStats() {
    const S = learnStats(), rv = home.review || {};
    const k = (n, l, sub) => h("div", { class: "kpi" }, h("div", { class: "n" }, n), h("div", { class: "l" }, l), sub ? h("div", { class: "kpi-sub" }, sub) : null);
    return h("div", { class: "kpis" },
      k(KT.num(S.n), "bài đã nộp", S.capped ? "tính 60 bài gần nhất" : null),
      k(S.nq ? KT.num(S.nq) : "–", "câu đã làm", S.capped ? "trong 60 bài gần nhất" : null),
      k(S.acc == null ? "–" : KT.pct(S.acc) + "%", "tỉ lệ đúng", "tính trên mọi câu đã làm"),
      k(S.avg == null ? "–" : fmt(S.avg), "điểm trung bình", "10 bài gần nhất"),
      k(KT.num(rv.mastered || 0), "câu sai đã thuộc", rv.due ? rv.due + " câu đến hạn ôn" : null));
  }

  /* ----- Bài kiểm tra ----- */
  function tStatus(a) {
    const now = Date.now() + clockSkew, op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
    if (a.doing) return "doing";
    if (now < op) return "soon";
    if (now > cl) return a.done ? "closed" : "late";
    if (a.remedial) return "rem";
    if (a.done >= a.max_attempts || a.done > 0) return "done";
    return "todo";
  }
  const TST = { todo: ["Chưa làm", "info"], doing: ["Đang làm", "warn"], done: ["Đã hoàn thành", "ok"], late: ["Quá hạn", "bad"], closed: ["Đã đóng", ""], soon: ["Sắp mở", ""], rem: ["Cần làm bài bổ sung", "warn"] };
  const leftTxt = (ms) => { const hh = Math.floor(ms / 36e5); return hh >= 48 ? "còn " + Math.floor(hh / 24) + " ngày" : hh >= 1 ? "còn " + hh + " giờ" : "còn " + Math.max(1, Math.floor(ms / 6e4)) + " phút"; };
  function testCard(a) {
    const s = tStatus(a), now = Date.now() + clockSkew, op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
    let btn = null;
    if (s === "doing") btn = h("button", { class: "btn acc", onclick: () => openAssignment(a) }, "Làm tiếp");
    else if (s === "rem") btn = h("button", { class: "btn acc", onclick: () => startRemedial(a.remedial) }, "Làm bài bổ sung");
    else if (s === "todo") btn = h("button", { class: "btn acc", onclick: () => openAssignment(a) }, "Bắt đầu");
    else if (s === "done" && a.done < a.max_attempts && now < cl) btn = h("button", { class: "btn", onclick: () => openAssignment(a) }, "Làm lại");
    const res = a.last_attempt ? h("button", { class: "btn ghost", onclick: () => viewAttempt(a.last_attempt) }, "Xem kết quả") : null;
    const tf = now < op ? 0 : Math.min(1, (now - op) / Math.max(1, cl - op));
    const row = (k, v) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    return h("article", { class: "tcard st-" + s },
      h("div", { class: "tc-top" }, h("span", { class: "tag" }, a.kind), h("span", { class: "pill " + TST[s][1] }, TST[s][0])),
      h("h3", {}, a.title),
      h("dl", { class: "tc-meta" }, row("Số câu", String(a.n_q)), row("Thời gian", a.minutes + " phút"), row("Hạn nộp", KT.dt(a.closes_at)), row("Lượt làm", a.done + "/" + a.max_attempts)),
      ["todo", "doing", "rem", "done"].includes(s) && now < cl ? h("div", { class: "tc-time" }, h("div", { class: "tc-bar", title: "Thời gian mở bài đã trôi qua" }, h("i", { style: "--w:" + Math.round(tf * 100) + "%" })), h("span", {}, "Hạn nộp " + leftTxt(cl - now)))
        : s === "soon" ? h("div", { class: "tc-time" }, h("span", {}, "Mở lúc " + KT.dt(a.opens_at))) : null,
      a.best != null ? h("p", { class: "tc-score" }, "Điểm cao nhất ", h("b", {}, fmt(a.best))) : null,
      h("div", { class: "tc-act" }, btn, res));
  }
  const testGrid = (list) => h("div", { class: "tgrid" }, list.map(testCard));
  let tFilter = "all", tQuery = "";
  function viewTests(w) {
    const all = home.assignments || [];
    w.append(secHead("Bài kiểm tra được giao", "Bài thầy cô giao cho lớp " + (home.student.class || "của em") + ". Bài đóng sau 14 ngày sẽ không hiện ở đây nữa."));
    const F = [["all", "Tất cả"], ["todo", "Chưa làm"], ["doing", "Đang làm"], ["done", "Đã hoàn thành"], ["late", "Quá hạn"], ["closed", "Đã đóng"], ["soon", "Sắp mở"]];
    const cnt = (k) => (k === "all" ? all.length : all.filter((a) => tStatus(a) === k || (k === "doing" && tStatus(a) === "rem")).length);
    const grid = h("div", {});
    const chips = h("div", { class: "chips", role: "tablist", "aria-label": "Lọc theo trạng thái" });
    const q = h("input", { type: "search", class: "search", placeholder: "Tìm theo tên bài", value: tQuery, "aria-label": "Tìm bài kiểm tra" });
    const draw = () => {
      chips.innerHTML = "";
      F.forEach(([k, l]) => { const n = cnt(k); if (k !== "all" && !n) return; chips.append(h("button", { class: tFilter === k ? "on" : "", role: "tab", "aria-selected": String(tFilter === k), onclick: () => { tFilter = k; draw(); } }, l, h("b", {}, String(n)))); });
      const s = tQuery.trim().toLowerCase();
      const list = all.filter((a) => (tFilter === "all" || tStatus(a) === tFilter || (tFilter === "doing" && tStatus(a) === "rem")) && (!s || a.title.toLowerCase().includes(s)));
      grid.innerHTML = "";
      grid.append(list.length ? testGrid(list) : h("div", { class: "empty-state" }, h("h3", {}, all.length ? "Không có bài nào khớp" : "Hiện chưa có bài nào được giao"), h("p", {}, all.length ? "Thử chọn trạng thái khác hoặc xoá từ khoá tìm kiếm." : "Khi thầy cô giao bài, bài sẽ hiện ở đây. Trong lúc chờ, em có thể tự luyện ở mục Học tập."),
        all.length ? null : linkBtn("Vào Học tập", "learn")));
      if (KT.ui) KT.ui.reveal(grid);
    };
    q.addEventListener("input", () => { tQuery = q.value; draw(); });
    w.append(h("div", { class: "toolbar" }, chips, q), grid);
    draw();
    const doing = home.doing || [];
    if (doing.length) {
      w.append(secHead("Bài tự luyện đang làm dở"));
      w.append(h("div", { class: "tgrid" }, doing.map((d) => h("article", { class: "tcard st-doing" }, h("div", { class: "tc-top" }, h("span", { class: "tag" }, "Tự luyện"), h("span", { class: "pill warn" }, "Đang làm")),
        h("h3", {}, d.title), h("p", { class: "tc-score" }, "Hết giờ lúc " + KT.dt(d.ends_at)), h("div", { class: "tc-act" }, h("button", { class: "btn acc", onclick: () => viewAttempt(d.id) }, "Làm tiếp"))))));
    }
  }

  /* ----- Học tập ----- */
  // video bắt buộc của thầy cô: phải bấm xem và xem đủ thời gian mới dùng được trang
  let gateOk = false, gateEl = null;
  function showGate(g) {
    if (gateEl) gateEl.remove();
    let left = g.left, timer = null, opened = !!g.opened;
    const mmss = (x) => Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0");
    const clock = h("b", { class: "gate-clock" }, mmss(left));
    const bar = h("i", { style: "width:" + Math.round((1 - left / Math.max(1, g.secs)) * 100) + "%" });
    const stage = h("div", { class: "gate-stage" });
    const doneBtn = h("button", { class: "btn acc", type: "button", disabled: true, onclick: async () => {
      const r = await rpc("gate_done").catch((e) => { fail(e); return null; });
      if (!r) return;
      if (r.ok) { gateOk = true; close(); KT.toast("Cảm ơn em đã xem video. Chúc em học tốt!", "ok"); return; }
      left = r.left || 1; tick(); KT.toast("Em xem thêm một chút nữa nhé.", "bad");
    } }, "Em đã xem xong");
    const status = h("p", { class: "gate-st", "aria-live": "polite" });
    const tick = () => {
      clearInterval(timer);
      const upd = () => {
        clock.textContent = mmss(left); bar.style.width = Math.round((1 - left / Math.max(1, g.secs)) * 100) + "%";
        doneBtn.disabled = left > 0;
        status.textContent = left > 0 ? "Xem video thêm " + mmss(left) + " nữa thì nút bên dưới sẽ mở." : "Em đã xem đủ thời gian. Bấm “Em đã xem xong” để vào học.";
        if (left <= 0) clearInterval(timer);
      };
      upd(); timer = setInterval(() => { if (!document.hidden || opened) left = Math.max(0, left - 1); upd(); }, 1000);
    };
    const showVideo = () => { stage.innerHTML = ""; stage.append(KT.videoFrame({ p: g.p, vid: g.vid })); };
    const openBtn = h("a", { class: "btn gate-open", href: g.url, target: "_blank", rel: "noopener", onclick: async () => {
      const r = await rpc("gate_open").catch(() => null);
      opened = true; if (r && r.left != null) left = r.left;
      showVideo(); openBtn.classList.add("ghost"); openBtn.textContent = "Mở lại video";
      tick();
    } }, opened ? "Mở lại video" : "▶ Bấm để xem video");
    if (opened) { openBtn.classList.add("ghost"); showVideo(); }
    gateEl = h("div", { class: "gate", role: "dialog", "aria-modal": "true", "aria-labelledby": "gateT" },
      h("div", { class: "gate-card" },
        h("p", { class: "gate-from" }, (g.teacher || "Thầy cô") + " gửi em một video"),
        h("h2", { id: "gateT" }, g.title || "Video quan trọng"),
        h("p", { class: "gate-sub" }, "Em bấm vào nút bên dưới để xem video. Xem đủ " + mmss(g.secs) + " thì em mới vào học được."),
        stage,
        h("div", { class: "gate-acts" }, openBtn),
        h("div", { class: "gate-prog" }, h("div", { class: "gate-bar" }, bar), clock),
        status, doneBtn,
        h("button", { class: "gate-out", type: "button", onclick: () => { close(); logout(); } }, "Đăng xuất")));
    document.body.append(gateEl); document.body.classList.add("gate-on");
    const close = () => { clearInterval(timer); if (gateEl) gateEl.remove(); gateEl = null; document.body.classList.remove("gate-on"); };
    // chặn bấm phím Tab ra khỏi hộp
    gateEl.addEventListener("keydown", (e) => { if (e.key !== "Tab") return; const f = [...gateEl.querySelectorAll("a,button:not([disabled]),iframe")]; if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } });
    setTimeout(() => { try { openBtn.focus(); } catch (e) { } }, 50);
    if (opened) tick(); else { status.textContent = "Nút “Em đã xem xong” sẽ mở sau khi em xem đủ thời gian."; }
  }
  // xem video bài học đủ lâu: linh thú nhận kinh nghiệm
  KT.onVideoWatched = (v) => { if (!sess) return; rpc("g_video", { p_p: v.p, p_vid: v.vid }).then((r) => { if (r && r.xp) KT.toast(r.nick + " nhận +" + r.xp + " KN vì em xem video bài học.", "ok"); }).catch(() => { }); };
  // game Hành trình Linh Thú (game.js)
  function viewGame(w) {
    const box = h("div", { class: "gm-host" });
    w.append(box);
    if (KT.game) KT.game.mount(box, { rpc, fail }); else box.append(h("p", { class: "empty" }, "Không tải được game."));
  }
  function viewLearn(w) {
    w.append(secHead("Tự luyện", "Chọn khối lớp rồi chọn dạng đề. Mỗi lần làm em nhận một đề khác nhau."));
    const cb = creditBar(); if (cb) w.append(cb);
    nbList.forEach((b) => w.append(h("button", { class: "nb-entry", onclick: () => openNote(null) },
      h("span", { class: "nb-entry-ic", "aria-hidden": "true" }, "Σ"),
      h("span", { class: "nb-entry-t" }, h("b", {}, b.title), h("small", {}, "Công thức, kiến thức trọng tâm và ví dụ mẫu — tra cứu được với mọi khối lớp. Em đã thuộc " + b.done + "/" + b.n + " mục.")),
      h("span", { class: "nb-entry-bar", "aria-hidden": "true" }, h("i", { style: "width:" + (b.n ? Math.round((100 * b.done) / b.n) : 0) + "%" })),
      h("span", { class: "btn sm" }, b.done ? "Đọc tiếp" : "Mở sổ tay"))));
    w.append(h("div", { class: "grades", role: "tablist" }, [6, 7, 8, 9, 10, 11, 12].map((x) => h("button", {
      class: "grade" + (x === grade ? " on" : ""), disabled: !CUR[x], role: "tab", "aria-selected": String(x === grade),
      onclick: () => { grade = x; store.set("kt_grade", x); renderHome("learn", { cache: true }); } }, "Lớp " + x, !CUR[x] ? h("small", {}, "sắp có") : null))));
    w.append(practiceCards(grade));
    w.append(paperSection(grade));
  }

  /* ----- Sổ tay kiến thức: thầy sửa file .tex trên máy, công cụ đồng bộ đưa lên. Mọi khối đều tra cứu được ----- */
  var nbList = [], nbTick = [];
  let nbBook = null, nbFigs = {}, nbQ = "", nbKey = null, nbFocus = null;
  const nbRM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // mở sổ tay tại một mục (và khung kiến thức thứ i trong mục đó)
  function openNote(key, box) { nbKey = key || nbKey; nbFocus = box != null ? +box : null; nbQ = ""; go("notes"); }
  async function viewNotes(w) {
    const meta = nbList[0];
    if (!meta) { w.append(h("div", { class: "empty-state" }, h("h2", {}, "Chưa có sổ tay"), h("p", {}, "Thầy cô chưa đưa sổ tay kiến thức lên web."), linkBtn("Về Học tập", "learn"))); return; }
    const box = h("div", { class: "nb" }, h("p", { class: "muted", style: "padding:24px 0" }, "Đang mở sổ tay…"));
    w.append(box);
    try {
      if (!nbBook || nbBook.id !== meta.id || nbBook.updated_at !== meta.updated_at) {
        const b = await rpc("nb_get", { p_id: meta.id });
        if (b.error) throw new Error(b.error);
        nbBook = b;
        const ids = [...new Set(b.secs.flatMap((x) => [...x.html.matchAll(/data-fig="([0-9a-f]+)"/g)].map((m) => m[1])))].filter((k) => !nbFigs[k]);
        for (let i = 0; i < ids.length; i += 150) Object.assign(nbFigs, await api.rpc("get_figs", { p_ids: ids.slice(i, i + 150) }));
      }
    } catch (e) { box.innerHTML = ""; box.append(h("p", { class: "muted" }, "Chưa mở được sổ tay. Em thử tải lại trang nhé.")); if (/SESSION_EXPIRED/.test(e.message)) fail(e); return; }
    drawNotes(box);
  }
  function drawNotes(box) {
    const B = nbBook, marks = new Set(B.marks || []);
    const secs = B.secs, learn = secs.filter((x) => x.no);
    if (!nbKey || !secs.some((x) => x.key === nbKey)) {
      const last = store.get("kt_nb_last");
      nbKey = secs.some((x) => x.key === last) ? last : (learn.find((x) => !marks.has(x.key)) || secs[0]).key;
    }
    const prog = h("span", { class: "nb-prog" });
    const setProg = () => { const d = learn.filter((x) => marks.has(x.key)).length; prog.textContent = "Đã thuộc " + d + "/" + learn.length + " mục"; const m = nbList.find((x) => x.id === B.id); if (m) m.done = d; nbTick.forEach((t) => (t.done = marks.has(t.key))); };
    const q = h("input", { type: "search", class: "search", placeholder: "Tra cứu: Viète, tiếp tuyến, hằng đẳng thức…", value: nbQ, "aria-label": "Tra cứu trong sổ tay" });
    const toc = h("nav", { class: "nb-toc", "aria-label": "Mục lục sổ tay" });
    const main = h("div", { class: "nb-main", "aria-live": "polite" });
    const tocEls = {};
    const wide = () => matchMedia("(min-width: 901px)").matches;
    const det = h("details", { class: "nb-tocwrap", open: wide() }, h("summary", {}, h("span", {}, "Mục lục"), h("small", { class: "nb-cur" })), toc);
    const partName = (no) => { const p = (B.parts || []).find((x) => x.no === no); return p ? p.name : ""; };
    const tick = (x) => {
      const on = marks.has(x.key);
      return h("button", { class: "nb-tick" + (on ? " on" : ""), "aria-pressed": String(on), onclick: async (e) => {
        const v = !marks.has(x.key), btn = e.currentTarget;
        v ? marks.add(x.key) : marks.delete(x.key); btn.replaceWith(tick(x)); markToc(); setProg();
        if (v && !nbRM()) burst(main.querySelector(".nb-tick"));
        try { await rpc("nb_mark", { p_id: B.id, p_key: x.key, p_done: v }); } catch (err) { v ? marks.delete(x.key) : marks.add(x.key); markToc(); setProg(); fail(err); }
      } }, h("span", { class: "nb-box", "aria-hidden": "true" }), on ? "Đã thuộc" : "Đánh dấu đã thuộc");
    };
    const burst = (el) => { if (!el) return; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); };
    const markToc = () => Object.entries(tocEls).forEach(([k, a]) => { a.classList.toggle("on", marks.has(k)); a.classList.toggle("cur", k === nbKey && !nbQ.trim()); if (k === nbKey) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    // mục lục
    let lastPart = null;
    secs.forEach((x) => {
      if (x.part !== lastPart) { lastPart = x.part; toc.append(h("div", { class: "nb-toc-p" }, x.part ? "Phần " + x.part + " · " + partName(x.part) : B.title)); }
      const a = h("a", { href: "#notes", onclick: (e) => { e.preventDefault(); show(x.key, null, true); } },
        x.no ? h("b", {}, x.no) : h("b", {}, "✎"), h("span", { html: x.title }), h("i", { class: "nb-dot", "aria-hidden": "true" }));
      tocEls[x.key] = a; toc.append(a);
    });
    // một mục
    function show(key, boxIdx, fromToc) {
      nbKey = key; store.set("kt_nb_last", key);
      if (nbQ) { nbQ = ""; q.value = ""; }
      const i = secs.findIndex((s) => s.key === key), x = secs[i], prev = secs[i - 1], next = secs[i + 1];
      det.querySelector(".nb-cur").innerHTML = (x.no ? x.no + " · " : "") + x.title;
      const art = h("article", { class: "nb-sec", tabindex: "-1" },
        h("p", { class: "nb-crumb" }, x.part ? "Phần " + x.part + " · " + partName(x.part) : ""),
        h("header", { class: "nb-sh" }, x.no ? h("span", { class: "nb-no" }, x.no) : null, h("h2", { html: x.title }), x.no ? tick(x) : null),
        h("div", { class: "nb-body", html: x.html }),
        h("nav", { class: "nb-pn", "aria-label": "Chuyển mục" },
          prev ? h("button", { class: "nb-pv", onclick: () => show(prev.key, null, true) }, h("small", {}, "← Mục trước"), h("span", { html: (prev.no ? prev.no + " · " : "") + prev.title })) : h("span"),
          next ? h("button", { class: "nb-nx", onclick: () => show(next.key, null, true) }, h("small", {}, "Mục sau →"), h("span", { html: (next.no ? next.no + " · " : "") + next.title })) : h("span")));
      main.innerHTML = ""; main.append(art);
      KT.typeset(art, nbFigs); fitFigs(art); KT.typeset(det.querySelector(".nb-cur"));
      markToc();
      if (!wide()) det.open = false;
      if (fromToc || boxIdx != null) {
        const top = box.getBoundingClientRect().top + window.scrollY - 76;
        if (window.scrollY > top || boxIdx == null) window.scrollTo({ top: Math.max(0, top), behavior: nbRM() ? "auto" : "smooth" });
        art.focus({ preventScroll: true });
      }
      if (boxIdx != null) {
        const bx = art.querySelectorAll(".nb-ct, .nb-chuy")[boxIdx - 1];
        if (bx) { setTimeout(() => bx.scrollIntoView({ behavior: nbRM() ? "auto" : "smooth", block: "center" }), 60); bx.classList.add("nb-hl"); setTimeout(() => bx.classList.remove("nb-hl"), 2600); }
      }
    }
    const fitFigs = (root) => root.querySelectorAll("img.fig").forEach((img) => {   // hình vẽ cho khổ A6: phóng to hơn hình câu hỏi
      const fit = () => { if (img.naturalWidth) img.style.width = Math.round(img.naturalWidth * 2) + "px"; };
      if (img.complete) fit(); else img.addEventListener("load", fit, { once: true });
    });
    // tra cứu: hiện danh sách mục khớp, bấm để mở
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    function search() {
      nbQ = q.value; const k = foldVi(nbQ.trim());
      if (!k) { Object.values(tocEls).forEach((a) => (a.hidden = false)); toc.querySelectorAll(".nb-toc-p").forEach((p) => (p.hidden = false)); return show(nbKey); }
      const hits = secs.map((x) => { const f = foldVi(x.title + " " + x.txt), at = f.indexOf(k); return { x, at, inTitle: foldVi(x.title).includes(k) }; }).filter((r) => r.at >= 0)
        .sort((a, b) => (b.inTitle ? 1 : 0) - (a.inTitle ? 1 : 0));
      const hitKeys = new Set(hits.map((r) => r.x.key));
      Object.entries(tocEls).forEach(([key, a]) => (a.hidden = !hitKeys.has(key)));
      toc.querySelectorAll(".nb-toc-p").forEach((p) => { let e = p.nextElementSibling, any = false; while (e && !e.classList.contains("nb-toc-p")) { if (!e.hidden) any = true; e = e.nextElementSibling; } p.hidden = !any; });
      main.innerHTML = "";
      main.append(h("p", { class: "nb-found" }, hits.length ? "Có " + hits.length + " mục chứa “" + nbQ.trim() + "”" : "Không có mục nào chứa “" + nbQ.trim() + "”. Em thử từ khoá khác nhé."));
      hits.forEach(({ x }) => {
        const txt = x.txt || "", f = foldVi(txt), at = f.indexOf(k);
        const snip = at >= 0 ? (at > 40 ? "…" : "") + esc(txt.slice(Math.max(0, at - 40), at)) + "<mark>" + esc(txt.slice(at, at + nbQ.trim().length)) + "</mark>" + esc(txt.slice(at + nbQ.trim().length, at + 110)) + "…" : "";
        main.append(h("button", { class: "nb-hit", onclick: () => show(x.key, null, true) },
          h("span", { class: "nb-no sm" }, x.no || "✎"), h("span", {}, h("b", { html: x.title }), snip ? h("small", { html: snip }) : null)));
      });
      KT.typeset(main);
    }
    q.addEventListener("input", search);
    box.innerHTML = "";
    box.append(h("div", { class: "nb-head" }, h("div", {}, h("h1", {}, B.title), h("p", {}, prog, " · Dùng cho mọi khối lớp · Cập nhật " + KT.dt(B.updated_at))), q),
      h("div", { class: "nb-grid" }, h("aside", { class: "nb-side" }, det), main));
    setProg();
    KT.typeset(toc);
    if (nbQ) search(); else show(nbKey, nbFocus);
    nbFocus = null;
  }

  /* ----- Dải kiến thức chạy ngang: các khung kiến thức của sổ tay, chạm để mở ----- */
  let tickPaused = false;
  function nbTicker() {
    if (!nbTick.length) return null;
    const items = nbTick.slice(0, 36);
    const chip = (t) => h("button", { class: "tk-chip" + (t.done ? " done" : ""), onclick: () => openNote(t.key, t.i), title: "Mở sổ tay: " + t.sec.replace(/<[^>]+>/g, "") },
      h("span", { class: "tk-no" }, t.no), h("span", { class: "tk-t" }, h("b", { html: t.box }), h("small", { html: t.sec })), t.done ? h("span", { class: "tk-ok", "aria-label": "đã thuộc" }, "✓") : null);
    const run = h("div", { class: "tk-run" }, items.map(chip), items.map((t) => { const c = chip(t); c.setAttribute("aria-hidden", "true"); c.tabIndex = -1; return c; }));
    run.style.setProperty("--tk-dur", Math.max(40, items.length * 5) + "s");
    const pause = h("button", { class: "tk-pause", "aria-label": "Tạm dừng dải kiến thức", "aria-pressed": "false", onclick: () => { tickPaused = !tickPaused; set(); } });
    const el = h("section", { class: "tk", "aria-label": "Kiến thức trong sổ tay — chạm để xem" },
      h("button", { class: "tk-lab", onclick: () => go("notes") }, h("span", { class: "tk-ic", "aria-hidden": "true" }, "Σ"), h("span", {}, "Sổ tay")),
      h("div", { class: "tk-view" }, run), pause);
    const set = () => { el.classList.toggle("paused", tickPaused); pause.setAttribute("aria-pressed", String(tickPaused)); pause.setAttribute("aria-label", tickPaused ? "Chạy tiếp dải kiến thức" : "Tạm dừng dải kiến thức"); pause.textContent = tickPaused ? "▶" : "❚❚"; };
    set();
    return el;
  }

  /* ----- Luyện theo đề có sẵn (đề thật của các trường, sở: đúng câu, đúng thứ tự như đề gốc) ----- */
  const PAPER_KIND = { TNTHPT: "Thi thử TN THPT", GHK1: "Giữa kì I", CHK1: "Cuối kì I", GHK2: "Giữa kì II", CHK2: "Cuối kì II", BAI: "Theo bài", KHAC: "Đề khác" };
  const PAPER_ORDER = ["TNTHPT", "GHK1", "CHK1", "GHK2", "CHK2", "BAI", "KHAC"];
  const paperCache = {};
  let pKind = "all", pQuery = "", pShow = 9;
  const foldVi = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  function paperSection(g) {
    const box = h("section", { class: "papers", "aria-labelledby": "papH" });
    const chips = h("div", { class: "chips", role: "tablist", "aria-label": "Loại đề" });
    const q = h("input", { type: "search", class: "search", placeholder: "Tìm theo tên trường, sở, bài", value: pQuery, "aria-label": "Tìm đề" });
    const bar = h("div", { class: "toolbar" }, chips, q);
    const list = h("div", { class: "pp-list", "aria-live": "polite" });
    box.append(secHead("Luyện theo đề có sẵn", "Đề thật của các trường và sở, giữ nguyên câu hỏi và thứ tự như đề gốc. Em chọn đề nào thì làm đề đó, làm lại bao nhiêu lần cũng được."), bar, list);
    const draw = () => {
      const all = paperCache[g] || [];
      chips.innerHTML = ""; list.innerHTML = "";
      if (!all.length) {
        bar.hidden = true;
        list.append(h("div", { class: "empty-state" }, h("h3", {}, "Chưa có đề Toán " + g), h("p", {}, "Thầy cô đang cập nhật thêm đề. Trong lúc chờ, em làm các đề luyện tập ở phía trên nhé.")));
        return;
      }
      bar.hidden = false;
      const kinds = PAPER_ORDER.filter((k) => all.some((p) => p.kind === k));
      if (pKind !== "all" && !kinds.includes(pKind)) pKind = "all";
      [["all", "Tất cả", all.length]].concat(kinds.map((k) => [k, PAPER_KIND[k], all.filter((p) => p.kind === k).length])).forEach(([k, l, n]) =>
        chips.append(h("button", { class: pKind === k ? "on" : "", role: "tab", "aria-selected": String(pKind === k), onclick: () => { pKind = k; pShow = 9; draw(); } }, l, h("b", {}, String(n)))));
      const s = foldVi(pQuery.trim());
      const rows = all.filter((p) => (pKind === "all" || p.kind === pKind) && (!s || foldVi(p.title).includes(s)))
        .sort((a, b) => (b.doing ? 1 : 0) - (a.doing ? 1 : 0) || PAPER_ORDER.indexOf(a.kind) - PAPER_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title, "vi"));
      if (!rows.length) { list.append(h("div", { class: "empty-state" }, h("h3", {}, "Không có đề nào khớp"), h("p", {}, "Thử chọn loại đề khác hoặc xoá từ khoá tìm kiếm."))); return; }
      list.append(h("div", { class: "tgrid" }, rows.slice(0, pShow).map(paperCard)));
      if (rows.length > pShow) list.append(h("div", { class: "pp-more" }, h("button", { class: "btn ghost", onclick: () => { pShow += 12; draw(); } }, "Xem thêm " + Math.min(12, rows.length - pShow) + " đề (còn " + (rows.length - pShow) + ")")));
      if (KT.ui) KT.ui.reveal(list);
    };
    q.addEventListener("input", () => { pQuery = q.value; pShow = 9; draw(); });
    if (paperCache[g]) draw(); else list.append(h("p", { class: "muted pp-wait" }, "Đang tải danh sách đề…"));
    rpc("papers_list", { p_grade: g }).then((r) => { paperCache[g] = r || []; if (box.isConnected) draw(); })
      .catch((e) => { if (/SESSION_EXPIRED/.test(e.message)) return fail(e); if (!paperCache[g]) { list.innerHTML = ""; list.append(h("p", { class: "muted" }, "Chưa tải được danh sách đề. Em thử tải lại trang nhé.")); } });
    return box;
  }
  function paperCard(p) {
    const c = p.counts || {};
    const parts = [c.MC ? c.MC + " trắc nghiệm" : "", c.TF ? c.TF + " đúng/sai" : "", c.SA ? c.SA + " trả lời ngắn" : ""].filter(Boolean).join(", ");
    return h("article", { class: "tcard ppcard" + (p.doing ? " st-doing" : p.tries ? " st-done" : "") },
      h("div", { class: "tc-top" }, h("span", { class: "tag" }, PAPER_KIND[p.kind] || "Đề"),
        p.doing ? h("span", { class: "pill warn" }, "Đang làm") : p.tries ? h("span", { class: "pill ok" }, "Đã làm " + p.tries + " lần") : null),
      h("h3", {}, p.title),
      h("p", { class: "pc-meta" }, h("b", {}, p.n + " câu"), " trong " + p.minutes + " phút", parts ? h("span", {}, parts) : null),
      p.best != null ? h("p", { class: "tc-score" }, "Điểm cao nhất ", h("b", {}, fmt(p.best))) : null,
      h("div", { class: "tc-act" }, h("button", { class: "btn" + (p.doing ? " acc" : p.tries ? " ghost" : ""), onclick: () => startPaper(p) }, p.doing ? "Làm tiếp" : p.tries ? "Làm lại" : "Làm đề")));
  }
  function startPaper(p) {
    const bp = { paper: p.id, kind: "Luyện đề", title: p.title, grade: p.g };
    const go = async () => {
      delete paperCache[p.g];
      try { const r = await rpc("start_attempt", { p_blueprint: bp }); lastCtx = { bp }; afterStart(); startExam(r); }
      catch (e) { fail(e); }
    };
    if (p.doing) return go();
    if (noCredit()) return creditOut();
    const c = p.counts || {};
    KT.confirm(p.title, "Đề gồm <b>" + p.n + " câu</b>" + (c.TF || c.SA ? " (" + [c.MC ? c.MC + " trắc nghiệm" : "", c.TF ? c.TF + " đúng/sai" : "", c.SA ? c.SA + " trả lời ngắn" : ""].filter(Boolean).join(", ") + ")" : "")
      + ", làm trong <b>" + p.minutes + " phút</b>. Câu hỏi và phương án giữ đúng thứ tự như đề gốc. Đồng hồ vẫn chạy nếu em thoát ra giữa chừng." + creditLine(), "Bắt đầu", go);
  }

  /* ----- Sổ câu sai ----- */
  let bFilter = "all", bLv = "", bTopic = "", bQuery = "";
  function viewBook(w) {
    const rv = home.review || {};
    w.append(secHead("Sổ câu sai", "Câu nào em làm sai sẽ tự vào sổ. Hệ thống hẹn em ôn lại sau 1, 3, 7 rồi 21 ngày; đúng đủ 4 lần là đã thuộc."));
    const body = h("div", {}, h("div", { class: "sk-row" }, h("div", { class: "skel" }), h("div", { class: "skel" }), h("div", { class: "skel" })));
    w.append(body);
    rpc("review_list").then(async (d) => {
      body.innerHTML = "";
      const now = new Date(d.server_now).getTime(), items = d.items || [];
      const isDue = (x) => !x.done && new Date(x.due_at).getTime() <= now + 6 * 3600e3;
      const due = items.filter(isDue).length, mastered = items.filter((x) => x.done).length, inProg = items.length - due - mastered;
      const tile = (n, l, cls) => h("div", { class: "kpi " + (cls || "") }, h("div", { class: "n" }, KT.num(n)), h("div", { class: "l" }, l));
      body.append(h("div", { class: "book-top" },
        h("div", { class: "kpis" }, tile(items.length, "câu trong sổ"), tile(due, "đến hạn ôn", due ? "k-due" : ""), tile(inProg, "đang ôn"), tile(mastered, "đã thuộc", "k-ok")),
        h("div", { class: "book-cta" + (due ? " hot" : "") },
          h("div", {}, h("b", {}, due ? "Có " + due + " câu đến hạn ôn" : items.length ? "Chưa có câu nào đến hạn" : "Sổ đang trống"),
            h("span", {}, due ? "Mỗi lượt ôn 10 câu, câu “tưởng đúng mà sai” được ôn trước." : rv.next ? "Lần ôn tiếp theo: " + hm(rv.next) + "." : "Làm bài kiểm tra, câu sai sẽ tự vào đây.")),
          due ? h("button", { class: "btn acc lg", onclick: startReview }, "Ôn tập ngay") : null)));
      if (!items.length) { KT.ui && KT.ui.reveal(body); return; }
      // câu sai theo bài
      const byL = {}; items.filter((x) => !x.done).forEach((x) => { const k = x.g + "-" + x.l; byL[k] = (byL[k] || 0) + 1; });
      const top = Object.entries(byL).sort((a, b) => b[1] - a[1]).slice(0, 8), mx = top.length ? top[0][1] : 1;
      const byLv = {}; items.filter((x) => !x.done).forEach((x) => (byLv[x.lv] = (byLv[x.lv] || 0) + 1));
      body.append(h("div", { class: "book-charts" },
        h("div", { class: "panel" }, h("h3", {}, "Câu chưa thuộc theo bài"), h("p", { class: "sub" }, "Bài nhiều câu sai nhất ở trên cùng: nên ôn bài đó trước."),
          top.length ? KT.tipify(h("div", { class: "cbars" }, top.map(([k, n]) => h("div", { class: "cb", "data-tip": KT.esc(KT.lessonName(k, true)) + ": <b>" + n + " câu</b>" },
            h("span", { class: "cb-l" }, KT.lessonName(k, true)), h("span", { class: "cb-t" }, h("i", { style: "--w:" + Math.round(n / mx * 100) + "%" })), h("b", {}, String(n)))))) : h("p", { class: "empty" }, "Em đã thuộc hết các câu trong sổ.")),
        h("div", { class: "panel" }, h("h3", {}, "Theo mức độ"), h("p", { class: "sub" }, "Số câu chưa thuộc ở từng mức."),
          h("div", { class: "lvchips" }, ["NB", "TH", "VD", "VDC"].map((k) => h("div", { class: "lvc lv-" + k }, h("b", {}, String(byLv[k] || 0)), h("span", {}, LV[k] || k)))))));
      // bộ lọc + tìm kiếm + danh sách
      const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\$[^$]*\$/g, " ").toLowerCase();
      const topics = [...new Set(items.map((x) => x.g + "-" + x.l))].sort((a, b) => (LESSON[a] && LESSON[b] ? LESSON[a].g - LESSON[b].g || LESSON[a].l - LESSON[b].l : 0));
      const chips = h("div", { class: "chips", role: "tablist", "aria-label": "Lọc theo trạng thái" });
      const lvSel = h("select", { "aria-label": "Lọc theo mức độ" }, h("option", { value: "" }, "Mọi mức độ"), ["NB", "TH", "VD", "VDC"].map((k) => h("option", { value: k, selected: bLv === k }, LV[k] || k)));
      const tpSel = h("select", { "aria-label": "Lọc theo bài" }, h("option", { value: "" }, "Mọi bài"), topics.map((k) => h("option", { value: k, selected: bTopic === k }, KT.lessonName(k, true))));
      const q = h("input", { type: "search", class: "search", placeholder: "Tìm trong nội dung câu", value: bQuery, "aria-label": "Tìm câu sai" });
      const list = h("div", { class: "booklist" });
      const steps = (b, done) => h("span", { class: "boxes", title: done ? "Đã thuộc" : "Đã ôn đúng " + b + "/4 lần" }, [0, 1, 2, 3].map((i) => h("i", { class: done || i < b ? "on" : "" })));
      const draw = () => {
        chips.innerHTML = "";
        [["all", "Tất cả", items.length], ["due", "Đến hạn", due], ["prog", "Đang ôn", inProg], ["done", "Đã thuộc", mastered]].forEach(([k, l, n]) =>
          chips.append(h("button", { class: bFilter === k ? "on" : "", role: "tab", "aria-selected": String(bFilter === k), onclick: () => { bFilter = k; draw(); } }, l, h("b", {}, String(n)))));
        const s = bQuery.trim().toLowerCase();
        const rows = items.filter((x) => (bFilter === "all" || (bFilter === "due" ? isDue(x) : bFilter === "done" ? x.done : !x.done && !isDue(x)))
          && (!bLv || x.lv === bLv) && (!bTopic || x.g + "-" + x.l === bTopic) && (!s || strip(x.q).includes(s) || KT.lessonName(x.g + "-" + x.l).toLowerCase().includes(s)));
        list.innerHTML = "";
        if (!rows.length) list.append(h("div", { class: "empty-state" }, h("h3", {}, "Không có câu nào khớp"), h("p", {}, "Thử bỏ bớt bộ lọc hoặc đổi từ khoá.")));
        rows.slice(0, 120).forEach((x) => {
          const when = x.done ? h("span", { class: "pill ok" }, "Đã thuộc") : isDue(x) ? h("span", { class: "pill warn" }, "Đến hạn ôn") : h("span", { class: "pill" }, "Ôn lúc " + hm(x.due_at));
          list.append(h("div", { class: "bk-item" + (x.done ? " done" : "") },
            h("div", { class: "bk-meta" }, h("b", {}, KT.lessonName(x.g + "-" + x.l, true)), h("span", { class: "lvl" }, LV[x.lv] || x.lv), h("span", {}, TYPE_SHORT[x.t]),
              x.cw ? h("span", { class: "conftag cw" }, "Tưởng đúng mà sai") : null, x.wrong_n > 1 ? h("span", { class: "pill bad" }, "Sai " + x.wrong_n + " lần") : null,
              h("span", { class: "sp" }), when, steps(x.box, x.done)),
            h("div", { class: "qmini", html: x.q })));
        });
        if (rows.length > 120) list.append(h("p", { class: "sub" }, "Đang hiện 120 trên " + rows.length + " câu. Dùng bộ lọc để thu hẹp."));
        KT.typeset(list, figCache);
      };
      lvSel.addEventListener("change", () => { bLv = lvSel.value; draw(); });
      tpSel.addEventListener("change", () => { bTopic = tpSel.value; draw(); });
      q.addEventListener("input", () => { bQuery = q.value; draw(); });
      body.append(secHead("Danh sách câu sai"), h("div", { class: "toolbar" }, chips, h("div", { class: "tb-r" }, lvSel, tpSel, q)), list);
      const need = [...new Set(items.flatMap((x) => [...(x.q || "").matchAll(/data-fig="([0-9a-f]+)"/g)].map((m) => m[1])))].filter((k) => !figCache[k]);
      if (need.length) { try { Object.assign(figCache, await api.rpc("get_figs", { p_ids: need.slice(0, 200) })); } catch (e) { } }
      draw();
      if (KT.ui) KT.ui.reveal(body);
    }).catch((e) => { body.innerHTML = ""; body.append(h("div", { class: "empty-state" }, h("h3", {}, "Không tải được sổ câu sai"), h("p", {}, e.message || ""), h("button", { class: "btn", onclick: () => renderHome("book") }, "Thử lại"))); });
  }
  const renderBook = () => renderHome("book");

  /* ----- Thành tích: danh hiệu, huy hiệu, chuỗi ngày, vinh danh, thống kê ----- */
  const GEO = /hình|tam giác|tứ giác|đa giác|vectơ|véc|đường tròn|góc|song song|vuông góc|khối|mặt cầu|mặt phẳng|đường thẳng|tọa độ|toạ độ|lăng trụ|chóp|trụ|nón|cầu|đối xứng|định lí thalès|pythagore|đồng dạng/i;
  function maxStreak() {
    const ds = [...new Set((home.history || []).map((r) => { const d = new Date(r.submitted_at); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; }))].sort((a, b) => a - b);
    let best = ds.length ? 1 : 0, run = 1;
    for (let i = 1; i < ds.length; i++) { run = ds[i] - ds[i - 1] === 1 ? run + 1 : 1; best = Math.max(best, run); }
    return Math.max(best, home.streak || 0);
  }
  function badges() {
    const hist = home.history || [], agg = KT.aggMastery(home.mastery);
    const strong = agg.lessons.filter((x) => x.w >= 10 && x.m >= 0.8 && LESSON[x.key]);
    const isGeo = (k) => GEO.test(LESSON[k].cname + " " + LESSON[k].name);
    const nGeo = strong.filter((x) => isGeo(x.key)).length, nAlg = strong.length - nGeo;
    const vd = ["VD", "VDC"].reduce((o, k) => { const v = agg.levels[k]; if (v) { o.m += v.m; o.w += v.w; } return o; }, { m: 0, w: 0 });
    const vdOk = vd.w >= 20 && vd.m / vd.w >= 0.7;
    return [
      { id: "first", ic: "⚑", n: "Bước chân đầu tiên", d: "Nộp bài kiểm tra đầu tiên.", cur: Math.min(hist.length, 1), need: 1 },
      { id: "chamchi", ic: "🐜", n: "Kiến chăm chỉ", d: "Học 7 ngày liên tiếp.", cur: maxStreak(), need: 7, unit: "ngày" },
      { id: "benbi", ic: "⛰", n: "Học tập bền bỉ", d: "Nộp 30 bài.", cur: hist.length, need: 30, unit: "bài" },
      { id: "daiso", ic: "𝑥", n: "Chiến binh Đại số", d: "Vững (từ 80%) 3 bài Đại số, Giải tích hoặc Số học, mỗi bài làm từ 10 câu.", cur: nAlg, need: 3, unit: "bài" },
      { id: "hinhhoc", ic: "△", n: "Bậc thầy Hình học", d: "Vững (từ 80%) 3 bài Hình học, mỗi bài làm từ 10 câu.", cur: nGeo, need: 3, unit: "bài" },
      { id: "thuthach", ic: "⚡", n: "Nhà chinh phục thử thách", d: "Đúng từ 70% câu Vận dụng và Vận dụng cao, tính trên ít nhất 20 câu.", cur: vdOk ? 20 : Math.min(19, Math.round(vd.w)), need: 20, unit: "câu", note: vd.w >= 20 && !vdOk ? "Đã đủ 20 câu, cần đúng từ 70% (hiện " + KT.pct(vd.m / vd.w) + "%)" : null },
      { id: "tuyetdoi", ic: "✦", n: "Điểm tuyệt đối", d: "Đạt 10 điểm ở một bài.", cur: hist.some((r) => +r.score === 10) ? 1 : 0, need: 1 },
      { id: "trinho", ic: "◆", n: "Trí nhớ thép", d: "Thuộc 20 câu trong sổ câu sai.", cur: (home.review || {}).mastered || 0, need: 20, unit: "câu" },
    ].map((b) => Object.assign(b, { ok: b.cur >= b.need }));
  }
  function badgeGrid() {
    const B = badges();
    return h("div", { class: "bgrid" }, B.map((b) => h("article", { class: "badge" + (b.ok ? " ok" : ""), title: b.d },
      h("span", { class: "bd-ic", "aria-hidden": "true" }, b.ic),
      h("div", { class: "bd-tx" }, h("b", {}, b.n), h("span", {}, b.d)),
      b.ok ? h("span", { class: "bd-st" }, svg("check"), "Đã mở khoá")
        : h("div", { class: "bd-prog" }, h("div", { class: "mc-prog" }, h("i", { style: "--w:" + Math.round(Math.min(1, b.cur / b.need) * 100) + "%" })), h("span", {}, b.note || (Math.min(b.cur, b.need) + "/" + b.need + (b.unit ? " " + b.unit : "")))))));
  }
  function streakPanel() {
    const s = home.streak || 0, MS = [3, 7, 14, 30, 60, 100, 200, 365], nx = MS.find((m) => m > s);
    return h("div", { class: "panel streakp" },
      h("div", { class: "sp-top" }, h("div", { class: "sp-fire", "aria-hidden": "true" }, "🔥"), h("div", {}, h("b", { "data-count": s }, KT.num(s)), h("span", {}, "ngày học liên tiếp"))),
      weekGoal(weekDays()),
      h("p", { class: "sub" }, s ? (nx ? "Còn " + (nx - s) + " ngày nữa để đạt mốc " + nx + " ngày. Mỗi ngày chỉ cần nộp một bài là giữ được chuỗi." : "Em đã vượt mọi mốc chuỗi ngày. Quá xuất sắc!") : "Nộp một bài hôm nay để bắt đầu chuỗi ngày học."));
  }
  function journeyList() {
    const I = KT.levelInfo(home.xp), ti = KT.tierOf(I.L), list = h("ol", { class: "tj" });
    KT.TITLES.forEach(([lv, name], i) => {
      const next = KT.TITLES[i + 1], need = KT.lvXp(lv), got = i < ti ? "done" : i === ti ? "now" : "lock";
      list.append(h("li", { class: "tj-" + got }, KT.levelBadge(lv, "md"),
        h("div", { class: "tj-tx" }, h("b", {}, name), h("span", {}, (next ? "Cấp " + lv + "–" + (next[0] - 1) : "Cấp " + lv + " trở lên") + ", từ " + KT.num(need) + " KN")),
        h("span", { class: "tj-st" }, got === "done" ? "✓ Đã đạt" : got === "now" ? "Em đang ở đây" : "Còn " + KT.num(need - home.xp) + " KN")));
    });
    return list;
  }
  function viewAchieve(w) {
    w.append(secHead("Thành tích", "Kinh nghiệm (KN) cộng dồn từ mọi bài em làm và không bao giờ bị trừ."));
    const jp = h("div", { class: "panel jpanel" }, h("h3", {}, "Hành trình danh hiệu"), journeyList());
    w.append(h("div", { class: "ach-top" }, h("div", { class: "ach-l" }, levelCard(), streakPanel()), jp));
    setTimeout(() => { const c = jp.querySelector(".tj-now"); if (c) jp.querySelector(".tj").scrollTop = c.offsetTop - 120; }, 80);
    const B = badges();
    w.append(secHead("Huy hiệu", "Đã mở khoá " + B.filter((b) => b.ok).length + "/" + B.length + ". Điều kiện tính từ bài em đã làm."), badgeGrid());
    if (lboard) w.append(fameBlock());
    // thống kê học tập
    w.append(secHead("Thống kê học tập", "Chỉ tính từ bài em đã nộp."));
    w.append(quickStats());
    const hist = (home.history || []).filter((r) => r.score != null).slice(0, 20).reverse();
    const pts = hist.map((r) => ({ x: new Date(r.submitted_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), y: +r.score, tip: KT.esc(r.title) + "<br><b>" + fmt(r.score) + " điểm</b>, " + KT.dt(r.submitted_at) }));
    const agg = KT.aggMastery(home.mastery, grade);
    const weakRows = agg.lessons.filter((x) => LESSON[x.key]).sort((a, b) => a.m - b.m).slice(0, 8).map((x) => ({ label: KT.lessonName(x.key), m: x.m, sub: Math.round(x.w) + " lượt câu" }));
    w.append(h("div", { class: "stat-grid" },
      h("div", { class: "panel" }, h("h3", {}, "Điểm các bài gần đây"), h("p", { class: "sub" }, "20 bài gần nhất, thang 10. Rê chuột vào từng điểm để xem bài."),
        pts.length ? KT.lineChart(pts, { label: "Điểm các bài gần đây" }) : h("div", { class: "empty-state" }, h("h3", {}, "Chưa có bài nào"), h("p", {}, "Nộp bài đầu tiên để thấy biểu đồ tiến bộ."), linkBtn("Bắt đầu học", "learn"))),
      h("div", { class: "panel" }, h("h3", {}, "Mức nắm vững theo bài, Toán " + grade), h("p", { class: "sub" }, "Bài yếu nhất ở trên. Đổi khối ở mục Học tập."),
        weakRows.length ? KT.hbars(weakRows) : h("div", { class: "empty-state" }, h("h3", {}, "Chưa có dữ liệu Toán " + grade), h("p", {}, "Làm vài bài để hệ thống biết em mạnh, yếu phần nào."))),
      KT.statusLegend()));
    const pr = h("div", { class: "profile" });
    const left = h("div", {});
    left.append(KT.radarPanel("Đa giác năng lực Toán " + grade, "Tổng hợp tất cả bài em đã làm (cả bài giao và tự luyện).", KT.contentAxes(agg.lessons)));
    const sk = KT.skillAxes(agg.levels, agg.types);
    if (sk.length >= 3) left.append(h("div", { style: "height:14px" }), KT.radarPanel("Theo mức độ & dạng câu", "", sk));
    pr.append(left);
    const hp = h("div", { class: "panel" }, h("h3", {}, "Lịch sử làm bài"));
    if (!home.history.length) hp.append(h("div", { class: "empty" }, "Chưa có bài nào."));
    else {
      const ul = h("ul", { class: "hist" });
      home.history.forEach((r) => ul.append(h("li", { class: "click", onclick: () => viewAttempt(r.id), tabindex: 0, onkeydown: (e) => { if (e.key === "Enter") viewAttempt(r.id); } }, h("span", { class: "sc" }, fmt(r.score)),
        h("div", { class: "ti" }, h("b", {}, r.title), h("span", {}, r.kind + (r.assigned ? " (bài giao)" : "") + ", nộp lúc " + KT.dt(r.submitted_at))))));
      hp.append(ul);
    }
    pr.append(hp); w.append(pr);
  }

  // chúc mừng: lên cấp, xong nhiệm vụ hôm nay, mở khoá huy hiệu mới (mỗi việc chỉ một lần, nhớ trên máy)
  function celebrate() {
    if (!home || !sess) return;
    const key = (k) => "kt_" + k + "_" + sess.code;
    const I = KT.levelInfo(home.xp), prevL = store.get(key("lvl"), null);
    store.set(key("lvl"), I.L);
    if (prevL != null && I.L > prevL) { levelUp(prevL, I); KT.ui && KT.ui.confetti(); return; }
    const ms = home.mission, today = new Date().toDateString();
    if (ms && ms.status === "done" && store.get(key("msok"), null) !== today) {
      store.set(key("msok"), today);
      KT.ui && KT.ui.confetti(); KT.toast("Em đã hoàn thành nhiệm vụ hôm nay và nhận thêm 30 KN thưởng. Giỏi lắm!", "ok");
    }
    const got = badges().filter((b) => b.ok).map((b) => b.id), seen = store.get(key("badges"), null);
    store.set(key("badges"), got);
    if (seen) {
      const fresh = got.filter((id) => !seen.includes(id));
      if (fresh.length) {
        const b = badges().find((x) => x.id === fresh[0]);
        KT.ui && KT.ui.confetti(); KT.toast("Mở khoá huy hiệu mới: " + b.n + (fresh.length > 1 ? " và " + (fresh.length - 1) + " huy hiệu khác" : ""), "ok");
      }
    }
  }

  /* ---------------- thăng cấp + vinh danh ---------------- */
  const greet = () => { const hr = new Date().getHours(); return hr < 11 ? "Chào buổi sáng," : hr < 14 ? "Chào buổi trưa," : hr < 18 ? "Chào buổi chiều," : "Chào buổi tối,"; };
  // việc cần làm: tính từ dữ liệu thật, làm xong việc nào thì việc đó tự biến mất
  function todoBox(liveProm) {
    const box = h("div", { class: "todo" });
    const now = Date.now() + clockSkew, items = [];
    const add = (o) => items.push(o);
    (home.remedials || []).forEach((r) => add({ k: "rem", ic: "!", pri: 0, t: "Làm bài bổ sung bắt buộc", s: remNames(r).join("; "), go: () => startRemedial(r.id), cta: r.doing ? "Làm tiếp" : "Làm ngay" }));
    (home.assignments || []).forEach((a) => {
      const op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
      if (a.remedial || now < op || now > cl) return;
      if (!a.doing && a.done > 0) return;                  // đã nộp: xong việc
      const left = cl - now, urgent = left < 864e5;
      add({ k: "asg", ic: "✎", pri: urgent ? 1 : 2, urgent, t: (a.doing ? "Làm tiếp bài: " : "Bài thầy giao: ") + a.title,
        s: a.n_q + " câu, " + a.minutes + " phút. Hạn nộp " + KT.dt(a.closes_at) + (urgent ? ", sắp hết hạn" : ""), go: () => openAssignment(a), cta: a.doing ? "Làm tiếp" : "Làm bài" });
    });
    (home.doing || []).forEach((d) => add({ k: "doing", ic: "↻", pri: 2, t: "Làm tiếp: " + d.title, s: "Hết giờ lúc " + KT.dt(d.ends_at), go: () => viewAttempt(d.id), cta: "Làm tiếp" }));
    const ms = home.mission;
    if (!ms || ms.status === "doing") add({ k: "mis", ic: "★", pri: 3, t: "Nhiệm vụ hôm nay", s: ms ? "Em đang làm dở — làm tiếp cho xong nhé" : "Khoảng 12 câu trong 15 phút, giữ chuỗi " + (home.streak || 0) + " ngày học liên tiếp", go: startMission, cta: ms ? "Làm tiếp" : "Bắt đầu" });
    const due = (home.review || {}).due || 0;
    if (due) add({ k: "rev", ic: "⟲", pri: 4, t: "Ôn lại " + Math.min(due, 10) + " câu từng làm sai", s: due + " câu trong sổ câu sai đã đến hạn ôn", go: startReview, cta: "Ôn ngay" });
    const list = h("ul", { class: "todo-l" });
    const head = h("p", { class: "todo-h" });
    const draw = () => {
      items.sort((a, b) => a.pri - b.pri);
      list.innerHTML = ""; head.innerHTML = "";
      if (!items.length) {
        box.classList.add("clear");
        head.append(h("span", { class: "todo-done", html: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 22 L17 34 L44 5"/></svg>' }),
          h("span", {}, h("b", {}, "Hôm nay em đã xong hết việc."), h("span", {}, "Muốn học thêm thì chọn một đề tự luyện hoặc xem video ôn tập bên dưới.")));
        return;
      }
      box.classList.remove("clear");
      head.append("Hôm nay em có ", h("b", {}, items.length + " việc"), " cần làm. Làm xong việc nào, việc đó tự biến khỏi danh sách.");
      items.forEach((it, i) => list.append(h("li", { class: "todo-i " + it.k + (it.urgent ? " urgent" : ""), style: "--i:" + i, role: "button", tabindex: "0",
          onclick: it.go, onkeydown: (e) => { if (e.key === "Enter") it.go(); } },
        h("span", { class: "todo-box", "aria-hidden": "true" }),
        h("span", { class: "todo-tx" }, h("b", {}, it.t), h("small", {}, it.s)),
        h("span", { class: "todo-go" }, it.cta))));
    };
    draw();
    box.append(head, list);
    liveProm.then((ls) => { (ls || []).filter((x) => x.status === "live").forEach((x) => items.push({ k: "live", ic: "●", pri: -1, t: "Thầy đang dạy live: " + x.title, s: "Lớp đã bắt đầu, vào ngay để không lỡ bài", go: () => renderLive(x.id), cta: "Vào lớp" }));
      if (items.some((x) => x.k === "live")) { box.classList.remove("clear"); draw(); } });
    return box;
  }
  // đếm số chạy dần lên (hiệu ứng)
  function countUp(el, to, ms = 900) {
    to = +to || 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || to <= 0) { el.textContent = KT.num(to); return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = KT.num(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // thẻ hồ sơ: màu, khung, hiệu ứng theo bậc danh hiệu; KN và danh hiệu cộng dồn, không reset
  function levelCard() {
    const I = KT.levelInfo(home.xp), rk = home.rank || {}, tier = KT.tierOf(I.L), st = home.student || {};
    const total = h("b", {}, "0"), bar = h("i", { style: "width:0%" });
    const card = h("div", { class: "pcard pt" + tier, role: "button", tabindex: "0", title: "Xem hành trình danh hiệu",
      onclick: () => titleJourney(), onkeydown: (e) => { if (e.key === "Enter") titleJourney(); } },
      h("div", { class: "pc-top" },
        KT.levelBadge(I.L, "lg"),
        h("div", { class: "pc-id" },
          h("span", { class: "pc-lv" }, "Cấp " + I.L + ", bậc " + (tier + 1) + " trên 9"),
          h("b", { class: "pc-title" }, I.title),
          h("span", { class: "pc-name" }, st.name + (st.class ? ", lớp " + st.class : "")))),
      h("div", { class: "pc-xp" },
        h("div", { class: "pc-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(I.need), "aria-valuenow": String(I.cur) }, bar),
        h("span", {}, "Còn " + KT.num(I.toNext) + " KN nữa lên cấp " + (I.L + 1))),
      h("div", { class: "pc-stats" },
        h("div", {}, total, h("span", {}, "KN tích luỹ")),
        h("div", {}, h("b", {}, String(home.streak || 0)), h("span", {}, "ngày liên tiếp")),
        h("div", {}, h("b", {}, rk.all_rank ? "#" + rk.all_rank : "–"), h("span", {}, "hạng toàn trường"))),
      h("div", { class: "pc-foot" }, I.nextTitle ? "Đến cấp " + I.nextTitleAt + " em nhận danh hiệu " + I.nextTitle + "." : "Em đã đạt danh hiệu cao nhất."), h("span", { class: "pc-more" }, "Xem hành trình danh hiệu"));
    requestAnimationFrame(() => setTimeout(() => { bar.style.width = Math.round(I.pct * 100) + "%"; countUp(total, home.xp); }, 250));
    return card;
  }
  // hành trình 9 danh hiệu
  function titleJourney() {
    const I = KT.levelInfo(home.xp), ti = KT.tierOf(I.L);
    const list = h("ol", { class: "tj" });
    KT.TITLES.forEach(([lv, name], i) => {
      const next = KT.TITLES[i + 1], need = KT.lvXp(lv), got = i < ti ? "done" : i === ti ? "now" : "lock";
      const range = next ? "Cấp " + lv + "–" + (next[0] - 1) : "Cấp " + lv + " trở lên";
      list.append(h("li", { class: "tj-" + got, style: "--i:" + i },
        KT.levelBadge(lv, "md"),
        h("div", { class: "tj-tx" }, h("b", {}, name), h("span", {}, range + ", từ " + KT.num(need) + " KN")),
        h("span", { class: "tj-st" }, got === "done" ? "✓ Đã đạt" : got === "now" ? "Em đang ở đây" : "Còn " + KT.num(need - home.xp) + " KN")));
    });
    let close;
    close = KT.modal([h("div", { class: "tj-head" }, h("h3", {}, "Hành trình danh hiệu"),
        h("p", { class: "sub" }, "Kinh nghiệm (KN) được cộng dồn từ mọi bài em làm và không bao giờ bị trừ hay làm lại. Danh hiệu đã đạt sẽ theo em mãi. Riêng bảng “Đua top tuần” mới tính lại từ thứ Hai.")),
      list, h("div", { class: "acts" }, h("button", { class: "btn", onclick: () => close() }, "Đóng"))]);
    setTimeout(() => { const cur = list.querySelector(".tj-now"); if (cur) cur.scrollIntoView({ block: "center" }); }, 60);
  }
  function fameBlock() {
    const box = h("div", { class: "fame" });
    const myCls = home.student.class;
    const draw = () => {
      box.innerHTML = "";
      const rk = home.rank || {};
      const T = [["all", "🏆 Tổng tích luỹ"], ["week", "⚡ Đua top tuần"]].concat(myCls ? [["class", "Lớp " + myCls]] : []);
      const tabs = h("div", { class: "filters", role: "tablist" }, T.map(([k, l]) => h("button", { class: fameTab === k ? "on" : "", role: "tab", "aria-selected": String(fameTab === k), onclick: () => { fameTab = k; draw(); } }, l)));
      const key = fameTab === "week" ? "w" : "xp";
      const rows = (fameTab === "week" ? lboard.week : fameTab === "class" ? (lboard.all || []).filter((r) => r.class === myCls) : lboard.all) || [];
      const myRank = fameTab === "week" ? rk.week_rank : fameTab === "all" ? rk.all_rank : null;
      box.append(h("div", { class: "fame-head" }, tabs,
        h("span", { class: "fame-me" }, rk.hidden ? "Em đang được ẩn khỏi bảng vinh danh." : myRank ? "Em đang xếp hạng " + myRank + (fameTab === "week" ? " tuần này, " + KT.num(rk.week_xp) + " KN" : "") : fameTab === "class" ? "Bạn trong lớp em có mặt trong top 50." : "Làm bài để có tên trên bảng.")));
      if (rows.length >= 3) {
        const pod = h("ol", { class: "podium", "aria-label": "Ba bạn dẫn đầu" });
        [1, 0, 2].forEach((i) => { const r = rows[i], L = KT.lvOf(r.xp);
          pod.append(h("li", { class: "pd p" + (i + 1) }, h("span", { class: "pd-rk" }, String(i + 1)), KT.levelBadge(L, "md"), h("b", {}, r.name), h("small", {}, KT.titleOf(L) + (r.class ? ", lớp " + r.class : "")),
            h("span", { class: "pd-xp" }, KT.num(r[key]), " KN"), h("i", { class: "pd-step", "aria-hidden": "true" }))); });
        box.append(pod, KT.rankList(rows.slice(3, 10), key, { start: 3 }));
      } else box.append(KT.rankList(rows.slice(0, 10), key, { empty: fameTab === "week" ? "Tuần mới vừa bắt đầu. Ai làm bài đầu tiên sẽ đứng đầu bảng!" : undefined }));
      box.append(h("p", { class: "fame-note" }, fameTab === "week" ? "Bảng đua top tuần tính lại từ thứ Hai. KN và danh hiệu của em vẫn được giữ nguyên." : "Xếp theo tổng KN tích luỹ từ trước đến nay, không bao giờ reset. Chỉ hiện tên viết tắt."));
    };
    draw();
    return h("div", {}, secHead("Bảng vinh danh", "Các bạn học cùng thầy cô của em."), box);
  }
  function xpBlock(p, fresh) {
    const gained = +p.xp || 0, total = +p.student_xp || 0;
    const I = KT.levelInfo(total), before = KT.lvOf(total - gained);
    const el = h("div", { class: "xpgain" },
      h("div", { class: "xg-n" }, "+", h("span", { "data-count": gained }, KT.num(gained)), h("small", {}, " kinh nghiệm")),
      h("div", { class: "xg-lv" }, KT.levelBadge(I.L, "sm"), h("div", {},
        h("b", {}, "Cấp " + I.L + " · " + I.title),
        h("div", { class: "xpbar" }, h("i", { style: "width:" + Math.round(I.pct * 100) + "%" })),
        h("small", {}, "Còn " + KT.num(I.toNext) + " KN lên cấp " + (I.L + 1)))));
    if (fresh && I.L > before) setTimeout(() => levelUp(before, I), 600);
    return el;
  }
  function levelUp(from, I) {
    const newTitle = KT.titleOf(from) !== I.title;
    let close;
    close = KT.modal([h("div", { class: "lvup pt" + KT.tierOf(I.L) },
      h("div", { class: "lvup-burst", "aria-hidden": "true" }, Array.from({ length: 14 }, (_, i) => h("i", { style: "--a:" + (i * 360 / 14) + "deg" }))),
      KT.levelBadge(I.L, "xl"),
      h("h3", {}, "Lên cấp " + I.L + "!"),
      h("p", {}, newTitle ? "Em nhận danh hiệu mới: " : "Danh hiệu của em: ", h("b", {}, I.title)),
      I.nextTitle ? h("p", { class: "sub" }, "Cố lên! Đến cấp " + I.nextTitleAt + " em sẽ là " + I.nextTitle + ".") : null,
      h("div", { class: "acts" }, h("button", { class: "btn acc", onclick: () => close() }, "Tuyệt vời!")))]);
  }

  /* ---------------- nhiệm vụ hôm nay + sổ câu sai ---------------- */
  const hm = (d) => new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  async function startMission() {
    try {
      const p = await rpc("daily_mission", { p_grade: grade });
      lastCtx = null;
      if (p.status === "done") showResult(p); else startExam(p);
    } catch (e) { fail(e); }
  }
  async function startReview() {
    try { const p = await rpc("start_review", { p_n: 10 }); lastCtx = { review: true }; startExam(p); } catch (e) { fail(e); }
  }
  const figCache = {};
  function countsFor(lessons, mixGrades) {
    const set = new Set(lessons), c = { MC: 0, TF: 0, SA: 0 };
    for (const s of stats || []) if (set.has(s.g + "-" + s.l)) c[s.t] += s.n;
    return c;
  }
  function practiceCards(g) {
    const d = CUR[g]; const B = KT.blueprint;
    const cards = h("div", { class: "cards" });
    const cnt = (ls) => { const c = countsFor(ls); return c.MC + c.TF + c.SA; };
    const lsSel = h("select", { "aria-label": "Chọn bài" });
    for (const ch of d.chapters) {
      const og = h("optgroup", { label: "Chương " + romans[ch.no] + ". " + ch.name });
      ch.lessons.forEach((L) => { const n = cnt([g + "-" + L.no]); og.append(h("option", { value: L.no, disabled: n < 3 }, "Bài " + L.no + ". " + L.name + " (" + n + ")")); });
      lsSel.append(og);
    }
    const f1 = [...lsSel.querySelectorAll("option")].find((o) => !o.disabled); if (f1) lsSel.value = f1.value;
    const lsVid = h("div", { class: "vslot" });
    const drawLsVid = () => { lsVid.innerHTML = ""; const k = g + "-" + lsSel.value, b = KT.videoBtn(KT.videosFor(vids, [k]), "Video ôn · " + KT.lessonName(k), "btn ghost vbtn"); if (b) lsVid.append(b); };
    lsSel.addEventListener("change", drawLsVid); drawLsVid();
    cards.append(h("div", { class: "card" }, h("span", { class: "tag" }, "20 phút"), h("h3", {}, "Theo bài"), h("p", {}, g >= 10 ? "10 câu nhiều phương án, 2 đúng/sai, 2 trả lời ngắn." : "Khoảng 14 câu trắc nghiệm của một bài học."),
      h("div", { class: "row stack" }, lsSel, h("button", { class: "btn", disabled: !f1, onclick: () => setup(B.lesson(g, +lsSel.value)) }, "Làm bài"), lsVid)));
    const chSel = h("select", { "aria-label": "Chọn chương" });
    d.chapters.forEach((ch) => { const n = cnt(KT.chapterLessons(g, ch.no)); chSel.append(h("option", { value: ch.no, disabled: n < 5 }, "Chương " + romans[ch.no] + ". " + ch.name + " (" + n + ")")); });
    const f2 = [...chSel.options].find((o) => !o.disabled); if (f2) chSel.value = f2.value;
    cards.append(h("div", { class: "card" }, h("span", { class: "tag" }, "45 phút"), h("h3", {}, "Theo chương"), h("p", {}, "Tổng hợp các bài trong chương."),
      h("div", { class: "row stack" }, chSel, h("button", { class: "btn", disabled: !f2, onclick: () => setup(B.chapter(g, +chSel.value)) }, "Làm bài"))));
    const tb = (code, lab) => { const bp = B.term(g, code); return h("button", { class: "btn", disabled: cnt(bp.lessons) < 6, onclick: () => setup(bp) }, lab); };
    cards.append(h("div", { class: "card" }, h("span", { class: "tag" }, g >= 10 ? "90 phút · 12–4–6" : "90 phút"), h("h3", {}, "Giữa kì & cuối kì"), h("p", {}, "Đề định kì theo phạm vi từng học kì, thang 10."),
      h("div", { class: "terms" }, tb("GK1", "Giữa kì I"), tb("HK1", "Cuối kì I"), tb("GK2", "Giữa kì II"), tb("HK2", "Cuối kì II"))));
    cards.append(h("div", { class: "card" }, h("span", { class: "tag" }, "90 phút"), h("h3", {}, "Theo khối"), h("p", {}, "Đề tổng hợp cả năm Toán " + g + "."),
      h("div", { class: "row" }, h("button", { class: "btn", disabled: cnt(KT.lessonsOf(g)) < 6, onclick: () => setup(B.grade(g)) }, "Làm đề tổng hợp"))));
    if (g === 9) cards.append(h("div", { class: "card" }, h("span", { class: "tag acc" }, "90 phút"), h("h3", {}, "Ôn thi vào lớp 10"), h("p", {}, "Đề tổng hợp kiến thức lớp 9 (và một phần lớp 8)."),
      h("div", { class: "row" }, h("button", { class: "btn acc", disabled: cnt(KT.blueprint.ts10().lessons) < 6, onclick: () => setup(B.ts10()) }, "Thi thử"))));
    if (g >= 10) cards.append(h("div", { class: "card" }, h("span", { class: "tag acc" }, "90 phút · 22 câu"), h("h3", {}, "Thi tốt nghiệp THPT"), h("p", {}, "Cấu trúc 2025: 12 câu nhiều phương án, 4 câu đúng/sai, 6 câu trả lời ngắn."),
      h("div", { class: "row" }, h("button", { class: "btn acc", onclick: () => setup(B.tn()) }, "Thi thử"))));
    if (g >= 10) cards.append(dgnlCard());
    const gv = (vids || []).filter((v) => v.g === g);
    if (gv.length) cards.append(h("div", { class: "card" }, h("span", { class: "tag acc" }, gv.length + " video"), h("h3", {}, "Video ôn tập"),
      h("p", {}, "Video thầy giảng lại kiến thức các bài Toán " + g + ". Xem lại trước khi làm bài."),
      h("div", { class: "row" }, h("button", { class: "btn acc", onclick: () => videoLibrary(g) }, "Xem video"))));
    const agg = KT.aggMastery(home.mastery, g);
    const weak = agg.lessons.filter((x) => x.w >= 2 && x.m < 0.8).sort((a, b) => a.m - b.m).slice(0, 3);
    cards.append(h("div", { class: "card" + (weak.length ? "" : " disabled") }, h("span", { class: "tag" }, "Cá nhân hoá"), h("h3", {}, "Bài cải thiện"),
      h("p", {}, weak.length ? "Tập trung vào " + weak.map((x) => "Bài " + LESSON[x.key].l).join(", ") + " — các bài em đang yếu nhất, ưu tiên câu em từng làm sai." : "Làm vài bài lớp " + g + " để hệ thống biết em cần cải thiện phần nào."),
      h("div", { class: "row" }, h("button", { class: "btn", disabled: !weak.length, onclick: () => setup(improveBp(weak.map((x) => x.key))) }, "Làm bài cải thiện"))));
    return cards;
  }
  /* ---------------- thi thử ĐGNL ĐHQG-HCM ---------------- */
  function dgnlCard() {
    const D = KT.DGNL, have = (k) => (dstats && dstats[k] ? dstats[k].n : 0);
    const total = D.secs.reduce((a, x) => a + Math.min(have(x.k), x.n), 0);
    const sel = h("select", { "aria-label": "Chọn phần thi" }, D.secs.map((x) => h("option", { value: x.k, disabled: have(x.k) < 1 }, x.name + " (" + have(x.k) + " câu)")));
    const f = [...sel.options].find((o) => !o.disabled); if (f) sel.value = f.value;
    return h("div", { class: "card dgnl" }, h("span", { class: "tag acc" }, D.minutes + " phút · 120 câu"), h("h3", {}, "Thi thử ĐGNL ĐHQG-HCM"),
      h("p", {}, "Đủ 3 phần theo cấu trúc 2026: Sử dụng ngôn ngữ (Tiếng Việt 30, Tiếng Anh 30), Toán học 30, Tư duy khoa học 30."
        + (total && total < 120 ? " Ngân hàng hiện có " + total + "/120 câu nên đề sẽ ít câu hơn." : "")),
      h("div", { class: "row stack" }, h("button", { class: "btn acc", disabled: !total, onclick: () => startDgnl(KT.blueprint.dgnlFull()) }, "Thi thử đầy đủ"),
        sel, h("button", { class: "btn ghost", disabled: !f, onclick: () => startDgnl(KT.blueprint.dgnlPart(sel.value)) }, "Luyện riêng phần này")));
  }
  function startDgnl(bp) {
    const go = async () => {
      try { const p = await rpc("start_attempt", { p_blueprint: bp }); lastCtx = { bp }; afterStart(); startExam(p); }
      catch (e) { fail(e); }
    };
    if (noCredit()) return creditOut();
    KT.confirm(bp.title, "Đề gồm <b>" + bp.counts.MC + " câu trắc nghiệm</b> (" + esc(KT.bpScope(bp)) + "), làm trong <b>" + bp.minutes + " phút</b>. "
      + "Mỗi lần thi em nhận một đề khác nhau. Đồng hồ vẫn chạy nếu em thoát ra giữa chừng." + creditLine(), "Bắt đầu", go);
  }
  function improveBp(keys, extra) {
    const g = +keys[0].split("-")[0], one = keys.length === 1;
    return Object.assign({ kind: "Bài cải thiện", grade: g, title: one ? "Luyện tập cải thiện · " + KT.lessonName(keys[0]) : "Bài cải thiện tổng hợp · " + keys.map((k) => "B" + LESSON[k].l).join(", ") + " (Toán " + g + ")",
      lessons: keys, counts: one ? { MC: 8, TF: 2, SA: 2 } : { MC: 10, TF: 3, SA: 3 }, minutes: one ? 20 : 30, prefer_wrong: true }, extra || {});
  }

  /* ---------------- thư viện video của một khối ---------------- */
  function videoLibrary(g) {
    const gv = (vids || []).filter((v) => v.g === g);
    const box = h("div", {});
    for (const ch of CUR[g].chapters) {
      const items = gv.filter((v) => ch.lessons.some((L) => L.no === v.l));
      if (!items.length) continue;
      box.append(h("h4", { class: "vch" }, "Chương " + romans[ch.no] + ". " + ch.name));
      const grid = h("div", { class: "vgrid" });
      items.forEach((v) => grid.append(h("button", { type: "button", class: "vcard", onclick: () => { close(); KT.videoModal(items, "Chương " + romans[ch.no] + ". " + ch.name); } },
        h("span", { class: "vi" }, "▶"), h("span", {}, h("b", {}, v.title || "Video ôn tập"), h("small", {}, KT.lessonName(v.g + "-" + v.l))))));
      box.append(grid);
    }
    let close;
    close = KT.modal([h("div", { class: "vhead" }, h("h3", {}, "Video ôn tập · Toán " + g), h("button", { class: "btn ghost sm", onclick: () => close() }, "Đóng")), box], { wide: true });
  }

  /* ---------------- cấu hình đề tự luyện ---------------- */
  function setup(bp) {
    if (noCredit()) return creditOut();
    const av = countsFor(bp.levels ? [] : bp.lessons);
    const avail = bp.levels ? null : av;
    const base = avail ? KT.fitCounts(bp.counts, avail) : bp.counts;
    const inputs = {};
    const fld = (t) => h("div", {}, h("label", { for: "n" + t }, TYPE_SHORT[t]),
      inputs[t] = h("input", { type: "number", id: "n" + t, min: 0, max: 60, value: avail ? Math.min(base[t] || 0, avail[t]) : (base[t] || 0) }),
      avail ? h("div", { class: "avail" }, "Có sẵn: " + avail[t] + " câu") : null);
    const minIn = h("input", { type: "number", id: "nMin", min: 5, max: 180, value: bp.minutes });
    const short = avail ? ["MC", "TF", "SA"].filter((t) => (bp.counts[t] || 0) > avail[t]) : [];
    let close;
    close = KT.modal([h("h3", {}, bp.title), h("p", {}, KT.bpScope(bp)),
      short.length ? h("div", { class: "note" }, "Ngân hàng chưa đủ câu cho cấu trúc chuẩn — đề dùng số câu đang có.") : null,
      credit ? h("p", { class: "sub cr-note", html: creditLine() }) : null,
      h("div", { class: "grid3" }, fld("MC"), fld("TF"), fld("SA")),
      h("div", { style: "max-width:160px" }, h("label", { for: "nMin" }, "Thời gian (phút)"), minIn),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          const c = {}; for (const t of ["MC", "TF", "SA"]) c[t] = Math.max(0, Math.min(60, parseInt(inputs[t].value || "0", 10)));
          if (!c.MC && !c.TF && !c.SA) return;
          e.target.disabled = true;
          const b2 = Object.assign({}, bp, { counts: c, minutes: Math.max(5, Math.min(180, parseInt(minIn.value || bp.minutes, 10))) });
          try { const p = await rpc("start_attempt", { p_blueprint: b2 }); close(); lastCtx = { bp }; afterStart(); startExam(p); }
          catch (ex) { e.target.disabled = false; if (ex.data && ex.data.remedial) { close(); remErr(ex); } else fail(ex); }
        } }, "Bắt đầu làm bài"))]);
  }
  async function openAssignment(a) {
    const go = async () => {
      try { const p = await rpc("start_attempt", { p_assignment: a.id }); lastCtx = null; startExam(p); } catch (e) { remErr(e); }
    };
    if (a.doing) return go();
    KT.confirm(a.title, "Bài gồm <b>" + a.n_q + " câu</b>, làm trong <b>" + a.minutes + " phút</b>. Đồng hồ bắt đầu chạy khi em bấm Bắt đầu và vẫn chạy nếu em thoát ra.", "Bắt đầu", go);
  }
  async function viewAttempt(id) {
    try {
      const p = await rpc("get_attempt", { p_attempt: id });
      if (p.status === "doing") startExam(p); else showResult(p);
    } catch (e) { fail(e); }
  }


  /* ---------------- báo lỗi câu hỏi ---------------- */
  const reported = new Set(); let reportedLoaded = false;
  function reportDlg(p, it, num, btn) {
    let kind = "key", sug = null;
    const pickBox = h("div", { class: "rep-pick" });
    const drawPick = () => {
      pickBox.innerHTML = "";
      if (kind !== "key") return;
      pickBox.append(h("label", {}, "Theo em, đáp án đúng là:"));
      if (it.t === "MC") {
        const row = h("div", { class: "rep-mc" });
        it.o.forEach((o, i) => row.append(h("button", { type: "button", class: "opt sm" + (sug === i ? " sel" : ""), onclick: () => { sug = i; drawPick(); } }, h("span", { class: "L" }, "ABCD"[i]))));
        pickBox.append(row);
      } else if (it.t === "TF") {
        if (!Array.isArray(sug)) sug = Array.isArray(it.ans) ? it.ans.map((x) => (x == null ? null : x)) : [null, null, null, null];
        it.o.forEach((o, i) => pickBox.append(h("div", { class: "rep-tf" }, h("b", {}, "abcd"[i] + ")"),
          h("button", { type: "button", class: "t" + (sug[i] === true ? " on" : ""), onclick: () => { sug[i] = true; drawPick(); } }, "Đúng"),
          h("button", { type: "button", class: "f" + (sug[i] === false ? " on" : ""), onclick: () => { sug[i] = false; drawPick(); } }, "Sai"))));
      } else {
        const inp = h("input", { type: "text", value: sug ?? "", placeholder: "Đáp số em tính được", oninput: (e) => (sug = e.target.value) });
        pickBox.append(inp);
      }
    };
    const kinds = [["key", "Đáp án bị sai"], ["question", "Đề sai hoặc thiếu dữ kiện"], ["other", "Lỗi khác (hình, chữ, lời giải…)"]];
    const radios = h("div", { class: "rep-kinds" }, kinds.map(([v, l]) => h("label", { class: "chk" }, h("input", { type: "radio", name: "repk", value: v, checked: v === kind, onchange: () => { kind = v; drawPick(); } }), l)));
    const note = h("textarea", { rows: 3, maxlength: 500, placeholder: "Em giải thích ngắn gọn vì sao (không bắt buộc)" });
    drawPick();
    let close;
    close = KT.modal([h("h3", {}, "Báo lỗi câu " + (num + 1)), h("p", {}, "Thầy sẽ kiểm tra lại. Nếu đúng là câu bị lỗi, em được cộng 20 điểm kinh nghiệm và bài của em được chấm lại."),
      radios, pickBox, h("label", {}, "Ghi chú"), note,
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          let s = null;
          if (kind === "key") {
            if (it.t === "MC") { if (sug == null) return KT.toast("Em chọn đáp án em cho là đúng.", "bad"); s = sug; }
            else if (it.t === "TF") { if (!Array.isArray(sug) || sug.some((x) => x == null)) return KT.toast("Em chọn Đúng/Sai cho cả 4 ý.", "bad"); s = sug; }
            else { if (!String(sug || "").trim()) return KT.toast("Em nhập đáp số em tính được.", "bad"); s = String(sug).trim(); }
          } else if (!note.value.trim()) return KT.toast("Em ghi ngắn gọn lỗi ở đâu nhé.", "bad");
          e.target.disabled = true;
          try {
            await rpc("report_question", { p_attempt: p.id, p_idx: it.idx, p_kind: kind, p_suggest: s, p_note: note.value });
            close(); reported.add(it.qid);
            btn.textContent = "✓ Đã báo lỗi"; btn.disabled = true; btn.classList.add("done");
            KT.toast("Cảm ơn em! Thầy sẽ kiểm tra lại câu này.", "ok");
          } catch (ex) { e.target.disabled = false; fail(ex); }
        } }, "Gửi báo lỗi"))]);
  }

  /* ---------------- bài bổ sung ---------------- */
  const remNames = (r) => (r.detail && r.detail.length ? r.detail : (r.lessons || []).map((k) => ({ key: k })))
    .map((d) => KT.lessonName(d.key, true) + (d.m != null ? " (" + pct(d.m) + "%)" : ""));
  async function startRemedial(id) {
    try { const p = await rpc("start_remedial", { p_id: id }); lastCtx = null; if (p.status === "done") showResult(p); else startExam(p); }
    catch (e) { fail(e); if (sess) renderHome(); }
  }
  function remErr(e) {
    const rid = e && e.data && e.data.remedial;
    if (!rid) return fail(e);
    KT.confirm("Cần làm bài bổ sung trước", "Ở lần kiểm tra trước, em còn yếu một số bài học. Em hãy làm <b>bài bổ sung khoảng 10 câu</b> mức nhận biết – thông hiểu (20 phút) để củng cố, sau đó mới làm lại được bài kiểm tra.", "Làm bài bổ sung", () => startRemedial(rid));
  }
  function remedialBlock() {
    const box = h("div", { class: "remblock" }, h("div", { class: "rb-head" }, h("h2", {}, "Bài bổ sung cần làm"),
      h("p", {}, "Làm xong bài bổ sung thì em mới làm lại được bài kiểm tra tương ứng.")));
    home.remedials.forEach((r) => box.append(h("div", { class: "rb-item" },
      h("div", { class: "tx" }, h("b", {}, "Củng cố: " + remNames(r).join("; ")),
        h("span", {}, "Từ bài: " + (r.src_title || "") + (r.src_score != null ? " · " + fmt(r.src_score) + " điểm" : "") + " · " + KT.dt(r.created_at))),
      h("div", { class: "rb-acts" }, vSlot(r.lessons || [], "Video ôn trước khi làm bài bổ sung"),
        h("button", { class: "btn acc sm", onclick: () => startRemedial(r.id) }, r.doing ? "Làm tiếp" : "Làm bài bổ sung")))));
    return box;
  }
  function remedialCard(r, p) {
    const names = remNames(r);
    const retake = (r.retake_left || 0) > 0;
    if (r.status === "done") return h("div", { class: "remcard done" }, h("div", { class: "ic", "aria-hidden": "true" }, "✓"),
      h("div", { class: "tx" }, h("h3", {}, "Đã hoàn thành bài bổ sung"), h("p", {}, "Em đã củng cố " + names.join("; ") + (r.score != null ? " — đạt " + fmt(r.score) + " điểm." : ".") + (retake ? " Em có thể làm lại bài kiểm tra." : ""))),
      r.attempt_id ? h("button", { class: "btn ghost sm", onclick: () => viewAttempt(r.attempt_id) }, "Xem bài bổ sung") : null);
    return h("div", { class: "remcard" }, h("div", { class: "ic", "aria-hidden": "true" }, "!"),
      h("div", { class: "tx" }, h("h3", {}, "Bài bổ sung bắt buộc"),
        h("p", {}, "Em đang yếu: ", h("b", {}, names.join("; ")), ". Thầy giao khoảng 10 câu mức nhận biết – thông hiểu của " + (names.length > 1 ? "các bài này" : "bài này") + " (20 phút) để em củng cố."),
        h("p", { class: "muted" }, retake ? "Em cần hoàn thành bài bổ sung trước khi làm lại bài kiểm tra." : "Bài kiểm tra này đã hết lượt làm, nhưng em vẫn nên làm bài bổ sung để không bị hổng kiến thức.")),
      h("div", { class: "rb-acts" }, vSlot(r.lessons || [], "Xem video ôn trước khi làm bài bổ sung", "btn ghost vbtn"),
        h("button", { class: "btn acc", onclick: () => startRemedial(r.id) }, r.doing ? "Làm tiếp" : "Làm bài bổ sung ngay")));
  }
  function remDoneBlock(p) {
    const r = p.remedial_of;
    const box = h("div", { class: "remcard done" }, h("div", { class: "ic", "aria-hidden": "true" }, "✓"),
      h("div", { class: "tx" }, h("h3", {}, "Hoàn thành bài bổ sung!"), h("p", {}, "Em vừa củng cố " + remNames(r).join("; ") + ". Bây giờ em có thể làm lại bài kiểm tra “" + (r.src_title || "") + "”.")));
    const btn = h("button", { class: "btn acc", onclick: async () => {
      btn.disabled = true;
      try {
        let pp;
        if (r.assignment_id) pp = await rpc("start_attempt", { p_assignment: r.assignment_id });
        else if (r.src_bp) pp = await rpc("start_attempt", { p_blueprint: r.src_bp });
        else return;
        lastCtx = r.src_bp ? { bp: r.src_bp } : null; startExam(pp);
      } catch (e) { btn.disabled = false; remErr(e); }
    } }, "Làm lại bài kiểm tra");
    if ((r.retake_left || 0) > 0 && (r.assignment_id || r.src_bp)) box.append(btn);
    else if (r.assignment_id) box.querySelector("p").textContent = "Em vừa củng cố " + remNames(r).join("; ") + ". Bài kiểm tra “" + (r.src_title || "") + "” đã hết lượt làm hoặc đã đóng.";
    return box;
  }

  /* ---------------- làm bài ---------------- */
  const localKey = () => "kt_ans_" + cur.id;
  function startExam(p) {
    cur = p; dirty = new Set();
    clockSkew = new Date(p.server_now).getTime() - Date.now();
    const backup = store.get(localKey(), null);        // khôi phục câu trả lời chưa kịp gửi
    if (backup) for (const [idx, a] of Object.entries(backup)) { const it = cur.items.find((x) => x.idx === +idx); if (it) { it.ans = a; dirty.add(+idx); } }
    renderExam();
    if (dirty.size) scheduleSave(200);
  }
  function onChange(it, flagOnly) {
    if (!flagOnly) {
      dirty.add(it.idx);
      const b = store.get(localKey(), {}); b[it.idx] = it.ans; store.set(localKey(), b);
      scheduleSave(1200);
    }
    updNav();
  }
  function scheduleSave(ms) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, ms); }
  const saveEl = h("span", { class: "savest" });
  function setSave(s, cls) { saveEl.textContent = s; saveEl.className = "savest " + (cls || ""); }
  async function flush() {
    if (!cur || cur.status !== "doing" || !dirty.size || saving) return;
    saving = true;
    const idxs = [...dirty]; dirty.clear();
    const payload = idxs.map((i) => { const it = cur.items.find((x) => x.idx === i); return { idx: i, ans: it.ans ?? null, conf: it.conf ?? null }; });
    setSave("Đang lưu…");
    try {
      const r = await rpc("save_answers", { p_attempt: cur.id, p_answers: payload });
      takeEnd(r);
      setSave("Đã lưu ✓", "ok");
      const b = store.get(localKey(), {}); idxs.forEach((i) => { if (!dirty.has(i)) delete b[i]; }); store.set(localKey(), b);
    } catch (e) {
      idxs.forEach((i) => dirty.add(i));
      if (e.data && e.data.closed) { setSave("Bài đã đóng", "bad"); submit(true); }
      else { setSave("Mất kết nối — sẽ thử lại", "bad"); scheduleSave(4000); }
      if (/SESSION_EXPIRED/.test(e.message)) fail(e);
    }
    saving = false;
    if (dirty.size) scheduleSave(1500);
  }
  let updNav = () => { };
  function renderExam() {
    stopTimers(); window.scrollTo(0, 0); app.innerHTML = ""; setWho();
    const timerEl = h("span", { class: "timer", role: "timer" }, "--:--");
    const progEl = h("span", { class: "prog" });
    setSave("Đã lưu ✓", "ok");
    const guardEl = h("span", { class: "guard", title: "Mỗi lần em chuyển sang tab hoặc ứng dụng khác đều được ghi lại và thầy sẽ thấy." });
    const head = h("div", { class: "exam-head" }, h("div", { class: "wrap" }, h("h2", {}, cur.title), guardEl, saveEl, progEl, timerEl,
      h("button", { class: "btn acc sm", onclick: askSubmit }, "Nộp bài")));
    // hiển thị từng câu một: trả lời xong mới sang câu tiếp theo (không xem được cả đề cùng lúc)
    const n = cur.items.length;
    const reach = () => { let i = 0; while (i < n && KT.answered(cur.items[i]) === 2) i++; return Math.min(i, n - 1); };
    let pos = reach();
    const rng = cur.exam ? KT.groupRange(cur.items) : {};
    const stage = h("div", { class: "one-q" });
    const hint = h("span", { class: "onehint" });
    const prevB = h("button", { type: "button", class: "btn ghost", onclick: () => go(pos - 1) }, "← Câu trước");
    const nextB = h("button", { type: "button", class: "btn", onclick: () => (pos === n - 1 ? askSubmit() : go(pos + 1)) }, "Câu tiếp theo →");
    const go = (i) => {
      if (i < 0 || i >= n || i === pos) return;
      if (i > reach()) return KT.toast("Em trả lời xong câu " + (reach() + 1) + " mới sang được câu tiếp theo.", "bad");
      pos = i; draw();
    };
    const sectionLabel = (it) => {
      if (cur.exam) { const S = KT.dgnlSec(it.sec); return S.part + " · " + S.name; }
      return PART[it.t] + ". " + TYPES[it.t];
    };
    const draw = () => {
      stage.innerHTML = "";
      const it = cur.items[pos];
      stage.append(h("div", { class: "one-top" }, h("span", { class: "one-sec" }, sectionLabel(it)), h("span", { class: "one-pos" }, "Câu " + (pos + 1) + " / " + n)));
      if (it.grp && cur.passages && cur.passages[it.grp]) stage.append(KT.passageBlock(cur.passages[it.grp], rng[it.grp][0], rng[it.grp][1]));
      stage.append(KT.qBlock(it, pos, "exam", onChange));
      KT.typeset(stage, cur.figs);
      updNav();
      const top = stage.getBoundingClientRect().top + window.scrollY - 150;
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    const grid = h("div", { class: "navgrid" });
    cur.items.forEach((it, i) => grid.append(h("button", { type: "button", onclick: () => go(i) }, String(i + 1))));
    const nav = h("aside", { class: "navbox" }, h("h4", {}, "Danh sách câu"), grid,
      h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--brand)" }), "Đã làm"), h("span", {}, h("i", { style: "background:var(--surface-2);border:1px solid var(--line-2)" }), "Chưa làm"), h("span", {}, h("i", { style: "background:var(--accent)" }), "Đánh dấu")),
      h("p", { class: "sub", style: "margin:8px 0 10px;font-size:12.5px" }, "Mỗi lần chỉ hiện một câu. Em trả lời xong mới sang được câu tiếp theo; có thể quay lại các câu đã làm."),
      h("button", { class: "btn acc", onclick: askSubmit }, "Nộp bài"));
    updNav = () => {
      let done = 0; const r = reach();
      cur.items.forEach((it, i) => { const a = KT.answered(it); if (a === 2) done++;
        grid.children[i].className = (a === 2 ? "done" : "") + (it.flag ? " flagged" : "") + (i === pos ? " cur" : "") + (i > r ? " locked" : "");
        grid.children[i].disabled = i > r; });
      progEl.textContent = "Đã làm " + done + "/" + n;
      const ok = KT.answered(cur.items[pos]) === 2;
      prevB.disabled = pos === 0;
      nextB.textContent = pos === n - 1 ? "Nộp bài" : "Câu tiếp theo →";
      nextB.className = "btn" + (pos === n - 1 ? " acc" : "");
      nextB.disabled = !ok && pos < n - 1;
      hint.textContent = ok ? "" : cur.items[pos].t === "TF" ? "Chọn Đúng/Sai cho cả 4 ý để sang câu tiếp theo." : cur.items[pos].t === "SA" ? "Nhập đáp số để sang câu tiếp theo." : "Chọn một phương án để sang câu tiếp theo.";
    };
    const list = h("div", {}, stage, h("div", { class: "one-nav" }, prevB, hint, nextB));
    app.append(head, h("div", { class: "wrap exam-grid" }, h("div", {}, list), nav));
    draw();
    startGuard(guardEl);
    examEnd = new Date(cur.ends_at).getTime();
    let checking = false;
    const tick = async () => {
      const left = Math.max(0, examEnd - (Date.now() + clockSkew));
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      timerEl.classList.toggle("low", left < 5 * 60000);
      if (left <= 0 && !checking) {
        checking = true; const before = examEnd; await beat(); checking = false;   // hỏi lại lần cuối: có thể thầy vừa cộng giờ
        if (examEnd > before && examEnd - (Date.now() + clockSkew) > 0) return;
        stopTimers(); submit(true);
      }
    };
    tick(); timerId = setInterval(tick, 1000); beatId = setInterval(beat, 45000);
  }
  function askSubmit() {
    const miss = cur.items.filter((it) => KT.answered(it) < 2).length;
    KT.confirm("Nộp bài?", miss ? "Em còn <b>" + miss + "</b> câu chưa làm xong. Nộp bài luôn?" : "Em đã làm hết các câu. Nộp bài để xem kết quả.", "Nộp bài", () => submit(false), "Làm tiếp");
  }
  async function submit(auto, tries = 0) {
    stopTimers();
    if (!cur || cur.status !== "doing") return;
    const all = cur.items.map((it) => ({ idx: it.idx, ans: it.ans ?? null, conf: it.conf ?? null }));
    app.querySelectorAll(".exam-head .btn, .navbox .btn").forEach((b) => (b.disabled = true));
    setSave("Đang nộp bài…");
    try {
      const p = await rpc("submit_attempt", { p_attempt: cur.id, p_answers: all });
      store.del(localKey()); store.del("kt_focus_" + cur.id); cur = null;
      showResult(p, auto, true);
    } catch (e) {
      if (/SESSION_EXPIRED/.test(e.message)) return fail(e);
      setSave("Chưa nộp được — đang thử lại…", "bad");
      if (tries < 20) setTimeout(() => submit(auto, tries + 1), 3000);
      else KT.toast("Không nộp được bài. Kiểm tra mạng rồi bấm Nộp bài lần nữa.", "bad");
      app.querySelectorAll(".exam-head .btn, .navbox .btn").forEach((b) => (b.disabled = false));
    }
  }

  /* ---------------- kết quả ---------------- */
  function showResult(p, auto, fresh) {
    stopTimers(); cur = null; window.scrollTo(0, 0); app.innerHTML = ""; setWho();
    if (p.exam) return dgnlResult(p, auto, fresh);
    const ev = KT.evalPayload(p);
    const w = h("section", { class: "wrap" });
    const s = +p.score;
    const rank = s >= 9 ? "Xuất sắc" : s >= 8 ? "Giỏi" : s >= 6.5 ? "Khá" : s >= 5 ? "Trung bình" : s >= 3.5 ? "Yếu" : "Kém";
    const nOk = p.items.filter((r) => r.status === "ok").length;
    const dur = Math.round((new Date(p.submitted_at) - new Date(p.started_at)) / 1000);
    w.append(h("div", { class: "review-t", style: "margin-top:22px" }, h("h2", { style: "margin:0;font-size:22px" }, p.title), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: renderHome }, "Về trang chủ"),
      lastCtx && lastCtx.bp && lastCtx.bp.paper ? h("button", { class: "btn ghost sm", onclick: () => go("learn") }, "Chọn đề khác") : null,
      lastCtx && lastCtx.bp && lastCtx.bp.paper ? h("button", { class: "btn sm", onclick: async (e) => {
        e.currentTarget.disabled = true; const bp = lastCtx.bp; delete paperCache[bp.grade];
        if (noCredit()) { e.target.disabled = false; return creditOut(); }
        try { const r = await rpc("start_attempt", { p_blueprint: bp }); lastCtx = { bp }; afterStart(); startExam(r); } catch (ex) { e.target.disabled = false; fail(ex); } } }, "Làm lại đề này") : null,
      lastCtx && lastCtx.bp && !lastCtx.bp.paper ? h("button", { class: "btn sm", onclick: () => (lastCtx.bp.exam ? startDgnl(lastCtx.bp) : setup(lastCtx.bp)) }, "Làm đề khác cùng loại") : null));
    if (auto) w.append(h("div", { class: "note" }, "Hết giờ — bài đã được nộp tự động."));
    const nRv = p.items.filter((x) => x.rv), nWrong = p.items.filter((x) => !x.rv && (x.status === "bad" || x.status === "part")).length;
    if (nRv.length || nWrong) {
      const okRv = nRv.filter((x) => x.status === "ok").length, badRv = nRv.filter((x) => x.status === "bad" || x.status === "part").length, skRv = nRv.length - okRv - badRv;
      const parts = [];
      if (okRv) parts.push(okRv + " câu đúng được hẹn ôn xa hơn");
      if (badRv) parts.push(badRv + " câu sai quay lại ôn từ ngày mai");
      if (skRv) parts.push(skRv + " câu bỏ trống vẫn chờ em ôn");
      const txt = (nRv.length ? "Câu ôn lại: đúng " + okRv + "/" + nRv.length + (parts.length ? ". " + parts.join(", ") : "") + ". " : "")
        + (nWrong ? nWrong + " câu sai đã vào Sổ câu sai, em sẽ được nhắc ôn lại từ ngày mai." : "");
      w.append(h("div", { class: "bknote" }, h("span", {}, txt), h("button", { class: "btn ghost sm", onclick: renderBook }, "Xem sổ")));
    }
    const kp = h("div", { class: "kpis" });
    kp.append(kpi(nOk + "/" + p.items.length, "Câu đúng hoàn toàn", nOk / p.items.length));
    for (const t of ["MC", "TF", "SA"]) {
      const its = p.items.filter((x) => x.t === t); if (!its.length) continue;
      const a = its.reduce((x, it) => x + it.pts[0], 0), b = its.reduce((x, it) => x + it.pts[1], 0);
      kp.append(kpi(fmt(a) + " / " + fmt(b) + " đ", PART[t] + " · " + TYPE_SHORT[t], a / b));
    }
    kp.append(kpi(Math.floor(dur / 60) + " phút " + (dur % 60) + " giây", "Thời gian làm bài", null));
    w.append(h("div", { class: "res-top" }, h("div", { class: "score" }, h("div", { class: "big" }, fmt(s), h("small", {}, " /10")), h("div", { class: "lab" }, (sess ? sess.name : "") + " · " + p.kind), h("div", { class: "rank" }, "Xếp loại: " + rank)), kp));
    if (p.xp != null) w.append(xpBlock(p, fresh));
    if (p.remedial_of) w.append(remDoneBlock(p));
    const multiG0 = new Set(p.items.map((x) => x.g)).size > 1;
    const lRows = Object.entries(ev.byL).map(([k, v]) => ({ label: KT.lessonName(k, multiG0), m: v.m / v.w, sub: v.ok + "/" + v.n + " câu đúng hoàn toàn" })).sort((a, b) => a.m - b.m);
    if (lRows.length) {
      w.append(h("div", { class: "section-t" }, "Phân tích theo bài học"));
      const vbox = h("div", {});
      w.append(h("div", { class: "panel" }, h("p", { class: "muted", style: "margin:0 0 10px" }, "Tỉ lệ điểm em đạt được ở từng bài trong đề này (bài yếu nhất ở trên)."), KT.hbars(lRows), KT.statusLegend(), vbox));
      const weakKeys = Object.entries(ev.byL).filter(([, v]) => v.m / v.w < 0.8).sort((a, b) => a[1].m / a[1].w - b[1].m / b[1].w).map(([k]) => k);
      loadVids().then((v) => {
        const chips = weakKeys.map((k) => { const list = KT.videosFor(v, [k]); if (!list.length) return null;
          return h("button", { type: "button", class: "btn ghost sm vbtn", onclick: () => KT.videoModal(list, "Video ôn · " + KT.lessonName(k, multiG0)) },
            "▶ " + (multiG0 ? "Lớp " + k.split("-")[0] + " · " : "") + "Bài " + k.split("-")[1] + (list.length > 1 ? " (" + list.length + " video)" : "")); }).filter(Boolean);
        if (!chips.length) return;
        vbox.append(h("div", { class: "vtip" }, h("b", {}, "Xem lại video bài em còn yếu:"), h("div", { class: "vchips" }, chips)));
      });
    }
    if (p.remedial) w.append(remedialCard(p.remedial, p));

    // đa giác
    w.append(h("div", { class: "section-t" }, "Thống kê đa giác điểm mạnh – điểm yếu"));
    const lessonList = Object.entries(ev.byL).map(([k, v]) => ({ key: k, m: v.m / v.w, w: v.w }));
    const cAx = KT.contentAxes(lessonList);
    const prof = home ? KT.aggMastery(home.mastery) : null;
    const profAx = prof ? Object.fromEntries(KT.contentAxes(prof.lessons).map((a) => [a.key, a.m])) : {};
    const hasProf = prof && prof.lessons.length;
    const sAx = KT.skillAxes(ev.byLv, ev.byT);
    const profS = prof ? Object.fromEntries(KT.skillAxes(prof.levels, prof.types).map((a) => [a.key, a.m])) : {};
    const multiG = new Set(p.items.map((x) => x.g)).size > 1;
    w.append(h("div", { class: "radars" },
      KT.radarPanel("Theo nội dung kiến thức", cAx.length && cAx[0].key.includes("C") ? "Gom theo chương" : "Theo từng bài học", cAx, hasProf ? cAx.map((a) => ({ v: profAx[a.key] })) : null, hasProf ? "Trung bình các bài trước" : null),
      KT.radarPanel("Theo mức độ & dạng câu", "Nhận biết → Vận dụng cao; ba dạng câu hỏi", sAx, hasProf ? sAx.map((a) => ({ v: profS[a.key] })) : null, hasProf ? "Trung bình các bài trước" : null)));
    const all = cAx.map((a) => ({ name: a.full, m: a.m })).concat(sAx.map((a) => ({ name: (LV[a.key] ? "Mức " : "Dạng ") + a.label.toLowerCase(), m: a.m })));
    const strong = all.filter((x) => x.m >= 0.8).sort((a, b) => b.m - a.m), weakA = all.filter((x) => x.m < 0.6).sort((a, b) => a.m - b.m);
    const li = (x, cls, lab) => h("li", {}, h("span", { class: "nm" }, x.name), h("span", { class: "pill " + cls }, lab), h("span", { class: "pct" }, pct(x.m) + "%"));
    w.append(h("div", { class: "sw-list" },
      h("div", { class: "panel" }, h("h3", {}, "Điểm mạnh"), strong.length ? h("ul", {}, strong.slice(0, 6).map((x) => li(x, "ok", "Vững"))) : h("div", { class: "empty" }, "Chưa có nội dung đạt từ 80% trở lên.")),
      h("div", { class: "panel" }, h("h3", {}, "Cần cải thiện"), weakA.length ? h("ul", {}, weakA.slice(0, 6).map((x) => li(x, x.m < 0.35 ? "bad" : "warn", x.m < 0.35 ? "Hổng" : "Chưa chắc"))) : h("div", { class: "empty" }, "Không có nội dung dưới 60%. Rất tốt!"))));

    // độ chắc chắn
    const withConf = p.items.filter((x) => x.conf === 0 || x.conf === 1);
    if (withConf.length) {
      const isOk = (x) => x.status === "ok";
      const cnt = (c, ok) => withConf.filter((x) => x.conf === c && isOk(x) === ok).length;
      const cw = cnt(1, false);
      const cell = (n, l, d, cls) => h("div", { class: "cq " + cls }, h("b", {}, String(n)), h("span", {}, l), h("small", {}, d));
      w.append(h("div", { class: "section-t" }, "Em có thực sự chắc chắn?"));
      w.append(h("div", { class: "confgrid" },
        cell(cnt(1, true), "Chắc chắn và đúng", "Kiến thức vững", "ok"),
        cell(cw, "Chắc chắn nhưng sai", "Hiểu nhầm, cần xem kĩ lời giải", "cw"),
        cell(cnt(0, true), "Đoán mà đúng", "Chưa thực sự vững, nên ôn lại", "guess"),
        cell(cnt(0, false), "Đoán và sai", "Phần em cần học thêm", "bad")));
      if (withConf.length < p.items.length) w.append(h("p", { class: "foot", style: "padding:6px 0 0;text-align:left" }, (p.items.length - withConf.length) + " câu em chưa chọn mức chắc chắn."));
    }

    // đề xuất
    w.append(h("div", { class: "section-t" }, "Đề xuất bài cải thiện"));
    const rb = h("div", { class: "recs" });
    recs(p, ev, multiG).forEach((r) => rb.append(h("div", { class: "rec" }, h("div", { class: "tx" }, h("b", {}, r.title), h("span", {}, r.text)), h("button", { class: "btn acc sm", onclick: () => setup(r.bp) }, r.label))));
    w.append(rb);

    // xem lại
    w.append(h("div", { class: "section-t" }, "Xem lại bài làm" + (p.keys ? " & đáp án" : "")));
    if (!p.keys) w.append(h("div", { class: "note" }, "Giáo viên chưa cho xem đáp án của bài này."));
    const rv = reviewList(p, multiG);
    w.append(...rv.el);
    w.append(h("p", { class: "foot" }, "* Mức độ có dấu sao là mức ước lượng."));
    app.append(w); rv.show(() => true); KT.typeset(w, p.figs);
    // làm mới hồ sơ ngầm
    rpc("student_home").then((d) => (home = d)).catch(() => { });
  }
  function reviewList(p, multiG) {
    const fl = h("div", { class: "filters" }), listBox = h("div", { style: "margin-top:12px" });
    const mk = (lab, f) => h("button", { onclick: (e) => { fl.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.target.classList.add("on"); show(f); } }, lab);
    fl.append(mk("Tất cả", () => true), mk("Sai / chưa đủ", (r) => r.status === "bad" || r.status === "part"), mk("Chưa làm", (r) => r.status === "skip"), mk("Đúng", (r) => r.status === "ok"));
    if (p.items.some((r) => r.conf === 1 && (r.status === "bad" || r.status === "part"))) fl.append(mk("Tưởng đúng mà sai", (r) => r.conf === 1 && (r.status === "bad" || r.status === "part")));
    if (p.exam) KT.DGNL.secs.filter((S) => p.items.some((x) => x.sec === S.k)).forEach((S) => fl.append(mk(S.name, (r) => r.sec === S.k)));
    fl.firstChild.classList.add("on");
    const canRep = p.status === "done" && !!sess;
    const rng = KT.groupRange(p.items);
    const show = (f) => {
      listBox.innerHTML = ""; const seen = new Set();
      p.items.forEach((it, i) => {
        if (!f(it)) return;
        if (it.grp && !seen.has(it.grp) && p.passages && p.passages[it.grp]) { seen.add(it.grp); listBox.append(KT.passageBlock(p.passages[it.grp], rng[it.grp][0], rng[it.grp][1])); }
        listBox.append(KT.qBlock(it, i, "review", null, { withGrade: multiG, pts: p.exam ? null : it.pts, onReport: canRep ? (x, btn) => reportDlg(p, x, i, btn) : null, reported: reported.has(it.qid) }));
      });
      if (!listBox.children.length) listBox.append(h("div", { class: "empty" }, "Không có câu nào."));
      KT.typeset(listBox, p.figs);
    };
    if (canRep && !reportedLoaded) rpc("my_reports").then((rs) => { reportedLoaded = true; (rs || []).forEach((r) => r.status === "open" && reported.add(r.qid));
      if (reported.size && fl.querySelector(".on")) fl.querySelector(".on").click(); }).catch(() => { });
    return { el: [fl, listBox], show };
  }
  function dgnlResult(p, auto, fresh) {
    const ev = KT.evalPayload(p);
    const w = h("section", { class: "wrap" });
    const n = p.items.length, nOk = p.items.filter((r) => r.status === "ok").length, nSkip = p.items.filter((r) => r.status === "skip").length;
    const full = n >= 100, scale = Math.round(nOk * 10);
    const dur = Math.round((new Date(p.submitted_at) - new Date(p.started_at)) / 1000);
    w.append(h("div", { class: "review-t", style: "margin-top:22px" }, h("h2", { style: "margin:0;font-size:22px" }, p.title), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: renderHome }, "Về trang chủ"),
      lastCtx && lastCtx.bp && lastCtx.bp.exam ? h("button", { class: "btn sm", onclick: () => startDgnl(lastCtx.bp) }, "Làm đề khác") : null));
    if (auto) w.append(h("div", { class: "note" }, "Hết giờ — bài đã được nộp tự động."));
    const kp = h("div", { class: "kpis" });
    KT.DGNL.secs.forEach((S) => { const v = ev.bySec[S.k]; if (v) kp.append(kpi(v.ok + "/" + v.n, S.name, v.ok / v.n)); });
    kp.append(kpi(Math.floor(dur / 60) + " phút " + (dur % 60) + " giây", "Thời gian làm bài", null));
    w.append(h("div", { class: "res-top" }, h("div", { class: "score" },
      h("div", { class: "big" }, full ? String(scale) : nOk + "", h("small", {}, full ? " /1200" : " /" + n)),
      h("div", { class: "lab" }, (sess ? sess.name : "") + " · " + p.kind),
      h("div", { class: "rank" }, full ? "Ước tính: mỗi câu đúng 10 điểm" : "Thang 10: " + fmt(+p.score))), kp));
    w.append(h("p", { class: "muted", style: "margin:8px 0 0" }, "Đúng " + nOk + "/" + n + " câu" + (nSkip ? ", bỏ trống " + nSkip + " câu" : "") + ". "
      + (full ? "Điểm thi thật được ĐHQG-HCM quy đổi theo độ khó từng câu, nên điểm này chỉ mang tính tham khảo." : "")));
    if (p.xp != null) w.append(xpBlock(p, fresh));
    const rows = KT.DGNL.secs.filter((S) => ev.bySec[S.k]).map((S) => ({ label: S.name, m: ev.bySec[S.k].ok / ev.bySec[S.k].n, sub: ev.bySec[S.k].ok + "/" + ev.bySec[S.k].n + " câu đúng" }));
    if (rows.length > 1) w.append(h("div", { class: "section-t" }, "Kết quả theo phần thi"), h("div", { class: "panel" }, KT.hbars(rows.slice().sort((a, b) => a.m - b.m)), KT.statusLegend()));
    const weak = rows.filter((r) => r.m < 0.6).sort((a, b) => a.m - b.m);
    if (weak.length) {
      const rb = h("div", { class: "recs" });
      weak.slice(0, 3).forEach((r) => { const S = KT.DGNL.secs.find((x) => x.name === r.label);
        rb.append(h("div", { class: "rec" }, h("div", { class: "tx" }, h("b", {}, r.label), h("span", {}, "Đạt " + pct(r.m) + "%. Luyện riêng phần này để cải thiện.")),
          h("button", { class: "btn acc sm", onclick: () => startDgnl(KT.blueprint.dgnlPart(S.k)) }, "Luyện phần này"))); });
      w.append(h("div", { class: "section-t" }, "Đề xuất luyện tập"), rb);
    }
    w.append(h("div", { class: "section-t" }, "Xem lại bài làm" + (p.keys ? " & đáp án" : "")));
    if (!p.keys) w.append(h("div", { class: "note" }, "Giáo viên chưa cho xem đáp án của bài này."));
    const rv = reviewList(p, false);
    w.append(...rv.el);
    app.append(w); rv.show(() => true);
    rpc("student_home").then((d) => (home = d)).catch(() => { });
  }
  function kpi(n, l, frac) { return h("div", { class: "kpi" }, h("div", { class: "n" }, n), h("div", { class: "l" }, l), frac != null ? h("div", { class: "bar" }, h("i", { style: "width:" + pct(frac) + "%" })) : null); }
  function recs(p, ev, multiG) {
    const out = [];
    const lessons = Object.entries(ev.byL).map(([k, v]) => ({ key: k, m: v.m / v.w, n: v.n, ok: v.ok }));
    const weak = lessons.filter((x) => x.m < 0.8).sort((a, b) => a.m - b.m);
    weak.slice(0, 4).forEach((x) => {
      const acc = {};
      p.items.forEach((it) => { if (it.g + "-" + it.l !== x.key) return; (acc[it.lv] = acc[it.lv] || [0, 0]); acc[it.lv][0] += +it.m; acc[it.lv][1]++; });
      const lw = Object.entries(acc).map(([k, [m, n]]) => [k, m / n]).sort((a, b) => a[1] - b[1])[0];
      out.push({ title: KT.lessonName(x.key, multiG), text: "Đạt " + pct(x.m) + "% (" + x.ok + "/" + x.n + " câu đúng hoàn toàn)" + (lw && lw[1] < 0.6 ? ". Cần luyện thêm câu mức " + LV[lw[0]] + "." : "."), label: "Luyện bài này", bp: improveBp([x.key]) });
    });
    if (weak.length >= 2) out.push({ title: "Bài cải thiện tổng hợp", text: "Gộp các bài yếu nhất vào một đề 16 câu, ưu tiên câu em vừa làm sai.", label: "Làm bài tổng hợp", bp: improveBp(weak.slice(0, 4).map((x) => x.key)) });
    const scope = lessons.map((x) => x.key);
    const lv = (k) => (ev.byLv[k] ? ev.byLv[k].m / ev.byLv[k].w : null);
    const vd = [lv("VD"), lv("VDC")].filter((x) => x != null);
    if (vd.length && Math.min(...vd) < 0.5) out.push({ title: "Câu hỏi vận dụng", text: "Tỉ lệ đúng ở mức vận dụng còn thấp (" + pct(Math.min(...vd)) + "%). Luyện riêng các câu VD/VDC.", label: "Luyện vận dụng",
      bp: improveBp(scope, { title: "Luyện câu vận dụng", kind: "Bài cải thiện", levels: ["VD", "VDC"], counts: { MC: 6, TF: 2, SA: 4 }, minutes: 30 }) });
    for (const t of ["TF", "SA"]) {
      const v = ev.byT[t]; if (!v) continue; const m = v.m / v.w;
      if (m < 0.6) out.push({ title: "Dạng " + TYPES[t].toLowerCase(), text: "Em mới đạt " + pct(m) + "% ở dạng này. " + (t === "TF" ? "Đọc kĩ từng ý — mỗi ý sai đều làm giảm điểm cả câu." : "Kiểm tra lại cách làm tròn và dấu của đáp số."), label: "Luyện dạng này",
        bp: improveBp(scope, { title: "Luyện dạng " + TYPE_SHORT[t], counts: t === "TF" ? { MC: 0, TF: 6, SA: 0 } : { MC: 0, TF: 0, SA: 8 }, minutes: 25 }) });
    }
    if (!out.length) out.push({ title: "Thử sức đề khó hơn", text: "Em đã nắm vững phạm vi này. Hãy thử đề rộng hơn.", label: p.grade === 12 ? "Thi thử tốt nghiệp" : p.grade === 9 ? "Ôn thi vào 10" : "Đề cả năm", bp: p.grade === 12 ? KT.blueprint.tn() : p.grade === 9 ? KT.blueprint.ts10() : KT.blueprint.grade(p.grade || grade) });
    return out;
  }

  /* ================================================================ LỚP HỌC LIVE */
  let liveTimer = null, liveWm = null;
  const stopLive = () => { clearTimeout(liveTimer); liveTimer = null; clearInterval(liveWm); liveWm = null; };
  const liveTab = (() => { let t = null; try { t = sessionStorage.getItem("kt_tab"); if (!t) { t = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("kt_tab", t); } } catch (e) { t = Math.random().toString(36).slice(2, 10); } return t; })();
  const WD = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const liveWhen = (s) => { const d = new Date(s); return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + ", " + WD[d.getDay()].toLowerCase() + " " + d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }); };
  const liveLeft = (ms) => {
    if (ms <= 0) return "sắp bắt đầu";
    const m = Math.round(ms / 60000), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
    return "còn " + (d ? d + " ngày " : "") + (hh ? hh + " giờ " : "") + (!d ? mm + " phút" : "");
  };
  const lessonChip = (s) => (s.g && s.l && LESSON[s.g + "-" + s.l] ? h("span", { class: "lv-chip" }, KT.lessonName(s.g + "-" + s.l, true).replace(" · ", ", ")) : null);

  // khối "Lớp học trực tuyến" trên trang chủ
  function liveSlot(prom) {
    const box = h("div", {});
    (prom || rpc("live_list")).then((list) => {
      if (!list || !list.length) return;
      const now = Date.now() + clockSkew;
      const live = list.filter((s) => s.status === "live");
      const soon = list.filter((s) => s.status === "scheduled");
      const done = list.filter((s) => s.status === "ended").reverse();
      if (live.length || soon.length || done.length) {
        box.append(h("div", { class: "section-t" }, "Lớp học trực tuyến"));
        const row = h("div", { class: "lv-cards" });
        live.forEach((s) => row.append(h("div", { class: "lv-card on" },
          h("div", { class: "lv-date" }, h("i", {}), h("span", {}, "Live")),
          h("div", { class: "lv-card-tx" }, h("b", {}, s.title), h("span", {}, "Thầy đang dạy, bắt đầu lúc " + liveWhen(s.started_at || s.starts_at))),
          h("button", { class: "btn sm lv-join", onclick: () => renderLive(s.id) }, "Vào lớp"))));
        soon.forEach((s) => {
          const ms = new Date(s.starts_at).getTime() - now;
          row.append(h("div", { class: "lv-card" + (ms < 3600e3 ? " near" : "") },
            h("div", { class: "lv-date" }, h("b", {}, new Date(s.starts_at).getDate()), h("span", {}, "Th" + (new Date(s.starts_at).getMonth() + 1))),
            h("div", { class: "lv-card-tx" }, h("b", {}, s.title), h("span", {}, liveWhen(s.starts_at) + " (" + s.minutes + " phút)"),
              h("span", { class: "lv-left" }, liveLeft(ms))),
            h("button", { class: "btn ghost sm", onclick: () => renderLive(s.id) }, "Xem")));
        });
        done.slice(0, 3).forEach((s) => row.append(h("div", { class: "lv-card past" },
          h("div", { class: "lv-date" }, h("b", {}, new Date(s.starts_at).getDate()), h("span", {}, "Th" + (new Date(s.starts_at).getMonth() + 1))),
          h("div", { class: "lv-card-tx" }, h("b", {}, s.title), h("span", {}, "Đã học lúc " + liveWhen(s.starts_at))),
          h("button", { class: "btn ghost sm", onclick: () => renderLive(s.id) }, "Kết quả"))));
        box.append(row);
      }
    }).catch(() => { });
    return box;
  }

  // phòng học
  function renderLive(id) {
    stopTimers(); stopLive(); cur = null; window.scrollTo(0, 0); app.innerHTML = ""; setWho();
    let st = null, lastChat = 0, mode = null, pollShown = null, picked = null, sending = false, tabNow = "chat", unread = 0;
    const figs = {};
    const titleEl = h("h1", {}, "Đang vào lớp…");
    const statusEl = h("span", { class: "lv-badge off" }, "…");
    const onlineEl = h("span", { class: "lv-online" });
    const top = h("div", { class: "lv-top" },
      h("button", { class: "btn ghost sm", onclick: () => { stopLive(); renderHome(); } }, "← Trang chủ"),
      h("div", { class: "lv-top-t" }, titleEl, h("div", { class: "lv-meta" }, statusEl, onlineEl)));
    const stage = h("div", { class: "lv-stage" });
    const under = h("div", { class: "lv-under" });
    // cột phải
    const pollBox = h("div", { class: "lv-poll hidden" });
    const chatList = h("div", { class: "lv-chat", "aria-live": "polite" });
    const chatIn = h("input", { type: "text", maxlength: 300, placeholder: "Nhắn cho thầy và cả lớp…", "aria-label": "Tin nhắn" });
    const sendBtn = h("button", { class: "btn sm", onclick: () => send() }, "Gửi");
    chatIn.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    const quick = h("div", { class: "lv-quick" }, ["👍 Em hiểu rồi", "🙋 Thầy giảng lại giúp em", "❓ Em có câu hỏi"].map((t) => h("button", { type: "button", onclick: () => send(t) }, t)));
    const sendRow = h("div", { class: "lv-send" }, chatIn, sendBtn);
    const closedNote = h("div", { class: "lv-closed" });
    const chatPane = h("div", { class: "lv-pane" }, chatList, quick, sendRow, closedNote);
    chatList.append(h("div", { class: "lv-empty" }, "Chưa có tin nhắn nào."));
    const side = h("aside", { class: "lv-side" }, pollBox, h("div", { class: "lv-side-h" }, h("b", {}, "Trò chuyện"), h("span", { class: "sub" }, "Thầy và các bạn cùng lớp")), chatPane);
    const room = h("section", { class: "wrap lv-room" }, top, h("div", { class: "lv-grid" }, h("div", {}, stage, under), side));
    app.append(room);

    async function send(text) {
      const m = (text || chatIn.value).trim();
      if (!m || sending) return;
      sending = true;
      try { const r = await rpc("live_chat_send", { p_session: id, p_msg: m }); if (r && r.error) KT.toast(r.error, "bad"); else { if (!text) chatIn.value = ""; tick(true); } }
      catch (e) { fail(e); }
      sending = false;
    }
    const addChat = (list, hidden) => {
      (hidden || []).forEach((hid) => { const el = chatList.querySelector('[data-id="' + hid + '"]'); if (el) el.remove(); });
      if (!list || !list.length) return;
      const atBottom = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 60;
      list.forEach((c) => {
        if (c.id <= lastChat) return; lastChat = c.id;
        chatList.append(h("div", { class: "lv-msg" + (c.t ? " t" : "") + (c.me ? " me" : ""), "data-id": c.id },
          h("div", { class: "lv-msg-h" }, c.t ? h("span", { class: "lv-tbadge" }, "Thầy") : h("b", {}, c.me ? "Em" : c.name),
            h("time", {}, new Date(c.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))),
          h("div", { class: "lv-msg-b" }, c.msg)));
      });
      while (chatList.children.length > 200) chatList.firstChild.remove();
      if (atBottom) chatList.scrollTop = chatList.scrollHeight;
      if (!chatList.querySelector(".lv-msg")) chatList.append(h("div", { class: "lv-empty" }, "Chưa có tin nhắn nào."));
      else { const e = chatList.querySelector(".lv-empty"); if (e) e.remove(); }
    };

    // vùng video theo trạng thái
    function drawStage() {
      const s = st.session;
      if (mode === s.status + (st.vid || "")) return;
      mode = s.status + (st.vid || "");
      stage.innerHTML = ""; under.innerHTML = ""; clearInterval(liveWm);
      titleEl.textContent = s.title;
      if (s.status === "live" && st.vid) {
        const wm = h("div", { class: "lv-wm" }, st.me.name + " · " + st.me.code);
        const move = () => {   // đặt tên học sinh ở vị trí ngẫu nhiên, luôn nằm trọn trong khung video
          const box = wm.parentNode; if (!box) return;
          const W = box.clientWidth, H = box.clientHeight, w = wm.offsetWidth, hh = wm.offsetHeight;
          wm.style.left = Math.round(8 + Math.random() * Math.max(0, W - w - 16)) + "px"; wm.style.top = Math.round(8 + Math.random() * Math.max(0, H - hh - 50)) + "px";
        };
        setTimeout(move, 50); liveWm = setInterval(move, 14000);
        stage.append(h("div", { class: "lv-video" },
          h("iframe", { src: "https://www.youtube-nocookie.com/embed/" + st.vid + "?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3",
            title: s.title, allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "", referrerpolicy: "strict-origin-when-cross-origin" }), wm));
        under.append(h("div", { class: "lv-info" }, lessonChip(s), s.note ? h("p", {}, s.note) : null,
          h("p", { class: "sub" }, "Không thấy hình? Bấm nút phát trên khung video. Khi thầy hỏi, khung “Câu hỏi nhanh” sẽ tự hiện để em trả lời.")));
      } else if (s.status === "ended") {
        const sm = st.summary || {};
        stage.append(h("div", { class: "lv-wait ended" },
          h("div", { class: "lv-wait-ic" }, "✓"), h("h2", {}, "Buổi học đã kết thúc"), h("p", {}, s.title),
          h("div", { class: "lv-stats" },
            h("div", {}, h("b", {}, sm.seconds ? Math.max(1, Math.round(sm.seconds / 60)) + "′" : "–"), h("span", {}, "Thời gian em tham gia")),
            h("div", {}, h("b", {}, (sm.correct || 0) + "/" + (sm.polls || 0)), h("span", {}, "Câu hỏi nhanh trả lời đúng")),
            h("div", {}, h("b", {}, String(sm.answered || 0)), h("span", {}, "Câu em đã trả lời"))),
          h("button", { class: "btn acc", onclick: () => { stopLive(); renderHome(); } }, "Về trang chủ")));
      } else {
        const cd = h("div", { class: "lv-count" });
        stage.append(h("div", { class: "lv-wait" },
          h("span", { class: "lv-badge soon" }, "Sắp diễn ra"), h("h2", {}, s.title),
          h("p", {}, "Bắt đầu lúc " + liveWhen(s.starts_at) + ", học " + s.minutes + " phút"), lessonChip(s), cd,
          h("p", { class: "sub" }, "Em cứ để trang này mở. Khi thầy bắt đầu, video sẽ tự hiện.")));
        const upd = () => {
          const ms = Math.max(0, new Date(s.starts_at).getTime() - (Date.now() + clockSkew));
          const v = [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
          cd.innerHTML = ""; [["ngày", v[0]], ["giờ", v[1]], ["phút", v[2]], ["giây", v[3]]].forEach(([l, x], i) => { if (i || x) cd.append(h("div", {}, h("b", {}, String(x).padStart(2, "0")), h("span", {}, l))); });
        };
        upd(); liveWm = setInterval(upd, 1000);
      }
      statusEl.className = "lv-badge" + (s.status === "live" ? "" : s.status === "ended" ? " off" : " soon");
      statusEl.innerHTML = ""; statusEl.append(s.status === "live" ? h("i", {}) : "", s.status === "live" ? "Đang live" : s.status === "ended" ? "Đã kết thúc" : "Sắp diễn ra");
    }

    // câu hỏi nhanh
    let ringT = null;
    function drawPoll() {
      const p = st.poll;
      if (!p) { pollBox.classList.add("hidden"); pollShown = null; clearInterval(ringT); return; }
      const sig = p.id + p.status + (p.my != null ? "m" + p.my : "") + (p.res ? JSON.stringify(p.res) : "");
      if (sig === pollShown) return;
      const fresh = !pollShown || !pollShown.startsWith(String(p.id));
      pollShown = sig; pollBox.classList.remove("hidden"); pollBox.innerHTML = ""; clearInterval(ringT);
      if (fresh) { pollBox.classList.remove("pop"); void pollBox.offsetWidth; pollBox.classList.add("pop"); picked = null;
        if (window.innerWidth < 1000 && p.status === "open") setTimeout(() => pollBox.scrollIntoView({ behavior: "smooth", block: "center" }), 80); }
      const letters = p.o.every((x, i) => String(x).trim() === "ABCDEFGH"[i]);
      const head = h("div", { class: "lv-poll-h" }, h("span", {}, "⚡ Câu hỏi nhanh"));
      if (p.status === "open") {
        const R = 16, C = 2 * Math.PI * R, ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        ring.setAttribute("viewBox", "0 0 40 40"); ring.setAttribute("class", "lv-ring");
        ring.innerHTML = '<circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg" stroke-dasharray="' + C + '"/><text x="20" y="24" text-anchor="middle"></text>';
        const fg = ring.querySelector(".fg"), tx = ring.querySelector("text");
        const end = Date.now() + p.left_ms;
        const step = () => { const left = Math.max(0, end - Date.now()); tx.textContent = Math.ceil(left / 1000); fg.style.strokeDashoffset = String(C * (1 - left / (p.seconds * 1000))); ring.classList.toggle("low", left < 6000); };
        step(); ringT = setInterval(step, 250);
        head.append(ring);
      } else head.append(h("span", { class: "lv-poll-st" }, p.status === "revealed" ? "Đã công bố đáp án" : "Hết giờ · chờ thầy công bố"));
      pollBox.append(head);
      if (p.q && !letters) pollBox.append(h("div", { class: "lv-poll-q", html: p.q }));
      else if (letters) pollBox.append(h("div", { class: "lv-poll-q sub" }, "Thầy đang hỏi câu trên bảng. Em chọn đáp án:"));
      const total = p.res ? p.res.n || 0 : 0;
      const opts = h("div", { class: "lv-opts" + (letters ? " letters" : "") });
      p.o.forEach((o, i) => {
        const mine = p.my === i || (p.my == null && picked === i);
        let cls = "lv-opt" + (mine ? " sel" : "");
        if (p.status === "revealed" && p.key != null) cls += i === p.key ? " ok" : mine ? " bad" : "";
        const b = h("button", { type: "button", class: cls, disabled: p.status !== "open" || p.my != null,
          onclick: async () => {
            picked = i; pollShown = null; drawPoll();
            try { const r = await rpc("live_answer", { p_poll: p.id, p_ans: i }); if (r && r.error) { KT.toast(r.error, "bad"); picked = null; } else { p.my = i; pollShown = null; drawPoll(); } }
            catch (e) { picked = null; fail(e); }
          } }, h("span", { class: "L" }, "ABCDEFGH"[i]), letters ? null : h("span", { class: "lv-opt-t", html: o }));
        if (p.status === "revealed" && p.res) {
          const c = (p.res.counts || [])[i] || 0, pc = total ? Math.round(100 * c / total) : 0;
          b.append(h("span", { class: "lv-bar" }, h("i", { style: "width:" + pc + "%" })), h("span", { class: "lv-pc" }, pc + "%"));
        }
        opts.append(b);
      });
      pollBox.append(opts);
      if (p.status === "revealed" && p.graded) {
        if (p.my == null) pollBox.append(h("div", { class: "lv-res" }, "Em chưa trả lời câu này. Đáp án đúng là " + "ABCDEFGH"[p.key] + "."));
        else if (p.ok) { pollBox.append(h("div", { class: "lv-res ok" }, "🎉 Chính xác! Giỏi lắm.")); if (fresh || !pollBox.dataset.boom) { pollBox.dataset.boom = p.id; confetti(pollBox); } }
        else pollBox.append(h("div", { class: "lv-res bad" }, "Chưa đúng rồi — đáp án là " + "ABCDEFGH"[p.key] + ". Nghe thầy giải thích nhé."));
        if (total) pollBox.append(h("div", { class: "sub", style: "margin-top:6px" }, total + " bạn đã trả lời"));
      } else if (p.my != null) pollBox.append(h("div", { class: "lv-res wait" }, "✓ Đã gửi đáp án " + "ABCDEFGH"[p.my] + ". Chờ thầy công bố…"));
      const need = [...new Set(((p.q || "") + JSON.stringify(p.o)).match(/data-fig=\\?"([0-9a-f]+)/g) || [])].map((x) => x.replace(/.*"/, "")).filter((k) => !figs[k]);
      if (need.length) api.rpc("get_figs", { p_ids: need }).then((f) => { Object.assign(figs, f); KT.typeset(pollBox, figs); }).catch(() => { });
      KT.typeset(pollBox, figs);
    }
    function confetti(el) {
      const box = h("div", { class: "lv-confetti", "aria-hidden": "true" });
      const cols = ["#ffd23f", "#4f2bbd", "#1d9a5b", "#ff5d73", "#2fa4ff"];
      for (let i = 0; i < 26; i++) box.append(h("i", { style: "left:" + (Math.random() * 100) + "%;background:" + cols[i % 5] + ";animation-delay:" + (Math.random() * 0.3) + "s;transform:rotate(" + (Math.random() * 360) + "deg)" }));
      el.append(box); setTimeout(() => box.remove(), 1800);
    }

    let first = true;
    async function tick(once) {
      if (!once) clearTimeout(liveTimer);
      try {
        const r = await rpc("live_state", { p_session: id, p_tab: liveTab, p_after: lastChat });
        if (r.error) { KT.toast(r.error, "bad"); stopLive(); renderHome(); return; }
        st = r; clockSkew = new Date(r.server_now).getTime() - Date.now();
        const live = r.session.status === "live";
        if (r.session.status === "ended") r.poll = null;
        quick.style.display = sendRow.style.display = live ? "" : "none"; closedNote.style.display = live ? "none" : "";
        closedNote.textContent = r.session.status === "ended" ? "Buổi học đã kết thúc, phần trò chuyện đã đóng." : "Phần trò chuyện mở khi thầy bắt đầu buổi học.";
        drawStage(); drawPoll(); addChat(r.chat, r.hidden);
        onlineEl.textContent = r.session.status === "live" ? "👁 " + r.online + " đang xem" : r.session.classes.join(", ");
        if (r.dup && first === false) KT.toast("Tài khoản của em đang mở lớp học ở một nơi khác. Thầy sẽ thấy cảnh báo này.", "bad");
        first = false;
      } catch (e) { if (/SESSION_EXPIRED/.test(e.message)) { stopLive(); return fail(e); } }
      if (once) return;
      const s = st && st.session && st.session.status;
      const wait = s === "live" ? (document.visibilityState === "visible" ? 3000 : 8000) : s === "scheduled" ? 10000 : 0;
      if (wait) liveTimer = setTimeout(tick, wait);
    }
    tick();
  }

  /* ---------------- khởi động ---------------- */
  window.addEventListener("beforeunload", () => { if (cur && dirty.size) flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  if (!KT_CONFIG.SUPABASE_URL || /DIEN_/.test(KT_CONFIG.SUPABASE_URL)) app.append(h("div", { class: "wrap empty" }, "Chưa cấu hình máy chủ (assets/config.js)."));
  else if (sess) renderHome(); else renderLogin();
})();
