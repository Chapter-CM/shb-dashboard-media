'use strict';
/*
 * SHB Facebook Dashboard — kế thừa toàn bộ UX/UI của email-tracker + nâng cấp:
 *  - Bảng SORT được theo cột · drill-down từng bài · donut sentiment · heatmap
 *    best-time · trend đa chỉ số (toggle) · velocity · virality · admin response.
 *  - Đầy đủ: command palette ⌘K, subnav IntersectionObserver, theme/density,
 *    cross-filter, searchable dropdown, CSV export, tooltips, error panel,
 *    2 view operational/executive, auto-refresh.
 * Kiến trúc giống dashboard.js: server in HTML; client JS sống trong clientCode()
 * và được trích bằng .toString(). DATA hiện là MOCK — nối Supabase ở bước sau.
 */

// ── MOCK DATA GENERATOR (server-side; thay bằng Supabase ở api/fetch.js) ──
function genMock() {
  var seed = 20260622; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function ri(a, b) { return Math.floor(a + rnd() * (b - a + 1)); }
  var types = ['Ảnh', 'Video', 'Reel', 'Text', 'Link'];
  var topics = ['Sản phẩm vay', 'Tuyển dụng', 'Sự kiện', 'Thông báo', 'CSR', 'Khuyến mãi'];
  var samples = ['Ra mắt gói vay ưu đãi', 'Hướng dẫn mở tài khoản online', '60 giây hiểu về lãi kép',
    'Thông báo lịch nghỉ lễ', 'Album tri ân khách hàng', 'Cơ hội nghề nghiệp tại SHB',
    'Chương trình hoàn tiền thẻ tín dụng', 'Cẩm nang tài chính cá nhân', 'SHB đồng hành cùng cộng đồng',
    'Mở thẻ nhận quà liền tay', 'Lãi suất tiết kiệm mới', 'Sự kiện kết nối doanh nghiệp'];
  var now = Date.now(), DAY = 864e5, posts = [];
  for (var i = 0; i < 38; i++) {
    var type = types[ri(0, 4)], ageD = Math.floor(rnd() * 90), ts = now - ageD * DAY - ri(0, 86399) * 1000;
    var isVid = (type === 'Video' || type === 'Reel');
    var views = ri(8000, 60000), base = views / 1000;
    var like = ri(Math.round(base * 30), Math.round(base * 70)), love = ri(Math.round(base * 8), Math.round(base * 40));
    var haha = ri(0, Math.round(base * 12)), wow = ri(0, Math.round(base * 10));
    var sad = ri(0, Math.round(base * 4)), angry = ri(0, Math.round(base * 3));
    var comments = ri(Math.round(base * 2), Math.round(base * 12)), shares = ri(Math.round(base), Math.round(base * 10));
    var clicks = ri(Math.round(base * 4), Math.round(base * 20));
    var eng = like + love + haha + wow + sad + angry + comments + shares;
    var mediaViewers = Math.round(views * (.62 + rnd() * .16));
    posts.push({
      id: 'p' + i, msg: samples[ri(0, samples.length - 1)] + (rnd() > .5 ? ' #' + topics[ri(0, 5)] : ''),
      ts: ts, type: type, topic: topics[ri(0, 5)], permalink: '#',
      views: views, mediaViewers: mediaViewers,
      react: { like: like, love: love, haha: haha, wow: wow, sad: sad, angry: angry },
      comments: comments, replies: ri(0, comments), pageReplies: ri(0, Math.min(comments, ri(0, comments))),
      shares: shares, clicks: clicks, firstCommentMin: ri(2, 180),
      video: isVid ? { mediaViews: views, viewers: Math.round(views * (.7 + rnd() * .15)), avgWatch: ri(6, 42), completion: ri(18, 72), replays: ri(0, Math.round(base * 6)) } : null,
      vel: { h1: Math.round(eng * (.18 + rnd() * .12)), h3: Math.round(eng * (.38 + rnd() * .12)), h6: Math.round(eng * (.55 + rnd() * .12)), h24: Math.round(eng * (.82 + rnd() * .12)) }
    });
  }
  // page-level daily series (90 ngày) — followers tăng dần
  var series = [], f = 44000;
  for (var d = 89; d >= 0; d--) { f += ri(20, 160); series.push({ ms: now - d * DAY, followers: f, views: ri(6000, 22000), eng: ri(400, 1800) }); }
  // livestream sessions (VOD sau khi phát) — peak concurrent, người xem duy nhất
  var liveTitles = ['Tư vấn vay mua nhà trực tiếp', 'Hỏi đáp lãi suất tiết kiệm', 'Talkshow tài chính cá nhân', 'Ra mắt sản phẩm thẻ mới', 'Q&A tuyển dụng SHB', 'Hướng dẫn app SHB Mobile'];
  var lives = [];
  for (var L = 0; L < 6; L++) {
    var lts = now - Math.floor(rnd() * 80) * DAY - ri(0, 86399) * 1000;
    var lviews = ri(3000, 28000), lviewers = Math.round(lviews * (.55 + rnd() * .2)), lpeak = Math.round(lviewers * (.08 + rnd() * .14));
    lives.push({ id: 'L' + L, title: liveTitles[L % liveTitles.length], ts: lts, durationMin: ri(18, 75), peak: lpeak, views: lviews, viewers: lviewers, reactions: ri(80, 1400), comments: ri(20, 600), status: 'VOD' });
  }
  return { posts: posts, series: series, lives: lives, page: { followers: f, name: 'SHB Fanpage' } };
}
// ── DATA LOADER: Supabase nếu có env, ngược lại fallback MOCK ──────────────
const https = require('https');
function sbGet(path) {
  return new Promise(function (resolve, reject) {
    var base = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_KEY || '';
    https.get(base + path, { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } }, function (r) {
      var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function mapSupabase(rows, snaps) {
  var posts = rows.map(function (r) {
    return {
      id: r.post_id, msg: r.message || '(không có nội dung)', ts: new Date(r.created_time).getTime(),
      type: r.type || 'Text', topic: r.topic || 'Khác', permalink: r.permalink || '#', views: r.views || 0, mediaViewers: r.media_viewers || 0,
      react: { like: r.like_count || 0, love: r.love_count || 0, haha: r.haha_count || 0, wow: r.wow_count || 0, sad: r.sad_count || 0, angry: r.angry_count || 0 },
      comments: r.comments || 0, replies: r.replies || 0, pageReplies: r.page_replies || 0,
      shares: r.shares || 0, clicks: r.clicks || 0, firstCommentMin: r.first_comment_min || 0,
      video: r.video || null, vel: r.vel || { h1: 0, h3: 0, h6: 0, h24: 0 }
    };
  });
  var series = (snaps || []).map(function (s) { return { ms: new Date(s.captured_at).getTime(), followers: s.followers || 0, views: s.views || 0, eng: s.engagement || 0 }; });
  if (!series.length) series = genMock().series;
  var followers = series.length ? series[series.length - 1].followers : 0;
  // lives: chưa ingest qua fetch.js (live_videos) — để trống, section tự hiện empty-state.
  return { posts: posts, series: series, lives: [], page: { followers: followers, name: 'SHB Fanpage' } };
}
async function loadData() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return genMock();
  try {
    var r = await Promise.all([
      sbGet('/rest/v1/fb_posts?select=*&order=created_time.desc&limit=500'),
      sbGet('/rest/v1/fb_page_snapshots?select=*&order=captured_at.asc&limit=400')
    ]);
    if (!Array.isArray(r[0]) || !r[0].length) return genMock();
    return mapSupabase(r[0], r[1]);
  } catch (e) { console.error('[fb loadData]', e && e.message); return genMock(); }
}

// ── CSS (tokens + class y hệt email-tracker, + class nâng cấp) ────────────
const CSS = `
:root{--bg:#0b0916;--glass:rgba(255,255,255,.045);--glass-2:rgba(255,255,255,.07);--glass-3:rgba(255,255,255,.11);
--stroke:rgba(255,255,255,.09);--stroke-2:rgba(255,255,255,.15);--hair:rgba(255,255,255,.055);
--text:#f2effc;--text-2:#bdb8db;--muted:#8e89b3;--faint:#615d83;--accent:#8b7bff;--accent-2:#5b8cff;
--grad:linear-gradient(135deg,#7c5cff 0%,#5b8cff 100%);--good:#34e0a1;--warn:#ffc861;--risk:#ff7d96;
--good-bg:rgba(52,224,161,.13);--warn-bg:rgba(255,200,97,.14);--risk-bg:rgba(255,125,150,.14);--accent-bg:rgba(139,123,255,.15);
--orb1:rgba(124,92,255,.24);--orb2:rgba(77,139,255,.18);--orb3:rgba(255,107,138,.15);--orb4:rgba(52,224,161,.11);
--r:22px;--r-sm:14px;--num:'Space Grotesk',ui-monospace,monospace;--shadow:0 20px 54px -24px rgba(0,0,0,.72)}
[data-theme="light"]{--bg:#eef0fb;--filter-bg:#fff;--glass:rgba(255,255,255,.62);--glass-2:rgba(255,255,255,.8);--glass-3:rgba(255,255,255,.92);
--stroke:rgba(90,70,180,.12);--stroke-2:rgba(90,70,180,.22);--hair:rgba(90,70,180,.07);
--text:#241f3d;--text-2:#544e74;--muted:#7d7799;--faint:#a7a2c0;--accent:#6d5efc;--accent-2:#4d7cff;
--good:#10a371;--warn:#c2851a;--risk:#e15572;--good-bg:rgba(16,163,113,.12);--warn-bg:rgba(194,133,26,.13);--risk-bg:rgba(225,85,114,.12);--accent-bg:rgba(109,94,252,.12);
--orb1:rgba(124,92,255,.18);--orb2:rgba(77,139,255,.14);--orb3:rgba(255,120,160,.12);--orb4:rgba(52,200,150,.1);--shadow:0 20px 54px -28px rgba(80,60,160,.38)}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);font-size:13.5px;line-height:1.5;min-height:100vh;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(58% 48% at 12% 6%,var(--orb1),transparent 62%),radial-gradient(52% 44% at 88% 12%,var(--orb2),transparent 62%),radial-gradient(56% 50% at 82% 92%,var(--orb3),transparent 62%),radial-gradient(50% 50% at 8% 96%,var(--orb4),transparent 62%)}
.num{font-family:var(--num);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.wrap{max-width:1200px;margin:0 auto;padding:0 26px}
.mast{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px) saturate(150%);border-bottom:1px solid var(--hair)}
.mast-in{max-width:1200px;margin:0 auto;padding:14px 26px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:34px;height:34px;border-radius:11px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px}
.brand .tt{font-size:15px;font-weight:700}.brand .ss{font-size:11.5px;color:var(--muted);margin-top:1px}
.ctrls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.seg{display:flex;background:var(--glass);border:1px solid var(--stroke);border-radius:12px;padding:3px}
.seg button{background:none;border:none;color:var(--muted);padding:6px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:600;border-radius:9px;transition:.18s}
.seg button.on{background:var(--grad);color:#fff;box-shadow:0 6px 16px -6px rgba(124,92,255,.6)}
.seg button:hover:not(.on){color:var(--text)}
.icon-btn{height:36px;min-width:36px;padding:0 10px;border-radius:11px;background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;transition:.18s}
.icon-btn:hover{color:var(--text);border-color:var(--stroke-2)}
.mode-btn{background:var(--grad);color:#fff;border:none;padding:9px 16px;border-radius:11px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;box-shadow:0 8px 20px -8px rgba(124,92,255,.7)}
.mode-btn.alt{background:var(--glass);color:var(--text);border:1px solid var(--stroke);box-shadow:none}
.fresh{font-size:11px;color:var(--good);font-weight:700;display:flex;align-items:center;gap:5px}
.subnav{position:sticky;top:65px;z-index:20;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px);border-bottom:1px solid var(--hair)}
.subnav-in{max-width:1200px;margin:0 auto;padding:0 26px;display:flex;gap:2px;overflow-x:auto}
.subnav a{padding:13px 14px;font-size:12px;font-weight:600;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap;transition:.18s}
.subnav a.on{color:var(--text);border-bottom-color:var(--accent)}.subnav a:hover{color:var(--text-2)}
.filter-status{position:sticky;top:108px;z-index:19;background:color-mix(in srgb,var(--accent-bg) 80%,transparent);border-bottom:1px solid var(--stroke);backdrop-filter:blur(16px);padding:9px 26px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.filter-status .lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.f-chip{display:inline-flex;align-items:center;gap:6px;background:var(--glass-2);border:1px solid var(--stroke-2);color:var(--text);font-size:12px;font-weight:600;padding:3px 9px 3px 11px;border-radius:99px}
.f-chip b{color:var(--accent)}.f-chip .cx{cursor:pointer;color:var(--muted);padding:1px 3px;border-radius:4px}.f-chip .cx:hover{color:var(--risk);background:var(--risk-bg)}
.f-clear-all{background:var(--risk-bg);border:1px solid transparent;color:var(--risk);font:inherit;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:99px;cursor:pointer;margin-left:4px}
section{padding-top:28px;scroll-margin-top:122px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:15px;display:flex;align-items:center;gap:10px}
.eyebrow .qc{margin-left:auto;background:none;border:1px solid var(--stroke);color:var(--muted);font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border-radius:8px;cursor:pointer}
.so{font-size:12.5px;color:var(--text-2);background:var(--accent-bg);border:1px solid var(--stroke);border-radius:14px;padding:12px 16px;margin-top:14px;line-height:1.6}.so b{color:var(--accent)}
.hero-row{display:grid;grid-template-columns:340px 1fr;gap:16px}
.gauge-card{background:var(--grad);border-radius:var(--r);padding:22px;color:#fff;position:relative;overflow:hidden;box-shadow:0 24px 54px -22px rgba(124,92,255,.68)}
.gauge-card::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.16);top:-90px;right:-60px;filter:blur(8px)}
.gauge-card .gc-h{font-size:12px;font-weight:600;opacity:.9;position:relative;z-index:1}
.gauge-card .gc-sub{font-size:11.5px;opacity:.82;margin-top:14px;position:relative;z-index:1;line-height:1.5}
.gauge-wrap{display:flex;justify-content:center;margin:4px 0;position:relative;z-index:1}
.kpi-col{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.kpi{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:17px 18px;backdrop-filter:blur(18px);box-shadow:var(--shadow);position:relative;transition:transform .17s,border-color .17s}
.kpi::before{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;background:linear-gradient(90deg,transparent,var(--stroke-2),transparent)}
.kpi:hover{transform:translateY(-3px);border-color:var(--stroke-2)}
.kpi .kl{font-size:11px;color:var(--muted);font-weight:600}
.kpi .kv{font-size:27px;font-weight:700;letter-spacing:-.03em;margin-top:9px;line-height:1;font-family:var(--num)}
.kpi .krow{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:11px}
.delta{font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px;font-family:var(--num);padding:2px 7px;border-radius:99px}
.delta.up{color:var(--good);background:var(--good-bg)}.delta.down{color:var(--risk);background:var(--risk-bg)}.delta.flat{color:var(--muted)}
.spark{height:30px;flex:1;max-width:118px}
.hero-chart{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r);padding:20px 22px;margin-top:16px;box-shadow:var(--shadow);position:relative}
.hc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px}
.hc-title{font-size:14px;font-weight:700}
.metric-toggle{display:flex;gap:4px}
.metric-toggle button{background:var(--glass);border:1px solid var(--stroke);color:var(--muted);font:inherit;font-size:11px;font-weight:600;padding:5px 11px;border-radius:8px;cursor:pointer}
.metric-toggle button.on{background:var(--grad);color:#fff;border-color:transparent}
.chart-svg{width:100%;height:auto;display:block;overflow:visible}
.dot{transition:r .12s}
.ctip{position:absolute;transform:translateX(-50%);background:var(--glass-3);border:1px solid var(--stroke-2);color:var(--text);font-size:11.5px;font-weight:600;padding:6px 10px;border-radius:9px;pointer-events:none;white-space:nowrap;z-index:5;font-family:var(--num);backdrop-filter:blur(12px)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.panel{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r);padding:20px 22px;box-shadow:var(--shadow);transition:border-color .17s}
.panel:hover{border-color:var(--stroke-2)}
.panel-h{font-size:13.5px;font-weight:700;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.dleg{display:flex;flex-direction:column;gap:7px;flex:1;min-width:140px}
.dleg .dl{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2)}
.dleg .dl i{width:10px;height:10px;border-radius:3px}.dleg .dl b{margin-left:auto;font-family:var(--num);color:var(--text)}
.rrow{display:flex;align-items:center;gap:10px;margin:9px 0}
.rlbl{width:120px;font-size:12px;color:var(--text-2)}
.rbar{flex:1;height:9px;background:var(--hair);border-radius:99px;overflow:hidden}.rbar span{display:block;height:100%;border-radius:99px;transition:width .8s cubic-bezier(.16,1,.3,1)}
.rval{width:64px;text-align:right;font-size:12px;color:var(--text-2);font-family:var(--num)}
.hc2{display:flex;align-items:flex-end;gap:3px;height:88px;margin-top:4px}
.hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}
.hcol .b{width:100%;border-radius:5px 5px 3px 3px;min-height:3px;background:var(--grad);transition:height .7s}
.hcol .hl{font-size:9px;color:var(--faint);margin-top:5px;font-family:var(--num)}
.heat{display:grid;grid-template-columns:34px repeat(24,1fr);gap:3px;margin-top:6px}
.heat .hh{font-size:9px;color:var(--faint);font-family:var(--num);text-align:center;align-self:center}
.heat .hr{font-size:10px;color:var(--muted);font-weight:600;align-self:center}
.heatcell{aspect-ratio:1;border-radius:3px;background:var(--accent);min-height:13px}
.dh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dh{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:15px 17px;transition:transform .15s}
.dh:hover{transform:translateY(-2px);border-color:var(--stroke-2)}
.dh-l{font-size:11px;color:var(--muted);font-weight:600}
.dh-v{font-size:22px;font-weight:700;font-family:var(--num);margin-top:7px}
.dh-v.good{color:var(--good)}.dh-v.warn{color:var(--warn)}.dh-v.risk{color:var(--risk)}
.dh-s{font-size:10.5px;color:var(--faint);margin-top:3px}
.ftabs{display:flex;gap:4px;margin-bottom:14px}
.ftab{background:var(--glass);border:1px solid var(--stroke);color:var(--muted);padding:7px 14px;border-radius:10px;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
.ftab.on{background:var(--grad);color:#fff;border-color:transparent}
.tbl-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.tbl-search{flex:1;min-width:200px;max-width:340px;position:relative}
.tbl-search input{width:100%;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12.5px;padding:8px 12px 8px 33px;border-radius:11px;outline:none}
.tbl-search input:focus{border-color:var(--accent)}.tbl-search .si{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;color:var(--muted);font-weight:700;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid var(--stroke);white-space:nowrap}
th.sortable{cursor:pointer;user-select:none}th.sortable:hover{color:var(--text-2)}th .ar{color:var(--accent);font-size:9px}
td{padding:12px 12px;border-bottom:1px solid var(--hair);font-size:12.5px;color:var(--text-2)}
tbody tr:last-child td{border-bottom:none}tbody tr:hover td{background:rgba(255,255,255,.028)}
tbody tr[onclick]{cursor:pointer}td.num,th.num{text-align:right;font-family:var(--num)}td .nm{color:var(--text);font-weight:600}
.drill{background:rgba(255,255,255,.03)}.drill td{padding:0}
.drill-in{padding:14px 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.drill-in .dd{font-size:11px;color:var(--muted)}.drill-in .dd b{display:block;font-size:16px;color:var(--text);font-family:var(--num);margin-top:3px}
.pager{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;font-size:12px;color:var(--muted)}
.pager .pinfo{font-family:var(--num)}
.pager button{background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:9px;cursor:pointer}
.pager button:disabled{opacity:.38;cursor:default}.tbl-empty{text-align:center;color:var(--muted);padding:22px}
.pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;font-family:var(--num)}
.p-good{background:var(--good-bg);color:var(--good)}.p-warn{background:var(--warn-bg);color:var(--warn)}.p-risk{background:var(--risk-bg);color:var(--risk)}.p-neutral{background:var(--hair);color:var(--muted)}
.tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
.tier{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:18px 20px;box-shadow:var(--shadow);transition:transform .17s;cursor:pointer}
.tier:hover{transform:translateY(-3px);border-color:var(--stroke-2)}
.tier .tv{font-size:30px;font-weight:700;line-height:1;font-family:var(--num)}
.tier .tn{font-size:12px;font-weight:700;margin-top:8px;display:flex;align-items:center;gap:7px}
.tier .td{font-size:11px;color:var(--muted);margin-top:3px}
.tier .dt{width:8px;height:8px;border-radius:99px;box-shadow:0 0 10px currentColor}
.ins{display:flex;flex-direction:column;gap:10px}
.in{display:flex;gap:13px;padding:14px 16px;border-radius:var(--r-sm);font-size:12.5px;line-height:1.6;background:var(--glass);border:1px solid var(--stroke)}
.in .mk{width:4px;border-radius:4px;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.in.good .mk{background:var(--good)}.in.warn .mk{background:var(--warn)}.in .x{color:var(--text-2)}.in b{color:var(--text)}
.csv{background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);padding:7px 13px;border-radius:10px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:600}
.csv:hover{color:var(--text);border-color:var(--stroke-2)}
.nd{text-align:center;color:var(--muted);padding:28px}.foot{color:var(--faint);font-size:11px;padding:38px 0 32px;text-align:center;font-family:var(--num)}
.exec-h{background:var(--grad);border-radius:var(--r);padding:28px 30px;margin-bottom:16px;color:#fff;position:relative;overflow:hidden}
.exec-k{display:grid;grid-template-columns:repeat(4,1fr);gap:26px;position:relative;z-index:1}
.exec-kp{border-left:1px solid rgba(255,255,255,.22);padding-left:22px}.exec-kp:first-child{border-left:none;padding-left:0}
.exec-kp .v{font-size:40px;font-weight:700;line-height:.95;font-family:var(--num)}.exec-kp .l{font-size:12px;opacity:.85;margin-top:6px}
.cmdk-ov{position:fixed;inset:0;z-index:100;background:rgba(8,6,20,.55);backdrop-filter:blur(5px);display:none;align-items:flex-start;justify-content:center;padding-top:13vh}
.cmdk-ov.show{display:flex}
.cmdk{width:min(560px,92vw);background:var(--glass-3);border:1px solid var(--stroke-2);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.5);overflow:hidden;backdrop-filter:blur(24px)}
.cmdk-in{width:100%;border:none;background:none;color:var(--text);font:inherit;font-size:15px;padding:17px 19px;outline:none;border-bottom:1px solid var(--stroke)}
.cmdk-list{max-height:330px;overflow-y:auto;padding:7px}
.cmdk-it{padding:11px 14px;border-radius:11px;font-size:13.5px;color:var(--text-2);cursor:pointer;display:flex;gap:10px}
.cmdk-it.sel{background:var(--accent-bg);color:var(--text)}
.cmdk-hint{padding:10px 15px;border-top:1px solid var(--stroke);font-size:11px;color:var(--faint);display:flex;gap:14px}
.fbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0 2px}
.fbar .flbl{font-size:11px;color:var(--faint);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.fbar select{appearance:none;-webkit-appearance:none;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12px;font-weight:600;padding:8px 28px 8px 13px;border-radius:11px;cursor:pointer;max-width:170px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238e89b3' stroke-width='1.5'/></svg>");background-repeat:no-repeat;background-position:right 10px center}
.csel{position:relative;display:inline-block}
.csel-btn{display:flex;align-items:center;gap:6px;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12px;font-weight:600;padding:8px 12px;border-radius:11px;cursor:pointer;max-width:200px;white-space:nowrap;overflow:hidden}
.csel-btn .csel-val{overflow:hidden;text-overflow:ellipsis;flex:1}.csel-btn .arr{color:var(--muted);font-size:10px}
.csel-dd{position:absolute;top:calc(100% + 5px);left:0;z-index:200;min-width:240px;background:var(--glass-3);border:1px solid var(--stroke-2);border-radius:13px;box-shadow:0 16px 40px rgba(0,0,0,.5);backdrop-filter:blur(20px);overflow:hidden}
.csel-inp{width:100%;background:transparent;border:none;border-bottom:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12.5px;padding:10px 13px;outline:none}
.csel-list{max-height:240px;overflow-y:auto}
.csel-opt{padding:8px 14px;font-size:12.5px;cursor:pointer;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.csel-opt:hover{background:var(--glass-2);color:var(--text)}.csel-opt.on{color:var(--accent);font-weight:700}
.fclear{background:none;border:none;color:var(--muted);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;text-decoration:underline}.fclear:hover{color:var(--risk)}
[data-density="compact"] td{padding:9px 10px}[data-density="compact"] .kpi{padding:13px 15px}[data-density="compact"] .kpi .kv{font-size:24px}[data-density="compact"] section{padding-top:20px}[data-density="compact"] .panel{padding:15px 17px}
#tip{position:fixed;z-index:9999;display:none;background:color-mix(in srgb,var(--bg) 90%,transparent);border:1px solid var(--stroke-2);color:var(--text-2);font-size:12px;padding:9px 13px;border-radius:12px;max-width:260px;pointer-events:none;backdrop-filter:blur(18px)}
[data-tip]{cursor:help}
@media(max-width:920px){.hero-row{grid-template-columns:1fr}.row2{grid-template-columns:1fr}.tiers{grid-template-columns:repeat(2,1fr)}.dh-grid{grid-template-columns:1fr}.exec-k{grid-template-columns:1fr 1fr}.drill-in{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.kpi-col{grid-template-columns:1fr}}
`;

// ── HANDLER ───────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  const DATA = await loadData();
  const safe = JSON.stringify(DATA).replace(/<\/script>/gi, '<\\/script>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>SHB Facebook Dashboard</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">'
    + '<style>' + CSS + '</style></head><body><div id="app"></div>'
    + '<script>var DATA=' + safe + ';var TARGET_ER=6;var MIN_N=5;' + JS + '</script></body></html>');
};

// ── CLIENT JS (sống trong clientCode, trích bằng toString) ──────────────────
const JS = (function () {
  function clientCode() {

/* ── utils ── */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function norm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function nf(n){return (Math.round(n)||0).toLocaleString('vi-VN');}
function pc(n){return (Math.round(n*10)/10);}
function fmtTime(ms){if(!ms)return '—';var d=new Date(ms);return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});}
function fmtDay(ms){var d=new Date(ms);return d.getDate()+'/'+(d.getMonth()+1);}
function deltaChip(cur,prev){if(prev==null||prev===0)return '<span class="delta flat">—</span>';var dd=(cur-prev)/prev*100;var up=dd>=0;return '<span class="delta '+(Math.abs(dd)<.5?'flat':up?'up':'down')+'">'+(Math.abs(dd)<.5?'~':up?'▲':'▼')+' '+Math.abs(pc(dd))+'%</span>';}

/* ── geometry / charts ── */
function gPolar(cx,cy,r,a){var rad=(a-90)*Math.PI/180;return [cx+r*Math.cos(rad),cy+r*Math.sin(rad)];}
function gArc(cx,cy,r,a0,a1){var s=gPolar(cx,cy,r,a1),e=gPolar(cx,cy,r,a0),large=a1-a0<=180?0:1;return 'M'+s[0].toFixed(2)+' '+s[1].toFixed(2)+' A'+r+' '+r+' 0 '+large+' 0 '+e[0].toFixed(2)+' '+e[1].toFixed(2);}
function radialGauge(pct,target){
  var p=Math.max(0,Math.min(100,pct||0)),cx=110,cy=110,r=88,sw=18,A0=-135,SPAN=270;
  var valEnd=A0+p/100*SPAN,tickA=A0+Math.max(0,Math.min(100,target))/100*SPAN;
  var ti=gPolar(cx,cy,r,tickA),to=gPolar(cx,cy,r+11,tickA);
  var stops=p>=target?['#34e0a1','#21c98a']:p>=target-2?['#ffd56b','#ff9f45']:['#ff9db0','#ff5c7c'];
  return '<svg width="220" height="200" viewBox="0 0 220 200"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+stops[0]+'"/><stop offset="1" stop-color="'+stops[1]+'"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path d="'+gArc(cx,cy,r,A0,A0+SPAN)+'" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="'+sw+'" stroke-linecap="round"/>'
    +'<path d="'+gArc(cx,cy,r,A0,valEnd)+'" fill="none" stroke="url(#gg)" stroke-width="'+sw+'" stroke-linecap="round" filter="url(#glow)"/>'
    +'<line x1="'+ti[0].toFixed(1)+'" y1="'+ti[1].toFixed(1)+'" x2="'+to[0].toFixed(1)+'" y2="'+to[1].toFixed(1)+'" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>'
    +'<text x="110" y="104" text-anchor="middle" fill="#fff" font-family="Space Grotesk,monospace" font-size="44" font-weight="700">'+pc(p)+'%</text>'
    +'<text x="110" y="130" text-anchor="middle" fill="rgba(255,255,255,.78)" font-size="12" font-weight="600">Mục tiêu '+target+'%</text></svg>';
}
function gaugeBig(pct,target,main,sub){
  var p=Math.max(0,Math.min(100,pct||0)),cx=110,cy=110,r=88,sw=18,A0=-135,SPAN=270;
  var valEnd=A0+p/100*SPAN,tickA=A0+Math.max(0,Math.min(100,target))/100*SPAN;
  var ti=gPolar(cx,cy,r,tickA),to=gPolar(cx,cy,r+11,tickA);
  var fs=main.length>8?24:main.length>6?30:38;
  return '<svg width="220" height="200" viewBox="0 0 220 200"><defs><linearGradient id="ggv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e7e0ff"/></linearGradient><filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path d="'+gArc(cx,cy,r,A0,A0+SPAN)+'" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="'+sw+'" stroke-linecap="round"/>'
    +'<path d="'+gArc(cx,cy,r,A0,valEnd)+'" fill="none" stroke="url(#ggv)" stroke-width="'+sw+'" stroke-linecap="round" filter="url(#glow2)"/>'
    +'<line x1="'+ti[0].toFixed(1)+'" y1="'+ti[1].toFixed(1)+'" x2="'+to[0].toFixed(1)+'" y2="'+to[1].toFixed(1)+'" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>'
    +'<text x="110" y="102" text-anchor="middle" fill="#fff" font-family="Space Grotesk,monospace" font-size="'+fs+'" font-weight="700">'+esc(main)+'</text>'
    +'<text x="110" y="128" text-anchor="middle" fill="rgba(255,255,255,.82)" font-size="11.5" font-weight="600">'+esc(sub)+'</text></svg>';
}
function spark(vals,color){
  if(!vals||vals.length<2)return '';var W=118,H=30,max=Math.max.apply(null,vals),min=Math.min.apply(null,vals);
  var pts=vals.map(function(v,i){return (i/(vals.length-1)*W).toFixed(1)+','+(H-(v-min)/(max-min||1)*(H-4)-2).toFixed(1);}).join(' ');
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="'+(color||'var(--accent)')+'" stroke-width="2"/></svg>';
}
function areaChart(buckets,key,label){
  if(!buckets.length)return '<div class="nd">Chưa đủ dữ liệu</div>';
  var W=900,H=240,pl=8,pr=8,pt=14,pb=26,n=buckets.length;
  var max=Math.max.apply(null,buckets.map(function(b){return b[key];}).concat([1]));
  function X(i){return pl+(n===1?(W-pl-pr)/2:(i/(n-1))*(W-pl-pr));}function Y(v){return pt+(1-v/max)*(H-pt-pb);}
  var base=H-pb,pts=buckets.map(function(b,i){return X(i)+','+Y(b[key]);}),area='M'+X(0)+','+base+' L'+pts.join(' L')+' L'+X(n-1)+','+base+' Z';
  var grid='';[0,.5,1].forEach(function(g){var y=pt+(1-g)*(H-pt-pb);grid+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="var(--hair)"/><text x="'+pl+'" y="'+(y-4)+'" fill="var(--faint)" font-size="10" font-family="monospace">'+nf(max*g)+'</text>';});
  var xl='',ls=Math.max(1,Math.ceil(n/7));buckets.forEach(function(b,i){if(i%ls===0||i===n-1)xl+='<text x="'+X(i)+'" y="'+(H-8)+'" fill="var(--faint)" font-size="10" text-anchor="middle" font-family="monospace">'+fmtDay(b.ms)+'</text>';});
  var dots=buckets.map(function(b,i){return '<circle class="dot" cx="'+X(i)+'" cy="'+Y(b[key])+'" r="3" fill="var(--accent)"><title>'+fmtDay(b.ms)+': '+nf(b[key])+' '+label+'</title></circle>';}).join('');
  return '<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>'+grid+'<path d="'+area+'" fill="url(#ag)"/><path d="M'+pts.join(' L')+'" fill="none" stroke="var(--accent)" stroke-width="2.2"/>'+dots+xl+'</svg>';
}
function donut(parts){
  var tot=parts.reduce(function(a,b){return a+b.v;},0)||1,cx=70,cy=70,r=52,sw=20,off=0,segs='';
  parts.forEach(function(p){var frac=p.v/tot,len=frac*2*Math.PI*r;segs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+p.c+'" stroke-width="'+sw+'" stroke-dasharray="'+len.toFixed(2)+' '+(2*Math.PI*r).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';off+=len;});
  return '<svg width="140" height="140" viewBox="0 0 140 140">'+segs+'<text x="70" y="66" text-anchor="middle" fill="var(--text)" font-family="Space Grotesk" font-size="22" font-weight="700">'+nf(tot)+'</text><text x="70" y="84" text-anchor="middle" fill="var(--muted)" font-size="10">reactions</text></svg>';
}

/* ── analytics core: process(posts) ── */
function reactTotal(r){return r.like+r.love+r.haha+r.wow+r.sad+r.angry;}
function engOf(p){return reactTotal(p.react)+p.comments+p.shares;}
function erOf(p){return p.views?engOf(p)/p.views*100:0;}
function process(posts){
  if(!posts.length)return {empty:true};
  var F=_filter||{};
  var arr=posts.filter(function(p){return matchFilter(p,F);});
  if(!arr.length)return {empty:true};
  var sum={nPosts:arr.length,views:0,mediaViewers:0,comments:0,shares:0,clicks:0,replies:0,pageReplies:0,react:{like:0,love:0,haha:0,wow:0,sad:0,angry:0},firstSum:0,velEarly:0,eng:0,noEng:0};
  arr.forEach(function(p){
    sum.views+=p.views;sum.mediaViewers+=(p.mediaViewers||0);sum.comments+=p.comments;sum.shares+=p.shares;sum.clicks+=p.clicks;
    sum.replies+=p.replies;sum.pageReplies+=p.pageReplies;sum.firstSum+=p.firstCommentMin;
    Object.keys(p.react).forEach(function(k){sum.react[k]+=p.react[k];});
    var e=engOf(p);sum.eng+=e;if(e===0)sum.noEng++;sum.velEarly+=p.vel.h1;
  });
  var rt=reactTotal(sum.react);
  sum.reactions=rt;
  sum.engRate=sum.views?pc(sum.eng/sum.views*100):0;
  sum.clickRate=sum.views?pc(sum.clicks/sum.views*100):0;
  sum.avgEngPerPost=Math.round(sum.eng/arr.length);
  sum.sentiment=rt?pc((sum.react.love+sum.react.haha+sum.react.wow-sum.react.sad-sum.react.angry)/rt*100):0;
  sum.virality=sum.eng?pc(sum.shares/sum.eng*100):0;
  sum.responseRate=pc(arr.filter(function(p){return p.comments>0;}).length/arr.length*100);
  sum.noEngRate=pc(sum.noEng/arr.length*100);
  sum.commentDepth=sum.comments?pc(sum.replies/sum.comments*100):0;
  sum.adminResponse=sum.comments?pc(sum.pageReplies/sum.comments*100):0;
  sum.avgFirst=Math.round(sum.firstSum/arr.length);
  sum.velocity=sum.eng?pc(sum.velEarly/sum.eng*100):0;
  sum.followers=DATA.page.followers;
  sum.avgViewers=sum.nPosts?Math.round(sum.mediaViewers/sum.nPosts):0;          // người xem duy nhất TB / bài
  sum.reachRate=sum.followers?Math.min(100,pc(sum.avgViewers/sum.followers*100)):0; // reach TB mỗi bài (≤100%)
  // best time heatmap: 7 days x 24h, weighted by engagement
  var heat=[];for(var i=0;i<7;i++){heat.push(new Array(24).fill(0));}
  arr.forEach(function(p){var d=new Date(p.ts);heat[(d.getDay()+6)%7][d.getHours()]+=engOf(p);});
  var bestV=0,bestH=0,bestD=0;for(var dd=0;dd<7;dd++)for(var hh=0;hh<24;hh++){if(heat[dd][hh]>bestV){bestV=heat[dd][hh];bestH=hh;bestD=dd;}}
  // by type & topic
  function agg(key){var m={};arr.forEach(function(p){var k=p[key];if(!m[k])m[k]={name:k,n:0,views:0,eng:0};m[k].n++;m[k].views+=p.views;m[k].eng+=engOf(p);});return Object.keys(m).map(function(k){var o=m[k];o.er=o.views?pc(o.eng/o.views*100):0;return o;}).sort(function(a,b){return b.eng-a.eng;});}
  var avgEr=sum.engRate;
  var rows=arr.map(function(p){var e=engOf(p),er=erOf(p);return {p:p,eng:e,er:pc(er),vsAvg:pc(er-avgEr)};}).sort(function(a,b){return b.eng-a.eng;});
  // tiers by ER
  var tiers={hot:[],warm:[],cold:[]};rows.forEach(function(r){if(r.er>=avgEr*1.2)tiers.hot.push(r);else if(r.er>=avgEr*.8)tiers.warm.push(r);else tiers.cold.push(r);});
  // video / reel aggregates (derive from arr)
  var vids=arr.filter(function(p){return p.video;});
  var video={n:vids.length,mediaViews:0,viewers:0,replays:0,watchSum:0,compSum:0};
  vids.forEach(function(p){video.mediaViews+=(p.video.mediaViews||0);video.viewers+=(p.video.viewers||0);video.replays+=(p.video.replays||0);video.watchSum+=(p.video.avgWatch||0);video.compSum+=(p.video.completion||0);});
  video.avgWatch=vids.length?Math.round(video.watchSum/vids.length):0;
  video.completion=vids.length?pc(video.compSum/vids.length):0;
  video.rows=vids.map(function(p){return {p:p,v:p.video};}).sort(function(a,b){return b.v.mediaViews-a.v.mediaViews;});
  return {sum:sum,heat:heat,bestH:bestH,bestD:bestD,byType:agg('type'),byTopic:agg('topic'),rows:rows,tiers:tiers,video:video,
    opts:{type:uniq(posts,'type'),topic:uniq(posts,'topic'),slot:distinct(posts,function(p){return slotOf(p.ts);}),dayType:distinct(posts,function(p){return dayTypeOf(p.ts);}),media:distinct(posts,mediaOf)},filterActive:Object.keys(F).some(function(k){return F[k];})};
}
function uniq(posts,key){var s={};posts.forEach(function(p){if(p[key])s[p[key]]=1;});return Object.keys(s).sort();}
function slotOf(ts){var h=new Date(ts).getHours();return h<5?'Đêm (0–5h)':h<12?'Sáng (5–12h)':h<18?'Chiều (12–18h)':'Tối (18–24h)';}
function dayTypeOf(ts){var d=new Date(ts).getDay();return (d===0||d===6)?'Cuối tuần':'Ngày thường';}
function mediaOf(p){return p.video?'Video / Reel':'Ảnh / Text / Link';}
function distinct(posts,fn){var s={};posts.forEach(function(p){s[fn(p)]=1;});return Object.keys(s);}
function matchFilter(p,F){
  if(F.type&&p.type!==F.type)return false;
  if(F.topic&&p.topic!==F.topic)return false;
  if(F.slot&&slotOf(p.ts)!==F.slot)return false;
  if(F.dayType&&dayTypeOf(p.ts)!==F.dayType)return false;
  if(F.media&&mediaOf(p)!==F.media)return false;
  return true;
}
function windowPosts(days,back){if(!days)return back?[]:DATA.posts;var now=Date.now(),hi=now-back*days*864e5,lo=hi-days*864e5;return DATA.posts.filter(function(p){return p.ts<=hi&&p.ts>lo;});}
function windowSeries(days){if(!days)return DATA.series;return DATA.series.slice(Math.max(0,DATA.series.length-days));}
function windowLives(days){var all=DATA.lives||[];if(!days)return all;var lo=Date.now()-days*864e5;return all.filter(function(l){return l.ts>lo;});}

/* ── table controller (with SORT — nâng cấp so với email) ── */
var _TBL={},_tblState={};
function regTable(cfg){_TBL[cfg.id]=cfg;return cfg;}
function searchBox(id,ph){return '<div class="tbl-tools"><div class="tbl-search"><span class="si">⌕</span><input type="text" placeholder="'+esc(ph)+'" oninput="tblSearch(\''+id+'\',this.value)" autocomplete="off"></div><button class="csv" onclick="exportCSV(\''+id+'\')" data-tip="Tải bảng này về CSV">⬇ CSV</button></div>';}
function th(id,key,label,tip){var st=_tblState[id]||{};var ar=st.sortKey===key?(st.sortDir<0?' ▼':' ▲'):'';return '<th class="num sortable" data-tip="'+esc(tip||'Bấm để sắp xếp')+'" onclick="tblSort(\''+id+'\',\''+key+'\')">'+label+'<span class="ar">'+ar+'</span></th>';}
function tblFilter(cfg){var st=_tblState[cfg.id]||{q:'',page:0};var q=norm(st.q);var rows=q?cfg.rows.filter(function(r){return cfg.search(r,q);}):cfg.rows.slice();
  if(st.sortKey){rows.sort(function(a,b){var x=cfg.sortVal(a,st.sortKey),y=cfg.sortVal(b,st.sortKey);return (x<y?-1:x>y?1:0)*st.sortDir;});}return rows;}
function tblRender(id){
  var cfg=_TBL[id];if(!cfg)return;var st=_tblState[id]||(_tblState[id]={q:'',page:0});
  var rows=tblFilter(cfg),ps=cfg.pageSize||12,pages=Math.max(1,Math.ceil(rows.length/ps));
  if(st.page>=pages)st.page=pages-1;if(st.page<0)st.page=0;
  var tb=document.getElementById('tb-'+id);
  if(tb)tb.innerHTML=rows.length?rows.slice(st.page*ps,st.page*ps+ps).map(cfg.render).join(''):'<tr><td colspan="'+(cfg.cols||7)+'" class="tbl-empty">Không tìm thấy kết quả</td></tr>';
  var pg=document.getElementById('pg-'+id);
  if(pg){if(rows.length<=ps&&st.page===0)pg.innerHTML=rows.length?'<span class="pinfo">'+rows.length+' bài</span>':'';
    else pg.innerHTML='<span class="pinfo">'+(rows.length?st.page*ps+1:0)+'–'+Math.min(rows.length,(st.page+1)*ps)+' / '+rows.length+'</span><button onclick="tblPage(\''+id+'\',-1)"'+(st.page<=0?' disabled':'')+'>‹ Trước</button><button onclick="tblPage(\''+id+'\',1)"'+(st.page>=pages-1?' disabled':'')+'>Sau ›</button>';}
}
function tblSearch(id,v){var st=_tblState[id]||(_tblState[id]={q:'',page:0});st.q=v;st.page=0;tblRender(id);}
function tblPage(id,delta){var st=_tblState[id]||(_tblState[id]={q:'',page:0});st.page+=delta;tblRender(id);}
function tblSort(id,key){var st=_tblState[id]||(_tblState[id]={q:'',page:0});if(st.sortKey===key)st.sortDir=(st.sortDir<0?1:-1);else{st.sortKey=key;st.sortDir=-1;}st.page=0;paint();}
function mountAllTables(){Object.keys(_TBL).forEach(tblRender);}
function toggleDrill(pid){var r=document.getElementById('dr-'+pid);if(r)r.style.display=r.style.display==='table-row'?'none':'table-row';}

/* ── sections ── */
function heroRow(d,cur,prev,ser){
  var s=d.sum;
  function card(label,val,dH,spH,tip){return '<div class="kpi" data-tip="'+esc(tip)+'"><div class="kl">'+label+'</div><div class="kv">'+val+'</div><div class="krow">'+(dH||'<span class="delta flat"></span>')+(spH||'')+'</div></div>';}
  var fv=ser.map(function(b){return b.followers;}),vv=ser.map(function(b){return b.views;});
  var reachRate=s.reachRate;
  var gauge='<div class="gauge-card" data-tip="Số to = tổng Views (tổng lượt xem). Vòng cung = Reach TB/bài = người xem duy nhất trung bình mỗi bài ÷ follower (≤100%)."><div class="gc-h">Tổng Views · '+s.nPosts+' bài</div><div class="gauge-wrap">'+gaugeBig(reachRate,40,nf(s.views),'Reach '+reachRate+'% · ER '+s.engRate+'%')+'</div><div class="gc-sub">'+nf(s.mediaViewers)+' người xem · TB '+nf(s.avgViewers)+'/bài · mục tiêu reach 40%</div></div>';
  var k=[
    card('Người xem',nf(s.mediaViewers),deltaChip(sumKey(cur,'mediaViewers'),sumKey(prev,'mediaViewers')),'','Media Viewers — tổng người xem duy nhất cộng dồn các bài (thay Reach từ 15/06/2026). Reach TB mỗi bài = '+reachRate+'% follower.'),
    card('Reactions',nf(s.reactions),deltaChip(sumKey(cur,'reactions'),sumKey(prev,'reactions')),'','Tổng cảm xúc (6 loại).'),
    card('Comments',nf(s.comments),deltaChip(sumKey(cur,'comments'),sumKey(prev,'comments')),'','Tổng bình luận.'),
    card('Shares',nf(s.shares),deltaChip(sumKey(cur,'shares'),sumKey(prev,'shares')),'','Tổng lượt chia sẻ — tín hiệu lan toả mạnh.'),
    card('Follower',nf(s.followers),'',spark(fv,'var(--good)'),'Tổng follower hiện tại (cần snapshot để có growth).'),
    card('Clicks',nf(s.clicks),deltaChip(sumKey(cur,'clicks'),sumKey(prev,'clicks')),spark(vv,'var(--accent)'),'Tổng lượt click vào bài/link. Click Rate = Clicks ÷ Views = '+s.clickRate+'%.')
  ].join('');
  return '<div class="hero-row">'+gauge+'<div class="kpi-col">'+k+'</div></div>';
}
function sumKey(posts,k){var t=0;posts.forEach(function(p){if(k==='reactions')t+=reactTotal(p.react);else t+=p[k]||0;});return t;}
function heroChart(d,ser){
  return '<div class="hero-chart"><div class="hc-head"><div class="hc-title" data-tip="Xu hướng theo thời gian — chọn chỉ số để xem.">Xu hướng theo thời gian</div>'
    +'<div class="metric-toggle"><button class="'+(_metric==='views'?'on':'')+'" onclick="setMetric(\'views\')">Views</button><button class="'+(_metric==='eng'?'on':'')+'" onclick="setMetric(\'eng\')">Tương tác</button><button class="'+(_metric==='followers'?'on':'')+'" onclick="setMetric(\'followers\')">Follower</button></div></div>'
    +areaChart(ser,_metric,_metric==='views'?'views':_metric==='eng'?'tương tác':'follower')+'</div>';
}
function reactionPanel(d){
  var r=d.sum.react,meta=[['love','❤️ Love','#ff7d96'],['like','👍 Like','#5b8cff'],['haha','😆 Haha','#ffc861'],['wow','😮 Wow','#8b7bff'],['sad','😢 Sad','#5bb8ff'],['angry','😡 Angry','#ff9d5b']];
  var parts=meta.map(function(m){return {v:r[m[0]],c:m[2]};});
  var leg=meta.map(function(m){return '<div class="dl"><i style="background:'+m[2]+'"></i>'+m[1]+'<b>'+nf(r[m[0]])+'</b></div>';}).join('');
  var sCls=d.sum.sentiment>=40?'good':d.sum.sentiment>=0?'warn':'risk';
  return '<div class="panel"><div class="panel-h" data-tip="Phân bố 6 loại reaction + chỉ số sentiment.">Cảm xúc &amp; Sentiment <span class="pill p-'+sCls+'">Sentiment '+d.sum.sentiment+'</span></div><div class="donut-wrap">'+donut(parts)+'<div class="dleg">'+leg+'</div></div></div>';
}
function engagementPanel(d){
  var s=d.sum;function stat(l,v,cls,tip){return '<div class="dh" data-tip="'+esc(tip)+'"><div class="dh-l">'+l+'</div><div class="dh-v '+(cls||'')+'">'+v+'</div></div>';}
  return '<div class="panel"><div class="panel-h" data-tip="Các chỉ số engagement phái sinh.">Engagement tổng hợp</div><div class="dh-grid">'
    +stat('Engagement Rate',s.engRate+'%',s.engRate>=TARGET_ER?'good':s.engRate>=TARGET_ER-2?'warn':'risk','Tương tác ÷ views.')
    +stat('Click Rate',s.clickRate+'%',s.clickRate>=2?'good':'warn','Clicks ÷ views.')
    +stat('Virality',s.virality+'%',s.virality>=10?'good':'','Shares ÷ tổng tương tác — độ lan toả.')
    +stat('Velocity 1h',s.velocity+'%',s.velocity>=20?'good':'warn','% tương tác đạt được trong 1h đầu (cần snapshot thật).')
    +stat('Response Rate',s.responseRate+'%',s.responseRate>=70?'good':'warn','% bài có ≥1 bình luận.')
    +stat('Bài không tương tác',s.noEngRate+'%',s.noEngRate<10?'good':s.noEngRate<25?'warn':'risk','% bài có 0 tương tác.')
    +stat('Comment Depth',s.commentDepth+'%',s.commentDepth>=30?'good':'','Replies ÷ comments — độ sâu thảo luận.')
    +stat('Admin Response',s.adminResponse+'%',s.adminResponse>=30?'good':'warn','% comment được Page trả lời.')
    +stat('TB phản hồi đầu',s.avgFirst+'p','','Trung bình phút tới comment đầu tiên.')
    +'</div></div>';
}
function timingPanel(d){
  var DOW=['T2','T3','T4','T5','T6','T7','CN'],max=1;d.heat.forEach(function(row){row.forEach(function(v){if(v>max)max=v;});});
  var hh='<div class="hh"></div>';for(var h=0;h<24;h++)hh+='<div class="hh">'+(h%3===0?h:'')+'</div>';
  var grid='';for(var dd=0;dd<7;dd++){grid+='<div class="hr">'+DOW[dd]+'</div>';for(var hr=0;hr<24;hr++){var v=d.heat[dd][hr],op=v?(.15+v/max*.85):.05;grid+='<div class="heatcell" style="opacity:'+op.toFixed(2)+'" title="'+DOW[dd]+' '+hr+'h: '+nf(v)+' tương tác"></div>';}}
  var DOWF=['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
  return '<div class="panel"><div class="panel-h" data-tip="Tương tác theo Thứ × Giờ. Ô đậm = giờ vàng đăng bài.">Best time · cao điểm <b style="color:var(--accent)">'+DOWF[d.bestD]+' '+d.bestH+'h</b></div><div class="heat">'+hh+grid+'</div></div>';
}
function mixSection(d){
  var F=_filter||{};
  function bars(list,key){var max=Math.max.apply(null,list.map(function(x){return x.eng;}).concat([1]));
    return list.map(function(x){var on=F[key]===x.name;return '<div class="rrow" style="cursor:pointer;'+(on?'background:var(--accent-bg);border-radius:8px':'')+'" onclick="setFilter(\''+key+'\',\''+jsq(x.name)+'\')" data-tip="Bấm để lọc chéo theo mục này (bấm lại để bỏ)"><span class="rlbl">'+esc(x.name)+' <span style="color:var(--faint)">('+x.n+')</span></span><div class="rbar"><span style="width:'+(x.eng/max*100).toFixed(1)+'%;background:var(--grad)"></span></div><span class="rval">'+x.er+'%</span></div>';}).join('');}
  return '<section id="s-mix"><div class="eyebrow">Phân tích nội dung — bấm để lọc chéo</div><div class="row2">'
    +'<div class="panel"><div class="panel-h" data-tip="Engagement Rate theo định dạng bài. Bấm để lọc.">Theo định dạng</div>'+bars(d.byType,'type')+'</div>'
    +'<div class="panel"><div class="panel-h" data-tip="Engagement Rate theo chủ đề. Bấm để lọc.">Theo chủ đề</div>'+bars(d.byTopic,'topic')+'</div>'
    +'</div></section>';
}
function setCtab(t){_ctab=t;paint();}
function contentSection(d){
  var v=d.video;
  // ── tab: Tất cả bài ──
  regTable({id:'posts',rows:d.rows,pageSize:12,cols:8,
    search:function(r,q){return norm(r.p.msg).indexOf(q)>-1||norm(r.p.topic).indexOf(q)>-1;},
    sortVal:function(r,k){return k==='ts'?r.p.ts:k==='views'?r.p.views:k==='react'?reactTotal(r.p.react):k==='cmt'?r.p.comments:k==='share'?r.p.shares:k==='er'?r.er:r.eng;},
    render:function(r){var p=r.p,vc=r.vsAvg>=0?'p-good':'p-risk';
      return '<tr onclick="toggleDrill(\''+p.id+'\')"><td><span class="nm">'+esc(p.msg.slice(0,52))+'</span></td><td><span class="pill p-neutral">'+esc(p.type)+'</span></td>'
        +'<td class="num">'+nf(p.views)+'</td><td class="num">'+nf(reactTotal(p.react))+'</td><td class="num">'+nf(p.comments)+'</td><td class="num">'+nf(p.shares)+'</td>'
        +'<td class="num">'+r.er+'%</td><td class="num"><span class="pill '+vc+'">'+(r.vsAvg>=0?'+':'')+r.vsAvg+'</span></td></tr>'
        +'<tr class="drill" id="dr-'+p.id+'" style="display:none"><td colspan="8"><div class="drill-in">'
        +'<div class="dd">Đăng lúc<b>'+fmtTime(p.ts)+'</b></div><div class="dd">Chủ đề<b>'+esc(p.topic)+'</b></div>'
        +'<div class="dd">Clicks<b>'+nf(p.clicks)+'</b></div><div class="dd">Velocity 1h<b>'+pc(p.vel.h1/Math.max(1,r.eng)*100)+'%</b></div>'
        +(p.video?'<div class="dd">Người xem<b>'+nf(p.video.viewers||0)+'</b></div><div class="dd">Watch TB<b>'+p.video.avgWatch+'s</b></div><div class="dd">Completion<b>'+p.video.completion+'%</b></div><div class="dd">Replays<b>'+nf(p.video.replays)+'</b></div>':'')
        +'<div class="dd">Admin reply<b>'+p.pageReplies+'/'+p.comments+'</b></div><div class="dd">Comment đầu<b>'+p.firstCommentMin+'p</b></div>'
        +'</div></td></tr>';}});
  // ── tab: Video / Reel ──
  regTable({id:'posts-vid',rows:(v&&v.rows)||[],pageSize:10,cols:7,
    search:function(r,q){return norm(r.p.msg).indexOf(q)>-1;},
    sortVal:function(r,k){return k==='ts'?r.p.ts:k==='mv'?r.v.mediaViews:k==='vw'?r.v.viewers:k==='wt'?r.v.avgWatch:k==='cp'?r.v.completion:r.v.replays;},
    render:function(r){var p=r.p,vi=r.v;return '<tr onclick="toggleDrill(\''+p.id+'v\')"><td><span class="nm">'+esc(p.msg.slice(0,50))+'</span></td><td><span class="pill p-neutral">'+esc(p.type)+'</span></td>'
      +'<td class="num">'+nf(vi.mediaViews)+'</td><td class="num" style="color:var(--good)">'+nf(vi.viewers)+'</td><td class="num">'+vi.avgWatch+'s</td><td class="num">'+vi.completion+'%</td><td class="num">'+nf(vi.replays)+'</td></tr>'
      +'<tr class="drill" id="dr-'+p.id+'v" style="display:none"><td colspan="7"><div class="drill-in">'
      +'<div class="dd">Đăng lúc<b>'+fmtTime(p.ts)+'</b></div><div class="dd">Views (post)<b>'+nf(p.views)+'</b></div>'
      +'<div class="dd">Reactions<b>'+nf(reactTotal(p.react))+'</b></div><div class="dd">Comments<b>'+nf(p.comments)+'</b></div>'
      +'<div class="dd">Shares<b>'+nf(p.shares)+'</b></div><div class="dd">Clicks<b>'+nf(p.clicks)+'</b></div>'
      +'</div></td></tr>';}});
  var isVid=_ctab==='video';
  var tabs='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">'
    +'<div class="eyebrow" style="margin:0">Hiệu quả nội dung — bấm dòng để xem chi tiết</div>'
    +'<div class="seg"><button class="'+(isVid?'':'on')+'" onclick="setCtab(\'posts\')" data-tip="Tất cả bài viết trong kỳ">Tất cả bài</button>'
    +'<button class="'+(isVid?'on':'')+'" onclick="setCtab(\'video\')" data-tip="Chỉ video &amp; reel — xem media views, người xem, watch time">Video / Reel '+(v&&v.n?'<span class="pill p-neutral" style="font-size:10px">'+v.n+'</span>':'')+'</button></div></div>';
  if(!isVid){
    var id='posts';
    return '<section id="s-content">'+tabs+'<div class="panel" id="tbl-'+id+'">'
      +searchBox(id,'Tìm bài viết / chủ đề…')
      +'<div class="tw"><table><thead><tr><th>Bài viết</th><th>Loại</th>'
      +th(id,'views','Views','Sắp theo views')+th(id,'react','React')+th(id,'cmt','Cmt')+th(id,'share','Share')+th(id,'er','ER','Engagement Rate')+th(id,'er2','vs TB')
      +'</tr></thead><tbody id="tb-'+id+'"></tbody></table></div><div class="pager" id="pg-'+id+'"></div></div></section>';
  } else {
    var vid='posts-vid';
    return '<section id="s-content">'+tabs+'<div class="panel" id="tbl-'+vid+'">'
      +searchBox(vid,'Tìm video / reel…')
      +'<div class="tw"><table><thead><tr><th>Video</th><th>Loại</th>'
      +th(vid,'mv','Media Views','Tổng lượt xem video')+th(vid,'vw','Người xem','Unique viewers — tô màu xanh')+th(vid,'wt','Watch TB')+th(vid,'cp','Completion')+th(vid,'rep','Replays')
      +'</tr></thead><tbody id="tb-'+vid+'"></tbody></table></div><div class="pager" id="pg-'+vid+'"></div></div></section>';
  }
}
function videoSection(d){
  var v=d.video,lives=windowLives(_days);
  var noVid=!v||!v.n;
  function vstat(l,val,cls,tip){return '<div class="dh" data-tip="'+esc(tip)+'"><div class="dh-l">'+l+'</div><div class="dh-v '+(cls||'')+'">'+val+'</div></div>';}
  var kpis=noVid?'<div class="nd">Chưa có video / reel trong kỳ</div>':
    '<div class="dh-grid">'
    +vstat('Video / Reel',nf(v.n),'','Số bài dạng video hoặc reel trong kỳ.')
    +vstat('Media Views',nf(v.mediaViews),'','Tổng lượt xem video — thay 3-sec views từ 06/2026 (total_video_views).')
    +vstat('Người xem',nf(v.viewers),'good','Số người xem duy nhất — total_video_views_unique.')
    +vstat('Watch TB',v.avgWatch+'s','','Thời gian xem trung bình mỗi video.')
    +vstat('Completion',v.completion+'%',v.completion>=40?'good':'warn','Tỷ lệ xem hết trung bình.')
    +vstat('Replays',nf(v.replays),'','Tổng lượt xem lại (reels replays).')
    +'</div>';
  // bảng chi tiết video đã chuyển vào contentSection (tab Video/Reel)
  // livestream
  var liveBody;
  if(!lives.length)liveBody='<div class="nd">Chưa có buổi livestream trong kỳ <span style="display:block;font-size:11.5px;margin-top:6px;color:var(--faint)">Cần ingest /{PAGE_ID}/live_videos qua fetch.js (peak_concurrent_viewers · live_video_insights)</span></div>';
  else{
    var totViewers=lives.reduce(function(a,l){return a+l.viewers;},0),maxPeak=Math.max.apply(null,lives.map(function(l){return l.peak;}));
    liveBody='<div class="dh-grid" style="margin-bottom:14px">'
      +vstat('Buổi live',lives.length,'','Số buổi phát trực tiếp trong kỳ.')
      +vstat('Tổng người xem',nf(totViewers),'','Người xem duy nhất cộng dồn các buổi (total_video_views_unique).')
      +vstat('Peak đồng thời',nf(maxPeak),'good','Đỉnh người xem đồng thời cao nhất (peak_concurrent_viewers).')
      +'</div>'
      +'<div class="tw"><table><thead><tr><th>Buổi live</th><th class="num">Peak đồng thời</th><th class="num">Người xem</th><th class="num">Tổng views</th><th class="num">Thời lượng</th><th class="num">Tương tác</th></tr></thead><tbody>'
      +lives.slice().sort(function(a,b){return b.ts-a.ts;}).map(function(l){return '<tr><td><span class="nm">'+esc(l.title)+'</span><span style="color:var(--faint);font-size:11px;display:block">'+fmtTime(l.ts)+'</span></td>'
        +'<td class="num"><b>'+nf(l.peak)+'</b></td><td class="num">'+nf(l.viewers)+'</td><td class="num">'+nf(l.views)+'</td><td class="num">'+l.durationMin+'p</td><td class="num">'+nf(l.reactions+l.comments)+'</td></tr>';}).join('')
      +'</tbody></table></div>';
  }
  return '<section id="s-video"><div class="eyebrow">Video / Reel &amp; Livestream</div>'
    +'<div class="panel"><div class="panel-h" data-tip="Hiệu quả video & reel: media views, người xem duy nhất, watch time, completion. Chi tiết từng video: xem tab Video/Reel ở section Nội dung.">Video &amp; Reel · tổng hợp</div>'+kpis+'</div>'
    +'<div class="panel" style="margin-top:16px"><div class="panel-h" data-tip="Phát trực tiếp: peak concurrent viewers, người xem duy nhất, thời lượng.">Livestream</div>'+liveBody+'</div>'
    +'</section>';
}
function audienceSection(d){
  var ser=windowSeries(_days),fv=ser.map(function(b){return b.followers;});
  var grow=fv.length?fv[fv.length-1]-fv[0]:0;
  var t=d.tiers;function tier(v,n,lbl,col,tip){return '<div class="tier" data-tip="'+esc(tip)+'"><div class="tv">'+v+'</div><div class="tn"><span class="dt" style="color:'+col+'"></span>'+n+'</div><div class="td">'+lbl+'</div></div>';}
  return '<section id="s-aud"><div class="eyebrow">Audience &amp; Follower</div>'
    +'<div class="hero-chart"><div class="hc-head"><div class="hc-title">Follower growth <span class="pill p-good">+'+nf(grow)+'</span></div></div>'+areaChart(ser,'followers','follower')+'</div>'
    +'<div class="tiers" style="margin-top:16px">'
    +tier(t.hot.length,'Hot','ER ≥ 1.2× TB','var(--good)','Bài bùng nổ — học công thức để nhân bản.')
    +tier(t.warm.length,'Warm','ER quanh mức TB','var(--warn)','Bài ổn định quanh trung bình.')
    +tier(t.cold.length,'Cold','ER < 0.8× TB','var(--risk)','Bài kém — xem lại định dạng/thời điểm.')
    +tier(d.sum.noEng,'Im lặng','0 tương tác','var(--muted)','Bài không có tương tác nào.')
    +'</div></section>';
}
function insightsOf(d){
  var s=d.sum,ins=[];
  ins.push({t:s.engRate>=TARGET_ER?'good':'warn',x:'Engagement Rate <b>'+s.engRate+'%</b> — '+(s.engRate>=TARGET_ER?'đạt mục tiêu '+TARGET_ER+'%.':'dưới mục tiêu '+TARGET_ER+'%, thử đổi định dạng/giờ đăng.')});
  if(d.byType[0])ins.push({t:'good',x:'Định dạng <b>'+esc(d.byType[0].name)+'</b> hiệu quả nhất (ER '+d.byType[0].er+'%) — ưu tiên sản xuất.'});
  if(d.byTopic[0])ins.push({t:'good',x:'Chủ đề <b>'+esc(d.byTopic[0].name)+'</b> tương tác cao nhất.'});
  ins.push({t:s.adminResponse>=30?'good':'warn',x:'Admin trả lời <b>'+s.adminResponse+'%</b> bình luận'+(s.adminResponse<30?' — tăng tương tác cộng đồng để cải thiện reach.':' — tốt.')});
  if(s.noEngRate>15)ins.push({t:'warn',x:'<b>'+s.noEngRate+'%</b> bài không có tương tác nào — rà soát lại nội dung kém hiệu quả.'});
  ins.push({t:s.sentiment>=40?'good':'warn',x:'Sentiment <b>'+s.sentiment+'</b> — cảm xúc '+(s.sentiment>=40?'tích cực rõ rệt.':s.sentiment>=0?'trung tính, theo dõi thêm.':'tiêu cực, cần chú ý.')});
  return ins;
}
function insightSection(d){var ins=insightsOf(d),h='<div class="ins">';ins.forEach(function(i){h+='<div class="in '+(i.t==='warn'?'warn':i.t==='good'?'good':'')+'"><div class="mk"></div><div class="x">'+i.x+'</div></div>';});h+='</div>';
  return '<section id="s-ins"><div class="eyebrow">Phân tích tự động</div>'+h+'</section>';}
function healthSection(d){
  return '<section id="s-health"><div class="eyebrow">Sức khỏe dữ liệu</div><div class="panel"><div class="dh-grid">'
    +'<div class="dh"><div class="dh-l">Nguồn dữ liệu</div><div class="dh-v warn">MOCK</div><div class="dh-s">Chưa nối Page Graph API</div></div>'
    +'<div class="dh"><div class="dh-l">Số bài phân tích</div><div class="dh-v">'+d.sum.nPosts+'</div></div>'
    +'<div class="dh"><div class="dh-l">Deprecation 06/2026</div><div class="dh-v good">✓ đã xử lý</div><div class="dh-s">reach→media viewers</div></div>'
    +'</div><div class="so" style="margin-top:14px">⚠ <b>Khi nối API thật:</b> xác nhận tên field Views/Media Viewers/clicks với Graph API reference (đợt 15/6/2026 đã đổi tên). Trend/velocity/follower-growth cần cron snapshot vào Supabase.</div></div></section>';
}
function dictSection(){
  var items=[['Engagement Rate','Tổng tương tác (reactions+comments+shares) ÷ views.'],['Views','Lượt xem bài — thay Impressions từ 11/2025.'],['Người xem (Media Viewers)','Số người duy nhất đã thấy bài — thay Reach từ 06/2026. Khác với Views (tổng lượt).'],['Media Views (video)','Tổng lượt xem video — thay 3-sec views từ 06/2026 (total_video_views).'],['Người xem video','Người xem video duy nhất — total_video_views_unique.'],['Peak đồng thời','Đỉnh người xem cùng lúc của livestream — peak_concurrent_viewers.'],['Sentiment','(love+haha+wow − sad−angry) ÷ tổng reaction × 100.'],['Virality','Shares ÷ tổng tương tác — đo lan toả.'],['Velocity','% tương tác đạt trong 1h đầu sau đăng.'],['Comment Depth','Replies ÷ comments — độ sâu thảo luận.'],['Admin Response','% comment được Page trả lời.'],['vs TB','Chênh lệch ER của bài so với ER trung bình kỳ.']];
  var h=items.map(function(i){return '<div class="dh"><div class="dh-l">'+i[0]+'</div><div class="dh-s" style="margin-top:6px;font-size:11.5px;line-height:1.5">'+i[1]+'</div></div>';}).join('');
  return '<section id="s-dict"><div class="eyebrow">Từ điển chỉ số</div><div class="panel"><div class="dh-grid">'+h+'</div></div></section>';
}

/* ── filter bar / nav / masthead ── */
function filterStatusBar(){var F=_filter||{};var active=Object.keys(F).filter(function(k){return F[k];});if(!active.length)return '';
  var L={type:'Định dạng',topic:'Chủ đề',media:'Media',slot:'Khung giờ',dayType:'Ngày'};var chips=active.map(function(k){return '<span class="f-chip">'+L[k]+': <b>'+esc(F[k])+'</b> <span class="cx" onclick="clearFilter(\''+k+'\')">×</span></span>';}).join('');
  return '<div class="filter-status"><span class="lbl">Đang lọc</span>'+chips+'<button class="f-clear-all" onclick="clearAllFilters()">× Xóa tất cả</button></div>';}
function filterBar(d){var F=_filter||{},o=d.opts||{};
  function sel(key,allLabel){var list=o[key]||[];if(!list.length)return '';var cur=F[key]||'';return '<select onchange="setFilter(\''+key+'\',this.value)"><option value="">'+allLabel+'</option>'+list.map(function(v){return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(v)+'</option>';}).join('')+'</select>';}
  function topicSel(){var list=o.topic||[],cur=F.topic||'';var label=cur||'Tất cả chủ đề';var opts='<div class="csel-opt'+(cur?'':' on')+'" onclick="pickTopic(\'\')">Tất cả chủ đề</div>'+list.map(function(v){return '<div class="csel-opt'+(v===cur?' on':'')+'" onclick="pickTopic(\''+jsq(v)+'\')">'+esc(v)+'</div>';}).join('');
    return '<div class="csel"><div class="csel-btn" onclick="openTopicSel(event)"><span class="csel-val">'+esc(label)+'</span><span class="arr">▾</span></div><div class="csel-dd" id="topic-dd" style="display:none"><input class="csel-inp" placeholder="🔍 Tìm chủ đề…" oninput="filterTopicSel(this.value)" onclick="event.stopPropagation()"><div class="csel-list" id="topic-list">'+opts+'</div></div></div>';}
  return '<div class="fbar"><span class="flbl">Lọc</span>'+topicSel()+sel('type','Mọi định dạng')+sel('media','Mọi loại media')+sel('slot','Mọi khung giờ')+sel('dayType','Mọi ngày')+(Object.keys(F).some(function(k){return F[k];})?'<button class="fclear" onclick="clearAllFilters()">Xóa tất cả</button>':'')+'</div>';}
function navLinks(){return '<a href="#s-ov" class="on">Tổng quan</a><a href="#s-react">Cảm xúc</a><a href="#s-engage">Engagement</a><a href="#s-time">Best time</a><a href="#s-content">Nội dung</a><a href="#s-video">Video/Live</a><a href="#s-mix">Phân tích</a><a href="#s-aud">Audience</a><a href="#s-ins">Insight</a><a href="#s-health">Sức khỏe</a><a href="#s-dict">Từ điển</a>';}
function masthead(mode){
  var mBtn=mode==='ex'?'<button class="mode-btn alt" onclick="setMode(\'op\')" data-tip="Bảng điều hành đầy đủ">Bảng điều hành</button>':'<button class="mode-btn" onclick="setMode(\'ex\')" data-tip="Tóm tắt cho lãnh đạo">Tóm tắt lãnh đạo</button>';
  return '<div class="mast"><div class="mast-in"><div class="brand"><div class="logo">SHB</div><div><div class="tt">Facebook Dashboard</div><div class="ss">Fanpage · CM Analytics</div></div></div>'
    +'<div class="ctrls"><div class="seg"><button onclick="location.href=\'/api/dashboard\'" data-tip="Sang dashboard Email">Email</button><button class="on">Facebook</button></div>'
    +'<div class="seg"><button class="'+(_days===0?'on':'')+'" onclick="flt(0)">Tất cả</button><button class="'+(_days===30?'on':'')+'" onclick="flt(30)">30N</button><button class="'+(_days===7?'on':'')+'" onclick="flt(7)">7N</button></div>'
    +'<button class="icon-btn" onclick="openCmd()" data-tip="Lệnh nhanh (Ctrl/⌘+K)">⌘K</button>'
    +'<button class="icon-btn" onclick="toggleTheme()" data-tip="Sáng/Tối">'+(_theme==='dark'?'☼':'☾')+'</button>'
    +'<button class="icon-btn" onclick="toggleDensity()" data-tip="Thoáng/Gọn">⇕</button>'
    +'<span class="fresh" data-tip="Lần fetch gần nhất">● mock</span>'+mBtn+'</div></div></div>';
}

/* ── views ── */
function operational(d,cur,prev,ser){
  return masthead('op')+'<div class="subnav"><div class="subnav-in">'+navLinks()+'</div></div>'+filterStatusBar()
    +'<div class="wrap">'+filterBar(d)
    +'<section id="s-ov" style="padding-top:14px"><div class="eyebrow">Tổng quan</div>'+heroRow(d,cur,prev,ser)+heroChart(d,ser)+'</section>'
    +'<section id="s-react"><div class="eyebrow">Cảm xúc</div><div class="row2">'+reactionPanel(d)+timingPanelMini(d)+'</div></section>'
    +'<section id="s-engage"><div class="eyebrow">Engagement</div>'+engagementPanel(d)+'</section>'
    +'<section id="s-time"><div class="eyebrow">Best time đăng bài</div>'+timingPanel(d)+'</section>'
    +contentSection(d)+videoSection(d)+mixSection(d)+audienceSection(d)+insightSection(d)+healthSection(d)+dictSection()
    +'<div class="foot">SHB CM · Facebook Dashboard · dữ liệu MOCK · tự làm mới 15 phút</div></div>';
}
function timingPanelMini(d){
  var s=d.sum;function stat(l,v,cls,tip){return '<div class="dh" data-tip="'+esc(tip)+'"><div class="dh-l">'+l+'</div><div class="dh-v '+(cls||'')+'">'+v+'</div></div>';}
  return '<div class="panel"><div class="panel-h">Tóm tắt lan toả</div><div class="dh-grid" style="grid-template-columns:1fr 1fr">'
    +stat('Sentiment',s.sentiment,s.sentiment>=40?'good':'warn','Chỉ số cảm xúc tổng.')
    +stat('Virality',s.virality+'%',s.virality>=10?'good':'','Shares ÷ tương tác.')
    +stat('Tổng shares',nf(s.shares),'good','Lan toả tự nhiên.')
    +stat('TB tương tác/bài',nf(s.avgEngPerPost),'','')
    +'</div></div>';
}
function executive(d,cur,prev){
  var s=d.sum,now=new Date().toLocaleDateString('vi-VN',{month:'long',year:'numeric'});
  var head='<div class="exec-h"><div style="font-size:11.5px;opacity:.85;letter-spacing:.06em;text-transform:uppercase;margin-bottom:22px">Báo cáo truyền thông Facebook · CM Team · '+now+'</div><div class="exec-k">'
    +'<div class="exec-kp"><div class="v">'+s.engRate+'%</div><div class="l">Engagement Rate</div></div>'
    +'<div class="exec-kp"><div class="v">'+nf(s.views)+'</div><div class="l">Views</div></div>'
    +'<div class="exec-kp"><div class="v">'+nf(s.eng)+'</div><div class="l">Tương tác</div></div>'
    +'<div class="exec-kp"><div class="v">'+nf(s.followers)+'</div><div class="l">Follower</div></div></div></div>';
  var top=d.rows.slice(0,5).map(function(r){return '<tr><td><span class="nm">'+esc(r.p.msg.slice(0,46))+'</span></td><td><span class="pill p-neutral">'+esc(r.p.type)+'</span></td><td class="num">'+nf(r.p.views)+'</td><td class="num"><b>'+nf(r.eng)+'</b></td><td class="num">'+r.er+'%</td></tr>';}).join('');
  var ins=insightsOf(d),ih='<div class="ins">';ins.slice(0,4).forEach(function(i){ih+='<div class="in '+(i.t==='warn'?'warn':'good')+'"><div class="mk"></div><div class="x">'+i.x+'</div></div>';});ih+='</div>';
  return masthead('ex')+'<div class="wrap"><section style="padding-top:22px">'+head
    +'<div class="panel"><div class="panel-h">Top 5 bài hiệu quả</div><div class="tw"><table><thead><tr><th>Bài viết</th><th>Loại</th><th class="num">Views</th><th class="num">Tương tác</th><th class="num">ER</th></tr></thead><tbody>'+top+'</tbody></table></div></div>'
    +'<div style="margin-top:14px"><div class="eyebrow">Điểm chính</div>'+ih+'</div>'
    +'<div class="foot">Cập nhật '+fmtTime(Date.now())+'</div></section></div>';
}

/* ── app state ── */
var _days=0,_mode='op',_theme='dark',_filter={},_density='comfortable',_metric='views',_ctab='posts',_inited=false,_tipInited=false,_cmds=[],_cmdSel=0,_cmdFiltered=[];
try{var _st=localStorage.getItem('shb-fb-theme');if(_st)_theme=_st;}catch(e){}
try{var _sd=localStorage.getItem('shb-fb-density');if(_sd)_density=_sd;}catch(e){}
function applyTheme(){if(_theme==='light')document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');}
function applyDensity(){document.documentElement.setAttribute('data-density',_density);}
function setFilter(k,v){if(v===''||v==null)delete _filter[k];else _filter[k]=v;paint();}
function clearFilter(k){delete _filter[k];paint();}
function clearAllFilters(){_filter={};paint();}
function setMetric(m){_metric=m;paint();}
function openTopicSel(e){e.stopPropagation();var dd=document.getElementById('topic-dd');if(!dd)return;var open=dd.style.display==='block';dd.style.display=open?'none':'block';if(!open){var inp=dd.querySelector('.csel-inp');if(inp){inp.value='';inp.focus();filterTopicSel('');}}}
function filterTopicSel(q){var list=document.getElementById('topic-list');if(!list)return;var qq=norm(q);list.querySelectorAll('.csel-opt').forEach(function(el){el.style.display=(qq===''||norm(el.textContent).indexOf(qq)>-1)?'':'none';});}
function pickTopic(v){setFilter('topic',v);var dd=document.getElementById('topic-dd');if(dd)dd.style.display='none';}
document.addEventListener('click',function(){var dd=document.getElementById('topic-dd');if(dd)dd.style.display='none';});
function jump(sel){var el=document.querySelector(sel);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}

function render(){
  _TBL={};
  var cl=windowPosts(_days,0),pl=windowPosts(_days,1),ser=windowSeries(_days);
  var d=process(cl);
  if(!d||d.empty){
    var nores=d&&d.empty&&_filter&&Object.keys(_filter).some(function(k){return _filter[k];});
    return masthead(_mode)+'<div class="wrap">'+(nores?filterStatusBar()+filterBar({opts:process(DATA.posts).opts}):'')+'<div style="text-align:center;padding:80px 20px"><div style="font-size:42px;color:var(--faint)">—</div><h2 style="color:var(--text-2);margin:14px 0 8px">'+(nores?'Không có bài khớp bộ lọc':'Chưa có dữ liệu')+'</h2>'+(nores?'<button class="fclear" onclick="clearAllFilters()">Xóa lọc</button>':'')+'</div></div>';
  }
  return _mode==='ex'?executive(d,cl,pl):operational(d,cl,pl,ser);
}
function paint(){
  try{applyTheme();applyDensity();document.getElementById('app').innerHTML=render();mountAllTables();wireNav();wireChart();countUp();init();initTooltip();}
  catch(err){var app=document.getElementById('app');if(app)app.innerHTML='<div style="padding:40px 32px;font-family:monospace;max-width:860px;margin:0 auto"><div style="color:#ff7d96;font-size:18px;font-weight:700;margin-bottom:16px">⚠ Dashboard Error</div><pre style="font-size:12px;background:rgba(255,255,255,.06);padding:18px;border-radius:12px;white-space:pre-wrap;color:#bdb8db">'+String(err.stack||err.message||err)+'</pre><button onclick="_filter={};paint()" style="margin-top:16px;padding:9px 18px;background:#8b7bff;color:#fff;border:none;border-radius:10px;cursor:pointer">Xóa lọc &amp; thử lại</button></div>';console.error('[SHB FB]',err);}
}
function flt(days){_days=days;paint();}
function setMode(m){_mode=m;paint();window.scrollTo(0,0);}
function toggleTheme(){_theme=_theme==='dark'?'light':'dark';try{localStorage.setItem('shb-fb-theme',_theme);}catch(e){}paint();}
function toggleDensity(){_density=_density==='compact'?'comfortable':'compact';try{localStorage.setItem('shb-fb-density',_density);}catch(e){}applyDensity();}
function exportCSV(id){var cfg=_TBL[id];if(!cfg)return;var rows=cfg.rows;var csv='Bai viet,Loai,Views,Reactions,Comments,Shares,ER\n';rows.forEach(function(r){var p=r.p;csv+='"'+p.msg.replace(/"/g,'')+'","'+p.type+'",'+p.views+','+reactTotal(p.react)+','+p.comments+','+p.shares+','+r.er+'\n';});var blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='fb-posts-'+new Date().toISOString().slice(0,10)+'.csv';a.click();}

/* ── UI subsystems ── */
function initTooltip(){if(_tipInited)return;_tipInited=true;var box=document.createElement('div');box.id='tip';document.body.appendChild(box);
  document.addEventListener('mouseover',function(e){var el=e.target.closest('[data-tip]');if(!el){box.style.display='none';return;}box.innerHTML=el.getAttribute('data-tip');box.style.display='block';});
  document.addEventListener('mousemove',function(e){if(box.style.display==='none')return;var x=e.clientX+16,y=e.clientY+16,w=box.offsetWidth,h=box.offsetHeight;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=e.clientY-h-16;box.style.left=x+'px';box.style.top=y+'px';});
  document.addEventListener('mouseout',function(e){if(!e.relatedTarget||!e.relatedTarget.closest('[data-tip]'))box.style.display='none';});}
function countUp(){try{if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;document.querySelectorAll('.kv,.tier .tv,.exec-kp .v,.dh-v').forEach(function(el){var txt=el.textContent.trim(),m=txt.match(/^([\d.,]+)(.*)$/);if(!m)return;var target=parseFloat(m[1].replace(/[.,]/g,function(c){return c===','?'':'';})||m[1].replace(/,/g,''));var raw=parseFloat(m[1].replace(/\./g,'').replace(/,/g,'.'));var val=isNaN(raw)?parseFloat(m[1].replace(/,/g,'')):raw;var suf=m[2]||'';if(isNaN(val)||val<=0)return;var start=performance.now();function tick(now){var p=Math.min(1,(now-start)/650);var e=1-Math.pow(1-p,3);el.textContent=nf(val*e)+suf;if(p<1)requestAnimationFrame(tick);else el.textContent=txt;}requestAnimationFrame(tick);});}catch(e){}}
function wireChart(){try{document.querySelectorAll('.hero-chart').forEach(function(box){var svg=box.querySelector('svg.chart-svg');if(!svg)return;box.style.position='relative';var tip=document.createElement('div');tip.className='ctip';tip.style.display='none';box.appendChild(tip);var dots=svg.querySelectorAll('circle.dot');if(!dots.length)return;
  svg.addEventListener('mousemove',function(e){var rect=svg.getBoundingClientRect(),x=e.clientX-rect.left,best=null,bd=1e9;dots.forEach(function(d){var dr=d.getBoundingClientRect();var cx=dr.left+dr.width/2-rect.left;var dd=Math.abs(cx-x);if(dd<bd){bd=dd;best=d;}});if(!best||bd>60)return;var t=best.querySelector('title');if(!t)return;var br=best.getBoundingClientRect(),bb=box.getBoundingClientRect();tip.textContent=t.textContent;tip.style.display='block';tip.style.left=(br.left+br.width/2-bb.left)+'px';tip.style.top=(br.top-bb.top-40)+'px';dots.forEach(function(d){d.setAttribute('r',d===best?'5':'3');});});
  svg.addEventListener('mouseleave',function(){tip.style.display='none';dots.forEach(function(d){d.setAttribute('r','3');});});});}catch(e){}}
function wireNav(){if(_mode!=='op')return;var links=document.querySelectorAll('.subnav a');var secs=[];links.forEach(function(a){var t=document.querySelector(a.getAttribute('href'));if(t)secs.push({a:a,t:t});});if(!('IntersectionObserver' in window))return;var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.remove('on');});var m=secs.find(function(x){return x.t===e.target;});if(m)m.a.classList.add('on');}});},{rootMargin:'-130px 0px -65% 0px'});secs.forEach(function(x){obs.observe(x.t);});}
function buildCmds(){return [
  {t:'→ Tổng quan',a:function(){jump('#s-ov');}},{t:'→ Cảm xúc',a:function(){jump('#s-react');}},
  {t:'→ Engagement',a:function(){jump('#s-engage');}},{t:'→ Best time',a:function(){jump('#s-time');}},
  {t:'→ Nội dung',a:function(){jump('#s-content');}},{t:'→ Video / Livestream',a:function(){jump('#s-video');}},{t:'→ Phân tích nội dung',a:function(){jump('#s-mix');}},
  {t:'→ Audience',a:function(){jump('#s-aud');}},{t:'→ Sức khỏe dữ liệu',a:function(){jump('#s-health');}},
  {t:'Thời gian · Tất cả',a:function(){flt(0);}},{t:'Thời gian · 30 ngày',a:function(){flt(30);}},{t:'Thời gian · 7 ngày',a:function(){flt(7);}},
  {t:'Trend · Views',a:function(){setMetric('views');}},{t:'Trend · Tương tác',a:function(){setMetric('eng');}},{t:'Trend · Follower',a:function(){setMetric('followers');}},
  {t:'Xóa tất cả bộ lọc',a:function(){clearAllFilters();}},{t:'Giao diện · Sáng/Tối',a:function(){toggleTheme();}},{t:'Mật độ · Thoáng/Gọn',a:function(){toggleDensity();}},
  {t:'Chế độ · Tóm tắt lãnh đạo',a:function(){setMode('ex');}},{t:'Chế độ · Bảng điều hành',a:function(){setMode('op');}}
];}
function ensureCmdk(){if(document.getElementById('cmdk-ov'))return;var ov=document.createElement('div');ov.id='cmdk-ov';ov.className='cmdk-ov';ov.innerHTML='<div class="cmdk" onclick="event.stopPropagation()"><input class="cmdk-in" id="cmdk-in" placeholder="Gõ lệnh…" oninput="cmdFilter(this.value)" onkeydown="cmdKey(event)"><div class="cmdk-list" id="cmdk-list"></div><div class="cmdk-hint"><span>↑↓ chọn</span><span>⏎ chạy</span><span>esc đóng</span></div></div>';ov.addEventListener('click',closeCmd);document.body.appendChild(ov);}
function openCmd(){ensureCmdk();_cmds=buildCmds();_cmdSel=0;cmdFilter('');document.getElementById('cmdk-ov').classList.add('show');var i=document.getElementById('cmdk-in');i.value='';setTimeout(function(){i.focus();},20);}
function closeCmd(){var o=document.getElementById('cmdk-ov');if(o)o.classList.remove('show');}
function cmdFilter(q){q=(q||'').toLowerCase();_cmdFiltered=_cmds.filter(function(c){return c.t.toLowerCase().indexOf(q)>-1;});_cmdSel=0;var box=document.getElementById('cmdk-list');if(!box)return;box.innerHTML=_cmdFiltered.map(function(c,i){return '<div class="cmdk-it'+(i===0?' sel':'')+'" onclick="cmdRun('+i+')">'+c.t+'</div>';}).join('')||'<div class="cmdk-it">Không có kết quả</div>';}
function cmdSelMove(d){var n=_cmdFiltered.length;if(!n)return;_cmdSel=(_cmdSel+d+n)%n;var its=document.querySelectorAll('#cmdk-list .cmdk-it');its.forEach(function(el,i){el.classList.toggle('sel',i===_cmdSel);});}
function cmdRun(i){var c=_cmdFiltered[i!=null?i:_cmdSel];closeCmd();if(c&&c.a)setTimeout(c.a,60);}
function cmdKey(e){if(e.key==='ArrowDown'){e.preventDefault();cmdSelMove(1);}else if(e.key==='ArrowUp'){e.preventDefault();cmdSelMove(-1);}else if(e.key==='Enter'){e.preventDefault();cmdRun();}else if(e.key==='Escape')closeCmd();}
function init(){if(_inited)return;_inited=true;document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();var o=document.getElementById('cmdk-ov');if(o&&o.classList.contains('show'))closeCmd();else openCmd();}});}

paint();
setInterval(function(){location.reload();},900000);

  } // end clientCode
  var src=clientCode.toString();
  return src.slice(src.indexOf('{')+1,src.lastIndexOf('}'));
})();
