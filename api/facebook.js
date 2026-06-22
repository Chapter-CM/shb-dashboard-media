'use strict';
/*
 * SHB Facebook Dashboard — SCAFFOLD (mock data)
 * Render-only skeleton dùng chung design system với email-tracker-data.
 * Chưa nối Page Graph API / Supabase — dữ liệu dưới đây là MOCK để xem layout.
 * Kiến trúc cuối: api/fetch.js (cron ingest) -> Supabase -> file này đọc & render.
 */

// ── MOCK DATA (thay bằng Supabase ở bước build tiếp theo) ──────────────
const MOCK = {
  updatedAgo: '2 giờ trước',
  followers: 48230,
  sum: {
    views: 312540, reactions: 18420, comments: 2310, shares: 1290,
    newFollowers: 640, engRate: 6.4, clickRate: 2.1, avgEngPerPost: 410
  },
  // delta % vs kỳ trước (cho mũi tên trend)
  delta: { views: 12.4, reactions: 8.1, comments: -3.2, shares: 21.0,
    newFollowers: 5.5, engRate: 1.9, clickRate: -0.4, avgEngPerPost: 7.7 },
  trend: [120,138,131,160,172,168,190,205,198,221,243,260,255,288,312], // views theo ngày (k)
  reactions: { like: 9200, love: 5100, haha: 1800, wow: 1300, sad: 620, angry: 400 },
  posts: [
    { t: 'Ra mắt gói vay ưu đãi Q3', type: 'Ảnh', views: 42100, react: 2810, cmt: 320, share: 210, er: 8.0 },
    { t: 'Video: Hướng dẫn mở tài khoản online', type: 'Video', views: 38800, react: 2110, cmt: 410, share: 180, er: 7.0 },
    { t: 'Reel: 60 giây hiểu về lãi kép', type: 'Reel', views: 51200, react: 3400, cmt: 290, share: 350, er: 7.9 },
    { t: 'Thông báo lịch nghỉ lễ', type: 'Text', views: 12300, react: 540, cmt: 60, share: 20, er: 5.0 },
    { t: 'Album sự kiện tri ân khách hàng', type: 'Ảnh', views: 29400, react: 1980, cmt: 240, share: 120, er: 7.9 },
  ]
};

