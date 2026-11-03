/* Lớp tương tác giao diện: header thu gọn khi cuộn, menu điện thoại, chuyển trang, hiện dần khi cuộn,
   bộ đếm số, thanh tab có vạch chạy, hiệu ứng thị sai ở khu giới thiệu. Không đụng tới dữ liệu hay API. */
(() => {
  "use strict";
  const KT = window.KT || (window.KT = {});
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => RM.matches;
  const app = document.getElementById("app");
  const top = document.querySelector(".top");

  /* ---------- header: đổ bóng khi cuộn ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { top && top.classList.toggle("scrolled", window.scrollY > 6); ticking = false; });
  };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- menu trên điện thoại: gom tên, nút máy tính, đăng xuất vào một bảng mở/thu ---------- */
  const who = document.getElementById("who");
  if (top && who) {
    const wrap = top.querySelector(".wrap");
    const btn = document.createElement("button");
    btn.className = "iconbtn navtoggle"; btn.type = "button";
    btn.setAttribute("aria-label", "Mở menu"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "who");
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="l1" d="M4 7h16"/><path class="l2" d="M4 12h16"/><path class="l3" d="M4 17h16"/></svg>';
    wrap.append(btn);
    const set = (open) => {
      top.classList.toggle("navopen", open); btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    };
    btn.addEventListener("click", () => set(!top.classList.contains("navopen")));
    document.addEventListener("click", (e) => { if (top.classList.contains("navopen") && !top.contains(e.target)) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && top.classList.contains("navopen")) { set(false); btn.focus(); } });
    who.addEventListener("click", (e) => { if (e.target.closest("button, a")) setTimeout(() => set(false), 0); });
    // chỉ hiện nút menu khi có gì để mở (đã đăng nhập)
    const sync = () => top.classList.toggle("has-who", who.children.length > 0);
    new MutationObserver(sync).observe(who, { childList: true }); sync();
  }

  /* ---------- bộ đếm số ---------- */
  const parseVi = (t) => {
    const m = /^\s*([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)(?:,([0-9]+))?\s*$/.exec(t);
    if (!m) return null;
    return { v: +(m[1].replace(/\./g, "") + (m[2] ? "." + m[2] : "")), dec: m[2] ? m[2].length : 0 };
  };
  const fmtVi = (v, dec) => v.toLocaleString("vi-VN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  function countEl(el) {
    if (el.dataset.counted) return; el.dataset.counted = "1";
    const final = el.textContent, p = parseVi(final);
    if (!p || p.v === 0 || reduced()) return;
    const t0 = performance.now(), dur = Math.min(1100, 500 + Math.log10(p.v + 1) * 180);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? fmtVi(p.dec ? Math.round(p.v * e * 10 ** p.dec) / 10 ** p.dec : Math.round(p.v * e), p.dec) : final;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const COUNT_SEL = "[data-count], .kpi .n, .pc-num b, .rv-count";
  const count = (root) => { if (!root) return; (root.matches && root.matches(COUNT_SEL) ? [root] : []).concat([...root.querySelectorAll(COUNT_SEL)]).forEach(countEl); };

  /* ---------- hiện dần khi cuộn + chuyển trang ---------- */
  const RV_SEL = ".panel, .card, .kpi, .lv-card, .section-t, .fame-public, .auth, .pcard, .hero, .tbl-wrap, .review-t, .tj";
  const SKIP = ".modal, .one-q, .exam-head, .khc, .lv-room, .res-top";
  let pageAt = 0, batch = 0;
  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      el.classList.add("rv-in"); count(el);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }) : null;
  function reveal(el) {
    if (!io || reduced() || el.dataset.rv || el.closest(SKIP)) { if (el.matches) count(el); return; }
    el.dataset.rv = "1";
    el.style.setProperty("--rv-d", Math.min(batch++, 6) * 55 + "ms");
    el.classList.add("rv");
    io.observe(el);
    // dự phòng: khối nằm sẵn trong màn hình thì hiện luôn; sau 2,5 giây mọi khối chưa hiện cũng hiện (không bao giờ để nội dung bị ẩn)
    requestAnimationFrame(() => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) show(el); });
    setTimeout(() => show(el), 2500);
  }
  function show(el) { if (el.classList.contains("rv-in")) return; io.unobserve(el); el.classList.add("rv-in"); count(el); }
  function scan(node) {
    if (node.nodeType !== 1) return;
    const list = (node.matches(RV_SEL) ? [node] : []).concat([...node.querySelectorAll(RV_SEL)]);
    // chỉ khối ngoài cùng hiện dần (khối lồng trong khối đã hiện dần thì đi theo khối cha)
    list.filter((el) => !list.some((o) => o !== el && o.contains(el))).forEach(reveal);
  }
  if (app) {
    new MutationObserver((muts) => {
      let page = false;
      for (const m of muts) if (m.target === app && m.addedNodes.length) page = true;
      if (page) {
        pageAt = performance.now(); batch = 0;
        if (!reduced()) { app.classList.remove("pg-in"); void app.offsetWidth; app.classList.add("pg-in"); }
        const isAuth = !!app.querySelector(".auth");
        if (document.body.classList.contains("page-auth") && !isAuth) window.scrollTo(0, 0);   // đăng nhập xong: về đầu trang
        document.body.classList.toggle("page-auth", isAuth);
        if (top) top.classList.remove("navopen");
      }
      // nội dung tải xong trong vài giây đầu của trang mới thì hiện dần; cập nhật định kì về sau thì hiện ngay
      const fresh = performance.now() - pageAt < 2500;
      for (const m of muts) m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (fresh) scan(n); else count(n);
        n.querySelectorAll && n.querySelectorAll(".tabs").forEach(tabs);
        if (n.matches && n.matches(".tabs")) tabs(n);
      });
    }).observe(app, { childList: true, subtree: true });
  }

  /* ---------- thanh tab: vạch chỉ tab đang chọn chạy theo, tự cuộn tới tab đang chọn ---------- */
  function tabs(el) {
    if (el.dataset.tabsInit) return; el.dataset.tabsInit = "1";
    const bar = document.createElement("i"); bar.className = "tabs-bar"; bar.setAttribute("aria-hidden", "true"); el.append(bar);
    const place = (animate) => {
      const on = el.querySelector(":scope > .on, :scope > [aria-selected=true]");
      if (!on) { bar.style.opacity = "0"; return; }
      bar.style.transition = animate ? "" : "none";
      bar.style.opacity = "1"; bar.style.width = on.offsetWidth + "px"; bar.style.transform = "translateX(" + on.offsetLeft + "px)";
      const l = on.offsetLeft - 24, r = on.offsetLeft + on.offsetWidth + 24;
      if (l < el.scrollLeft || r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: Math.max(0, l), behavior: animate && !reduced() ? "smooth" : "auto" });
    };
    const edge = () => { el.classList.toggle("fade-l", el.scrollLeft > 4); el.classList.toggle("fade-r", el.scrollLeft + el.clientWidth < el.scrollWidth - 4); };
    el.addEventListener("scroll", edge, { passive: true });
    el.addEventListener("pointerover", (e) => {   // vạch lướt theo chuột rồi trở về tab đang chọn
      const b = e.target.closest("button, a"); if (!b || b.parentNode !== el || reduced()) return;
      bar.style.transition = ""; bar.style.width = b.offsetWidth + "px"; bar.style.transform = "translateX(" + b.offsetLeft + "px)";
    });
    el.addEventListener("pointerleave", () => place(true));
    requestAnimationFrame(() => { place(false); edge(); });
    window.addEventListener("resize", () => { place(false); edge(); });
  }

  /* ---------- khu giới thiệu: các kí hiệu toán trôi theo chuột (thị sai nhẹ) ---------- */
  document.addEventListener("pointermove", (e) => {
    if (reduced() || e.pointerType !== "mouse") return;
    const bp = e.target.closest && e.target.closest(".brandpanel");
    if (!bp) return;
    const r = bp.getBoundingClientRect();
    bp.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    bp.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }, { passive: true });

  KT.ui = { count, reveal: scan };
})();
