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
    const me = ov && ov.me;
    who.append(h("span", { class: "who-n" }, h("b", {}, me && me.name ? me.name : "Giáo viên"), h("small", {}, me && me.role === "admin" ? "Quản trị" : s.email || "")),
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
      h("label", { for: "em" }, "Email"), em, h("label", { for: "pw" }, "Mật khẩu"), pw, err, btn,
      h("p", { class: "sub", style: "margin:14px 0 0;text-align:center" }, "Giáo viên mới? ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); renderSignup(); } }, "Tạo tài khoản giáo viên"))))));
    em.focus();
  }

  /* ---------------- tạo tài khoản giáo viên mới ---------------- */
  function renderSignup() {
    stopPoll(); ov = null; setWho(); app.innerHTML = "";
    const f = (id, type, ac, ph) => h("input", { id, type, autocomplete: ac, placeholder: ph || "", required: true });
    const nm = f("su_nm", "text", "name", "Ví dụ: Nguyễn Thị Lan"), tt = f("su_tt", "text", "off", "Ví dụ: Cô Lan");
    const ph = h("input", { id: "su_ph", type: "tel", autocomplete: "tel", placeholder: "Để thầy Hùng liên hệ khi duyệt" });
    const em = f("su_em", "email", "username"), pw = f("su_pw", "password", "new-password", "Ít nhất 8 kí tự"), pw2 = f("su_pw2", "password", "new-password");
    const err = h("div", { class: "note bad hidden" }), btn = h("button", { class: "btn", type: "submit" }, "Gửi đăng kí");
    const form = h("form", { class: "login panel", onsubmit: async (e) => {
      e.preventDefault(); err.classList.add("hidden");
      const bad = (m) => { err.textContent = m; err.classList.remove("hidden"); };
      if (nm.value.trim().split(/\s+/).length < 2) return bad("Nhập đầy đủ họ và tên.");
      if (pw.value.length < 8) return bad("Mật khẩu cần ít nhất 8 kí tự.");
      if (pw.value !== pw2.value) return bad("Hai lần nhập mật khẩu chưa giống nhau.");
      btn.disabled = true;
      try {
        const ok = await api.signup(em.value.trim(), pw.value, { full_name: nm.value.trim(), title: tt.value.trim(), phone: ph.value.trim() });
        if (ok) return load();
        app.innerHTML = "";
        app.append(h("section", { class: "wrap center" }, h("div", { class: "panel", style: "max-width:520px" }, h("h1", {}, "Kiểm tra hộp thư"),
          h("p", {}, "Hệ thống vừa gửi thư xác nhận tới ", h("b", {}, em.value.trim()), ". Mở thư và bấm vào đường link xác nhận, sau đó quay lại đây đăng nhập."),
          h("p", { class: "sub" }, "Sau khi đăng nhập, tài khoản cần thầy Hùng duyệt thì mới tạo lớp được."),
          h("button", { class: "btn", onclick: () => renderLogin() }, "Về trang đăng nhập"))));
      } catch (ex) {
        bad(/already|registered|exists/i.test(ex.message) ? "Email này đã có tài khoản. Hãy đăng nhập." : /signup.*disabled|not allowed/i.test(ex.message) ? "Hệ thống chưa mở tạo tài khoản. Liên hệ thầy Hùng để được cấp tài khoản." : ex.message);
      }
      btn.disabled = false;
    } }, h("h1", {}, "Tạo tài khoản giáo viên"),
      h("p", { class: "sub" }, "Tài khoản mới cần thầy Hùng duyệt. Sau khi được duyệt, thầy cô tự tạo lớp và quản lí học sinh của mình; giáo viên khác không xem được lớp của thầy cô."),
      h("label", { for: "su_nm" }, "Họ và tên"), nm, h("label", { for: "su_tt" }, "Học sinh gọi thầy cô là"), tt,
      h("label", { for: "su_ph" }, "Số điện thoại"), ph, h("label", { for: "su_em" }, "Email"), em,
      h("label", { for: "su_pw" }, "Mật khẩu"), pw, h("label", { for: "su_pw2" }, "Nhập lại mật khẩu"), pw2, err, btn,
      h("p", { class: "sub", style: "margin:14px 0 0;text-align:center" }, "Đã có tài khoản? ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); renderLogin(); } }, "Đăng nhập")));
    app.append(h("section", { class: "wrap center" }, h("div", { class: "auth" }, KT.brandPanel("teacher"), form)));
    nm.focus();
  }
  // tài khoản chưa được duyệt / bị khoá
  function renderWait(me) {
    stopPoll(); app.innerHTML = ""; setWho();
    const T0 = { pending: ["Tài khoản đang chờ duyệt", "Thầy Hùng sẽ xem và duyệt tài khoản của thầy cô. Sau khi được duyệt, đăng nhập lại là dùng được."],
      rejected: ["Tài khoản chưa được chấp nhận", "Thầy cô liên hệ thầy Hùng (0938 829 686) nếu cần thêm thông tin."],
      locked: ["Tài khoản đang tạm khoá", "Thầy cô liên hệ thầy Hùng (0938 829 686) để mở lại."] }[me.status] || ["Chưa đăng nhập", ""];
    app.append(h("section", { class: "wrap center" }, h("div", { class: "panel", style: "max-width:520px" }, h("h1", {}, T0[0]), h("p", {}, T0[1]),
      h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, h("button", { class: "btn", onclick: () => load() }, "Kiểm tra lại"),
        h("button", { class: "btn ghost", onclick: () => { api.logout(); renderLogin(); } }, "Đăng xuất")))));
  }

  async function load() {
    let me;
    try { me = await T("t_me"); } catch (e) { me = null; }
    if (me && me.status && me.status !== "teacher") return renderWait(me);
    try { ov = await T("t_overview"); } catch (e) { api.logout(); renderLogin(e.message); return; }
    try { ov.n_reports = await T("t_reports_count"); } catch (e) { ov.n_reports = 0; }
    render();
  }
  function render() {
    stopPoll(); setWho(); app.innerHTML = "";
    const w = h("section", { class: "wrap" });
    const admin = !!(ov.me && ov.me.role === "admin");
    const badge = (t, n) => (n ? h("span", {}, t + " ", h("span", { class: "tabbadge" }, String(n))) : t);
    const tabs = [["monitor", "Theo dõi & báo cáo"], ["stats", "Thống kê"], ["assign", "Giao đề"], ["classes", badge("Lớp & học sinh", ov.n_pending)], ["credits", "Điểm làm bài"],
      admin && ["reports", badge("Câu bị báo lỗi", ov.n_reports)], ["live", h("span", {}, h("i", { class: "lv-dot" }), "Lớp học live")], ["fees", "Học phí"], ["gate", "Video đầu giờ"],
      admin && ["videos", "Video ôn tập"], admin && ["bank", "Ngân hàng câu hỏi"], admin && ["teachers", badge("Giáo viên", ov.n_tpending)]].filter(Boolean);
    if (!tabs.some(([k]) => k === tab)) tab = "monitor";
    w.append(dashHead());
    w.append(h("div", { class: "tabs", role: "tablist" }, tabs.map(([k, lab]) => h("button", { class: tab === k ? "on" : "", role: "tab", "aria-selected": String(tab === k),
      onclick: () => { tab = k; store.set("kt_t_tab", k); curAsg = null; liveCur = null; render(); } }, lab))));
    const body = h("div", {}); w.append(body); app.append(w);
    ({ monitor: tabMonitor, stats: tabStats, assign: tabAssign, classes: tabClasses, credits: tabCredits, reports: tabReports, live: tabLive, gate: tabGate, fees: tabFees, videos: tabVideos, bank: tabBank, teachers: tabTeachers })[tab](body);
  }

  // dải tổng quan đầu trang: lời chào + 4 con số chính của các lớp mình phụ trách
  function dashHead() {
    const me = ov.me || {}, hr = new Date().getHours();
    const part = hr < 11 ? "buổi sáng" : hr < 14 ? "buổi trưa" : hr < 18 ? "buổi chiều" : "buổi tối";
    const t = (me.title || "").trim(), last = String(me.name || "").trim().split(/\s+/).pop();
    const call = !t ? (me.name || "") : t.split(/\s+/).length > 1 ? t : t + " " + last;
    const now = new Date(ov.server_now || Date.now()).getTime();
    const open = ov.assignments.filter((a) => new Date(a.opens_at).getTime() <= now && new Date(a.closes_at).getTime() > now);
    const nSt = ov.classes.reduce((s, c) => s + (+c.n || 0), 0), nDoing = ov.assignments.reduce((s, a) => s + (+a.n_doing || 0), 0);
    const tile = (n, l, go) => h(go ? "button" : "div", Object.assign({ class: "dh-k" }, go ? { type: "button", onclick: go } : {}), h("b", { "data-count": n }, KT.num(n)), h("span", {}, l));
    const goTab = (k) => () => { tab = k; store.set("kt_t_tab", k); render(); };
    return h("section", { class: "dash-head" },
      h("div", { class: "dh-tx" }, h("h1", {}, "Chào " + part + ", " + call), h("p", {}, open.length ? "Đang có " + open.length + " bài mở cho học sinh làm." : "Hiện chưa có bài nào đang mở. Giao đề mới ở tab Giao đề.")),
      h("div", { class: "dh-ks" }, tile(ov.classes.length, "lớp đang dạy", goTab("classes")), tile(nSt, "học sinh", goTab("classes")),
        tile(open.length, "bài đang mở", goTab("monitor")), tile(nDoing, "em đang làm bài", goTab("monitor"))));
  }

  /* ================================================================ GIÁO VIÊN (chỉ quản trị) */
  async function tabTeachers(el) {
    let d;
    try { d = await T("t_admin_teachers"); } catch (e) { return fail(e); }
    const act = async (id, action, msg, extra) => {
      try { await T("t_admin_teacher_set", Object.assign({ p_user: id, p_action: action }, extra || {})); KT.toast(msg, "ok"); ov = await T("t_overview"); ov.n_reports = await T("t_reports_count").catch(() => 0); render(); } catch (e) { fail(e); }
    };
    el.append(h("p", { class: "sub", style: "margin:0 0 14px" }, "Mỗi giáo viên chỉ thấy lớp, học sinh, bài giao và buổi live của mình. Ngân hàng câu hỏi dùng chung; chỉ thầy sửa được ngân hàng, video và câu bị báo lỗi. Giáo viên mới tự tạo tài khoản ở trang đăng nhập giáo viên (link “Tạo tài khoản giáo viên”) rồi chờ thầy duyệt ở đây."));
    const pend = h("div", { class: "panel pending" }, h("h3", { style: "margin:0 0 8px" }, d.pending.length ? "Chờ duyệt (" + d.pending.length + ")" : "Chờ duyệt"));
    if (!d.pending.length) pend.append(h("p", { class: "sub", style: "margin:0" }, "Chưa có tài khoản nào chờ duyệt."));
    else {
      const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Họ tên", "Học sinh gọi là", "Email", "Điện thoại", "Đăng kí lúc", ""].map((x) => h("th", {}, x)))));
      const body = h("tbody");
      d.pending.forEach((p) => {
        const nm = h("input", { class: "mini", value: p.name || "", placeholder: "Họ tên", style: "min-width:150px" });
        const tt = h("input", { class: "mini", value: p.title || "", placeholder: "Ví dụ: Cô Lan", style: "min-width:110px" });
        body.append(h("tr", {}, h("td", {}, nm), h("td", {}, tt), h("td", {}, p.email), h("td", {}, p.phone ? h("a", { href: "tel:" + p.phone }, p.phone) : "–"), h("td", {}, KT.dt(p.at)),
          h("td", {}, h("div", { style: "display:flex;gap:6px" },
            h("button", { class: "btn sm", onclick: () => act(p.id, "approve", "Đã duyệt " + (nm.value || p.email), { p_name: nm.value, p_title: tt.value }) }, "Duyệt"),
            h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Từ chối tài khoản?", "Tài khoản <b>" + esc(p.email) + "</b> sẽ không dùng được trang giáo viên.", "Từ chối", () => act(p.id, "reject", "Đã từ chối")) }, "Từ chối")))));
      });
      tb.append(body); pend.append(h("div", { class: "tbl-wrap" }, tb));
    }
    el.append(pend);
    const list = h("div", { class: "panel", style: "margin-top:16px" }, h("h3", { style: "margin:0 0 8px" }, "Giáo viên đang dùng (" + d.teachers.length + ")"));
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Giáo viên", "Email", "Lớp", "Bài đã giao", "Giao gần nhất", ""].map((x) => h("th", {}, x)))));
    const body = h("tbody");
    d.teachers.forEach((t) => {
      const cls = t.classes.length ? t.classes.map((c) => c.name + " (" + c.n + " em)").join(", ") : "Chưa có lớp";
      body.append(h("tr", { class: t.active ? "" : "muted" },
        h("td", {}, h("b", {}, t.name || t.email), h("div", { class: "sub", style: "font-size:13px" }, (t.title || "") + (t.role === "admin" ? ", quản trị" : "") + (t.active ? "" : ", đang khoá"))),
        h("td", {}, t.email || "–"), h("td", { style: "white-space:normal;max-width:280px" }, cls), h("td", {}, String(t.n_assign)), h("td", {}, t.last ? KT.dt(t.last) : "–"),
        h("td", {}, t.me || t.role === "admin" ? "" : h("div", { style: "display:flex;gap:6px" },
          h("button", { class: "btn ghost sm", onclick: () => {
            const nm = h("input", { value: t.name || "" }), tt = h("input", { value: t.title || "" });
            let close; close = KT.modal([h("h3", {}, "Sửa thông tin giáo viên"), h("label", {}, "Họ tên"), nm, h("label", {}, "Học sinh gọi là"), tt,
              h("div", { style: "display:flex;gap:8px;margin-top:14px" }, h("button", { class: "btn", onclick: () => { close(); act(t.id, "edit", "Đã lưu", { p_name: nm.value, p_title: tt.value }); } }, "Lưu"),
                h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"))]);
          } }, "Sửa"),
          t.active ? h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Khoá tài khoản?", "<b>" + esc(t.name || t.email) + "</b> sẽ không vào được trang giáo viên. Lớp và học sinh vẫn giữ nguyên, học sinh vẫn học bình thường.", "Khoá", () => act(t.id, "lock", "Đã khoá")) }, "Khoá")
            : h("button", { class: "btn sm", onclick: () => act(t.id, "unlock", "Đã mở khoá") }, "Mở khoá")))));
    });
    tb.append(body); list.append(h("div", { class: "tbl-wrap" }, tb)); el.append(list);
  }


  /* ================================================================ LỚP HỌC LIVE */
  let liveCur = null;
  const LWD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const lwhen = (s) => { const d = new Date(s); return LWD[d.getDay()] + " " + d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + " · " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };
  const lstatus = (s) => s === "live" ? h("span", { class: "lv-badge" }, h("i", {}), "Đang live") : s === "ended" ? h("span", { class: "lv-badge off" }, "Đã kết thúc") : h("span", { class: "lv-badge soon" }, "Sắp diễn ra");
  const mmss = (sec) => { sec = +sec || 0; const m = Math.floor(sec / 60); return m >= 60 ? Math.floor(m / 60) + " giờ " + (m % 60) + "′" : m + "′" + String(sec % 60).padStart(2, "0"); };

  async function tabLive(el) {
    if (liveCur) return liveConsole(el, liveCur);
    el.append(h("div", { class: "review-t" }, h("h2", { style: "margin:0" }, "Lớp học live"), h("span", { class: "sp" }),
      h("button", { class: "btn sm", onclick: () => liveForm(null, () => { el.innerHTML = ""; tabLive(el); }) }, "+ Tạo buổi học")));
    el.append(h("details", { class: "panel lv-guide", style: "margin-top:14px" }, h("summary", {}, "Cách phát live trên YouTube để chỉ học sinh của thầy xem được"),
      h("ol", {},
        h("li", {}, "YouTube Studio → ", h("b", {}, "Tạo → Phát trực tiếp"), ". Lần đầu bật tính năng phát trực tiếp phải chờ khoảng 24 giờ."),
        h("li", {}, "Chế độ hiển thị chọn ", h("b", {}, "Không công khai"), " — không hiện trên kênh, không tìm thấy trên YouTube."),
        h("li", {}, "Trong phần cài đặt buổi live, bật ", h("b", {}, "Cho phép nhúng"), "."),
        h("li", {}, "Chép link buổi live (dạng youtube.com/live/… ) dán vào ô “Link YouTube” của buổi học ở đây."),
        h("li", {}, "Đến giờ: bật phát trên YouTube (OBS hoặc điện thoại) rồi bấm ", h("b", {}, "Bắt đầu live"), " trong phòng điều khiển — học sinh lúc đó mới thấy video."),
        h("li", {}, "Học xong: bấm ", h("b", {}, "Kết thúc"), ", rồi trên YouTube chuyển video sang ", h("b", {}, "Riêng tư"), "."))));
    const box = h("div", { class: "lv-tlist" }, h("div", { class: "loading" }, "Đang tải…"));
    el.append(box);
    let list; try { list = await T("t_live_list"); } catch (e) { box.innerHTML = ""; fail(e); return; }
    box.innerHTML = "";
    if (!list.length) { box.append(h("div", { class: "panel empty" }, "Chưa có buổi học nào. Bấm “+ Tạo buổi học” để lên lịch.")); return; }
    list.forEach((s) => box.append(h("div", { class: "lv-tcard " + s.status },
      h("div", { class: "lv-date" }, h("b", {}, new Date(s.starts_at).getDate()), h("span", {}, "Th" + (new Date(s.starts_at).getMonth() + 1))),
      h("div", { class: "lv-tcard-tx" }, h("div", {}, lstatus(s.status)), h("b", {}, s.title),
        h("span", {}, lwhen(s.starts_at) + " · " + s.minutes + " phút · Lớp " + s.classes.join(", ")),
        h("span", { class: "sub" }, s.status === "scheduled" ? (s.yt_url ? "Đã có link YouTube" : "⚠ Chưa có link YouTube") : s.n_joined + "/" + s.n_students + " học sinh tham gia · " + s.n_polls + " câu hỏi nhanh")),
      h("div", { class: "lv-tcard-act" },
        h("button", { class: "btn sm" + (s.status === "live" ? " acc" : ""), onclick: () => { liveCur = s.id; render(); } }, s.status === "ended" ? "Xem lại" : "Phòng điều khiển"),
        s.status !== "ended" ? h("button", { class: "btn ghost sm", onclick: () => liveForm(s, () => { el.innerHTML = ""; tabLive(el); }) }, "Sửa") : null,
        h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá buổi học?", "Xoá “" + KT.esc(s.title) + "” cùng điểm danh, tin nhắn và câu hỏi nhanh của buổi này.", "Xoá",
          async () => { await T("t_live_status", { p_id: s.id, p_status: "delete" }).catch(fail); el.innerHTML = ""; tabLive(el); }) }, "Xoá")))));
  }

  function liveForm(s, after) {
    const pad = (n) => String(n).padStart(2, "0");
    const local = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    const t0 = s ? new Date(s.starts_at) : (() => { const d = new Date(Date.now() + 864e5); d.setHours(19, 30, 0, 0); return d; })();
    const f = {
      title: h("input", { id: "lvT", maxlength: 150, value: s ? s.title : "", placeholder: "VD: Chữa đề thi thử tốt nghiệp số 3" }),
      start: h("input", { id: "lvS", type: "datetime-local", value: local(t0) }),
      min: h("input", { id: "lvM", type: "number", min: 10, max: 300, value: s ? s.minutes : 90 }),
      url: h("input", { id: "lvU", type: "url", value: s ? s.yt_url || "" : "", placeholder: "https://www.youtube.com/live/…  (có thể dán sau)" }),
      note: h("textarea", { id: "lvN", rows: 2, maxlength: 500, placeholder: "Dặn học sinh chuẩn bị gì (không bắt buộc)" }, s ? s.note : ""),
      g: h("select", { id: "lvG" }, [h("option", { value: "" }, "— Không gắn bài —")].concat(KT.GRADES.map((g) => h("option", { value: g, selected: s && s.g === g }, "Toán " + g)))),
      l: h("select", { id: "lvL" }),
    };
    const fillL = () => { f.l.innerHTML = ""; const g = +f.g.value; f.l.disabled = !g; if (!g) return;
      CUR[g].chapters.forEach((ch) => { const og = h("optgroup", { label: "Chương " + romans[ch.no] }); ch.lessons.forEach((L) => og.append(h("option", { value: L.no, selected: s && s.l === L.no }, "Bài " + L.no + ". " + L.name))); f.l.append(og); }); };
    f.g.onchange = fillL; fillL();
    const chosen = new Set(s ? s.class_ids : []);
    const cls = h("div", { class: "lv-cls" }, (ov.classes || []).map((c) => h("label", { class: "chk" }, h("input", { type: "checkbox", value: c.id, checked: chosen.has(c.id) }), c.name + " (" + c.n + ")")));
    const L = (id, t) => h("label", { for: id }, t);
    let close;
    close = KT.modal([h("h3", {}, s ? "Sửa buổi học" : "Tạo buổi học live"),
      h("div", { class: "form" },
        h("div", { class: "full" }, L("lvT", "Tên buổi học"), f.title),
        h("div", { class: "full" }, h("label", {}, "Lớp được vào học"), cls),
        h("div", {}, L("lvS", "Bắt đầu lúc"), f.start), h("div", {}, L("lvM", "Thời lượng (phút)"), f.min),
        h("div", {}, L("lvG", "Gắn với bài học"), f.g), h("div", {}, L("lvL", "Bài"), f.l),
        h("div", { class: "full" }, L("lvU", "Link YouTube của buổi live (chế độ Không công khai)"), f.url),
        h("div", { class: "full" }, L("lvN", "Ghi chú cho học sinh"), f.note)),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          const ids = [...cls.querySelectorAll("input:checked")].map((x) => +x.value);
          const d = new Date(f.start.value);
          e.target.disabled = true;
          try {
            const r = await T("t_live_save", { p_id: s ? s.id : null, p_title: f.title.value, p_classes: ids, p_starts: isNaN(d) ? null : d.toISOString(), p_minutes: +f.min.value,
              p_url: f.url.value, p_g: +f.g.value || null, p_l: +f.g.value ? +f.l.value : null, p_note: f.note.value });
            if (r.error) { e.target.disabled = false; return KT.toast(r.error, "bad"); }
            close(); KT.toast(s ? "Đã lưu buổi học" : "Đã tạo buổi học. Học sinh các lớp đã chọn sẽ thấy lịch trên trang chủ.", "ok"); after();
          } catch (ex) { e.target.disabled = false; fail(ex); }
        } }, s ? "Lưu" : "Tạo buổi học"))], { wide: true });
  }

  // phòng điều khiển của giáo viên
  async function liveConsole(el, id) {
    let st = null, lastChat = 0, bankG = null, bankL = null, secs = 30, pollSig = null, ringT = null;
    const figs = {};
    const head = h("div", {}), ctrl = h("div", { class: "lv-ctrl" });
    const preview = h("div", { class: "lv-tprev" });
    const pollNow = h("div", { class: "lv-tpoll" });
    const launcher = h("div", { class: "panel lv-launch" });
    const history = h("div", { class: "lv-hist" });
    const people = h("div", { class: "panel lv-people" });
    const chatList = h("div", { class: "lv-chat t" });
    const chatIn = h("input", { type: "text", maxlength: 500, placeholder: "Nhắn cho cả lớp (hiện nổi bật)…" });
    const sendT = async () => { const m = chatIn.value.trim(); if (!m) return; chatIn.value = ""; await T("t_live_chat", { p_id: id, p_msg: m }).catch(fail); refresh(); };
    chatIn.addEventListener("keydown", (e) => { if (e.key === "Enter") sendT(); });
    el.append(h("div", { class: "lv-console" }, head,
      h("div", { class: "lv-cgrid" },
        h("div", {}, h("div", { class: "lv-row2" }, preview, ctrl), pollNow, launcher, history),
        h("div", {}, people, h("div", { class: "panel lv-tchat" }, h("h3", {}, "Trò chuyện"), chatList, h("div", { class: "lv-send" }, chatIn, h("button", { class: "btn sm", onclick: sendT }, "Gửi")))))));

    // bảng mở câu hỏi nhanh
    const secRow = h("div", { class: "lv-secs" }, h("span", { class: "sub" }, "Thời gian:"), [20, 30, 45, 60, 90, 120].map((x) =>
      h("button", { type: "button", class: "chipbtn" + (x === secs ? " on" : ""), onclick: (e) => { secs = x; secRow.querySelectorAll(".chipbtn").forEach((b) => b.classList.remove("on")); e.target.classList.add("on"); } }, x + " giây")));
    let lTab = "board";
    const lBody = h("div", {});
    const lTabs = h("div", { class: "lv-ltabs" }, [["board", "Câu trên bảng (A–D)"], ["bank", "Từ ngân hàng câu hỏi"], ["type", "Tự gõ câu hỏi"]].map(([k, t]) =>
      h("button", { type: "button", class: k === lTab ? "on" : "", onclick: (e) => { lTab = k; lTabs.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.target.classList.add("on"); drawLaunch(); } }, t)));
    launcher.append(h("h3", {}, "⚡ Đưa câu hỏi nhanh lên màn hình học sinh"), lTabs, secRow, lBody);
    const openPoll = async (args) => {
      if (!st || st.session.status !== "live") return KT.toast("Bấm “Bắt đầu live” trước khi đưa câu hỏi.", "bad");
      try { const r = await T("t_live_poll", Object.assign({ p_id: id, p_seconds: secs }, args)); if (r.error) return KT.toast(r.error, "bad"); KT.toast("Đã đưa câu hỏi lên · " + secs + " giây", "ok"); refresh(); }
      catch (e) { fail(e); }
    };
    function drawLaunch() {
      lBody.innerHTML = "";
      if (lTab === "board") {
        let key = null;
        const keys = h("div", { class: "lv-keys" }, ["A", "B", "C", "D"].map((x, i) => h("button", { type: "button", class: "lv-key", onclick: (e) => { key = key === i ? null : i; keys.querySelectorAll(".lv-key").forEach((b, j) => b.classList.toggle("on", j === key)); } }, x)));
        lBody.append(h("p", { class: "sub" }, "Thầy viết câu hỏi trên bảng / màn hình live, học sinh chỉ chọn A, B, C hoặc D. Bấm vào đáp án đúng (nếu muốn chấm) rồi đưa lên."),
          keys, h("button", { class: "btn acc", onclick: () => openPoll({ p_q: "", p_o: ["A", "B", "C", "D"], p_key: key }) }, "Đưa lên ngay"));
      } else if (lTab === "type") {
        const q = h("textarea", { rows: 2, placeholder: "Nội dung câu hỏi (gõ công thức trong dấu $…$, ví dụ $x^2-1=0$)" });
        let key = 0;
        const os = [0, 1, 2, 3].map((i) => h("input", { type: "text", placeholder: "Phương án " + "ABCD"[i] }));
        const rows = h("div", { class: "lv-typeo" }, os.map((o, i) => h("label", { class: "lv-typerow" }, h("input", { type: "radio", name: "lvk", checked: i === 0, onchange: () => (key = i) }), h("b", {}, "ABCD"[i]), o)));
        lBody.append(q, h("p", { class: "sub" }, "Chọn nút tròn ở phương án đúng:"), rows,
          h("button", { class: "btn acc", onclick: () => { const o = os.map((x) => x.value.trim()).filter(Boolean); if (o.length < 2) return KT.toast("Nhập ít nhất 2 phương án.", "bad");
            openPoll({ p_q: KT.esc(q.value.trim()), p_o: os.map((x) => KT.esc(x.value.trim())).filter(Boolean), p_key: key < o.length ? key : null }); } }, "Đưa lên ngay"));
      } else {
        const gS = h("select", {}, KT.GRADES.map((g) => h("option", { value: g, selected: g === (bankG || st.session.g || (ov.classes[0] && ov.classes[0].grade)) }, "Toán " + g)));
        const lS = h("select", {});
        const list = h("div", { class: "lv-bank" });
        const fillL = () => { lS.innerHTML = ""; CUR[+gS.value].chapters.forEach((ch) => { const og = h("optgroup", { label: "Chương " + romans[ch.no] }); ch.lessons.forEach((L) => og.append(h("option", { value: L.no, selected: +gS.value === (bankG || st.session.g) && L.no === (bankL || st.session.l) }, "Bài " + L.no + ". " + L.name))); lS.append(og); }); };
        const load = async () => {
          bankG = +gS.value; bankL = +lS.value; list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Đang tải…"));
          let qs; try { qs = await T("t_live_bank", { p_g: bankG, p_l: bankL }); } catch (e) { return fail(e); }
          list.innerHTML = "";
          if (!qs.length) { list.append(h("div", { class: "empty" }, "Bài này chưa có câu trắc nghiệm nhiều phương án.")); return; }
          qs.forEach((x) => list.append(h("div", { class: "lv-bq" },
            h("div", { class: "lv-bq-m" }, h("span", { class: "lvl" }, KT.LV[x.lv] || x.lv), h("span", { class: "mono sub" }, x.tag || ""),
              h("button", { class: "btn sm acc", onclick: () => openPoll({ p_qid: x.id }) }, "Đưa lên")),
            h("div", { class: "qmini", html: x.q }),
            h("ol", { class: "prev-o", type: "A" }, x.o.map((o, i) => h("li", { class: i === x.key ? "ok" : "", html: o }))))));
          const need = [...new Set(qs.flatMap((x) => [...((x.q || "") + JSON.stringify(x.o)).matchAll(/data-fig=\\?"([0-9a-f]+)/g)].map((m) => m[1])))].filter((k) => !figs[k]);
          if (need.length) { try { Object.assign(figs, await api.rpc("get_figs", { p_ids: need.slice(0, 200) })); } catch (e) { } }
          KT.typeset(list, figs);
        };
        gS.onchange = () => { fillL(); load(); }; lS.onchange = load; fillL();
        lBody.append(h("div", { class: "lv-bsel" }, gS, lS), list); load();
      }
    }

    function drawHead() {
      const s = st.session;
      head.innerHTML = "";
      head.append(h("div", { class: "review-t" },
        h("button", { class: "btn ghost sm", onclick: () => { liveCur = null; stopPoll(); render(); } }, "← Danh sách"),
        h("div", {}, h("h2", { style: "margin:0;font-size:20px" }, s.title), h("div", { class: "sub" }, lwhen(s.starts_at) + " · " + s.minutes + " phút · Lớp " + s.classes.join(", "))),
        h("span", { class: "sp" }), lstatus(s.status)));
      ctrl.innerHTML = "";
      const on = st.people.filter((p) => p.online).length, joined = st.people.filter((p) => p.joined).length;
      ctrl.append(h("div", { class: "lv-kpis" },
        h("div", {}, h("b", {}, String(on)), h("span", {}, "Đang xem")),
        h("div", {}, h("b", {}, joined + "/" + st.people.length), h("span", {}, "Đã vào lớp")),
        h("div", {}, h("b", {}, String(st.polls.length)), h("span", {}, "Câu hỏi nhanh"))));
      if (s.status === "scheduled") ctrl.append(h("button", { class: "btn lv-go", onclick: async () => { const r = await T("t_live_status", { p_id: id, p_status: "live" }).catch(fail); if (r && r.error) return KT.toast(r.error, "bad"); KT.toast("Đã mở lớp — học sinh thấy video ngay bây giờ", "ok"); refresh(); } }, "● Bắt đầu live"));
      else if (s.status === "live") ctrl.append(h("button", { class: "btn lv-stop", onclick: () => KT.confirm("Kết thúc buổi học?", "Học sinh sẽ không xem video trên web được nữa. Nhớ chuyển video trên YouTube sang <b>Riêng tư</b>.", "Kết thúc", async () => { await T("t_live_status", { p_id: id, p_status: "ended" }).catch(fail); refresh(); }) }, "■ Kết thúc buổi học"));
      else ctrl.append(h("button", { class: "btn ghost", onclick: async () => { await T("t_live_status", { p_id: id, p_status: "live" }).catch(fail); refresh(); } }, "Mở lại lớp"));
      ctrl.append(h("button", { class: "btn ghost sm", onclick: () => exportLive() }, "Xuất điểm danh (Excel)"));
      preview.innerHTML = "";
      if (s.yt_vid) preview.append(h("div", { class: "lv-video sm" }, h("iframe", { src: "https://www.youtube-nocookie.com/embed/" + s.yt_vid + "?autoplay=1&mute=1&rel=0&modestbranding=1", title: "Xem trước", allow: "autoplay; encrypted-media", allowfullscreen: "" })));
      else preview.append(h("div", { class: "lv-video sm empty" }, h("div", {}, "Chưa có link YouTube", h("br"), h("button", { class: "btn sm", onclick: () => liveForm(Object.assign({}, s, { class_ids: s.class_ids }), refresh) }, "Thêm link"))));
    }
    function drawPollNow() {
      const p = st.polls[0];
      const active = p && (p.status === "open" || (Date.now() - new Date(p.opened_at).getTime() < 600e3));
      const sig = active ? JSON.stringify([p.id, p.status, p.n, p.counts, p.fastest]) : "none";
      if (sig === pollSig) return; pollSig = sig;
      pollNow.innerHTML = ""; clearInterval(ringT);
      if (!active) { pollNow.className = "lv-tpoll hidden"; return; }
      pollNow.className = "lv-tpoll panel " + p.status;
      const on = Math.max(st.people.filter((x) => x.online).length, p.n);
      const timer = h("b", { class: "lv-tleft" });
      if (p.status === "open") { const end = Date.now() + p.left_ms; const stp = () => { const l = Math.max(0, end - Date.now()); timer.textContent = Math.ceil(l / 1000) + " giây"; if (!l) { clearInterval(ringT); refresh(); } }; stp(); ringT = setInterval(stp, 250); }
      else timer.textContent = p.status === "revealed" ? "Đã công bố" : "Hết giờ";
      const letters = p.o.every((x, i) => String(x).trim() === "ABCDEFGH"[i]);
      pollNow.append(h("div", { class: "lv-tpoll-h" }, h("span", {}, "⚡ Câu hỏi đang chạy"), timer, h("span", { class: "sp" }),
        h("span", { class: "lv-ans" }, h("b", {}, p.n + "/" + on), " đã trả lời")));
      if (p.q && !letters) pollNow.append(h("div", { class: "qmini", html: p.q }));
      const mx = Math.max(1, ...p.counts);
      pollNow.append(h("div", { class: "lv-tbars" }, p.o.map((o, i) => h("div", { class: "lv-tbar" + (p.key === i ? " ok" : "") },
        h("span", { class: "L" }, "ABCDEFGH"[i]), letters ? h("span", {}) : h("span", { class: "lv-tbar-o", html: o }),
        h("span", { class: "lv-tbar-b" }, h("i", { style: "width:" + (100 * p.counts[i] / mx) + "%" })), h("b", {}, String(p.counts[i]))))));
      const acts = h("div", { class: "lv-tpoll-a" });
      if (p.status === "open") acts.append(h("button", { class: "btn ghost sm", onclick: () => T("t_live_poll_set", { p_poll: p.id, p_action: "add30" }).then(refresh).catch(fail) }, "+30 giây"),
        h("button", { class: "btn ghost sm", onclick: () => T("t_live_poll_set", { p_poll: p.id, p_action: "close" }).then(refresh).catch(fail) }, "Dừng nhận"));
      if (p.status !== "revealed") acts.append(h("button", { class: "btn acc sm", onclick: () => T("t_live_poll_set", { p_poll: p.id, p_action: "reveal" }).then(refresh).catch(fail) }, p.key != null ? "Công bố đáp án" : "Công bố kết quả"));
      else if (p.key != null) acts.append(h("span", { class: "lv-tok" }, "✓ " + p.n_ok + "/" + p.n + " bạn đúng (" + (p.n ? Math.round(100 * p.n_ok / p.n) : 0) + "%)" + (p.fastest.length ? " · Nhanh nhất: " + p.fastest.join(", ") : "")));
      pollNow.append(acts);
      KT.typeset(pollNow, figs);
    }
    function drawHistory() {
      history.innerHTML = "";
      const done = st.polls.filter((p) => p.key != null && p.status !== "open");
      if (!done.length) return;
      history.append(h("div", { class: "section-t" }, "Các câu hỏi nhanh trong buổi"));
      done.forEach((p, i) => history.append(h("div", { class: "lv-hrow" }, h("b", {}, "Câu " + (done.length - i)),
        h("span", { class: "lv-hq", html: p.q ? p.q.replace(/<[^>]+>/g, " ").slice(0, 90) : "Câu trên bảng · đáp án " + "ABCD"[p.key] }),
        h("span", { class: "pill " + (p.n && p.n_ok / p.n >= 0.7 ? "ok" : p.n && p.n_ok / p.n >= 0.4 ? "warn" : "bad") }, p.n_ok + "/" + p.n + " đúng"))));
    }
    function drawPeople() {
      people.innerHTML = "";
      const on = st.people.filter((p) => p.online).length;
      people.append(h("h3", {}, "Điểm danh ", h("span", { class: "sub" }, on + " đang xem · " + st.people.filter((p) => p.joined).length + "/" + st.people.length + " đã vào")));
      const ul = h("div", { class: "lv-plist" });
      st.people.forEach((p) => ul.append(h("div", { class: "lv-p" + (p.online ? " on" : p.joined ? " left" : " no") },
        h("i", { class: "dot", title: p.online ? "Đang xem" : p.joined ? "Đã rời lớp" : "Chưa vào" }),
        h("div", { class: "lv-p-n" }, h("b", {}, p.name), h("span", {}, p.code + (st.session.classes.length > 1 ? " · " + p.class : ""))),
        p.dup ? h("span", { class: "flag hi", title: "Tài khoản này mở lớp học ở hai nơi cùng lúc " + p.dup + " lần — có thể đã đưa tài khoản cho người khác" }, "⚠ 2 nơi") : null,
        h("span", { class: "lv-p-s" }, p.joined ? mmss(p.seconds) : "–"),
        h("span", { class: "lv-p-s" }, p.answered ? p.correct + "/" + p.answered : ""))));
      people.append(ul);
    }
    function addChat(list) {
      (list || []).forEach((c) => {
        const old = chatList.querySelector('[data-id="' + c.id + '"]');
        const node = h("div", { class: "lv-msg" + (c.t ? " t" : "") + (c.hidden ? " hid" : ""), "data-id": c.id },
          h("div", { class: "lv-msg-h" }, c.t ? h("span", { class: "lv-tbadge" }, "Thầy") : h("b", {}, c.name), h("time", {}, new Date(c.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })),
            c.t ? null : h("button", { class: "lv-hide", title: c.hidden ? "Hiện lại" : "Ẩn tin nhắn này với học sinh", onclick: () => T("t_live_chat", { p_id: id, p_hide: c.id }).then(() => { lastChat = Math.min(lastChat, c.id - 1); refresh(); }).catch(fail) }, c.hidden ? "Hiện" : "Ẩn")),
          h("div", { class: "lv-msg-b" }, c.msg));
        if (old) old.replaceWith(node); else { chatList.append(node); }
        lastChat = Math.max(lastChat, c.id);
      });
      if (list && list.length) chatList.scrollTop = chatList.scrollHeight;
    }
    function exportLive() {
      const rows = [["Mã HS", "Họ tên", "Lớp", "Tham gia", "Thời gian xem (phút)", "Câu đã trả lời", "Câu đúng", "Mở 2 nơi"]].concat(st.people.map((p) =>
        [p.code, p.name, p.class, p.joined ? "Có" : "Không", p.joined ? Math.round(p.seconds / 60) : "", p.answered, p.correct, p.dup || ""]));
      download("DiemDanh_" + st.session.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40) + ".csv", rows);
    }
    let firstDraw = true;
    async function refresh() {
      try {
        const r = await T("t_live_state", { p_id: id, p_after: lastChat });
        if (r.error) { KT.toast(r.error, "bad"); liveCur = null; stopPoll(); render(); return; }
        const changedStatus = !st || st.session.status !== r.session.status || st.session.yt_vid !== r.session.yt_vid;
        st = r;
        if (changedStatus || firstDraw) drawHead(); else {
          const on = st.people.filter((p) => p.online).length, joined = st.people.filter((p) => p.joined).length;
          const k = ctrl.querySelectorAll(".lv-kpis b"); if (k.length) { k[0].textContent = on; k[1].textContent = joined + "/" + st.people.length; k[2].textContent = st.polls.length; }
        }
        if (firstDraw) drawLaunch();
        firstDraw = false;
        drawPollNow(); drawHistory(); drawPeople(); addChat(r.chat);
      } catch (e) { fail(e); stopPoll(); }
    }
    await refresh();
    stopPoll();
    poll = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 3000);
  }

  /* ---------------- VIDEO ÔN TẬP ---------------- */
  let vidGrade = null;
  // ===== học phí hàng tháng =====
  const FEE_ST = { paid: "Đã đóng", partial: "Đóng thiếu", late: "Quá hạn", unpaid: "Chưa đóng", free: "Miễn", nofee: "Chưa đặt mức" };
  const vnd = (n) => KT.num(n || 0) + " đ";
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const mFirst = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const mName = (m) => { const d = new Date(m + "T00:00:00"); return "Tháng " + (d.getMonth() + 1) + "/" + d.getFullYear(); };
  const dShort = (s) => { const d = new Date(s + "T00:00:00"); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); };
  const ADJ = { pct: "Giảm theo %", amt: "Giảm số tiền", fixed: "Mức riêng", free: "Miễn học phí" };
  const adjText = (a) => !a ? "" : a.kind === "pct" ? "Giảm " + a.value + "%" : a.kind === "amt" ? "Giảm " + vnd(a.value) : a.kind === "fixed" ? "Mức riêng " + vnd(a.value) : "Miễn học phí";
  const moneyInput = (id, v) => {
    const i = h("input", { id, type: "text", inputmode: "numeric", value: v ? KT.num(v) : "", placeholder: "0", autocomplete: "off" });
    i.addEventListener("input", () => { const n = +i.value.replace(/\D/g, ""); i.value = n ? KT.num(n) : ""; });
    i.num = () => +String(i.value).replace(/\D/g, "") || 0;
    return i;
  };
  let feeMonth = mFirst(new Date()), feeClass = "", feeFilter = "all", feeQ = "";
  /* ---------------- ĐIỂM LÀM BÀI: mỗi bài tự luyện / đề có sẵn của học sinh dùng 1 điểm ---------------- */
  let crClass = "", crQ = "";
  async function tabCredits(el) {
    el.innerHTML = "";
    let rows;
    try { rows = await T("t_credits", { p_class: crClass ? +crClass : null }); } catch (e) { fail(e); return; }
    const picked = new Set();
    el.append(h("div", { class: "note" }, "Mỗi lần học sinh bắt đầu một bài tự luyện (mục Học tập) hoặc một đề có sẵn sẽ bị trừ 1 điểm; làm tiếp bài đang dở không bị trừ. "
      + "Bài thầy cô giao, Ôn câu sai, Nhiệm vụ hôm nay và Bài bổ sung không dùng điểm. Hết điểm thì em không mở được bài tự luyện mới."));
    const sel = h("select", { "aria-label": "Lọc theo lớp", onchange: (e) => { crClass = e.target.value; tabCredits(el); } }, h("option", { value: "" }, "Tất cả lớp"),
      ov.classes.map((c) => h("option", { value: String(c.id), selected: String(c.id) === crClass }, c.name + " (" + c.n + " HS)")));
    const q = h("input", { type: "search", placeholder: "Tìm tên hoặc mã học sinh", value: crQ, "aria-label": "Tìm học sinh" });
    const amt = h("input", { type: "number", value: 10, min: -1000, max: 1000, "aria-label": "Số điểm cấp", style: "width:90px" });
    const pickInfo = h("span", { class: "sub" });
    const giveSel = h("button", { class: "btn sm", disabled: true, onclick: () => give([...picked], +amt.value, "Cấp cho " + picked.size + " em") }, "Cấp cho các em đã chọn");
    const giveAll = h("button", { class: "btn ghost sm", onclick: () => { const ids = shown().map((r) => r.id); if (!ids.length) return;
      KT.confirm("Cấp điểm cho " + ids.length + " em?", "Mỗi em " + (+amt.value > 0 ? "được cộng " : "bị trừ ") + "<b>" + Math.abs(+amt.value) + " điểm</b>.", "Cấp điểm", () => give(ids, +amt.value, "")); } }, "Cấp cho cả danh sách");
    const tot = rows.reduce((a, r) => a + r.credits, 0), out = rows.filter((r) => r.credits <= 0).length, used = rows.reduce((a, r) => a + r.used, 0);
    const kpi = (n, l, cls) => h("div", { class: "kpi " + (cls || "") }, h("div", { class: "n" }, n), h("div", { class: "l" }, l));
    el.append(h("div", { class: "kpis" }, kpi(rows.length, "Học sinh"), kpi(KT.num(tot), "Tổng điểm còn lại"), kpi(KT.num(used), "Điểm đã dùng"), kpi(out, "Em đã hết điểm", out ? "warn" : "")));
    el.append(h("div", { class: "fee-filter cr-tools" }, sel, q, h("span", { class: "cr-amt" }, h("label", {}, "Số điểm"), amt), giveSel, giveAll, pickInfo));
    const tbody = h("tbody");
    const all = h("input", { type: "checkbox", "aria-label": "Chọn tất cả", onchange: (e) => { shown().forEach((r) => (e.target.checked ? picked.add(r.id) : picked.delete(r.id))); draw(); } });
    el.append(h("div", { class: "tbl-wrap" }, h("table", { class: "tbl cr-tbl" }, h("thead", {}, h("tr", {}, h("th", {}, all), h("th", {}, "Học sinh"), h("th", {}, "Lớp"),
      h("th", { class: "r" }, "Còn lại"), h("th", { class: "r" }, "Đã dùng"), h("th", {}, "Dùng gần nhất"), h("th", {}, ""))), tbody)));
    const fold = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
    const shown = () => { const k = fold(crQ); return rows.filter((r) => !k || fold(r.name).includes(k) || r.code.toLowerCase().includes(k)); };
    q.addEventListener("input", () => { crQ = q.value; draw(); });
    async function give(ids, d, note) {
      if (!ids.length) return KT.toast("Chưa chọn học sinh nào.", "bad");
      if (!d || Math.abs(d) > 1000) return KT.toast("Nhập số điểm khác 0 (có thể âm để bớt).", "bad");
      try { const r = await T("t_credit_give", { p_ids: ids, p_delta: Math.round(d), p_note: note || "" }); KT.toast((d > 0 ? "Đã cấp " : "Đã bớt ") + Math.abs(d) + " điểm cho " + r.n + " em", "ok"); tabCredits(el); }
      catch (e) { fail(e); }
    }
    function customModal(r) {
      const n = h("input", { type: "number", id: "crN", value: 10, min: -1000, max: 1000 }), note = h("input", { id: "crNote", placeholder: "VD: Thưởng tuần học tốt" });
      let close; close = KT.modal([h("h3", {}, "Điểm làm bài · " + r.name), h("p", { class: "sub" }, "Em đang còn " + r.credits + " điểm. Nhập số âm để bớt điểm."),
        h("div", { class: "form" }, h("div", {}, h("label", { for: "crN" }, "Số điểm cộng thêm"), n), h("div", {}, h("label", { for: "crNote" }, "Ghi chú (không bắt buộc)"), note)),
        h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"), h("button", { class: "btn", onclick: () => { close(); give([r.id], +n.value, note.value.trim()); } }, "Lưu"))]);
    }
    async function histModal(r) {
      let log; try { log = await T("t_credit_log", { p_student: r.id }); } catch (e) { return fail(e); }
      KT.modal(h("div", { class: "cr-hist" }, h("h3", {}, r.name + " · còn " + r.credits + " điểm"),
        log.length ? h("ul", { class: "cr-list" }, log.map((l) => h("li", {}, h("span", { class: "cr-d " + (l.d > 0 ? "up" : "dn") }, (l.d > 0 ? "+" : "") + l.d),
          h("div", {}, h("b", {}, l.reason || (l.d > 0 ? "Cấp thêm" : "Bài tự luyện")), h("small", {}, KT.dt(l.at) + (l.by ? ", " + l.by : "") + ", còn " + l.bal + " điểm")))))
          : h("p", { class: "sub" }, "Chưa có thay đổi nào.")), { wide: false });
    }
    function draw() {
      tbody.innerHTML = "";
      const list = shown();
      list.forEach((r) => {
        const cb = h("input", { type: "checkbox", checked: picked.has(r.id), "aria-label": "Chọn " + r.name, onchange: (e) => { e.target.checked ? picked.add(r.id) : picked.delete(r.id); upd(); } });
        tbody.append(h("tr", { class: r.credits <= 0 ? "cr-out" : "" }, h("td", {}, cb), h("td", {}, h("b", {}, r.name), h("div", { class: "sub mono" }, r.code)), h("td", {}, r.class || ""),
          h("td", { class: "r" }, h("span", { class: "cr-left" + (r.credits <= 0 ? " out" : r.credits <= 2 ? " low" : "") }, String(r.credits))),
          h("td", { class: "r" }, String(r.used)), h("td", {}, r.last ? KT.dt(r.last) : h("span", { class: "sub" }, "Chưa dùng")),
          h("td", { class: "cr-act" }, h("button", { class: "btn ghost sm", onclick: () => give([r.id], 5, "") }, "+5"), h("button", { class: "btn ghost sm", onclick: () => give([r.id], 10, "") }, "+10"),
            h("button", { class: "btn ghost sm", onclick: () => customModal(r) }, "Khác…"), h("button", { class: "linkbtn", onclick: () => histModal(r) }, "Lịch sử"))));
      });
      if (!list.length) tbody.append(h("tr", {}, h("td", { colspan: 7, class: "empty" }, rows.length ? "Không có học sinh nào khớp." : "Lớp chưa có học sinh.")));
      all.checked = list.length > 0 && list.every((r) => picked.has(r.id));
      upd();
    }
    function upd() { giveSel.disabled = !picked.size; pickInfo.textContent = picked.size ? "Đã chọn " + picked.size + " em" : ""; }
    draw();
  }

  async function tabFees(el) {
    el.innerHTML = "";
    let d, classes;
    try { [d, classes] = await Promise.all([T("t_fee_month", { p_month: ymd(feeMonth) }), T("t_fee_classes")]); } catch (e) { fail(e); return; }
    const rows = d.rows || [];
    const noFee = classes.filter((c) => c.n && !c.amount);
    const nav = h("div", { class: "fee-nav" },
      h("button", { class: "btn ghost sm", "aria-label": "Tháng trước", onclick: () => { feeMonth = new Date(feeMonth.getFullYear(), feeMonth.getMonth() - 1, 1); tabFees(el); } }, "‹"),
      h("b", { class: "fee-m" }, mName(ymd(feeMonth))),
      h("button", { class: "btn ghost sm", "aria-label": "Tháng sau", onclick: () => { feeMonth = new Date(feeMonth.getFullYear(), feeMonth.getMonth() + 1, 1); tabFees(el); } }, "›"),
      ymd(feeMonth) !== ymd(mFirst(new Date())) ? h("button", { class: "btn ghost sm", onclick: () => { feeMonth = mFirst(new Date()); tabFees(el); } }, "Tháng này") : null,
      h("span", { class: "fee-sp" }),
      h("button", { class: "btn ghost sm", onclick: () => feeClassModal(classes, () => tabFees(el)) }, "Cài học phí các lớp"),
      h("button", { class: "btn ghost sm", onclick: () => feeExcel(rows) }, "Xuất Excel"));
    el.append(nav);
    if (noFee.length) el.append(h("div", { class: "note" }, "Lớp chưa đặt mức học phí: " + noFee.map((c) => c.name).join(", ") + ". ",
      h("button", { class: "linkbtn", onclick: () => feeClassModal(classes, () => tabFees(el)) }, "Đặt mức ngay")));
    // số liệu tháng
    const inCls = rows.filter((r) => !feeClass || String(r.class_id) === feeClass);
    const bill = inCls.filter((r) => r.status !== "nofee");
    const exp = bill.reduce((a, r) => a + r.amount, 0), got = bill.reduce((a, r) => a + Math.min(r.paid, r.amount || r.paid), 0);
    const paidN = bill.filter((r) => r.status === "paid" || r.status === "free").length, lateN = bill.filter((r) => r.status === "late").length;
    const kpi = (n, l, cls) => h("div", { class: "kpi " + (cls || "") }, h("div", { class: "n" }, n), h("div", { class: "l" }, l));
    el.append(h("div", { class: "kpis fee-kpis" }, kpi(vnd(exp), "Phải thu"), kpi(vnd(got), "Đã thu", "ok"), kpi(vnd(Math.max(0, exp - got)), "Còn phải thu", exp - got > 0 ? "warn" : ""),
      kpi(paidN + "/" + bill.length, "Em đã đóng đủ" + (lateN ? ", " + lateN + " em quá hạn" : ""))));
    // bộ lọc
    const sel = h("select", { "aria-label": "Lọc theo lớp", onchange: (e) => { feeClass = e.target.value; tabFees(el); } }, h("option", { value: "" }, "Tất cả lớp"),
      classes.map((c) => h("option", { value: String(c.id), selected: String(c.id) === feeClass }, c.name)));
    const q = h("input", { type: "search", placeholder: "Tìm tên hoặc mã học sinh", value: feeQ, "aria-label": "Tìm học sinh" });
    const chips = h("div", { class: "chips" }, [["all", "Tất cả"], ["owe", "Chưa đóng đủ"], ["late", "Quá hạn"], ["paid", "Đã đóng"]].map(([k, l]) =>
      h("button", { class: "chip" + (feeFilter === k ? " on" : ""), onclick: () => { feeFilter = k; draw(); chips.querySelectorAll(".chip").forEach((b, i) => b.classList.toggle("on", ["all", "owe", "late", "paid"][i] === k)); } }, l)));
    el.append(h("div", { class: "fee-filter" }, sel, q, chips));
    const tbody = h("tbody");
    const table = h("div", { class: "tbl-wrap" }, h("table", { class: "tbl fee-tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Học sinh"), h("th", {}, "Lớp"), h("th", { class: "r" }, "Học phí"), h("th", { class: "r" }, "Đã đóng"), h("th", {}, "Trạng thái"), h("th", {}, ""))), tbody));
    el.append(table);
    q.addEventListener("input", () => { feeQ = q.value; draw(); });
    function draw() {
      tbody.innerHTML = "";
      const fold = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); const k = fold(feeQ);
      const list = inCls.filter((r) => (feeFilter === "all" || (feeFilter === "owe" && ["unpaid", "late", "partial"].includes(r.status)) || (feeFilter === "late" && r.status === "late") || (feeFilter === "paid" && ["paid", "free"].includes(r.status)))
        && (!k || (fold(r.name).includes(k) || r.code.toLowerCase().includes(k))));
      if (!list.length) { tbody.append(h("tr", {}, h("td", { colspan: 6, class: "empty" }, rows.length ? "Không có học sinh nào khớp bộ lọc." : "Chưa có học sinh nào trong các lớp của thầy."))); return; }
      list.forEach((r) => {
        const left = Math.max(0, r.amount - r.paid);
        tbody.append(h("tr", { class: "fs-row fs-" + r.status },
          h("td", {}, h("b", {}, r.name), h("small", { class: "sub" }, " " + r.code), r.adj ? h("div", { class: "fee-adj" }, adjText(r.adj)) : null),
          h("td", {}, r.class || "–"),
          h("td", { class: "r" }, r.status === "nofee" ? "–" : vnd(r.amount), r.manual ? h("small", { class: "sub", title: "Thầy đã sửa tay" }, " ✎") : null),
          h("td", { class: "r" }, r.paid ? vnd(r.paid) : "–", r.last ? h("div", { class: "sub" }, dShort(r.last)) : null),
          h("td", {}, h("span", { class: "fee-badge fs-" + r.status }, FEE_ST[r.status]), left && r.status !== "nofee" ? h("div", { class: "sub" }, "Còn " + vnd(left)) : null),
          h("td", { class: "fee-act" },
            left > 0 && r.status !== "nofee" ? h("button", { class: "btn sm", onclick: () => feePayModal(r, () => tabFees(el)) }, "Thu tiền") : null,
            h("button", { class: "btn ghost sm", onclick: () => feeRowModal(r, () => tabFees(el)) }, r.pays.length ? "Chi tiết" : "Sửa"))));
      });
    }
    draw();
    el.append(await feeReport());
  }
  function feeClassModal(classes, done) {
    let close;
    const rowsEl = classes.map((c) => {
      const a = moneyInput("fa" + c.id, c.amount), dd = h("input", { type: "number", min: 1, max: 28, value: c.due_day, "aria-label": "Hạn đóng lớp " + c.name });
      return { c, a, dd, el: h("tr", {}, h("td", {}, h("b", {}, c.name), h("small", { class: "sub" }, " " + c.n + " em")), h("td", {}, a), h("td", {}, dd)) };
    });
    close = KT.modal(h("div", {}, h("h3", {}, "Học phí các lớp"),
      h("p", { class: "sub" }, "Mức học phí mỗi tháng của từng lớp. Em nào được giảm hay miễn thì thầy chỉnh riêng ở nút Sửa của em đó. Đổi mức thì các phiếu tháng này chưa thu đồng nào sẽ tự tính lại."),
      h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Lớp"), h("th", {}, "Học phí/tháng (đ)"), h("th", {}, "Hạn đóng (ngày)"))), h("tbody", {}, rowsEl.map((x) => x.el)))),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async () => {
          try {
            for (const x of rowsEl) if (x.a.num() !== x.c.amount || +x.dd.value !== x.c.due_day) await T("t_fee_class_set", { p_class: x.c.id, p_amount: x.a.num(), p_due: +x.dd.value || 10 });
            close(); KT.toast("Đã lưu học phí các lớp", "ok"); done();
          } catch (e) { fail(e); }
        } }, "Lưu"))), { wide: true });
  }
  function feePayModal(r, done) {
    let close;
    const left = Math.max(0, r.amount - r.paid);
    const amt = moneyInput("fpA", left), on = h("input", { id: "fpD", type: "date", value: ymd(new Date()) });
    const met = h("select", { id: "fpM" }, h("option", { value: "cash" }, "Tiền mặt"), h("option", { value: "bank" }, "Chuyển khoản"));
    const note = h("input", { id: "fpN", maxlength: 200, placeholder: "Không bắt buộc" });
    close = KT.modal(h("div", {}, h("h3", {}, "Thu học phí: " + r.name),
      h("p", { class: "sub" }, mName(String(d0(r))) + ". Học phí " + vnd(r.amount) + (r.paid ? ", đã đóng " + vnd(r.paid) : "") + ", còn " + vnd(left) + "."),
      h("div", { class: "form" },
        h("div", {}, h("label", { for: "fpA" }, "Số tiền nhận (đ)"), amt), h("div", {}, h("label", { for: "fpD" }, "Ngày nhận"), on),
        h("div", {}, h("label", { for: "fpM" }, "Hình thức"), met), h("div", {}, h("label", { for: "fpN" }, "Ghi chú"), note)),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async () => {
          if (amt.num() <= 0) { KT.toast("Nhập số tiền nhận", "bad"); return; }
          try { const rc = await T("t_fee_pay", { p_bill: r.bill, p_amount: amt.num(), p_on: on.value || null, p_method: met.value, p_note: note.value.trim() }); close(); done(); receiptModal(rc); }
          catch (e) { fail(e); }
        } }, "Ghi nhận và lập biên nhận"))));
  }
  const d0 = (r) => ymd(feeMonth);
  function feeRowModal(r, done) {
    let close;
    const amt = moneyInput("fbA", r.amount), note = h("input", { id: "fbN", maxlength: 200, value: r.note || "", placeholder: "Không bắt buộc" });
    const kind = h("select", { id: "fjK" }, h("option", { value: "none" }, "Không giảm"), Object.keys(ADJ).map((k) => h("option", { value: k, selected: r.adj && r.adj.kind === k }, ADJ[k])));
    const val = h("input", { id: "fjV", type: "text", inputmode: "numeric", value: r.adj && r.adj.kind !== "free" ? KT.num(r.adj.value) : "", placeholder: "VD: 20 (%) hoặc 100.000 (đ)" });
    const jn = h("input", { id: "fjN", maxlength: 200, value: (r.adj && r.adj.note) || "", placeholder: "VD: anh chị em cùng học" });
    const pays = r.pays || [];
    close = KT.modal(h("div", { class: "fee-row" }, h("h3", {}, r.name + " (" + r.code + ")"), h("p", { class: "sub" }, (r.class ? "Lớp " + r.class + ". " : "") + mName(ymd(feeMonth)) + ": " + FEE_ST[r.status] + "."),
      pays.length ? h("div", {}, h("h4", {}, "Các lần đã đóng"), h("ul", { class: "fee-pays" }, pays.map((p) => h("li", {},
        h("span", {}, dShort(p.on) + ": " + vnd(p.amount) + (p.method === "bank" ? " (chuyển khoản)" : " (tiền mặt)") + (p.note ? ", " + p.note : "")),
        h("span", {}, h("button", { class: "btn ghost sm", onclick: async () => { try { receiptModal(await T("t_fee_receipt", { p_payment: p.id })); } catch (e) { fail(e); } } }, "Biên nhận"),
          h("button", { class: "btn ghost sm danger", onclick: () => KT.confirm("Huỷ khoản thu này?", "Khoản " + vnd(p.amount) + " ngày " + dShort(p.on) + " sẽ bị xoá, biên nhận " + p.no + " không còn giá trị.", "Huỷ khoản thu", async () => { try { await T("t_fee_pay_undo", { p_payment: p.id }); close(); done(); KT.toast("Đã huỷ khoản thu", "ok"); } catch (e) { fail(e); } }) }, "Huỷ")))))) : null,
      h("h4", {}, "Học phí tháng này"),
      h("div", { class: "form" }, h("div", {}, h("label", { for: "fbA" }, "Số tiền (đ)"), amt), h("div", {}, h("label", { for: "fbN" }, "Ghi chú"), note),
        h("div", { class: "full" }, h("button", { class: "btn ghost sm", onclick: async () => { try { await T("t_fee_bill_set", { p_bill: r.bill, p_amount: amt.num(), p_note: note.value.trim() }); close(); done(); KT.toast("Đã sửa học phí tháng này", "ok"); } catch (e) { fail(e); } } }, "Lưu số tiền tháng này"),
          r.manual ? h("button", { class: "btn ghost sm", style: "margin-left:8px", onclick: async () => { try { await T("t_fee_bill_set", { p_bill: r.bill, p_amount: 0, p_note: note.value.trim(), p_auto: true }); close(); done(); } catch (e) { fail(e); } } }, "Tính lại theo mức lớp") : null)),
      h("h4", {}, "Giảm hoặc miễn học phí (áp dụng mọi tháng)"),
      h("div", { class: "form" }, h("div", {}, h("label", { for: "fjK" }, "Kiểu"), kind), h("div", {}, h("label", { for: "fjV" }, "Mức giảm"), val), h("div", { class: "full" }, h("label", { for: "fjN" }, "Lí do"), jn),
        h("div", { class: "full" }, h("button", { class: "btn sm", onclick: async () => {
          try { await T("t_fee_adjust_set", { p_student: r.sid, p_kind: kind.value, p_value: +String(val.value).replace(/\D/g, "") || 0, p_note: jn.value.trim() }); close(); done(); KT.toast("Đã lưu mức giảm. Các tháng chưa thu sẽ tính theo mức mới.", "ok"); }
          catch (e) { fail(e); }
        } }, "Lưu mức giảm")))), { wide: true });
  }
  function receiptModal(rc) {
    const body = () => '<div class="rc"><div class="rc-h"><b>KIẾN HỌC TOÁN</b><span>Thầy Lê Văn Hùng · 0938 829 686</span></div>'
      + '<h2>BIÊN NHẬN HỌC PHÍ</h2><p class="rc-no">Số: ' + esc(rc.no) + '</p><table>'
      + '<tr><td>Học sinh</td><td><b>' + esc(rc.name) + '</b> (' + esc(rc.code) + ')</td></tr>'
      + (rc.class ? '<tr><td>Lớp</td><td>' + esc(rc.class) + '</td></tr>' : '')
      + '<tr><td>Học phí</td><td>' + mName(rc.month) + ': ' + vnd(rc.bill_amount) + '</td></tr>'
      + '<tr><td>Số tiền nhận</td><td><b>' + vnd(rc.amount) + '</b></td></tr>'
      + '<tr><td>Hình thức</td><td>' + (rc.method === 'bank' ? 'Chuyển khoản' : 'Tiền mặt') + '</td></tr>'
      + '<tr><td>Ngày nhận</td><td>' + dShort(rc.on) + '</td></tr>'
      + '<tr><td>Tình trạng</td><td>' + (rc.paid_total >= rc.bill_amount ? 'Đã đóng đủ học phí ' + mName(rc.month).toLowerCase() : 'Còn thiếu ' + vnd(rc.bill_amount - rc.paid_total)) + '</td></tr>'
      + (rc.note ? '<tr><td>Ghi chú</td><td>' + esc(rc.note) + '</td></tr>' : '')
      + '</table><div class="rc-sign"><span>Người nộp</span><span>Người nhận<br><br><br><b>' + esc(rc.teacher || '') + '</b></span></div></div>';
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const print = () => {
      const f = h("iframe", { style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0", "aria-hidden": "true" });
      document.body.append(f);
      const doc = f.contentDocument;
      doc.open(); doc.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Biên nhận ' + esc(rc.no) + '</title><style>' + RC_CSS + '@page{size:A5;margin:12mm}body{margin:0}</style></head><body>' + body() + '</body></html>'); doc.close();
      setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 250);
    };
    let close;
    close = KT.modal(h("div", {}, h("div", { class: "rc-wrap", html: '<style>' + RC_CSS + '</style>' + body() }),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Đóng"), h("button", { class: "btn", onclick: print }, "In biên nhận"))), { wide: true });
  }
  const RC_CSS = '.rc{font-family:"Be Vietnam Pro",Arial,sans-serif;color:#1d1934;background:#fff;max-width:520px;margin:0 auto;padding:22px 24px;border:1.5px solid #1d1934;border-radius:6px}'
    + '.rc-h{display:flex;justify-content:space-between;gap:10px;font-size:12px;border-bottom:1px solid #ccc;padding-bottom:8px}.rc h2{text-align:center;margin:16px 0 2px;font-size:20px;letter-spacing:.04em}'
    + '.rc-no{text-align:center;margin:0 0 12px;font-size:12px;color:#555}.rc table{width:100%;border-collapse:collapse;font-size:14px}.rc td{padding:6px 4px;border-bottom:1px dotted #bbb;vertical-align:top}'
    + '.rc td:first-child{width:36%;color:#555}.rc-sign{display:flex;justify-content:space-around;text-align:center;margin-top:18px;font-size:13px;min-height:80px}';
  async function feeReport() {
    const to = mFirst(new Date()), from = new Date(to.getFullYear(), to.getMonth() - 5, 1);
    let rep = [];
    try { rep = await T("t_fee_report", { p_from: ymd(from), p_to: ymd(to) }); } catch (e) { return h("div"); }
    const by = {};
    rep.forEach((r) => { const m = by[r.month] || (by[r.month] = { month: r.month, exp: 0, got: 0, n: 0, paid: 0, cls: [] }); m.exp += +r.expected; m.got += Math.min(+r.collected, +r.expected || +r.collected); m.n += r.n; m.paid += r.paid_n; m.cls.push(r); });
    const ms = Object.values(by).sort((a, b) => (a.month < b.month ? 1 : -1));
    const box = h("div", { class: "panel fee-rep" }, h("div", { class: "fee-rep-h" }, h("h3", {}, "Báo cáo thu 6 tháng gần đây"), ms.length ? h("button", { class: "btn ghost sm", onclick: () => feeExcel(null, ms) }, "Xuất báo cáo Excel") : null));
    if (!ms.length) { box.append(h("p", { class: "sub" }, "Chưa có dữ liệu. Báo cáo sẽ có sau khi thầy đặt học phí và ghi nhận các khoản thu.")); return box; }
    const max = Math.max(...ms.map((m) => m.exp), 1);
    box.append(h("div", { class: "fee-bars", role: "img", "aria-label": "Đã thu so với phải thu theo tháng" }, ms.slice().reverse().map((m) =>
      h("div", { class: "fee-bar" }, h("div", { class: "fb-col", title: mName(m.month) + ": thu " + vnd(m.got) + " / " + vnd(m.exp) },
        h("i", { class: "fb-exp", style: "height:" + Math.round(m.exp / max * 100) + "%" }), h("i", { class: "fb-got", style: "height:" + Math.round(m.got / max * 100) + "%" })),
        h("small", {}, mName(m.month).replace("Tháng ", "T"))))),
      h("div", { class: "fee-legend" }, h("span", { class: "lg-got" }, "Đã thu"), h("span", { class: "lg-exp" }, "Phải thu")));
    box.append(h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Tháng"), h("th", { class: "r" }, "Phải thu"), h("th", { class: "r" }, "Đã thu"), h("th", { class: "r" }, "Còn nợ"), h("th", { class: "r" }, "Đã đóng đủ"))),
      h("tbody", {}, ms.map((m) => [h("tr", { class: "fee-mrow" }, h("td", {}, h("b", {}, mName(m.month))), h("td", { class: "r" }, vnd(m.exp)), h("td", { class: "r" }, vnd(m.got)), h("td", { class: "r" }, vnd(Math.max(0, m.exp - m.got))), h("td", { class: "r" }, m.paid + "/" + m.n)),
        m.cls.map((c) => h("tr", { class: "fee-crow" }, h("td", {}, "Lớp " + (c.class || "?")), h("td", { class: "r" }, vnd(c.expected)), h("td", { class: "r" }, vnd(Math.min(+c.collected, +c.expected || +c.collected))), h("td", { class: "r" }, vnd(Math.max(0, c.expected - c.collected))), h("td", { class: "r" }, c.paid_n + "/" + c.n)))]).flat(2)))));
    return box;
  }
  // xuất Excel: tải thư viện SheetJS khi cần
  let xlsxP = null;
  const loadXlsx = () => xlsxP || (xlsxP = new Promise((ok, bad) => { if (window.XLSX) return ok(window.XLSX); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxP = null; bad(new Error("Không tải được thư viện Excel")); }; document.head.append(s); }));
  async function feeExcel(rows, months) {
    let X; try { X = await loadXlsx(); } catch (e) { KT.toast("Không tải được công cụ xuất Excel, thầy kiểm tra mạng rồi thử lại.", "bad"); return; }
    const wb = X.utils.book_new();
    const tag = mName(ymd(feeMonth)).replace("Tháng ", "T").replace("/", "-");
    if (rows) {
      const data = rows.map((r) => ({ "Mã HS": r.code, "Họ tên": r.name, "Lớp": r.class || "", "Học phí": r.amount, "Đã đóng": r.paid, "Còn thiếu": Math.max(0, r.amount - r.paid), "Trạng thái": FEE_ST[r.status], "Ngày đóng gần nhất": r.last ? dShort(r.last) : "", "Giảm/miễn": adjText(r.adj), "SĐT": r.phone || "", "Ghi chú": r.note || "" }));
      const ws = X.utils.json_to_sheet(data); ws["!cols"] = [10, 24, 8, 12, 12, 12, 12, 14, 18, 14, 24].map((w) => ({ wch: w }));
      X.utils.book_append_sheet(wb, ws, tag);
      const pays = []; rows.forEach((r) => (r.pays || []).forEach((p) => pays.push({ "Số biên nhận": p.no, "Ngày": dShort(p.on), "Mã HS": r.code, "Họ tên": r.name, "Lớp": r.class || "", "Số tiền": p.amount, "Hình thức": p.method === "bank" ? "Chuyển khoản" : "Tiền mặt", "Ghi chú": p.note || "" })));
      if (pays.length) { const w2 = X.utils.json_to_sheet(pays); w2["!cols"] = [16, 12, 10, 24, 8, 12, 14, 24].map((w) => ({ wch: w })); X.utils.book_append_sheet(wb, w2, "Các khoản thu"); }
      X.writeFile(wb, "HocPhi_" + tag + ".xlsx");
    } else {
      const data = []; months.forEach((m) => { data.push({ "Tháng": mName(m.month), "Lớp": "Tất cả", "Phải thu": m.exp, "Đã thu": m.got, "Còn nợ": Math.max(0, m.exp - m.got), "Số em": m.n, "Đã đóng đủ": m.paid });
        m.cls.forEach((c) => data.push({ "Tháng": mName(m.month), "Lớp": c.class || "", "Phải thu": +c.expected, "Đã thu": Math.min(+c.collected, +c.expected || +c.collected), "Còn nợ": Math.max(0, c.expected - c.collected), "Số em": c.n, "Đã đóng đủ": c.paid_n })); });
      const ws = X.utils.json_to_sheet(data); ws["!cols"] = [14, 10, 14, 14, 14, 8, 10].map((w) => ({ wch: w }));
      X.utils.book_append_sheet(wb, ws, "Báo cáo"); X.writeFile(wb, "BaoCaoHocPhi.xlsx");
    }
  }
  // video bắt buộc: học sinh lớp mình phải xem xong mới vào được trang
  async function tabGate(el) {
    let d;
    try { d = await T("t_gate_get"); } catch (e) { fail(e); return; }
    const v = d.video || {};
    const url = h("input", { id: "gU", type: "url", value: v.url || "", placeholder: "https://www.youtube.com/watch?v=… hoặc link TikTok đầy đủ" });
    const title = h("input", { id: "gT", maxlength: 150, value: v.title || "", placeholder: "VD: Lời nhắn của thầy trước kì thi" });
    const mm = h("input", { id: "gM", type: "number", min: 0, max: 60, value: Math.floor((v.secs || 60) / 60) });
    const ss = h("input", { id: "gS", type: "number", min: 0, max: 59, value: (v.secs || 60) % 60 });
    const mode = h("select", { id: "gMo" }, h("option", { value: "once", selected: v.mode !== "login" }, "Xem một lần (cho tới khi thầy đổi video)"),
      h("option", { value: "login", selected: v.mode === "login" }, "Xem lại mỗi lần đăng nhập"));
    const on = h("input", { type: "checkbox", id: "gOn", checked: d.video ? v.active : true });
    const prev = h("div", { class: "vprev" });
    const parse = (u) => { let m = String(u).match(/tiktok\.com\/(?:@[^/?#]+\/video|embed(?:\/v2)?|player\/v1|v)\/(\d{8,25})/); if (m) return { p: "tt", vid: m[1] };
      m = String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? { p: "yt", vid: m[1] } : null; };
    const drawPrev = () => { prev.innerHTML = ""; const u = url.value.trim(); if (!u) return; const x = parse(u);
      if (!x) { prev.append(h("div", { class: "note bad" }, "Chưa đọc được link. Dán link đầy đủ của video YouTube hoặc TikTok.")); return; }
      prev.append(h("p", { class: "sub" }, "Xem trước:"), KT.videoFrame(x)); };
    url.addEventListener("change", drawPrev); url.addEventListener("paste", () => setTimeout(drawPrev, 50));
    const save = async (reset) => {
      if (!parse(url.value.trim())) { drawPrev(); return; }
      const secs = Math.max(5, (+mm.value || 0) * 60 + (+ss.value || 0));
      try {
        const x = await T("t_gate_set", { p_url: url.value.trim(), p_title: title.value.trim(), p_secs: secs, p_mode: mode.value, p_active: on.checked, p_reset: !!reset });
        if (x.error) { KT.toast(x.error, "bad"); return; }
        KT.toast(reset ? "Đã yêu cầu tất cả học sinh xem lại" : on.checked ? "Đã lưu. Học sinh lớp thầy sẽ phải xem video khi đăng nhập." : "Đã lưu và tắt video bắt buộc", "ok");
        el.innerHTML = ""; tabGate(el);
      } catch (e) { fail(e); }
    };
    el.append(h("div", { class: "panel" }, h("h3", {}, "Video bắt buộc khi học sinh đăng nhập"),
      h("p", { class: "sub" }, "Học sinh các lớp của thầy phải bấm mở video và xem đủ thời gian tối thiểu thì mới dùng được trang web. Thời gian do máy chủ tính, học sinh không bỏ qua được."),
      h("div", { class: "form" },
        h("div", { class: "full" }, h("label", { for: "gU" }, "Link video"), url),
        h("div", { class: "full" }, h("label", { for: "gT" }, "Tiêu đề (học sinh sẽ thấy)"), title),
        h("div", {}, h("label", { for: "gM" }, "Xem tối thiểu (phút)"), mm), h("div", {}, h("label", { for: "gS" }, "và (giây)"), ss),
        h("div", { class: "full" }, h("label", { for: "gMo" }, "Khi nào phải xem"), mode),
        h("div", { class: "full" }, h("label", { class: "chk" }, on, " Bật video bắt buộc")),
        h("div", { class: "full" }, h("button", { class: "btn", onclick: () => save(false) }, "Lưu"),
          d.video ? h("button", { class: "btn ghost", style: "margin-left:8px", onclick: () => KT.confirm("Yêu cầu xem lại?", "Mọi học sinh lớp thầy, kể cả em đã xem, sẽ phải xem lại video này ở lần vào web tiếp theo.", "Yêu cầu xem lại", () => save(true)) }, "Bắt tất cả xem lại") : null)),
      prev));
    drawPrev();
    if (d.video) {
      const pend = d.pending || [];
      el.append(h("div", { class: "panel" }, h("h3", {}, "Tình hình xem video"),
        h("p", { class: "sub" }, (v.active ? "Đang bật. " : "Đang tắt. ") + "Đã xem: " + (d.done || 0) + "/" + (d.total || 0) + " học sinh" + (v.mode === "login" ? " (trong 24 giờ qua)." : ".")),
        pend.length ? h("details", {}, h("summary", {}, "Chưa xem (" + pend.length + " em)"),
          h("ul", { class: "gate-list" }, pend.slice(0, 300).map((p) => h("li", {}, p.name + " (" + p.code + (p.class ? ", lớp " + p.class : "") + ")")))) : h("p", { class: "sub" }, "Tất cả học sinh đã xem.")));
    }
  }
  async function tabVideos(el) {
    const c0 = (ov.classes || [])[0];
    if (vidGrade == null) vidGrade = c0 && CUR[c0.grade] ? c0.grade : (CUR[10] ? 10 : KT.GRADES[0]);
    const gSel = h("select", { id: "vG" }, KT.GRADES.map((g) => h("option", { value: g, selected: g === vidGrade }, "Toán " + g)));
    const lSel = h("select", { id: "vL" });
    const fillL = () => { lSel.innerHTML = ""; CUR[+gSel.value].chapters.forEach((ch) => { const og = h("optgroup", { label: "Chương " + romans[ch.no] + ". " + ch.name });
      ch.lessons.forEach((L) => og.append(h("option", { value: L.no }, "Bài " + L.no + ". " + L.name))); lSel.append(og); }); };
    fillL();
    const url = h("input", { id: "vU", type: "url", placeholder: "https://www.tiktok.com/@kenh/video/7688190213834788117" });
    const title = h("input", { id: "vT", maxlength: 150, placeholder: "VD: Mệnh đề – lý thuyết trong 1 phút" });
    const prev = h("div", { class: "vprev" });
    let editId = null;
    const parse = (u) => { let m = String(u).match(/tiktok\.com\/(?:@[^/?#]+\/video|embed(?:\/v2)?|player\/v1|v)\/(\d{8,25})/); if (m) return { p: "tt", vid: m[1] };
      m = String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? { p: "yt", vid: m[1] } : null; };
    const drawPrev = () => { prev.innerHTML = ""; const u = url.value.trim(); if (!u) return; const v = parse(u);
      if (!v) { prev.append(h("div", { class: "note bad" }, /vt\.tiktok|vm\.tiktok/.test(u) ? "Đây là link rút gọn. Thầy mở link này trên trình duyệt máy tính rồi chép lại link đầy đủ (có dạng …tiktok.com/@kenh/video/số)." : "Chưa đọc được link. Dán link đầy đủ của video TikTok hoặc YouTube.")); return; }
      prev.append(h("p", { class: "sub" }, "Xem trước:"), KT.videoFrame(Object.assign(v, { title: title.value }))); };
    url.addEventListener("change", drawPrev); url.addEventListener("paste", () => setTimeout(drawPrev, 50));
    const saveBtn = h("button", { class: "btn", onclick: async (e) => {
      if (!parse(url.value.trim())) return drawPrev();
      e.target.disabled = true;
      try { const x = await T("t_video_save", { p_g: +gSel.value, p_l: +lSel.value, p_url: url.value.trim(), p_title: title.value.trim(), p_id: editId });
        if (x.error) { KT.toast(x.error, "bad"); e.target.disabled = false; return; }
        KT.toast(editId ? "Đã sửa video" : "Đã thêm video", "ok"); vidGrade = +gSel.value; el.innerHTML = ""; tabVideos(el); }
      catch (ex) { e.target.disabled = false; fail(ex); }
    } }, "Lưu video");
    gSel.onchange = () => { fillL(); vidGrade = +gSel.value; drawList(); };
    el.append(h("div", { class: "panel" }, h("h3", {}, "Thêm video ôn tập"),
      h("p", { class: "sub" }, "Dán link video TikTok (hoặc YouTube) và chọn bài học. Video hiện cho học sinh ở thẻ “Theo bài”, trong bài bổ sung, ở phần phân tích kết quả (bài em còn yếu) và trong thư viện “Video ôn tập”. Video TikTok cần để Công khai và cho phép nhúng."),
      h("div", { class: "form" }, h("div", {}, h("label", { for: "vG" }, "Khối"), gSel), h("div", {}, h("label", { for: "vL" }, "Bài học"), lSel),
        h("div", { class: "full" }, h("label", { for: "vU" }, "Link video"), url), h("div", { class: "full" }, h("label", { for: "vT" }, "Tên video (học sinh sẽ thấy)"), title),
        h("div", { class: "full" }, saveBtn)), prev));
    const listBox = h("div", {}); el.append(listBox);
    let all = [];
    try { all = await api.rpc("videos_list", {}); } catch (e) { fail(e); }
    function drawList() {
      listBox.innerHTML = "";
      const g = +gSel.value, mine = all.filter((v) => v.g === g);
      const byG = {}; all.forEach((v) => (byG[v.g] = (byG[v.g] || 0) + 1));
      listBox.append(h("div", { class: "section-t" }, "Video đã thêm · Toán " + g + " (" + mine.length + ")" + (all.length > mine.length ? " — tổng " + all.length + " video: " + Object.entries(byG).map(([k, n]) => "lớp " + k + ": " + n).join(", ") : "")));
      if (!mine.length) { listBox.append(h("div", { class: "panel empty" }, "Khối này chưa có video nào.")); return; }
      const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Bài", "Video", ""].map((x) => h("th", {}, x)))));
      const body = h("tbody");
      mine.forEach((v) => body.append(h("tr", {}, h("td", {}, KT.lessonName(v.g + "-" + v.l)),
        h("td", {}, h("b", {}, v.title || "(chưa đặt tên)"), h("div", { class: "sub", style: "overflow-wrap:anywhere" }, (v.p === "yt" ? "YouTube · " : "TikTok · ") + v.url)),
        h("td", { style: "white-space:nowrap" },
          h("button", { class: "btn ghost sm", onclick: () => KT.videoModal([v], v.title || "Video") }, "Xem"), " ",
          h("button", { class: "btn ghost sm", onclick: () => { editId = v.id; gSel.value = v.g; fillL(); lSel.value = v.l; url.value = v.url; title.value = v.title; drawPrev(); saveBtn.textContent = "Lưu thay đổi"; window.scrollTo({ top: 0, behavior: "smooth" }); } }, "Sửa"), " ",
          h("button", { class: "btn ghost sm danger", onclick: () => KT.confirm("Xoá video này?", "Học sinh sẽ không thấy video này nữa (video trên TikTok không bị ảnh hưởng).", "Xoá", async () => {
            try { await T("t_video_delete", { p_id: v.id }); all = all.filter((x) => x.id !== v.id); drawList(); KT.toast("Đã xoá", "ok"); } catch (e) { fail(e); } }) }, "Xoá")))));
      tb.append(body); listBox.append(h("div", { class: "tbl-wrap" }, tb));
    }
    drawList();
  }

  /* ---------------- CÂU BỊ BÁO LỖI ---------------- */
  let repStatus = "open";
  const REP_KIND = { key: "Đáp án sai", question: "Đề sai / thiếu dữ kiện", other: "Lỗi khác" };
  const keyText = (t, k) => k == null ? "–" : t === "MC" ? "ABCDEF"[+k] : t === "TF" ? (Array.isArray(k) ? k.map((x, i) => "abcd"[i] + ")" + (x === true ? "Đ" : x === false ? "S" : "?")).join(" ") : "–") : String(k).replace(/\$/g, "");
  async function tabReports(el) {
    const selS = h("select", { id: "rpS", "aria-label": "Trạng thái", onchange: () => { repStatus = selS.value; el.innerHTML = ""; tabReports(el); } },
      [["open", "Đang chờ kiểm tra"], ["fixed", "Đã sửa đáp án"], ["deleted", "Đã huỷ câu"], ["dismissed", "Đã bỏ qua (đáp án đúng)"]].map(([v, l]) => h("option", { value: v, selected: v === repStatus }, l)));
    el.append(h("div", { class: "filters-row" }, h("div", {}, h("label", { for: "rpS" }, "Trạng thái"), selS)),
      h("p", { class: "sub", style: "margin:8px 0 14px" }, "Học sinh bấm “Báo lỗi” ở phần xem lại bài. Sửa đáp án thì mọi bài đã làm có câu này được chấm lại ngay; huỷ câu thì câu bị ẩn khỏi ngân hàng và bài đã làm được tính đúng câu đó. Sửa trên web được giữ nguyên khi công cụ đồng bộ đọc lại file .tex — thầy nhớ sửa cả trong file."));
    const box = h("div", { class: "loading" }, "Đang tải…"); el.append(box);
    let rows;
    try { rows = await T("t_reports", { p_status: repStatus }); } catch (e) { box.remove(); return fail(e); }
    box.classList.remove("loading"); box.textContent = "";
    if (!rows.length) { box.append(h("div", { class: "panel empty" }, repStatus === "open" ? "Không có câu nào đang chờ kiểm tra." : "Chưa có câu nào.")); return; }
    const figs = {}; rows.forEach((r) => Object.assign(figs, r.figs || {}));
    rows.forEach((r) => box.append(repCard(r, repStatus === "open", () => { el.innerHTML = ""; refreshCount().then(() => tabReports(el)); })));
    KT.typeset(box, figs);
  }
  async function refreshCount() {
    try { ov.n_reports = await T("t_reports_count"); } catch (e) { }
    const b = document.querySelector('.tabs button.on'); if (b) { b.innerHTML = ""; b.append(ov.n_reports ? h("span", {}, "Câu bị báo lỗi ", h("span", { class: "tabbadge" }, String(ov.n_reports))) : "Câu bị báo lỗi"); }
  }
  function repCard(r, open, done) {
    const st = r.stats || {}, n = +st.n || 0, pc = (x) => (n ? Math.round(100 * x / n) : 0);
    const card = h("article", { class: "panel repcard" });
    card.append(h("div", { class: "rc-head" },
      h("span", { class: "pill bad" }, r.n + " HS báo"),
      h("b", {}, KT.lessonName(r.g + "-" + r.l, true)),
      h("span", { class: "lvl" }, KT.LV[r.lv] || r.lv), h("span", {}, TYPE_SHORT[r.t]),
      r.tag ? h("span", { class: "mono" }, r.tag) : null,
      h("span", { class: "rc-src", title: "File nguồn" }, r.src || ""),
      !r.active ? h("span", { class: "pill" }, "Đã huỷ") : null, r.key_manual ? h("span", { class: "pill ok" }, "Đáp án đã sửa trên web") : null));
    card.append(h("div", { class: "qtext", html: r.q }));
    // phương án + tỉ lệ học sinh chọn
    if (r.t === "MC") {
      const mc = st.mc || {};
      const ol = h("div", { class: "rc-opts" });
      (r.o || []).forEach((o, i) => ol.append(h("div", { class: "rc-opt" + (+r.key === i ? " key" : "") },
        h("span", { class: "L" }, "ABCDEF"[i]), h("div", { class: "v", html: o }),
        h("span", { class: "rc-bar", title: (mc[i] || 0) + " lượt chọn" }, h("i", { style: "width:" + pc(mc[i] || 0) + "%" }), h("em", {}, pc(mc[i] || 0) + "%")))));
      card.append(ol);
    } else if (r.t === "TF") {
      const tf = st.tf || [];
      const ol = h("div", { class: "rc-opts" });
      (r.o || []).forEach((o, i) => { const s = tf[i] || { t: 0, f: 0 }, tot = (+s.t + +s.f) || 0;
        ol.append(h("div", { class: "rc-opt" }, h("span", { class: "L" }, "abcd"[i] + ")"), h("div", { class: "v", html: o }),
          h("span", { class: "rc-tf" }, "Đáp án: ", h("b", { style: "color:var(--" + (Array.isArray(r.key) && r.key[i] ? "ok" : "bad") + ")" }, Array.isArray(r.key) ? (r.key[i] ? "Đúng" : "Sai") : "?"),
            tot ? " · HS chọn Đúng " + Math.round(100 * s.t / tot) + "%" : ""))); });
      card.append(ol);
    } else {
      card.append(h("div", { class: "rc-sa" }, "Đáp án hiện tại: ", h("b", {}, keyText("SA", r.key)),
        (st.sa || []).length ? h("span", {}, " · Học sinh hay trả lời: " + st.sa.map((x) => x.v + " (" + x.c + ")").join(", ")) : null));
    }
    card.append(h("div", { class: "rc-meta" }, n ? n + " lượt làm câu này · " + pc(+st.ok || 0) + "% làm đúng theo đáp án hiện tại" : "Chưa có lượt làm nào"));
    if (r.s) card.append(h("details", { class: "sol" }, h("summary", {}, "Xem lời giải trong file"), h("div", { html: r.s })));
    // ý kiến học sinh
    const ul = h("ul", { class: "rc-reps" });
    (r.reports || []).forEach((x) => ul.append(h("li", {},
      h("b", {}, x.name), h("span", { class: "sub" }, " · " + (x.class || "") + " · " + KT.dt(x.at)), " — ", h("span", { class: "pill" }, REP_KIND[x.kind] || x.kind),
      x.suggest != null ? h("span", {}, " Đề xuất: ", h("b", {}, keyText(r.t, x.suggest))) : null,
      x.ans != null ? h("span", { class: "sub" }, " (em đã chọn " + keyText(r.t, x.ans) + ")") : null,
      x.note ? h("div", { class: "rc-note" }, "“" + x.note + "”") : null)));
    card.append(ul);
    if (!open) return card;
    // sửa đáp án
    const sugs = (r.reports || []).filter((x) => x.suggest != null).map((x) => JSON.stringify(x.suggest));
    const top = sugs.length ? JSON.parse(Object.entries(sugs.reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0][0]) : null;
    let nk = top != null ? top : r.key;
    const ed = h("div", { class: "rc-edit" });
    const drawEd = () => {
      ed.innerHTML = "";
      if (r.t === "MC") (r.o || []).forEach((o, i) => ed.append(h("button", { type: "button", class: "kbtn" + (+nk === i ? " on" : ""), onclick: () => { nk = i; drawEd(); } }, "ABCDEF"[i])));
      else if (r.t === "TF") { if (!Array.isArray(nk)) nk = [null, null, null, null]; nk = nk.slice();
        (r.o || []).forEach((o, i) => ed.append(h("span", { class: "kgrp" }, "abcd"[i] + ")",
          h("button", { type: "button", class: "kbtn" + (nk[i] === true ? " on" : ""), onclick: () => { nk[i] = true; drawEd(); } }, "Đ"),
          h("button", { type: "button", class: "kbtn" + (nk[i] === false ? " on" : ""), onclick: () => { nk[i] = false; drawEd(); } }, "S")))); }
      else ed.append(h("input", { type: "text", value: nk == null ? "" : String(nk), style: "max-width:220px", "aria-label": "Đáp số đúng", oninput: (e) => (nk = e.target.value) }));
    };
    drawEd();
    const act = async (btn, fn, args, msg) => {
      btn.disabled = true;
      try { const x = await T(fn, args); if (x && x.error) { btn.disabled = false; return KT.toast(x.error, "bad"); }
        KT.toast(msg + (x && x.regraded ? " · đã chấm lại " + x.regraded + " bài" : "") + (x && x.rewarded ? " · cộng KN cho " + x.rewarded + " em" : ""), "ok"); done(); }
      catch (e) { btn.disabled = false; fail(e); }
    };
    const bFix = h("button", { class: "btn", onclick: (e) => {
      let k = nk;
      if (r.t === "MC") { if (k == null || isNaN(+k)) return KT.toast("Chọn đáp án đúng.", "bad"); k = +k; }
      else if (r.t === "TF") { if (!Array.isArray(k) || k.some((x) => x == null)) return KT.toast("Chọn Đ/S cho cả 4 ý.", "bad"); }
      else { k = String(k ?? "").trim(); if (!k) return KT.toast("Nhập đáp số.", "bad"); }
      if (JSON.stringify(k) === JSON.stringify(r.key)) return KT.toast("Đáp án chưa thay đổi. Nếu đáp án cũ đúng, bấm “Đáp án đúng, bỏ qua”.", "bad");
      act(e.target, "t_question_fix", { p_qid: r.qid, p_key: k }, "Đã sửa đáp án");
    } }, "Lưu đáp án mới & chấm lại");
    const bHide = h("button", { class: "btn ghost danger", onclick: (e) => KT.confirm("Huỷ câu này?", "Câu bị ẩn khỏi ngân hàng (không còn xuất hiện trong đề mới). Các bài đã làm có câu này sẽ được <b>tính đúng câu này cho mọi học sinh</b>.", "Huỷ câu", () => act(e.target, "t_question_hide", { p_qid: r.qid }, "Đã huỷ câu")) }, "Huỷ câu (sai đề)");
    const bOk = h("button", { class: "btn ghost", onclick: (e) => act(e.target, "t_report_dismiss", { p_qid: r.qid }, "Đã giữ nguyên đáp án") }, "Đáp án đúng, bỏ qua");
    card.append(h("div", { class: "rc-actions" }, h("div", {}, h("label", {}, "Đáp án đúng"), ed), h("div", { class: "rc-btns" }, bFix, bOk, bHide)));
    return card;
  }

  /* ---------------- THỐNG KÊ ---------------- */
  let stDays = store.get("kt_t_days", 120), stAsg = null, stSort = "avg", bankGrade = null;
  async function tabStats(el) {
    const classes = ov.classes || [];
    if (!classes.length) { el.append(h("div", { class: "panel empty" }, "Chưa có lớp nào. Vào mục “Lớp & học sinh” để tạo lớp.")); return; }
    if (!curClass || !classes.some((c) => c.id === curClass)) curClass = classes[0].id;
    const selC = h("select", { id: "stC", onchange: () => { curClass = +selC.value; store.set("kt_t_class", curClass); stAsg = null; render(); } },
      classes.map((c) => h("option", { value: c.id, selected: c.id === curClass }, c.name + " (" + c.n + " HS)")));
    const selD = h("select", { id: "stD", onchange: () => { stDays = +selD.value; store.set("kt_t_days", stDays); render(); } },
      [[30, "30 ngày qua"], [90, "3 tháng qua"], [120, "4 tháng qua"], [365, "1 năm qua"], [3650, "Toàn bộ"]].map(([v, l]) => h("option", { value: v, selected: v === stDays }, l)));
    const asgs = (ov.assignments || []).filter((a) => a.class_id === curClass);
    const selA = h("select", { id: "stA", onchange: () => { stAsg = selA.value ? +selA.value : null; render(); } },
      h("option", { value: "" }, "Tất cả bài (giao + tự luyện)"), asgs.map((a) => h("option", { value: a.id, selected: a.id === stAsg }, a.title)));
    el.append(h("div", { class: "filters-row" },
      h("div", {}, h("label", { for: "stC" }, "Lớp"), selC), h("div", {}, h("label", { for: "stD" }, "Thời gian"), selD),
      h("div", { class: "grow" }, h("label", { for: "stA" }, "Bài kiểm tra"), selA)));
    const box = h("div", {}, h("div", { class: "loading" }, "Đang tải thống kê…")); el.append(box);
    let d;
    try { d = await T("t_class_stats", { p_class: curClass, p_days: stDays, p_assignment: stAsg }); } catch (e) { box.innerHTML = ""; fail(e); return; }
    box.innerHTML = "";
    const tile = (n, l, cls) => h("div", { class: "kpi" + (cls ? " " + cls : "") }, h("div", { class: "n" }, n), h("div", { class: "l" }, l));
    const rm = d.remedial || {};
    box.append(h("div", { class: "kpis st-kpis" }, tile(String(d.n_students), "Học sinh"), tile(String(d.n_attempts), "Bài kiểm tra đã nộp"),
      tile(d.avg == null ? "—" : fmt(d.avg), "Điểm trung bình"), tile(rm.pending + " / " + rm.done, "Bài bổ sung: chờ / đã xong", rm.pending ? "warn" : "")));
    if (!d.n_attempts) { box.append(h("div", { class: "panel empty", style: "margin-top:14px" }, "Lớp chưa có bài kiểm tra nào trong khoảng thời gian này.")); return; }
    const wk = (d.weekly || []).map((x) => { const dt = new Date(x.w); return { x: dt.getDate() + "/" + (dt.getMonth() + 1), y: +x.avg, tip: "Tuần từ " + dt.getDate() + "/" + (dt.getMonth() + 1) + ": <b>" + fmt(x.avg) + " điểm</b> (" + x.n + " bài)" }; });
    box.append(h("div", { class: "st-grid" },
      h("div", { class: "panel" }, h("h3", {}, "Phân bố điểm"), h("p", { class: "muted" }, "Số bài theo từng mức điểm."), KT.histo(d.scores || [])),
      h("div", { class: "panel" }, h("h3", {}, "Điểm trung bình theo tuần"), h("p", { class: "muted" }, "Xu hướng của cả lớp."), KT.lineChart(wk, { label: "Điểm trung bình theo tuần" }))));
    const lessons = (d.lessons || []).filter((x) => !/^0-/.test(x.key)).sort((a, b) => a.m - b.m);
    const mlv = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng", VDC: "Vận dụng cao" };
    const lvRows = ["NB", "TH", "VD", "VDC"].map((k) => (d.levels || []).find((x) => x.lv === k)).filter(Boolean).map((x) => ({ label: mlv[x.lv], m: +x.m, sub: x.n + " lượt câu" }));
    const tRows = ["MC", "TF", "SA"].map((k) => (d.types || []).find((x) => x.t === k)).filter(Boolean).map((x) => ({ label: TYPES[x.t], m: +x.m, sub: x.n + " lượt câu" }));
    box.append(h("div", { class: "panel wide-bars", style: "margin-top:14px" }, h("h3", {}, "Mức nắm vững theo bài học"), h("p", { class: "muted" }, "Bài yếu nhất ở trên. “HS yếu” = số học sinh đạt dưới 50% ở bài đó."),
        KT.hbars(lessons.map((x) => ({ label: KT.lessonName(x.key, true), m: +x.m, sub: x.n + " lượt câu · " + x.ns + " HS" + (x.weak ? " · " + x.weak + " HS yếu" : "") }))), KT.statusLegend()));
    box.append(h("div", { class: "st-grid" },
      h("div", { class: "panel" }, h("h3", {}, "Theo mức độ"), KT.hbars(lvRows)),
      h("div", { class: "panel" }, h("h3", {}, "Theo dạng câu"), KT.hbars(tRows))));
    // bảng học sinh
    const rows = (d.students || []).slice();
    const sorters = { avg: (a, b) => (a.avg ?? 99) - (b.avg ?? 99), name: (a, b) => a.name.localeCompare(b.name, "vi"), rem: (a, b) => b.rem_pending - a.rem_pending || (a.avg ?? 99) - (b.avg ?? 99), n: (a, b) => a.n - b.n };
    rows.sort(sorters[stSort]);
    const selS = h("select", { id: "stS", onchange: () => { stSort = selS.value; render(); } },
      [["avg", "Điểm thấp trước"], ["rem", "Còn bài bổ sung trước"], ["n", "Làm ít bài trước"], ["name", "Theo tên"]].map(([v, l]) => h("option", { value: v, selected: v === stSort }, l)));
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Mã", "Học sinh", "Số bài", "Điểm TB", "Xu hướng", "Bài đang yếu", "Bài bổ sung"].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    rows.forEach((r) => tbody.append(h("tr", {},
      h("td", {}, r.code), h("td", {}, h("b", {}, r.name)), h("td", { class: "num" }, String(r.n)),
      h("td", { class: "num" }, r.avg == null ? "—" : h("span", { class: "sc-pill " + (r.avg >= 8 ? "ok" : r.avg >= 5 ? "warn" : "bad") }, fmt(r.avg))),
      h("td", {}, KT.spark(r.trend || [])),
      h("td", { class: "weakcell" }, (r.weak || []).filter((x) => !/^0-/.test(x.key)).length ? (r.weak || []).filter((x) => !/^0-/.test(x.key)).map((x) => h("span", { class: "wk", title: KT.lessonName(x.key, true) }, "B" + x.key.split("-")[1] + " · " + pct(x.m) + "%")) : h("span", { class: "muted" }, r.n ? "Không có" : "—")),
      h("td", {}, r.rem_pending ? h("span", { class: "pill warn" }, "Chờ " + r.rem_pending) : null, r.rem_done ? h("span", { class: "pill ok" }, "Xong " + r.rem_done) : null, !r.rem_pending && !r.rem_done ? h("span", { class: "muted" }, "—") : null))));
    tb.append(tbody);
    box.append(h("div", { class: "panel", style: "margin-top:14px" }, h("div", { class: "review-t", style: "margin:0 0 10px" }, h("h3", { style: "margin:0" }, "Từng học sinh"), h("span", { class: "sp" }),
      h("label", { for: "stS", style: "margin:0 6px 0 0" }, "Sắp xếp"), selS), h("div", { class: "tbl-wrap" }, tb)));
    KT.tipify(box);
  }

  /* ---------------- THEO DÕI ---------------- */
  /* ---------------- cờ bài đáng ngờ ---------------- */
  const FLAG_SHORT = { leave: "Rời trang", copy: "Sao chép", fast: "Quá nhanh", jump: "Điểm vọt", hard: "Vận dụng bất thường" };
  function flagChips(r) {
    const fl = r.flags || [];
    const out = fl.map((f) => h("span", { class: "flag" + (f.lv >= 2 ? " hi" : ""), title: f.t },
      f.k === "leave" ? "Rời trang " + r.leaves : f.k === "copy" ? "Sao chép " + (r.copy_n || "") : FLAG_SHORT[f.k] || f.k));
    if (!fl.some((f) => f.k === "leave") && r.leaves) out.push(h("span", { class: "muted", style: "font-size:12px", title: "Chưa tới mức cảnh báo (từ 3 lần hoặc 1 phút)" }, "rời " + r.leaves));
    return out.length ? h("div", { class: "flagchips" }, out) : h("span", { class: "muted" }, "–");
  }
  function flagBox(fl) {
    if (!fl || !fl.length) return null;
    return h("div", { class: "flagbox" }, h("b", {}, "Dấu hiệu cần kiểm tra lại"), h("ul", {}, fl.map((f) => h("li", {}, f.t))),
      h("div", { class: "sub", style: "margin-top:6px" }, "Đây chỉ là dấu hiệu, không phải kết luận. Thầy nên hỏi lại em vài câu trong bài để xác nhận."));
  }
  async function flaggedPanel(el) {
    const box = h("div", { class: "panel", style: "margin-top:18px" }, h("h3", {}, "Bài đáng ngờ 14 ngày qua"), h("div", { class: "loading" }, "Đang tải…"));
    el.append(box);
    let rows;
    try { rows = await T("t_flagged", { p_days: 14 }); } catch (e) { box.lastChild.remove(); box.append(h("div", { class: "empty" }, "Chưa tải được.")); return; }
    box.lastChild.remove();
    if (!rows.length) { box.append(h("div", { class: "empty" }, "Không có bài nào có dấu hiệu bất thường.")); return; }
    box.append(h("p", { class: "sub", style: "margin:0 0 10px" }, "Gồm cả bài giao và bài các em tự luyện. Bấm vào một dòng để xem bài làm."));
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Học sinh", "Lớp", "Bài", "Điểm", "Nộp lúc", "Dấu hiệu"].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    rows.slice(0, 60).forEach((r) => tbody.append(h("tr", { class: "click", onclick: () => viewAttempt(r.attempt, r) },
      h("td", {}, h("b", {}, r.name), h("div", { class: "mono", style: "font-size:12px;color:var(--ink-3)" }, r.code)), h("td", {}, r.class || "–"),
      h("td", {}, r.title, h("div", { style: "font-size:12px;color:var(--ink-3)" }, r.assigned ? "Bài giao" : "Tự luyện · " + r.kind)),
      h("td", { class: "num" }, h("b", {}, fmt(r.score))), h("td", {}, KT.dt(r.submitted_at)), h("td", {}, flagChips(r)))));
    tb.append(tbody);
    box.append(h("div", { class: "tbl-wrap" }, tb));
  }
  function tabMonitor(el) {
    if (curAsg) return monitorView(el, curAsg);
    if (ov.n_pending) el.append(h("div", { class: "bknote", style: "margin-bottom:14px" }, h("span", {}, "Có " + ov.n_pending + " học sinh tự đăng ký đang chờ thầy duyệt."),
      h("button", { class: "btn sm", onclick: () => { tab = "classes"; store.set("kt_t_tab", tab); render(); } }, "Xem và duyệt")));
    const list = ov.assignments || [];
    el.append(h("div", { class: "review-t" }, h("h2", { style: "margin:0" }, "Bài đã giao"), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: load }, "Làm mới"), h("button", { class: "btn sm", onclick: () => { tab = "assign"; render(); } }, "+ Giao đề mới")));
    if (!list.length) { el.append(h("div", { class: "panel empty", style: "margin-top:14px" }, "Chưa giao bài nào. Vào mục “Giao đề” để bắt đầu.")); flaggedPanel(el); return; }
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
    flaggedPanel(el);
  }

  // gia hạn cả bài: giờ đóng mới, số lần làm, cho em đang làm dở đủ thời gian
  function extendDlg(a, now, after) {
    const pad = (n) => String(n).padStart(2, "0");
    const local = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    const base = Math.max(new Date(a.closes_at).getTime(), now);
    const inp = h("input", { type: "datetime-local", id: "exT", style: "max-width:260px", value: local(new Date(base + 30 * 60000)) });
    const quick = [["+10 phút", 10], ["+30 phút", 30], ["+1 giờ", 60], ["+1 ngày", 1440], ["+3 ngày", 4320], ["+1 tuần", 10080]].map(([l, m]) =>
      h("button", { type: "button", class: "btn ghost sm", onclick: () => (inp.value = local(new Date(base + m * 60000))) }, l));
    const max = h("input", { type: "number", id: "exM", min: 1, max: 50, value: a.max_attempts || 1, style: "max-width:120px" });
    const doing = h("input", { type: "checkbox", id: "exD", checked: true });
    let close;
    close = KT.modal([h("h3", {}, "Gia hạn bài kiểm tra"),
      h("p", {}, h("b", {}, a.title), h("br"), "Hiện đóng lúc ", h("b", {}, KT.dt(a.closes_at)), new Date(a.closes_at).getTime() <= now ? " (đã đóng — gia hạn sẽ mở lại bài)" : ""),
      h("label", { for: "exT" }, "Đóng bài lúc"), inp, h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px" }, quick),
      h("label", { for: "exM" }, "Số lần mỗi em được làm"), max,
      h("p", { class: "sub", style: "margin:4px 0 10px" }, "Tăng số lần nếu muốn các em đã nộp (hoặc bị thu bài khi hết giờ) được làm lại."),
      h("label", { class: "chk" }, doing, "Các em đang làm dở được làm đủ " + (a.blueprint && a.blueprint.minutes || "") + " phút (nếu trước đó bị cắt vì sắp đóng bài)"),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          const t = new Date(inp.value);
          if (isNaN(t)) return KT.toast("Chọn giờ đóng bài.", "bad");
          e.target.disabled = true;
          try { const r = await T("t_assignment_extend", { p_id: a.id, p_closes: t.toISOString(), p_max: +max.value || null, p_extend_doing: doing.checked });
            if (r.error) { e.target.disabled = false; return KT.toast(r.error, "bad"); }
            close(); KT.toast("Đã gia hạn đến " + KT.dt(r.closes_at) + (r.doing ? " · " + r.doing + " em đang làm được cập nhật giờ" : ""), "ok"); after(true); }
          catch (ex) { e.target.disabled = false; fail(ex); }
        } }, "Gia hạn"))]);
  }
  // cộng giờ cho một em đang làm
  function addTime(r, after) {
    const mins = h("input", { type: "number", id: "atM", min: 1, max: 240, value: 10, style: "max-width:120px" });
    let close;
    close = KT.modal([h("h3", {}, "Cộng giờ cho " + r.name),
      h("p", {}, "Em đang làm, hết giờ lúc ", h("b", {}, KT.dt(r.ends_at)), ". Đồng hồ trên máy em sẽ tự cập nhật trong vòng 1 phút."),
      h("label", { for: "atM" }, "Cộng thêm (phút)"), mins,
      h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin:8px 0" }, [5, 10, 15, 30].map((m) => h("button", { type: "button", class: "btn ghost sm", onclick: () => (mins.value = m) }, "+" + m + " phút"))),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          e.target.disabled = true;
          try { const x = await T("t_attempt_extend", { p_attempt: r.attempt, p_minutes: +mins.value });
            if (x.error) { e.target.disabled = false; return KT.toast(x.error, "bad"); }
            close(); KT.toast("Đã cộng " + mins.value + " phút · hết giờ lúc " + KT.dt(x.ends_at), "ok"); after(); }
          catch (ex) { e.target.disabled = false; fail(ex); }
        } }, "Cộng giờ"))]);
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
        h("button", { class: "btn " + (open ? "ghost" : "") + " sm", onclick: () => extendDlg(a, now, refresh) }, open ? "Gia hạn…" : "Gia hạn / mở lại bài"),
        h("button", { class: "btn ghost sm", onclick: async () => { await T("t_assignment_update", { p_id: id, p_show: !a.show_answers }).catch(fail); refresh(); } }, a.show_answers ? "Ẩn đáp án với HS" : "Cho HS xem đáp án"),
        h("button", { class: "btn ghost sm", onclick: () => exportScores(a, rows) }, "Xuất bảng điểm (Excel)"),
        h("button", { class: "btn ghost sm", onclick: () => KT.confirm("Xoá bài này?", "Xoá bài giao và <b>toàn bộ bài làm</b> của học sinh. Không thể hoàn tác.", "Xoá", async () => { await T("t_assignment_update", { p_id: id, p_delete: true }).catch(fail); curAsg = null; load(); }) }, "Xoá")));
      const done = rows.filter((r) => r.status === "done"), doing = rows.filter((r) => r.status === "doing"), none = rows.filter((r) => !r.status);
      const sc = done.map((r) => +r.score);
      const kp = h("div", { class: "kpis" });
      const k = (n, l) => h("div", { class: "kpi" }, h("div", { class: "n" }, n), h("div", { class: "l" }, l));
      kp.append(k(done.length + "/" + rows.length, "Đã nộp"), k(String(doing.length), "Đang làm"), k(String(none.length), "Chưa vào"),
        k(sc.length ? fmt(sc.reduce((x, y) => x + y, 0) / sc.length) : "–", "Điểm trung bình"),
        k(String(rows.filter((r) => (r.flags || []).length).length), "Bài có dấu hiệu bất thường"), k(sc.length ? fmt(Math.max(...sc)) + " / " + fmt(Math.min(...sc)) : "–", "Cao nhất / thấp nhất"));
      el.append(kp);
      // bảng học sinh
      const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, ["Mã", "Họ tên", "Trạng thái", "Tiến độ", "Điểm", "Cảnh báo", "Bắt đầu", "Nộp lúc", ""].map((x) => h("th", {}, x)))));
      const tbody = h("tbody");
      rows.forEach((r) => {
        let st;
        if (!r.status) st = h("span", { class: "pill" }, "Chưa vào");
        else if (r.status === "doing") { const left = Math.max(0, Math.round((new Date(r.ends_at) - now) / 60000)); const idle = (now - new Date(r.last_seen)) / 1000 > 120; st = h("span", { class: "pill warn" }, "Đang làm · còn " + left + "′" + (idle ? " · không hoạt động" : "")); }
        else st = h("span", { class: "pill ok" }, "Đã nộp");
        tbody.append(h("tr", { class: (r.attempt ? "click" : "") + ((r.flags || []).length ? " sus" : ""), onclick: () => r.attempt && viewAttempt(r.attempt, r) },
          h("td", { class: "mono" }, r.code), h("td", {}, r.name), h("td", {}, st),
          h("td", {}, r.n_items ? [h("span", { class: "prog-mini" }, h("i", { style: "width:" + pct(r.n_answered / r.n_items) + "%" })), r.n_answered + "/" + r.n_items] : "–"),
          h("td", { class: "num" }, r.status === "done" ? h("b", {}, fmt(r.score)) : "–"),
          h("td", {}, r.attempt ? flagChips(r) : "–"),
          h("td", {}, r.started_at ? KT.dt(r.started_at) : "–"), h("td", {}, r.submitted_at ? KT.dt(r.submitted_at) : "–"),
          h("td", { style: "white-space:nowrap" }, r.status === "doing" ? h("button", { class: "btn ghost sm", title: "Cộng thêm thời gian cho riêng em này", onclick: (e) => { e.stopPropagation(); addTime(r, refresh); } }, "+ Cộng giờ") : null,
            r.attempt ? h("span", { style: "color:var(--brand);font-size:13px;margin-left:8px" }, "Xem bài →") : "")));
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
  async function viewAttempt(id, row) {
    try {
      const p = await T("t_attempt", { p_attempt: id });
      const ev = p.status === "done" ? KT.evalPayload(p) : null;
      const box = h("div", {});
      box.append(h("h3", {}, p.student + " — " + p.title), h("p", {}, p.status === "done" ? "Điểm: " + fmt(p.score) + " · nộp lúc " + KT.dt(p.submitted_at) : "Đang làm · đã lưu các câu trả lời đến thời điểm hiện tại"));
      if (row) { const fb = flagBox(row.flags); if (fb) box.append(fb); }
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
    f.grade = h("select", { id: "fGrade" }, KT.GRADES.map((g) => h("option", { value: g }, "Toán " + g)));
    const c0 = ov.classes[0]; if (c0.grade && CUR[c0.grade]) f.grade.value = c0.grade;
    f.kind = h("select", { id: "fKind" }, [["lesson", "Theo bài"], ["chapter", "Theo chương"], ["GK1", "Giữa học kì I"], ["HK1", "Cuối học kì I"], ["GK2", "Giữa học kì II"], ["HK2", "Cuối học kì II"],
      ["grade", "Theo khối (cả năm)"], ["paper", "Theo đề có sẵn"], ["ts10", "Ôn thi vào lớp 10"], ["tn", "Thi thử tốt nghiệp THPT"], ["dgnl_full", "Thi thử ĐGNL ĐHQG-HCM (đủ 120 câu)"], ["dgnl_part", "Luyện ĐGNL theo phần thi"], ["custom", "Tự chọn nhiều bài"], ["tags", "Chọn theo ID câu hỏi"]].map(([v, l]) => h("option", { value: v }, l)));
    f.sub = h("select", { id: "fSub" });
    const subWrap = h("div", {}, h("label", { for: "fSub" }, "Bài / chương"), f.sub);
    const pick = h("div", { class: "lesson-pick full hidden" });
    // --- chọn theo ID câu hỏi
    const parseTags = (txt) => [...new Set(String(txt || "").split(/[\s,;]+/).map((x) => x.replace(/[\[\]]/g, "").trim().toUpperCase()).filter(Boolean))];
    f.tags = h("textarea", { id: "fTags", rows: 2, placeholder: "VD: 10B02-TH, 6B09, 2D1V4, 11B04", style: "min-height:64px" });
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
    // --- chọn đề có sẵn (đồng bộ từ thư mục DETHI_TEX)
    const PK = { TNTHPT: "Thi thử TN THPT", GHK1: "Giữa kì I", CHK1: "Cuối kì I", GHK2: "Giữa kì II", CHK2: "Cuối kì II", BAI: "Theo bài", KHAC: "Đề khác" };
    const PORD = ["TNTHPT", "GHK1", "CHK1", "GHK2", "CHK2", "BAI", "KHAC"];
    const foldVi = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
    let papers = {}, paperSel = null;
    const paperSearch = h("input", { type: "search", placeholder: "Tìm theo tên trường, sở, bài…", "aria-label": "Tìm đề", style: "max-width:320px" });
    const paperKind = h("select", { "aria-label": "Loại đề", style: "max-width:200px" });
    const paperList = h("div", { class: "paper-list", role: "radiogroup", "aria-label": "Chọn đề" });
    const paperWrap = h("div", { class: "full paperbox hidden" }, h("label", {}, "Chọn đề"),
      h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px" }, paperKind, paperSearch), paperList);
    const pctx = (p) => [p.counts.MC ? p.counts.MC + " NPA" : "", p.counts.TF ? p.counts.TF + " Đ/S" : "", p.counts.SA ? p.counts.SA + " TLN" : ""].filter(Boolean).join(" · ");
    const drawPapers = () => {
      const g = +f.grade.value, all = papers[g] || [], qy = foldVi(paperSearch.value.trim()), kd = paperKind.value;
      paperList.innerHTML = "";
      if (!all.length) { paperList.append(h("div", { class: "empty", style: "padding:12px" }, "Chưa có đề Toán " + g + ". Đặt file .tex của đề vào thư mục D:\\TOÁN\\DETHI_TEX\\" + g + "\\… để công cụ đồng bộ tự đưa lên.")); return; }
      const rows = all.filter((p) => (!kd || p.kind === kd) && (!qy || foldVi(p.title + " " + p.src).includes(qy)));
      if (!rows.length) { paperList.append(h("div", { class: "empty", style: "padding:12px" }, "Không có đề nào khớp.")); return; }
      rows.slice(0, 200).forEach((p) => {
        const rb = h("input", { type: "radio", name: "paperPick", value: p.id, checked: paperSel === p.id, onchange: () => { paperSel = p.id; update(true); } });
        paperList.append(h("label", { class: "chk paper-row" + (paperSel === p.id ? " on" : "") }, rb,
          h("span", {}, h("b", {}, p.title), h("small", {}, (PK[p.kind] || "Đề") + " · " + p.n + " câu (" + pctx(p) + ") · " + p.minutes + " phút" + (p.n_src > p.n ? " · thiếu " + (p.n_src - p.n) + " câu chưa dựng được hình" : "")))));
      });
      if (rows.length > 200) paperList.append(h("div", { class: "sub" }, "… còn " + (rows.length - 200) + " đề, gõ để lọc."));
    };
    const loadPapers = async () => {
      const g = +f.grade.value;
      if (!papers[g]) { paperList.innerHTML = ""; paperList.append(h("div", { class: "loading", style: "padding:14px" }, "Đang tải danh sách đề…")); try { papers[g] = await T("t_papers", { p_grade: g }); } catch (e) { fail(e); papers[g] = []; } }
      const ks = PORD.filter((k) => papers[g].some((p) => p.kind === k));
      paperKind.innerHTML = ""; paperKind.append(h("option", { value: "" }, "Mọi loại đề (" + papers[g].length + ")"), ...ks.map((k) => h("option", { value: k }, PK[k] + " (" + papers[g].filter((p) => p.kind === k).length + ")")));
      if (!papers[g].some((p) => p.id === paperSel)) paperSel = null;
      drawPapers(); update(true);
    };
    paperSearch.addEventListener("input", drawPapers); paperKind.addEventListener("change", drawPapers);
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
    const lvRow = h("div", {}, h("label", {}, "Mức độ được bốc"), h("div", { style: "display:flex;gap:12px;flex-wrap:wrap" }, ["NB", "TH", "VD", "VDC"].map((k) => h("label", { class: "chk" }, f.levels[k], k))));
    let bp = null, dst = null;
    const fillSub = () => {
      const g = +f.grade.value;
      // loại đề chỉ dành cho một số khối
      const only = { tn: g >= 10, dgnl_full: g >= 10, dgnl_part: g >= 10, ts10: g === 9 };
      [...f.kind.options].forEach((o) => { if (o.value in only) { o.disabled = !only[o.value]; o.hidden = !only[o.value]; } });
      if (f.kind.selectedOptions[0] && f.kind.selectedOptions[0].disabled) f.kind.value = "lesson";
      const k = f.kind.value;
      f.sub.innerHTML = ""; subWrap.classList.toggle("hidden", !(k === "lesson" || k === "chapter" || k === "dgnl_part"));
      subWrap.querySelector("label").textContent = k === "dgnl_part" ? "Phần thi" : "Bài / chương";
      const isEx = k.startsWith("dgnl_"); [f.mc, f.tf, f.sa].forEach((x) => (x.disabled = isEx));
      if (isEx && !dst) { T("dgnl_stats").then((d) => { dst = d || {}; fillSub(); }).catch(() => (dst = {})); }
      if (k === "dgnl_part") KT.DGNL.secs.forEach((S) => f.sub.append(h("option", { value: S.k }, S.name + " (" + (dst && dst[S.k] ? dst[S.k].n : 0) + " câu)")));
      pick.classList.toggle("hidden", k !== "custom");
      tagWrap.classList.toggle("hidden", k !== "tags");
      paperWrap.classList.toggle("hidden", k !== "paper");
      [f.mc, f.tf, f.sa].forEach((x) => (x.disabled = isEx || k === "paper"));
      lvRow.classList.toggle("hidden", k === "paper" || isEx);
      if (k === "paper") { loadPapers(); return; }
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
      else if (k === "ts10") bp = B.ts10();
      else if (k === "dgnl_full") bp = B.dgnlFull();
      else if (k === "dgnl_part") bp = B.dgnlPart(f.sub.value || "TV");
      else if (k === "paper") { const p = (papers[g] || []).find((x) => x.id === paperSel);
        bp = p ? { kind: "Theo đề", grade: g, title: p.title, paper: p.id, counts: Object.assign({ MC: 0, TF: 0, SA: 0 }, p.counts), minutes: p.minutes } : { kind: "Theo đề", grade: g, title: "", paper: null, counts: { MC: 0, TF: 0, SA: 0 }, minutes: 90 }; }
      else if (k === "tags") { const tg = parseTags(f.tags.value); bp = { kind: "Theo ID", grade: g, title: "Kiểm tra theo ID " + (tg.length ? tg.slice(0, 4).join(", ") + (tg.length > 4 ? "…" : "") : "") , lessons: tagMatch ? tagMatch.lessons : [], tags: tg, counts: { MC: 10, TF: 2, SA: 2 }, minutes: 30 }; }
      else { const ls = [...pick.querySelectorAll("input:checked")].map((x) => x.value); bp = { kind: "Tự chọn", grade: g, title: "Kiểm tra " + (ls.length ? ls.map((x) => "B" + x.split("-")[1]).join(", ") : "") + " · Toán " + g, lessons: ls, counts: { MC: 12, TF: 4, SA: 6 }, minutes: 45 }; }
      if (k === "tags" && !resetCounts && f.title.dataset.auto !== "0") f.title.value = bp.title;
      if (resetCounts) { const fc = k === "tags" ? bp.counts : KT.fitCounts(bp.counts, bankCounts(bp.lessons)); if (k !== "tags" && !(fc.MC + fc.TF + fc.SA)) Object.assign(fc, bp.counts);
        f.title.dataset.auto = "1"; f.title.value = bp.title; f.mc.value = fc.MC; f.tf.value = fc.TF; f.sa.value = fc.SA; f.min.value = bp.minutes; setClose(); }
      avail.innerHTML = "";
      if (k === "paper") {
        if (resetCounts) [...paperList.querySelectorAll(".paper-row")].forEach((r) => r.classList.toggle("on", r.querySelector("input").checked));
        if (!bp.paper) { avail.append("Chọn một đề trong danh sách ở trên."); return; }
        avail.append(h("span", { style: "color:var(--ok)" }, "Cả lớp làm cùng một đề: đủ " + (bp.counts.MC + bp.counts.TF + bp.counts.SA) + " câu, giữ nguyên thứ tự câu và phương án như đề gốc."));
        return;
      }
      if (bp.exam) {
        if (resetCounts) { f.mc.value = bp.counts.MC; f.tf.value = 0; f.sa.value = 0; }
        if (!dst) { avail.append("Đang đếm số câu ĐGNL trong ngân hàng…"); return; }
        const parts = bp.parts.map((x) => { const S = KT.dgnlSec(x.k), have = dst[x.k] ? dst[x.k].n : 0; return { S, need: x.n, have }; });
        avail.append("Ngân hàng ĐGNL: " + parts.map((x) => x.S.name + " " + x.have + "/" + x.need).join(" · ") + ". ");
        const lack = parts.filter((x) => x.have < x.need);
        if (lack.length) avail.append(h("b", { style: "color:var(--bad)" }, "Thiếu câu ở: " + lack.map((x) => x.S.name).join(", ") + " — đề sẽ ít câu hơn. Soạn thêm file .tex có thẻ [DGNL-…] trong thư mục TOÁN."));
        else avail.append(h("span", { style: "color:var(--ok)" }, "Mỗi học sinh nhận một đề riêng, đoạn văn đi kèm đủ các câu của nó."));
        return;
      }
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
      h("div", {}, L("fCls", "Lớp"), f.cls), h("div", {}, L("fGrade", "Khối kiến thức"), f.grade), h("div", {}, L("fKind", "Loại đề"), f.kind), subWrap, pick, tagWrap, paperWrap,
      h("div", { class: "full" }, L("fTitle", "Tên bài kiểm tra"), f.title),
      h("div", {}, L("fMC", "Số câu nhiều phương án"), f.mc), h("div", {}, L("fTF", "Số câu đúng/sai"), f.tf), h("div", {}, L("fSA", "Số câu trả lời ngắn"), f.sa), h("div", {}, L("fMin", "Thời gian làm (phút)"), f.min),
      avail,
      h("div", {}, L("fOpen", "Mở lúc"), f.open), h("div", {}, L("fClose", "Đóng lúc (hết giờ thì tự thu bài)"), f.close), h("div", {}, L("fMax", "Số lần được làm"), f.max),
      lvRow,
      h("label", { class: "chk full" }, f.show, "Cho học sinh xem đáp án và lời giải sau khi nộp"),
      h("div", { class: "full" }, h("button", { class: "btn", onclick: submitAssign }, "Giao đề")));
    async function submitAssign(e) {
      if (f.kind.value === "tags") { if (!bp.tags.length) return KT.toast("Chưa nhập ID câu hỏi nào.", "bad"); if (tagMatch && !(tagMatch.counts.MC + tagMatch.counts.TF + tagMatch.counts.SA)) return KT.toast("Không có câu nào khớp với ID đã nhập.", "bad"); }
      else if (f.kind.value === "paper") { if (!bp.paper) return KT.toast("Chưa chọn đề nào.", "bad"); }
      else if (!bp.exam && !bp.lessons.length) return KT.toast("Chưa chọn bài nào.", "bad");
      const levels = Object.entries(f.levels).filter(([, x]) => x.checked).map(([k]) => k);
      const b2 = Object.assign({}, bp, { title: f.title.value.trim() || bp.title, counts: { MC: +f.mc.value || 0, TF: +f.tf.value || 0, SA: +f.sa.value || 0 }, minutes: +f.min.value || bp.minutes,
        levels: levels.length === 4 ? null : levels });
      if (bp.exam) { b2.counts = { MC: bp.parts.reduce((a, x) => a + x.n, 0), TF: 0, SA: 0 }; delete b2.levels; }
      if (bp.paper) { b2.counts = bp.counts; delete b2.levels; }
      if (!b2.counts.MC && !b2.counts.TF && !b2.counts.SA) return KT.toast("Đề chưa có câu nào.", "bad");
      e.target.disabled = true;
      try {
        const r = await T("t_assign", { p_class: +f.cls.value, p_title: b2.title, p_kind: b2.kind, p_grade: b2.grade, p_blueprint: b2,
          p_opens: new Date(f.open.value).toISOString(), p_closes: new Date(f.close.value).toISOString(), p_max: +f.max.value || 1, p_show: f.show.checked });
        KT.toast("Đã giao đề cho lớp", "ok");
        ov = await T("t_overview"); tab = "monitor"; store.set("kt_t_tab", tab); curAsg = r.id; render();
      } catch (ex) { fail(ex); e.target.disabled = false; }
    }
    el.append(h("div", { class: "panel" }, h("h3", {}, "Giao đề kiểm tra"), h("p", { class: "sub" }, "Mỗi học sinh nhận một đề bốc ngẫu nhiên riêng theo cấu trúc này, cùng số câu từng phần, rải đều các bài và mức độ; thứ tự phương án được xáo. Riêng loại “Theo đề có sẵn”: cả lớp làm chung một đề thật, giữ nguyên như đề gốc."), form));
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
      d.admin ? h("label", { class: "chk" }, sw, "Cho phép học sinh tự đăng ký trên trang đăng nhập") : null));
    if (!d.items.length) { box.append(h("p", { class: "sub", style: "margin:8px 0 0" }, d.open ? "Chưa có đăng ký mới. Học sinh bấm “Đăng ký” ở trang đăng nhập, tài khoản chỉ dùng được sau khi được duyệt ở đây." : "Đăng ký đang tạm đóng.")); el.append(box); return; }
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
    // chuyển lớp (một em hoặc nhiều em đã tích chọn)
    const picked = new Set();
    const others = ov.classes.filter((c) => c.id !== curClass);
    const moveDlg = (list) => {
      if (!others.length) return KT.toast("Chưa có lớp khác. Tạo lớp mới ở trên trước.", "bad");
      const to = h("select", { id: "mvTo", style: "width:100%;margin-bottom:6px" }, others.map((c) => h("option", { value: c.id }, c.name + " (khối " + (c.grade || "?") + ", " + c.n + " HS)")));
      let close;
      close = KT.modal([h("h3", {}, list.length === 1 ? "Chuyển lớp cho " + list[0].name : "Chuyển " + list.length + " học sinh sang lớp khác"),
        h("p", {}, "Từ lớp ", h("b", {}, cname), ". Mã học sinh, PIN, bài đã làm và điểm kinh nghiệm được giữ nguyên; em sẽ thấy các bài giao của lớp mới."),
        list.length > 1 ? h("p", { class: "sub" }, list.map((x) => x.name).join(", ")) : null,
        h("label", { for: "mvTo" }, "Chuyển sang lớp"), to,
        h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
          h("button", { class: "btn", onclick: async (e) => {
            e.target.disabled = true;
            try { const r = await T("t_student_move", { p_ids: list.map((x) => x.id), p_class: +to.value });
              if (r.error) { e.target.disabled = false; return KT.toast(r.error, "bad"); }
              close(); KT.toast("Đã chuyển " + r.n + " học sinh sang lớp " + to.selectedOptions[0].text.split(" (")[0], "ok"); ov = await T("t_overview"); render(); }
            catch (ex) { e.target.disabled = false; fail(ex); }
          } }, "Chuyển lớp"))]);
    };
    const bulkBtn = h("button", { class: "btn sm", disabled: true, onclick: () => moveDlg(sts.filter((x) => picked.has(x.id))) }, "Chuyển lớp các em đã chọn");
    const syncBulk = () => { bulkBtn.disabled = !picked.size; bulkBtn.textContent = picked.size ? "Chuyển lớp " + picked.size + " em đã chọn" : "Chuyển lớp các em đã chọn"; };
    const allCb = h("input", { type: "checkbox", "aria-label": "Chọn tất cả", onchange: () => { tbody.querySelectorAll("input.pick").forEach((cb) => { cb.checked = allCb.checked; cb.dispatchEvent(new Event("change")); }); } });
    box.lastChild.append(bulkBtn);
    const tb = h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, allCb), ["Mã HS", "Họ tên", "Cấp", "PIN", "Trạng thái", ""].map((x) => h("th", {}, x)))));
    const tbody = h("tbody");
    const act = async (s, args, msg) => { try { await T("t_student_update", Object.assign({ p_id: s.id }, args)); if (msg) KT.toast(msg, "ok"); render(); } catch (e) { fail(e); } };
    sts.forEach((s) => tbody.append(h("tr", {}, h("td", {}, h("input", { type: "checkbox", class: "pick", "aria-label": "Chọn " + s.name, onchange: (e) => { (e.target.checked ? picked.add(s.id) : picked.delete(s.id)); syncBulk(); }, "data-id": s.id })),
      h("td", { class: "mono" }, s.code), h("td", {}, s.name),
      h("td", {}, h("span", { class: "lvcell" }, KT.levelBadge(KT.lvOf(s.xp), "xs"), KT.titleOf(KT.lvOf(s.xp)) + " · " + KT.num(s.xp) + " KN", s.hide_rank ? h("span", { class: "pill", title: "Không hiện trên bảng vinh danh" }, "Ẩn") : null)),
      h("td", { class: "mono" }, s.pin),
      h("td", {}, s.failed >= 10 ? h("span", { class: "pill bad" }, "Bị khoá") : !s.active ? h("span", { class: "pill" }, "Ngừng") : h("span", { class: "pill ok" }, "Hoạt động")),
      h("td", {}, h("div", { style: "display:flex;gap:6px" },
        s.failed >= 10 ? h("button", { class: "btn ghost sm", onclick: () => act(s, { p_unlock: true }, "Đã mở khoá") }, "Mở khoá") : null,
        h("button", { class: "btn ghost sm", onclick: () => act(s, { p_reset_pin: true }, "Đã đổi PIN") }, "Đổi PIN"),
        h("button", { class: "btn ghost sm", title: "Hiện/ẩn tên em này trên bảng vinh danh", onclick: () => act(s, { p_hide_rank: !s.hide_rank }, s.hide_rank ? "Đã hiện lại trên bảng vinh danh" : "Đã ẩn khỏi bảng vinh danh") }, s.hide_rank ? "Hiện vinh danh" : "Ẩn vinh danh"),
        h("button", { class: "btn ghost sm", onclick: () => { const n = prompt("Sửa họ tên", s.name); if (n) act(s, { p_name: n }); } }, "Sửa tên"),
        h("button", { class: "btn ghost sm", onclick: () => moveDlg([s]) }, "Chuyển lớp"),
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
        h("label", { class: "chk full" }, deact, "Ẩn các câu đang có trên máy chủ nhưng không còn trong file bank.js (chỉ chọn khi file chứa đủ tất cả các khối)"),
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
    const withQ = new Set(bank.map((b) => +b.g));
    const bgSel = h("select", { id: "bkG", "aria-label": "Khối", style: "max-width:200px" },
      h("option", { value: "" }, "Tất cả các khối"), KT.GRADES.map((g) => h("option", { value: g, selected: g === bankGrade }, "Toán " + g + (withQ.has(g) ? "" : " (chưa có câu)"))));
    bgSel.onchange = () => { bankGrade = bgSel.value ? +bgSel.value : null; el.innerHTML = ""; tabBank(el); };
    for (const g of KT.GRADES.filter((x) => bankGrade ? x === bankGrade : withQ.has(x))) {
      tbody.append(h("tr", {}, h("td", { colspan: 5, style: "background:var(--surface-2);font-weight:750" }, "Toán " + g)));
      KT.lessonsOf(g).forEach((key) => {
        const c = { MC: 0, TF: 0, SA: 0 }; bank.forEach((b) => { if (b.g + "-" + b.l === key) c[b.t] += b.n; });
        const n = c.MC + c.TF + c.SA;
        tbody.append(h("tr", {}, h("td", {}, KT.lessonName(key)), h("td", { class: "num" }, String(c.MC)), h("td", { class: "num" }, String(c.TF)), h("td", { class: "num" }, String(c.SA)),
          h("td", { class: "num" }, h("b", { style: "color:var(--" + (n >= 150 ? "ok" : n >= 30 ? "warn" : "bad") + ")" }, String(n)))));
      });
    }
    tbl.append(tbody);
    el.append(h("div", { class: "section-t", style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between" }, "Số câu theo bài (mục tiêu ~200 câu/bài)", bgSel), h("div", { class: "tbl-wrap" }, tbl));
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
