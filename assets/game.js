/* Game "Hành trình Linh Thú" – giai đoạn 1: chọn linh thú, bản đồ theo chương, luyện tập, đánh linh thú hoang, trùm khu vực.
   Mọi kết quả (đúng sai, kinh nghiệm, sát thương, vật phẩm) do máy chủ tính; ở đây chỉ hiển thị. */
(() => {
  "use strict";
  const KT = window.KT, h = KT.h, D = window.GAMEDATA;
  if (!D) return;
  const SP = {}; D.species.forEach((s) => (SP[s.id] = s));
  const ZN = {}; D.regions.forEach((r) => (ZN[r.k] = r));
  const LVS = [["NB", "Dễ", "Nhận biết"], ["TH", "Vừa", "Thông hiểu"], ["VD", "Khó", "Vận dụng"], ["VDC", "Rất khó", "Vận dụng cao"]];
  const XP = { NB: 10, TH: 20, VD: 40, VDC: 80 }, LVM = { NB: 1, TH: 1.3, VD: 1.7, VDC: 2.2 };
  const KIND = { hit: "Tấn công", heal: "Hồi máu", drain: "Hút máu", buff: "Cường hoá", ult: "Tối thượng" };
  const KDESC = {
    hit: "Gây sát thương. Mỗi điểm chiêu tăng 15% sát thương.",
    drain: "Gây sát thương và hồi lại một nửa lượng đó. Mỗi điểm tăng 15%.",
    heal: "Hồi 20% máu tối đa, câu càng khó hồi càng nhiều. Mỗi điểm tăng 10%.",
    buff: "Ba lượt sau, đòn đánh mạnh hơn 30%. Mỗi điểm cộng thêm 3%.",
    ult: "Đòn mạnh nhất, chỉ dùng với câu Khó hoặc Rất khó. Mỗi điểm tăng 15%.",
  };
  const STAGE = ["", "Ấu thể", "Trưởng thành", "Huyền thoại"];
  const ITEM_IC = { potion: "🧪", elixir: "⚗️", shield: "🛡️", lens: "🔍", seed: "🌱", candy: "🍬", charm: "🪬" };
  const MOOD = { happy: ["Vui vẻ", "😊"], sleepy: ["Buồn ngủ", "😴"], hungry: ["Đói bụng", "🥺"] };
  const FEED_SRC = { test: "Bài kiểm tra", practice: "Tự luyện", video: "Xem video", candy: "Kẹo tri thức" };
  const ERR = {
    GAME_LOW_HP: "Linh thú còn dưới 25% máu. Em luyện tập vài câu hoặc dùng bình máu rồi hãy vào trận.",
    GAME_BOSS_LOCKED: "Khám phá khu vực đủ 100% thì trùm mới xuất hiện.",
    GAME_SKILL_LOCKED: "Chiêu này chưa mở khoá.",
    GAME_ULT_HARD: "Chiêu tối thượng chỉ dùng với câu Khó hoặc Rất khó.",
    GAME_NO_QUESTION: "Khu vực này chưa có câu hỏi. Em chọn khu khác trên bản đồ nhé.",
    GAME_TOO_FAST: "Em đọc kĩ đề rồi hãy trả lời.",
    GAME_FULL_HP: "Linh thú đang đầy máu.",
    GAME_NO_ITEM: "Em không còn vật phẩm này.",
    GAME_NOT_IN_BATTLE: "Vật phẩm này chỉ dùng được trong trận.",
    GAME_SHIELD_ON: "Khiên đang được dựng rồi.",
    GAME_EVOLVE_LEVEL: "Cần đạt cấp 10 (lần một) hoặc cấp 25 (lần hai) mới tiến hoá được.",
    GAME_IN_BATTLE: "Đang trong trận, chưa làm việc này được.",
    GAME_Q_GONE: "Câu hỏi này đã hết hạn, em lấy câu mới nhé.",
    GAME_NO_SP: "Chưa có điểm chiêu thức. Lên cấp để nhận thêm.",
    GAME_SKILL_MAX: "Chiêu này đã đạt tối đa 10 điểm.",
    GAME_ITEM_PASSIVE: "Vật phẩm này tự có tác dụng, không cần bấm dùng.",
  };
  const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, RM() ? 0 : ms));
  const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / Math.max(1, b)) * 100)));

  let ctx, root, S = null, ZC = null, answeredRun = 0;

  function call(fn, args) {
    return ctx.rpc(fn, args).catch((e) => {
      const m = /GAME_[A-Z_]+/.exec(e && e.message || "");
      if (m && ERR[m[0]]) KT.toast(ERR[m[0]], "bad"); else ctx.fail(e);
      throw e;
    });
  }

  /* ---------- mảnh giao diện dùng chung ---------- */
  const mon = (id, stage, cls) => h("div", { class: "mon " + (cls || ""), html: KT.monArt(id, { stage }) });
  const typeChip = (t) => h("span", { class: "gtype", style: "--tc:" + D.types[t].c }, D.types[t].name);
  function bar(cur, max, cls, label) {
    return h("div", { class: "gbar " + cls, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(max), "aria-valuenow": String(cur), "aria-label": label },
      h("i", { style: "width:" + pct(cur, max) + "%" }));
  }
  function hpCls(hp, mx) { const p = hp / Math.max(1, mx); return p > 0.5 ? "hp" : p > 0.25 ? "hp mid" : "hp low"; }
  const skillPow = (i, pts) => Math.round(D.pow[i] * (1 + 0.15 * pts) * 10) / 10;
  const icon = (k) => h("span", { class: "gic", "aria-hidden": "true" }, ITEM_IC[k] || "•");
  const itemsCount = () => Object.values(S.items || {}).reduce((a, b) => a + b, 0);
  const typeName = (t) => D.types[t].name;
  const beats = (a) => D.beats[a];
  const beatenBy = (a) => Object.keys(D.beats).find((k) => D.beats[k] === a);

  function frame(...kids) {
    root.innerHTML = "";
    const f = h("div", { class: "gm" }, ...kids);
    root.append(f);
    return f;
  }

  /* ---------- tải trạng thái ---------- */
  async function load() {
    frame(h("div", { class: "gm-load" }, h("div", { class: "gm-spin" }), h("p", {}, "Đang mở bản đồ…")));
    try {
      [S, ZC] = await Promise.all([call("g_state"), ZC ? Promise.resolve(ZC) : call("g_zones")]);
    } catch (e) {
      frame(h("div", { class: "gm-load" }, h("p", {}, "Không mở được game."), h("button", { class: "btn", onclick: load }, "Thử lại")));
      return;
    }
    route(true);
  }
  function route(first) {
    if (!S.char) return chooseScreen();
    if (S.battle) return battleScreen(first && S.pending && S.pending.mode === "battle");
    if (first && S.pending && S.pending.mode === "train") return trainScreen(true);
    mainScreen();
  }

  /* ---------- 1. chọn linh thú ---------- */
  function chooseScreen() {
    let filt = "all";
    const grid = h("div", { class: "gm-pickgrid" });
    const draw = () => {
      grid.innerHTML = "";
      D.species.filter((s) => filt === "all" || s.type === filt).forEach((s) => grid.append(
        h("button", { type: "button", class: "gm-pick", style: "--tc:" + D.types[s.type].c, onclick: () => pickDetail(s) },
          mon(s.id, 1), h("b", {}, s.name), typeChip(s.type))));
    };
    const chips = h("div", { class: "gm-filter", role: "tablist", "aria-label": "Lọc theo hệ" });
    const chipBtn = (k, label, col) => h("button", { type: "button", role: "tab", "aria-selected": String(filt === k), class: filt === k ? "on" : "", style: col ? "--tc:" + col : null,
      onclick: () => { filt = k; chips.querySelectorAll("button").forEach((b) => { const on = b.dataset.k === filt; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); }); draw(); } }, label);
    [["all", "Tất cả"]].concat(Object.keys(D.types).map((k) => [k, D.types[k].name, D.types[k].c])).forEach(([k, l, c]) => { const b = chipBtn(k, l, c); b.dataset.k = k; chips.append(b); });
    draw();
    frame(
      h("header", { class: "gm-hero" },
        h("h1", {}, "Hành trình ", h("span", {}, "Linh Thú")),
        h("p", {}, "Chọn một linh thú đồng hành. Em giải đúng câu hỏi thì linh thú nhận kinh nghiệm, lên cấp và học chiêu mạnh hơn."),
        S.fallen ? h("p", { class: "gm-note" }, "Em đã có " + S.fallen + " linh thú gục trên đường phiêu lưu. Hãy bắt đầu lại với một bạn đồng hành mới.") : null,
        h("button", { class: "btn ghost sm gm-rules-btn", type: "button", onclick: rulesModal }, "Xem luật chơi")),
      cycleStrip(), chips, grid);
  }
  function cycleStrip() {
    const ks = Object.keys(D.types);
    return h("div", { class: "gm-cycle", "aria-label": "Vòng khắc chế giữa các hệ" },
      h("span", { class: "gm-cycle-t" }, "Vòng khắc chế:"),
      ks.map((k, i) => [h("span", { class: "gtype", style: "--tc:" + D.types[k].c }, D.types[k].name), h("span", { class: "gm-arrow", "aria-hidden": "true" }, "›")]).flat(),
      h("span", { class: "gtype", style: "--tc:" + D.types[ks[0]].c }, D.types[ks[0]].name),
      h("span", { class: "gm-cycle-n" }, "Hệ đứng trước gây thêm 50% sát thương lên hệ đứng sau."));
  }
  function statRow(label, v) { return h("div", { class: "gm-stat" }, h("span", {}, label), h("div", { class: "gbar st" }, h("i", { style: "width:" + Math.round((v - 0.7) / 0.6 * 100) + "%" }))); }
  function pickDetail(s) {
    let close;
    const inp = h("input", { type: "text", maxlength: "20", placeholder: s.name, "aria-label": "Đặt tên cho linh thú" });
    close = KT.modal(h("div", { class: "gm-detail", style: "--tc:" + D.types[s.type].c },
      h("div", { class: "gm-detail-top" }, mon(s.id, 1, "big idle"),
        h("div", {}, h("h3", {}, s.name), typeChip(s.type), h("p", {}, s.desc),
          h("p", { class: "gm-small" }, "Khắc hệ " + typeName(beats(s.type)) + ", bị hệ " + typeName(beatenBy(s.type)) + " khắc."))),
      h("div", { class: "gm-stats" }, statRow("Máu", s.hp), statRow("Công", s.atk), statRow("Thủ", s.def)),
      h("ol", { class: "gm-skl" }, s.skills.map((k, i) => h("li", {}, h("b", {}, k.n), h("span", {}, KIND[k.k] + (D.unlock[i] > 1 ? ", mở ở cấp " + D.unlock[i] : ", có ngay"))))),
      h("label", { class: "gm-name" }, h("span", {}, "Đặt tên (không bắt buộc)"), inp),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Xem con khác"),
        h("button", { class: "btn", type: "button", onclick: async () => {
          const r = await call("g_create", { p_species: s.id, p_nick: inp.value.trim() || s.name }).catch(() => null);
          if (!r) return;
          close(); S = r; mainScreen();
          setTimeout(() => { KT.ui && KT.ui.confetti && KT.ui.confetti(); KT.toast(S.char.nick + " đã sẵn sàng. Em có 3 bình máu, 2 kính lúp và 1 khiên để khởi đầu.", "ok"); }, 200);
        } }, "Chọn " + s.name))), { wide: true });
  }

  /* ---------- 2. màn hình chính: linh thú + khu vực + bản đồ ---------- */
  function mePanel(compact) {
    const c = S.char, s = SP[c.species];
    const acc = c.answered ? Math.round(c.correct / c.answered * 100) : null;
    const lvl = h("span", { class: "gm-lv" }, "Cấp " + c.level);
    return h("section", { class: "gm-me" + (compact ? " compact" : ""), style: "--tc:" + D.types[s.type].c },
      mon(c.species, c.stage, "idle"),
      h("div", { class: "gm-me-info" },
        h("div", { class: "gm-me-name" }, h("h2", {}, c.nick), lvl),
        h("div", { class: "gm-me-sub" }, typeChip(s.type), h("span", {}, s.name + ", " + STAGE[c.stage])),
        h("div", { class: "gm-barline" }, h("span", {}, "Máu"), bar(c.hp, c.maxhp, hpCls(c.hp, c.maxhp), "Máu"), h("b", {}, c.hp + "/" + c.maxhp)),
        h("div", { class: "gm-barline" }, h("span", {}, "KN"), bar(c.xp, c.need, "xp", "Kinh nghiệm"), h("b", {}, c.xp + "/" + c.need)),
        compact ? null : h("p", { class: "gm-small" }, MOOD[c.mood || "happy"][1] + " " + MOOD[c.mood || "happy"][0] + ". " + (c.hp < c.maxhp ? "Máu tự hồi 1% mỗi phút khi nghỉ, và 5% mỗi câu luyện tập đúng." : "Linh thú đang khoẻ, sẵn sàng vào trận.")),
        compact || !c.can_evolve ? null : h("button", { class: "btn acc sm gm-evo", type: "button", onclick: evolve }, "✨ Tiến hoá thành " + STAGE[c.stage + 1]),
        compact ? null : h("dl", { class: "gm-nums" },
          h("div", {}, h("dt", {}, "Công"), h("dd", {}, c.atk)), h("div", {}, h("dt", {}, "Thủ"), h("dd", {}, c.def)),
          h("div", {}, h("dt", {}, "Thắng"), h("dd", {}, c.wins)), h("div", {}, h("dt", {}, "Đúng"), h("dd", {}, acc == null ? "–" : acc + "%"))),
        compact ? null : h("div", { class: "gm-me-acts" },
          h("button", { class: "btn sm" + (c.sp ? "" : " ghost"), type: "button", onclick: skillsModal }, "Chiêu thức", c.sp ? h("i", { class: "gm-dot" }, String(c.sp)) : null),
          h("button", { class: "btn ghost sm", type: "button", onclick: () => bagModal() }, "Túi đồ (" + itemsCount() + ")"),
          h("button", { class: "btn ghost sm", type: "button", onclick: rulesModal }, "Luật chơi"))));
  }
  function zoneInfo() {
    const z = ZN[S.char.region], p = S.zones[z.k] || { prog: 0, boss: 0 };
    const cnt = (ZC && ZC[z.k]) || {}, total = Object.values(cnt).reduce((a, b) => a + b, 0);
    const bossOpen = p.prog >= 100;
    const tile = (cls, title, sub, on, dis) => h("button", { type: "button", class: "gm-tile " + cls, disabled: dis || null, onclick: on }, h("b", {}, title), h("span", {}, sub));
    return h("section", { class: "gm-zone g" + z.g },
      h("p", { class: "gm-zone-k" }, "Lớp " + z.g + ", chương " + z.c),
      h("h2", {}, z.name), h("p", { class: "gm-zone-ch" }, z.ch),
      h("div", { class: "gm-barline" }, h("span", {}, "Khám phá"), bar(p.prog, 100, "prog", "Khám phá khu vực"), h("b", {}, p.prog + "%")),
      h("p", { class: "gm-small" }, bossOpen ? "Trùm khu vực đã xuất hiện!" : "Mỗi câu đúng ở đây giúp khám phá thêm. Đủ 100% thì trùm khu vực xuất hiện."
        + (p.boss ? " Em đã hạ trùm " + p.boss + " lần." : "")),
      total ? null : h("p", { class: "gm-warn" }, "Khu vực này chưa có câu hỏi. Em chọn khu khác trên bản đồ."),
      h("div", { class: "gm-tiles" },
        tile("t-train", "Luyện tập", "Giải toán nhận kinh nghiệm, hồi máu", () => trainScreen(), !total),
        tile("t-wild", "Săn linh thú hoang", "Mỗi lượt giải một câu để ra chiêu", () => startBattle(false), !total),
        tile("t-boss" + (bossOpen ? " open" : ""), "Thách đấu trùm", bossOpen ? "Trùm mạnh gấp đôi, thắng chắc chắn có đồ hiếm" : "Cần khám phá 100%", () => startBattle(true), !bossOpen || !total)));
  }
  function mapPanel() {
    let g = ZN[S.char.region].g;
    const box = h("section", { class: "gm-map" });
    const tabs = h("div", { class: "gm-islands", role: "tablist", "aria-label": "Chọn đảo" });
    const body = h("div", { class: "gm-isle" });
    const drawTabs = () => {
      tabs.innerHTML = "";
      [10, 11, 12].forEach((k) => {
        const zs = D.regions.filter((r) => r.g === k), done = zs.filter((r) => S.zones[r.k] && S.zones[r.k].conq).length;
        tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(k === g), class: "isl g" + k + (k === g ? " on" : ""), onclick: () => { g = k; drawTabs(); draw(); } },
          h("b", {}, "Đảo lớp " + k), h("span", {}, done + "/" + zs.length + " khu đã chinh phục")));
      });
    };
    const draw = () => {
      body.className = "gm-isle g" + g; body.innerHTML = "";
      const zs = D.regions.filter((r) => r.g === g), cols = 3, rowH = 112;
      const pos = zs.map((r, i) => { const row = Math.floor(i / cols), col = row % 2 ? cols - 1 - (i % cols) : i % cols; return [18 + col * 32, 92 + row * rowH]; });
      const H = 92 + (Math.ceil(zs.length / cols) - 1) * rowH + 70;
      body.style.height = H + "px";
      let d = "";
      pos.forEach(([x, y], i) => {
        if (!i) { d = "M" + x + " " + y; return; }
        const [px, py] = pos[i - 1];
        d += py === y ? " L" + x + " " + y : " C" + (px + (px > 50 ? 14 : -14)) + " " + (py + rowH * 0.15) + " " + (x + (x > 50 ? 14 : -14)) + " " + (y - rowH * 0.15) + " " + x + " " + y;
      });
      body.append(h("div", { class: "gm-path", html: '<svg viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" vector-effect="non-scaling-stroke"/></svg>' }));
      zs.forEach((r, i) => {
        const p = S.zones[r.k] || { prog: 0 }, here = r.k === S.char.region, cnt = (ZC && ZC[r.k]) || {}, n = Object.values(cnt).reduce((a, b) => a + b, 0);
        const node = h("button", { type: "button", class: "gm-node" + (here ? " here" : "") + (p.conq ? " conq" : "") + (n ? "" : " empty"),
          style: "left:" + pos[i][0] + "%;top:" + pos[i][1] + "px;--p:" + (p.prog || 0),
          "aria-label": r.name + ", " + r.ch + (here ? ", đang ở đây" : "") + (n ? ", khám phá " + (p.prog || 0) + "%" : ", chưa có câu hỏi"),
          onclick: () => { if (!here) moveTo(r); } },
          h("span", { class: "gm-node-c" }, h("i", {}, String(r.c))),
          here ? h("span", { class: "gm-node-me", html: KT.monArt(S.char.species, { stage: S.char.stage }) }) : null,
          p.conq ? h("span", { class: "gm-node-star", "aria-hidden": "true" }, "★") : null,
          h("span", { class: "gm-node-n" }, r.name));
        body.append(node);
      });
    };
    drawTabs(); draw();
    box.append(h("div", { class: "gm-map-h" }, h("h3", {}, "Bản đồ"), h("p", {}, "Mỗi khu vực là một chương. Câu hỏi lấy đúng từ chương đó.")), tabs, body);
    return box;
  }
  async function moveTo(r) {
    const n = Object.values((ZC && ZC[r.k]) || {}).reduce((a, b) => a + b, 0);
    if (!n) { KT.toast("Khu " + r.name + " chưa có câu hỏi.", "bad"); return; }
    const res = await call("g_move", { p_zone: r.k }).catch(() => null);
    if (!res) return;
    S = res; mainScreen();
    KT.toast("Đã tới " + r.name + ".", "ok");
    const z = root.querySelector(".gm-zone"); if (z) z.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "center" });
  }
  function mainScreen() {
    answeredRun = 0;
    frame(h("div", { class: "gm-top" }, mePanel(), zoneInfo()), carePanel(), mapPanel());
  }
  // nuôi linh thú: mọi việc học trên web đều cho linh thú kinh nghiệm
  function carePanel() {
    const f = S.feed || [];
    const way = (ic, t, d) => h("li", {}, h("span", { class: "gm-way-ic", "aria-hidden": "true" }, ic), h("div", {}, h("b", {}, t), h("span", {}, d)));
    return h("section", { class: "gm-care" },
      h("div", {}, h("h3", {}, "Nuôi " + S.char.nick + " bằng việc học"),
        h("p", { class: "gm-small" }, "Hôm nay " + S.char.nick + " đã nhận " + (S.fed_today || 0) + " KN từ việc học của em."),
        h("ul", { class: "gm-ways" },
          way("📝", "Làm bài kiểm tra thầy cô giao", "Linh thú nhận gấp rưỡi số KN em được"),
          way("🎯", "Tự luyện, ôn sổ câu sai, nhiệm vụ hôm nay", "Linh thú nhận đúng số KN em được"),
          way("🎬", "Xem video bài học", "+15 KN mỗi video, tối đa 5 video mỗi ngày"),
          way("⚔️", "Luyện tập và đánh trận trên bản đồ", "KN theo độ khó của câu"))),
      h("div", {}, h("h3", {}, "Nhật kí chăm sóc"),
        f.length ? h("ul", { class: "gm-feed" }, f.map((x) => h("li", {}, h("span", {}, FEED_SRC[x.src] || x.src), h("b", {}, x.title || ""), h("em", {}, "+" + x.xp + " KN"))))
          : h("p", { class: "gm-small" }, "Chưa có gì. Em làm một bài kiểm tra hoặc tự luyện, linh thú sẽ lớn lên ngay.")));
  }
  async function evolve() {
    const old = S.char.stage;
    const r = await call("g_evolve").catch(() => null);
    if (!r) return;
    S = r; mainScreen();
    let close;
    close = KT.modal(h("div", { class: "gm-end win" }, h("div", { class: "gm-end-art evo", html: KT.monArt(S.char.species, { stage: S.char.stage }) }),
      h("h3", {}, S.char.nick + " đã tiến hoá!"), h("p", {}, "Từ " + STAGE[old] + " lên " + STAGE[S.char.stage] + ". Máu và sức công tăng thêm 15%."),
      h("div", { class: "acts" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Tuyệt vời"))));
    KT.ui && KT.ui.confetti && KT.ui.confetti();
  }

  /* ---------- 3. luyện tập ---------- */
  function lvPicker(onPick, opt = {}) {
    const z = S.char.region, cnt = (ZC && ZC[z]) || {};
    return h("div", { class: "gm-lvs" }, LVS.map(([k, a, b]) => {
      const n = cnt[k] || 0, dis = (opt.only && !opt.only.includes(k));
      return h("button", { type: "button", class: "gm-lvb l" + k, disabled: dis || null, onclick: () => onPick(k) },
        h("b", {}, a), h("span", {}, b),
        h("em", {}, opt.battle ? "Sát thương ×" + String(LVM[k]).replace(".", ",") : "+" + XP[k] + " KN"),
        n ? null : h("small", {}, "Khu này chưa có, sẽ lấy câu gần mức nhất"));
    }));
  }
  function qCard(q, num) {
    const it = { t: q.t, q: q.q, o: q.o, lv: q.lv, lg: q.lg, g: q.g, l: q.l, ans: null };
    const el = KT.qBlock(it, num, "exam", null, { conf: false });
    el.classList.add("gm-q");
    el.querySelector(".flag") && el.querySelector(".flag").remove();
    if (q.hint && q.hint.length) {
      el.querySelectorAll(".opt").forEach((b, i) => { if (q.hint.includes(i)) { b.disabled = true; b.classList.add("gm-cut"); b.title = "Kính lúp đã loại phương án này"; } });
    }
    return { el, it };
  }
  function reviewBlock(q, it, r, num) {
    const rv = Object.assign({}, it, { key: r.key, s: r.s, status: r.status, m: r.m });
    const el = KT.qBlock(rv, num, "review", null, {});
    el.classList.add("gm-q");
    return el;
  }
  async function trainScreen(resume) {
    const c = S.char, z = ZN[c.region];
    const area = h("div", { class: "gm-play" });
    frame(h("div", { class: "gm-bar-top" },
      h("button", { class: "btn ghost sm", type: "button", onclick: () => mainScreen() }, "‹ Về khu vực"),
      h("div", {}, h("b", {}, "Luyện tập: " + z.name), h("span", {}, z.ch))),
      h("div", { class: "gm-train" }, mePanel(true), area));
    const pick = () => {
      area.innerHTML = "";
      area.append(h("h3", { class: "gm-h3" }, "Chọn độ khó"), h("p", { class: "gm-small" }, "Câu càng khó, kinh nghiệm càng nhiều. Câu Khó và Rất khó làm đúng còn có cơ hội nhận vật phẩm."),
        lvPicker((lv) => ask(lv)));
    };
    const ask = async (lv) => {
      area.innerHTML = ""; area.append(h("div", { class: "gm-load sm" }, h("div", { class: "gm-spin" })));
      const q = await call("g_ask", { p_lv: lv }).catch(() => null);
      if (!q) { pick(); return; }
      show(q, lv);
    };
    const show = (q, lv) => {
      area.innerHTML = "";
      const { el, it } = qCard(q, answeredRun);
      const info = h("div", { class: "gm-qinfo" }, h("span", { class: "gm-badge l" + q.lv }, LVS.find((x) => x[0] === q.lv)[1] + ", +" + XP[q.lv] + " KN"),
        q.resumed ? h("span", { class: "gm-small" }, "Câu em đang làm dở") : (q.asked && q.asked !== q.lv ? h("span", { class: "gm-small" }, "Khu này hết câu mức em chọn, đây là câu gần nhất") : null));
      const go = async (ans) => {
        const r = await call("g_answer", { p_id: q.id, p_ans: ans }).catch(() => null);
        if (!r) return;
        answeredRun++; S = r.state;
        result(q, it, r, lv || q.lv);
      };
      area.append(info, el, h("div", { class: "gm-acts" },
        h("button", { class: "btn ghost", type: "button", onclick: () => go(null) }, "Bỏ qua"),
        h("button", { class: "btn", type: "button", onclick: () => {
          if (!KT.answered(it)) { KT.toast("Em chưa trả lời câu này.", "bad"); return; }
          return go(it.t === "SA" ? String(it.ans).trim() : it.ans);
        } }, "Trả lời")));
      KT.typeset(area, q.figs);
    };
    const result = (q, it, r, lv) => {
      area.innerHTML = "";
      const ok = r.m >= 1, part = r.m > 0 && r.m < 1;
      area.append(h("div", { class: "gm-verdict " + (ok ? "ok" : part ? "part" : "bad") },
        h("b", {}, ok ? "Chính xác!" : part ? "Đúng một phần" : "Chưa đúng"),
        h("span", {}, r.xp ? "+" + r.xp + " KN" : "Không nhận kinh nghiệm"),
        r.ev && r.ev.heal ? h("span", {}, "+" + r.ev.heal + " máu") : null,
        (r.drops || []).map((d) => h("span", { class: "gm-drop" }, icon(d), "Nhận " + D.items[d].n))),
        reviewBlock(q, it, r, answeredRun - 1),
        h("div", { class: "gm-acts" },
          h("button", { class: "btn ghost", type: "button", onclick: pick }, "Đổi độ khó"),
          h("button", { class: "btn", type: "button", onclick: () => ask(lv) }, "Câu tiếp theo")));
      KT.typeset(area, Object.assign({}, q.figs, r.sfigs));
      const me = root.querySelector(".gm-me"); if (me) me.replaceWith(mePanel(true));
      celebrate(r);
    };
    if (resume) ask("TH"); else pick();
  }

  /* ---------- 4. trận đấu ---------- */
  async function startBattle(boss) {
    const r = await call("g_wild", { p_boss: !!boss }).catch(() => null);
    if (!r) return;
    S = r; battleScreen(false, true);
  }
  function plate(name, lv, sp, hp, mx, extra) {
    return h("div", { class: "gm-plate" }, h("div", { class: "gm-plate-n" }, h("b", {}, name), h("span", {}, "Cấp " + lv)),
      h("div", { class: "gm-plate-t" }, typeChip(sp.type), extra || null),
      h("div", { class: "gm-barline" }, bar(hp, mx, hpCls(hp, mx), "Máu " + name), h("b", { class: "hpn" }, hp + "/" + mx)));
  }
  function floatTxt(target, txt, cls) {
    if (!target) return;
    const f = h("span", { class: "gm-float " + (cls || "") }, txt);
    target.append(f); setTimeout(() => f.remove(), 1500);
  }
  function setHp(plateEl, hp, mx) {
    const b = plateEl.querySelector(".gbar"), i = b.querySelector("i");
    b.className = "gbar " + hpCls(hp, mx); i.style.width = pct(hp, mx) + "%"; b.setAttribute("aria-valuenow", String(hp));
    plateEl.querySelector(".hpn").textContent = hp + "/" + mx;
  }
  function battleScreen(resume, fresh) {
    const c = S.char, b = S.battle, me = SP[c.species], en = SP[b.species], z = ZN[c.region];
    const boss = b.kind === "boss";
    const eName = (boss ? "Trùm " : "") + en.name + (boss ? "" : " hoang");
    const enMon = mon(b.species, b.stage, "idle en" + (boss ? " boss" : ""));
    const meMon = mon(c.species, c.stage, "idle me");
    const enPlate = plate(eName, b.level, en, b.hp, b.maxhp, b.shield ? null : null);
    const mePlate = plate(c.nick, c.level, me, c.hp, c.maxhp, h("span", { class: "gm-tags" }, b.buff ? h("em", {}, "Cường hoá " + b.buff + " lượt") : null, b.shield ? h("em", {}, "Có khiên") : null));
    const log = h("p", { class: "gm-log", "aria-live": "polite" });
    const say = (t) => { log.append(h("span", {}, t)); while (log.children.length > 2) log.firstChild.remove(); };
    say(fresh ? (boss ? "Trùm " + z.name + " xuất hiện: " + en.name + " cấp " + b.level + "!" : "Một " + en.name + " hoang cấp " + b.level + " xuất hiện!") : "Trận đấu đang tiếp tục.");
    const arena = h("div", { class: "gm-arena g" + z.g + (boss ? " boss" : "") },
      h("div", { class: "gm-side en" }, enPlate, h("div", { class: "gm-stage" }, enMon)),
      h("div", { class: "gm-side me" }, h("div", { class: "gm-stage" }, meMon), mePlate));
    const panel = h("div", { class: "gm-bpanel" });
    frame(h("div", { class: "gm-bar-top" }, h("div", {}, h("b", {}, boss ? "Đấu trùm khu vực" : "Trận đấu"), h("span", {}, z.name + ", " + z.ch)),
      h("span", { class: "gm-eff" }, effHint(me.type, en.type))), arena, log, panel);
    if (fresh && !RM()) { enMon.classList.add("enter"); }

    const tags = () => mePlate.querySelector(".gm-tags").replaceChildren(...[S.battle && S.battle.buff ? h("em", {}, "Cường hoá " + S.battle.buff + " lượt") : null, S.battle && S.battle.shield ? h("em", {}, "Có khiên") : null].filter(Boolean));
    const pickSkill = () => {
      panel.innerHTML = "";
      const cc = S.char;
      panel.append(h("h3", { class: "gm-h3" }, "Chọn chiêu"), h("div", { class: "gm-skills" }, me.skills.map((k, i) => {
        const lock = cc.level < D.unlock[i], pts = cc.skills[i];
        return h("button", { type: "button", class: "gm-sk k-" + k.k, disabled: lock || null, onclick: () => pickLv(i) },
          h("b", {}, k.n), h("span", {}, lock ? "Mở ở cấp " + D.unlock[i] : KIND[k.k] + (k.k === "heal" || k.k === "buff" ? "" : ", sức mạnh " + String(skillPow(i, pts)).replace(".", ","))),
          h("i", { class: "gm-pts", "aria-label": pts + " điểm" }, Array.from({ length: 10 }, (_, j) => h("u", { class: j < pts ? "on" : "" }))));
      })), h("div", { class: "gm-acts" },
        h("button", { class: "btn ghost sm", type: "button", onclick: () => bagModal(true, afterItem) }, "Túi đồ (" + itemsCount() + ")"),
        h("button", { class: "btn ghost sm", type: "button", onclick: flee }, "Bỏ chạy")));
    };
    const pickLv = (i) => {
      panel.innerHTML = "";
      const k = me.skills[i], lens = (S.items.lens || 0);
      const chk = lens ? h("input", { type: "checkbox", id: "gmlens" }) : null;
      panel.append(h("h3", { class: "gm-h3" }, k.n + ": chọn độ khó"),
        h("p", { class: "gm-small" }, k.k === "ult" ? "Chiêu tối thượng cần câu Khó hoặc Rất khó." : "Trả lời đúng thì chiêu trúng đích. Câu khó hơn, chiêu mạnh hơn."),
        lvPicker((lv) => ask(i, lv, chk && chk.checked), { battle: true, only: k.k === "ult" ? ["VD", "VDC"] : null }),
        lens ? h("label", { class: "gm-check" }, chk, h("span", {}, "Dùng kính lúp (còn " + lens + "): loại 2 phương án sai nếu là câu trắc nghiệm")) : null,
        h("div", { class: "gm-acts" }, h("button", { class: "btn ghost sm", type: "button", onclick: pickSkill }, "‹ Chọn chiêu khác")));
    };
    const ask = async (i, lv, useLens) => {
      panel.innerHTML = ""; panel.append(h("div", { class: "gm-load sm" }, h("div", { class: "gm-spin" })));
      const q = await call("g_ask", { p_lv: lv, p_skill: i, p_lens: !!useLens }).catch(() => null);
      if (!q) { pickSkill(); return; }
      showQ(q);
    };
    const showQ = (q) => {
      panel.innerHTML = "";
      const k = me.skills[q.skill];
      const { el, it } = qCard(q, answeredRun);
      if (q.lens_used === false && q.t !== "MC" && q.asked) { /* kính lúp chỉ dùng cho câu trắc nghiệm: không bị trừ */ }
      panel.append(h("div", { class: "gm-qinfo" }, h("span", { class: "gm-badge l" + q.lv }, k ? k.n : "Chiêu"), h("span", { class: "gm-small" }, LVS.find((x) => x[0] === q.lv)[2] + (q.resumed ? ", câu em đang làm dở" : ""))),
        el, h("div", { class: "gm-acts" },
          h("button", { class: "btn ghost", type: "button", onclick: () => answer(q, it, null) }, "Bỏ lượt"),
          h("button", { class: "btn", type: "button", onclick: () => {
            if (!KT.answered(it)) { KT.toast("Em chưa trả lời câu này.", "bad"); return; }
            return answer(q, it, it.t === "SA" ? String(it.ans).trim() : it.ans);
          } }, "Ra chiêu")));
      KT.typeset(panel, q.figs);
      panel.scrollIntoView({ behavior: RM() ? "auto" : "smooth", block: "nearest" });
    };
    const answer = async (q, it, ans) => {
      const r = await call("g_answer", { p_id: q.id, p_ans: ans }).catch(() => null);
      if (!r) return;
      answeredRun++;
      const prevB = S.battle; S = r.state;
      const ev = r.ev || {};
      panel.innerHTML = "";
      const rv = h("details", { class: "gm-rv" }, h("summary", {}, (r.m >= 1 ? "Đúng" : r.m > 0 ? "Đúng một phần" : "Chưa đúng") + ": xem đáp án và lời giải"), reviewBlock(q, it, r, answeredRun - 1));
      panel.append(h("div", { class: "gm-verdict " + (r.m >= 1 ? "ok" : r.m > 0 ? "part" : "bad") }, h("b", {}, r.m >= 1 ? "Chính xác!" : r.m > 0 ? "Đúng một phần" : "Chưa đúng, chiêu trượt"), r.xp ? h("span", {}, "+" + (r.xp - (ev.bonus || 0)) + " KN") : null), rv);
      KT.typeset(panel, Object.assign({}, q.figs, r.sfigs));
      // lượt của em
      const skName = ev.skill || "";
      if (ev.miss) { say(c.nick + " dùng " + skName + " nhưng trượt."); meMon.classList.add("atk"); await wait(350); floatTxt(enMon, "Trượt!", "miss"); }
      else if (ev.kind === "heal") { say(c.nick + " dùng " + skName + ", hồi " + (ev.heal || 0) + " máu."); floatTxt(meMon, "+" + (ev.heal || 0), "heal"); }
      else if (ev.kind === "buff") { say(c.nick + " dùng " + skName + ": ba lượt sau đánh mạnh hơn."); floatTxt(meMon, "Cường hoá!", "buff"); meMon.classList.add("glow"); }
      else if (ev.dmg != null) {
        meMon.classList.add("atk"); await wait(260);
        enMon.classList.add("hit"); floatTxt(enMon, "−" + ev.dmg, "dmg" + (ev.crit ? " crit" : ""));
        say(c.nick + " dùng " + skName + ", gây " + ev.dmg + " sát thương" + (ev.crit ? " (chí mạng!)" : "") + (ev.eff > 1 ? ". Hiệu quả cao!" : ev.eff < 1 ? ". Không hiệu quả lắm." : "."));
        if (ev.heal) floatTxt(meMon, "+" + ev.heal, "heal");
      }
      const ehp = ev.win ? 0 : (S.battle ? S.battle.hp : prevB.hp);
      setHp(enPlate, ehp, prevB.maxhp);
      await wait(700);
      meMon.classList.remove("atk", "glow"); enMon.classList.remove("hit");
      if (ev.win) {
        enMon.classList.add("faint"); await wait(600);
        return endOverlay(true, r, prevB);
      }
      // lượt của đối thủ
      const en2 = ev.enemy || {};
      enMon.classList.add("atk-e"); await wait(260);
      if (en2.miss) { floatTxt(meMon, "Né được!", "miss"); say(eName + " dùng " + en2.skill + " nhưng trượt."); }
      else if (en2.blocked) { floatTxt(meMon, "Khiên chặn!", "buff"); say("Khiên Py-ta-go chặn trọn đòn " + en2.skill + "."); }
      else if (en2.dmg != null) { meMon.classList.add("hit"); floatTxt(meMon, "−" + en2.dmg, "dmg"); say(eName + " dùng " + en2.skill + ", gây " + en2.dmg + " sát thương" + (en2.eff > 1 ? ". Hiệu quả cao!" : ".")); }
      setHp(mePlate, S.char.hp, S.char.maxhp);
      await wait(700);
      enMon.classList.remove("atk-e"); meMon.classList.remove("hit");
      if (ev.lose) { meMon.classList.add("faint"); await wait(600); return endOverlay(false, r, prevB); }
      tags();
      celebrate(r);
      panel.append(h("div", { class: "gm-acts" }, h("button", { class: "btn", type: "button", onclick: pickSkill }, "Lượt tiếp theo")));
      const nb = panel.querySelector(".gm-acts .btn"); if (nb) try { nb.focus({ preventScroll: true }); } catch (e) { }
    };
    const afterItem = (r) => {
      if (!r) return;
      S = r.state;
      if (r.heal) { floatTxt(meMon, "+" + r.heal, "heal"); setHp(mePlate, S.char.hp, S.char.maxhp); }
      const en2 = r.enemy;
      if (en2) {
        setTimeout(() => {
          if (en2.dmg != null) { meMon.classList.add("hit"); floatTxt(meMon, "−" + en2.dmg, "dmg"); setTimeout(() => meMon.classList.remove("hit"), 600); }
          else if (en2.blocked) floatTxt(meMon, "Khiên chặn!", "buff"); else if (en2.miss) floatTxt(meMon, "Né được!", "miss");
          say(eName + " tranh thủ dùng " + en2.skill + (en2.dmg != null ? ", gây " + en2.dmg + " sát thương." : "."));
          setHp(mePlate, S.char.hp, S.char.maxhp);
          if (r.lose) setTimeout(() => endOverlay(false, { ev: { enemy: en2, lose: true }, state: S }, S.battle), 700);
        }, 600);
      }
      tags(); if (!r.lose) pickSkill();
    };
    const flee = () => KT.confirm("Bỏ chạy?", "Đối thủ sẽ đánh một đòn khi em rút lui, và em không nhận phần thưởng của trận.", "Bỏ chạy", async () => {
      const r = await call("g_flee").catch(() => null);
      if (!r) return;
      S = r.state;
      const e = r.enemy || {};
      KT.toast(e.lose ? c.nick + " bị đánh gục khi bỏ chạy." : "Đã rút lui" + (e.dmg != null ? ", mất " + e.dmg + " máu." : "."), e.lose ? "bad" : "");
      mainScreen();
    });
    if (resume) ask(0, "TH", false); else pickSkill();
  }
  function effHint(a, d) {
    if (D.beats[a] === d) return "Hệ " + typeName(a) + " khắc " + typeName(d) + ": em có lợi thế";
    if (D.beats[d] === a) return "Hệ " + typeName(d) + " khắc " + typeName(a) + ": cẩn thận";
    return "Hai hệ không khắc nhau";
  }
  function endOverlay(win, r, b) {
    const c = S.char, ev = r.ev || {}, en = ev.enemy || {};
    let close;
    const body = win
      ? [h("div", { class: "gm-end-art", html: KT.monArt(c.species, { stage: c.stage }) }), h("h3", {}, b.kind === "boss" ? "Hạ gục trùm khu vực!" : "Chiến thắng!"),
        h("p", {}, "Nhận " + (r.xp || 0) + " kinh nghiệm" + (ev.bonus ? " (thưởng trận " + ev.bonus + ")" : "") + "."),
        (r.drops || []).length ? h("div", { class: "gm-drops" }, r.drops.map((d) => h("span", { class: "gm-drop" }, icon(d), D.items[d].n))) : null,
        b.kind === "boss" ? h("p", { class: "gm-small" }, "Khu vực được đánh dấu chinh phục. Khám phá lại 100% để đấu trùm lần nữa.") : null]
      : [h("div", { class: "gm-end-art sad", html: KT.monArt(c.species, { stage: c.stage }) }), h("h3", {}, c.nick + " đã gục"),
        h("p", {}, en.charm ? "Bùa hồi sinh đã cứu " + c.nick + ": giữ nguyên kinh nghiệm và hồi 30% máu." : "Mất " + (en.xp_lost || 0) + " kinh nghiệm của cấp hiện tại."),
        h("p", { class: "gm-small" }, "Luyện tập để hồi máu (5% mỗi câu đúng) hoặc nghỉ một lúc (1% mỗi phút), rồi quay lại trận.")];
    close = KT.modal(h("div", { class: "gm-end " + (win ? "win" : "lose") }, body,
      h("div", { class: "acts" }, h("button", { class: "btn", type: "button", onclick: () => { close(); mainScreen(); celebrate(r); } }, "Về khu vực"))), { sticky: true });
    if (win && KT.ui && KT.ui.confetti) KT.ui.confetti();
  }

  /* ---------- lên cấp, mở chiêu ---------- */
  function celebrate(r) {
    if (!r || !r.state || !r.state.char || !r.lv_from || r.state.char.level <= r.lv_from) return;
    const c = r.state.char, s = SP[c.species];
    if (celebrate.shown === c.level) return; celebrate.shown = c.level;
    const unlocked = s.skills.filter((k, i) => D.unlock[i] > r.lv_from && D.unlock[i] <= c.level);
    let close;
    close = KT.modal(h("div", { class: "gm-end win" }, h("div", { class: "gm-end-art", html: KT.monArt(c.species, { stage: c.stage }) }),
      h("h3", {}, c.nick + " lên cấp " + c.level + "!"),
      h("p", {}, "Nhận " + r.sp_gain + " điểm chiêu thức. Máu tối đa tăng lên " + c.maxhp + "."),
      unlocked.length ? h("p", { class: "gm-unlock" }, "Mở khoá chiêu mới: " + unlocked.map((k) => k.n).join(", ")) : null,
      c.can_evolve ? h("p", { class: "gm-unlock" }, "Linh thú đã đủ cấp tiến hoá! Bấm Tiến hoá ở khung linh thú.") : null,
      h("div", { class: "acts" }, h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Để sau"),
        h("button", { class: "btn", type: "button", onclick: () => { close(); skillsModal(); } }, "Nâng chiêu thức"))));
    if (KT.ui && KT.ui.confetti) KT.ui.confetti();
  }

  /* ---------- chiêu thức ---------- */
  function skillsModal() {
    let close;
    const draw = () => {
      const c = S.char, s = SP[c.species];
      return h("div", { class: "gm-skm", style: "--tc:" + D.types[s.type].c },
        h("h3", {}, "Chiêu thức của " + c.nick),
        h("p", { class: "gm-small" }, c.sp ? "Còn " + c.sp + " điểm chiêu thức. Mỗi chiêu tối đa 10 điểm." : "Hết điểm chiêu thức. Mỗi lần lên cấp nhận 1 điểm, cấp chia hết cho 5 nhận thêm 1 điểm."),
        h("ol", { class: "gm-skl big" }, s.skills.map((k, i) => {
          const lock = c.level < D.unlock[i], pts = c.skills[i];
          return h("li", { class: lock ? "lock" : "" },
            h("div", {}, h("b", {}, k.n), h("span", { class: "gm-kind k-" + k.k }, KIND[k.k]),
              h("p", {}, lock ? "Mở ở cấp " + D.unlock[i] + ". " + KDESC[k.k] : KDESC[k.k]),
              h("i", { class: "gm-pts", "aria-label": pts + " trên 10 điểm" }, Array.from({ length: 10 }, (_, j) => h("u", { class: j < pts ? "on" : "" })))),
            h("button", { class: "btn sm", type: "button", disabled: (lock || !c.sp || pts >= 10) || null, "aria-label": "Cộng điểm cho " + k.n, onclick: async () => {
              const r = await call("g_skill_up", { p_skill: i }).catch(() => null);
              if (!r) return; S = r; box.replaceChildren(draw());
              if (S.battle) { /* đang trong trận: cập nhật sau */ } else { const m = root.querySelector(".gm-me"); if (m && !m.classList.contains("compact")) m.replaceWith(mePanel()); }
            } }, "+1"));
        })),
        h("div", { class: "acts" }, h("button", { class: "btn", type: "button", onclick: () => close() }, "Xong")));
    };
    const box = h("div", {}, draw());
    close = KT.modal(box, { wide: true });
  }

  /* ---------- túi đồ ---------- */
  function bagModal(inBattle, after) {
    let close;
    const c = S.char;
    const canUse = (k) => {
      if (k === "lens" || k === "charm") return null;
      if (k === "shield") return inBattle && !S.battle.shield ? "Dựng khiên" : null;
      if (k === "candy") return inBattle ? null : "Cho ăn";
      if (k === "potion" || k === "elixir") return c.hp < c.maxhp ? "Uống" : null;
      return "Dùng";
    };
    const rows = Object.keys(D.items).map((k) => {
      const n = S.items[k] || 0, act = n ? canUse(k) : null;
      return h("li", { class: n ? "" : "none" }, icon(k), h("div", {}, h("b", {}, D.items[k].n + " ×" + n), h("p", {}, D.items[k].d + (k === "potion" || k === "elixir" ? (inBattle ? " Trong trận sẽ mất lượt." : "") : ""))),
        act ? h("button", { class: "btn sm", type: "button", onclick: async () => {
          const r = await call("g_use", { p_item: k }).catch(() => null);
          if (!r) return;
          close();
          if (inBattle && after) return after(r);
          S = r.state;
          if (k === "candy") { KT.toast(S.char.nick + " ăn kẹo, nhận 120 KN.", "ok"); if (r.lv_from && S.char.level > r.lv_from) setTimeout(() => celebrate({ state: S, lv_from: r.lv_from, sp_gain: S.char.level - r.lv_from }), 300); }
          else if (r.heal) KT.toast("Hồi " + r.heal + " máu.", "ok");
          else if (k === "seed") KT.toast("Nhận thêm 1 điểm chiêu thức.", "ok");
          route();
        } }, act) : null);
    });
    close = KT.modal(h("div", { class: "gm-bag" }, h("h3", {}, "Túi đồ"), h("ul", {}, rows),
      h("p", { class: "gm-small" }, "Vật phẩm rơi khi em làm đúng câu Khó (15%) hoặc Rất khó (40%), khi thắng trận, và chắc chắn có đồ hiếm khi hạ trùm."),
      h("div", { class: "acts" }, h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Đóng"))), { wide: true });
  }

  /* ---------- luật chơi ---------- */
  function rulesModal() {
    const li = (t, d) => h("li", {}, h("b", {}, t), " ", d);
    KT.modal(h("div", { class: "gm-rules" }, h("h3", {}, "Luật chơi Hành trình Linh Thú"),
      h("ul", {},
        li("Linh thú.", "Có 20 con thuộc 5 hệ. Hệ Số khắc Hình, Hình khắc Hàm, Hàm khắc Lượng giác, Lượng giác khắc Xác suất, Xác suất khắc Số. Đánh hệ mình khắc thì thêm 50% sát thương."),
        li("Bản đồ.", "Mỗi khu vực là một chương Toán 10, 11, 12. Câu hỏi lấy đúng chương đó. Em đi tới khu nào cũng được."),
        li("Kinh nghiệm.", "Câu đúng: Dễ +10, Vừa +20, Khó +40, Rất khó +80 KN. Câu đúng sai đúng một phần thì nhận một phần. Mỗi cấp nhận 1 điểm chiêu (cấp 5, 10, 15… nhận 2)."),
        li("Chiêu thức.", "Mỗi linh thú có 4 chiêu, mở ở cấp 1, 3, 7, 12. Cộng điểm để chiêu mạnh hơn, tối đa 10 điểm. Chiêu tối thượng chỉ dùng với câu Khó hoặc Rất khó."),
        li("Trận đấu.", "Mỗi lượt em chọn chiêu và độ khó rồi giải một câu. Đúng thì trúng, câu càng khó càng mạnh. Sau đó đối thủ đánh lại. Thắng nhận thêm kinh nghiệm và có thể rơi vật phẩm."),
        li("Máu.", "Cần ít nhất 25% máu mới vào trận. Máu tự hồi 1% mỗi phút khi nghỉ, 5% mỗi câu luyện tập đúng, hoặc dùng bình máu."),
        li("Gục ngã.", "Thua trận thì linh thú gục và mất 20% kinh nghiệm của cấp hiện tại (không tụt cấp). Có Bùa hồi sinh thì không mất gì."),
        li("Trùm khu vực.", "Mỗi câu đúng giúp khám phá khu vực. Đủ 100% thì trùm xuất hiện. Hạ trùm chắc chắn nhận đồ hiếm và khu vực được gắn sao."),
        li("Nuôi bằng việc học.", "Mỗi bài kiểm tra, bài tự luyện, lần ôn sổ câu sai, nhiệm vụ hôm nay và video bài học trên web đều cho linh thú kinh nghiệm. Bài thầy cô giao được gấp rưỡi."),
        li("Tâm trạng.", "Ngày nào em học, linh thú vui vẻ. Một, hai ngày không học, nó buồn ngủ. Lâu hơn nữa, nó đói bụng và chờ em quay lại."),
        li("Tiến hoá.", "Đạt cấp 10 tiến hoá lên Trưởng thành, cấp 25 lên Huyền thoại: mạnh thêm 15% mỗi lần và đổi dáng vẻ."),
        li("Phần thưởng.", "Hạ linh thú hoang: kinh nghiệm và đôi khi vật phẩm thường. Hạ trùm: gấp ba kinh nghiệm, chắc chắn có đồ hiếm và sao khu vực. Thắng linh thú của bạn khác (giai đoạn 2): điểm đấu trường, huy hiệu đấu sĩ và lấy một vật phẩm thường của bạn thua."),
        li("Công bằng.", "Đáp án, sát thương và vật phẩm đều do máy chủ tính. Câu đang làm dở không đổi được bằng cách tải lại trang.")),
      h("p", { class: "gm-small" }, "Giai đoạn 2: các bạn thấy linh thú của nhau trên bản đồ và thách đấu nhau.")), { wide: true });
  }

  /* ---------- chuồng linh thú trong khung hồ sơ (trang chủ) ---------- */
  const LINES = {
    happy: ["Hôm nay học vui quá!", "Mình mạnh lên nhờ em đó!", "Đi phiêu lưu không?", "Câu Vận dụng nhiều KN lắm!", "Em giỏi ghê!"],
    sleepy: ["Oáp… em làm bài để mình tỉnh nhé", "Mình hơi buồn ngủ…", "Học một chút rồi chơi nha"],
    hungry: ["Mình đói quá… làm một bài tự luyện nhé!", "Lâu rồi không thấy em học…", "Một video bài học thôi cũng được!"],
  };
  const EGG = '<svg viewBox="0 0 60 74" aria-hidden="true"><ellipse cx="30" cy="70" rx="18" ry="3" fill="#000" opacity=".15"/><path d="M30 4 C46 4 56 28 56 44 C56 60 44 70 30 70 C16 70 4 60 4 44 C4 28 14 4 30 4Z" fill="#fff6dd" stroke="#c9a96a" stroke-width="2.4"/><path d="M10 40 l8 -6 l7 6 l7 -6 l7 6 l7 -6 l6 5" fill="none" stroke="#7a5cff" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="24" r="3" fill="#ffd23f"/><circle cx="40" cy="54" r="4" fill="#ff5a8a"/><circle cx="38" cy="20" r="2.4" fill="#2f8cff"/></svg>';
  function pet(el, c) {
    el.className = "pet";
    c.rpc("g_state").then((st) => drawPet(el, st, c)).catch(() => el.remove());
  }
  function drawPet(el, st, c) {
    el.innerHTML = "";
    const hr = new Date().getHours(), night = hr >= 18 || hr < 6;
    const scene = h("div", { class: "pet-scene" + (night ? " night" : "") },
      h("i", { class: "pet-sun", "aria-hidden": "true" }), h("i", { class: "pet-bush", style: "left:8%", "aria-hidden": "true" }), h("i", { class: "pet-bush", style: "right:10%;transform:scale(.8)", "aria-hidden": "true" }));
    el.append(scene);
    if (!st.char) {
      scene.append(h("div", { class: "pet-egg", html: EGG }));
      scene.addEventListener("click", () => c.go("game"));
      el.append(h("div", { class: "pet-info" }, h("b", {}, "Một quả trứng linh thú đang chờ em"),
        h("p", {}, "Chọn một linh thú để nuôi. Mỗi bài em làm, mỗi video em xem đều giúp nó lớn lên."),
        h("button", { class: "btn sm", type: "button", onclick: () => c.go("game") }, "Nhận nuôi linh thú")));
      return;
    }
    const ch = st.char, sp = SP[ch.species], mood = ch.mood || "happy";
    const monEl = h("div", { class: "mon live" + (mood === "sleepy" ? " sleep" : ""), html: KT.monArt(ch.species, { stage: ch.stage }) });
    const petEl = h("div", { class: "pet-mon" }, monEl);
    if (mood === "sleepy") petEl.append(h("span", { class: "pet-z", "aria-hidden": "true" }, "z"));
    scene.append(petEl);
    scene.setAttribute("role", "button"); scene.setAttribute("tabindex", "0");
    scene.setAttribute("aria-label", "Chơi với " + ch.nick);
    el.append(h("div", { class: "pet-info" },
      h("div", { class: "pet-top" }, h("b", {}, ch.nick), h("span", { class: "pet-lv" }, "Cấp " + ch.level), h("span", { class: "pet-mood" }, MOOD[mood][1] + " " + MOOD[mood][0])),
      h("div", { class: "gbar xp", role: "progressbar", "aria-label": "Kinh nghiệm linh thú", "aria-valuenow": String(ch.xp), "aria-valuemax": String(ch.need) }, h("i", { style: "width:" + pct(ch.xp, ch.need) + "%" })),
      h("p", {}, ch.can_evolve ? ch.nick + " đã đủ cấp tiến hoá!" : st.fed_today ? "Hôm nay nhận +" + st.fed_today + " KN từ việc học của em." : mood === "happy" ? sp.name + ", " + STAGE[ch.stage] + ". Làm bài để " + ch.nick + " lớn nhanh hơn." : LINES[mood][0]),
      h("button", { class: "btn sm" + (ch.can_evolve ? " acc" : " ghost"), type: "button", onclick: () => c.go("game") }, ch.can_evolve ? "Tiến hoá ngay" : "Vào phiêu lưu")));
    let sayT = null;
    const say = (t, ms) => { petEl.querySelectorAll(".pet-say").forEach((x) => x.remove()); clearTimeout(sayT); const b = h("span", { class: "pet-say" }, t); petEl.append(b); sayT = setTimeout(() => b.remove(), ms || 2600); };
    const hop = () => { monEl.classList.remove("hop"); void monEl.offsetWidth; monEl.classList.add("hop"); setTimeout(() => monEl.classList.remove("hop"), 700); };
    const hearts = () => { for (let i = 0; i < 3; i++) { const hh = h("span", { class: "pet-heart", style: "left:" + (petEl.offsetLeft + 20 + Math.random() * 46) + "px;bottom:" + (70 + Math.random() * 20) + "px;animation-delay:" + i * 0.15 + "s", "aria-hidden": "true" }, "💜"); scene.append(hh); setTimeout(() => hh.remove(), 1600); } };
    const play = () => {
      monEl.classList.remove("sleep"); monEl.classList.add("joy"); hearts(); hop();
      say(LINES[mood][Math.floor(Math.random() * LINES[mood].length)]);
      setTimeout(() => { monEl.classList.remove("joy"); if (mood === "sleepy") monEl.classList.add("sleep"); }, 1400);
    };
    scene.addEventListener("click", play);
    scene.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } });
    // báo phần ăn mới từ việc học
    const key = "kt_feed_" + ch.id;
    let seen = 0; try { seen = +localStorage.getItem(key) || 0; } catch (e) { }
    const fresh = (st.feed || []).filter((f) => f.id > seen);
    if (fresh.length) {
      const sum = fresh.reduce((a, f) => a + f.xp, 0);
      setTimeout(() => { if (!el.isConnected) return; monEl.classList.add("joy"); hop(); hearts(); say("+" + sum + " KN nhờ " + (FEED_SRC[fresh[0].src] || "việc học").toLowerCase() + "!", 3600); setTimeout(() => monEl.classList.remove("joy"), 1500); }, 900);
      try { localStorage.setItem(key, String(fresh[0].id)); } catch (e) { }
    }
    if (RM()) return;
    // đi dạo trong chuồng
    let x = null;
    const tick = () => {
      if (!el.isConnected) return;
      if (document.hidden) { setTimeout(tick, 2500); return; }
      const W = scene.clientWidth - petEl.offsetWidth;
      if (x == null) { x = W * 0.4; petEl.style.left = x + "px"; }
      const r = Math.random();
      let next = 1800 + Math.random() * 2200;
      if (mood === "sleepy" && r < 0.7) next = 4000;
      else if (r < 0.55) {
        const nx = Math.max(4, Math.min(W - 4, Math.random() * W));
        const dur = Math.max(0.6, Math.abs(nx - x) / 45);
        petEl.style.setProperty("--wt", dur.toFixed(2) + "s");
        petEl.classList.add("walk"); petEl.style.left = nx + "px"; x = nx;
        setTimeout(() => petEl.classList.remove("walk"), dur * 1000);
        next += dur * 1000;
      } else if (r < 0.72) hop();
      else if (r < 0.8 && mood !== "sleepy") say(LINES[mood][Math.floor(Math.random() * LINES[mood].length)]);
      setTimeout(tick, next);
    };
    setTimeout(tick, 600);
  }

  KT.game = {
    mount(el, c) { ctx = c; root = el; load(); },
    pet,
  };
})();
