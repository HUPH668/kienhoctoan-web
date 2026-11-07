/* Máy tính cầm tay Kiến Học: giả lập máy tính khoa học kiểu fx-580VN X (hiển thị tự nhiên).
   Phần 1: biểu thức dạng cây + tính toán + hiển thị kết quả chính xác. Phần 2: giao diện. */
(function (root) {
  "use strict";

  /* ================= PHẦN 1: LÕI TOÁN ================= */
  const TPL = {            // các khuôn (template) hiển thị tự nhiên: danh sách ô theo thứ tự trái → phải, ô bắt đầu
    frac: { keys: ["a", "b"], first: "a" },
    mixed: { keys: ["w", "a", "b"], first: "w" },     // hỗn số: phần nguyên, tử, mẫu
    sqrt: { keys: ["a"], first: "a" },
    root: { keys: ["n", "a"], first: "n" },
    pow: { keys: ["a"], first: "a" },
    logb: { keys: ["n", "a"], first: "n" },
    abs: { keys: ["a"], first: "a" },
    dx: { keys: ["a", "x"], first: "a" },
    int: { keys: ["a", "lo", "hi"], first: "a" },     // thứ tự di chuyển như máy thật: biểu thức → cận dưới → cận trên
    sum: { keys: ["a", "lo", "hi"], first: "a" },
    prod: { keys: ["a", "lo", "hi"], first: "a" },
  };
  const isT = (it) => it && typeof it === "object";
  const mk = (t, o) => { const n = { t }; TPL[t].keys.forEach((k) => (n[k] = (o && o[k]) || [])); return n; };
  const chars = (s) => Array.from(s);
  const clone = (a) => JSON.parse(JSON.stringify(a));

  const FN = {             // kí hiệu hàm trên màn hình → tên trong bộ tính
    "sin(": "sin", "cos(": "cos", "tan(": "tan", "sin⁻¹(": "asin", "cos⁻¹(": "acos", "tan⁻¹(": "atan",
    "log(": "log", "ln(": "ln", "GCD(": "gcd", "LCM(": "lcm", "Int(": "int", "Intg(": "intg", "Rnd(": "rnd",
    "RanInt#(": "ranint", "Abs(": "abs", "Pol(": "pol", "Rec(": "rec",
    "sinh(": "sinh", "cosh(": "cosh", "tanh(": "tanh", "sinh⁻¹(": "asinh", "cosh⁻¹(": "acosh", "tanh⁻¹(": "atanh",
  };
  const VARS = ["A", "B", "C", "D", "E", "F", "M", "x", "y", "z"];
  const err = (k, msg) => { const e = new Error(msg || k); e.calc = k; return e; };

  // ---- tách từ (token) từ cây ----
  function lex(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      if (isT(it)) {
        if (it.t === "pow") out.push({ k: "pow", e: parse(it.a) });
        else out.push({ k: "atom", n: tplAst(it) });
        continue;
      }
      if (/^[0-9.]$/.test(it)) {
        let s = it;
        while (i + 1 < arr.length && !isT(arr[i + 1]) && /^[0-9.]$/.test(arr[i + 1])) s += arr[++i];
        if ((s.match(/\./g) || []).length > 1 || s === ".") throw err("Syntax");
        out.push({ k: "num", v: parseFloat(s), dot: s.includes(".") });
        continue;
      }
      if (FN[it]) { out.push({ k: "fn", n: FN[it] }); continue; }
      switch (it) {
        case "+": out.push({ k: "op", v: "+" }); break;
        case "−": out.push({ k: "op", v: "-" }); break;
        case "×": out.push({ k: "op", v: "*" }); break;
        case "÷": out.push({ k: "op", v: "/" }); break;
        case "(": out.push({ k: "lp" }); break;
        case ")": out.push({ k: "rp" }); break;
        case ",": out.push({ k: "comma" }); break;
        case "!": out.push({ k: "fact" }); break;
        case "°": out.push({ k: "dms" }); break;
        case "÷R": throw err("Syntax");      // phép chia có dư chỉ đứng một mình (xử lí ở giao diện)
        case "%": out.push({ k: "pct" }); break;
        case "P": out.push({ k: "perm", v: "P" }); break;
        case "C": out.push({ k: "perm", v: "C" }); break;
        case "×10": out.push({ k: "x10" }); break;
        case "=": out.push({ k: "eq" }); break;
        case "π": out.push({ k: "num", v: Math.PI, sym: "pi" }); break;
        case "e": out.push({ k: "num", v: Math.E, sym: "e" }); break;
        case "Ans": out.push({ k: "var", n: "Ans" }); break;
        case "PreAns": out.push({ k: "var", n: "PreAns" }); break;
        case "Ran#": out.push({ k: "ran" }); break;
        default:
          if (VARS.includes(it)) out.push({ k: "var", n: it });
          else throw err("Syntax");
      }
    }
    // gộp số độ phút giây: 12°30°15° = 12 + 30/60 + 15/3600
    const res = [];
    for (let j = 0; j < out.length; j++) {
      const t = out[j];
      if (t.k === "num" && out[j + 1] && out[j + 1].k === "dms") {
        let v = t.v, sc = 1; j++;
        while (sc < 3600 && out[j + 1] && out[j + 1].k === "num" && out[j + 2] && out[j + 2].k === "dms") { sc *= 60; v += out[j + 1].v / sc; j += 2; }
        res.push({ k: "num", v, dot: true }); continue;
      }
      if (t.k === "dms") throw err("Syntax");
      res.push(t);
    }
    return res;
  }
  function tplAst(n) {
    switch (n.t) {
      case "frac": return { t: "bin", op: "/", a: parse(n.a), b: parse(n.b) };
      case "mixed": { const w = parse(n.w), fr = { t: "bin", op: "/", a: parse(n.a), b: parse(n.b) }; return { t: "mixed", w, fr }; }
      case "sqrt": return { t: "fn", n: "sqrt", args: [parse(n.a)] };
      case "root": return { t: "fn", n: "root", args: [parse(n.n), parse(n.a)] };
      case "logb": return { t: "fn", n: "logb", args: [parse(n.n), parse(n.a)] };
      case "abs": return { t: "fn", n: "abs", args: [parse(n.a)] };
      case "dx": return { t: "dx", f: parse(n.a), at: parse(n.x) };
      case "int": return { t: "int", f: parse(n.a), lo: parse(n.lo), hi: parse(n.hi) };
      case "sum": case "prod": return { t: n.t, f: parse(n.a), lo: parse(n.lo), hi: parse(n.hi) };
    }
    throw err("Syntax");
  }
  // ---- phân tích cú pháp (thứ tự ưu tiên giống máy Casio: nhân ngầm định ưu tiên hơn × ÷) ----
  function parse(arr, allowEq) {
    const tk = lex(arr); let p = 0;
    if (!tk.length) throw err("Syntax");
    const peek = () => tk[p], next = () => tk[p++];
    const startsPrimary = (t) => t && ["num", "var", "fn", "lp", "atom", "ran"].includes(t.k);
    function expr() {
      let a = mul();
      while (peek() && peek().k === "op" && (peek().v === "+" || peek().v === "-")) { const o = next().v; a = { t: "bin", op: o, a, b: mul() }; }
      return a;
    }
    function mul() {
      let a = perm();
      while (peek() && peek().k === "op" && (peek().v === "*" || peek().v === "/")) { const o = next().v; a = { t: "bin", op: o, a, b: perm() }; }
      return a;
    }
    function perm() {
      let a = unary();
      while (peek() && peek().k === "perm") { const o = next().v; a = { t: "perm", op: o, a, b: unary() }; }
      return a;
    }
    function unary() {
      const t = peek();
      if (t && t.k === "op" && t.v === "-") { next(); return { t: "neg", a: unary() }; }
      if (t && t.k === "op" && t.v === "+") { next(); return unary(); }
      return implicit();
    }
    function implicit() {
      let a = postfix();
      while (startsPrimary(peek())) a = { t: "bin", op: "*", a, b: postfix() };
      return a;
    }
    function postfix() {
      let a = primary();
      for (;;) {
        const t = peek();
        if (!t) break;
        if (t.k === "pow") { next(); a = { t: "pow", a, b: t.e }; }
        else if (t.k === "fact") { next(); a = { t: "fact", a }; }
        else if (t.k === "pct") { next(); a = { t: "bin", op: "/", a, b: { t: "num", v: 100 } }; }
        else if (t.k === "x10") {
          next(); const e = peek();
          if (e && e.k === "pow") { next(); a = { t: "bin", op: "*", a, b: { t: "pow", a: { t: "num", v: 10 }, b: e.e } }; }
          else a = { t: "bin", op: "*", a, b: { t: "num", v: 10 } };
        } else break;
      }
      return a;
    }
    function primary() {
      const t = next();
      if (!t) throw err("Syntax");
      switch (t.k) {
        case "num": return { t: "num", v: t.v, dot: t.dot };
        case "var": return { t: "var", n: t.n };
        case "atom": return t.n;
        case "ran": return { t: "fn", n: "ran", args: [] };
        case "lp": { const e = expr(); if (peek() && peek().k === "rp") next(); else if (peek()) throw err("Syntax"); return e; }
        case "fn": {
          const args = [expr()];
          while (peek() && peek().k === "comma") { next(); args.push(expr()); }
          if (peek() && peek().k === "rp") next(); else if (peek()) throw err("Syntax");
          return { t: "fn", n: t.n, args };
        }
        case "x10": { // ×10^n đứng đầu = 10^n
          const e = peek(); if (e && e.k === "pow") { next(); return { t: "pow", a: { t: "num", v: 10 }, b: e.e }; } return { t: "num", v: 10 };
        }
      }
      throw err("Syntax");
    }
    // phương trình (có dấu =) chỉ dùng cho SOLVE
    let L = expr();
    if (peek() && peek().k === "eq") {
      if (!allowEq) throw err("Syntax");
      next(); const R = expr();
      if (p < tk.length) throw err("Syntax");
      return { t: "eq", a: L, b: R };
    }
    if (p < tk.length) throw err("Syntax");
    return L;
  }
  const hasDot = (n) => !!n && typeof n === "object" && (n.dot || Object.values(n).some((v) => (Array.isArray(v) ? v.some(hasDot) : typeof v === "object" && hasDot(v))));
  const varsIn = (n, set = []) => {
    if (!n || typeof n !== "object") return set;
    if (n.t === "var" && VARS.includes(n.n) && !set.includes(n.n)) set.push(n.n);
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => varsIn(x, set)); else if (v && typeof v === "object") varsIn(v, set); }
    return set;
  };

  // ---- tính giá trị ----
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9 * Math.max(1, Math.abs(v));
  const snap = (v) => (Math.abs(v) < 1e-13 ? 0 : v);
  function fact(n) { if (n < 0 || !isInt(n) || n > 69) throw err("Math"); n = Math.round(n); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
  function evaluate(n, env) {
    const deg = env.ang === "D";
    const toR = (v) => (deg ? v * Math.PI / 180 : v), fromR = (v) => (deg ? v * 180 / Math.PI : v);
    const ev = (m, scope) => {
      switch (m.t) {
        case "num": return m.v;
        case "var": {
          if (scope && m.n in scope) return scope[m.n];
          const v = m.n === "Ans" ? env.ans : m.n === "PreAns" ? env.preAns : env.vars[m.n];
          return v == null ? 0 : v;
        }
        case "neg": return -ev(m.a, scope);
        case "mixed": { const w = ev(m.w, scope), q = ev(m.fr, scope); return w < 0 ? w - q : w + q; }
        case "bin": {
          const a = ev(m.a, scope), b = ev(m.b, scope);
          if (m.op === "+") return a + b; if (m.op === "-") return a - b; if (m.op === "*") return a * b;
          if (b === 0) throw err("Math"); return a / b;
        }
        case "pow": {
          const a = ev(m.a, scope), b = ev(m.b, scope);
          if (a < 0 && !isInt(b)) { // căn bậc lẻ của số âm: (-8)^(1/3) = -2
            const inv = 1 / b;
            if (isInt(inv) && Math.round(inv) % 2) return -Math.pow(-a, b);
            throw err("Math");
          }
          if (a === 0 && b < 0) throw err("Math");
          return Math.pow(a, b);
        }
        case "fact": return fact(ev(m.a, scope));
        case "perm": {
          const a = ev(m.a, scope), b = ev(m.b, scope);
          if (!isInt(a) || !isInt(b) || a < 0 || b < 0 || b > a) throw err("Math");
          let r = 1; const N = Math.round(a), K = Math.round(b);
          if (m.op === "P") { for (let i = 0; i < K; i++) r *= N - i; return r; }
          const k = Math.min(K, N - K); for (let i = 1; i <= k; i++) r = r * (N - k + i) / i; return Math.round(r);
        }
        case "fn": return fnv(m.n, m.args.map((x) => ev(x, scope)));
        case "dx": {
          const x0 = ev(m.at, scope), f = (x) => ev(m.f, Object.assign({}, scope, { x }));
          return diff(f, x0);
        }
        case "int": {
          const lo = ev(m.lo, scope), hi = ev(m.hi, scope), f = (x) => ev(m.f, Object.assign({}, scope, { x }));
          return integrate(f, lo, hi);
        }
        case "sum": case "prod": {
          const lo = ev(m.lo, scope), hi = ev(m.hi, scope);
          if (!isInt(lo) || !isInt(hi) || hi < lo) throw err("Math");
          if (hi - lo > 1e6) throw err("Math", "Quá nhiều số hạng");
          let r = m.t === "sum" ? 0 : 1;
          for (let x = Math.round(lo); x <= Math.round(hi); x++) { const v = ev(m.f, Object.assign({}, scope, { x })); r = m.t === "sum" ? r + v : r * v; }
          return r;
        }
        case "eq": return ev(m.a, scope) - ev(m.b, scope);
      }
      throw err("Syntax");
    };
    const trig = (f, v) => {
      if (deg) {
        let d = v % 360; if (d < 0) d += 360;
        if (f === "tan" && Math.abs((d % 180) - 90) < 1e-10) throw err("Math");
        const exact = { 0: [0, 1], 30: [0.5, Math.sqrt(3) / 2], 90: [1, 0], 150: [0.5, -Math.sqrt(3) / 2], 180: [0, -1], 210: [-0.5, -Math.sqrt(3) / 2], 270: [-1, 0], 330: [-0.5, Math.sqrt(3) / 2], 360: [0, 1] };
        const ex = exact[Math.round(d * 1e9) / 1e9];
        if (ex) { if (f === "sin") return ex[0]; if (f === "cos") return ex[1]; return ex[1] === 0 ? (() => { throw err("Math"); })() : ex[0] / ex[1]; }
        const r = d * Math.PI / 180;
        return snap(f === "sin" ? Math.sin(r) : f === "cos" ? Math.cos(r) : Math.tan(r));
      }
      if (f === "tan" && Math.abs(Math.cos(v)) < 1e-15) throw err("Math");
      return snap(f === "sin" ? Math.sin(v) : f === "cos" ? Math.cos(v) : Math.tan(v));
    };
    const fnv = (f, a) => {
      const x = a[0];
      const need = (k) => { if (a.length !== k) throw err("Syntax"); };
      switch (f) {
        case "sin": case "cos": case "tan": need(1); return trig(f, x);
        case "asin": need(1); if (Math.abs(x) > 1) throw err("Math"); return fromR(Math.asin(x));
        case "acos": need(1); if (Math.abs(x) > 1) throw err("Math"); return fromR(Math.acos(x));
        case "atan": need(1); return fromR(Math.atan(x));
        case "log":
          if (a.length === 2) { if (x <= 0 || x === 1 || a[1] <= 0) throw err("Math"); return Math.log(a[1]) / Math.log(x); }
          need(1); if (x <= 0) throw err("Math"); { const l = Math.log10(x); return isInt(l) ? Math.round(l) : l; }
        case "logb": if (x <= 0 || x === 1 || a[1] <= 0) throw err("Math"); { const r = Math.log(a[1]) / Math.log(x); return isInt(r) ? Math.round(r) : r; }
        case "ln": need(1); if (x <= 0) throw err("Math"); return Math.log(x);
        case "sqrt": if (x < 0) throw err("Math"); return Math.sqrt(x);
        case "root": {
          const n = x, v = a[1];
          if (n === 0) throw err("Math");
          if (v < 0) { if (isInt(n) && Math.round(n) % 2) return -Math.pow(-v, 1 / n); throw err("Math"); }
          const r = Math.pow(v, 1 / n), rr = Math.round(r); return Math.abs(Math.pow(rr, n) - v) < 1e-9 * Math.max(1, v) ? rr : r;
        }
        case "abs": need(1); return Math.abs(x);
        case "gcd": case "lcm":
          if (a.length < 2 || a.some((v) => !isInt(v))) throw err("Math");
          return a.map(Math.round).reduce((p, q) => (f === "gcd" ? gcd2(p, q) : Math.abs(p * q) / (gcd2(p, q) || 1)));
        case "int": need(1); return Math.trunc(x);
        case "intg": need(1); return Math.floor(x);
        case "rnd": need(1); return Number(x.toPrecision(10));
        case "ran": return Math.round(Math.random() * 1000) / 1000;
        case "sinh": need(1); return snap(Math.sinh(x));
        case "cosh": need(1); return Math.cosh(x);
        case "tanh": need(1); return snap(Math.tanh(x));
        case "asinh": need(1); return Math.asinh(x);
        case "acosh": need(1); if (x < 1) throw err("Math"); return Math.acosh(x);
        case "atanh": need(1); if (Math.abs(x) >= 1) throw err("Math"); return Math.atanh(x);
        case "pol": { need(2); const r = Math.hypot(x, a[1]); if (r === 0) throw err("Math"); const th = fromR(Math.atan2(a[1], x)); env.pair = [["r", r], ["θ", snap(th)]]; return r; }
        case "rec": { need(2); const t = toR(a[1]), X = snap(+(x * Math.cos(t)).toPrecision(13)), Y = snap(+(x * Math.sin(t)).toPrecision(13)); env.pair = [["x", X], ["y", Y]]; return X; }
        case "ranint": need(2); if (!isInt(x) || !isInt(a[1]) || a[1] < x) throw err("Math"); return Math.round(x) + Math.floor(Math.random() * (Math.round(a[1]) - Math.round(x) + 1));
      }
      throw err("Syntax");
    };
    const r = ev(n, null);
    if (!isFinite(r) || isNaN(r)) throw err("Math");
    if (Math.abs(r) >= 1e100) throw err("Math");
    return r;
  }
  // đạo hàm tại một điểm: sai phân trung tâm + ngoại suy Richardson
  function diff(f, x) {
    let h = 1e-2 * Math.max(1, Math.abs(x));
    const D = [];
    for (let i = 0; i < 5; i++) { D.push([(f(x + h) - f(x - h)) / (2 * h)]); h /= 2; }
    for (let j = 1; j < 5; j++) for (let i = j; i < 5; i++) D[i][j] = D[i][j - 1] + (D[i][j - 1] - D[i - 1][j - 1]) / (Math.pow(4, j) - 1);
    const v = D[4][4];
    if (!isFinite(v)) throw err("Math");
    const r = Math.round(v * 1e8) / 1e8; return Math.abs(v - r) < 1e-7 ? r : v;
  }
  // tích phân: Gauss–Kronrod 7-15 thích nghi
  const XK = [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440, 0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0];
  const WK = [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919, 0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828];
  const WG = [0.129484966168869693, 0.279705391489276668, 0.381830050505118945, 0.417959183673469388];
  function integrate(f, a, b) {
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a);
    let evals = 0;
    const gk = (lo, hi) => {
      const c = (lo + hi) / 2, hl = (hi - lo) / 2;
      const fc = f(c); let K = WK[7] * fc, G = WG[3] * fc;
      for (let i = 0; i < 7; i++) {
        const dx = hl * XK[i], s = f(c - dx) + f(c + dx);
        K += WK[i] * s; if (i % 2 === 1) G += WG[(i - 1) / 2] * s;
      }
      evals += 15; return [K * hl, Math.abs((K - G) * hl)];
    };
    const rec = (lo, hi, tol, depth) => {
      const [K, E] = gk(lo, hi);
      if (E <= tol || depth > 40 || evals > 200000) return K;
      const m = (lo + hi) / 2; return rec(lo, m, tol / 2, depth + 1) + rec(m, hi, tol / 2, depth + 1);
    };
    const r = rec(a, b, 1e-11 * Math.max(1, Math.abs(b - a)), 0);
    if (!isFinite(r)) throw err("Math");
    return r;
  }
  // SOLVE: tìm nghiệm f(x)=0 gần x0
  function solve(f, x0) {
    const ok = (x) => { try { const v = f(x); return isFinite(v) ? v : NaN; } catch (e) { return NaN; } };
    const newton = (x) => {
      for (let i = 0; i < 100; i++) {
        const fx = ok(x); if (isNaN(fx)) return null;
        if (Math.abs(fx) < 1e-14) return x;
        const h = 1e-7 * Math.max(1, Math.abs(x)), d = (ok(x + h) - ok(x - h)) / (2 * h);
        if (!isFinite(d) || d === 0) return null;
        let nx = x - fx / d;
        if (!isFinite(nx)) return null;
        if (Math.abs(nx - x) < 1e-13 * Math.max(1, Math.abs(x))) return nx;
        x = nx;
      }
      return Math.abs(ok(x)) < 1e-9 ? x : null;
    };
    const bisect = (a, b) => {
      let fa = ok(a);
      for (let i = 0; i < 200; i++) { const m = (a + b) / 2, fm = ok(m); if (isNaN(fm)) return null; if (fm === 0 || (b - a) / 2 < 1e-15 * Math.max(1, Math.abs(m))) return m; if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      return (a + b) / 2;
    };
    let r = newton(x0);
    if (r == null) { // quét ra hai phía tìm đổi dấu
      let step = 0.1 * Math.max(1, Math.abs(x0)), prevL = x0, prevR = x0, fL = ok(x0), fR = fL;
      for (let i = 0; i < 400 && r == null; i++) {
        const R = prevR + step, L = prevL - step, fr = ok(R), fl = ok(L);
        if (!isNaN(fr) && !isNaN(fR) && Math.sign(fr) !== Math.sign(fR)) r = bisect(prevR, R);
        else if (!isNaN(fl) && !isNaN(fL) && Math.sign(fl) !== Math.sign(fL)) r = bisect(L, prevL);
        prevR = R; prevL = L; fR = fr; fL = fl; step *= 1.08;
      }
      if (r != null) r = newton(r) ?? r;
    }
    if (r == null || isNaN(ok(r)) || Math.abs(ok(r)) > 1e-6) throw err("Solve");
    if (isInt(r) && Math.abs(r - Math.round(r)) < 1e-10) r = Math.round(r);
    return r;
  }

  // ---- đa thức: nghiệm phức (Durand–Kerner) ----
  const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, abs: (a) => Math.hypot(a[0], a[1]) };
  const peval = (cf, z) => cf.reduce((acc, c) => C.add(C.mul(acc, z), [c, 0]), [0, 0]);
  function polyRoots(cf) {           // cf: hệ số từ bậc cao xuống
    const n = cf.length - 1;
    if (cf[0] === 0) throw err("Math", "Hệ số bậc cao nhất phải khác 0");
    const m = cf.map((c) => c / cf[0]);
    if (n === 1) return [[-m[1], 0]];
    if (n === 2) {
      const b = m[1], c = m[2], D = b * b - 4 * c;
      if (D >= 0) { const s = Math.sqrt(D), q = -(b + (b >= 0 ? s : -s)) / 2; const r1 = q, r2 = q !== 0 ? c / q : 0; return [[Math.min(r1, r2), 0], [Math.max(r1, r2), 0]].map((z) => [snap(z[0]), 0]); }
      return [[-b / 2, -Math.sqrt(-D) / 2], [-b / 2, Math.sqrt(-D) / 2]];
    }
    const R = 1 + Math.max(...m.slice(1).map(Math.abs));
    let z = Array.from({ length: n }, (_, k) => { const t = 2 * Math.PI * k / n + 0.4; return [R * 0.9 * Math.cos(t), R * 0.9 * Math.sin(t)]; });
    for (let it = 0; it < 2000; it++) {
      let mx = 0;
      z = z.map((zi, i) => {
        let den = [1, 0]; z.forEach((zj, j) => { if (i !== j) den = C.mul(den, C.sub(zi, zj)); });
        const d = C.div(peval(m, zi), den); mx = Math.max(mx, C.abs(d)); return C.sub(zi, d);
      });
      if (mx < 1e-15) break;
    }
    // gộp nghiệm bội, làm tròn phần ảo nhỏ, đánh bóng bằng Newton
    const used = new Array(n).fill(false), out = [];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const grp = [i];
      for (let j = i + 1; j < n; j++) if (!used[j] && C.abs(C.sub(z[i], z[j])) < 1e-3 * Math.max(1, C.abs(z[i]))) grp.push(j);
      grp.forEach((g) => (used[g] = true));
      let c = grp.reduce((s, g) => C.add(s, z[g]), [0, 0]); c = [c[0] / grp.length, c[1] / grp.length];
      grp.forEach(() => out.push({ r: c.slice(), mult: grp.length }));
    }
    const der = (p) => p.slice(0, -1).map((c, i) => c * (p.length - 1 - i));
    return out.map(({ r, mult }) => {
      let q = m; for (let k = 1; k < mult; k++) q = der(q);   // nghiệm bội m là nghiệm đơn của đạo hàm cấp m−1
      const dm = der(q);
      if (Math.abs(r[1]) < 1e-7 * Math.max(1, Math.abs(r[0]))) r = [r[0], 0];
      for (let k = 0; k < 8; k++) { const d = peval(dm, r); if (C.abs(d) < 1e-12) break; const nr = C.sub(r, C.div(peval(q, r), d)); if (r[1] === 0) nr[1] = 0; if (!isFinite(nr[0])) break; r = nr; }
      if (r[1] === 0) { const q = toFrac(r[0], 1000, 1e-7); if (q && C.abs(peval(m, [q[0] / q[1], 0])) < 1e-12 * Math.max(1, ...m.map(Math.abs))) r = [q[0] / q[1], 0]; }
      return [snap(r[0]), snap(r[1])];
    }).sort((a, b) => (a[1] === 0) !== (b[1] === 0) ? (a[1] === 0 ? -1 : 1) : a[0] - b[0] || a[1] - b[1]);
  }
  // hệ phương trình tuyến tính: khử Gauss
  function linSolve(M) {
    const n = M.length, A = M.map((r) => r.slice());
    const scale = Math.max(1, ...A.flat().map(Math.abs));
    let rank = 0; const piv = [];
    for (let c = 0; c < n && rank < n; c++) {
      let best = rank; for (let r = rank + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[best][c])) best = r;
      if (Math.abs(A[best][c]) < 1e-11 * scale) continue;
      [A[rank], A[best]] = [A[best], A[rank]];
      for (let r = 0; r < n; r++) if (r !== rank) { const f = A[r][c] / A[rank][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[rank][k]; }
      piv.push(c); rank++;
    }
    if (rank < n) {
      for (let r = rank; r < n; r++) if (Math.abs(A[r][n]) > 1e-9 * scale) return { none: true };
      return { many: true };
    }
    return { x: piv.map((c, r) => snap(A[r][n] / A[r][c])) };
  }

  // ---- hiển thị kết quả: số nguyên, phân số, bội của π, dạng căn (d + a√b)/c, thập phân ----
  function toFrac(v, maxQ = 99999, tol = 1e-13) {
    if (!isFinite(v)) return null;
    let x = Math.abs(v), h0 = 1, h1 = 0, k0 = 0, k1 = 1, b = x;
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(b); [h0, h1] = [a * h0 + h1, h0]; [k0, k1] = [a * k0 + k1, k0];
      if (k0 > maxQ) return null;
      if (Math.abs(x - h0 / k0) <= tol * Math.max(1, x)) return (String(h0).length + String(k0).length <= 11) ? [Math.sign(v) * h0, k0] : null;
      const f = b - a; if (f < 1e-15) break; b = 1 / f;
    }
    return null;
  }
  const SQF = (() => { const r = []; for (let n = 2; n < 200; n++) { let ok = true; for (let p = 2; p * p <= n; p++) if (n % (p * p) === 0) { ok = false; break; } if (ok) r.push(n); } return r; })();
  function toRad(v) {
    for (const b of SQF) {
      const sb = Math.sqrt(b);
      for (let c = 1; c <= 60; c++) {
        const t = v * c;
        for (let a = 1; a <= 60; a++) {
          for (const s of [1, -1]) {
            const d = t - s * a * sb, dr = Math.round(d);
            if (Math.abs(dr) > 999 || Math.abs(d - dr) > 2e-10 * Math.max(1, Math.abs(t))) continue;
            const g = gcd2(gcd2(dr, a), c);
            if (g > 1) continue;
            return { d: dr, a: s * a, b, c };
          }
        }
      }
    }
    return null;
  }
  const num = (n) => chars(String(n).replace("-", "−"));
  function decNodes(v) {
    if (v === 0) return ["0"];
    const n = Number(v.toPrecision(10)), a = Math.abs(n);
    if (a >= 1e10 || a < 1e-9) {
      let [m, e] = n.toExponential(9).split("e"); m = m.replace(/\.?0+$/, "");
      return num(m).concat(["×10", mk("pow", { a: num(+e) })]);
    }
    let s = String(n);
    if (/e/.test(s)) s = n.toFixed(12).replace(/\.?0+$/, "");
    return num(s);
  }
  function exactNodes(v, opt = {}) {
    if (Math.abs(v) < 1e-14) return ["0"];
    if (isInt(v) && Math.abs(v) < 1e10 && Math.abs(v - Math.round(v)) < 1e-10) return num(Math.round(v));
    const f = toFrac(v, 1000) || (opt.rad === false || !toRad(v) ? toFrac(v) : null);
    if (f) return f[0] < 0 ? ["−", mk("frac", { a: num(-f[0]), b: num(f[1]) })] : [mk("frac", { a: num(f[0]), b: num(f[1]) })];
    if (opt.pi !== false) {
      const p = toFrac(v / Math.PI, 12);
      if (p && Math.abs(p[0]) <= 99) {
        const top = (Math.abs(p[0]) === 1 ? [] : num(Math.abs(p[0]))).concat(["π"]);
        const body = p[1] === 1 ? top : [mk("frac", { a: top, b: num(p[1]) })];
        return (p[0] < 0 ? ["−"] : []).concat(body);
      }
    }
    if (opt.rad !== false && Math.abs(v) < 1e6) {
      const r = toRad(v);
      if (r) {
        const rad = (Math.abs(r.a) === 1 ? [] : num(Math.abs(r.a))).concat([mk("sqrt", { a: num(r.b) })]);
        let top, neg = false;
        if (r.d === 0) { top = rad; neg = r.a < 0; }
        else top = num(r.d).concat([r.a < 0 ? "−" : "+"], rad);
        const body = r.c === 1 ? top : [mk("frac", { a: top, b: num(r.c) })];
        return (neg ? ["−"] : []).concat(body);
      }
    }
    return decNodes(v);
  }
  const isExactForm = (nodes) => !nodes.some((x) => x === ".") && !nodes.includes("×10");
  function cplxNodes(z, exact) {
    const f = (v) => (exact ? exactNodes(v) : decNodes(v));
    if (z[1] === 0) return f(z[0]);
    const re = z[0] === 0 ? [] : f(z[0]);
    let im = f(Math.abs(z[1]));
    if (im.length === 1 && im[0] === "1") im = [];
    const sign = z[1] < 0 ? ["−"] : re.length ? ["+"] : [];
    const wrap = im.length > 1 && isT(im[im.length - 1]) && im[im.length - 1].t === "frac" ? im : im;
    return re.concat(sign, wrap, ["i"]);
  }
  const fmtPlain = (v) => { const n = Number(v.toPrecision(10)); return String(n).replace("-", "−"); };

  const Core = { parse, evaluate, solve, polyRoots, linSolve, exactNodes, decNodes, cplxNodes, toFrac, toRad, varsIn, hasDot, isExactForm, integrate, diff, mk, chars, TPL, isT, clone, err, VARS, fmtPlain };
  root.KHCalcCore = Core;
  if (typeof module !== "undefined") module.exports = Core;
  if (typeof document === "undefined") return;

  /* ================= PHẦN 2: GIAO DIỆN ================= */
  const $ = (tag, cls, ...kids) => {
    const e = document.createElement(tag); if (cls) e.className = cls;
    kids.flat().forEach((k) => k != null && k !== false && e.append(k)); return e;
  };

  // ---- vẽ biểu thức dạng tự nhiên ----
  const OPS = new Set(["+", "−", "×", "÷", "=", "P", "C", "<", ">", "≤", "≥"]);
  const SVG_RAD = '<svg viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0.5 12 L3 10.5 L5.5 19 L9.6 0.6" fill="none" stroke="currentColor" stroke-width="1.15" vector-effect="non-scaling-stroke"/></svg>';
  function rend(arr, cur, slot) {
    const box = $("span", "m-row" + (slot && !arr.length ? " m-empty" : ""));
    for (let k = 0; k <= arr.length; k++) {
      if (cur && cur.arr === arr && cur.i === k) box.append($("span", "m-cur"));
      if (k < arr.length) {
        const it = arr[k], pv = arr[k - 1];
        const unary = it === "−" && (k === 0 || (typeof pv === "string" && (OPS.has(pv) || /\($/.test(pv) || pv === "," || pv === "[" || pv === "{")));
        box.append(unary ? $("span", "m-c", "−") : rItem(it, cur));
      }
    }
    return box;
  }
  function rItem(it, cur) {
    if (!isT(it)) {
      if (it === "×10") return $("span", "m-c m-x10", "×", $("span", "", "10"));
      const fn = it.length > 1 && /\($/.test(it);
      return $("span", "m-c" + (OPS.has(it) ? " m-op" : "") + (fn ? " m-fnn" : ""), it);
    }
    const S = (k) => rend(it[k], cur, true);
    switch (it.t) {
      case "frac": return $("span", "m-frac", $("span", "m-num", S("a")), $("span", "m-den", S("b")));
      case "mixed": return $("span", "m-grp", S("w"), $("span", "m-frac", $("span", "m-num", S("a")), $("span", "m-den", S("b"))));
      case "sqrt": { const r = $("span", "m-sqrt"); r.innerHTML = SVG_RAD; r.append($("span", "m-rad", S("a"))); return r; }
      case "root": { const r = $("span", "m-sqrt"); r.innerHTML = SVG_RAD; r.append($("span", "m-rad", S("a"))); return $("span", "m-root", $("span", "m-idx", S("n")), r); }
      case "pow": return $("span", "m-sup", S("a"));
      case "logb": return $("span", "m-grp", $("span", "m-c m-fnn", "log"), $("span", "m-sub", S("n")), $("span", "m-c", "("), S("a"), $("span", "m-c", ")"));
      case "abs": return $("span", "m-abs", S("a"));
      case "dx": return $("span", "m-grp", $("span", "m-frac m-dd", $("span", "m-num", "d"), $("span", "m-den", "dx")), $("span", "m-c", "("), S("a"), $("span", "m-c", ")"),
        $("span", "m-at", $("span", "m-sub", "x=", S("x"))));
      case "int": case "sum": case "prod": {
        const sym = it.t === "int" ? "∫" : it.t === "sum" ? "Σ" : "Π";
        return $("span", "m-grp", $("span", "m-big m-" + it.t, $("span", "m-hi", S("hi")), $("span", "m-sym", sym), $("span", "m-lo", it.t === "int" ? null : "x=", S("lo"))),
          it.t === "int" ? null : $("span", "m-c", "("), S("a"), it.t === "int" ? $("span", "m-c m-dxs", "dx") : $("span", "m-c", ")"));
      }
    }
    return $("span", "", "?");
  }

  // ---- bộ soạn biểu thức có con trỏ ----
  class Ed {
    constructor(arr) { this.root = arr || []; this.st = []; this.arr = this.root; this.i = this.root.length; }
    get cur() { return { arr: this.arr, i: this.i }; }
    empty() { return !this.root.length; }
    home() { this.st = []; this.arr = this.root; this.i = 0; }
    end() { this.st = []; this.arr = this.root; this.i = this.root.length; }
    enter(node, key, atEnd) { this.st.push({ pa: this.arr, node, key }); this.arr = node[key]; this.i = atEnd ? this.arr.length : 0; }
    ins(items, enterNode, key) {
      for (const it of items) { this.arr.splice(this.i, 0, it); this.i++; }
      if (enterNode) { this.i = this.arr.indexOf(enterNode); this.enter(enterNode, key || TPL[enterNode.t].first, false); }
    }
    exit(after) { const f = this.st.pop(); this.arr = f.pa; this.i = f.pa.indexOf(f.node) + (after ? 1 : 0); }
    right() {
      if (this.i < this.arr.length) { const it = this.arr[this.i]; if (isT(it)) this.enter(it, TPL[it.t].keys[0], false); else this.i++; return; }
      if (!this.st.length) { this.i = 0; return; }       // về đầu dòng như máy thật
      const f = this.st[this.st.length - 1], ks = TPL[f.node.t].keys, k = ks.indexOf(f.key);
      if (k < ks.length - 1) { this.st.pop(); this.enter(f.node, ks[k + 1], false); this.st[this.st.length - 1].pa = f.pa; }
      else this.exit(true);
    }
    left() {
      if (this.i > 0) { const it = this.arr[this.i - 1]; if (isT(it)) { this.i--; const ks = TPL[it.t].keys; this.enter(it, ks[ks.length - 1], true); } else this.i--; return; }
      if (!this.st.length) { this.i = this.arr.length; return; }
      const f = this.st[this.st.length - 1], ks = TPL[f.node.t].keys, k = ks.indexOf(f.key);
      if (k > 0) { this.st.pop(); this.enter(f.node, ks[k - 1], true); this.st[this.st.length - 1].pa = f.pa; }
      else this.exit(false);
    }
    vert(dir) {
      for (let s = this.st.length - 1; s >= 0; s--) {
        const f = this.st[s], t = f.node.t; let to = null;
        if (t === "frac" || t === "mixed") to = dir < 0 ? (f.key === "b" ? "a" : null) : (f.key === "a" ? "b" : null);
        else if (t === "int" || t === "sum" || t === "prod") to = dir < 0 ? (f.key === "lo" ? "hi" : null) : (f.key === "hi" ? "lo" : null);
        if (to) { this.st.length = s; this.st.push({ pa: f.pa, node: f.node, key: to }); this.arr = f.node[to]; this.i = this.arr.length; return true; }
      }
      return false;
    }
    del() {
      if (this.i > 0) {
        const it = this.arr[this.i - 1];
        if (isT(it)) {
          const ks = TPL[it.t].keys;
          if (ks.every((k) => !it[k].length)) { this.arr.splice(this.i - 1, 1); this.i--; }
          else { this.i--; this.enter(it, ks[ks.length - 1], true); }
        } else { this.arr.splice(this.i - 1, 1); this.i--; }
        return;
      }
      if (!this.st.length) return;
      const f = this.st.pop(), ks = TPL[f.node.t].keys, j = f.pa.indexOf(f.node);
      let off = 0; for (const k of ks) { if (k === f.key) break; off += f.node[k].length; }
      const flat = [].concat(...ks.map((k) => f.node[k]));
      f.pa.splice(j, 1, ...flat); this.arr = f.pa; this.i = j + off;
    }
  }

  // ---- các thao tác chèn của phím ----
  const INS = {
    sin: ["sin("], cos: ["cos("], tan: ["tan("], asin: ["sin⁻¹("], acos: ["cos⁻¹("], atan: ["tan⁻¹("],
    log: ["log("], ln: ["ln("], gcd: ["GCD("], lcm: ["LCM("], intp: ["Int("], intg: ["Intg("], rnd: ["Rnd("], ranint: ["RanInt#("], ran: ["Ran#"],
    add: ["+"], sub: ["−"], mul: ["×"], div: ["÷"], lp: ["("], rp: [")"], comma: [","], neg: ["−"], dot: ["."], fact: ["!"], npr: ["P"], ncr: ["C"], pct: ["%"],
    pi: ["π"], e: ["e"], ans: ["Ans"], preans: ["PreAns"], eqs: ["="], dms: ["°"], divr: ["÷R"], pol: ["Pol("], rec: ["Rec("],
    sinh: ["sinh("], cosh: ["cosh("], tanh: ["tanh("], asinh: ["sinh⁻¹("], acosh: ["cosh⁻¹("], atanh: ["tanh⁻¹("],
  };
  for (let d = 0; d <= 9; d++) INS["d" + d] = [String(d)];
  Core.VARS.forEach((v) => (INS["v" + v] = [v]));
  function insert(ed, a) {
    if (INS[a]) return ed.ins(INS[a].slice());
    const T = (t, o) => mk(t, o);
    let n;
    switch (a) {
      case "frac": n = T("frac"); return ed.ins([n], n);
      case "mixed": n = T("mixed"); return ed.ins([n], n);
      case "sqrt": n = T("sqrt"); return ed.ins([n], n);
      case "cbrt": n = T("root", { n: ["3"] }); return ed.ins([n], n, "a");
      case "nroot": n = T("root"); return ed.ins([n], n);
      case "powx": n = T("pow"); return ed.ins([n], n);
      case "sq": return ed.ins([T("pow", { a: ["2"] })]);
      case "cube": return ed.ins([T("pow", { a: ["3"] })]);
      case "inv": return ed.ins([T("pow", { a: ["−", "1"] })]);
      case "tenx": n = T("pow"); return ed.ins(["1", "0", n], n);
      case "ex": n = T("pow"); return ed.ins(["e", n], n);
      case "x10": n = T("pow"); return ed.ins(["×10", n], n);
      case "logb": n = T("logb"); return ed.ins([n], n);
      case "abs": n = T("abs"); return ed.ins([n], n);
      case "dx": n = T("dx"); return ed.ins([n], n);
      case "int": case "sum": case "prod": n = T(a); return ed.ins([n], n);
    }
  }
  const isIns = (a) => !!INS[a] || ["frac", "mixed", "sqrt", "cbrt", "nroot", "powx", "sq", "cube", "inv", "tenx", "ex", "x10", "logb", "abs", "dx", "int", "sum", "prod"].includes(a);
  const POSTOP = new Set(["add", "sub", "mul", "div", "powx", "sq", "cube", "inv", "fact", "npr", "ncr", "pct", "x10", "divr"]);

  // ---- bàn phím: [chính, SHIFT, ALPHA] ----
  const K = (main, act, sh, shAct, al, alAct, cls, bl) => ({ main, act, sh, shAct, al, alAct, cls: cls || "", bl: bl || "" });
  // hàng trên cùng (hai bên phím di chuyển): OPTN CALC … ∫ x
  const KEYS_L = [K("OPTN", "OPTN"), K("CALC", "CALC", "SOLVE", "SOLVE", "=", "eqs")];
  const KEYS_R = [K("∫▫", "int", "d/dx", "dx", ":", null), K("x", "vx", "Σ▫", "sum", "Π▫", "prod")];
  const KEYS_FN = [
    K("▫⁄▫", "frac", "▫▫⁄▫", "mixed", "÷R", "divr"), K("√▫", "sqrt", "∛▫", "cbrt"), K("x²", "sq", "x³", "cube", "", null, "", "DEC"),
    K("x▫", "powx", "▫√▫", "nroot", "", null, "", "HEX"), K("log▫▫", "logb", "10▫", "tenx", "", null, "", "BIN"), K("ln", "ln", "e▫", "ex", "", null, "", "OCT"),
    K("(−)", "neg", "log", "log", "A", "vA"), K("°'\"", "DMS", "FACT", "FACT", "B", "vB"), K("x⁻¹", "inv", "x!", "fact", "C", "vC"),
    K("sin", "sin", "sin⁻¹", "asin", "D", "vD"), K("cos", "cos", "cos⁻¹", "acos", "E", "vE"), K("tan", "tan", "tan⁻¹", "atan", "F", "vF"),
    K("STO", "STO", "RECALL", "RCL"), K("ENG", "ENG", "←", "ENGB", "i", null), K("(", "lp", "Abs", "abs", "x", "vx"),
    K(")", "rp", ",", "comma", "y", "vy"), K("S⇔D", "SD", "ab/c⇔d/c", "MIXED", "z", "vz"), K("M+", "MPLUS", "M−", "MMINUS", "M", "vM"),
  ];
  const KEYS_NUM = [
    K("7", "d7", "CONST", "CONST"), K("8", "d8", "CONV", "CONV"), K("9", "d9", "RESET", "RESET"), K("DEL", "DEL", "INS", null, "UNDO", "UNDO", "k-del"), K("AC", "AC", "OFF", "OFF", "", null, "k-ac"),
    K("4", "d4"), K("5", "d5"), K("6", "d6"), K("×", "mul", "nPr", "npr", "GCD", "gcd"), K("÷", "div", "nCr", "ncr", "LCM", "lcm"),
    K("1", "d1"), K("2", "d2"), K("3", "d3"), K("+", "add", "Pol", "pol", "Int", "intp"), K("−", "sub", "Rec", "rec", "Intg", "intg"),
    K("0", "d0", "Rnd", "rnd"), K("•", "dot", "Ran#", "ran", "RanInt", "ranint"), K("×10ˣ", "x10", "π", "pi", "e", "e"), K("Ans", "ans", "%", "pct", "PreAns", "preans"), K("=", "EQ", "≈", "APPROX", "", null, "k-eq"),
  ];
  const keyLabel = (s) => { // ô trống ▫ vẽ thành ô vuông nhỏ
    const sp = $("span", "kl");
    if (s === "x▫") { sp.append("x", $("sup", "", $("i", "kb"))); return sp; }
    if (s === "10▫") { sp.append("10", $("sup", "", $("i", "kb"))); return sp; }
    if (s === "e▫") { sp.append("e", $("sup", "", $("i", "kb"))); return sp; }
    if (s === "×10ˣ") { sp.append("×10", $("sup", "", "x")); return sp; }
    if (s === "▫⁄▫") { sp.append($("span", "kfr", $("i", "kb"), $("i", "kfl"), $("i", "kb"))); return sp; }
    if (s === "▫▫⁄▫") { sp.append($("i", "kb sm"), $("span", "kfr sm", $("i", "kb"), $("i", "kfl"), $("i", "kb"))); return sp; }
    if (s === "Σ▫" || s === "Π▫") { sp.append(s[0], $("i", "kb sm")); return sp; }
    if (s === "log▫▫") { sp.append("log", $("sub", "", $("i", "kb")), $("i", "kb")); return sp; }
    if (s === "∫▫") { sp.append("∫", $("i", "kb")); return sp; }
    if (s === "√▫") { sp.append("√", $("i", "kb")); return sp; }
    if (s === "∛▫") { sp.append("∛", $("i", "kb sm")); return sp; }
    if (s === "▫√▫") { sp.append($("sup", "", $("i", "kb sm")), "√", $("i", "kb sm")); return sp; }
    sp.textContent = s; if (s.length > 7) sp.classList.add("kl-sm"); return sp;
  };

  // ---- trạng thái lưu trên máy ----
  const LS = "kh_calc_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { return {}; } };
  const saved = load();
  const S = {
    ang: saved.ang === "R" ? "R" : "D", exact: saved.exact !== false, ans: +saved.ans || 0, preAns: +saved.preAns || 0,
    vars: Object.assign({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, M: 0, x: 0, y: 0, z: 0 }, saved.vars || {}),
    hist: Array.isArray(saved.hist) ? saved.hist.slice(-30) : [], pos: saved.pos || null, last: saved.mode || "comp",
    shift: false, alpha: false, sto: false,
  };
  const persist = () => { try { localStorage.setItem(LS, JSON.stringify({ ang: S.ang, exact: S.exact, ans: S.ans, preAns: S.preAns, vars: S.vars, hist: S.hist.slice(-30), pos: S.pos, mode: S.last })); } catch (e) { } };
  const env = () => ({ ang: S.ang, vars: S.vars, ans: S.ans, preAns: S.preAns });
  const ERRT = { Math: ["Lỗi toán", "Math ERROR"], Syntax: ["Lỗi cú pháp", "Syntax ERROR"], Solve: ["Không tìm được nghiệm", "Can't Solve"] };
  const errBox = (e) => { const k = (e && e.calc) || "Math"; const t = ERRT[k] || ERRT.Math; return $("div", "c-err", $("b", "", t[0]), $("span", "", t[1] + (e && e.message && e.message !== k ? ". " + e.message : ""))); };
  const valNodes = (v, dec) => (dec || !S.exact ? Core.decNodes(v) : Core.exactNodes(v));
  const evalArr = (arr) => { const E = env(), a = Core.parse(arr); return { v: Core.evaluate(a, E), dot: Core.hasDot(a), pair: E.pair }; };
  // ---- các cách hiện kết quả: kĩ thuật (ENG), độ phút giây, thừa số nguyên tố, hỗn số ----
  const numCh = (x) => Core.chars(String(x).replace("-", "−"));
  const engNodes = (v, e) => { const m = Number((v / Math.pow(10, e)).toPrecision(10)); return numCh(m).concat(["×10", Core.mk("pow", { a: numCh(e) })]); };
  const engBase = (v) => (v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v)) / 3) * 3);
  function dmsNodes(v) {
    const neg = v < 0; let a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf + 1e-9), sc = Math.round((mf - m) * 6000) / 100;
    if (sc >= 60) { sc -= 60; m++; } if (m >= 60) { m -= 60; d++; }
    return (neg ? ["−"] : []).concat(numCh(d), ["°"], numCh(m), ["'"], numCh(Number(sc.toFixed(2))), ['"']);
  }
  function factNodes(v) {
    let n = Math.round(Math.abs(v)); const out = [];
    const push = (p, k) => { if (out.length) out.push("×"); out.push(...numCh(p)); if (k > 1) out.push(Core.mk("pow", { a: numCh(k) })); };
    for (let p = 2; p * p <= n; p++) { let k = 0; while (n % p === 0) { n /= p; k++; } if (k) push(p, k); }
    if (n > 1) push(n, 1);
    return out.length ? out : ["1"];
  }
  function mixedNodes(v) {
    const f = Core.toFrac(v); if (!f || Math.abs(f[0]) <= f[1] || f[1] === 1) return null;
    const p = Math.abs(f[0]), w = Math.floor(p / f[1]);
    return (f[0] < 0 ? ["−"] : []).concat(numCh(w), [Core.mk("frac", { a: numCh(p - w * f[1]), b: numCh(f[1]) })]);
  }
  const dispNodes = (R) => R.disp === "eng" ? engNodes(R.v, R.e) : R.disp === "dms" ? dmsNodes(R.v) : R.disp === "fact" ? factNodes(R.v)
    : R.disp === "mixed" ? (mixedNodes(R.v) || R.ex) : R.showDec ? R.de : R.ex;
  const big = (nodes) => rend(nodes, null);

  /* ---------- chế độ 1: tính toán ---------- */
  const comp = {
    ed: new Ed(), res: null, phase: "edit", pr: null, hi: -1, scroll: 0,
    setRes(v, dot, label) { this.res = { v, dot: !!dot, ex: Core.exactNodes(v), de: Core.decNodes(v), showDec: !!dot || !S.exact, label }; this.phase = "res"; },
    run(approx) {
      if (this.ed.empty()) return;
      try {
        const top = this.ed.root, kd = top.indexOf("÷R");
        if (kd >= 0) {     // phép chia có dư: Q = thương, R = số dư
          const a = evalArr(top.slice(0, kd)).v, b = evalArr(top.slice(kd + 1)).v, isI = (x) => Math.abs(x - Math.round(x)) < 1e-9;
          if (!isI(a) || !isI(b) || a < 0 || b <= 0) throw Core.err("Math");
          const q = Math.floor(Math.round(a) / Math.round(b)), r = Math.round(a) - q * Math.round(b);
          S.preAns = S.ans; S.ans = q;
          S.hist.push({ e: clone(top), v: q, d: false }); if (S.hist.length > 30) S.hist.shift();
          this.res = { v: q, pair: [["Q", q], ["R", r]] }; this.phase = "res"; this.hi = -1; persist(); return;
        }
        const r = evalArr(this.ed.root);
        S.preAns = S.ans; S.ans = r.v;
        S.hist.push({ e: clone(this.ed.root), v: r.v, d: r.dot || approx }); if (S.hist.length > 30) S.hist.shift();
        this.setRes(r.v, r.dot || approx); this.hi = -1;
        if (r.pair) { r.pair.forEach(([k, v]) => { if (k === "θ" || k === "y") S.vars.y = v; else S.vars.x = v; }); this.res.pair = r.pair; }
        persist();
      } catch (e) { this.res = { err: e }; this.phase = "res"; }
    },
    startPrompt(kind) {
      try {
        const ast = Core.parse(this.ed.root, kind === "solve");
        let list = Core.varsIn(ast);
        if (kind === "solve") { list = list.filter((v) => v !== "x").concat("x"); }
        if (!list.length) return this.run();
        this.pr = { kind, ast, list, k: 0, ed: new Ed() }; this.phase = "prompt";
      } catch (e) { this.res = { err: e }; this.phase = "res"; }
    },
    finishPrompt() {
      const P = this.pr;
      try {
        if (P.kind === "calc") {
          const v = Core.evaluate(P.ast, env()); S.preAns = S.ans; S.ans = v; this.setRes(v, Core.hasDot(P.ast)); this.res.again = true;
        } else {
          const e0 = env(), f = (x) => Core.evaluate(P.ast, Object.assign({}, e0, { vars: Object.assign({}, e0.vars, { x }) }));
          const x = Core.solve(f, S.vars.x || 0); S.vars.x = x; S.preAns = S.ans; S.ans = x;
          let lr = 0; try { lr = f(x); } catch (e) { }
          this.res = { solve: true, v: x, ex: Core.exactNodes(x), de: Core.decNodes(x), showDec: !S.exact, lr: Math.abs(lr) < 1e-12 ? 0 : lr }; this.phase = "res";
        }
        persist();
      } catch (e) { this.res = { err: e }; this.phase = "res"; }
      this.pr = null;
    },
    undo: [],
    snap() { if (this.phase === "edit" || this.phase === "res") { this.undo.push(clone(this.ed.root)); if (this.undo.length > 30) this.undo.shift(); } },
    key(a) {
      if (this.phase === "rcl") { this.phase = this.res ? "res" : "edit"; return; }
      const R0 = this.phase === "res" && this.res && !this.res.err && !this.res.pair && !this.res.solve && this.res.v != null ? this.res : null;
      switch (a) {
        case "UNDO": { const u = this.undo.pop(); if (u) { this.ed = new Ed(u); this.res = null; this.phase = "edit"; } return; }
        case "ENG": case "ENGB":
          if (!R0) return;
          if (R0.disp !== "eng") R0.e = engBase(R0.v) + (a === "ENGB" ? 3 : 0); else R0.e += a === "ENG" ? -3 : 3;
          R0.disp = "eng"; return;
        case "DMS":
          if (R0) { R0.disp = R0.disp === "dms" ? null : "dms"; return; }
          if (this.phase === "prompt") return insert(this.pr.ed, "dms");
          a = "dms"; break;
        case "FACT":
          if (!R0) return;
          if (R0.v <= 0 || Math.abs(R0.v - Math.round(R0.v)) > 1e-9 || R0.v > 9999999999) { this.res = { err: Core.err("Math") }; return; }
          R0.disp = R0.disp === "fact" ? null : "fact"; return;
        case "MIXED":
          if (!R0 || !mixedNodes(R0.v)) return;
          R0.disp = R0.disp === "mixed" ? null : "mixed"; return;
      }
      if (this.phase !== "prompt" && (isIns(a) || a === "DEL" || a === "AC")) this.snap();
      if (this.phase === "prompt") {
        const P = this.pr;
        if (a === "AC") { this.pr = null; this.phase = "edit"; this.ed.end(); return; }
        if (a === "EQ" || a === "CALC") {
          if (!P.ed.empty()) { try { S.vars[P.list[P.k]] = evalArr(P.ed.root).v; } catch (e) { this.res = { err: e }; this.phase = "res"; this.pr = null; return; } }
          P.k++; P.ed = new Ed();
          if (P.k >= P.list.length) this.finishPrompt();
          return;
        }
        if (a === "DEL") return P.ed.del(); if (a === "L") return P.ed.left(); if (a === "R") return P.ed.right();
        if (a === "U" || a === "D") return P.ed.vert(a === "U" ? -1 : 1);
        if (isIns(a)) return insert(P.ed, a);
        return;
      }
      if (isIns(a)) {
        if (this.phase === "res") {
          this.ed = new Ed(this.res && !this.res.err && POSTOP.has(a) ? ["Ans"] : []);
          this.res = null; this.phase = "edit"; this.hi = -1;
        }
        return insert(this.ed, a);
      }
      switch (a) {
        case "EQ": return this.run(false);
        case "APPROX": return this.run(true);
        case "AC": this.ed = new Ed(); this.res = null; this.phase = "edit"; this.hi = -1; return;
        case "DEL": if (this.phase === "res") { this.phase = "edit"; this.res = null; this.ed.end(); } return this.ed.del();
        case "L": case "R":
          if (this.phase === "res") { this.phase = "edit"; this.res = null; if (a === "L") this.ed.end(); else this.ed.home(); return; }
          return a === "L" ? this.ed.left() : this.ed.right();
        case "U": case "D": {
          if (this.phase === "edit" && this.ed.vert(a === "U" ? -1 : 1)) return;
          if (this.res && this.res.solve) return;
          if (this.phase === "edit" && this.ed.st.length) return;
          const H = S.hist; if (!H.length) return;
          if (a === "U") this.hi = this.hi < 0 ? H.length - 1 : Math.max(0, this.hi - 1);
          else { if (this.hi < 0) return; this.hi++; if (this.hi >= H.length) { this.hi = -1; this.ed = new Ed(); this.res = null; this.phase = "edit"; return; } }
          const h = H[this.hi]; this.ed = new Ed(clone(h.e)); this.setRes(h.v, h.d); return;
        }
        case "SD": if (this.res && !this.res.err) { this.res.showDec = !this.res.showDec; this.res.disp = null; } return;
        case "CALC": return this.startPrompt("calc");
        case "SOLVE": return this.startPrompt("solve");
        case "RCL": this.phase = "rcl"; return;
        case "MPLUS": case "MMINUS": {
          let v;
          if (this.phase === "res" && this.res && !this.res.err) v = this.res.v;
          else { this.run(); if (!this.res || this.res.err) return; v = this.res.v; }
          S.vars.M += a === "MPLUS" ? v : -v; this.res.label = a === "MPLUS" ? "M+" : "M−"; persist(); return;
        }
      }
    },
    store(name) {
      let v;
      if (this.phase === "res" && this.res && !this.res.err && this.res.v != null) v = this.res.v;
      else if (!this.ed.empty()) { this.run(); if (!this.res || this.res.err) return; v = this.res.v; }
      else v = S.ans;
      const dot = this.res && this.res.dot; S.vars[name] = v; this.setRes(v, dot, "→" + name); persist();
    },
    view() {
      if (this.phase === "rcl") {
        return [$("div", "c-title", "Giá trị đang lưu trong các biến"),
          $("div", "c-vars", Core.VARS.map((k) => $("div", "c-var", $("b", "", k + " ="), $("span", "", Core.fmtPlain(S.vars[k] || 0))))),
          $("div", "c-hint", "Bấm phím bất kì để quay lại.")];
      }
      if (this.phase === "prompt") {
        const P = this.pr, name = P.list[P.k];
        return [$("div", "c-line c-small", rend(this.ed.root, null)),
          $("div", "c-line c-prompt", $("span", "c-pl", (P.kind === "solve" && name === "x" ? "x ban đầu" : name) + " ="), rend(P.ed.root, P.ed.cur)),
          $("div", "c-hint", "Đang có " + name + " = " + Core.fmtPlain(S.vars[name] || 0) + ". Nhập số mới hoặc bấm = để giữ nguyên.")];
      }
      const out = [$("div", "c-line c-in", rend(this.ed.root, this.phase === "edit" ? this.ed.cur : null))];
      const R = this.res;
      if (R && R.err) out.push(errBox(R.err), $("div", "c-hint", "Bấm ◀ hoặc ▶ để sửa biểu thức, AC để xoá."));
      else if (R && R.solve) {
        out.push($("div", "c-out c-solve", $("span", "c-pl", "x ="), big(R.showDec ? R.de : R.ex)),
          $("div", "c-sub", "L − R = " + Core.fmtPlain(R.lr)));
      } else if (R && R.pair) {
        out.push($("div", "c-res c-two", R.pair.map(([k, v]) => $("div", "c-rl", $("span", "c-pl", k + " ="), big(valNodes(v, false))))));
      } else if (R) out.push($("div", "c-out", R.label ? $("span", "c-lab", R.label) : null, big(dispNodes(R))));
      return out;
    },
    hint() {
      if (this.phase === "edit" && this.ed.empty()) return "Nhập biểu thức rồi bấm =. Phím ▲ xem lại các phép tính trước.";
      return "";
    },
  };

  /* ---------- bảng nhập hệ số (hệ phương trình, phương trình, bất phương trình) ---------- */
  const SUBS = ["₁", "₂", "₃", "₄"], VN = ["x", "y", "z", "t"];
  const polyShape = (d, rel) => {   // ax³ + bx² + cx + d = 0
    const L = "abcde"; const out = [];
    for (let k = 0; k <= d; k++) {
      const p = d - k; if (k) out.push("+");
      out.push(L[k]); if (p >= 1) out.push("x"); if (p >= 2) out.push(mk("pow", { a: [String(p)] }));
    }
    return out.concat([rel, "0"]);
  };
  function coefMode(cfg) {
    const M = {
      cfg, cells: Array.from({ length: cfg.rows * cfg.cols }, () => ({ v: 0, n: ["0"] })), sel: 0, ed: null, out: null, err: null, top: 0,
      commit() {
        if (!this.ed) return true;
        if (this.ed.empty()) { this.ed = null; return true; }
        try { const r = evalArr(this.ed.root); this.cells[this.sel] = { v: r.v, n: r.dot ? Core.decNodes(r.v) : Core.exactNodes(r.v) }; this.ed = null; this.err = null; return true; }
        catch (e) { this.err = e; return false; }
      },
      move(d) {
        const { rows, cols } = this.cfg; let r = Math.floor(this.sel / cols), c = this.sel % cols;
        if (d === "L") c = (c + cols - 1) % cols; else if (d === "R") c = (c + 1) % cols;
        else if (d === "U") r = (r + rows - 1) % rows; else if (d === "D") r = (r + 1) % rows;
        this.sel = r * cols + c;
      },
      key(a) {
        if (this.out) {
          if (a === "U") this.top = Math.max(0, this.top - 1); else if (a === "D") this.top++;
          else if (a === "AC" || a === "EQ" || a === "L") { this.out = null; this.top = 0; }
          return;
        }
        if (isIns(a)) { if (!this.ed) this.ed = new Ed(); this.err = null; return insert(this.ed, a); }
        switch (a) {
          case "EQ":
            if (this.ed) { if (this.commit()) { if (this.sel < this.cells.length - 1) this.sel++; } return; }
            try { this.out = this.cfg.solve(this.cells.map((c) => c.v)); } catch (e) { this.out = { err: e }; }
            this.top = 0; return;
          case "AC": if (this.ed) { this.ed = null; this.err = null; } else this.cells = this.cells.map(() => ({ v: 0, n: ["0"] })); return;
          case "DEL": if (this.ed) this.ed.del(); else { this.cells[this.sel] = { v: 0, n: ["0"] }; } return;
          case "L": case "R": if (this.ed) return a === "L" ? this.ed.left() : this.ed.right(); return this.move(a);
          case "U": case "D": if (this.ed) { if (this.ed.vert(a === "U" ? -1 : 1)) return; if (!this.commit()) return; } return this.move(a);
        }
      },
      view() {
        const { rows, cols, head } = this.cfg;
        if (this.out) {
          if (this.out.err) return [$("div", "c-line c-small", this.cfg.shape()), errBox(this.out.err), $("div", "c-hint", "Bấm AC để sửa hệ số.")];
          const lines = this.out.lines;
          const box = $("div", "c-res", lines.map((L, i) => $("div", "c-rl" + (L.note ? " c-note" : ""), L.lab ? $("span", "c-pl", L.lab) : null, L.nodes ? big(L.nodes) : $("span", "", L.text))));
          setTimeout(() => { const el = box.children[Math.min(this.top, box.children.length - 1)]; if (el) box.scrollTop = el.offsetTop - box.offsetTop; }, 0);
          return [$("div", "c-line c-small", this.cfg.shape()), box];
        }
        const g = $("div", "c-grid");
        g.style.gridTemplateColumns = (rows > 1 ? "22px " : "") + "repeat(" + cols + ",minmax(0,1fr))";
        if (head) { if (rows > 1) g.append($("span", "c-gh", "")); head.forEach((t) => g.append($("span", "c-gh", t))); }
        for (let r = 0; r < rows; r++) {
          if (rows > 1) g.append($("span", "c-gh", String(r + 1)));
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c, on = i === this.sel;
            const cell = $("span", "c-cell" + (on ? " on" : ""), on && this.ed ? rend(this.ed.root, this.ed.cur) : big(this.cells[i].n));
            cell.addEventListener("click", () => { if (this.ed && !this.commit()) return; this.sel = i; draw(); });
            g.append(cell);
          }
        }
        return [$("div", "c-line c-small", this.cfg.shape()), g, this.err ? errBox(this.err) : null];
      },
      hint() { return this.out ? "▲▼ xem tiếp. AC để sửa hệ số." : this.ed ? "Bấm = để lưu ô này." : "Nhập số vào ô đang chọn, bấm = để sang ô sau. Nhập xong bấm = lần nữa để giải."; },
    };
    return M;
  }
  const rootLines = (rs, exact) => rs.map((z, i) => ({ lab: "x" + SUBS[i] + " =", nodes: Core.cplxNodes(z, exact) }));
  function polySolve(d, cf) {
    if (cf[0] === 0) throw Core.err("Math", "Hệ số a phải khác 0");
    const rs = Core.polyRoots(cf), lines = [];
    // gộp nghiệm trùng (nghiệm kép) để hiển thị gọn
    const uniq = []; rs.forEach((z) => { if (!uniq.some((u) => Math.abs(u[0] - z[0]) < 1e-9 && Math.abs(u[1] - z[1]) < 1e-9)) uniq.push(z); });
    if (uniq.length === 1 && d >= 2) lines.push({ lab: "x =", nodes: Core.cplxNodes(uniq[0], S.exact) }, { text: d === 2 ? "Phương trình có nghiệm kép." : "Nghiệm bội " + d + ".", note: true });
    else lines.push(...rootLines(uniq, S.exact));
    if (uniq.some((z) => z[1] !== 0)) lines.push({ text: "Nghiệm có chứa i là nghiệm phức (i² = −1), không phải nghiệm thực.", note: true });
    if (d === 2) {
      const [a, b, c] = cf, x0 = -b / (2 * a), y0 = c - b * b / (4 * a);
      lines.push({ text: a > 0 ? "Giá trị nhỏ nhất của ax² + bx + c" : "Giá trị lớn nhất của ax² + bx + c", note: true },
        { lab: "x =", nodes: valNodes(x0) }, { lab: "y =", nodes: valNodes(y0) });
    }
    if (d === 3) {
      const [a, b, c] = cf, D = b * b - 3 * a * c;
      if (D > 0) {
        const p = (x) => cf.reduce((s, k) => s * x + k, 0);
        const xs = [(-b - Math.sqrt(D)) / (3 * a), (-b + Math.sqrt(D)) / (3 * a)].sort((u, v) => u - v);
        const isMax = (x) => 6 * a * x + 2 * b < 0;
        xs.forEach((x) => lines.push({ text: isMax(x) ? "Cực đại" : "Cực tiểu", note: true }, { lab: "x =", nodes: valNodes(x) }, { lab: "y =", nodes: valNodes(p(x)) }));
      }
    }
    return { lines };
  }
  function sysSolve(n, v) {
    const M = []; for (let r = 0; r < n; r++) M.push(v.slice(r * (n + 1), r * (n + 1) + n + 1));
    const r = Core.linSolve(M);
    if (r.none) return { lines: [{ text: "Hệ phương trình vô nghiệm.", note: true }] };
    if (r.many) return { lines: [{ text: "Hệ phương trình có vô số nghiệm.", note: true }] };
    return { lines: r.x.map((x, i) => ({ lab: VN[i] + " =", nodes: valNodes(x) })) };
  }
  function ineqSolve(d, rel, cf) {
    if (cf[0] === 0) throw Core.err("Math", "Hệ số a phải khác 0");
    const p = (x) => cf.reduce((s, k) => s * x + k, 0);
    const rs = []; Core.polyRoots(cf).filter((z) => z[1] === 0).forEach((z) => { if (!rs.some((r) => Math.abs(r - z[0]) < 1e-9)) rs.push(z[0]); });
    rs.sort((a, b) => a - b);
    const strict = rel === ">" || rel === "<", want = (v) => (rel === ">" || rel === "≥" ? v > 0 : v < 0);
    const pts = [-Infinity].concat(rs, [Infinity]), iv = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const lo = pts[k], hi = pts[k + 1];
      const mid = lo === -Infinity ? (hi === Infinity ? 0 : hi - 1) : hi === Infinity ? lo + 1 : (lo + hi) / 2;
      if (want(p(mid))) iv.push({ lo, hi, li: !strict && lo !== -Infinity, hi_: !strict && hi !== Infinity });
    }
    // ghép các khoảng liền nhau (khi dấu = cho phép) và thêm điểm cô lập
    const merged = [];
    iv.forEach((I) => { const L = merged[merged.length - 1]; if (L && L.hi === I.lo && L.hi_ && I.li) { L.hi = I.hi; L.hi_ = I.hi_; } else merged.push(Object.assign({}, I)); });
    if (!strict) rs.forEach((r) => { if (!merged.some((I) => (I.lo < r && r < I.hi) || (I.lo === r && I.li) || (I.hi === r && I.hi_))) merged.push({ pt: r }); });
    merged.sort((a, b) => (a.pt ?? a.lo) - (b.pt ?? b.lo));
    const nd = (x) => valNodes(x);
    if (!merged.length) return { lines: [{ text: "Bất phương trình vô nghiệm.", note: true }, { lab: "S =", text: "∅" }] };
    if (merged.length === 1 && merged[0].lo === -Infinity && merged[0].hi === Infinity) return { lines: [{ text: "Nghiệm đúng với mọi x.", note: true }, { lab: "S =", text: "ℝ" }] };
    const parts = []; merged.forEach((I, k) => {
      if (k) parts.push("\u00a0∪\u00a0");
      if (I.pt != null) parts.push("{", ...nd(I.pt), "}");
      else parts.push(I.li ? "[" : "(", ...(I.lo === -Infinity ? ["−∞"] : nd(I.lo)), ";\u00a0", ...(I.hi === Infinity ? ["+∞"] : nd(I.hi)), I.hi_ ? "]" : ")");
    });
    const lines = [{ lab: "S =", nodes: parts }];
    const rx = merged.map((I) => {
      if (I.pt != null) return ["x", "=", ...nd(I.pt)];
      const a = I.lo === -Infinity ? null : nd(I.lo), b = I.hi === Infinity ? null : nd(I.hi);
      if (a && b) return [...a, I.li ? "≤" : "<", "x", I.hi_ ? "≤" : "<", ...b];
      if (a) return ["x", I.li ? "≥" : ">", ...a];
      return ["x", I.hi_ ? "≤" : "<", ...b];
    });
    rx.forEach((n, k) => lines.push({ lab: k ? "hoặc" : "", nodes: n }));
    return { lines };
  }

  /* ---------- chế độ bảng giá trị ---------- */
  const table = {
    f: new Ed(["x", mk("pow", { a: ["2"] })]), g: new Ed(), rng: [new Ed(["1"]), new Ed(["5"]), new Ed(["1"])], phase: "f", ri: 0, rows: null, sel: 0, err: null,
    cur() { return this.phase === "f" ? this.f : this.phase === "g" ? this.g : this.phase === "rng" ? this.rng[this.ri] : null; },
    build() {
      try {
        const [a, b, st] = this.rng.map((e) => evalArr(e.root).v);
        if (st <= 0 || b < a) throw Core.err("Math", "Cần bắt đầu ≤ kết thúc và bước > 0");
        const n = Math.floor((b - a) / st + 1e-9) + 1;
        if (n > 100) throw Core.err("Math", "Tối đa 100 dòng, hãy tăng bước");
        const fa = Core.parse(this.f.root), ga = this.g.empty() ? null : Core.parse(this.g.root);
        const at = (ast, x) => { try { return Core.fmtPlain(Core.evaluate(ast, Object.assign(env(), { vars: Object.assign({}, S.vars, { x }) }))); } catch (e) { return "Lỗi"; } };
        this.rows = []; for (let k = 0; k < n; k++) { const x = Number((a + k * st).toPrecision(12)); this.rows.push([Core.fmtPlain(x), at(fa, x), ga ? at(ga, x) : null]); }
        this.phase = "tab"; this.sel = 0; this.err = null;
      } catch (e) { this.err = e; }
    },
    key(a) {
      if (this.phase === "tab") {
        if (a === "U") this.sel = Math.max(0, this.sel - 1); else if (a === "D") this.sel = Math.min(this.rows.length - 1, this.sel + 1);
        else if (a === "AC" || a === "EQ") { this.phase = "f"; this.f.end(); }
        return;
      }
      const ed = this.cur();
      if (isIns(a)) { this.err = null; return insert(ed, a); }
      switch (a) {
        case "EQ":
          if (this.phase === "f") { try { Core.parse(this.f.root); this.phase = "g"; this.g.end(); this.err = null; } catch (e) { this.err = e; } return; }
          if (this.phase === "g") { try { if (!this.g.empty()) Core.parse(this.g.root); this.phase = "rng"; this.ri = 0; this.rng[0].end(); this.err = null; } catch (e) { this.err = e; } return; }
          if (this.ri < 2) { try { evalArr(this.rng[this.ri].root); this.ri++; this.rng[this.ri].end(); this.err = null; } catch (e) { this.err = e; } return; }
          return this.build();
        case "AC": if (this.phase === "rng") { this.phase = "f"; } else ed.root.length = 0, ed.end(); this.err = null; return;
        case "DEL": return ed.del();
        case "L": return ed.left(); case "R": return ed.right();
        case "U": case "D":
          if (ed.vert(a === "U" ? -1 : 1)) return;
          if (this.phase === "rng") { this.ri = Math.max(0, Math.min(2, this.ri + (a === "U" ? -1 : 1))); this.rng[this.ri].end(); }
          else if (this.phase === "g" && a === "U") { this.phase = "f"; this.f.end(); }
          else if (this.phase === "f" && a === "D") { this.phase = "g"; this.g.end(); }
          return;
      }
    },
    view() {
      if (this.phase === "tab") {
        const two = this.rows[0][2] != null;
        const t = $("div", "c-table" + (two ? " two" : ""), $("div", "c-tr c-th", $("span", "", "x"), $("span", "", "f(x)"), two ? $("span", "", "g(x)") : null),
          this.rows.map((r, i) => { const tr = $("div", "c-tr" + (i === this.sel ? " on" : ""), $("span", "", r[0]), $("span", "", r[1]), two ? $("span", "", r[2]) : null); tr.addEventListener("click", () => { this.sel = i; draw(); }); return tr; }));
        setTimeout(() => { const el = t.children[this.sel + 1]; if (el) { const top = el.offsetTop - t.offsetTop; if (top < t.scrollTop + 20 || top > t.scrollTop + t.clientHeight - 24) t.scrollTop = top - t.clientHeight / 2; } }, 0);
        return [t];
      }
      if (this.phase === "rng") {
        const L = ["Bắt đầu", "Kết thúc", "Bước"];
        return [$("div", "c-title", "Khoảng giá trị của x"), $("div", "c-form", L.map((t, i) => $("div", "c-fr" + (i === this.ri ? " on" : ""), $("span", "c-pl", t + " ="), rend(this.rng[i].root, i === this.ri ? this.rng[i].cur : null)))), this.err ? errBox(this.err) : null];
      }
      return [$("div", "c-form", $("div", "c-fr" + (this.phase === "f" ? " on" : ""), $("span", "c-pl", "f(x) ="), rend(this.f.root, this.phase === "f" ? this.f.cur : null)),
        $("div", "c-fr" + (this.phase === "g" ? " on" : ""), $("span", "c-pl", "g(x) ="), rend(this.g.root, this.phase === "g" ? this.g.cur : null))), this.err ? errBox(this.err) : null];
    },
    hint() {
      return this.phase === "tab" ? "▲▼ chọn dòng. AC để sửa hàm số." : this.phase === "g" ? "g(x) có thể để trống. Bấm = để tiếp tục." : this.phase === "rng" ? "Bấm = sau mỗi dòng. Tối đa 100 dòng." : "Nhập f(x) theo biến x (phím x), bấm = để tiếp tục.";
    },
  };

  /* ---------- chế độ thống kê ---------- */
  const ovl = (v) => $("span", "", $("span", "c-ovl", v), " =");
  function statMode(two) {
    return {
      two, data: [], sel: 0, col: 0, ed: null, out: null, top: 0, err: null,
      cols() { return this.two ? ["x", "y"] : ["x", "Tần số"]; },
      commit() {
        if (!this.ed) return true;
        if (this.ed.empty()) { this.ed = null; return true; }
        try {
          const v = evalArr(this.ed.root).v;
          if (!this.two && this.col === 1 && (v < 0 || !Number.isFinite(v))) throw Core.err("Math", "Tần số phải ≥ 0");
          if (this.sel >= this.data.length) this.data.push(this.two ? [0, 0] : [0, 1]);
          this.data[this.sel][this.col] = v; this.ed = null; this.err = null; return true;
        } catch (e) { this.err = e; return false; }
      },
      calc() {
        const d = this.data.filter((r) => this.two || r[1] > 0);
        if (!d.length) throw Core.err("Math", "Chưa có dữ liệu");
        const L = [], put = (lab, v) => L.push({ lab, text: Number.isFinite(v) ? Core.fmtPlain(v) : "—" });
        if (!this.two) {
          let n = 0, sx = 0, sx2 = 0; d.forEach(([x, f]) => { n += f; sx += f * x; sx2 += f * x * x; });
          const m = sx / n, varp = Math.max(0, sx2 / n - m * m), vs = n > 1 ? varp * n / (n - 1) : NaN;
          const arr = []; d.slice().sort((a, b) => a[0] - b[0]).forEach(([x, f]) => { for (let k = 0; k < Math.round(f) && arr.length < 100000; k++) arr.push(x); });
          const med = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
          const N = arr.length, half = Math.floor(N / 2);
          const lo = arr.slice(0, half), hi = arr.slice(N % 2 ? half + 1 : half);
          let mf = 0; const freq = new Map(); d.forEach(([x, f]) => freq.set(x, (freq.get(x) || 0) + f)); freq.forEach((f) => (mf = Math.max(mf, f)));
          const modes = [...freq].filter(([, f]) => f === mf).map(([x]) => x).sort((a, b) => a - b);
          put(ovl("x"), m); put("Σx =", sx); put("Σx² =", sx2); put("σ²x =", varp); put("σx =", Math.sqrt(varp)); put("s²x =", vs); put("sx =", Math.sqrt(vs)); put("n =", n);
          put("min =", arr[0]); put("Q₁ =", lo.length ? med(lo) : NaN); put("Me =", med(arr)); put("Q₃ =", hi.length ? med(hi) : NaN); put("max =", arr[N - 1]);
          L.push({ lab: "Mốt =", text: modes.length > 5 ? "nhiều giá trị" : modes.map(Core.fmtPlain).join("; ") });
        } else {
          const n = d.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
          d.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; });
          const mx = sx / n, my = sy / n, Sxx = sxx - n * mx * mx, Syy = syy - n * my * my, Sxy = sxy - n * mx * my;
          if (n < 2 || Sxx === 0) throw Core.err("Math", "Cần ít nhất 2 giá trị x khác nhau");
          const b = Sxy / Sxx, a = my - b * mx, r = Syy === 0 ? NaN : Sxy / Math.sqrt(Sxx * Syy);
          L.push({ text: "Hồi quy tuyến tính y = a + bx", note: true });
          put("a =", a); put("b =", b); put("r =", r); put(ovl("x"), mx); put(ovl("y"), my); put("n =", n);
          put("σx =", Math.sqrt(Sxx / n)); put("σy =", Math.sqrt(Syy / n));
        }
        return { lines: L };
      },
      key(a) {
        if (this.out) { if (a === "U") this.top = Math.max(0, this.top - 1); else if (a === "D") this.top++; else if (a === "AC" || a === "EQ") { this.out = null; this.top = 0; } return; }
        if (isIns(a)) { if (!this.ed) this.ed = new Ed(); this.err = null; return insert(this.ed, a); }
        switch (a) {
          case "EQ":
            if (this.ed) { if (this.commit()) this.sel = Math.min(this.sel + 1, this.data.length); return; }
            try { this.out = this.calc(); } catch (e) { this.out = { err: e }; } this.top = 0; return;
          case "AC": this.ed = null; this.err = null; return;
          case "DEL": if (this.ed) return this.ed.del(); if (this.sel < this.data.length) { this.data.splice(this.sel, 1); this.sel = Math.min(this.sel, this.data.length); } return;
          case "L": case "R": if (this.ed) return a === "L" ? this.ed.left() : this.ed.right(); this.col = this.col ? 0 : 1; return;
          case "U": case "D": if (this.ed) { if (this.ed.vert(a === "U" ? -1 : 1)) return; if (!this.commit()) return; }
            this.sel = Math.max(0, Math.min(this.data.length, this.sel + (a === "U" ? -1 : 1))); return;
        }
      },
      view() {
        if (this.out) {
          if (this.out.err) return [errBox(this.out.err), $("div", "c-hint", "Bấm AC để quay lại bảng số liệu.")];
          const box = $("div", "c-res c-two", this.out.lines.map((L) => $("div", "c-rl" + (L.note ? " c-note" : ""), L.lab ? $("span", "c-pl", L.lab) : null, $("span", "", L.text))));
          setTimeout(() => { const el = box.children[Math.min(this.top, box.children.length - 1)]; if (el) box.scrollTop = el.offsetTop - box.offsetTop; }, 0);
          return [box];
        }
        const cn = this.cols();
        const t = $("div", "c-table c-stat", $("div", "c-tr c-th", $("span", "", ""), $("span", "", cn[0]), $("span", "", cn[1])));
        for (let i = 0; i <= this.data.length; i++) {
          const r = this.data[i];
          const cell = (c) => {
            const on = i === this.sel && c === this.col;
            const s = $("span", on ? "on" : "", on && this.ed ? rend(this.ed.root, this.ed.cur) : r ? Core.fmtPlain(r[c]) : "");
            s.addEventListener("click", () => { if (this.ed && !this.commit()) return; this.sel = i; this.col = c; draw(); });
            return s;
          };
          t.append($("div", "c-tr", $("span", "c-rn", String(i + 1)), cell(0), cell(1)));
        }
        setTimeout(() => { const el = t.children[this.sel + 1]; if (el) { const top = el.offsetTop - t.offsetTop; if (top < t.scrollTop + 20 || top > t.scrollTop + t.clientHeight - 24) t.scrollTop = top - t.clientHeight / 2; } }, 0);
        return [t, this.err ? errBox(this.err) : null];
      },
      hint() { return this.out ? "▲▼ xem tiếp. AC để quay lại bảng số liệu." : this.ed ? "Bấm = để lưu và xuống dòng." : "Nhập số, bấm = để lưu. Xong dữ liệu bấm = lần nữa để tính. DEL xoá dòng."; },
    };
  }

  /* ---------- menu chọn chế độ và cài đặt ---------- */
  const MODES = [
    { id: "comp", n: "Tính toán", ic: "+−\n×÷" },
    { id: "sys", n: "Hệ phương trình", ic: "{x\n y" },
    { id: "poly", n: "Phương trình bậc cao", ic: "x³" },
    { id: "ineq", n: "Bất phương trình", ic: "≥0" },
    { id: "table", n: "Bảng giá trị", ic: "f(x)" },
    { id: "stat", n: "Thống kê", ic: "Σx" },
  ];
  const app = { mode: "comp", mods: { comp, table }, menu: null };
  function choose(list, title, onPick) { app.menu = { list, title, onPick }; }
  function openMode(id) {
    app.menu = null; S.last = id; persist();
    if (id === "comp" || id === "table") { app.mode = id; return; }
    if (id === "sys") return choose(["2 ẩn", "3 ẩn", "4 ẩn"], "Hệ phương trình bậc nhất", (k) => {
      const n = k + 2;
      app.mods.sys = coefMode({ rows: n, cols: n + 1, head: VN.slice(0, n).concat(["="]),
        shape: () => rend([].concat(...VN.slice(0, n).map((v, i) => (i ? ["+"] : []).concat(["a" + SUBS[i], v]))).concat(["=", "b"]), null),
        solve: (v) => sysSolve(n, v) });
      app.mode = "sys";
    });
    if (id === "poly") return choose(["ax² + bx + c = 0", "ax³ + bx² + cx + d = 0", "ax⁴ + bx³ + cx² + dx + e = 0"], "Phương trình đa thức", (k) => {
      const d = k + 2;
      app.mods.poly = coefMode({ rows: 1, cols: d + 1, head: "abcde".slice(0, d + 1).split(""), shape: () => rend(polyShape(d, "="), null), solve: (v) => polySolve(d, v) });
      app.mode = "poly";
    });
    if (id === "ineq") return choose(["Bậc 2", "Bậc 3", "Bậc 4"], "Bất phương trình đa thức", (k) => {
      const d = k + 2;
      choose([">", "<", "≥", "≤"].map((r) => (d === 2 ? "ax² + bx + c " : d === 3 ? "ax³ + … + d " : "ax⁴ + … + e ") + r + " 0"), "Chọn dấu", (j) => {
        const rel = [">", "<", "≥", "≤"][j];
        app.mods.ineq = coefMode({ rows: 1, cols: d + 1, head: "abcde".slice(0, d + 1).split(""), shape: () => rend(polyShape(d, rel), null), solve: (v) => ineqSolve(d, rel, v) });
        app.mode = "ineq"; app.menu = null;
      });
    });
    if (id === "stat") return choose(["Một biến (x và tần số)", "Hai biến, hồi quy y = a + bx"], "Thống kê", (k) => { app.mods.stat = statMode(k === 1); app.mode = "stat"; });
  }
  // ---- OPTN, CONST, CONV, RESET ----
  const CONSTS = [["g · gia tốc trọng trường (m/s²)", 9.80665], ["c · tốc độ ánh sáng (m/s)", 299792458], ["h · hằng số Planck (J·s)", 6.62607015e-34],
    ["e · điện tích nguyên tố (C)", 1.602176634e-19], ["Nₐ · số Avogadro (mol⁻¹)", 6.02214076e23], ["R · hằng số khí (J/(mol·K))", 8.314462618],
    ["k · hằng số Boltzmann (J/K)", 1.380649e-23], ["G · hằng số hấp dẫn (N·m²/kg²)", 6.6743e-11], ["mₑ · khối lượng electron (kg)", 9.1093837015e-31]];
  const CONVS = [["in → cm", (v) => v * 2.54], ["cm → in", (v) => v / 2.54], ["ft → m", (v) => v * 0.3048], ["m → ft", (v) => v / 0.3048],
    ["mile → km", (v) => v * 1.609344], ["km → mile", (v) => v / 1.609344], ["lb → kg", (v) => v * 0.45359237], ["°F → °C", (v) => (v - 32) * 5 / 9], ["°C → °F", (v) => v * 9 / 5 + 32]];
  const note = (t) => { app.note = t; };
  function valToNodes(v) {
    const a = Math.abs(v);
    if (a >= 1e6 || (a < 1e-3 && a > 0)) { const [m, e] = v.toExponential().split("e"); return Core.chars(m.replace("-", "−")).concat(["×10", Core.mk("pow", { a: Core.chars(String(+e).replace("-", "−")) })]); }
    return Core.chars(String(v).replace("-", "−"));
  }
  function special(a) {
    if (a === "RESET") return choose(["Xoá các biến A–F, M, x, y, z", "Đặt lại tất cả: cài đặt, biến, Ans, lịch sử"], "RESET", (i) => {
      Object.keys(S.vars).forEach((k) => (S.vars[k] = 0));
      if (i === 1) { S.ans = 0; S.preAns = 0; S.hist = []; S.ang = "D"; S.exact = true; comp.ed = new Ed(); comp.res = null; comp.phase = "edit"; comp.undo = []; }
      persist(); note(i ? "Đã đặt lại toàn bộ máy tính." : "Đã xoá bộ nhớ các biến.");
    });
    if (app.mode !== "comp") return note("Phím này dùng trong chế độ Tính toán (MENU → 1).");
    if (a === "OPTN") return choose(["sinh", "cosh", "tanh", "sinh⁻¹", "cosh⁻¹", "tanh⁻¹"], "OPTN · Hàm hyperbolic", (i) => comp.key(["sinh", "cosh", "tanh", "asinh", "acosh", "atanh"][i]));
    if (a === "CONST") return choose(CONSTS.map((c) => c[0]), "CONST · Hằng số khoa học", (i) => {
      if (comp.phase === "res" || comp.phase === "rcl") { comp.ed = new Ed(); comp.res = null; comp.phase = "edit"; }
      comp.snap(); comp.ed.ins(["("].concat(valToNodes(CONSTS[i][1]), [")"]));
    });
    if (a === "CONV") return choose(CONVS.map((c) => c[0]), "CONV · Đổi đơn vị", (i) => {
      let v;
      if (comp.phase === "res" && comp.res && !comp.res.err && comp.res.v != null) v = comp.res.v;
      else if (!comp.ed.empty()) { comp.run(); if (!comp.res || comp.res.err) return; v = comp.res.v; }
      else v = S.ans;
      const out = CONVS[i][1](v); S.preAns = S.ans; S.ans = out; comp.setRes(out, true, CONVS[i][0]); persist();
    });
  }
  function setupMenu() {
    choose(["Đơn vị góc: độ (D)" + (S.ang === "D" ? "  ✓" : ""), "Đơn vị góc: radian (R)" + (S.ang === "R" ? "  ✓" : ""),
      "Kết quả dạng chính xác (phân số, căn)" + (S.exact ? "  ✓" : ""), "Kết quả dạng thập phân" + (!S.exact ? "  ✓" : "")], "Cài đặt", (k) => {
      if (k < 2) S.ang = k ? "R" : "D"; else S.exact = k === 2;
      persist(); setupMenu();
    });
    app.menu.setup = true;
  }

  /* ---------- khung máy tính ---------- */
  let el = null, lcd = null, ind = null, hintEl = null, openBtns = [];
  function draw() {
    if (!el) return;
    const kind = app.mode;
    ind.innerHTML = "";
    const tag = (t, on, cls) => ind.append($("span", "ci" + (on ? " on" : "") + (cls ? " " + cls : ""), t));
    tag("S", S.shift, "ci-s"); tag("A", S.alpha, "ci-a"); tag("STO", S.sto); tag("M", S.vars.M !== 0);
    tag(S.ang === "D" ? "D" : "R", true);
    ind.append($("span", "ci-mode", app.menu ? "Menu" : (MODES.find((m) => m.id === kind) || {}).n));
    lcd.innerHTML = "";
    let hint = "";
    if (app.menu) {
      const m = app.menu;
      if (m.home) {
        const g = $("div", "c-menu", MODES.map((md, i) => { const b = $("button", "c-mi", $("span", "c-mic", md.ic), $("span", "c-min", (i + 1) + ". " + md.n)); b.type = "button"; b.addEventListener("click", () => { openMode(md.id); draw(); }); return b; }));
        lcd.append(g); hint = "Bấm số 1 đến 6 hoặc chạm vào chế độ.";
      } else {
        lcd.append($("div", "c-title", m.title), $("div", "c-list", m.list.map((t, i) => { const b = $("button", "c-li", $("b", "", String(i + 1)), $("span", "", t)); b.type = "button"; b.addEventListener("click", () => { app.menu = null; m.onPick(i); draw(); }); return b; })));
        hint = m.setup ? "Chọn số để đổi cài đặt. Bấm AC để thoát." : "Bấm số để chọn. AC để quay lại.";
      }
    } else {
      const M = app.mods[kind];
      lcd.append(...M.view().filter(Boolean)); hint = M.hint();
      const c = lcd.querySelector(".m-cur"); const line = c && c.closest(".c-line, .c-cell, .c-fr");
      if (c && line) { const lr = line.getBoundingClientRect(), cr = c.getBoundingClientRect(); if (cr.right > lr.right - 8) line.scrollLeft += cr.right - lr.right + 24; if (cr.left < lr.left + 8) line.scrollLeft -= lr.left - cr.left + 24; }
    }
    hintEl.textContent = app.note || hint; app.note = null;
    el.querySelectorAll(".kr.k-shift").forEach((b) => b.classList.toggle("on", S.shift));
    el.querySelectorAll(".kr.k-alpha").forEach((b) => b.classList.toggle("on", S.alpha));
    el.classList.toggle("is-shift", S.shift); el.classList.toggle("is-alpha", S.alpha);
  }
  function press(k) {
    let a = S.shift ? k.shAct : S.alpha ? k.alAct : k.act;
    if (S.sto) {
      S.sto = false;
      const v = /^v/.test(k.alAct || "") ? k.alAct.slice(1) : /^v/.test(a || "") ? a.slice(1) : null;
      S.shift = S.alpha = false;
      if (v && app.mode === "comp" && !app.menu) { comp.store(v); return draw(); }
      if (!v) return draw();
    }
    S.shift = false; S.alpha = false;
    if (!a) return draw();
    act(a);
  }
  function act(a) {
    if (a === "OFF") return close();
    if (a === "MENU") { app.menu = app.menu && app.menu.home ? null : { home: true }; return draw(); }
    if (a === "SETUP") { setupMenu(); return draw(); }
    if (a === "ON") { app.menu = null; S.sto = false; const M = app.mods[app.mode]; if (M && M.key) M.key("AC"); return draw(); }
    if (a === "OPTN" || a === "CONST" || a === "CONV" || a === "RESET") { special(a); return draw(); }
    if (app.menu) {
      const m = app.menu;
      const d = /^d(\d)$/.exec(a);
      if (d) { const i = +d[1] - 1; if (m.home) { if (MODES[i]) openMode(MODES[i].id); } else if (i >= 0 && i < m.list.length) { app.menu = null; m.onPick(i); } return draw(); }
      if (a === "AC") { app.menu = null; return draw(); }
      return draw();
    }
    if (a === "STO") { if (app.mode === "comp") S.sto = true; return draw(); }
    app.mods[app.mode].key(a);
    draw();
  }
  function build() {
    el = $("div", "khc"); el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Máy tính cầm tay"); el.tabIndex = -1;
    const bar = $("div", "khc-bar", $("span", "khc-grip", "Máy tính cầm tay"));
    const x = $("button", "khc-x", "Đóng"); x.type = "button"; x.setAttribute("aria-label", "Đóng máy tính"); x.addEventListener("click", close); bar.append(x);
    ind = $("div", "khc-ind"); lcd = $("div", "khc-lcd"); hintEl = $("div", "khc-hint");
    const screen = $("div", "khc-screen", ind, lcd, hintEl);
    const mkKey = (k, cls) => {
      const wrap = $("div", "kw " + (cls || ""));
      const side = k.al ? $("span", "kt-a", keyLabel(k.al)) : k.bl ? $("span", "kt-b", k.bl) : $("span", "kt-a", "");
      const top = $("div", "kt", $("span", "kt-s", k.sh ? keyLabel(k.sh) : ""), side);
      const b = $("button", "k " + k.cls, keyLabel(k.main)); b.type = "button";
      b.setAttribute("aria-label", k.main.replace(/▫/g, "").replace("•", "dấu chấm"));
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); el.focus({ preventScroll: true }); b.classList.add("down"); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((t) => b.addEventListener(t, () => b.classList.remove("down")));
      b.addEventListener("click", () => press(k));
      wrap.append(top, b); return wrap;
    };
    // phím tròn: SHIFT, ALPHA, MENU (SETUP), ON — nhãn in phía trên như máy thật
    const rnd = (lab, sub, cls, aria, fn) => {
      const b = $("button", "kr " + cls); b.type = "button"; b.setAttribute("aria-label", aria); b.addEventListener("click", fn);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); el.focus({ preventScroll: true }); });
      return $("div", "kw kw-r", $("div", "kt kt-r", $("span", "kr-l " + cls + "-l", lab), sub ? $("span", "kt-s", sub) : null), b);
    };
    const sh = rnd("SHIFT", "", "k-shift", "SHIFT", () => { S.shift = !S.shift; S.alpha = false; draw(); });
    const al = rnd("ALPHA", "", "k-alpha", "ALPHA", () => { S.alpha = !S.alpha; S.shift = false; draw(); });
    const menu = rnd("MENU", "SETUP", "k-menu", "MENU, SHIFT MENU là SETUP", () => { const s2 = S.shift; S.shift = S.alpha = false; act(s2 ? "SETUP" : "MENU"); });
    const on = rnd("ON", "", "k-on", "ON", () => { S.shift = S.alpha = false; act("ON"); });
    const pad = $("div", "khc-pad");
    [["U", "Lên"], ["L", "Trái"], ["R", "Phải"], ["D", "Xuống"]].forEach(([a, lab]) => { const b = $("button", "pd pd-" + a); b.type = "button"; b.setAttribute("aria-label", lab); b.addEventListener("click", () => { S.shift = S.alpha = false; S.sto = false; act(a); }); pad.append(b); });
    pad.append($("span", "pd-c"));
    const head = $("div", "khc-head",
      $("div", "khc-hs", $("div", "khc-rr", sh, al), $("div", "khc-pair", KEYS_L.map((k) => mkKey(k)))),
      pad,
      $("div", "khc-hs", $("div", "khc-rr", menu, on), $("div", "khc-pair", KEYS_R.map((k) => mkKey(k)))));
    const fn = $("div", "khc-fn", KEYS_FN.map((k) => mkKey(k)));
    const nm = $("div", "khc-num", KEYS_NUM.map((k) => mkKey(k)));
    const body = $("div", "khc-body", $("div", "khc-brand", $("b", "", "Kiến Học"), $("span", "", "máy tính khoa học")), screen, head, fn, nm);
    el.append(bar, body);
    // bàn phím máy tính
    const KB = { "0": "d0", "1": "d1", "2": "d2", "3": "d3", "4": "d4", "5": "d5", "6": "d6", "7": "d7", "8": "d8", "9": "d9", ".": "dot", ",": "comma",
      "+": "add", "-": "sub", "*": "mul", "/": "div", "^": "powx", "(": "lp", ")": "rp", "!": "fact", "%": "pct", "x": "vx", "y": "vy",
      Enter: "EQ", "=": "EQ", Backspace: "DEL", Delete: "AC", Escape: "AC", ArrowLeft: "L", ArrowRight: "R", ArrowUp: "U", ArrowDown: "D", p: "pi" };
    el.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = KB[e.key]; if (!a) return;
      e.preventDefault(); e.stopPropagation(); S.shift = S.alpha = false;
      if (a === "AC" && e.key === "Escape" && app.mode === "comp" && comp.ed.empty() && !app.menu) return close();
      act(a);
    });
    // kéo thả trên máy tính bàn
    let drag = null;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || window.innerWidth < 640) return;
      const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const x = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, e.clientX - drag.dx)), y = Math.max(4, Math.min(window.innerHeight - 60, e.clientY - drag.dy));
      el.style.left = x + "px"; el.style.top = y + "px"; el.style.right = "auto"; el.style.bottom = "auto"; S.pos = { x, y };
    });
    bar.addEventListener("pointerup", () => { if (drag) { drag = null; persist(); } });
    document.body.append(el);
    if (S.pos && window.innerWidth >= 640) { el.style.left = Math.min(S.pos.x, window.innerWidth - 380) + "px"; el.style.top = Math.min(S.pos.y, window.innerHeight - 200) + "px"; el.style.right = "auto"; el.style.bottom = "auto"; }
    if (S.last && S.last !== "comp" && S.last !== "table") { app.mode = "comp"; } else app.mode = S.last || "comp";
  }
  function open() {
    if (!el) build();
    el.hidden = false; requestAnimationFrame(() => el.classList.add("show"));
    el.focus({ preventScroll: true }); draw();
    openBtns.forEach((b) => b.setAttribute("aria-expanded", "true"));
  }
  function close() {
    if (!el) return; el.classList.remove("show"); el.hidden = true;
    openBtns.forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
  const isOpen = () => !!el && !el.hidden;
  function button(cls) {
    const b = $("button", cls || "btn ghost sm khc-open");
    b.type = "button"; b.title = "Máy tính cầm tay"; b.setAttribute("aria-expanded", "false");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="8" y="5.5" width="8" height="4" rx="1" fill="currentColor" opacity=".35"/><g fill="currentColor"><circle cx="9" cy="13" r="1.1"/><circle cx="12" cy="13" r="1.1"/><circle cx="15" cy="13" r="1.1"/><circle cx="9" cy="16.6" r="1.1"/><circle cx="12" cy="16.6" r="1.1"/><circle cx="15" cy="16.6" r="1.1"/></g></svg><span>Máy tính</span>';
    b.addEventListener("click", () => (isOpen() ? close() : open()));
    openBtns = openBtns.filter((x) => x.isConnected); openBtns.push(b);
    return b;
  }
  root.KHCalc = { open, close, toggle: () => (isOpen() ? close() : open()), button, isOpen, _act: (a) => { act(a); }, _state: S };
})(typeof window !== "undefined" ? window : globalThis);
