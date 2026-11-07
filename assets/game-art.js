/* Hình vẽ các linh thú (SVG tự vẽ, không dùng hình có bản quyền). KT.monArt(id, {stage, flip, size}) → chuỗi SVG */
(() => {
  "use strict";
  const KT = window.KT || (window.KT = {});
  const D = window.GAMEDATA;
  let uid = 0;
  const pal = (t) => D.types[t];

  // khuôn mặt dễ thương: hai mắt to có ánh sáng, má hồng, miệng
  function face(cx, cy, s, o = {}) {
    const dx = 11 * s, ex = 4.6 * s, ey = 5.6 * s, d = o.ink || "#1d1530";
    let g = "";
    if (o.mask) g += `<ellipse cx="${cx}" cy="${cy + 2 * s}" rx="${20 * s}" ry="${11 * s}" fill="${o.mask}"/>`;
    [-1, 1].forEach((k) => {
      const x = cx + k * dx;
      if (o.disc) g += `<circle cx="${x}" cy="${cy}" r="${9 * s}" fill="${o.disc}" stroke="${o.line}" stroke-width="2"/>`;
      g += `<g class="mon-eye"><ellipse cx="${x}" cy="${cy}" rx="${ex}" ry="${ey}" fill="${d}"/>`
        + `<circle cx="${x + 1.6 * s}" cy="${cy - 2 * s}" r="${1.9 * s}" fill="#fff"/><circle cx="${x - 1.5 * s}" cy="${cy + 2 * s}" r="${0.9 * s}" fill="#fff" opacity=".8"/></g>`
        + `<path class="mon-eye-c" d="M${x - ex} ${cy + 1 * s} Q${x} ${cy - 4 * s} ${x + ex} ${cy + 1 * s}" fill="none" stroke="${d === "#fff" ? "#1d1530" : d}" stroke-width="${2.4 * s}" stroke-linecap="round"/>`;
      if (!o.noCheek) g += `<ellipse cx="${cx + k * (dx + 6 * s)}" cy="${cy + 7 * s}" rx="${4 * s}" ry="${2.4 * s}" fill="#ff7aa2" opacity=".55"/>`;
    });
    if (o.beak) g += `<path d="M${cx - 4 * s} ${cy + 5 * s} L${cx + 4 * s} ${cy + 5 * s} L${cx} ${cy + 11 * s}Z" fill="#ffb02e" stroke="#b9650a" stroke-width="1.5" stroke-linejoin="round"/>`;
    else if (o.fang) g += `<path d="M${cx - 5 * s} ${cy + 7 * s} Q${cx} ${cy + 11 * s} ${cx + 5 * s} ${cy + 7 * s}" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/><path d="M${cx - 3 * s} ${cy + 8.4 * s} l1.2 ${3 * s} l1.2 ${-2.6 * s}M${cx + 0.6 * s} ${cy + 8.8 * s} l1.2 ${2.8 * s} l1.2 ${-3 * s}" fill="#fff" stroke="${d}" stroke-width="1"/>`;
    else if (o.wide) g += `<path d="M${cx - 12 * s} ${cy + 8 * s} Q${cx} ${cy + 17 * s} ${cx + 12 * s} ${cy + 8 * s}" fill="#5b1a2e" stroke="${d}" stroke-width="2" stroke-linejoin="round"/><path d="M${cx - 5 * s} ${cy + 12.4 * s} Q${cx} ${cy + 15 * s} ${cx + 5 * s} ${cy + 12.4 * s}" fill="#ff7a96"/>`;
    else g += `<path d="M${cx - 4.5 * s} ${cy + 7 * s} q${2.25 * s} ${3 * s} ${4.5 * s} 0 q${2.25 * s} ${3 * s} ${4.5 * s} 0" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    return g;
  }
  // khuôn mặt "ngầu": mắt xếch có ánh sáng, mày nhíu, miệng cười để lộ hàm răng nhọn
  function fierce(cx, cy, s, p, o = {}) {
    const d = "#1d1530", dx = 11 * s;
    let g = "";
    [-1, 1].forEach((k) => {
      const x = cx + k * dx;
      g += `<g class="mon-eye"><path d="M${x - 5 * s} ${cy - (k < 0 ? 2.2 : -0.6) * s} Q${x} ${cy - 5.5 * s} ${x + 5 * s} ${cy - (k < 0 ? -0.6 : 2.2) * s} Q${x + 4.6 * s} ${cy + 5.6 * s} ${x} ${cy + 5.4 * s} Q${x - 4.6 * s} ${cy + 5.6 * s} ${x - 5 * s} ${cy - (k < 0 ? 2.2 : -0.6) * s}Z" fill="#fffbe6" stroke="${d}" stroke-width="1.6"/>`
        + `<circle cx="${x + k * -1 * s}" cy="${cy + 1 * s}" r="${2.9 * s}" fill="${d}"/><circle cx="${x + (1 - k) * 0.6 * s}" cy="${cy - 0.4 * s}" r="${1.1 * s}" fill="#fff"/></g>`
        + `<path class="mon-eye-c" d="M${x - 5 * s} ${cy + 1 * s} Q${x} ${cy - 3 * s} ${x + 5 * s} ${cy + 1 * s}" fill="none" stroke="${d}" stroke-width="${2.4 * s}" stroke-linecap="round"/>`
        + `<path d="M${cx + k * 17 * s} ${cy - 10 * s} L${cx + k * 4 * s} ${cy - 5 * s}" stroke="${d}" stroke-width="${3.4 * s}" stroke-linecap="round"/>`;
      if (!o.noCheek) g += `<ellipse cx="${cx + k * (dx + 6 * s)}" cy="${cy + 8 * s}" rx="${3.6 * s}" ry="${2.2 * s}" fill="#ff7aa2" opacity=".5"/>`;
    });
    if (o.noMouth) return g;
    const my = cy + (o.mouthY || 8) * s, w = (o.big ? 15 : 12) * s, dp = (o.big ? 13 : 10) * s, n = o.big ? 7 : 5, tw = (2 * w) / n;
    g += `<path d="M${cx - w} ${my} Q${cx} ${my + dp * 1.6} ${cx + w} ${my}Z" fill="#5b1a2e" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>`
      + `<path d="M${cx - w * 0.45} ${my + dp * 0.62} Q${cx} ${my + dp * 0.9} ${cx + w * 0.45} ${my + dp * 0.62} Q${cx} ${my + dp * 0.35} ${cx - w * 0.45} ${my + dp * 0.62}Z" fill="#ff7a96"/>`;
    let t = "";
    for (let i = 0; i < n; i++) t += `M${(cx - w + i * tw).toFixed(1)} ${my} l${(tw / 2).toFixed(1)} ${(3.8 * s).toFixed(1)} l${(tw / 2).toFixed(1)} ${(-3.8 * s).toFixed(1)}Z `;
    t += `M${(cx - w * 0.62).toFixed(1)} ${(my + dp * 0.72).toFixed(1)} l${(1.8 * s).toFixed(1)} ${(-3.2 * s).toFixed(1)} l${(1.8 * s).toFixed(1)} ${(3.4 * s).toFixed(1)}Z M${(cx + w * 0.62 - 3.6 * s).toFixed(1)} ${(my + dp * 0.74).toFixed(1)} l${(1.8 * s).toFixed(1)} ${(-3.4 * s).toFixed(1)} l${(1.8 * s).toFixed(1)} ${(3.2 * s).toFixed(1)}Z`;
    return g + `<path d="${t}" fill="#fff" stroke="${d}" stroke-width="1" stroke-linejoin="round"/>`;
  }
  const emb = (x, y, t, col, size) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="'Be Vietnam Pro',system-ui,sans-serif" font-weight="800" font-size="${size || (t.length > 2 ? 11 : t.length > 1 ? 13 : 16)}" fill="${col}">${t}</text>`;

  // các dáng cơ thể: trả về {back, body, face(cx,cy,s,opt)}
  const SH = {
    cat(p, e) {
      return `<path class="mon-tail" d="M86 86 C104 84 110 66 102 56 C98 51 92 54 95 59 C99 66 94 76 84 78" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<path d="M34 50 L38 22 L56 40Z M86 50 L82 22 L64 40Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<path d="M39 41 L41 29 L50 39Z M81 41 L79 29 L70 39Z" fill="${p.l}"/>`
        + `<ellipse cx="60" cy="70" rx="33" ry="31" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="86" rx="18" ry="12" fill="${p.l}"/>` + emb(60, 87, e, p.d)
        + `<ellipse cx="46" cy="99" rx="8" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/><ellipse cx="74" cy="99" rx="8" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/>`
        + face(60, 63, 1) + `<path d="M28 64 l-10 -2 M28 69 l-10 2 M92 64 l10 -2 M92 69 l10 2" stroke="${p.d}" stroke-width="1.6" stroke-linecap="round"/>`;
    },
    bunny(p, e) {
      return `<g class="mon-ear l"><ellipse cx="46" cy="30" rx="8" ry="22" transform="rotate(-12 46 30)" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/><ellipse cx="46" cy="31" rx="3.6" ry="15" transform="rotate(-12 46 31)" fill="${p.l}"/></g>`
        + `<g class="mon-ear r"><ellipse cx="74" cy="30" rx="8" ry="22" transform="rotate(12 74 30)" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/><ellipse cx="74" cy="31" rx="3.6" ry="15" transform="rotate(12 74 31)" fill="${p.l}"/></g>`
        + `<circle cx="92" cy="88" r="8" fill="#fff" stroke="${p.d}" stroke-width="2.4"/>`
        + `<ellipse cx="60" cy="73" rx="31" ry="30" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="88" rx="17" ry="11" fill="${p.l}"/>` + emb(60, 89, e, p.d)
        + `<ellipse cx="45" cy="101" rx="9" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/><ellipse cx="75" cy="101" rx="9" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/>`
        + face(60, 67, 1) + `<path d="M58 72 h4 l-2 2z" fill="#ff7aa2"/>`;
    },
    bird(p, e) {
      return `<path d="M60 18 L52 40 L68 40Z" fill="${p.l}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/><path d="M48 24 L48 42 L60 40Z M72 24 L72 42 L60 40Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path class="mon-wing" d="M30 66 C14 66 10 84 18 92 C26 86 30 80 34 76Z M90 66 C106 66 110 84 102 92 C94 86 90 80 86 76Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<ellipse cx="60" cy="70" rx="31" ry="32" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="86" rx="18" ry="13" fill="${p.l}"/>` + emb(60, 88, e, p.d)
        + `<path d="M50 101 v7 m-4 0 h8 M70 101 v7 m-4 0 h8" stroke="#e08a12" stroke-width="3" stroke-linecap="round"/>`
        + face(60, 62, 1, { beak: true });
    },
    fish(p, e) {
      return `<path class="mon-fin" d="M88 64 L112 46 L108 66 L112 86Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M46 42 C54 28 70 28 78 42Z" fill="${p.l}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<ellipse cx="58" cy="66" rx="38" ry="27" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M28 76 q8 -6 16 0 t16 0 t16 0 t14 0" fill="none" stroke="${p.l}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M56 82 C50 92 62 96 66 86Z" fill="${p.l}" stroke="${p.d}" stroke-width="2"/>`
        + emb(82, 60, e, p.d, 11) + face(46, 60, 0.95)
        + `<circle cx="18" cy="40" r="4" fill="none" stroke="${p.l}" stroke-width="2"/><circle cx="10" cy="28" r="2.6" fill="none" stroke="${p.l}" stroke-width="1.6"/>`;
    },
    dragon(p, e) {
      return `<path class="mon-wing" d="M30 58 C10 40 6 62 12 72 L22 66 L22 78 L32 72Z M90 58 C110 40 114 62 108 72 L98 66 L98 78 L88 72Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path class="mon-tail" d="M84 88 C100 96 108 90 112 80 L104 82 L108 74 L98 80" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M44 42 C40 30 42 22 48 18 C48 28 52 34 54 40Z M76 42 C80 30 78 22 72 18 C72 28 68 34 66 40Z" fill="${p.l}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<ellipse cx="60" cy="70" rx="32" ry="32" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M44 80 Q60 76 76 80 M46 88 Q60 84 74 88 M49 96 Q60 92 71 96" fill="none" stroke="${p.l}" stroke-width="4" stroke-linecap="round"/>`
        + `<circle cx="60" cy="88" r="9" fill="${p.l}" stroke="${p.d}" stroke-width="1.6"/>` + emb(60, 88.5, e, p.d, e.length > 1 ? 10 : 13)
        + `<ellipse cx="46" cy="101" rx="8" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/><ellipse cx="74" cy="101" rx="8" ry="5" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/>`
        + face(60, 62, 1, { fang: true });
    },
    golem(p, e) {
      return `<g class="mon-arm"><rect x="16" y="58" width="14" height="26" rx="6" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/><rect x="90" y="58" width="14" height="26" rx="6" fill="${p.c}" stroke="${p.d}" stroke-width="2.4"/></g>`
        + `<path d="M28 40 L42 28 H94 L80 40Z" fill="${p.l}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M80 40 L94 28 V88 L80 100Z" fill="${p.d}" opacity=".9" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<rect x="28" y="40" width="52" height="60" rx="6" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<rect x="40" y="76" width="28" height="18" rx="4" fill="${p.l}"/>` + emb(54, 85, e, p.d)
        + `<rect x="32" y="100" width="14" height="8" rx="3" fill="${p.d}"/><rect x="62" y="100" width="14" height="8" rx="3" fill="${p.d}"/>`
        + face(54, 58, 0.95, { noCheek: false });
    },
    dice(p, e) {
      const pip = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${p.d}"/>`;
      return `<path d="M30 42 L44 30 H96 L82 42Z" fill="${p.l}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>` + pip(54, 36) + pip(70, 36) + pip(86, 36)
        + `<path d="M82 42 L96 30 V88 L82 100Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<circle cx="89" cy="52" r="2.6" fill="#fff"/><circle cx="89" cy="78" r="2.6" fill="#fff"/>`
        + `<rect x="30" y="42" width="52" height="58" rx="9" fill="#fff" stroke="${p.d}" stroke-width="2.6"/>`
        + `<rect x="30" y="42" width="52" height="58" rx="9" fill="${p.c}" opacity=".28"/>`
        + pip(40, 52) + pip(72, 52) + pip(40, 90) + pip(72, 90)
        + `<path class="mon-arm" d="M22 64 q-8 6 -2 14 M90 64 q8 6 2 14" fill="none" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="36" y="100" width="12" height="8" rx="3" fill="${p.d}"/><rect x="64" y="100" width="12" height="8" rx="3" fill="${p.d}"/>`
        + face(56, 68, 0.95);
    },
    bee(p, e) {
      return `<g class="mon-flap"><ellipse cx="38" cy="40" rx="13" ry="18" transform="rotate(-30 38 40)" fill="#e9fbff" fill-opacity=".75" stroke="${p.d}" stroke-width="2"/><ellipse cx="82" cy="40" rx="13" ry="18" transform="rotate(30 82 40)" fill="#e9fbff" fill-opacity=".75" stroke="${p.d}" stroke-width="2"/></g>`
        + `<path d="M50 34 Q44 20 38 18 M70 34 Q76 20 82 18" fill="none" stroke="${p.d}" stroke-width="2.4" stroke-linecap="round"/><circle cx="38" cy="18" r="4" fill="${p.d}"/><circle cx="82" cy="18" r="4" fill="${p.d}"/>`
        + `<path d="M60 102 l-5 8 h10z" fill="${p.d}"/>`
        + `<ellipse cx="60" cy="70" rx="31" ry="33" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M31 78 Q60 86 89 78 M34 90 Q60 98 86 90" fill="none" stroke="${p.d}" stroke-width="5.5" stroke-linecap="round"/>`
        + `<path d="M60 40 l7 4 v8 l-7 4 l-7 -4 v-8z" fill="${p.l}" stroke="${p.d}" stroke-width="1.6"/>`
        + face(60, 64, 0.95);
    },
    bug(p, e) {
      return `<g class="mon-ant"><path d="M48 34 Q42 20 34 20 M72 34 Q78 20 86 20" fill="none" stroke="${p.d}" stroke-width="2.4" stroke-linecap="round"/><circle cx="34" cy="20" r="4" fill="${p.c}" stroke="${p.d}" stroke-width="2"/><circle cx="86" cy="20" r="4" fill="${p.c}" stroke="${p.d}" stroke-width="2"/></g>`
        + `<path d="M24 88 l-10 6 M28 74 l-12 0 M96 88 l10 6 M92 74 l12 0" stroke="${p.d}" stroke-width="3" stroke-linecap="round"/>`
        + `<ellipse cx="60" cy="72" rx="36" ry="32" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M60 44 V104" stroke="${p.d}" stroke-width="2.4"/>`
        + `<circle cx="42" cy="84" r="8" fill="none" stroke="${p.l}" stroke-width="3"/><circle cx="42" cy="84" r="2.5" fill="${p.l}"/><circle cx="78" cy="84" r="8" fill="none" stroke="${p.l}" stroke-width="3"/><circle cx="78" cy="84" r="2.5" fill="${p.l}"/>`
        + `<path d="M34 54 Q60 30 86 54 Q60 66 34 54Z" fill="${p.d}"/>`
        + face(60, 52, 0.85, { ink: "#fff", noCheek: true }).replace(/fill="#fff"/g, 'fill="#1d1530"');
    },
    frog(p, e) {
      return `<circle cx="40" cy="44" r="14" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/><circle cx="80" cy="44" r="14" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="74" rx="40" ry="28" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="86" rx="24" ry="14" fill="${p.l}"/>` + emb(60, 89, e, p.d)
        + `<path d="M24 96 q-6 8 4 8 h12 M96 96 q6 8 -4 8 h-12" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<g class="mon-eye"><circle cx="40" cy="44" r="7.5" fill="#fff"/><circle cx="41" cy="45" r="4.4" fill="#1d1530"/><circle cx="42.5" cy="43" r="1.5" fill="#fff"/></g><g class="mon-eye"><circle cx="80" cy="44" r="7.5" fill="#fff"/><circle cx="79" cy="45" r="4.4" fill="#1d1530"/><circle cx="80.5" cy="43" r="1.5" fill="#fff"/></g>`
        + `<path class="mon-eye-c" d="M33 46 Q40 40 47 46 M73 46 Q80 40 87 46" fill="none" stroke="#1d1530" stroke-width="2.6" stroke-linecap="round"/>`
        + `<path d="M42 66 Q60 78 78 66" fill="none" stroke="${p.d}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="34" cy="68" rx="5" ry="3" fill="#ff7aa2" opacity=".55"/><ellipse cx="86" cy="68" rx="5" ry="3" fill="#ff7aa2" opacity=".55"/>`;
    },
    fox(p, e) {
      return `<g class="mon-tail"><path d="M82 92 C106 98 116 76 108 58 C106 70 98 74 92 70 C98 62 96 54 92 50 C90 66 84 74 78 80Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/><path d="M108 58 C106 70 98 74 92 70 C98 62 96 54 92 50 C100 52 106 54 108 58Z" fill="#fff4d6"/></g>`
        + `<path d="M30 52 L32 16 L56 38Z M90 52 L88 16 L64 38Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/><path d="M35 44 L36 26 L49 38Z M85 44 L84 26 L71 38Z" fill="${p.d}" opacity=".65"/>`
        + `<ellipse cx="60" cy="70" rx="32" ry="31" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M36 66 Q60 58 84 66 Q78 84 60 86 Q42 84 36 66Z" fill="#fff4d6"/>`
        + `<circle cx="60" cy="74" r="2.8" fill="#1d1530"/>` + emb(60, 94, e, p.d, 12)
        + `<ellipse cx="46" cy="100" rx="8" ry="5" fill="${p.d}"/><ellipse cx="74" cy="100" rx="8" ry="5" fill="${p.d}"/>`
        + face(60, 62, 0.95);
    },
    owl(p, e) {
      return `<path d="M34 42 L30 22 L48 36Z M86 42 L90 22 L72 36Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M60 30 C88 30 94 56 92 74 C90 96 76 104 60 104 C44 104 30 96 28 74 C26 56 32 30 60 30Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path class="mon-wing" d="M28 70 C20 82 26 96 38 98 C34 88 34 78 36 70Z M92 70 C100 82 94 96 82 98 C86 88 86 78 84 70Z" fill="${p.d}"/>`
        + `<ellipse cx="60" cy="86" rx="17" ry="14" fill="${p.l}"/>` + emb(60, 88, e, p.d, 11)
        + `<path d="M50 104 v5 M54 104 v5 M66 104 v5 M70 104 v5" stroke="#e08a12" stroke-width="2.6" stroke-linecap="round"/>`
        + face(60, 56, 0.9, { disc: p.l, line: p.d, beak: true, noCheek: true });
    },
    snake(p, e) {
      const path = "M78 30 C64 22 52 34 58 50 C64 66 70 74 62 90 C56 102 40 102 36 92";
      return `<path d="${path}" fill="none" stroke="${p.d}" stroke-width="24" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${p.c}" stroke-width="18" stroke-linecap="round"/>`
        + `<path d="${path}" fill="none" stroke="${p.l}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>`
        + `<ellipse cx="80" cy="34" rx="18" ry="16" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M80 50 v6 l-3 3 M80 56 l3 3" stroke="#ff5470" stroke-width="2" stroke-linecap="round" fill="none"/>`
        + face(80, 32, 0.78, { noCheek: false })
        + emb(36, 92, e, p.d, 12);
    },
    slime(p, e) {
      return `<path d="M60 22 C66 34 92 50 94 76 C96 96 80 104 60 104 C40 104 24 96 26 76 C28 50 54 34 60 22Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M40 58 C42 50 48 44 52 42" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="38" cy="66" r="2.6" fill="#fff" opacity=".7"/>`
        + `<ellipse cx="60" cy="92" rx="18" ry="8" fill="${p.l}" opacity=".9"/>` + emb(60, 92, e, p.d, e.length > 1 ? 11 : 16)
        + face(60, 72, 1);
    },
    bat(p, e) {
      return `<path class="mon-wing" d="M34 60 C20 44 6 50 4 60 C10 58 14 62 12 68 C18 64 22 68 22 74 C26 70 30 72 34 76Z M86 60 C100 44 114 50 116 60 C110 58 106 62 108 68 C102 64 98 68 98 74 C94 70 90 72 86 76Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M40 46 L38 24 L54 38Z M80 46 L82 24 L66 38Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<ellipse cx="60" cy="70" rx="29" ry="30" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="86" rx="16" ry="11" fill="${p.l}"/>` + emb(60, 87, e, p.d, 11)
        + `<path d="M50 99 l-2 7 M54 99 l0 7 M66 99 l0 7 M70 99 l2 7" stroke="${p.d}" stroke-width="2.4" stroke-linecap="round"/>`
        + face(60, 62, 0.95, { fang: true });
    },
    turtle(p, e) {
      return `<ellipse cx="34" cy="96" rx="9" ry="6" fill="${p.l}" stroke="${p.d}" stroke-width="2.4"/><ellipse cx="80" cy="98" rx="9" ry="6" fill="${p.l}" stroke="${p.d}" stroke-width="2.4"/>`
        + `<path d="M104 86 l10 4 l-10 2z" fill="${p.l}" stroke="${p.d}" stroke-width="2"/>`
        + `<path d="M20 90 C20 54 44 40 66 40 C92 40 108 62 106 90Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<circle cx="64" cy="70" r="17" fill="none" stroke="${p.l}" stroke-width="3"/><path d="M64 53 V87 M47 70 H81 M52 58 L76 82 M76 58 L52 82" stroke="${p.l}" stroke-width="1.8"/>`
        + `<path d="M18 90 H108" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`
        + `<circle cx="24" cy="70" r="15" fill="${p.l}" stroke="${p.d}" stroke-width="2.6"/>`
        + face(24, 68, 0.72);
    },
    coin(p, e) {
      return `<path class="mon-arm" d="M24 70 q-10 4 -8 14 M96 70 q10 4 8 14" fill="none" stroke="${p.d}" stroke-width="5" stroke-linecap="round"/>`
        + `<rect x="40" y="96" width="12" height="10" rx="4" fill="${p.d}"/><rect x="68" y="96" width="12" height="10" rx="4" fill="${p.d}"/>`
        + `<circle cx="60" cy="66" r="36" fill="${p.d}"/><circle cx="60" cy="63" r="35" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<circle cx="60" cy="63" r="27" fill="none" stroke="${p.l}" stroke-width="2.4" stroke-dasharray="3 4"/>`
        + `<path d="M40 40 A28 28 0 0 1 64 34" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>`
        + emb(60, 82, e, p.d, 13) + face(60, 58, 0.95);
    },
    // ---- nhóm "ngầu": mắt xếch, mày nhíu, răng nanh ----
    spiky(p, e) {
      let sp = "";
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.08 + i * 0.105), r0 = 28, r1 = 44, w = 0.13;
        const P = (ang, r) => (60 + r * Math.cos(ang)).toFixed(1) + " " + (72 + r * Math.sin(ang)).toFixed(1);
        sp += `M${P(a - w, r0)} L${P(a, r1 - (i % 2) * 6)} L${P(a + w, r0)}Z `;
      }
      return `<path class="mon-tail" d="M86 92 C98 98 106 94 108 86 L100 88 L104 80 L94 86" fill="${p.d}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>`
        + `<path d="${sp}" fill="${p.d}" stroke="${p.d}" stroke-width="2.2" stroke-linejoin="round"/>`
        + `<path d="${sp}" fill="${p.l}" opacity=".35" transform="translate(60 72) scale(.82) translate(-60 -72)"/>`
        + `<ellipse cx="60" cy="74" rx="31" ry="29" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<ellipse cx="60" cy="90" rx="17" ry="10" fill="${p.l}"/>` + emb(60, 91, e, p.d, 12)
        + `<path d="M38 100 l-3 6 h12 l-2 -6 M74 100 l-2 6 h12 l-3 -6" fill="${p.d}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>`
        + fierce(60, 66, 1, p);
    },
    beetle(p, e) {
      const leg = (x, y, dx) => `<path d="M${x} ${y} l${dx} 4 l${dx / 2} 8" fill="none" stroke="${p.d}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<g class="mon-arm">${leg(30, 78, -10)}${leg(32, 90, -9)}${leg(90, 78, 10)}${leg(88, 90, 9)}</g>`
        + `<ellipse cx="60" cy="82" rx="34" ry="24" fill="${p.d}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M28 80 C30 64 46 58 60 60 V104 C42 104 28 96 28 80Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M92 80 C90 64 74 58 60 60 V104 C78 104 92 96 92 80Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M36 74 L46 68 L50 80 L40 86Z M84 74 L74 68 L70 80 L80 86Z" fill="${p.l}" opacity=".7"/>`
        + emb(76, 93, e, p.d, 12)
        + `<path d="M48 48 C44 32 52 16 70 6 C68 14 70 20 82 18 C76 26 72 36 72 48Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M54 44 C52 32 58 22 66 16" fill="none" stroke="${p.l}" stroke-width="3" stroke-linecap="round" opacity=".75"/>`
        + `<ellipse cx="60" cy="58" rx="22" ry="17" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M44 50 Q60 42 76 50" fill="none" stroke="${p.l}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`
        + fierce(60, 58, 0.78, p, { noCheek: true });
    },
    shark(p, e) {
      return `<path class="mon-tail" d="M86 86 C98 84 104 78 112 66 C110 80 112 90 116 100 C106 94 98 94 86 96Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M54 42 C58 26 68 18 78 16 C74 26 74 36 76 46Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + `<path d="M60 38 C86 38 96 58 94 76 C92 96 78 104 60 104 C42 104 28 96 26 76 C24 58 34 38 60 38Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M30 80 C40 94 52 98 60 98 C68 98 80 94 90 80 C88 96 76 104 60 104 C44 104 32 96 30 80Z" fill="#f4f7ff"/>`
        + `<path d="M84 60 q-3 5 0 10 M89 62 q-3 4 0 8" fill="none" stroke="${p.d}" stroke-width="2" stroke-linecap="round"/>`
        + `<path class="mon-arm" d="M28 78 C16 80 12 90 14 94 C20 92 26 88 32 86Z M92 78 C104 80 108 90 106 94 C100 92 94 88 88 86Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.4" stroke-linejoin="round"/>`
        + emb(60, 92, e, p.d, 11)
        + fierce(58, 60, 1.05, p, { big: true });
    },
    wolf(p, e) {
      let mane = "";
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.78 + i * 0.145), P = (r, da) => (60 + r * Math.cos(a + da)).toFixed(1) + " " + (66 + r * Math.sin(a + da)).toFixed(1);
        mane += `M${P(26, -0.16)} L${P(40, 0)} L${P(26, 0.16)}Z `;
      }
      return `<path class="mon-tail" d="M84 94 C104 100 114 84 110 66 L104 74 L102 62 L96 74 C94 80 90 86 82 88Z" fill="${p.d}" stroke="${p.d}" stroke-width="2.2" stroke-linejoin="round"/>`
        + `<path d="M34 48 L30 14 L54 36Z M86 48 L90 14 L66 36Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/><path d="M37 40 L35 24 L47 36Z M83 40 L85 24 L73 36Z" fill="${p.l}"/>`
        + `<path d="${mane}" fill="${p.d}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>`
        + `<ellipse cx="60" cy="72" rx="31" ry="30" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M56 34 a8 8 0 1 0 8 10 a6 6 0 1 1 -8 -10Z" fill="${p.l}" stroke="${p.d}" stroke-width="1.4"/>`
        + `<ellipse cx="60" cy="78" rx="16" ry="11" fill="${p.l}"/><ellipse cx="60" cy="72" rx="4" ry="3" fill="#1d1530"/>`
        + `<ellipse cx="46" cy="102" rx="8" ry="5" fill="${p.d}"/><ellipse cx="74" cy="102" rx="8" ry="5" fill="${p.d}"/>`
        + emb(60, 93, e, "#fff", 10)
        + fierce(60, 60, 0.95, p, { mouthY: 16, noCheek: true });
    },
    mimic(p, e) {
      let tb = "", tt = "";
      for (let i = 0; i < 6; i++) { const x = 32 + i * 10; tb += `M${x} 66 l5 -6 l5 6Z `; tt += `M${x} 46 l5 6 l5 -6Z `; }
      return `<rect x="34" y="100" width="10" height="9" rx="3" fill="${p.d}"/><rect x="76" y="100" width="10" height="9" rx="3" fill="${p.d}"/>`
        + `<path d="M28 46 H92 V70 H28Z" fill="#5b1a2e"/><path d="M48 66 C50 56 70 56 72 66Z" fill="#ff7a96"/>`
        + `<rect x="26" y="64" width="68" height="38" rx="6" fill="${p.c}" stroke="${p.d}" stroke-width="2.6"/>`
        + `<path d="M26 76 H94 M26 90 H94" stroke="${p.d}" stroke-width="2" opacity=".5"/>`
        + `<path d="M40 64 V102 M80 64 V102" stroke="#e7b53c" stroke-width="5"/>`
        + `<path d="${tb}" fill="#fff" stroke="${p.d}" stroke-width="1.2" stroke-linejoin="round"/>`
        + `<rect x="50" y="74" width="20" height="18" rx="4" fill="#ffd23f" stroke="#a8650a" stroke-width="1.8"/>` + emb(60, 83.5, e, "#a8650a", 13)
        + `<g class="mon-lid"><path d="M24 48 C24 28 40 20 60 20 C80 20 96 28 96 48Z" fill="${p.c}" stroke="${p.d}" stroke-width="2.6" stroke-linejoin="round"/>`
        + `<path d="M40 22 V48 M80 22 V48" stroke="#e7b53c" stroke-width="5"/>`
        + `<path d="${tt}" fill="#fff" stroke="${p.d}" stroke-width="1.2" stroke-linejoin="round"/>`
        + fierce(60, 36, 0.8, p, { noMouth: true, noCheek: true }) + `</g>`
        + `<path d="M92 66 l4 -4 M95 74 h6 M14 60 l4 3" stroke="${p.l}" stroke-width="2.4" stroke-linecap="round"/>`;
    },
  };

  // phụ kiện riêng cho các con có cùng dáng
  const ACC = {
    vocuc: (p) => `<ellipse cx="60" cy="72" rx="46" ry="12" transform="rotate(-14 60 72)" fill="none" stroke="${p.l}" stroke-width="2.4" stroke-dasharray="7 5" opacity=".9"/>`,
    cosu: (p) => `<path d="M48 30 q6 -10 12 -2 q6 8 12 -2" fill="none" stroke="${p.l}" stroke-width="3.4" stroke-linecap="round"/><circle cx="92" cy="50" r="4" fill="none" stroke="${p.l}" stroke-width="2"/><circle cx="100" cy="40" r="2.4" fill="none" stroke="${p.l}" stroke-width="1.6"/>`,
    combi: (p) => `<path d="M60 36 l5 6 l-5 6 l-5 -6z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.4"/>`,
    maymi: (p) => `<path d="M76 32 l10 -6 v12z M76 32 l-10 -6 v12z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.4" stroke-linejoin="round"/><circle cx="76" cy="32" r="3" fill="#ffb02e" stroke="#a8650a" stroke-width="1.2"/>`,
    pibo: (p) => `<path d="M44 102 q16 6 32 0" fill="none" stroke="${p.d}" stroke-width="0"/>`,
  };
  function aura(id, p, stage) {
    if (stage < 2) return "";
    return `<defs><radialGradient id="au${id}"><stop offset="0" stop-color="${p.l}" stop-opacity=".9"/><stop offset=".55" stop-color="${p.c}" stop-opacity=".35"/><stop offset="1" stop-color="${p.c}" stop-opacity="0"/></radialGradient></defs>`
      + `<circle cx="60" cy="66" r="${stage > 2 ? 60 : 52}" fill="url(#au${id})" class="mon-aura"/>`;
  }
  // cánh ánh sáng phía sau khi tiến hoá: Trưởng thành cánh nhỏ màu hệ, Huyền thoại cánh vàng lớn
  function wings(p, stage) {
    if (stage < 2) return "";
    const big = stage >= 3, f = big ? "#ffe9a3" : p.l, st = big ? "#f0b429" : p.c;
    const L = big ? "M50 62 C30 22 0 22 -2 46 C-3 60 10 66 20 64 C8 72 10 86 24 86 C34 86 44 80 50 74Z" : "M50 64 C36 40 14 38 12 54 C11 66 26 72 48 74Z";
    return `<g class="mon-fx" opacity="${big ? 0.95 : 0.85}"><path d="${L}" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`
      + `<path d="${L}" transform="translate(120 0) scale(-1 1)" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`
      + (big ? `<path d="M40 54 C28 40 14 38 8 46 M40 64 C26 60 14 62 10 70 M80 54 C92 40 106 38 112 46 M80 64 C94 60 106 62 110 70" fill="none" stroke="#f0b429" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>` : "")
      + `</g>`;
  }
  function crown(stage) {
    if (stage === 2) return `<path d="M52 14 l4 -8 l4 8 l4 -8 l4 8z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.6" stroke-linejoin="round" transform="translate(-4 2)"/>`;
    if (stage >= 3) return `<path d="M44 16 l4 -12 l8 8 l4 -12 l4 12 l8 -8 l4 12z" fill="#ffd23f" stroke="#a8650a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="60" cy="11" r="2.4" fill="#ff5a8a"/>`
      + `<path class="mon-spark" d="M12 30 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2z M104 18 l1.5 -4.5 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5z" fill="#fff6c2"/>`;
    return "";
  }

  const CP = { beetle: [-22, 26], mimic: [0, 2], turtle: [-36, 40], snake: [20, 6], fish: [-14, 14], golem: [-6, 14], dice: [-4, 16], frog: [0, 18], bug: [0, 14] };
  KT.monArt = (id, opt = {}) => {
    const s = D.species.find((x) => x.id === id) || D.species[0];
    const p = pal(s.type), st = opt.stage || 1, n = ++uid;
    const body = (SH[s.shape] || SH.slime)(p, s.em) + (ACC[s.id] ? ACC[s.id](p) : "");
    const sc = st >= 3 ? 1.04 : 1;
    return `<svg class="mon-svg sh-${s.shape}" viewBox="-8 -8 136 136" style="--bd:${(-Math.random() * 4).toFixed(2)}s" ${opt.size ? `width="${opt.size}" height="${opt.size}"` : ""} role="img" aria-label="${s.name}">`
      + aura(n, p, st)
      + `<ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".18" class="mon-shadow"/>`
      + `<g class="mon-body" transform="${opt.flip ? "translate(120 0) scale(-1 1) " : ""}translate(${60 - 60 * sc} ${60 - 60 * sc}) scale(${sc})">${wings(p, st)}<g class="mon-breathe">${body}</g><g transform="translate(${(CP[s.shape] || [0, 0]).join(' ')})">${crown(st)}</g></g></svg>`;
  };
})();
