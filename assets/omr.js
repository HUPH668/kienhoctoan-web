/* Đọc phiếu trả lời trắc nghiệm mẫu Bộ GDĐT (từ 2025) từ ảnh chụp — chạy hoàn toàn trên máy, không gửi ảnh đi đâu.
   OMR.read(imageData) -> { ok, msg, sbd, made, p1[40], p2[8][4], p3[6], flags, quad, score } */
(() => {
  "use strict";
  // Tọa độ (px ở 200 dpi) đo từ phiếu PhieuTL_BGD_2025.pdf
  const L = (() => {
    const sx = [0, 1, 2, 3, 4, 5].map((k) => 1211 + 31.4 * k), mx = [1446.2, 1477.6, 1509];
    const sy = [...Array(10)].map((_, k) => 259.5 + 45.4 * k);
    const p1x = [[233, 301, 369.5, 436.5], [572, 640, 708.5, 776], [910.9, 979, 1047.5, 1114.5], [1251, 1319.3, 1387.5, 1455]];
    const p1y = [890.5, 925.1, 960, 996.9, 1031.5, 1068.5, 1103.5, 1138.5, 1173.2, 1210];
    const p2x = [230.5, 298.6, 368.5, 434.5, 571.8, 639.5, 707.5, 775.5, 910.5, 978.6, 1048.5, 1116.5, 1252, 1320, 1388, 1456];
    const p2y = [1400, 1435, 1470, 1504.9];
    const p3x = [[218, 264.5, 311.5, 358.5], [437, 483.5, 530.5, 577.5], [654, 700.5, 747.5, 794.5], [871, 919.5, 966.5, 1013.5], [1090, 1136.5, 1183.6, 1230.5], [1307, 1353.5, 1400.9, 1447.5]];
    const dy = [1786, 1821, 1858, 1894.5, 1929.5, 1964.5, 2001.4, 2036, 2073, 2109.8];
    return {
      W: 1654, H: 2339, r: 13.5,
      corners: [[103, 100.5], [1549, 100.5], [1549, 2236.5], [103, 2236.5]], // TL TR BR BL
      marks: [[1171, 100.5], [1174.5, 733], [1549, 733], [103, 759.5]],         // dấu đen phụ (để biết chiều phiếu)
      sbd: sx.map((x) => sy.map((y) => [x, y])),
      made: mx.map((x) => sy.map((y) => [x, y])),
      p1: [...Array(40)].map((_, i) => p1x[(i / 10) | 0].map((x) => [x, p1y[i % 10]])),
      p2: [...Array(8)].map((_, q) => p2y.map((y) => [[p2x[2 * q], y], [p2x[2 * q + 1], y]])),
      p3: p3x.map((xs) => ({ minus: [xs[0], 1712.5], comma: [[xs[1], 1747.5], [xs[2], 1747.5]], digits: xs.map((x) => dy.map((y) => [x, y])) })),
    };
  })();

  /* ---------- đại số: homography 4 điểm ---------- */
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / A[i][i];
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = s / A[i][i];
    }
    return x;
  }
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b);
    return h && [...h, 1];
  }
  const mapPt = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };

  /* ---------- ảnh xám: dùng kênh đỏ (mực đỏ của phiếu gần như biến mất, bút chì/bút đen vẫn tối) ---------- */
  function gray(img) {
    const { width: w, height: h, data: d } = img, g = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = d[i]; // kênh đỏ
    return { w, h, g };
  }

  /* ---------- tìm dấu vuông đen ---------- */
  function findMarkers(G) {
    const { w, h, g } = G;
    // ngưỡng thích nghi bằng ảnh tích phân
    const S = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += g[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; }
    }
    const R = Math.max(8, Math.round(Math.min(w, h) / 24));
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
        const s = S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
        const m = s / ((x1 - x0) * (y1 - y0));
        bin[y * w + x] = g[y * w + x] < m * 0.72 && g[y * w + x] < 150 ? 1 : 0;
      }
    }
    // thành phần liên thông
    const lab = new Int32Array(w * h), stack = new Int32Array(w * h), comps = [];
    let id = 0;
    for (let p = 0; p < w * h; p++) {
      if (!bin[p] || lab[p]) continue;
      id++; let sp = 0; stack[sp++] = p; lab[p] = id;
      let n = 0, minx = w, maxx = 0, miny = h, maxy = 0, sx = 0, sy = 0;
      while (sp) {
        const q = stack[--sp], qx = q % w, qy = (q / w) | 0;
        n++; sx += qx; sy += qy;
        if (qx < minx) minx = qx; if (qx > maxx) maxx = qx; if (qy < miny) miny = qy; if (qy > maxy) maxy = qy;
        if (n > 40000) continue;
        const nb = [q - 1, q + 1, q - w, q + w];
        for (let k = 0; k < 4; k++) {
          const t = nb[k];
          if (t < 0 || t >= w * h || lab[t] || !bin[t]) continue;
          if ((k === 0 && qx === 0) || (k === 1 && qx === w - 1)) continue;
          lab[t] = id; stack[sp++] = t;
        }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (n < 12 || bw < 4 || bh < 4) continue;
      const ar = bw / bh, fill = n / (bw * bh);
      if (ar > 0.6 && ar < 1.65 && fill > 0.72) comps.push({ x: sx / n, y: sy / n, s: Math.sqrt(n), n });
    }
    return comps;
  }

  /* ---------- chọn 4 góc + chiều phiếu ---------- */
  function sampleMean(G, H, x, y, rad) {
    const { w, h, g } = G; let s = 0, c = 0;
    for (let dy = -rad; dy <= rad; dy += rad / 3) for (let dx = -rad; dx <= rad; dx += rad / 3) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const [u, v] = mapPt(H, x + dx, y + dy), ix = Math.round(u), iy = Math.round(v);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return null;
      s += g[iy * w + ix]; c++;
    }
    return c ? s / c : null;
  }
  function locate(G, comps) {
    if (comps.length < 4) return null;
    // dấu góc là các khối lớn nhất có kích thước gần nhau
    const big = comps.slice().sort((a, b) => b.n - a.n).slice(0, 14);
    let best = null;
    for (const ref of big.slice(0, 6)) {
      const set = comps.filter((c) => c.s > ref.s * 0.6 && c.s < ref.s * 1.5);
      if (set.length < 4) continue;
      const pick = (f) => set.reduce((a, b) => (f(b) > f(a) ? b : a));
      const tl = pick((c) => -(c.x + c.y)), br = pick((c) => c.x + c.y), tr = pick((c) => c.x - c.y), bl = pick((c) => c.y - c.x);
      const quad = [tl, tr, br, bl];
      if (new Set(quad).size < 4) continue;
      // thử 4 chiều xoay: chiều đúng là chiều mà các dấu phụ đều đen
      for (let rot = 0; rot < 4; rot++) {
        const q = [0, 1, 2, 3].map((k) => quad[(k + rot) % 4]);
        const H = homography(L.corners, q.map((c) => [c.x, c.y]));
        if (!H) continue;
        const paper = sampleMean(G, H, 600, 820, 10), ink = L.marks.map(([x, y]) => sampleMean(G, H, x, y, 8));
        if (paper == null || ink.some((v) => v == null)) continue;
        const sc = ink.reduce((a, v) => a + (paper - v), 0) / ink.length / Math.max(paper, 1);
        // tỉ lệ cạnh phải gần với phiếu (cao/rộng ~ 1.48)
        const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = (d(q[0], q[3]) + d(q[1], q[2])) / (d(q[0], q[1]) + d(q[3], q[2]));
        if (ratio < 1.1 || ratio > 2.0) continue;
        if (!best || sc > best.sc) best = { sc, H, quad: q, ratio };
      }
    }
    return best && best.sc > 0.28 ? best : null;
  }

  /* ---------- đọc mức tô từng ô ---------- */
  function readSheet(G, H) {
    const r = L.r * 0.62;
    const paper = [[600, 820], [1000, 820], [1200, 1620], [1600, 1300], [1580, 1000]].map(([x, y]) => sampleMean(G, H, x, y, 10)).filter((v) => v != null);
    const P = paper.length ? paper.sort((a, b) => a - b)[paper.length >> 1] : 200;
    // nền giấy cục bộ quanh từng ô (vòng bán kính 1,45r) -> chịu được bóng đổ, ánh sáng không đều
    const ring = (x, y) => {
      const { w, h, g } = G, v = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * 2 * Math.PI, [u, t] = mapPt(H, x + Math.cos(a) * L.r * 1.45, y + Math.sin(a) * L.r * 1.45);
        const ix = Math.round(u), iy = Math.round(t);
        if (ix >= 0 && iy >= 0 && ix < w && iy < h) v.push(g[iy * w + ix]);
      }
      v.sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length * 0.7)] : P;
    };
    const fill = (pt) => {
      const m = sampleMean(G, H, pt[0], pt[1], r); if (m == null) return 0;
      const bg = Math.max(ring(pt[0], pt[1]), 40);
      return Math.max(0, (bg - m) / bg);
    };
    const raw = {
      sbd: L.sbd.map((col) => col.map(fill)), made: L.made.map((col) => col.map(fill)),
      p1: L.p1.map((q) => q.map(fill)), p2: L.p2.map((q) => q.map((it) => it.map(fill))),
      p3: L.p3.map((c) => ({ minus: fill(c.minus), comma: c.comma.map(fill), digits: c.digits.map((col) => col.map(fill)) })),
    };
    // ngưỡng theo phân bố thực tế của ảnh: ô trống tập trung ở mức thấp
    const all = [];
    raw.p1.forEach((q) => all.push(...q)); raw.sbd.forEach((c) => all.push(...c)); raw.p2.forEach((q) => q.forEach((it) => all.push(...it)));
    all.sort((a, b) => a - b);
    const empty = all[Math.floor(all.length * 0.5)];
    const ON = Math.max(0.2, empty + 0.18), MAYBE = Math.max(0.12, empty + 0.09);
    return { raw, ON, MAYBE, P };
  }
  function decide(vals, ON, MAYBE) {
    // trả về {i: chỉ số ô được tô | -1 trống | -2 tô nhiều ô, doubt: true nếu cần xem lại}
    const idx = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const [v1, i1] = idx[0], v2 = idx[1] ? idx[1][0] : 0;
    if (v1 < MAYBE) return { i: -1, doubt: false };
    if (v1 < ON) return { i: v2 < MAYBE ? i1 : -1, doubt: true };
    if (v2 >= ON && v2 > v1 * 0.72) return { i: -2, doubt: true };
    return { i: i1, doubt: v2 >= MAYBE && v2 > v1 * 0.6 };
  }
  function interpret(R) {
    const { raw, ON, MAYBE } = R, flags = [];
    const digitCol = (col, tag) => { const d = decide(col, ON, MAYBE); if (d.doubt) flags.push(tag); return d.i >= 0 ? String(d.i) : d.i === -2 ? "*" : "?"; };
    const sbd = raw.sbd.map((c, k) => digitCol(c, "sbd" + k)).join("");
    const made = raw.made.map((c, k) => digitCol(c, "made" + k)).join("");
    const p1 = raw.p1.map((q, i) => { const d = decide(q, ON, MAYBE); if (d.doubt) flags.push("p1_" + i); return d.i >= 0 ? "ABCD"[d.i] : d.i === -2 ? "*" : ""; });
    const p2 = raw.p2.map((q, i) => q.map((it, j) => { const d = decide(it, ON, MAYBE); if (d.doubt) flags.push(`p2_${i}_${j}`); return d.i === 0 ? "D" : d.i === 1 ? "S" : d.i === -2 ? "*" : ""; }));
    const p3 = raw.p3.map((c, i) => {
      let s = "", bad = false;
      for (let k = 0; k < 4; k++) {
        const opts = c.digits[k].slice(); const lab = "0123456789".split("");
        if (k === 0) { opts.push(c.minus); lab.push("-"); }
        if (k === 1 || k === 2) { opts.push(c.comma[k - 1]); lab.push(","); }
        const d = decide(opts, ON, MAYBE);
        if (d.doubt) bad = true;
        if (d.i === -2) { s += "*"; bad = true; } else if (d.i >= 0) s += lab[d.i];
      }
      if (bad) flags.push("p3_" + i);
      return s;
    });
    return { sbd, made, p1, p2, p3, flags };
  }

  /* ---------- API ---------- */
  function read(img) {
    const G = gray(img);
    const comps = findMarkers(G);
    const loc = locate(G, comps);
    if (!loc) return { ok: false, msg: "Chưa thấy đủ 4 ô vuông đen ở 4 góc phiếu. Đưa cả tờ phiếu vào khung, đủ sáng, không bị che góc." };
    const R = readSheet(G, loc.H);
    const out = interpret(R);
    return Object.assign({ ok: true, H: loc.H, quad: loc.quad.map((c) => [c.x, c.y]), raw: R.raw, ON: R.ON, MAYBE: R.MAYBE }, out);
  }
  // nhanh: chỉ tìm 4 góc (dùng khi xem camera trực tiếp)
  function findQuad(img) {
    const G = gray(img), loc = locate(G, findMarkers(G));
    return loc ? loc.quad.map((c) => [c.x, c.y]) : null;
  }
  // vẽ phiếu đã nắn thẳng (để giáo viên đối chiếu) vào canvas, tỉ lệ k so với 200 dpi
  function warp(img, H, k) {
    const W = Math.round(L.W * k), Hh = Math.round(L.H * k), out = new ImageData(W, Hh), s = img.data, d = out.data, iw = img.width, ih = img.height;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const [u, v] = mapPt(H, x / k, y / k), ix = u | 0, iy = v | 0, o = (y * W + x) * 4;
      if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) { d[o] = d[o + 1] = d[o + 2] = 235; d[o + 3] = 255; continue; }
      const i = (iy * iw + ix) * 4; d[o] = s[i]; d[o + 1] = s[i + 1]; d[o + 2] = s[i + 2]; d[o + 3] = 255;
    }
    return out;
  }
  window.OMR = { read, findQuad, warp, layout: L, mapPt };
})();