// ── HELPERS (server-side render) ───────────────────────────────────────
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const nf = n => n.toLocaleString('vi-VN');
const trendChip = d => {
  const up = d >= 0, cls = up ? 'p-good' : 'p-risk', arr = up ? '▲' : '▼';
  return `<span class="pill ${cls}">${arr} ${Math.abs(d).toFixed(1)}%</span>`;
};
const spark = arr => {
  const max = Math.max(...arr), min = Math.min(...arr), w = 90, h = 26;
  const pts = arr.map((v, i) => `${(i/(arr.length-1)*w).toFixed(1)},${(h-(v-min)/(max-min||1)*h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>`;
};
const kpi = (label, val, dkey, sparkArr) =>
  `<div class="kpi"><div class="kpi-l">${esc(label)}</div>
   <div class="kpi-v num">${val}</div>
   <div class="kpi-f">${trendChip(MOCK.delta[dkey])}${sparkArr ? spark(sparkArr) : ''}</div></div>`;

function gauge(pct, target) {
  const R = 78, C = 2 * Math.PI * R, off = C * (1 - pct / 100), ang = (target / 100) * 360 - 90;
  return `<svg viewBox="0 0 200 200" class="gauge">
    <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--hair)" stroke-width="16"/>
    <circle cx="100" cy="100" r="${R}" fill="none" stroke="url(#g)" stroke-width="16" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 100 100)"/>
    <line x1="100" y1="100" x2="${100+R*Math.cos(ang*Math.PI/180)}" y2="${100+R*Math.sin(ang*Math.PI/180)}"
      stroke="var(--warn)" stroke-width="2" stroke-dasharray="3 3"/>
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs>
    <text x="100" y="96" text-anchor="middle" class="g-big">${pct}%</text>
    <text x="100" y="120" text-anchor="middle" class="g-sub">Engagement Rate</text></svg>`;
}

function areaChart(arr) {
  const W = 720, H = 180, max = Math.max(...arr), min = Math.min(...arr);
  const x = i => (i / (arr.length - 1)) * W, y = v => H - (v - min) / (max - min || 1) * (H - 20) - 10;
  const line = arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  return `<svg viewBox="0 0 ${W} ${H}" class="area" preserveAspectRatio="none">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#ag)"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg>`;
}

function reactionsBar(r) {
  const tot = Object.values(r).reduce((a, b) => a + b, 0);
  const meta = { like:['👍','#5b8cff'], love:['❤️','#ff7d96'], haha:['😆','#ffc861'],
    wow:['😮','#8b7bff'], sad:['😢','#5bb8ff'], angry:['😡','#ff9d5b'] };
  return Object.entries(r).map(([k, v]) =>
    `<div class="rrow"><span class="rlbl">${meta[k][0]} ${k}</span>
     <div class="rbar"><span style="width:${(v/tot*100).toFixed(1)}%;background:${meta[k][1]}"></span></div>
     <span class="num rval">${nf(v)}</span></div>`).join('');
}

function postRows(posts) {
  return posts.map(p => `<tr>
    <td>${esc(p.t)}</td><td><span class="pill p-neutral">${esc(p.type)}</span></td>
    <td class="num">${nf(p.views)}</td><td class="num">${nf(p.react)}</td>
    <td class="num">${nf(p.cmt)}</td><td class="num">${nf(p.share)}</td>
    <td class="num">${p.er.toFixed(1)}%</td></tr>`).join('');
}

// ── HANDLER ────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  const d = MOCK;
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SHB Facebook Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="mast"><div class="mast-in">
  <div class="brand"><div class="logo">SHB</div>
    <div><div class="tt">Truyền thông Facebook</div><div class="ss">Fanpage · CM Analytics</div></div></div>
  <div class="ctrls">
    <div class="seg"><button onclick="location.href='/api/dashboard'">Email</button><button class="on">Facebook</button></div>
    <div class="seg"><button>7d</button><button class="on">30d</button><button>90d</button></div>
    <button class="icon-btn" onclick="toggleTheme()" data-tip="Đổi giao diện">◐</button>
    <span class="fresh" data-tip="Lần fetch gần nhất">● cập nhật ${esc(d.updatedAgo)}</span>
  </div></div></header>

<div class="wrap">
  <div class="filters">
    <select><option>Khoảng ngày: 30 ngày</option></select>
    <select><option>Loại bài: Tất cả</option></select>
    <select><option>Topic: Tất cả</option></select>
    <select><option>Định dạng: Tất cả</option></select>
  </div>

  <!-- TẦNG 1 -->
  <section class="tier1">
    <div class="panel gauge-card">${gauge(d.sum.engRate, 7)}</div>
    <div class="kpi-grid">
      ${kpi('Views', nf(d.sum.views), 'views', d.trend)}
      ${kpi('Reactions', nf(d.sum.reactions), 'reactions')}
      ${kpi('Comments', nf(d.sum.comments), 'comments')}
      ${kpi('Shares', nf(d.sum.shares), 'shares')}
      ${kpi('Follower mới', nf(d.sum.newFollowers), 'newFollowers')}
      ${kpi('Engagement Rate', d.sum.engRate + '%', 'engRate')}
      ${kpi('Click Rate', d.sum.clickRate + '%', 'clickRate')}
      ${kpi('TB engage/bài', nf(d.sum.avgEngPerPost), 'avgEngPerPost')}
    </div>
  </section>

  <!-- TẦNG 2 -->
  <div class="eyebrow">Xu hướng</div>
  <section class="tier2">
    <div class="panel"><div class="panel-h">Views theo thời gian</div>${areaChart(d.trend)}</div>
    <div class="panel"><div class="panel-h">Sentiment reactions</div>${reactionsBar(d.reactions)}</div>
  </section>

  <!-- TẦNG 3 -->
  <div class="eyebrow">Hiệu quả nội dung</div>
  <section class="panel">
    <div class="tabs"><button class="tab on" onclick="tab(this)">Posts</button><button class="tab" onclick="tab(this)">Reels / Video</button></div>
    <div class="tw"><table>
      <thead><tr><th>Bài viết</th><th>Loại</th><th>Views</th><th>React</th><th>Cmt</th><th>Share</th><th>ER</th></tr></thead>
      <tbody>${postRows(d.posts)}</tbody></table></div>
  </section>

  <div class="eyebrow">Sức khỏe dữ liệu</div>
  <section class="panel health">
    <div>● Nguồn: <b>MOCK</b> (chưa nối Page API)</div>
    <div>● Snapshot gần nhất: ${esc(d.updatedAgo)}</div>
    <div>⚠ Deprecation watch: impressions→views (11/2025 ✓), reach→media viewers (06/2026 ✓)</div>
  </section>

  <footer class="ft">SHB CM · Facebook Dashboard scaffold · dữ liệu mock — dùng để duyệt layout</footer>
</div>

<div id="tip"></div>
<script>${JS}</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// ── CSS (tokens y hệt email-tracker-data) ──────────────────────────────
const CSS = `
:root{--bg:#0b0916;--glass:rgba(255,255,255,.045);--glass-2:rgba(255,255,255,.07);
--stroke:rgba(255,255,255,.09);--stroke-2:rgba(255,255,255,.15);--hair:rgba(255,255,255,.055);
--text:#f2effc;--text-2:#bdb8db;--muted:#8e89b3;--accent:#8b7bff;--accent-2:#5b8cff;
--grad:linear-gradient(135deg,#7c5cff 0%,#5b8cff 100%);
--good:#34e0a1;--warn:#ffc861;--risk:#ff7d96;
--good-bg:rgba(52,224,161,.13);--risk-bg:rgba(255,125,150,.14);
--orb1:rgba(124,92,255,.24);--orb2:rgba(77,139,255,.18);--orb3:rgba(255,107,138,.15);--orb4:rgba(52,224,161,.11);
--r:22px;--r-sm:14px;--num:'Space Grotesk',ui-monospace,monospace;--shadow:0 20px 54px -24px rgba(0,0,0,.72)}
[data-theme="light"]{--bg:#eef0fb;--glass:rgba(255,255,255,.62);--glass-2:rgba(255,255,255,.8);
--stroke:rgba(90,70,180,.12);--stroke-2:rgba(90,70,180,.22);--hair:rgba(90,70,180,.07);
--text:#241f3d;--text-2:#544e74;--muted:#7d7799;--accent:#6d5efc;--accent-2:#4d7cff;
--good:#10a371;--warn:#c2851a;--risk:#e15572;--shadow:0 20px 54px -28px rgba(80,60,160,.38)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);font-size:13.5px;line-height:1.5;min-height:100vh;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(58% 48% at 12% 6%,var(--orb1),transparent 62%),radial-gradient(52% 44% at 88% 12%,var(--orb2),transparent 62%),radial-gradient(56% 50% at 82% 92%,var(--orb3),transparent 62%),radial-gradient(50% 50% at 8% 96%,var(--orb4),transparent 62%)}
.num{font-family:var(--num);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.wrap{max-width:1200px;margin:0 auto;padding:0 26px 60px}
.mast{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px) saturate(150%);border-bottom:1px solid var(--hair)}
.mast-in{max-width:1200px;margin:0 auto;padding:14px 26px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:34px;height:34px;border-radius:11px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px}
.brand .tt{font-size:15px;font-weight:700}.brand .ss{font-size:11.5px;color:var(--muted)}
.ctrls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.seg{display:flex;background:var(--glass);border:1px solid var(--stroke);border-radius:12px;padding:3px}
.seg button{background:none;border:none;color:var(--muted);padding:6px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:600;border-radius:9px}
.seg button.on{background:var(--grad);color:#fff}
.icon-btn{height:34px;min-width:34px;border-radius:11px;background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);cursor:pointer}
.fresh{font-size:11.5px;color:var(--good);font-weight:600}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}
.filters select{background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);border-radius:11px;padding:8px 12px;font:inherit;font-size:12px;max-width:200px}
.panel{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r);padding:20px;box-shadow:var(--shadow)}
.panel-h{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px}
.eyebrow{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;margin:30px 0 12px}
.tier1{display:grid;grid-template-columns:240px 1fr;gap:16px;margin-top:8px}
.gauge-card{display:flex;align-items:center;justify-content:center}
.gauge{width:200px;height:200px}.g-big{font-family:var(--num);font-size:34px;font-weight:700;fill:var(--text)}.g-sub{font-size:11px;fill:var(--muted)}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:14px}
.kpi-l{font-size:11.5px;color:var(--muted);font-weight:600}
.kpi-v{font-size:24px;font-weight:700;margin:4px 0 8px}
.kpi-f{display:flex;align-items:center;gap:8px}
.pill{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px}
.p-good{background:var(--good-bg);color:var(--good)}.p-risk{background:var(--risk-bg);color:var(--risk)}
.p-neutral{background:var(--glass-2);color:var(--text-2)}
.spark{width:90px;height:26px}
.tier2{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}
.area{width:100%;height:180px}
.rrow{display:flex;align-items:center;gap:10px;margin:9px 0}
.rlbl{width:78px;font-size:12px;color:var(--text-2)}
.rbar{flex:1;height:9px;background:var(--hair);border-radius:99px;overflow:hidden}
.rbar span{display:block;height:100%;border-radius:99px}
.rval{width:54px;text-align:right;font-size:12px;color:var(--text-2)}
.tabs{display:flex;gap:4px;margin-bottom:14px}
.tab{background:var(--glass);border:1px solid var(--stroke);color:var(--muted);padding:7px 14px;border-radius:10px;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
.tab.on{background:var(--grad);color:#fff;border-color:transparent}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--hair)}
td{padding:11px 10px;border-bottom:1px solid var(--hair)}
td.num,th:nth-child(n+3){text-align:right}
tr:hover td{background:var(--glass)}
.health{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-2)}
.ft{text-align:center;color:var(--muted);font-size:11.5px;margin-top:36px}
#tip{position:fixed;z-index:9999;display:none;background:color-mix(in srgb,var(--bg) 90%,transparent);border:1px solid var(--stroke-2);color:var(--text-2);font-size:12px;padding:8px 12px;border-radius:10px;pointer-events:none}
[data-tip]{cursor:help}
@media(max-width:880px){.tier1{grid-template-columns:1fr}.kpi-grid{grid-template-columns:repeat(2,1fr)}.tier2{grid-template-columns:1fr}}
`;

// ── CLIENT JS (tối thiểu: theme + tab + tooltip) ───────────────────────
const JS = `
(function(){
  var t=localStorage.getItem('shb-fb-theme');if(t)document.documentElement.setAttribute('data-theme',t);
  window.toggleTheme=function(){var c=document.documentElement.getAttribute('data-theme')==='light'?'':'light';
    if(c)document.documentElement.setAttribute('data-theme',c);else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('shb-fb-theme',c);};
  window.tab=function(el){el.parentNode.querySelectorAll('.tab').forEach(function(b){b.classList.remove('on')});el.classList.add('on');};
  var tip=document.getElementById('tip');
  document.addEventListener('mouseover',function(e){var t=e.target.closest('[data-tip]');if(!t)return;
    tip.textContent=t.getAttribute('data-tip');tip.style.display='block';
    var r=t.getBoundingClientRect();tip.style.left=r.left+'px';tip.style.top=(r.bottom+8)+'px';});
  document.addEventListener('mouseout',function(e){if(e.target.closest('[data-tip]'))tip.style.display='none';});
})();
`;
