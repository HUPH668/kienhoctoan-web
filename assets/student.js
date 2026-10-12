/* Trang học sinh */
(() => {
  "use strict";
  const { h, esc, fmt, pct, store, api, LV, TYPES, TYPE_SHORT, PART, CUR, LESSON, romans } = KT;
  const app = document.getElementById("app");
  const who = document.getElementById("who");
  KT.initTheme(document.getElementById("themeBtn"));

  let sess = store.get("kt_stu", null);       // {token,name,code,class}
  let home = null, stats = null, lboard = null, fameTab = "week", grade = store.get("kt_grade", null);
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
    sess = null; store.del("kt_stu"); stopTimers(); renderLogin(expired ? "Phiên đăng nhập đã hết, em đăng nhập lại nhé." : "");
  }
  function stopTimers() { clearInterval(timerId); timerId = null; clearTimeout(saveTimer); }
  function setWho() {
    who.innerHTML = "";
    if (!sess) return;
    who.append(h("span", { class: "who-n" }, h("b", {}, sess.name), h("small", {}, (sess.class ? "Lớp " + sess.class + " · " : "") + sess.code)),
      h("button", { class: "btn ghost sm", onclick: () => { if (cur && cur.status === "doing") KT.confirm("Đăng xuất?", "Bài đang làm đã được lưu trên máy chủ, đăng nhập lại để làm tiếp.", "Đăng xuất", () => logout()); else logout(); } }, "Đăng xuất"));
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
      info.classes.map((c) => h("option", { value: c.id }, c.name)),
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

  /* ---------------- trang chủ ---------------- */
  async function renderHome() {
    stopTimers(); cur = null; setWho(); window.scrollTo(0, 0);
    app.innerHTML = ""; app.append(h("div", { class: "wrap loading" }, "Đang tải…"));
    try {
      [home, stats, lboard] = await Promise.all([rpc("student_home"), stats ? Promise.resolve(stats) : api.rpc("bank_stats", {}), api.rpc("leaderboard", { p_limit: 10 }).catch(() => null)]);
      clockSkew = new Date(home.server_now).getTime() - Date.now();
      if (grade == null || !CUR[grade]) grade = KT.guessGrade(home.student.class) || (CUR[10] ? 10 : KT.GRADES[0]);
    } catch (e) { app.innerHTML = ""; fail(e); app.append(h("div", { class: "wrap empty" }, "Không tải được dữ liệu. ", h("button", { class: "btn sm", onclick: renderHome }, "Thử lại"))); return; }
    app.innerHTML = "";
    const w = h("section", { class: "wrap" });
    w.append(h("div", { class: "hero" }, h("div", { class: "hero-tx" }, h("h1", {}, "Chào " + home.student.name.split(" ").slice(-1)[0] + "!"), h("p", {}, grade >= 10 ? "Làm các bài được giao, hoặc tự luyện theo bài, chương, học kì, thi tốt nghiệp và đánh giá năng lực." : "Làm các bài được giao, hoặc tự luyện theo bài, chương, giữa kì và cuối kì.")), levelCard()));

    if ((home.remedials || []).length) w.append(remedialBlock());
    w.append(todayBlock());

    // bài được giao
    w.append(h("div", { class: "section-t" }, "Bài kiểm tra được giao"));
    const now = Date.now() + clockSkew;
    const asg = home.assignments || [];
    if (!asg.length) w.append(h("div", { class: "panel empty" }, "Hiện chưa có bài nào được giao."));
    else {
      const list = h("div", { class: "cards" });
      asg.forEach((a) => {
        const op = new Date(a.opens_at).getTime(), cl = new Date(a.closes_at).getTime();
        let state, btn = null;
        if (a.doing) { state = h("span", { class: "pill warn" }, "Đang làm"); btn = h("button", { class: "btn acc", onclick: () => openAssignment(a) }, "Làm tiếp"); }
        else if (now < op) state = h("span", { class: "pill" }, "Mở lúc " + KT.dt(a.opens_at));
        else if (now > cl) state = h("span", { class: "pill" }, "Đã đóng");
        else if (a.done >= a.max_attempts) state = h("span", { class: "pill ok" }, "Đã nộp");
        else if (a.remedial) { state = h("span", { class: "pill warn" }, "Cần làm bài bổ sung"); btn = h("button", { class: "btn acc", onclick: () => startRemedial(a.remedial) }, "Làm bài bổ sung"); }
        else { state = h("span", { class: "pill ok" }, "Đang mở"); btn = h("button", { class: "btn acc", onclick: () => openAssignment(a) }, a.done ? "Làm lại" : "Bắt đầu"); }
        const res = a.last_attempt ? h("button", { class: "btn ghost sm", onclick: () => viewAttempt(a.last_attempt) }, "Xem kết quả") : null;
        list.append(h("div", { class: "card" }, h("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, h("span", { class: "tag acc" }, a.kind), state),
          h("h3", {}, a.title),
          h("p", { class: "meta" }, a.n_q + " câu · " + a.minutes + " phút · hạn " + KT.dt(a.closes_at) + (a.max_attempts > 1 ? " · tối đa " + a.max_attempts + " lần" : "")),
          a.best != null ? h("p", {}, "Điểm: ", h("b", {}, fmt(a.best))) : null,
          h("div", { class: "row" }, btn, res)));
      });
      w.append(list);
    }
    // bài tự luyện đang làm dở
    (home.doing || []).forEach((d) => w.append(h("div", { class: "rec", style: "margin-top:12px" },
      h("div", { class: "tx" }, h("b", {}, "Đang làm dở: " + d.title), h("span", {}, "Hết giờ lúc " + KT.dt(d.ends_at))),
      h("button", { class: "btn acc sm", onclick: () => viewAttempt(d.id) }, "Làm tiếp"))));

    // bảng vinh danh
    if (lboard) w.append(fameBlock());

    // tự luyện
    w.append(h("div", { class: "section-t" }, "Tự luyện"));
    w.append(h("div", { class: "grades", role: "tablist" }, [6, 7, 8, 9, 10, 11, 12].map((x) => h("button", {
      class: "grade" + (x === grade ? " on" : ""), disabled: !CUR[x], role: "tab", "aria-selected": String(x === grade),
      onclick: () => { grade = x; store.set("kt_grade", x); renderHome(); } }, "Lớp " + x, !CUR[x] ? h("small", {}, "sắp có") : null))));
    w.append(practiceCards(grade));

    // hồ sơ
    w.append(h("div", { class: "section-t" }, "Hồ sơ năng lực"));
    const agg = KT.aggMastery(home.mastery, grade);
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
      home.history.forEach((r) => ul.append(h("li", { class: "click", onclick: () => viewAttempt(r.id), tabindex: 0 }, h("span", { class: "sc" }, fmt(r.score)),
        h("div", { class: "ti" }, h("b", {}, r.title), h("span", {}, KT.dt(r.submitted_at) + " · " + r.kind + (r.assigned ? " · bài giao" : ""))))));
      hp.append(ul);
    }
    pr.append(hp); w.append(pr);
    app.append(w);
    KT.typeset(app);
  }

  /* ---------------- thăng cấp + vinh danh ---------------- */
  function levelCard() {
    const I = KT.levelInfo(home.xp), rk = home.rank || {};
    return h("div", { class: "lvcard" },
      KT.levelBadge(I.L),
      h("div", { class: "lv-tx" },
        h("small", {}, "Cấp " + I.L), h("b", {}, I.title),
        h("div", { class: "xpbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(I.need), "aria-valuenow": String(I.cur) }, h("i", { style: "width:" + Math.round(I.pct * 100) + "%" })),
        h("span", {}, KT.num(I.cur) + " / " + KT.num(I.need) + " KN · còn " + KT.num(I.toNext) + " KN lên cấp " + (I.L + 1)),
        I.nextTitle ? h("span", { class: "lv-next" }, "Cấp " + I.nextTitleAt + ": " + I.nextTitle) : null,
        rk.week_rank ? h("span", { class: "lv-rank" }, "Hạng " + rk.week_rank + " tuần này") : null));
  }
  function fameBlock() {
    const box = h("div", { class: "fame" });
    const draw = () => {
      box.innerHTML = "";
      const rk = home.rank || {};
      const tabs = h("div", { class: "filters", role: "tablist" },
        [["week", "Tuần này"], ["all", "Mọi thời gian"]].map(([k, l]) => h("button", { class: fameTab === k ? "on" : "", role: "tab", "aria-selected": String(fameTab === k), onclick: () => { fameTab = k; draw(); } }, l)));
      const rows = fameTab === "week" ? lboard.week : lboard.all;
      const myRank = fameTab === "week" ? rk.week_rank : rk.all_rank;
      box.append(h("div", { class: "fame-head" }, tabs,
        h("span", { class: "fame-me" }, rk.hidden ? "Em đang được ẩn khỏi bảng vinh danh." : myRank ? "Em đang xếp hạng " + myRank + (fameTab === "week" ? " tuần này, " + KT.num(rk.week_xp) + " KN" : "") : "Làm bài để có tên trên bảng.")),
        KT.rankList(rows, fameTab === "week" ? "w" : "xp", { empty: fameTab === "week" ? "Tuần mới vừa bắt đầu. Ai làm bài đầu tiên sẽ đứng đầu bảng!" : undefined }));
    };
    draw();
    return h("div", {}, h("div", { class: "section-t" }, "Bảng vinh danh"), box);
  }
  function xpBlock(p, fresh) {
    const gained = +p.xp || 0, total = +p.student_xp || 0;
    const I = KT.levelInfo(total), before = KT.lvOf(total - gained);
    const el = h("div", { class: "xpgain" },
      h("div", { class: "xg-n" }, "+" + KT.num(gained), h("small", {}, " kinh nghiệm")),
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
    close = KT.modal([h("div", { class: "lvup" },
      h("div", { class: "lvup-burst", "aria-hidden": "true" }, Array.from({ length: 14 }, (_, i) => h("i", { style: "--a:" + (i * 360 / 14) + "deg" }))),
      KT.levelBadge(I.L, "xl"),
      h("h3", {}, "Lên cấp " + I.L + "!"),
      h("p", {}, newTitle ? "Em nhận danh hiệu mới: " : "Danh hiệu của em: ", h("b", {}, I.title)),
      I.nextTitle ? h("p", { class: "sub" }, "Cố lên! Đến cấp " + I.nextTitleAt + " em sẽ là " + I.nextTitle + ".") : null,
      h("div", { class: "acts" }, h("button", { class: "btn acc", onclick: () => close() }, "Tuyệt vời!")))]);
  }

  /* ---------------- nhiệm vụ hôm nay + sổ câu sai ---------------- */
  const hm = (d) => new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  function todayBlock() {
    const ms = home.mission, rv = home.review || {}, streak = home.streak || 0;
    let mText, mBtn;
    if (!ms) {
      mText = "Khoảng 12 câu trong 15 phút: ôn lại câu em từng sai, luyện bài em đang yếu và 2 câu khó hơn một chút.";
      mBtn = h("button", { class: "btn acc", onclick: startMission }, "Làm nhiệm vụ");
    } else if (ms.status === "doing") {
      mText = "Em đang làm dở nhiệm vụ hôm nay. Đồng hồ vẫn chạy, hết giờ lúc " + hm(ms.ends_at) + ".";
      mBtn = h("button", { class: "btn acc", onclick: startMission }, "Làm tiếp");
    } else {
      mText = "Hoàn thành rồi, " + fmt(ms.score) + " điểm. Hẹn em ngày mai để giữ chuỗi ngày học.";
      mBtn = h("button", { class: "btn ghost", onclick: () => viewAttempt(ms.id) }, "Xem kết quả");
    }
    const mission = h("div", { class: "mission" + (ms && ms.status === "done" ? " done" : "") },
      h("div", { class: "m-head" },
        h("div", {}, h("h2", {}, "Nhiệm vụ hôm nay"), h("p", {}, mText)),
        h("div", { class: "streak", title: "Số ngày liên tiếp em có nộp bài" }, h("b", {}, String(streak)), h("span", {}, "ngày học liên tiếp"))),
      h("div", { class: "row" }, mBtn));

    const due = rv.due || 0, total = rv.total || 0, mastered = rv.mastered || 0;
    const stat = (n, l, cls) => h("div", { class: "bk-stat " + (cls || "") }, h("b", {}, String(n)), h("span", {}, l));
    const book = h("div", { class: "book" },
      h("h2", {}, "Sổ câu sai"),
      total || mastered ? h("div", { class: "bk-stats" }, stat(due, "đến hạn ôn", due ? "due" : ""), stat(total, "đang trong sổ"), stat(mastered, "đã thuộc", "ok"))
        : h("p", {}, "Sổ đang trống. Câu nào em làm sai sẽ tự vào đây, và hệ thống nhắc em ôn lại sau 1, 3, 7 rồi 21 ngày."),
      rv.cw ? h("p", { class: "bk-cw" }, rv.cw + " câu em từng chọn “Chắc chắn” mà vẫn sai sẽ được ôn trước.") : null,
      !due && total ? h("p", { class: "bk-next" }, "Lần ôn tiếp theo: " + hm(rv.next) + ".") : null,
      h("div", { class: "row" },
        due ? h("button", { class: "btn acc", onclick: startReview }, "Ôn ngay " + Math.min(due, 10) + " câu") : null,
        total || mastered ? h("button", { class: "btn ghost", onclick: renderBook }, "Xem sổ") : null));
    return h("div", { class: "today" }, mission, book);
  }
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
  async function renderBook() {
    stopTimers(); cur = null; setWho(); window.scrollTo(0, 0);
    app.innerHTML = ""; app.append(h("div", { class: "wrap loading" }, "Đang tải…"));
    let d;
    try { d = await rpc("review_list"); } catch (e) { app.innerHTML = ""; fail(e); return; }
    app.innerHTML = "";
    const w = h("section", { class: "wrap" });
    const now = new Date(d.server_now).getTime();
    const items = d.items || [];
    const due = items.filter((x) => !x.done && new Date(x.due_at).getTime() <= now + 6 * 3600e3).length;
    w.append(h("div", { class: "review-t", style: "margin-top:22px" }, h("h2", { style: "margin:0;font-size:24px" }, "Sổ câu sai"), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: renderHome }, "Về trang chủ"),
      due ? h("button", { class: "btn acc sm", onclick: startReview }, "Ôn ngay " + Math.min(due, 10) + " câu") : null));
    w.append(h("p", { class: "sub", style: "color:var(--ink-2);max-width:70ch" }, "Mỗi câu sai được hẹn ôn lại sau 1 ngày. Lần ôn em sẽ gặp một câu cùng dạng: làm đúng thì hẹn xa dần 3, 7 rồi 21 ngày; đúng đủ 4 lần là đã thuộc. Làm sai thì quay lại ôn từ ngày mai."));
    if (!items.length) { w.append(h("div", { class: "panel empty" }, "Sổ đang trống.")); app.append(w); return; }
    const steps = (b, done) => h("span", { class: "boxes", title: done ? "Đã thuộc" : "Đã ôn đúng " + b + "/4 lần" }, [0, 1, 2, 3].map((i) => h("i", { class: done || i < b ? "on" : "" })));
    const list = h("div", { class: "booklist" });
    items.forEach((x) => {
      const t = new Date(x.due_at).getTime();
      const when = x.done ? h("span", { class: "pill ok" }, "Đã thuộc") : t <= now + 6 * 3600e3 ? h("span", { class: "pill warn" }, "Đến hạn ôn") : h("span", { class: "pill" }, "Ôn lúc " + hm(x.due_at));
      list.append(h("div", { class: "bk-item" + (x.done ? " done" : "") },
        h("div", { class: "bk-meta" }, h("b", {}, KT.lessonName(x.g + "-" + x.l, true)), h("span", { class: "lvl" }, LV[x.lv] || x.lv), h("span", {}, TYPE_SHORT[x.t]),
          x.cw ? h("span", { class: "conftag cw" }, "Tưởng đúng mà sai") : null, x.wrong_n > 1 ? h("span", { class: "pill bad" }, "Sai " + x.wrong_n + " lần") : null,
          h("span", { class: "sp" }), when, steps(x.box, x.done)),
        h("div", { class: "qmini", html: x.q })));
    });
    w.append(list);
    app.append(w);
    const need = [...new Set(items.flatMap((x) => [...(x.q || "").matchAll(/data-fig="([0-9a-f]+)"/g)].map((m) => m[1])))].filter((k) => !figCache[k]);
    if (need.length) { try { Object.assign(figCache, await api.rpc("get_figs", { p_ids: need.slice(0, 200) })); } catch (e) { } }
    KT.typeset(list, figCache);
  }

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
    cards.append(h("div", { class: "card" }, h("span", { class: "tag" }, "20 phút"), h("h3", {}, "Theo bài"), h("p", {}, g >= 10 ? "10 câu nhiều phương án, 2 đúng/sai, 2 trả lời ngắn." : "Khoảng 14 câu trắc nghiệm của một bài học."),
      h("div", { class: "row stack" }, lsSel, h("button", { class: "btn", disabled: !f1, onclick: () => setup(B.lesson(g, +lsSel.value)) }, "Làm bài"))));
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
    if (g >= 10) cards.append(h("div", { class: "card" }, h("span", { class: "tag acc" }, "60 phút · 30 câu"), h("h3", {}, "Đánh giá năng lực"), h("p", {}, "Nhiều câu, thời gian ngắn, kiến thức lớp 10–12."),
      h("div", { class: "row" }, h("button", { class: "btn acc", onclick: () => setup(B.dgnl()) }, "Thi thử"))));
    const agg = KT.aggMastery(home.mastery, g);
    const weak = agg.lessons.filter((x) => x.w >= 2 && x.m < 0.8).sort((a, b) => a.m - b.m).slice(0, 3);
    cards.append(h("div", { class: "card" + (weak.length ? "" : " disabled") }, h("span", { class: "tag" }, "Cá nhân hoá"), h("h3", {}, "Bài cải thiện"),
      h("p", {}, weak.length ? "Tập trung vào " + weak.map((x) => "Bài " + LESSON[x.key].l).join(", ") + " — các bài em đang yếu nhất, ưu tiên câu em từng làm sai." : "Làm vài bài lớp " + g + " để hệ thống biết em cần cải thiện phần nào."),
      h("div", { class: "row" }, h("button", { class: "btn", disabled: !weak.length, onclick: () => setup(improveBp(weak.map((x) => x.key))) }, "Làm bài cải thiện"))));
    return cards;
  }
  function improveBp(keys, extra) {
    const g = +keys[0].split("-")[0], one = keys.length === 1;
    return Object.assign({ kind: "Bài cải thiện", grade: g, title: one ? "Luyện tập cải thiện · " + KT.lessonName(keys[0]) : "Bài cải thiện tổng hợp · " + keys.map((k) => "B" + LESSON[k].l).join(", ") + " (Toán " + g + ")",
      lessons: keys, counts: one ? { MC: 8, TF: 2, SA: 2 } : { MC: 10, TF: 3, SA: 3 }, minutes: one ? 20 : 30, prefer_wrong: true }, extra || {});
  }

  /* ---------------- cấu hình đề tự luyện ---------------- */
  function setup(bp) {
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
      h("div", { class: "grid3" }, fld("MC"), fld("TF"), fld("SA")),
      h("div", { style: "max-width:160px" }, h("label", { for: "nMin" }, "Thời gian (phút)"), minIn),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", onclick: () => close() }, "Huỷ"),
        h("button", { class: "btn", onclick: async (e) => {
          const c = {}; for (const t of ["MC", "TF", "SA"]) c[t] = Math.max(0, Math.min(60, parseInt(inputs[t].value || "0", 10)));
          if (!c.MC && !c.TF && !c.SA) return;
          e.target.disabled = true;
          const b2 = Object.assign({}, bp, { counts: c, minutes: Math.max(5, Math.min(180, parseInt(minIn.value || bp.minutes, 10))) });
          try { const p = await rpc("start_attempt", { p_blueprint: b2 }); close(); lastCtx = { bp }; startExam(p); }
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
      h("button", { class: "btn acc sm", onclick: () => startRemedial(r.id) }, r.doing ? "Làm tiếp" : "Làm bài bổ sung"))));
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
      h("button", { class: "btn acc", onclick: () => startRemedial(r.id) }, r.doing ? "Làm tiếp" : "Làm bài bổ sung ngay"));
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
    const head = h("div", { class: "exam-head" }, h("div", { class: "wrap" }, h("h2", {}, cur.title), saveEl, progEl, timerEl,
      h("button", { class: "btn acc sm", onclick: askSubmit }, "Nộp bài")));
    const list = h("div", {});
    let lastT = null;
    cur.items.forEach((it, i) => {
      if (it.t !== lastT) {
        const n = cur.items.filter((x) => x.t === it.t).length;
        const tip = { MC: "mỗi câu chọn 1 phương án", TF: "mỗi câu 4 ý, chọn Đúng hoặc Sai cho từng ý", SA: "điền đáp số" }[it.t];
        list.append(h("div", { class: "part-t" }, PART[it.t] + ". " + TYPES[it.t], h("small", {}, "(" + n + " câu · " + tip + ")")));
        lastT = it.t;
      }
      list.append(KT.qBlock(it, i, "exam", onChange));
    });
    const grid = h("div", { class: "navgrid" });
    cur.items.forEach((it, i) => grid.append(h("button", { type: "button", onclick: () => document.getElementById("q" + i).scrollIntoView({ behavior: "smooth", block: "start" }) }, String(i + 1))));
    const nav = h("aside", { class: "navbox" }, h("h4", {}, "Danh sách câu"), grid,
      h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:var(--brand)" }), "Đã làm"), h("span", {}, h("i", { style: "background:var(--surface-2);border:1px solid var(--line-2)" }), "Chưa làm"), h("span", {}, h("i", { style: "background:var(--accent)" }), "Đánh dấu")),
      h("button", { class: "btn acc", onclick: askSubmit }, "Nộp bài"));
    updNav = () => {
      let done = 0;
      cur.items.forEach((it, i) => { const a = KT.answered(it); if (a === 2) done++; grid.children[i].className = (a === 2 ? "done" : "") + (it.flag ? " flagged" : ""); });
      progEl.textContent = "Đã làm " + done + "/" + cur.items.length;
    };
    app.append(head, h("div", { class: "wrap exam-grid" }, h("div", {}, list), nav));
    updNav(); KT.typeset(app, cur.figs);
    const end = new Date(cur.ends_at).getTime();
    const tick = () => {
      const left = Math.max(0, end - (Date.now() + clockSkew));
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      timerEl.classList.toggle("low", left < 5 * 60000);
      if (left <= 0) { stopTimers(); submit(true); }
    };
    tick(); timerId = setInterval(tick, 1000);
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
      store.del(localKey()); cur = null;
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
    const ev = KT.evalPayload(p);
    const w = h("section", { class: "wrap" });
    const s = +p.score;
    const rank = s >= 9 ? "Xuất sắc" : s >= 8 ? "Giỏi" : s >= 6.5 ? "Khá" : s >= 5 ? "Trung bình" : s >= 3.5 ? "Yếu" : "Kém";
    const nOk = p.items.filter((r) => r.status === "ok").length;
    const dur = Math.round((new Date(p.submitted_at) - new Date(p.started_at)) / 1000);
    w.append(h("div", { class: "review-t", style: "margin-top:22px" }, h("h2", { style: "margin:0;font-size:22px" }, p.title), h("span", { class: "sp" }),
      h("button", { class: "btn ghost sm", onclick: renderHome }, "Về trang chủ"),
      lastCtx && lastCtx.bp ? h("button", { class: "btn sm", onclick: () => setup(lastCtx.bp) }, "Làm đề khác cùng loại") : null));
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
      w.append(h("div", { class: "panel" }, h("p", { class: "muted", style: "margin:0 0 10px" }, "Tỉ lệ điểm em đạt được ở từng bài trong đề này (bài yếu nhất ở trên)."), KT.hbars(lRows), KT.statusLegend()));
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
    const fl = h("div", { class: "filters" }), listBox = h("div", { style: "margin-top:12px" });
    const mk = (lab, f) => h("button", { onclick: (e) => { fl.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.target.classList.add("on"); show(f); } }, lab);
    fl.append(mk("Tất cả", () => true), mk("Sai / chưa đủ", (r) => r.status === "bad" || r.status === "part"), mk("Chưa làm", (r) => r.status === "skip"), mk("Đúng", (r) => r.status === "ok"));
    if (p.items.some((r) => r.conf === 1 && (r.status === "bad" || r.status === "part"))) fl.append(mk("Tưởng đúng mà sai", (r) => r.conf === 1 && (r.status === "bad" || r.status === "part")));
    fl.firstChild.classList.add("on");
    const show = (f) => { listBox.innerHTML = ""; p.items.forEach((it, i) => { if (f(it)) listBox.append(KT.qBlock(it, i, "review", null, { withGrade: multiG, pts: it.pts })); }); if (!listBox.children.length) listBox.append(h("div", { class: "empty" }, "Không có câu nào.")); KT.typeset(listBox, p.figs); };
    w.append(fl, listBox);
    w.append(h("p", { class: "foot" }, "* Mức độ có dấu sao là mức ước lượng."));
    app.append(w); show(() => true); KT.typeset(w, p.figs);
    // làm mới hồ sơ ngầm
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

  /* ---------------- khởi động ---------------- */
  window.addEventListener("beforeunload", () => { if (cur && dirty.size) flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  if (!KT_CONFIG.SUPABASE_URL || /DIEN_/.test(KT_CONFIG.SUPABASE_URL)) app.append(h("div", { class: "wrap empty" }, "Chưa cấu hình máy chủ (assets/config.js)."));
  else if (sess) renderHome(); else renderLogin();
})();
