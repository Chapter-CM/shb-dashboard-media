'use strict';
/* ===== [EMAIL] Dashboard Email — route /api/email-dashboard (alias cũ /api/email).
 * Đọc Supabase Email qua EMAIL_SUPABASE_URL / EMAIL_SUPABASE_SERVICE_KEY.
 * Là bản copy từ repo email-tracker-data/api/dashboard.js — đồng bộ khi sửa gốc. ===== */
const https = require('https');
// Đổi tên env để KHÔNG đụng Facebook (cùng 1 Vercel project, 2 Supabase khác nhau).
// Fallback tên cũ để vẫn chạy nếu chỉ set 1 bộ.
const SUPABASE_URL = process.env.EMAIL_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.EMAIL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const EVENTS_LIMIT = parseInt(process.env.EMAIL_EVENTS_LIMIT || process.env.EVENTS_LIMIT || '40000', 10);

function fetchLogs() {
  if (!SUPABASE_URL || !SERVICE_KEY) return Promise.resolve([]);
  var host = SUPABASE_URL.replace(/^https?:\/\//, '');
  var sel  = 'id:event_id,pos,rcpt,campaign,subject,msg_type,initiative,target_size,dept,role,loc,link,dest,ua,timestamp:ts';
  var hdrs = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, Accept: 'application/json' };
  var PAGE = 1000;
  var base = '/rest/v1/events?select=' + encodeURIComponent(sel);

  function fetchOne(path) {
    return new Promise(function(resolve) {
      var done = false;
      function fin(v) { if (!done) { done = true; resolve(v); } }
      var req = https.request(
        { hostname: host, path: path, headers: hdrs },
        function(r) {
          var buf = '';
          r.on('data', function(c) { buf += c; });
          r.on('end', function() {
            try { var d = JSON.parse(buf); fin(Array.isArray(d) ? d : []); }
            catch(e) { fin([]); }
          });
          r.on('error', function() { fin([]); });
        }
      );
      req.setTimeout(7000, function() { req.destroy(); fin([]); });
      req.on('error', function() { fin([]); });
      req.end();
    });
  }

  function fetchParallel(basePath, pages) {
    var reqs = [];
    for (var i = 0; i < pages; i++) {
      reqs.push(fetchOne(basePath + '&limit=' + PAGE + '&offset=' + (i * PAGE)));
    }
    return Promise.all(reqs).then(function(results) {
      return [].concat.apply([], results);
    });
  }

  return Promise.all([
    fetchParallel(base + '&pos=eq.sent&order=ts.asc',   5),
    fetchParallel(base + '&pos=neq.sent&order=ts.desc', 2)
  ])
  .then(function(r) { return r[0].concat(r[1]); })
  .catch(function()  { return []; });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const logs = await fetchLogs().catch(() => []);
  const safe = JSON.stringify(logs).replace(/<\/script>/gi, '<\\/script>');
  res.send('<!DOCTYPE html><html lang="vi"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>SHB CM Email Tracker v4.5</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">'
    + '<style>' + CSS + '.embed .mast .brand{display:none}.embed .mast .mast-in{justify-content:flex-end}</style></head>'
    + '<body><script>try{if(window.self!==window.top)document.documentElement.classList.add(\'embed\')}catch(e){document.documentElement.classList.add(\'embed\')}</script><div id="app"></div>'
    + '<script>const LOGS=' + safe + ';const REACH_TARGET=70;const MIN_N=5;const EVENTS_LIMIT=' + EVENTS_LIMIT + ';' + JS + '</script></body></html>');
};

/* ─── CSS ──────────────────────────────────────────────────────────────────── */
const CSS = `
:root{
 --bg:#0b0916;
 --glass:rgba(255,255,255,.045);--glass-2:rgba(255,255,255,.07);--glass-3:rgba(255,255,255,.11);
 --stroke:rgba(255,255,255,.09);--stroke-2:rgba(255,255,255,.15);--hair:rgba(255,255,255,.055);
 --text:#f2effc;--text-2:#bdb8db;--muted:#8e89b3;--faint:#615d83;
 --accent:#ef4444;--accent-2:#fb923c;
 --grad:linear-gradient(135deg,#e11d2a 0%,#fb7427 100%);
 --good:#34e0a1;--warn:#ffc861;--risk:#ff7d96;
 --good-bg:rgba(52,224,161,.13);--warn-bg:rgba(255,200,97,.14);--risk-bg:rgba(255,125,150,.14);--accent-bg:rgba(239,68,68,.15);
 --orb1:rgba(225,29,42,.22);--orb2:rgba(251,116,39,.16);--orb3:rgba(255,107,138,.15);--orb4:rgba(52,224,161,.11);
 --r:22px;--r-sm:14px;
 --num:'Space Grotesk',ui-monospace,monospace;
 --shadow:0 20px 54px -24px rgba(0,0,0,.72);
}
[data-theme="light"]{
 --bg:#eef0fb;
 --filter-bg:#fff;  /* filter bar select background in light mode */
 --filter-bar-bg:rgba(255,255,255,.72);
 --glass:rgba(255,255,255,.62);--glass-2:rgba(255,255,255,.8);--glass-3:rgba(255,255,255,.92);
 --stroke:rgba(90,70,180,.12);--stroke-2:rgba(90,70,180,.22);--hair:rgba(90,70,180,.07);
 --text:#241f3d;--text-2:#544e74;--muted:#7d7799;--faint:#a7a2c0;
 --accent:#dc2626;--accent-2:#ea580c;
 --good:#10a371;--warn:#c2851a;--risk:#e15572;
 --good-bg:rgba(16,163,113,.12);--warn-bg:rgba(194,133,26,.13);--risk-bg:rgba(225,85,114,.12);--accent-bg:rgba(220,38,38,.12);
 --orb1:rgba(220,38,38,.15);--orb2:rgba(234,88,12,.12);--orb3:rgba(255,120,160,.12);--orb4:rgba(52,200,150,.1);
 --shadow:0 20px 54px -28px rgba(180,40,40,.32);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--text);font-size:13.5px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh}
body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(58% 48% at 12% 6%,var(--orb1),transparent 62%),radial-gradient(52% 44% at 88% 12%,var(--orb2),transparent 62%),radial-gradient(56% 50% at 82% 92%,var(--orb3),transparent 62%),radial-gradient(50% 50% at 8% 96%,var(--orb4),transparent 62%);}
.mono,.num{font-family:var(--num);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.wrap{max-width:1200px;margin:0 auto;padding:0 26px}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes barIn{from{width:0!important}to{}}
section,.kpi,.gauge-card,.panel,.tier{animation:fade .5s cubic-bezier(.16,1,.3,1) both}
/* ── Floating tooltip ── */
#tip{position:fixed;z-index:9999;display:none;background:color-mix(in srgb,var(--bg) 90%,transparent);border:1px solid var(--stroke-2);color:var(--text-2);font-size:12px;font-weight:500;line-height:1.5;padding:9px 13px;border-radius:12px;max-width:260px;word-break:break-word;box-shadow:0 14px 36px rgba(0,0,0,.52);backdrop-filter:blur(18px);pointer-events:none;font-family:inherit}
[data-tip]{cursor:help}
/* ── Masthead ── */
.mast{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px) saturate(150%);border-bottom:1px solid var(--hair)}
.mast-in{max-width:1200px;margin:0 auto;padding:14px 26px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:34px;height:34px;border-radius:11px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;box-shadow:0 8px 22px -6px rgba(225,29,42,.6);flex-shrink:0}
.brand .tt{font-size:15px;font-weight:700;letter-spacing:-.01em}.brand .ss{font-size:11.5px;color:var(--muted);margin-top:1px}
.ctrls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.seg{display:flex;background:var(--glass);border:1px solid var(--stroke);border-radius:12px;padding:3px;backdrop-filter:blur(10px)}
.seg button{background:none;border:none;color:var(--muted);padding:6px 13px;cursor:pointer;font:inherit;font-size:12px;font-weight:600;border-radius:9px;transition:.18s}
.seg button.on{background:var(--grad);color:#fff;box-shadow:0 6px 16px -6px rgba(225,29,42,.5)}
.dtbtn{display:flex;align-items:center;gap:7px;background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);font:inherit;font-size:12px;font-weight:600;padding:7px 12px;border-radius:11px;cursor:pointer;white-space:nowrap}
.dtbtn:hover{color:var(--text);border-color:var(--stroke-2)}
.dtbtn.on{background:var(--accent-bg);border-color:var(--accent);color:var(--text)}
.dtbtn .arr{color:var(--muted);font-size:9px}
.dtpop{padding:14px;min-width:236px}
.dtpop-h{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:11px}
.dtpop-l{display:block;font-size:11px;color:var(--text-2);font-weight:600;margin-bottom:9px}
.dtpop-l input{display:block;width:100%;margin-top:4px;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12.5px;padding:8px 10px;border-radius:10px;color-scheme:dark;outline:none}
.dtpop-l input:focus{border-color:var(--accent)}
[data-theme="light"] .dtpop-l input{color-scheme:light}
.dtpop-apply{width:100%;margin-top:4px;background:var(--grad);color:#fff;border:none;font:inherit;font-size:12.5px;font-weight:700;padding:9px;border-radius:10px;cursor:pointer;box-shadow:0 8px 20px -8px rgba(225,29,42,.6)}
.dtpop-clear{width:100%;margin-top:7px;background:none;border:none;color:var(--risk);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer}
.seg button:hover:not(.on){color:var(--text)}
.icon-btn{height:36px;min-width:36px;padding:0 10px;border-radius:11px;background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;transition:.18s;backdrop-filter:blur(10px)}
.icon-btn:hover{color:var(--text);border-color:var(--stroke-2);background:var(--glass-2)}
.mode-btn{background:var(--grad);color:#fff;border:none;padding:9px 16px;border-radius:11px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;box-shadow:0 8px 20px -8px rgba(225,29,42,.6);transition:.18s}
.mode-btn.alt{background:var(--glass);color:var(--text);border:1px solid var(--stroke);box-shadow:none;backdrop-filter:blur(10px)}
.mode-btn:hover{filter:brightness(1.07)}
/* ── Subnav ── */
.subnav{position:sticky;top:65px;z-index:20;background:color-mix(in srgb,var(--bg) 70%,transparent);backdrop-filter:blur(20px);border-bottom:1px solid var(--hair)}
.subnav-in{max-width:1200px;margin:0 auto;padding:0 26px;display:flex;gap:2px;overflow-x:auto}
.subnav a{padding:13px 14px;font-size:12px;font-weight:600;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap;transition:.18s}
.subnav a.on{color:var(--text);border-bottom-color:var(--accent)}
.subnav a:hover{color:var(--text-2)}
/* ── Filter status bar ── */
.filter-status{position:sticky;top:108px;z-index:19;background:color-mix(in srgb,var(--accent-bg) 80%,transparent);border-bottom:1px solid var(--stroke);backdrop-filter:blur(16px);padding:9px 26px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.filter-status .lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);flex-shrink:0}
.f-chip{display:inline-flex;align-items:center;gap:6px;background:var(--glass-2);border:1px solid var(--stroke-2);color:var(--text);font-size:12px;font-weight:600;padding:3px 9px 3px 11px;border-radius:99px;transition:.15s}
.f-chip b{color:var(--accent)}.f-chip .cx{cursor:pointer;color:var(--muted);padding:1px 3px;border-radius:4px;transition:.15s}.f-chip .cx:hover{color:var(--risk);background:var(--risk-bg)}
.f-clear-all{background:var(--risk-bg);border:1px solid transparent;color:var(--risk);font:inherit;font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:99px;cursor:pointer;transition:.15s;margin-left:4px}
.f-clear-all:hover{border-color:var(--risk)}
/* ── Sections ── */
section{padding-top:28px;scroll-margin-top:122px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:15px;display:flex;align-items:center;gap:10px}
.eyebrow .qc{margin-left:auto;background:none;border:1px solid var(--stroke);color:var(--muted);font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:4px;transition:.15s}
.eyebrow .qc:hover{color:var(--risk);border-color:var(--risk);background:var(--risk-bg)}
.so{font-size:12.5px;color:var(--text-2);background:var(--accent-bg);border:1px solid var(--stroke);border-radius:14px;padding:12px 16px;margin-top:14px;line-height:1.6}
.so b{color:var(--accent)}
/* ── Hero / KPI ── */
.hero-row{display:grid;grid-template-columns:340px 1fr;gap:16px}
.gauge-card{background:var(--grad);border-radius:var(--r);padding:22px;color:#fff;position:relative;overflow:hidden;box-shadow:0 24px 54px -22px rgba(225,29,42,.55)}
.gauge-card::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.16);top:-90px;right:-60px;filter:blur(8px);pointer-events:none}
.gauge-card .gc-h{font-size:12px;font-weight:600;opacity:.9;position:relative;z-index:1}
.gauge-card .gc-sub{font-size:11.5px;opacity:.82;margin-top:14px;position:relative;z-index:1;line-height:1.5}
.gauge-wrap{display:flex;justify-content:center;margin:4px 0;position:relative;z-index:1}
.kpi-col{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.kpi{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:17px 18px;backdrop-filter:blur(18px);box-shadow:var(--shadow);position:relative;overflow:visible;transition:transform .17s,box-shadow .17s,border-color .17s}
.kpi::before{content:'';position:absolute;top:0;left:14px;right:14px;height:1px;background:linear-gradient(90deg,transparent,var(--stroke-2),transparent)}
.kpi:hover{transform:translateY(-3px);border-color:var(--stroke-2);box-shadow:0 28px 60px -22px rgba(0,0,0,.88)}
.kpi .kl{font-size:11px;color:var(--muted);font-weight:600;cursor:default}
.kpi .kv{font-size:29px;font-weight:700;letter-spacing:-.03em;margin-top:9px;line-height:1;font-family:var(--num)}
.kpi .krow{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:11px}
/* kpi tooltip via kpi-tip div */
.kpi-tip{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);background:color-mix(in srgb,var(--bg) 90%,transparent);border:1px solid var(--stroke-2);color:var(--text-2);font-size:11.5px;font-weight:500;line-height:1.5;padding:9px 13px;border-radius:12px;white-space:normal;width:220px;z-index:50;pointer-events:none;box-shadow:0 12px 32px rgba(0,0,0,.5);backdrop-filter:blur(18px);display:none;text-align:center}
.kpi:hover .kpi-tip{display:block}
.delta{font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px;font-family:var(--num);padding:2px 7px;border-radius:99px}
.delta.up{color:var(--good);background:var(--good-bg)}.delta.down{color:var(--risk);background:var(--risk-bg)}.delta.flat{color:var(--muted)}
.spark{height:30px;flex:1;max-width:118px}
/* ── Charts ── */
.hero-chart{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r);padding:20px 22px;margin-top:16px;backdrop-filter:blur(18px);box-shadow:var(--shadow);position:relative}
.hc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px}
.hc-title{font-size:14px;font-weight:700}
.legend{display:flex;gap:16px;font-size:11.5px;color:var(--muted)}
.legend span{display:flex;align-items:center;gap:6px}.legend i{width:11px;height:3px;border-radius:2px;display:inline-block}
.chart-svg{width:100%;height:auto;display:block;overflow:visible}
.dot{transition:r .12s,opacity .12s}
.ctip{position:absolute;transform:translateX(-50%);background:var(--glass-3);border:1px solid var(--stroke-2);color:var(--text);font-size:11.5px;font-weight:600;padding:6px 10px;border-radius:9px;pointer-events:none;white-space:nowrap;box-shadow:0 8px 22px rgba(0,0,0,.4);z-index:5;font-family:var(--num);backdrop-filter:blur(12px)}
/* ── Panels ── */
.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.panel{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r);padding:20px 22px;backdrop-filter:blur(18px);box-shadow:var(--shadow);transition:border-color .17s}
.panel:hover{border-color:var(--stroke-2)}
.panel-h{font-size:13.5px;font-weight:700;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
/* ── Funnel ── */
.funnel{display:flex;flex-direction:column;gap:8px}
.frow{display:flex;align-items:center;gap:12px}
.frow .fl{width:88px;font-size:11.5px;color:var(--muted);text-align:right;flex-shrink:0;font-weight:500}
.frow .fbar-w{flex:1;height:26px;background:var(--hair);border-radius:99px;overflow:hidden;position:relative}
.frow .fbar{height:100%;border-radius:99px;display:flex;align-items:center;padding-left:11px;font-size:11.5px;font-weight:700;color:#fff;min-width:28px;transition:width .8s cubic-bezier(.16,1,.3,1);box-shadow:0 0 16px -4px currentColor}
.frow .fn{width:42px;font-size:13px;font-weight:700;flex-shrink:0;font-family:var(--num);color:var(--text)}.frow .fp{width:40px;font-size:12px;font-weight:600;color:var(--text-2);flex-shrink:0;font-family:var(--num);text-align:right}
.frow.clickable{cursor:pointer;transition:opacity .15s}.frow.clickable:hover{opacity:.72}.frow.filt-on{background:rgba(239,68,68,.12)!important;border-radius:8px}
/* ── Hour chart ── */
.hc2{display:flex;align-items:flex-end;gap:3px;height:88px;margin-top:4px}
.hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:default}
.hcol .b{width:100%;border-radius:5px 5px 3px 3px;min-height:3px;background:var(--grad);transition:height .7s,opacity .15s;box-shadow:0 0 12px -4px var(--accent)}
.hcol .b.off{background:var(--hair);box-shadow:none}
.hcol .hl{font-size:9px;color:var(--faint);margin-top:5px;font-family:var(--num)}
.hcol:hover .b{opacity:.65}
/* ── Segment bars ── */
.seg-tg{display:flex;gap:6px}
.seg-tg button{background:var(--glass);border:1px solid var(--stroke);color:var(--muted);padding:6px 14px;border-radius:99px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:600;transition:.18s}
.seg-tg button.on{background:var(--grad);color:#fff;border-color:transparent;box-shadow:0 6px 16px -6px rgba(225,29,42,.5)}
.segrow{display:flex;align-items:center;gap:12px;padding:9px 8px;border-bottom:1px solid var(--hair);border-radius:10px;transition:background .14s;cursor:pointer}
.segrow:last-child{border-bottom:none}
.segrow:hover{background:rgba(255,255,255,.04)}
.segrow.filt-on{background:var(--accent-bg);outline:1px solid var(--accent)}
.segrow.filt-on:hover{background:var(--accent-bg)}
.segname{width:155px;font-size:12.5px;font-weight:600;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.segbar-w{flex:1;position:relative;height:24px;background:var(--hair);border-radius:99px}
.segbar{height:100%;border-radius:99px;display:flex;align-items:center;padding-left:8px;font-size:11px;font-weight:700;color:#fff;min-width:28px;font-family:var(--num);transition:width .8s cubic-bezier(.16,1,.3,1);box-shadow:0 0 16px -4px currentColor;overflow:hidden;white-space:nowrap}
.segtick{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--text);opacity:.45;border-radius:2px}
.segmeta{width:126px;font-size:11px;color:var(--muted);text-align:right;flex-shrink:0;font-family:var(--num)}
/* ── Tables ── */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;color:var(--muted);font-weight:700;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid var(--stroke);white-space:nowrap;transition:color .15s}
th[data-tip]:hover{color:var(--text-2)}
td{padding:12px 12px;border-bottom:1px solid var(--hair);font-size:12.5px;color:var(--text-2);transition:background .12s}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(255,255,255,.028)}
tbody tr[onclick]{cursor:pointer}
tbody tr.filt-on td{background:var(--accent-bg)!important}
tbody tr.filt-on:hover td{background:color-mix(in srgb,var(--accent-bg) 80%,rgba(255,255,255,.04))!important}
td.num,th.num{text-align:right;font-family:var(--num)}
td .nm{color:var(--text);font-weight:600}
/* ── Pills ── */
/* ── table search + pagination ── */
.tbl-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.tbl-search{flex:1;min-width:200px;max-width:340px;position:relative}
.tbl-search input{width:100%;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12.5px;font-weight:500;padding:8px 12px 8px 33px;border-radius:11px;outline:none;backdrop-filter:blur(10px);transition:border-color .15s}
.tbl-search input:focus{border-color:var(--accent)}
.tbl-search input::placeholder{color:var(--faint)}
.tbl-search .si{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none}
.pager{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;font-size:12px;color:var(--muted)}
.pager .pinfo{font-family:var(--num)}
.pager button{background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:9px;cursor:pointer;transition:.15s}
.pager button:hover:not(:disabled){color:var(--text);border-color:var(--stroke-2);background:var(--glass-2)}
.pager button:disabled{opacity:.38;cursor:default}
.tbl-empty{text-align:center;color:var(--muted);padding:22px;font-size:12.5px}
.pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;font-family:var(--num)}
.p-good{background:var(--good-bg);color:var(--good)}.p-warn{background:var(--warn-bg);color:var(--warn)}.p-risk{background:var(--risk-bg);color:var(--risk)}.p-neutral{background:var(--hair);color:var(--muted)}
.lown{opacity:.75}
/* ── Tiers ── */
.tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
.tier{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:18px 20px;backdrop-filter:blur(16px);box-shadow:var(--shadow);transition:transform .17s,border-color .17s,box-shadow .17s;cursor:pointer}
.tier:hover{transform:translateY(-3px);border-color:var(--stroke-2);box-shadow:0 24px 50px -18px rgba(0,0,0,.88)}
.tier .tv{font-size:30px;font-weight:700;line-height:1;letter-spacing:-.03em;font-family:var(--num)}
.tier .tn{font-size:12px;font-weight:700;margin-top:8px;display:flex;align-items:center;gap:7px}
.tier .td{font-size:11px;color:var(--muted);margin-top:3px}
.tier .dt{width:8px;height:8px;border-radius:99px;box-shadow:0 0 10px currentColor;flex-shrink:0}
/* ── Insights ── */
.ins{display:flex;flex-direction:column;gap:10px}
.in{display:flex;gap:13px;padding:14px 16px;border-radius:var(--r-sm);font-size:12.5px;line-height:1.6;background:var(--glass);border:1px solid var(--stroke);backdrop-filter:blur(14px);transition:border-color .15s,transform .15s}
.in:hover{border-color:var(--stroke-2);transform:translateX(2px)}
.in .mk{width:4px;border-radius:4px;flex-shrink:0;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.in.good .mk{background:var(--good);box-shadow:0 0 10px var(--good)}.in.warn .mk{background:var(--warn);box-shadow:0 0 10px var(--warn)}.in .x{color:var(--text-2)}.in b{color:var(--text)}
/* ── Misc ── */
.csv{background:var(--glass);border:1px solid var(--stroke);color:var(--text-2);padding:7px 13px;border-radius:10px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:600;transition:.18s}
.csv:hover{color:var(--text);border-color:var(--stroke-2);background:var(--glass-2)}
.nd{text-align:center;color:var(--muted);padding:28px;font-size:12.5px}
.notice{background:var(--warn-bg);border:1px solid var(--stroke);border-radius:var(--r);padding:18px 20px;color:var(--warn);font-size:12.5px;line-height:1.6}
.foot{color:var(--faint);font-size:11px;padding:38px 0 32px;text-align:center;font-family:var(--num)}
/* ── DH grid ── */
.dh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dh{background:var(--glass);border:1px solid var(--stroke);border-radius:var(--r-sm);padding:15px 17px;backdrop-filter:blur(14px);transition:border-color .15s,transform .15s}
.dh:hover{border-color:var(--stroke-2);transform:translateY(-2px)}
.dh-l{font-size:11px;color:var(--muted);font-weight:600}
.dh-v{font-size:23px;font-weight:700;font-family:var(--num);letter-spacing:-.02em;margin-top:7px}
.dh-v.good{color:var(--good)}.dh-v.warn{color:var(--warn)}.dh-v.risk{color:var(--risk)}
.dh-s{font-size:10.5px;color:var(--faint);margin-top:3px}
/* ── Exec ── */
.exec-h{background:var(--grad);border-radius:var(--r);padding:28px 30px;margin-bottom:16px;color:#fff;position:relative;overflow:hidden;box-shadow:0 22px 50px -22px rgba(225,29,42,.5)}
.exec-h::after{content:'';position:absolute;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.13);top:-110px;right:-50px;pointer-events:none}
.exec-k{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;position:relative;z-index:1}
.exec-kp{border-left:1px solid rgba(255,255,255,.22);padding-left:22px}.exec-kp:first-child{border-left:none;padding-left:0}
.exec-kp .v{font-size:46px;font-weight:700;line-height:.95;letter-spacing:-.03em;font-family:var(--num)}
.exec-kp .d{margin-top:8px}.exec-kp .l{font-size:12px;opacity:.85;margin-top:6px}
/* ── Command palette ── */
.cmdk-ov{position:fixed;inset:0;z-index:100;background:rgba(8,6,20,.55);backdrop-filter:blur(5px);display:none;align-items:flex-start;justify-content:center;padding-top:13vh}
.cmdk-ov.show{display:flex;animation:fade .14s ease both}
.cmdk{width:min(560px,92vw);background:var(--glass-3);border:1px solid var(--stroke-2);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.5);overflow:hidden;backdrop-filter:blur(24px);animation:pop .15s ease both}
.cmdk-in{width:100%;border:none;background:none;color:var(--text);font:inherit;font-size:15px;font-weight:500;padding:17px 19px;outline:none;border-bottom:1px solid var(--stroke)}
.cmdk-in::placeholder{color:var(--faint)}
.cmdk-list{max-height:330px;overflow-y:auto;padding:7px}
.cmdk-it{padding:11px 14px;border-radius:11px;font-size:13.5px;color:var(--text-2);cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:500;transition:background .1s}
.cmdk-it.sel{background:var(--accent-bg);color:var(--text)}
.cmdk-it .kbd{margin-left:auto;font-size:10px;color:var(--faint);font-family:var(--num)}
.cmdk-hint{padding:10px 15px;border-top:1px solid var(--stroke);font-size:11px;color:var(--faint);display:flex;gap:14px}
/* ── Filter bar ── */
.fbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0 2px}
.fbar .flbl{font-size:11px;color:var(--faint);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-right:2px}
.fbar select{appearance:none;-webkit-appearance:none;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12px;font-weight:600;padding:8px 28px 8px 13px;border-radius:11px;cursor:pointer;backdrop-filter:blur(10px);background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%238e89b3' stroke-width='1.5' stroke-linecap='round'/></svg>");background-repeat:no-repeat;background-position:right 10px center;transition:border-color .15s;max-width:160px}
.fbar select:hover{color:var(--text);border-color:var(--stroke-2)}
.csel{position:relative;display:inline-block}
.csel-btn{display:flex;align-items:center;gap:6px;background:var(--filter-bg,#1c1a2e);border:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12px;font-weight:600;padding:8px 12px 8px 13px;border-radius:11px;cursor:pointer;backdrop-filter:blur(10px);max-width:200px;transition:border-color .15s;white-space:nowrap;overflow:hidden}
.csel-btn:hover{border-color:var(--stroke-2)}
.csel-btn .csel-val{overflow:hidden;text-overflow:ellipsis;flex:1}
.csel-btn .arr{flex-shrink:0;color:var(--muted);font-size:10px}
.csel-dd{position:absolute;top:calc(100% + 5px);left:0;z-index:200;min-width:240px;max-width:320px;background:var(--glass-3);border:1px solid var(--stroke-2);border-radius:13px;box-shadow:0 16px 40px rgba(0,0,0,.5);backdrop-filter:blur(20px);overflow:hidden}
.csel-inp{width:100%;box-sizing:border-box;background:transparent;border:none;border-bottom:1px solid var(--stroke);color:var(--text);font:inherit;font-size:12.5px;padding:10px 13px;outline:none}
.csel-inp::placeholder{color:var(--faint)}
.csel-list{max-height:240px;overflow-y:auto}
.csel-opt{padding:8px 14px;font-size:12.5px;font-weight:500;cursor:pointer;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .1s}
.csel-opt:hover{background:var(--glass-2);color:var(--text)}
.csel-opt.on{color:var(--accent);font-weight:700}
.fclear{background:none;border:none;color:var(--muted);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.fclear:hover{color:var(--risk)}
/* ── ini-row ── */
.ini-row{cursor:pointer}.ini-row.filt-on td{background:var(--accent-bg)!important}
/* ── density ── */
[data-density="compact"] td{padding:9px 10px}[data-density="compact"] .kpi{padding:13px 15px}[data-density="compact"] .kpi .kv{font-size:25px}[data-density="compact"] section{padding-top:20px}[data-density="compact"] .panel{padding:15px 17px}
/* ── responsive ── */
@media(max-width:920px){.hero-row{grid-template-columns:1fr}.row2{grid-template-columns:1fr}.tiers{grid-template-columns:repeat(2,1fr)}.dh-grid{grid-template-columns:1fr}.exec-k{grid-template-columns:1fr;gap:16px}.exec-kp{border-left:none;padding-left:0;border-top:1px solid rgba(255,255,255,.2);padding-top:14px}.exec-kp:first-child{border-top:none;padding-top:0}.segname{width:110px}.segmeta{width:96px}}
@media(max-width:560px){.kpi-col{grid-template-columns:1fr}}
/* ── 9a: bảng 5a-style (ghim cột, dot phân hạng, thanh trong ô) ── */
.erbar2{width:62px;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
.erbar2>i{display:block;height:100%;background:var(--grad);border-radius:99px}
.erc{display:inline-flex;flex-direction:column;gap:5px;align-items:flex-end}
.erc b{font-family:var(--num);font-weight:700;color:var(--text);font-size:12.5px}
.ptitle{display:flex;align-items:center;gap:11px;min-width:200px}
.pt-main{font-size:12.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.pt-sub{font-size:11px;color:var(--muted);margin-top:2px}
.pin{position:sticky;left:0;z-index:2;background:var(--bg)}
tbody tr:hover .pin{background:rgba(255,255,255,.028)}
[data-theme="light"] .pin{background:var(--bg)}
[data-theme="light"] tbody tr:hover .pin{background:rgba(90,70,180,.04)}
[data-theme="light"] .erbar2{background:rgba(0,0,0,.08)}
.tdot{width:8px;height:8px;border-radius:99px;flex:none}
.tdot.hot{background:var(--good);box-shadow:0 0 8px var(--good)}
.tdot.warm{background:var(--warn)}
.tdot.cold{background:var(--risk)}
.clegend{display:flex;gap:16px;font-size:11px;color:var(--muted);margin-top:10px;flex-wrap:wrap}
.clegend span{display:flex;align-items:center;gap:6px}
/* ── 9c: heatmap giờ mở (giờ × thứ) ── */
.hm{display:grid;grid-template-columns:44px repeat(7,1fr);gap:3px;margin-top:6px}
.hm-lbl{font-size:10px;color:var(--faint);font-family:var(--num);text-align:center;align-self:center}
.hm-lbl.r{text-align:right;padding-right:6px;color:var(--muted);font-weight:600}
.hm-cell{aspect-ratio:1;border-radius:4px;min-height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff}
.hm-scale{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:10.5px;color:var(--faint)}
.hm-grad{flex:0 0 90px;height:7px;border-radius:99px;background:linear-gradient(90deg,rgba(239,68,68,.1),rgba(239,68,68,.9))}
/* ── 9f: sức khoẻ dữ liệu dạng hz-row ── */
.hz{display:flex;flex-direction:column;gap:2px}
.hz-row{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--hair)}
.hz-row:last-child{border-bottom:none}
.hz-dot{width:9px;height:9px;border-radius:99px;flex:none;box-shadow:0 0 8px currentColor}
.hz-ok{background:var(--good);color:var(--good)}.hz-warn{background:var(--warn);color:var(--warn)}.hz-risk{background:var(--risk);color:var(--risk)}
.hz-tt{font-size:12.5px;font-weight:600;color:var(--text)}
.hz-sub{font-size:11px;color:var(--muted);margin-top:2px}
.hz-badge{margin-left:auto;flex:none;font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:99px}
.hz-badge.ok{background:var(--good-bg);color:var(--good)}.hz-badge.warn{background:var(--warn-bg);color:var(--warn)}.hz-badge.risk{background:var(--risk-bg);color:var(--risk)}
/* ── 6a: kpi-grid 3×2 (6 KPI person-level) ── */
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:14px}
.kpi-grid.six{grid-template-columns:repeat(3,1fr)}
@media(max-width:920px){.kpi-grid.six{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.kpi-grid.six{grid-template-columns:1fr}}
`;

/* ─── JS ──────────────────────────────────────────────────────────────────── */
const JS = (function () {
  function clientCode() {

/* ── utils ── */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function norm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function normMail(s){return norm(s).replace(/[-.]/g,'');}
function audSearch(f,q){var qq=q.replace(/[-.]/g,'');var hay=normMail(f.rcpt)+' '+normMail(fmtRcpt(f.rcpt));return hay.indexOf(qq)>-1;}


function fmtRcpt(r){
  if(!r||r==='unknown')return '(Không rõ)';
  if(r.indexOf('@')>-1)return r;
  if(r.indexOf('-at-')>-1)return r.split('-at-')[0].replace(/-/g,'.')+'@shb.com.vn';
  if(r.indexOf('CN=')>-1||r.indexOf('cn=')>-1){var p=r.split(/CN=|cn=/);var last=p[p.length-1].replace(/[{}]/g,'').replace(/[a-f0-9]{20,}-?/gi,'').trim();return last.replace(/-/g,' ').trim()||r;}
  if(/\(.+-.+-.+\)/.test(r)){var m=r.match(/^(.+?)\s*\(/);return m?m[1].trim()+'@shb.com.vn':r;}
  if(r.indexOf(' ')===-1)return r+'@shb.com.vn';
  return r;
}

function nf(n){return (Math.round(n)||0).toLocaleString('vi-VN');}
function fmtCamp(c){return (c||'').replace(/-/g,' ').replace(/\b\w/g,function(x){return x.toUpperCase();});}
function fmtSeg(s){if(!s||s==='unknown'||s==='')return '(Chưa phân loại)';return s.replace(/-/g,' ');}
function fmtTime(iso){if(!iso)return '—';try{return new Date(iso).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(e){return iso;}}
function fmtDay(ms){try{return new Date(ms).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});}catch(e){return '';}}
function tone(p){if(p==null)return 'neutral';if(p>=REACH_TARGET)return 'good';if(p>=REACH_TARGET-20)return 'warn';return 'risk';}
function toneColor(p){return p>=REACH_TARGET?'var(--good)':p>=REACH_TARGET-20?'var(--warn)':'var(--risk)';}
function pill(p,n){
  if(p==null)return '<span class="pill p-neutral">N/A</span>';
  if(n!=null&&n<MIN_N)return '<span class="pill p-neutral lown" data-tip="Mẫu nhỏ N='+n+' — % không đủ đại diện thống kê">'+p+'%·N'+n+'</span>';
  return '<span class="pill p-'+tone(p)+'">'+p+'%</span>';
}
function quickMetrics(logs){
  var s={};logs.forEach(function(l){var k=l.id+'||'+l.rcpt;if(!s[k])s[k]={sent:false,op:false};if(l.pos==='sent')s[k].sent=true;if(l.pos==='top')s[k].op=true;});
  var a=Object.values(s),sent=a.filter(function(x){return x.sent;}).length,op=a.filter(function(x){return x.op;}).length;
  return{sent:sent,opens:op,reach:sent>0?Math.round(op/sent*100):null};
}
function windowLogs(days,offset){
  if(_from&&_to){var span=_to-_from;var hi=offset?_from:_to,lo=offset?_from-span:_from;return LOGS.filter(function(l){var t=+new Date(l.timestamp);return t>lo&&t<=hi;});}
  if(days<=0)return offset===0?LOGS:[];
  var end=Date.now()-offset*days*864e5,start=end-days*864e5;
  return LOGS.filter(function(l){var t=+new Date(l.timestamp);return t>=start&&t<end;});
}
function dailySeries(logs,days){
  if(!logs.length)return [];
  var ts=logs.map(function(l){return +new Date(l.timestamp);});
  var start=days>0?Date.now()-days*864e5:Math.min.apply(null,ts),end=Date.now();
  var span=Math.max(1,Math.ceil((end-start)/864e5));
  var step=span>35?7:1;var nb=Math.ceil(span/step);if(nb>26){step=Math.ceil(span/26);nb=Math.ceil(span/step);}
  var buckets=[];for(var i=0;i<nb;i++){var bs=start+i*step*864e5;buckets.push({ms:bs,end:bs+step*864e5,o:0,r:0,s:0});}
  logs.forEach(function(l){var t=+new Date(l.timestamp);var idx=Math.floor((t-start)/(step*864e5));if(idx<0||idx>=buckets.length)return;if(l.pos==='top')buckets[idx].o++;if(l.pos==='click')buckets[idx].r++;if(l.pos==='sent')buckets[idx].s++;});
  return buckets;
}
function deltaChip(cur,prev,goodUp){
  if(prev==null||prev===0){if(cur>0)return '<span class="delta up">mới</span>';return '';}
  var p=Math.round((cur-prev)/prev*100);if(p===0)return '<span class="delta flat">±0</span>';
  var up=p>0,cls=(up===goodUp)?'up':'down';
  return '<span class="delta '+cls+'">'+(up?'▲':'▼')+' '+Math.abs(p)+'%</span>';
}
function spark(vals,color){
  if(!vals||vals.length<2||vals.every(function(v){return v===0;}))return '';
  var max=Math.max.apply(null,vals)||1,W=120,H=30,n=vals.length;
  var pts=vals.map(function(v,i){return (i/(n-1)*W).toFixed(1)+','+(H-2-(v/max)*(H-4)).toFixed(1);});
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none"><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></svg>';
}

/* ── data processing ── */
function deviceOf(ua){
  if(!ua)return 'unknown';
  if(/GoogleImageProxy|ggpht/i.test(ua))return 'proxy';
  if(/iPhone|iPad|Android|Mobile/i.test(ua))return 'mobile';
  // Outlook Desktop + browser trên máy tính → gộp thành 'desktop'
  if(/MSOffice|Microsoft Outlook|Outlook|Windows|Macintosh|Mac OS|Linux/i.test(ua))return 'desktop';
  return 'unknown';
}

function process(logs){
  if(!logs||!logs.length)return null;

  /* ══ 1. SESSION BUILDING ══════════════════════════════════════════
     Key = event_id || rcpt. Collect topEvents[] per session, tính
     openCount sau khi sort ASC — tránh nhầm do Supabase fetch DESC. */
  var sess={};
  for(var i=0;i<logs.length;i++){
    var l=logs[i];
    if(!l.id||!l.rcpt)continue; // bỏ qua sự kiện thiếu key fields
    var k=l.id+'||'+l.rcpt,cm=l.campaign||'unknown';
    if(!sess[k])sess[k]={id:l.id,rcpt:l.rcpt,campaign:cm,
      dept:'',role:'',loc:'',msg_type:'',initiative:'',subject:'',
      ua:'',uas:[],topEvents:[],openDevices:[],
      sent:false,opened:false,clicked:false,confirmed:false,
      sentAt:null,openAt:null,first:l.timestamp,openCount:0,clicks:[],target_size:null};
    var s=sess[k];
    if(l.dept&&!s.dept)s.dept=l.dept;
    if(l.role&&!s.role)s.role=l.role;
    if(l.loc&&!s.loc)s.loc=l.loc;
    if(l.msg_type&&!s.msg_type)s.msg_type=l.msg_type;
    if(l.initiative&&!s.initiative)s.initiative=l.initiative;
    if(l.subject&&!s.subject)s.subject=l.subject;
    // campaign: cập nhật nếu session được tạo bởi click event (DESC order)
    // click events dùng clickMeta ngắn không có campaign → cần update khi gặp sent/top
    if(l.campaign&&(!s.campaign||s.campaign==='unknown'))s.campaign=l.campaign;
    if(l.target_size&&!s.target_size)s.target_size=l.target_size;
    // parseRcptMeta không dùng: rcpt là email address, không phải display name
    if(l.pos==='sent'&&!s.sent){s.sent=true;s.sentAt=l.timestamp;}
    if(l.pos==='top'){
      s.opened=true;
      s.topEvents.push({ts:l.timestamp,ua:l.ua||''});
      if(l.ua)s.uas.push(l.ua);
    }
    if(l.pos==='click'){s.clicked=true;s.clicks.push({link:l.link||'',dest:l.dest||'',ts:l.timestamp});}
    if(l.pos==='read'){s.confirmed=true;if(!s.opened)s.opened=true;} // read confirm = xác nhận đọc trên mobile
    if(l.timestamp<s.first)s.first=l.timestamp;
  }

  /* Sort topEvents ASC rồi tính openCount với 5s dedup window:
     ≤5s = Outlook tự reload (cùng 1 lần mở) → KHÔNG đếm thêm
     >5s = người dùng đóng và mở lại               → +1 lượt     */
  Object.keys(sess).forEach(function(k){
    var s=sess[k];
    if(s.topEvents.length===0){s.openAt=null;s.ua='';s.openCount=0;return;}
    s.topEvents.sort(function(a,b){return a.ts<b.ts?-1:a.ts>b.ts?1:0;});
    s.openAt=s.topEvents[0].ts;
    s.ua=s.topEvents[0].ua;
    s.openCount=1;
    s.openDevices=[s.topEvents[0].ua];
    var lastTs=new Date(s.topEvents[0].ts).getTime();
    for(var j=1;j<s.topEvents.length;j++){
      var gap=new Date(s.topEvents[j].ts).getTime()-lastTs;
      if(gap>5000){
        s.openCount++;
        s.openDevices.push(s.topEvents[j].ua);
        lastTs=new Date(s.topEvents[j].ts).getTime();
      }
    }
    // Thiết bị chính: ưu tiên mobile > desktop > proxy > unknown
    // (Outlook thường pre-load trước khi user mở trên phone → mobile wins)
    var _devSet={};
    (s.openDevices||[]).forEach(function(ua){_devSet[deviceOf(ua)]=1;});
    s.primaryDevice=['mobile','desktop','proxy','unknown'].filter(function(x){return _devSet[x];})[0]||'unknown';
  });
  var arrAll=Object.values(sess);

  /* ══ 2. FILTER OPTIONS (cho dropdowns, từ toàn bộ data) ═══════════ */
  function uniq(attr,blank){var m={};arrAll.forEach(function(s){var v=s[attr];if(!v){if(blank)v=blank;else return;}m[v]=1;});return Object.keys(m).sort();}
  var opts={campaign:uniq('campaign'),dept:uniq('dept','(Chưa phân loại)'),role:uniq('role','(Chưa phân loại)'),initiative:uniq('initiative'),msg_type:uniq('msg_type'),
    device:(function(){var m={};arrAll.forEach(function(s){s.uas.forEach(function(ua){var d=deviceOf(ua);if(d)m[d]=1;});});return Object.keys(m).sort();})()};

  /* ══ 3. CROSS-FILTER ═══════════════════════════════════════════════ */
  var F=(_filter&&typeof _filter==='object')?_filter:{};
  var arr=arrAll.filter(function(s){
    if(F.campaign&&s.campaign!==F.campaign)return false;
    if(F.dept&&(s.dept||'(Chưa phân loại)')!==F.dept)return false;
    if(F.role&&(s.role||'(Chưa phân loại)')!==F.role)return false;
    if(F.initiative&&(s.initiative||'')!==F.initiative)return false;
    if(F.msg_type&&(s.msg_type||'')!==F.msg_type)return false;
    if(F.device&&!s.uas.some(function(ua){return deviceOf(ua)===F.device;}))return false;
    return true;
  });
  if(!arr.length)return{empty:true,opts:opts,filterActive:Object.keys(F).some(function(k){return F[k];})};

  var hasSent=arr.some(function(s){return s.sent;});

  /* ══ 4. PERSON-LEVEL AGGREGATION ════════════════════════════════════
     Gộp tất cả sessions của cùng 1 người (rcpt) để tính metrics chính:
     - Open Rate = người mở / người được gửi  → KHÔNG BAO GIỜ > 100%
     - Đã mở (totalOpens) = tổng lượt mở deduplicated (mở lại = +1)
     - Device = loại thiết bị DUY NHẤT mỗi người đã dùng              */
  var personMap={};
  arr.forEach(function(s){
    var r=s.rcpt;
    if(!personMap[r])personMap[r]={rcpt:r,dept:'',role:'',loc:'',
      sent:false,opened:false,openCount:0,clicked:false,confirmed:false,devices:{},lastOpen:null};
    var p=personMap[r];
    if(s.dept&&!p.dept)p.dept=s.dept;
    if(s.role&&!p.role)p.role=s.role;
    if(s.loc&&!p.loc)p.loc=s.loc;
    if(s.sent)p.sent=true;
    if(s.opened){
      // Khi lọc theo thiết bị: chỉ đếm lượt mở từ thiết bị đó
      var devOC=F.device?(s.openDevices||[]).filter(function(ua){return deviceOf(ua)===F.device;}).length:s.openCount;
      if(devOC>0){p.opened=true;p.openCount+=devOC;}
      else if(!F.device){p.opened=true;} // không filter: opened luôn true
      if(s.openAt&&(!p.lastOpen||s.openAt>p.lastOpen))p.lastOpen=s.openAt;
    }
    if(s.confirmed)p.confirmed=true;
    if(s.clicked)p.clicked=true;
    // Collect UNIQUE device types for this person (across all their email opens)
    s.uas.forEach(function(ua){var d=deviceOf(ua);if(d)p.devices[d]=true;});
  });

  var persons=Object.values(personMap);
  var hasSeg=persons.some(function(p){return p.dept||p.role||p.loc;});

  // Người được gửi: nếu có sent events → chỉ đếm người có sent event
  var pSent   =persons.filter(function(p){return hasSent?p.sent:p.opened;});
  var pOpened =persons.filter(function(p){return p.opened;});
  var pClicked=persons.filter(function(p){return p.clicked;});

  var nSent    =pSent.length;             // Unique NGƯỜI được gửi (dùng cho openRate)
  var totalSentSessions=arr.filter(function(s){return hasSent?s.sent:(s.sent||s.opened);}).length; // Lượt gửi
  var nOpened  =pOpened.length;
  var nClicked =pClicked.length;
  var nConfirmed=persons.filter(function(p){return p.confirmed;}).length;

  // Tổng lượt mở đã deduplicate (đóng + mở lại = +1 lượt)
  var totalOpens=pOpened.reduce(function(a,p){return a+p.openCount;},0);

  // Human = ít nhất 1 lần mở từ thiết bị thật (không phải TOÀN proxy)
  var nHuman=pOpened.filter(function(p){
    return Object.keys(p.devices).some(function(d){return d!=='proxy';});
  }).length;
  var nProxyOnly=nOpened-nHuman;

  /* ══ 5. DEVICE PANEL (person-level) ════════════════════════════════
     Mỗi người đóng góp tối đa 1 lần cho mỗi loại thiết bị duy nhất.
     VD: 1 người mở 5 lần trên iPhone = chỉ tính 1 "mobile"
         1 người mở trên iPhone + Outlook = 1 "mobile" + 1 "outlook"
     Đếm theo LƯỢT MỞ: mỗi lần đóng+mở lại = 1 lượt thêm cho thiết bị đó
     % = tỷ lệ lượt mở từ thiết bị này / tổng lượt mở                */
  // deviceSplit: lượt mở theo thiết bị
  // Khi filter active → chỉ đếm device được chọn (tránh session đa thiết bị gây nhầm)
  var devMap={};var devOpenTotal=0;var F_dev=(_filter&&_filter.device)||'';
  arr.forEach(function(s){
    (s.openDevices||[]).forEach(function(ua){
      var dev=deviceOf(ua||'');
      if(!F_dev||dev===F_dev){devMap[dev]=(devMap[dev]||0)+1;devOpenTotal++;}
    });
  });
  var devTotal=devOpenTotal||1;
  var deviceSplit=['mobile','desktop','proxy','unknown']
    .filter(function(d){return devMap[d];})
    .map(function(d){return{key:d,n:devMap[d],pct:Math.round(devMap[d]/devTotal*100)};});

  /* ══ 6. SESSION-LEVEL: campaign + hour chart ════════════════════════ */
  var sent  =arr.filter(function(s){return s.sent;});
  var opened=arr.filter(function(s){return s.opened;});
  var CLICKS=[];arr.forEach(function(s){s.clicks.forEach(function(c){CLICKS.push({rcpt:s.rcpt,campaign:s.campaign,link:c.link,dest:c.dest,ts:c.ts});});});

  var camp={};
  arr.forEach(function(s){
    var cm=s.campaign;
    if(!camp[cm])camp[cm]={name:cm,subject:s.subject,initiative:s.initiative,msg_type:s.msg_type,target_size:s.target_size||null,
      rcptSent:new Set(),rcptOpen:new Set(),rcptClicked:new Set(),rcptConfirmed:new Set(),
      openEvents:0,clicks:0,delays:[],proxy:0,human:0,last:s.first};
    var c=camp[cm];
    if(s.sent||(!hasSent&&s.opened))c.rcptSent.add(s.rcpt);
    if(s.opened){
      c.rcptOpen.add(s.rcpt);c.openEvents+=s.openCount;
      var isProxy=s.uas.length>0&&s.uas.every(function(ua){return deviceOf(ua)==='proxy';});
      if(isProxy)c.proxy++;else c.human++;
    }
    if(s.clicked)c.rcptClicked.add(s.rcpt);
    if(s.confirmed)c.rcptConfirmed.add(s.rcpt);
    if(s.clicks.length)c.clicks+=s.clicks.length;
    if(s.sentAt&&s.openAt){var dl=new Date(s.openAt)-new Date(s.sentAt);if(dl>=0&&dl<2.6e8)c.delays.push(dl);}
    if(s.first>c.last)c.last=s.first;
    if(s.target_size&&!c.target_size)c.target_size=s.target_size;
  });

  var hour=new Array(24).fill(0);
  arr.forEach(function(s){if(s.openAt){try{hour[new Date(s.openAt).getHours()]++;}catch(e){}}});

  /* ══ 6b. HEATMAP GIỜ MỞ · THỨ×GIỜ (9c) — dựng từ timestamp lần mở, không field mới ══ */
  var heatDOW=[];for(var _hd=0;_hd<7;_hd++)heatDOW.push(new Array(24).fill(0));
  arr.forEach(function(s){(s.topEvents||[]).forEach(function(ev){
    try{var dt=new Date(ev.ts);var jsDay=dt.getDay();var dow=jsDay===0?6:jsDay-1;heatDOW[dow][dt.getHours()]++;}catch(e){}
  });});

  /* ══ 7. CLICK STATS ════════════════════════════════════════════════ */
  var clickers={};CLICKS.forEach(function(c){clickers[c.rcpt]=true;});
  var linkMap={};CLICKS.forEach(function(c){
    var key=(c.link&&c.link.length>2)?c.link:(c.dest||'(link)');
    if(!linkMap[key])linkMap[key]={link:c.link||'',dest:c.dest||'',n:0,clickers:{}};
    linkMap[key].n++;linkMap[key].clickers[c.rcpt]=1;
  });
  var topLinks=Object.values(linkMap).map(function(L){
    return{link:L.link,dest:L.dest,n:L.n,uniq:Object.keys(L.clickers).length};
  }).sort(function(a,b){return b.n-a.n;}).slice(0,12);
  // CTOR = người click / người mở (person-level)
  var clickStats={total:CLICKS.length,clickers:nClicked,
    ctor:nOpened>0?Math.round(nClicked/nOpened*100):0,links:topLinks,has:CLICKS.length>0};

  /* ══ 8. CAMPAIGNS (person-level reach) ════════════════════════════ */
  var campaigns=Object.values(camp).map(function(c){
    var nS=c.rcptSent.size,nO=c.rcptOpen.size,nC=c.rcptClicked.size;
    // Reach kiểm chứng = người mở THẬT (không phải proxy) / tổng người được gửi
    var vReach=nS>0?Math.round(c.human/(nS||1)*100):null;
    var avgDl=c.delays.length?Math.round(c.delays.reduce(function(a,b){return a+b;},0)/c.delays.length/60000):null;
    return{name:c.name,subject:c.subject,initiative:c.initiative,msg_type:c.msg_type,target_size:c.target_size||null,
      sent:nS,opens:nO,openEvents:c.openEvents,notOpen:nS-nO,notOpenRate:nS>0?Math.round((nS-nO)/nS*100):null,clicks:c.clicks,clickers:nC,confirmed:c.rcptConfirmed.size,
      reach:nS>0?Math.round(nO/nS*100):null,
      verifiedReach:nS>0?vReach:null,
      ctor:nO>0?Math.round(nC/nO*100):0,
      clickRate:nS>0?Math.round(nC/nS*100):null,
      avgOpenCount:nO>0?Math.round(c.openEvents/nO*10)/10:null,
      avgOpenMin:avgDl,proxy:c.proxy,last:c.last};
  }).sort(function(a,b){return b.last.localeCompare(a.last);});
  (function(){
    var n=campaigns.length||1;
    var avgR=campaigns.reduce(function(a,c){return a+(c.verifiedReach||c.reach||0);},0)/n;
    campaigns.forEach(function(c){
      var r=c.verifiedReach||c.reach||0;
      c.score=Math.round(r*0.6+(c.clickRate||0)*0.2+c.ctor*0.2);
      c.vsAvg=Math.round(r-avgR);
      c.hint=r<REACH_TARGET?'Reach thấp — thử đổi tiêu đề hoặc giờ gửi':(c.ctor<10?'Reach tốt — thêm CTA rõ ràng để tăng click':'Hiệu quả tốt — giữ công thức này');
    });
  })();

  /* ══ 9. SEGMENTS (person-level) ════════════════════════════════════ */
  function segAgg(attr){
    var m={};
    persons.forEach(function(p){
      var key=p[attr]||'(Chưa phân loại)';
      if(!m[key])m[key]={name:key,sent:0,open:0};
      if(p.sent||(!hasSent&&p.opened))m[key].sent++;
      if(p.opened)m[key].open++;
    });
    return Object.values(m).map(function(g){
      return{name:g.name,sent:g.sent,open:g.open,reach:g.sent>0?Math.round(g.open/g.sent*100):0};
    }).sort(function(a,b){return a.reach-b.reach;});
  }
  var segments={dept:segAgg('dept'),role:segAgg('role'),loc:segAgg('loc')};

  /* ══ 10. TIERS (person-level) ════════════════════════════════════== */
  var rcpts=persons.map(function(p){
    var sessSent=arr.filter(function(s){return s.rcpt===p.rcpt&&(s.sent||(!hasSent&&s.opened));}).length;
    var sessOpen=arr.filter(function(s){return s.rcpt===p.rcpt&&s.opened;}).length;
    var rate=sessSent>0?sessOpen/sessSent:0;
    var tier=(hasSent&&!p.sent)||(!hasSent&&!p.opened)?'never':rate>=0.7?'hot':rate>=0.3?'warm':'cold';
    return{rcpt:p.rcpt,dept:p.dept,role:p.role,sent:sessSent,open:sessOpen,reach:Math.round(rate*100),tier:tier};
  });
  var tiers={
    hot:rcpts.filter(function(r){return r.tier==='hot';}).sort(function(a,b){return b.open-a.open;}),
    warm:rcpts.filter(function(r){return r.tier==='warm';}),
    cold:rcpts.filter(function(r){return r.tier==='cold';}),
    never:rcpts.filter(function(r){return r.tier==='never';})
  };

  /* ══ 11. AUDIENCE LISTS (session-level cho actionable detail) ═══════ */
  var followUp=opened.filter(function(s){return !s.clicked;}).sort(function(a,b){return b.first.localeCompare(a.first);});
  var notOpened=sent.filter(function(s){return !s.opened;}).sort(function(a,b){return b.first.localeCompare(a.first);});

  /* ══ 12. INITIATIVES (person-level reach) ═══════════════════════════ */
  var iniMap={};
  arr.forEach(function(s){
    var key=s.initiative||'';if(!key)return;
    if(!iniMap[key])iniMap[key]={name:key,rcptSent:new Set(),rcptOpen:new Set(),totalSessions:0,openEvents:0,camps:new Set(),last:s.first};
    var I=iniMap[key];
    I.camps.add(s.campaign);
    I.totalSessions++; // 1 session = 1 email = 1 lượt gửi
    if(s.sent||(!hasSent&&s.opened))I.rcptSent.add(s.rcpt);
    if(s.opened){I.rcptOpen.add(s.rcpt);I.openEvents+=s.openCount;}
    if(s.first>I.last)I.last=s.first;
  });
  var initiatives=Object.values(iniMap).map(function(I){
    return{name:I.name,camps:I.camps.size,sent:I.rcptSent.size,sentSessions:I.totalSessions,opens:I.rcptOpen.size,openEvents:I.openEvents,
      reach:I.rcptSent.size>0?Math.round(I.rcptOpen.size/I.rcptSent.size*100):null,last:I.last};
  }).sort(function(a,b){return b.last.localeCompare(a.last);});

  /* ══ 13. MANDATORY ═════════════════════════════════════════════════ */
  var manSess=arr.filter(function(s){return s.msg_type==='mandatory';}),hasMandatory=manSess.length>0;
  var manCampMap={};
  manSess.forEach(function(s){var c=s.campaign;if(!manCampMap[c])manCampMap[c]={name:c,sent:0,opened:0,notOpened:[]};var M=manCampMap[c];if(s.sent||(!hasSent&&s.opened))M.sent++;if(s.opened)M.opened++;else if(s.sent)M.notOpened.push(s);});
  var mandatory=Object.values(manCampMap).map(function(M){return{name:M.name,sent:M.sent,opened:M.opened,rate:M.sent>0?Math.round(M.opened/M.sent*100):0,notOpened:M.notOpened};});

  /* ══ 14. DATA QUALITY ══════════════════════════════════════════════ */
  var allTs=arr.map(function(s){return s.first;}).filter(Boolean);
  var firstTs=allTs.length?allTs.reduce(function(a,b){return a<b?a:b;}):null;
  var lastTs=allTs.length?allTs.reduce(function(a,b){return a>b?a:b;}):null;
  var missingDept=hasSeg?pOpened.filter(function(p){return !p.dept;}).length:0;
  var dq={events:logs.length,first:firstTs,last:lastTs,
    proxyOpens:nProxyOnly,humanOpens:nHuman,
    proxyPct:nOpened?Math.round(nProxyOnly/nOpened*100):0,
    missingDept:missingDept,missingDeptPct:nOpened?Math.round(missingDept/nOpened*100):0,
    uniqRcpt:persons.length,uniqCamp:Object.keys(camp).length};

  /* ══ 15. SUMMARY METRICS (person-level, không bao giờ > 100%) ═══════
     sent        = số người được gửi email (unique rcpt có sent event)
     opens       = TỔNG lượt mở deduplicated (đóng+mở = +1 lượt)
     uniqOpeners = số người duy nhất đã mở ≥1 lần
     humanOpens  = số người mở bằng thiết bị thật (không phải toàn proxy)
     reach/openRate/clickRate ≤ 100% vì tính theo người              */
  var sum={
    sentSessions: totalSentSessions,  // Lượt gửi = số email đã gửi
    sent:        nSent,               // Người nhận (unique, dùng cho openRate)
    opens:       totalOpens,
    uniqOpeners: nOpened,
    humanOpens:  nHuman,
    proxyOpens:  nProxyOnly,
    reach:       nSent>0?Math.round(nHuman/nSent*100):null,
    verifiedReach: nSent>0?Math.round(nHuman/nSent*100):null,
    openRate:    nSent>0?Math.round(nOpened/nSent*100):null,
    // Impression = Lượt mở ÷ Lượt gửi (khác với openRate = Người mở ÷ Người gửi)
    // Ý nghĩa: mỗi email gửi đi được mở bao nhiêu lần trung bình
    impressionRate: totalSentSessions>0?Math.round(totalOpens/totalSentSessions*100):null,
    notOpenCount:nSent>0?(nSent-nOpened):null,
    notOpenRate: nSent>0?Math.round((nSent-nOpened)/nSent*100):null,
    clickRate:   nSent>0?Math.round(nClicked/nSent*100):null,
    ctor:        nOpened>0?Math.round(nClicked/nOpened*100):0,
    avgOpensPerReader: nOpened>0?Math.round(totalOpens/nOpened*10)/10:null,
    nClickers:   nClicked,
    nConfirmed:  nConfirmed,
    confirmRate: nSent>0?Math.round(nConfirmed/nSent*100):null,
    hasSent:     hasSent,
    hasSeg:      hasSeg,
    events:      logs.length,
    bestHour:    hour.indexOf(Math.max.apply(null,hour)),
    uniqRcpt:    persons.length,
    coverage:    persons.length>0?Math.round(nOpened/persons.length*100):null
  };

  return{sum:sum,campaigns:campaigns,segments:segments,tiers:tiers,
    followUp:followUp,notOpened:notOpened,hour:hour,heatDOW:heatDOW,
    people:persons,
    deviceSplit:deviceSplit,
    hasDevice:pOpened.some(function(p){return Object.keys(p.devices).length>0;}),
    clickStats:clickStats,initiatives:initiatives,hasInitiative:initiatives.length>0,
    mandatory:mandatory,hasMandatory:hasMandatory,dq:dq,opts:opts,
    filterActive:Object.keys(F).some(function(k){return F[k];})};
}
/* ── chart helpers ── */
function gPolar(cx,cy,r,deg){var a=(deg-90)*Math.PI/180;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function gArc(cx,cy,r,a0,a1){var s=gPolar(cx,cy,r,a0),e=gPolar(cx,cy,r,a1);return 'M'+s[0].toFixed(2)+' '+s[1].toFixed(2)+' A'+r+' '+r+' 0 '+((a1-a0)>180?1:0)+' 1 '+e[0].toFixed(2)+' '+e[1].toFixed(2);}
function radialGauge(pct,target){
  var p=Math.max(0,Math.min(100,pct||0)),cx=110,cy=110,r=88,sw=18,A0=-135,SPAN=270;
  var valEnd=A0+p/100*SPAN,tickA=A0+Math.max(0,Math.min(100,target))/100*SPAN;
  var ti=gPolar(cx,cy,r,tickA),to=gPolar(cx,cy,r+11,tickA);
  var stops=p>=target?['#34e0a1','#21c98a']:p>=target-20?['#ffd56b','#ff9f45']:['#ff9db0','#ff5c7c'];
  return '<svg width="220" height="200" viewBox="0 0 220 200">'
    +'<defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+stops[0]+'"/><stop offset="1" stop-color="'+stops[1]+'"/></linearGradient>'
    +'<filter id="glow"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path d="'+gArc(cx,cy,r,A0,A0+SPAN)+'" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="'+sw+'" stroke-linecap="round"/>'
    +'<path d="'+gArc(cx,cy,r,A0,valEnd)+'" fill="none" stroke="url(#gg)" stroke-width="'+sw+'" stroke-linecap="round" filter="url(#glow)"/>'
    +'<line x1="'+ti[0].toFixed(1)+'" y1="'+ti[1].toFixed(1)+'" x2="'+to[0].toFixed(1)+'" y2="'+to[1].toFixed(1)+'" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>'
    +'<text x="110" y="104" text-anchor="middle" fill="#fff" font-family="Space Grotesk,monospace" font-size="46" font-weight="700" letter-spacing="-2">'+Math.round(p)+'%</text>'
    +'<text x="110" y="130" text-anchor="middle" fill="rgba(255,255,255,.78)" font-family="Plus Jakarta Sans,sans-serif" font-size="12" font-weight="600">Mục tiêu '+target+'%</text>'
    +'</svg>';
}
function areaChart(buckets){
  if(!buckets.length||buckets.every(function(b){return b.o===0&&b.r===0;}))return '<div class="nd">Chưa đủ dữ liệu để vẽ xu hướng</div>';
  var W=900,H=240,pl=8,pr=8,pt=14,pb=26;
  var max=Math.max.apply(null,buckets.map(function(b){return Math.max(b.o,b.r);}).concat([1]));
  var n=buckets.length;
  function X(i){return pl+(n===1?(W-pl-pr)/2:(i/(n-1))*(W-pl-pr));}
  function Y(v){return pt+(1-v/max)*(H-pt-pb);}
  var base=H-pb;
  var oPts=buckets.map(function(b,i){return X(i)+','+Y(b.o);}),area='M'+X(0)+','+base+' L'+oPts.join(' L')+' L'+X(n-1)+','+base+' Z',oline='M'+oPts.join(' L');
  var rPts=buckets.map(function(b,i){return X(i)+','+Y(b.r);});
  var grid='';[0,.5,1].forEach(function(g){var y=pt+(1-g)*(H-pt-pb);grid+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="var(--hair)" stroke-width="1"/><text x="'+pl+'" y="'+(y-4)+'" fill="var(--faint)" font-size="10" font-family="monospace">'+Math.round(max*g)+'</text>';});
  var xl='';var ls=Math.max(1,Math.ceil(n/6));buckets.forEach(function(b,i){if(i%ls===0||i===n-1)xl+='<text x="'+X(i)+'" y="'+(H-8)+'" fill="var(--faint)" font-size="10" text-anchor="middle" font-family="monospace">'+fmtDay(b.ms)+'</text>';});
  var dots=buckets.map(function(b,i){return '<circle class="dot" cx="'+X(i)+'" cy="'+Y(b.o)+'" r="3" fill="var(--accent)"><title>'+fmtDay(b.ms)+': '+b.o+' mở'+(b.r?', '+b.r+' click':'')+'</title></circle>';}).join('');
  return '<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'
    +'<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>'
    +grid+'<path d="'+area+'" fill="url(#ag)"/>'
    +(buckets.some(function(b){return b.r>0;})?'<path d="M'+rPts.join(' L')+'" fill="none" stroke="var(--good)" stroke-width="1.8" stroke-dasharray="4 3" opacity=".85"/>':'')
    +'<path d="'+oline+'" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>'
    +dots+xl+'</svg>';
}

/* ── helpers ── */
function insightsOf(d){
  var s=d.sum,ins=[];
  // Cảnh báo Open Rate > 100% (dữ liệu test hoặc thiếu sent events)
  // Open Rate > 100% không còn xảy ra với person-level metrics
  if(s.hasSent&&s.reach!=null){if(s.reach>=REACH_TARGET)ins.push({t:'good',x:'Reach <b>'+s.reach+'%</b> — đạt mục tiêu (≥'+REACH_TARGET+'%). Thông điệp đang phủ sóng tốt.'});else ins.push({t:'warn',x:'Reach <b>'+s.reach+'%</b> — dưới mục tiêu '+REACH_TARGET+'%. '+s.notOpenCount+' người nhận nhưng chưa mở.'});}
  if(s.clickRate!=null&&s.clickRate>0)ins.push({t:s.clickRate>=10?'good':'warn',x:'Click Rate <b>'+s.clickRate+'%</b> — '+(s.clickRate>=10?'Engagement tốt.':'Còn thấp — thêm CTA rõ ràng.')});
  if(s.avgOpensPerReader!=null&&s.avgOpensPerReader>1.3)ins.push({t:'good',x:'Avg <b>'+s.avgOpensPerReader+'x</b> mở/người — email được mở lại nhiều lần.'});
  if(s.hasSeg){var w=d.segments.dept.filter(function(g){return g.sent>=3&&g.name!=='(Chưa phân loại)';})[0];if(w&&w.reach<REACH_TARGET-10)ins.push({t:'warn',x:'Đơn vị <b>'+fmtSeg(w.name)+'</b> chỉ đạt reach '+w.reach+'% — thấp nhất, đề xuất nhắc qua trưởng đơn vị.'});}
  if(d.tiers.never.length>0&&s.hasSent)ins.push({t:'warn',x:'<b>'+d.tiers.never.length+'</b> người được gửi nhưng chưa bao giờ mở.'});
  if(d.followUp.length>0)ins.push({t:'warn',x:'<b>'+d.followUp.length+'</b> người mở nhưng chưa click — thêm CTA rõ để tăng hành động.'});
  // Cảnh báo subject trùng → mobile threading
  var subjects={};d.campaigns.forEach(function(c){if(c.subject){subjects[c.subject]=(subjects[c.subject]||0)+1;}});
  var dupSubjects=Object.keys(subjects).filter(function(s){return subjects[s]>1;});
  if(dupSubjects.length>0)ins.push({t:'warn',x:'<b>Cảnh báo email threading:</b> '+dupSubjects.length+' subject trùng nhau giữa các chiến dịch. Mobile email client (Gmail/Apple Mail) có thể gộp thành thread và load pixel của CẢ HAI email khi mở. Thêm tháng/mã vào subject để phân biệt.'});
  if(!ins.length)ins.push({t:'info',x:'Thu thập thêm dữ liệu để hiển thị phân tích tự động.'});
  return ins;
}
function qclearBtn(){
  var F=_filter||{};var has=Object.keys(F).some(function(k){return F[k];});
  if(!has)return '';
  return '<button class="qc" onclick="clearAllFilters()" data-tip="Xóa tất cả bộ lọc đang active, trở về trạng thái ban đầu">× Xóa lọc</button>';
}

/* ── sections ── */
var _TBL={},_tblState={};
function regTable(cfg){_TBL[cfg.id]=cfg;return cfg;}
function searchBox(id,ph){return '<div class="tbl-tools"><div class="tbl-search"><span class="si">⌕</span><input type="text" placeholder="'+esc(ph)+'" oninput="tblSearch(\''+id+'\',this.value)" autocomplete="off" spellcheck="false"></div></div>';}
function tblFilter(cfg){var st=_tblState[cfg.id]||{q:'',page:0};var q=norm(st.q);if(!q)return cfg.rows;return cfg.rows.filter(function(r){return cfg.search(r,q);});}
function tblRender(id){
  var cfg=_TBL[id];if(!cfg)return;
  var st=_tblState[id]||(_tblState[id]={q:'',page:0});
  var rows=tblFilter(cfg),ps=cfg.pageSize||15,pages=Math.max(1,Math.ceil(rows.length/ps));
  if(st.page>=pages)st.page=pages-1;if(st.page<0)st.page=0;
  var tb=document.getElementById('tb-'+id);
  if(tb){tb.innerHTML=rows.length?rows.slice(st.page*ps,st.page*ps+ps).map(cfg.render).join(''):'<tr><td colspan="'+(cfg.cols||6)+'" class="tbl-empty">Không tìm thấy kết quả khớp</td></tr>';}
  var pg=document.getElementById('pg-'+id);
  if(pg){
    if(rows.length<=ps&&st.page===0){pg.innerHTML=rows.length?'<span class="pinfo">'+rows.length+' dòng</span>':'';}
    else{pg.innerHTML='<span class="pinfo">'+(rows.length?st.page*ps+1:0)+'–'+Math.min(rows.length,(st.page+1)*ps)+' / '+rows.length+'</span>'
      +'<button onclick="tblPage(\''+id+'\',-1)"'+(st.page<=0?' disabled':'')+'>‹ Trước</button>'
      +'<button onclick="tblPage(\''+id+'\',1)"'+(st.page>=pages-1?' disabled':'')+'>Sau ›</button>';}
  }
}
function tblSearch(id,v){var st=_tblState[id]||(_tblState[id]={q:'',page:0});st.q=v;st.page=0;tblRender(id);}
function tblPage(id,delta){var st=_tblState[id]||(_tblState[id]={q:'',page:0});st.page+=delta;tblRender(id);}
function mountAllTables(){Object.keys(_TBL).forEach(tblRender);}


function heroRow(d,cur,prev,ser){
  var s=d.sum,oS=ser.map(function(b){return b.o;}),sS=ser.map(function(b){return b.s;});
  var gVal=s.verifiedReach!=null?Math.min(100,s.verifiedReach):s.reach!=null?Math.min(100,s.reach):0;
  var gHead=s.hasSent?'Open Rate · Reach kiểm chứng':'Open Rate (chưa có dữ liệu gửi)';
  var note=s.proxyOpens>0?' · đã loại '+s.proxyOpens+' người chỉ mở qua proxy':'';
  var gSub=s.hasSent?(s.uniqOpeners+' người mở / '+s.sent+' người được gửi'+note):(s.uniqOpeners+' người đã mở');
  var gauge='<div class="gauge-card" data-tip="Reach đã kiểm chứng = số người mở thật ÷ tổng gửi. Open giả từ security gateway đã được loại bỏ. Mục tiêu '+REACH_TARGET+'%."><div class="gc-h">'+gHead+'</div><div class="gauge-wrap">'+radialGauge(gVal,REACH_TARGET)+'</div><div class="gc-sub">'+gSub+'</div></div>';
  function card(label,ic,value,dH,spH,tip){return '<div class="kpi">'+(tip?'<div class="kpi-tip">'+tip+'</div>':'')+'<div class="kl"><span class="ki">'+ic+'</span>'+label+'</div><div class="kmid"><div class="kv">'+value+'</div>'+(spH||'')+'</div><div class="ksub">'+(dH||'')+'</div></div>';}
  // 6 KPI chuẩn email (person-level): Đã gửi · Đã mở (lượt) · Tỉ lệ mở · Đã click · CTOR · Xác nhận đọc
  var k1=card('Đã gửi','✉',s.hasSent?nf(s.sent):'—',s.hasSent?deltaChip(cur.sent,prev.sent,true):'',spark(sS,'var(--accent-2)'),'Số người nhận duy nhất có sự kiện gửi (pos=sent). 1 người nhận nhiều chiến dịch = chỉ tính 1 người.');
  var k2=card('Đã mở (lượt)','👁',nf(s.opens),deltaChip(cur.opens,prev.opens,true),spark(oS,'var(--accent-2)'),'Tổng số lần email được mở, đã trừ mở-lại &lt;5s (Outlook tự reload). Đóng rồi mở lại (gap &gt;5s) = +1 lượt.');
  var k3=card('Tỉ lệ mở','📈',s.openRate!=null?s.openRate+'%':'—',s.openRate!=null?(s.openRate>=REACH_TARGET?'<span class="delta up">▲ đạt</span>mục tiêu '+REACH_TARGET+'%':'<span class="delta down">▼ dưới</span>mục tiêu '+REACH_TARGET+'%'):'','','Người mở ÷ Người gửi (person-level) — không bao giờ vượt 100%. Mục tiêu '+REACH_TARGET+'%.');
  var k4=card('Đã click','🖱',nf(s.nClickers||0),'','','Số người unique đã click ít nhất 1 link.');
  var k5=card('CTOR','🎯',(d.clickStats.ctor||0)+'%','','','Click-to-Open Rate = Người click ÷ Người mở.');
  var k6=card('Xác nhận đọc','✔',nf(s.nConfirmed||0),'','','Người đã nhấn link ✓ Xác nhận đã đọc trong email — tín hiệu đọc mạnh nhất, không bị cache mobile.');
  return '<div class="hero-row">'+gauge+'<div class="kpi-grid six">'+k1+k2+k3+k4+k5+k6+'</div></div>';
}

function heroChart(d,ser){
  return '<div class="hero-chart"><div class="hc-head"><div class="hc-title" data-tip="Xu hướng số lượt mở và click theo thời gian. Đường liền = opens, đường đứt = clicks.">Xu hướng tương tác theo thời gian</div>'
    +'<div class="legend"><span><i style="background:var(--accent)"></i>Lượt mở</span><span><i style="background:var(--good)"></i>Lượt click</span></div></div>'
    +areaChart(ser)+'</div>';
}

function funnelPanel(d){
  var s=d.sum,base=s.hasSent?s.sentSessions:s.uniqOpeners;
  function fr(label,n,pct,color,tip){var w=base>0?Math.round(n/base*100):0;return '<div class="frow" data-tip="'+esc(tip)+'"><div class="fl">'+label+'</div><div class="fbar-w"><div class="fbar" style="width:'+Math.min(100,Math.max(w,3))+'%;background:'+color+'"></div></div><div class="fn">'+n+'</div><div class="fp">'+(pct!=null?pct+'%':'')+'</div></div>';}
  var f='<div class="funnel">'
    +(s.hasSent?fr('Lượt gửi',s.sentSessions,null,'var(--accent)','Tổng số email đã gửi (= sessions có sent event). 1 người nhận 3 đợt = 3 lượt gửi.'):'')
    +fr('Người mở',s.uniqOpeners,s.hasSent?s.openRate:null,'var(--accent-2)','Người mở = số người duy nhất đã mở ≥1 lần. Open Rate = Người mở ÷ Người gửi (không bao giờ >100%).')
    +(s.hasSent?fr('Chưa mở',s.notOpenCount!=null?s.notOpenCount:0,s.notOpenRate,'var(--risk)','Người nhận email nhưng chưa mở lần nào. Cần follow-up trực tiếp.'):'')
    +(s.nConfirmed>0?fr('Xác nhận đọc',s.nConfirmed,s.confirmRate,'var(--good)','Người đã nhấn link ✓ Xác nhận đã đọc trong email. Đây là tín hiệu đọc MẠNH NHẤT — chắc chắn hơn pixel tracking, không bị cache mobile.'):'')
    +fr('Lượt mở',s.opens,null,'var(--good)','Tổng lượt mở = tổng số lần email được mở, kể cả mở lại nhiều lần. 1 người mở 3 lần = 3 lượt. Khác với Người mở (đếm unique).')
    +fr('Người click',s.nClickers,s.clickRate,'#f5a623','Người click = số người duy nhất đã click ≥1 link. Unique clickers, không phải tổng lượt click.')
    +'</div>'
    +'<div style="font-size:11px;color:var(--faint);margin-top:10px">Vạch đáy hiển thị tỷ lệ so với tổng gửi. Pixel bottom (đọc hết) không đo được trên Outlook Desktop.</div>';
  return '<div class="panel"><div class="panel-h" data-tip="Phễu đo hành trình từ gửi → mở → mở thật → click. Mỗi bước cho biết drop-off rate.">Phễu tương tác</div>'+f+'</div>';
}

function timingPanel(d){
  var s=d.sum,maxH=Math.max.apply(null,d.hour.concat([1])),bars='';
  for(var h=0;h<24;h++){var v=d.hour[h];var p=Math.round(v/maxH*100);var off=(h<7||h>18)?' off':'';var lb=(h%3===0)?h:'';bars+='<div class="hcol" title="'+h+':00 — '+v+' lượt mở"><div class="b'+off+'" style="height:'+Math.max(p,2)+'%"></div><div class="hl">'+lb+'</div></div>';}
  return '<div class="panel"><div class="panel-h" data-tip="Phân bố giờ người dùng mở email. Giờ cao điểm = thời điểm tốt nhất để gửi email tiếp theo.">Phân bố giờ mở · cao điểm <b style=\'color:var(--accent)\'>'+(s.bestHour||0)+':00</b></div><div class="hc2">'+bars+'</div>'
    +'<div style="font-size:11px;color:var(--faint);margin-top:10px">Cột xanh = giờ làm việc (7h–18h). Lên lịch gửi email vào giờ cao điểm để tối ưu open rate.</div></div>';
}

/* ── 9c: heatmap giờ mở · giờ×thứ — dựng từ timestamp lần mở (d.heatDOW), không field mới ── */
var HM_BUCKETS=[[6,9],[9,12],[12,15],[15,18],[18,21],[21,24]];
var HM_DOW=['T2','T3','T4','T5','T6','T7','CN'];
function openHeatSection(d){
  var heat=d.heatDOW||[];
  if(!heat.length||!heat.some(function(row){return row.some(function(v){return v>0;});})){
    return '<section id="s-openhm"><div class="eyebrow">Khung giờ mở email '+qclearBtn()+'</div><div class="nd">Chưa đủ dữ liệu để dựng heatmap giờ mở.</div></section>';
  }
  var bmax=1,best={dow:0,b:0};
  var buckets=HM_BUCKETS.map(function(rng,bi){
    return HM_DOW.map(function(_,dow){
      var s=0;for(var h=rng[0];h<rng[1];h++)s+=(heat[dow]&&heat[dow][h])||0;
      if(s>bmax){bmax=s;best={dow:dow,b:bi};}
      return s;
    });
  });
  var cells='<span class="hm-lbl"></span>'+HM_DOW.map(function(x){return '<span class="hm-lbl">'+x+'</span>';}).join('');
  buckets.forEach(function(row,bi){
    cells+='<span class="hm-lbl r">'+HM_BUCKETS[bi][0]+'–'+HM_BUCKETS[bi][1]+'h</span>';
    row.forEach(function(v,dow){
      var op=v?(.1+v/bmax*.85):.05;
      var isPeak=bi===best.b&&dow===best.dow&&v>0;
      cells+='<span class="hm-cell" style="background:rgba(239,68,68,'+op.toFixed(2)+')" data-tip="'+HM_DOW[dow]+' '+HM_BUCKETS[bi][0]+'–'+HM_BUCKETS[bi][1]+'h: '+nf(v)+' lượt mở">'+(isPeak?'↑':'')+'</span>';
    });
  });
  return '<section id="s-openhm"><div class="eyebrow">Khung giờ mở email '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h">Heatmap lượt mở · giờ × thứ<span style="font-weight:600;color:var(--muted);font-size:11px">đậm = nhiều lượt mở</span></div>'
    +'<div class="hm">'+cells+'</div>'
    +'<div class="hm-scale">Thấp<span class="hm-grad"></span>Cao · <b style="color:var(--text-2)">Giờ vàng: '+HM_DOW[best.dow]+' · '+HM_BUCKETS[best.b][0]+'–'+HM_BUCKETS[best.b][1]+'h</b></div></div>'
    +'<div class="so">→ Heatmap dựng từ <b>timestamp</b> của mỗi lần mở (thứ × giờ) — không cần field mới. Gợi ý giờ gửi tối ưu = ô đậm nhất.</div></section>';
}

/* ── 9e: người nhận (recipient-level) — ai đã mở/click, dùng d.people (person-level) ── */
var _recTab='all';
function setRecTab(t){_recTab=t;paint();}
function recRow(p){
  var tier=!p.opened?'cold':p.clicked?'hot':'warm';
  return '<tr data-tip="'+(p.opened?p.openCount+' lượt mở':'Chưa mở email nào')+'"><td class="pin"><div class="ptitle"><span class="tdot '+tier+'"></span><div><div class="pt-main">'+esc(fmtRcpt(p.rcpt))+'</div><div class="pt-sub">'+esc(fmtRcpt(p.rcpt))+'</div></div></div></td>'
    +'<td>'+esc(fmtSeg(p.dept||p.role))+'</td>'
    +'<td class="num">'+(p.opened?p.openCount:0)+'</td>'
    +'<td class="num" style="font-size:11px">'+(p.lastOpen?fmtTime(p.lastOpen):'—')+'</td>'
    +'<td class="num">'+(p.clicked?'<span class="pill p-good">✔</span>':'—')+'</td>'
    +'<td class="num">'+(p.confirmed?'<span class="pill p-good">✔</span>':'—')+'</td></tr>';
}
function recipientSection(d){
  var people=d.people||[];
  if(!people.length)return '';
  var notOpenN=people.filter(function(p){return !p.opened;}).length;
  var rows=_recTab==='no'?people.filter(function(p){return !p.opened;}):people;
  regTable({id:'rec',rows:rows,render:recRow,pageSize:20,cols:6,placeholder:'Tìm người nhận / email…',search:function(p,q){return normMail(p.rcpt).indexOf(q.replace(/[-.]/g,''))>-1||norm(fmtRcpt(p.rcpt)).indexOf(q)>-1;}});
  var tabs='<div class="ctools" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    +searchBox('rec','Tìm người nhận / email…')
    +'<div class="seg"><button class="'+(_recTab==='all'?'on':'')+'" onclick="setRecTab(\'all\')">Tất cả <span class="pill p-neutral" style="font-size:10px">'+people.length+'</span></button>'
    +'<button class="'+(_recTab==='no'?'on':'')+'" onclick="setRecTab(\'no\')">Chưa mở <span class="pill p-neutral" style="font-size:10px">'+notOpenN+'</span></button></div></div>';
  return '<section id="s-rec"><div class="eyebrow">Người nhận — trạng thái mở &amp; click '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h">Person-level</div>'
    +tabs
    +'<div class="tw"><table><thead><tr><th class="pin">Người nhận</th><th>Phòng ban</th><th class="num">Lần mở</th><th class="num">Mở gần nhất</th><th class="num">Click</th><th class="num">Xác nhận</th></tr></thead><tbody id="tb-rec"></tbody></table></div>'
    +'<div class="clegend"><span><span class="tdot hot"></span>Đã mở &amp; click</span><span><span class="tdot warm"></span>Đã mở, chưa click</span><span><span class="tdot cold"></span>Chưa mở</span></div>'
    +'<div class="pager" id="pg-rec"></div></div></section>';
}

function engagementPanel(d){
  var s=d.sum;
  function stat(label,val,toneCls,tip){return '<div class="dh" data-tip="'+esc(tip)+'"><div class="dh-l">'+label+'</div><div class="dh-v '+(toneCls||'')+'">'+val+'</div></div>';}
  return '<div class="panel"><div class="panel-h" data-tip="Tóm tắt các chỉ số engagement quan trọng nhất trong kỳ lọc hiện tại.">Engagement tổng hợp</div>'
    +'<div class="dh-grid">'
    +stat('Chưa mở',s.notOpenRate!=null?s.notOpenCount+' ng ('+(s.notOpenRate)+'%)':'—',s.notOpenRate!=null&&s.notOpenRate<20?'good':s.notOpenRate<50?'warn':'risk','Số người nhận nhưng chưa mở = '+( s.notOpenCount||'—')+'người. Mục tiêu < 30% để đảm bảo độ phủ.')
      +stat('Open Rate / Reach',s.openRate!=null?s.openRate+'% (Reach: '+(s.verifiedReach||s.reach)+'%)':'—',s.openRate>=REACH_TARGET?'good':s.openRate>=REACH_TARGET-20?'warn':'risk','Số người mở ÷ số người được gửi. Mục tiêu ≥'+REACH_TARGET+'%.')
    +stat('Impression',s.impressionRate!=null?s.impressionRate+'%':'—',s.impressionRate>150?'good':s.impressionRate>80?'warn':'neutral','Impression = Lượt mở ÷ Lượt gửi. Mỗi email được xem bao nhiêu lần. >3× = engagement cao.')
      +stat('Avg mở/người',s.avgOpensPerReader!=null?s.avgOpensPerReader+'x':'—',s.avgOpensPerReader>1.3?'good':'','Trung bình số lần 1 người mở email. >1.3x = nội dung đủ hấp dẫn để mở lại.')
    +stat('Click Rate',s.clickRate!=null?s.clickRate+'%':'—',s.clickRate>=10?'good':s.clickRate>0?'warn':'','Số người click ÷ số người được gửi.')
    +stat('Người mở',s.uniqOpeners,'','Số người duy nhất đã mở ≥1 lần (unique). Khác với Lượt mở (1 người mở nhiều lần = nhiều lượt).')
    +stat('Người click',s.nClickers||0,s.nClickers>0?'good':'','Số người duy nhất đã click ≥1 link. Chỉ số engagement mạnh nhất.')
    +stat('Xác nhận đọc',s.nConfirmed>0?s.nConfirmed+' người ('+s.confirmRate+'%)':'—',s.nConfirmed>0?'good':'','Người chủ động nhấn link ✓ ở cuối email. Tín hiệu đọc tin cậy nhất — hoạt động cả trên mobile dù pixel bị cache.')
      +stat('CTOR',d.clickStats.ctor+'%',d.clickStats.ctor>=20?'good':d.clickStats.ctor>0?'warn':'','Click-to-Open Rate = Người click ÷ Người mở. Đo chất lượng nội dung và CTA.')
    +'</div></div>';
}

function devicePanel(d){
  if(!d.hasDevice)return '<div class="panel"><div class="panel-h">Thiết bị</div><div class="nd">Chưa thu được User-Agent</div></div>';
  var label={mobile:'Điện thoại',desktop:'Máy tính (Desktop + Outlook)',proxy:'Proxy / Bot',unknown:'Không rõ'};
  var color={mobile:'var(--accent)',desktop:'var(--accent-2)',proxy:'var(--warn)',unknown:'var(--muted)'};
  var tips={mobile:'Email client mobile: iOS Mail, Gmail app, Outlook Mobile (iPhone/iPad/Android).',desktop:'Máy tính: Outlook Desktop (Windows/Mac), Webmail (Chrome/Firefox). Gộp chung vì cùng dải UA trên máy tính.',proxy:'Open tự động bởi security gateway hoặc Google Image Proxy — KHÔNG phải người thật. Được loại khỏi Reach kiểm chứng.',unknown:'Không xác định được thiết bị hoặc email client.'};
  var F=_filter||{};
  var bars='';
  d.deviceSplit.forEach(function(x){
    var isActive=F.device===x.key;
    bars+='<div class="frow clickable'+(isActive?' filt-on':'')+'" onclick="setFilter(\'device\',\''+(isActive?'':x.key)+'\')" data-tip="'+esc((tips[x.key]||x.key)+' · '+x.n+' lượt ('+x.pct+'%) · Bấm để lọc/bỏ lọc')+'">'
      +'<div class="fl" style="width:108px;text-align:left">'+label[x.key]+'</div>'
      +'<div class="fbar-w"><div class="fbar" style="width:'+Math.min(100,Math.max(x.pct,3))+'%;background:'+color[x.key]+'" aria-label="'+x.pct+'%"></div></div>'
      +'<div class="fp">'+x.pct+'%</div>'
      +'<div class="fn">'+x.n+'</div></div>';
  });
  return '<div class="panel"><div class="panel-h" data-tip="Số lượt mở (open events) theo thiết bị. Đóng rồi mở lại = +1 lượt. Outlook tự reload trong 5s = không tính. % = tỷ lệ lượt mở từ thiết bị này trên tổng lượt mở.">Thiết bị · <span style="font-size:12px;font-weight:500;color:var(--muted)">bấm để lọc</span>'+(F.device?'<button class="csv" onclick="setFilter(\'device\',\'\')" style="font-size:11px;padding:4px 9px">× Bỏ lọc</button>':'')+'</div><div class="funnel">'+bars+'</div><div style="font-size:11px;color:var(--faint);margin-top:10px">% = tỷ lệ lượt mở từ thiết bị này / tổng lượt mở. Số = lượt (đóng+mở lại = +1). Proxy = load giả bởi security gateway.</div></div>';
}

function segBars(list,attr){
  attr=attr||'dept';
  if(!list||!list.length||list.every(function(g){return g.name==='(Chưa phân loại)';}))return '<div class="nd">Chưa có dữ liệu phân khúc.<br>Dữ liệu được parse tự động từ tên người nhận theo định dạng:<br><b>Tên (Cấp Bậc - Phòng Ban - Khối)</b></div>';
  var F=_filter||{};var rows='';
  list.forEach(function(g){
    var low=g.sent<MIN_N,isActive=F[attr]===g.name;
    var tip='Reach: '+g.reach+'% · '+g.open+' người mở / '+g.sent+' người được gửi'+(low?' · Mẫu nhỏ, không đủ tin cậy':g.reach>=REACH_TARGET?' · Đạt mục tiêu':' · Dưới mục tiêu '+REACH_TARGET+'%')+(g.name!=='(Chưa phân loại)'?' · Bấm để lọc toàn dashboard theo đơn vị này':'');
    var clk=g.name!=='(Chưa phân loại)'?' onclick="setFilter(\''+attr+'\',\''+(isActive?'':jsq(g.name))+'\')" '+'data-tip="'+esc(tip)+'"':'';
    var lbl=low?(g.reach+'%·N'+g.sent):(g.reach+'%');
    rows+='<div class="segrow'+(isActive?' filt-on':'')+(low?' lown':'')+'"'+clk+'>'
      +'<div class="segname" title="'+esc(fmtSeg(g.name))+'">'+esc(fmtSeg(g.name))+'</div>'
      +'<div class="segbar-w"><div class="segbar" style="width:'+Math.min(100,Math.max(g.reach,4))+'%;background:'+toneColor(g.reach)+'">'+lbl+'</div><div class="segtick" style="left:'+REACH_TARGET+'%"></div></div>'
      +'<div class="segmeta">'+g.open+'/'+g.sent+'</div></div>';
  });
  return rows;
}

function segmentSection(d){
  if(!d.sum.hasSeg)return '<section id="s-seg"><div class="eyebrow">Phân khúc '+qclearBtn()+'</div><div class="notice"><b>Chưa có dữ liệu phân loại.</b> Cần tên người nhận theo định dạng: <b>Tên (Cấp Bậc - Phòng Ban - Khối)</b> trong trường rcpt của macro.</div></section>';
  window.__seg=d.segments;
  var worst=d.segments.dept.filter(function(g){return g.sent>=3&&g.name!=='(Chưa phân loại)';})[0];
  var F=_filter||{};var activeSegFilter=F.dept||F.role||F.loc;
  var clearBtn=activeSegFilter?'<button class="csv" onclick="(function(){delete _filter.dept;delete _filter.role;delete _filter.loc;paint();})()" style="font-size:11px;padding:4px 9px">× Bỏ lọc phân khúc</button>':'';
  return '<section id="s-seg"><div class="eyebrow">Phân khúc · reach theo đơn vị (bấm bar để lọc) '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h"><div class="seg-tg"><button class="on" onclick="segView(\'dept\',this)" data-tip="Reach theo phòng ban / trung tâm">Phòng ban</button><button onclick="segView(\'role\',this)" data-tip="Reach theo cấp bậc chức danh">Cấp bậc</button><button onclick="segView(\'loc\',this)" data-tip="Reach theo khối nghiệp vụ">Chi nhánh/Khối</button></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--faint)" data-tip="Vạch trắng đứng = mục tiêu reach '+REACH_TARGET+'%">Vạch = mục tiêu '+REACH_TARGET+'%</span>'+clearBtn+'</div></div>'
    +'<div id="segbox">'+segBars(d.segments.dept,'dept')+'</div></div>'
    +(worst?'<div class="so">→ Đơn vị cần chú ý: <b>'+fmtSeg(worst.name)+'</b> ('+worst.reach+'% reach). Đề xuất nhắc qua trưởng đơn vị hoặc gửi email riêng.</div>':'')
    +'</section>';
}

function campRow(c){
  var F=_filter||{};
  var r=c.verifiedReach!=null?c.verifiedReach:c.reach;
  var isActive=F.campaign===c.name;
  var vs=c.vsAvg>0?'<span class="delta up">+'+c.vsAvg+'</span>':(c.vsAvg<0?'<span class="delta down">'+c.vsAvg+'</span>':'<span class="delta flat">0</span>');
  var man=c.msg_type==='mandatory'?'<span class="pill p-warn" style="font-size:9px;padding:1px 6px;margin-left:6px">BẮT BUỘC</span>':'';
  var tier=r>=REACH_TARGET?'hot':r>=REACH_TARGET-30?'warm':'cold';
  var rw=Math.max(0,Math.min(100,r||0));
  return '<tr class="'+(isActive?'filt-on':'')+'" onclick="setFilter(\'campaign\',\''+(isActive?'':jsq(c.name))+'\')" data-tip="'+esc(c.hint||'')+(isActive?' · Đang lọc — bấm để bỏ lọc':' · Bấm để lọc toàn dashboard')+'">'
    +'<td class="pin"><div class="ptitle"><span class="tdot '+tier+'"></span><div><div class="pt-main">'+esc(fmtCamp(c.name))+man+'</div><div class="pt-sub">'+esc(c.subject||c.initiative||'—')+'</div></div></div></td>'
    +'<td class="num" data-tip="'+(c.target_size?'Mục tiêu: '+c.target_size+' người':'')+'">'
      +(c.sent>0?nf(c.sent):'—')
      +(c.target_size&&c.target_size>c.sent?'<span style="color:var(--muted);font-size:10px"> /'+nf(c.target_size)+'</span>':'')
      +'</td>'
    +'<td class="num"><b>'+nf(c.opens)+'</b></td>'
    +'<td class="num" data-tip="'+(N(c.sent)?'Mẫu nhỏ N='+c.sent+' — % không đủ đại diện thống kê':(c.notOpen||0)+' người được gửi nhưng chưa mở')+'"><span class="erc"><b>'+(r!=null?r+'%':'—')+'</b><span class="erbar2"><i style="width:'+rw+'%"></i></span></span></td>'
    +'<td class="num">'+nf(c.clickers||0)+'</td>'
    +'<td class="num">'+(c.ctor>0?c.ctor+'%':'—')+'</td>'
    +'<td class="num" data-tip="'+c.confirmed+' người đã nhấn ✓ Xác nhận đã đọc">'
      +(c.confirmed>0?'<span class="pill p-good">'+c.confirmed+'</span>':'—')+'</td></tr>';
}
function N(n){return n!=null&&n<MIN_N;}
var _campTab='all';
function setCampTab(t){_campTab=t;paint();}
function campaignSection(d){
  if(!d.campaigns.length)return '';
  var F=_filter||{};
  var goalN=d.campaigns.filter(function(c){return (c.verifiedReach!=null?c.verifiedReach:c.reach)>=REACH_TARGET;}).length;
  var rows=_campTab==='goal'?d.campaigns.filter(function(c){return (c.verifiedReach!=null?c.verifiedReach:c.reach)>=REACH_TARGET;}):d.campaigns;
  regTable({id:'camp',rows:rows,render:campRow,pageSize:15,cols:7,placeholder:'Tìm chiến dịch…',search:function(c,q){return norm(fmtCamp(c.name)).indexOf(q)>-1||norm(c.name).indexOf(q)>-1||norm(c.subject||'').indexOf(q)>-1;}});
  var clearBtn=F.campaign?'<button class="csv" onclick="clearFilter(\'campaign\')" style="font-size:11px;padding:4px 9px">× Bỏ lọc chiến dịch</button>':'';
  var tabs='<div class="ctools" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    +searchBox('camp','Tìm chiến dịch…')
    +'<div class="seg"><button class="'+(_campTab==='all'?'on':'')+'" onclick="setCampTab(\'all\')">Tất cả <span class="pill p-neutral" style="font-size:10px">'+d.campaigns.length+'</span></button>'
    +'<button class="'+(_campTab==='goal'?'on':'')+'" onclick="setCampTab(\'goal\')">Đạt mục tiêu '+REACH_TARGET+'% <span class="pill p-neutral" style="font-size:10px">'+goalN+'</span></button></div>'
    +'</div>';
  return '<section id="s-camp"><div class="eyebrow">Hiệu quả chiến dịch — bấm dòng xem chi tiết '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h">Tất cả chiến dịch '+clearBtn+'</div>'
    +tabs
    +'<div class="tw"><table><thead><tr>'
    +'<th class="pin" data-tip="Tên chiến dịch. Bấm để lọc toàn dashboard theo chiến dịch này.">Chiến dịch</th>'
    +'<th class="num" data-tip="Đã gửi = số người nhận duy nhất có sự kiện gửi">Đã gửi</th>'
    +'<th class="num" data-tip="Tổng lượt mở, đã trừ mở-lại &lt;5s">Đã mở (lượt)</th>'
    +'<th class="num" data-tip="Tỉ lệ mở = Người mở ÷ Người gửi (person-level, đã loại proxy)">Tỉ lệ mở</th>'
    +'<th class="num" data-tip="Số người unique đã click ≥1 link">Đã click</th>'
    +'<th class="num" data-tip="CTOR = Click-to-Open Rate = Người click ÷ Người mở">CTOR</th>'
    +'<th class="num" data-tip="Số người nhấn ✓ Xác nhận đã đọc — tín hiệu mạnh nhất, không bị cache mobile">Xác nhận</th>'
    +'</tr></thead><tbody id="tb-camp"></tbody></table></div>'
    +'<div class="clegend"><span><span class="tdot hot"></span>Đạt mục tiêu '+REACH_TARGET+'%</span><span><span class="tdot warm"></span>Trung bình</span><span><span class="tdot cold"></span>Thấp — cần cải thiện tiêu đề/thời điểm</span></div>'
    +'<div class="pager" id="pg-camp"></div></div>'
    +'<div class="so">→ Tỉ lệ mở tính theo <b>người</b> (person-level), đã loại open giả từ proxy/security gateway. Bấm 1 dòng để lọc / bấm lại để bỏ lọc.</div></section>';
}



/* ── Click panel ── chính (link click + CTOR) ── */
function clickPanel(d){
  var c=d.clickStats,opens=d.sum.uniqOpeners; // CTOR = người click / người mở (person-level)
  if(!c.has)return '<div class="panel"><div class="panel-h" data-tip="Danh sách các link được click và tỷ lệ CTOR từng link. Cần bật ENABLE_CLICK_TRACKING = True trong macro.">Tương tác link</div><div class="nd" style="padding:32px 20px"><div style="font-size:28px;margin-bottom:12px">🔗</div>Chưa có click nào.<br><span style="font-size:11.5px;color:var(--faint)">Bật <b>ENABLE_CLICK_TRACKING = True</b> trong VBA macro để đo link click.</span></div></div>';
  var rows='';
  c.links.forEach(function(L,i){
    var ctor=opens>0?Math.round(L.uniq/opens*100):0;
    var ctorTone=ctor>=20?'good':ctor>=10?'warn':'neutral';
    var display=(L.link&&L.link.length>3)?L.link.replace(/^https?:\/\//,'').split('?')[0]:(L.dest?L.dest.replace(/^https?:\/\//,'').split('?')[0]:'(Link '+(i+1)+')');
    rows+='<tr>'
      +'<td style="max-width:230px"><span class="nm" title="'+esc(L.link||L.dest||'')+'">'+esc(display.slice(0,46)+(display.length>46?'…':''))+'</span></td>'
      +'<td class="num" data-tip="Tổng số lần link này được bấm (gồm 1 người click nhiều lần)"><b>'+L.n+'</b></td>'
      +'<td class="num" data-tip="Số người unique đã click link này (1 người click nhiều lần chỉ tính 1 lần)">'+L.uniq+'</td>'
      +'<td class="num" data-tip="CTOR per link = Người click link này ÷ Tổng người mở email. Đo mức độ hấp dẫn của từng CTA."><span class="pill p-'+ctorTone+'">'+ctor+'%</span></td>'
      +'</tr>';
  });
  return '<div class="panel"><div class="panel-h" data-tip="Danh sách link được click nhiều nhất. CTOR = người click link đó ÷ tổng người mở email.">Tương tác link · <span style="font-size:12.5px;font-weight:500;color:var(--muted)">'+c.clickers+' người click · '+c.total+' lượt · CTOR tổng '+c.ctor+'%</span></div>'
    +'<div class="tw"><table><thead><tr>'
    +'<th data-tip="URL gốc của link trong email">Link</th>'
    +'<th class="num" data-tip="Tổng lượt click (gồm người click nhiều lần)">Lượt click</th>'
    +'<th class="num" data-tip="Số người unique đã click link này">Người click</th>'
    +'<th class="num" data-tip="CTOR per link = Người click ÷ Tổng người mở · đo độ hấp dẫn CTA">CTOR</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

function audRow(f,kind){
  var seg=(f.dept||f.role)?'<span style="color:var(--faint);font-size:11px"> · '+esc(fmtSeg(f.dept||f.role))+'</span>':'';
  return '<tr><td><span class="nm">'+esc(fmtRcpt(f.rcpt))+'</span>'+seg+'</td>'
    +'<td>'+esc(fmtCamp(f.campaign))+'</td>'
    +'<td style="color:var(--faint);font-size:11px">'+fmtTime(f.first)+'</td>'
    +'<td><span class="pill p-'+(kind==='no'?'risk':'warn')+'" data-tip="'+(kind==='no'?'Người này chưa mở email — cần follow-up trực tiếp':'Người này đã mở nhưng chưa click CTA nào')+'">'+
      (kind==='no'?'Chưa mở':'Chưa click')+'</span></td></tr>';
}
function actTable(list,kind,id){
  id=id||'aud';
  if(!list.length)return '<div class="nd">'+(kind==='no'?'Tất cả đã mở ✓':'Tất cả đã click ✓')+'</div>';
  regTable({id:id,rows:list,render:function(f){return audRow(f,kind);},pageSize:20,cols:4,placeholder:'Tìm theo email…',search:audSearch});
  return searchBox(id,'Tìm theo email…')
    +'<div class="tw"><table><thead><tr><th>Người nhận</th><th>Chiến dịch</th><th>Thời gian</th><th>Trạng thái</th></tr></thead><tbody id="tb-'+id+'"></tbody></table></div>'
    +'<div class="pager" id="pg-'+id+'"></div>';
}


function audienceSection(d){
  var t=d.tiers;
  function tc(color,n,name,desc,tip){return '<div class="tier" data-tip="'+esc(tip)+'" onclick="jump(\'#s-aud\')"><div class="tv" style="color:'+color+'">'+n+'</div><div class="tn"><span class="dt" style="background:'+color+'"></span>'+name+'</div><div class="td">'+desc+'</div></div>';}
  var tiers='<div class="tiers">'
    +tc('var(--good)',t.hot.length,'Hot','Reach ≥ 70%','Champion của chương trình thay đổi. Reach ≥ 70% trên tất cả đợt gửi.')
    +tc('var(--warn)',t.warm.length,'Warm','Reach 30–70%','Tương tác trung bình. Cải thiện qua personalization hoặc nhắc nhở trực tiếp.')
    +tc('var(--muted)',t.cold.length,'Cold','Reach < 30%','Ít tương tác. Cần chiến lược khác — họp trực tiếp, nhắc qua quản lý.')
    +tc('var(--risk)',t.never.length,'Never','0 lượt mở','Chưa bao giờ mở email. Ưu tiên cao nhất để follow-up. Kiểm tra địa chỉ email đúng chưa.')
    +'</div>';
  var clickP=clickPanel(d);
  var noPanel=d.sum.hasSent?'<div class="panel"><div class="panel-h" data-tip="Người được gửi nhưng chưa mở. Cần nhắc trực tiếp.">Đã gửi nhưng chưa mở</div>'+actTable(d.notOpened,'no','aud-no')+'</div>':'';
  var grid=noPanel?'<div class="row2">'+clickP+noPanel+'</div>':clickP;
  window.__fu=d.followUp;
  var fuPanel='';
  if(d.followUp.length>0){
    fuPanel='<div class="panel" style="margin-top:16px"><div class="panel-h" data-tip="Người đã mở nhưng chưa click link nào — thêm CTA rõ để tăng hành động.">Đã mở nhưng chưa click <button class="csv" onclick="exportFU()">Xuất CSV</button></div>'+actTable(d.followUp,'cl','aud-fu')+'</div>';
  }
  return '<section id="s-aud"><div class="eyebrow">Đối tượng · ai cần hành động '+qclearBtn()+'</div>'
    +tiers+grid+fuPanel+'</section>';
}


function insightSection(d){
  var ins=insightsOf(d),h='<div class="ins">';
  ins.forEach(function(i){h+='<div class="in '+(i.t==='warn'?'warn':i.t==='good'?'good':'')+'"><div class="mk"></div><div class="x">'+i.x+'</div></div>';});
  return '<section id="s-ins"><div class="eyebrow">Phân tích tự động '+qclearBtn()+'</div>'+h+'</div></section>';
}

function iniRow(I){
  var F=_filter||{};var isActive=F.initiative===I.name;
  return '<tr class="ini-row'+(isActive?' filt-on':'')+'" onclick="setFilter(\'initiative\',\''+(isActive?'':jsq(I.name))+'\')" data-tip="'+esc(fmtCamp(I.name)+' · '+I.camps+' đợt · '+I.sentSessions+' lượt gửi · Reach '+I.reach+'%')+'"><td><span class="nm">'+esc(fmtCamp(I.name))+'</span></td>'
    +'<td class="num" data-tip="Số đợt gửi">'+I.camps+'</td>'
    +'<td class="num" data-tip="Lượt gửi = tổng email gửi (đợt × người, đếm mỗi session)">'+I.sentSessions+'</td>'
    +'<td class="num" data-tip="Người nhận unique = '+I.sent+' người">'+(I.sent>0?I.sent:'—')+'</td>'
    +'<td class="num" data-tip="Người mở unique"><b>'+I.opens+'</b></td>'
    +'<td class="num" data-tip="Tổng lượt mở">'+I.openEvents+'</td>'
    +'<td class="num">'+pill(I.reach,I.sent)+'</td>'
    +'<td class="num" style="font-size:11px;color:var(--faint);font-weight:400">'+fmtTime(I.last)+'</td></tr>';
}
function initiativeSection(d){
  if(!d.hasInitiative)return '';
  var F=_filter||{};
  regTable({id:'ini',rows:d.initiatives,render:iniRow,pageSize:15,cols:8,placeholder:'Tìm Squad/Dự án…',search:function(I,q){return norm(fmtCamp(I.name)).indexOf(q)>-1||norm(I.name).indexOf(q)>-1;}});
  var clearBtn=F.initiative?'<button class="csv" onclick="clearFilter(\'initiative\')" style="font-size:11px;padding:4px 9px">× Bỏ lọc</button>':'';
  return '<section id="s-ini"><div class="eyebrow">Squad/Dự án · awareness tích luỹ '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h">Theo dõi theo sáng kiến '+clearBtn+'</div>'
    +searchBox('ini','Tìm Squad/Dự án…')
    +'<div class="tw"><table><thead><tr>'
    +'<th data-tip="Tên Squad/Dự án chuyển đổi. Bấm để lọc tất cả chiến dịch thuộc Squad này.">Squad / Dự án</th>'
    +'<th class="num" data-tip="Số đợt email đã gửi thuộc Squad này">Đợt</th>'
    +'<th class="num" data-tip="Lượt gửi = tổng số email đã gửi (1 người × 3 đợt = 3 lượt)">Lượt gửi</th>'
    +'<th class="num" data-tip="Người nhận = số người duy nhất nhận ≥1 email (unique rcpt)">Người nhận</th>'
    +'<th class="num" data-tip="Người mở = số người duy nhất đã mở (cộng dồn các đợt). 1 người nhận nhiều đợt được tính nhiều lần.">Người mở</th>'
    +'<th class="num" data-tip="Lượt mở = tổng số lần email được mở, kể cả mở lại nhiều lần">Lượt mở</th>'
    +'<th class="num" data-tip="Reach = Người mở ÷ Người gửi">Reach</th>'
    +'<th data-tip="Thời gian gửi đợt gần nhất">Thời gian gửi</th></tr></thead><tbody id="tb-ini"></tbody></table></div>'
    +'<div class="pager" id="pg-ini"></div></div>'
    +'<div class="so">→ Gom nhiều đợt email của cùng dự án để theo dõi mức độ <b>awareness tích luỹ</b>. Bấm dòng để lọc / bấm lại để bỏ lọc.</div></section>';
}



function manRow(s){
  var seg=(s.dept||s.role)?'<span style="color:var(--faint);font-size:11px"> · '+esc(fmtSeg(s.dept||s.role))+'</span>':'';
  return '<tr><td><span class="nm">'+esc(fmtRcpt(s.rcpt))+'</span>'+seg+'</td><td><span class="pill p-risk" data-tip="Người này chưa mở email bắt buộc — cần escalate hoặc nhắc trực tiếp">Chưa xác nhận đọc</span></td></tr>';
}
function mandatorySection(d){
  if(!d.hasMandatory)return '';
  var blocks='';
  d.mandatory.forEach(function(M,i){
    var rt=M.rate>=95?'p-good':M.rate>=80?'p-warn':'p-risk';
    var id='man-'+i;
    var body;
    if(M.notOpened.length){
      regTable({id:id,rows:M.notOpened,render:manRow,pageSize:20,cols:2,placeholder:'Tìm theo email…',search:audSearch});
      body=searchBox(id,'Tìm theo email…')+'<div class="tw"><table><thead><tr><th>Người chưa xác nhận</th><th>Trạng thái</th></tr></thead><tbody id="tb-'+id+'"></tbody></table></div><div class="pager" id="pg-'+id+'"></div>';
    }else{
      body='<div class="nd" style="color:var(--good)">Tất cả đã xác nhận đọc ✓</div>';
    }
    blocks+='<div class="panel" style="margin-bottom:14px"><div class="panel-h">'+esc(fmtCamp(M.name))+'&nbsp;<span class="pill '+rt+'" data-tip="Tỷ lệ xác nhận đọc = số người mở ÷ số người được gửi. Email bắt buộc cần đạt 100%.">'+M.rate+'% xác nhận</span></div>'+body+'</div>';
  });
  return '<section id="s-man"><div class="eyebrow">Email bắt buộc · theo dõi 100% xác nhận '+qclearBtn()+'</div>'+blocks+'<div class="so">→ Danh sách "chưa xác nhận" cần nhắc trực tiếp / escalate cho compliance.</div></section>';
}


function dataHealthSection(d){
  var q=d.dq,s=d.sum;
  var span=(q.first&&q.last)?fmtTime(q.first)+' → '+fmtTime(q.last):'—';
  function stat(label,val,sub,toneCls,tip){return '<div class="dh" data-tip="'+esc(tip||'')+'"><div class="dh-l">'+label+'</div><div class="dh-v '+(toneCls||'')+'">'+val+'</div>'+(sub?'<div class="dh-s">'+sub+'</div>':'')+'</div>';}
  var pp=q.proxyPct,mp=q.missingDeptPct;
  function hz(tone,tt,sub,badge){return '<div class="hz-row"><span class="hz-dot hz-'+tone+'"></span><div><div class="hz-tt">'+tt+'</div><div class="hz-sub">'+sub+'</div></div><span class="hz-badge '+tone+'">'+badge+'</span></div>';}
  var hzRows=hz('ok','Pixel tracking mở email',(q.uniqCamp||0)+' chiến dịch · '+nf(s.opens||0)+' lượt mở đã ghi','Live')
    +hz('ok','Lọc mở-lại &lt;5s','Đã trừ reload tự động của Outlook để không thổi phồng lượt mở','Đang áp dụng')
    +hz(pp>10?'warn':'ok','Proxy mở ảnh (Apple MPP / Gmail)',pp+'% lượt mở đến từ proxy/gateway — có thể làm tỉ lệ mở cao hơn thực tế',pp>10?'Lưu ý':'Thấp')
    +hz(d.clickStats.has?'ok':'warn','Click-tracking per-link',d.clickStats.has?'Đã bật — '+nf(d.clickStats.total||0)+' lượt click ghi nhận':'Cần bật ENABLE_CLICK_TRACKING=True trong macro',d.clickStats.has?'OK':'Cần check');
  return '<section id="s-health"><div class="eyebrow">Chất lượng dữ liệu · độ tin cậy đo lường '+qclearBtn()+'</div>'
    +'<div class="panel"><div class="panel-h">Sức khoẻ dữ liệu email</div><div class="hz">'+hzRows+'</div></div>'
    +'<div class="panel" style="margin-top:16px">'
    +'<div class="dh-grid">'
    +stat('Xác nhận đọc',s.nConfirmed||0,(s.nConfirmed||0)+' / '+(s.uniqOpeners||0)+' người mở',s.nConfirmed>0?'good':'','Người đã nhấn link ✓ Xác nhận đã đọc ở cuối email. Số liệu này KHÔNG bị ảnh hưởng bởi cache mobile.')
    +stat('Tổng sự kiện',q.events+(q.events>=EVENTS_LIMIT*0.95?' ⚠️':''),span,q.events>=EVENTS_LIMIT*0.95?'risk':'','Tổng số event đã ghi vào Supabase. Giới hạn query: '+EVENTS_LIMIT+'. '+(q.events>=EVENTS_LIMIT*0.95?'⚠️ Gần hoặc đạt giới hạn — dữ liệu cũ có thể bị cắt. Tăng EVENTS_LIMIT trên Vercel env.':'OK.'))
    +stat('Người mở thật',q.humanOpens,'người (không phải proxy)','good','Người mở bằng thiết bị thật (không phải security gateway/proxy). Dùng để tính Reach kiểm chứng.')
    +stat('Open giả (proxy)',q.proxyOpens,pp+'% — gateway auto-fetch',pp>30?'risk':pp>10?'warn':'good','Open tự động bởi security gateway (GoogleImageProxy, Outlook Safelinks...). KHÔNG phải người thật — đã loại khỏi Reach kiểm chứng.')
    +stat('Thiếu phòng ban',s.hasSeg?(q.missingDept+' ('+mp+'%)'):'—',s.hasSeg?'phiên open':'chưa bật segment',mp>30?'risk':mp>10?'warn':'','Số lượt open không có thông tin phòng ban. Kiểm tra định dạng tên người nhận.')
    +stat('Người nhận unique',q.uniqRcpt,'','','Số địa chỉ email/tên người nhận duy nhất trong tất cả sự kiện.')
    +stat('Số chiến dịch',q.uniqCamp,'','','Số chiến dịch email duy nhất trong tập dữ liệu hiện tại.')
    +stat('Độ phủ',s.coverage!=null?s.coverage+'%':'—',(s.uniqOpeners||0)+'/'+s.uniqRcpt+' người mở ≥1 lần','','Tỷ lệ người nhận đã mở ít nhất 1 email. Phản ánh độ phủ tổng thể của chương trình.')
    +'</div></div>'
    +(pp>30?'<div class="so" style="background:var(--risk-bg)">→ <b>Cảnh báo:</b> '+pp+'% open đến từ proxy/gateway. Reach thật thấp hơn đáng kể so với reach thô.</div>':'')
    +'<div class="so">📱 <b>Giới hạn mobile:</b> Email client mobile (iOS Mail, Gmail) cache email sau lần mở đầu. Chuyển sang mail khác rồi quay lại = pixel <b>không reload</b> → không tính thêm lượt mở. Chỉ tắt hẳn app và mở lại mới ghi nhận. Đây là giới hạn của pixel tracking, không phải lỗi hệ thống.</div>'+
    '</section>';
}

function dictionarySection(){
  var items=[
    ['Open Rate','Số người mở ÷ số người được gửi. Bao gồm cả open từ proxy/bot. Xem Reach kiểm chứng để có số tin cậy hơn.'],
    ['Open Rate · Reach kiểm chứng','Số người mở THẬT (loại proxy/bot) ÷ số người được gửi. Chỉ số reach đáng tin nhất. Mục tiêu SHB CM: ≥'+REACH_TARGET+'%.'],
    ['Reach thô','Tổng lượt mở ÷ số gửi — bao gồm cả open giả từ security gateway. Luôn ≥ Reach kiểm chứng.'],
    ['Avg mở/người','Trung bình số lần mỗi người mở email. >1.3x = email đủ hấp dẫn để mở lại nhiều lần.'],
    ['Click Rate','Số người click ÷ số người được gửi. Đo tỷ lệ chuyển đổi từ nhận email sang hành động thực tế.'],
    ['CTOR','Click-to-Open Rate: số người click ÷ số người mở. Đo chất lượng nội dung và hiệu quả của CTA trong email.'],
    ['CTOR per link','Số người click 1 link cụ thể ÷ tổng số người mở email. Đo mức độ hấp dẫn của từng CTA/button.'],
    ['Người click','Số người unique đã click ít nhất 1 link. Khác với "lượt click" (1 người có thể click nhiều lần).'],
    ['Open giả (Proxy)','Lượt tải pixel do security gateway/Google proxy tự động scan email — KHÔNG phải người thật mở. Đã loại khỏi Reach kiểm chứng.'],
    ['Mở chưa click','Người đã mở email nhưng không thực hiện click nào. Cần thêm CTA rõ ràng hơn hoặc nội dung thuyết phục hơn.'],
    ['Tier Hot/Warm/Cold/Never','Phân loại người nhận theo reach tích lũy: Hot ≥70%, Warm 30-70%, Cold <30%, Never = 0 lượt mở.'],
    ['N nhỏ','Khi mẫu < '+MIN_N+' người, % được đánh dấu độ tin cậy thấp. 1/1=100% không có giá trị thống kê.'],
    ['Điểm chiến dịch','= Reach×0.6 + Click Rate×0.2 + CTOR×0.2. Điểm tổng hợp để so sánh hiệu quả các đợt với nhau.'],
    ['Squad/Dự án','Gom nhiều đợt email cùng 1 sáng kiến/dự án để theo dõi awareness tích lũy theo thời gian.'],
    ['Phân khúc tự động','Dept/Role/Khối được parse từ tên người nhận định dạng: Tên (Cấp Bậc - Phòng Ban - Khối). Không cần cấu hình thêm.'],
    ['Cross-filter','Bấm 1 bar/row bất kỳ để lọc toàn dashboard theo đơn vị đó. Bấm lại để bỏ lọc. Filter status bar hiện ở đầu trang.'],
  ];
  var rows='';items.forEach(function(it){rows+='<tr><td style="white-space:nowrap;vertical-align:top;padding-top:14px"><span class="nm">'+it[0]+'</span></td><td style="padding-top:14px;color:var(--text-2)">'+it[1]+'</td></tr>';});
  return '<section id="s-dict"><div class="eyebrow">Từ điển chỉ số · định nghĩa & cảnh báo sai số</div><div class="panel"><div class="tw"><table><tbody>'+rows+'</tbody></table></div></div></section>';
}

/* ── navigation ── */
function filterStatusBar(){
  var F=_filter||{};var active=Object.keys(F).filter(function(k){return F[k];});
  if(!active.length)return '';
  var labels={campaign:'Chiến dịch',dept:'Phòng ban',role:'Cấp bậc',initiative:'Squad/Dự án',msg_type:'Loại',device:'Thiết bị'};
  var chips=active.map(function(k){return '<span class="f-chip">'+labels[k]+': <b>'+esc(String(F[k]).slice(0,26))+'</b> <span class="cx" onclick="clearFilter(\''+k+'\')" title="Bỏ lọc">×</span></span>';}).join('');
  return '<div class="filter-status"><span class="lbl">Đang lọc</span>'+chips+'<button class="f-clear-all" onclick="clearAllFilters()">× Xóa tất cả</button></div>';
}
function filterBar(d){
  var F=_filter||{};var o=d.opts||{};
  function sel(key,allLabel,fmt){var list=o[key]||[];if(!list.length)return '';var cur=F[key]||'';var opt='<option value="">'+allLabel+'</option>'+list.map(function(v){return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(fmt?fmt(v):v)+'</option>';}).join('');return '<select onchange="setFilter(\''+key+'\',this.value)">'+opt+'</select>';}
  function campSel(){var list=o.campaign||[];if(!list.length)return '';var cur=F.campaign||'';var label=cur?fmtCamp(cur):'Tất cả chiến dịch';var opts='<div class="csel-opt'+(cur?'':' on')+'" onclick="pickCamp(\'\')">Tất cả chiến dịch</div>'+list.map(function(v){return '<div class="csel-opt'+(v===cur?' on':'')+'" onclick="pickCamp(\''+jsq(v)+'\')">'+esc(fmtCamp(v))+'</div>';}).join('');return '<div class="csel"><div class="csel-btn" onclick="openCampSel(event)"><span class="csel-val">'+esc(label)+'</span><span class="arr">▾</span></div><div class="csel-dd" id="camp-dd" style="display:none"><input class="csel-inp" type="text" placeholder="🔍 Tìm chiến dịch…" oninput="filterCampSel(this.value)" onclick="event.stopPropagation()" autocomplete="off"><div class="csel-list" id="camp-list">'+opts+'</div></div></div>';}
  return '<div class="fbar"><span class="flbl">Lọc</span>'
    +campSel()+sel('dept','Tất cả phòng ban',fmtSeg)+sel('role','Tất cả cấp bậc',fmtSeg)
    +sel('initiative','Tất cả Squad/Dự án',fmtCamp)+sel('msg_type','Mọi loại',function(v){return v==='mandatory'?'Bắt buộc':'Thông tin';})
    +sel('device','Mọi thiết bị',function(v){return({mobile:'Điện thoại',desktop:'Máy tính',outlook:'Outlook',proxy:'Proxy/Bot',unknown:'Khác'})[v]||v;})
    +(Object.keys(F).some(function(k){return F[k];})?'<button class="fclear" onclick="clearAllFilters()">Xóa lọc</button>':'')
    +'</div>';
}
function navLinks(d){
  var L='<a href="#s-ov" class="on">Tổng quan</a><a href="#s-seg">Phân khúc</a>';
  if(d.hasInitiative)L+='<a href="#s-ini">Squad/Dự án</a>';
  if(d.hasMandatory)L+='<a href="#s-man">Bắt buộc</a>';
  L+='<a href="#s-camp">Chiến dịch</a><a href="#s-openhm">Giờ mở</a><a href="#s-rec">Người nhận</a><a href="#s-aud">Đối tượng</a><a href="#s-ins">Phân tích</a><a href="#s-health">Chất lượng DL</a><a href="#s-dict">Từ điển</a>';
  return L;
}
function masthead(mode){
  var mBtn=mode==='ex'?'<button class="mode-btn alt" onclick="setMode(\'op\')" data-tip="Chuyển sang Bảng điều hành đầy đủ dành cho CM team">Bảng điều hành</button>':'<button class="mode-btn" onclick="setMode(\'ex\')" data-tip="Tóm tắt cấp cao dành cho Ban lãnh đạo — chỉ các chỉ số quan trọng nhất">Tóm tắt lãnh đạo</button>';
  var custom=!!(_from&&_to);
  var presets=[[0,'Tất cả'],[7,'7N'],[30,'30N'],[90,'90N']].map(function(p){return '<button class="'+((!custom&&_days===p[0])?'on':'')+'" onclick="flt('+p[0]+')">'+p[1]+'</button>';}).join('');
  var lbl=custom?(fmtDay(_from)+'–'+fmtDay(_to)):'Tuỳ chọn';
  return '<div class="mast"><div class="mast-in"><div class="brand"><div class="logo">SH</div><div><div class="tt">Email Tracker</div><div class="ss">Truyền thông nội bộ · CM Team</div></div></div>'
    +'<div class="ctrls"><div class="seg">'+presets+'</div>'
    +'<div class="csel"><button class="dtbtn'+(custom?' on':'')+'" onclick="toggleDtPop(event)" data-tip="Chọn khoảng ngày tuỳ chọn"><span>📅 '+esc(lbl)+'</span><span class="arr">▾</span></button>'
    +'<div class="csel-dd dtpop" id="dt-pop" style="display:none" onclick="event.stopPropagation()"><div class="dtpop-h">Khoảng ngày tuỳ chọn</div><label class="dtpop-l">Từ ngày<input type="date" id="dt-from" value="'+isoDate(_from)+'"></label><label class="dtpop-l">Đến ngày<input type="date" id="dt-to" value="'+isoDate(_to)+'"></label><button class="dtpop-apply" onclick="onRange()">Áp dụng</button>'+(custom?'<button class="dtpop-clear" onclick="flt(0)">Xoá lọc ngày</button>':'')+'</div></div>'
    +'<button class="icon-btn" onclick="openCmd()" data-tip="Lệnh nhanh (Ctrl/⌘+K) — tìm kiếm tính năng">⌘K</button>'
    +'<button class="icon-btn" onclick="toggleTheme()" data-tip="Đổi giao diện sáng/tối" id="thBtn">'+(_theme==='dark'?'☼':'☾')+'</button>'
    +mBtn+'</div></div></div>';
}

/* ── views ── */
function operational(d,cur,prev,ser){
  var sub='<div class="subnav"><div class="subnav-in">'+navLinks(d)+'</div></div>';
  return masthead('op')+sub+filterStatusBar()+
    '<div class="wrap">'+filterBar(d)+
    '<section id="s-ov" style="padding-top:14px"><div class="eyebrow">Tổng quan</div>'+
    heroRow(d,cur,prev,ser)+heroChart(d,ser)+
    '<div class="row2">'+funnelPanel(d)+timingPanel(d)+'</div>'+
    '<div class="row2" style="margin-top:16px">'+engagementPanel(d)+devicePanel(d)+'</div>'+
    (d.clickStats.has?'<div style="margin-top:16px">'+clickPanel(d)+'</div>':'')+
    '</section>'+
    segmentSection(d)+initiativeSection(d)+mandatorySection(d)+campaignSection(d)+
    openHeatSection(d)+recipientSection(d)+
    audienceSection(d)+insightSection(d)+dataHealthSection(d)+dictionarySection()+
    '<div class="foot">Cập nhật lúc '+new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+' · '+d.sum.events+' sự kiện · tự làm mới 5 phút</div></div>';
}

function executive(d,cur,prev){
  var s=d.sum,now=new Date().toLocaleDateString('vi-VN',{month:'long',year:'numeric'});
  var vR=s.verifiedReach!=null?s.verifiedReach:s.reach;
  // KPI boxes: Reach | Lượt gửi | Avg mở/người
  var headline='<div class="exec-h">'
    +'<div style="font-size:11.5px;opacity:.85;letter-spacing:.06em;text-transform:uppercase;margin-bottom:22px">Báo cáo hiệu quả truyền thông · CM Team · '+now+'</div>'
    +'<div class="exec-k">'
    +'<div class="exec-kp"><div class="v">'+(s.hasSent&&vR!=null?vR+'%':s.opens)+'</div><div class="d">'+deltaChip(s.hasSent?cur.reach:cur.opens,s.hasSent?prev.reach:prev.opens,true)+'</div><div class="l">'+(s.hasSent?'Open Rate · Reach':'Tổng lượt mở')+'</div></div>'
    +'<div class="exec-kp"><div class="v">'+(s.hasSent?s.sentSessions:'—')+'</div><div class="l">Lượt gửi</div></div>'
    +'<div class="exec-kp"><div class="v">'+(s.avgOpensPerReader!=null?s.avgOpensPerReader+'x':'—')+'</div><div class="l">Avg mở/người</div></div>'
    +'</div></div>';
  // Campaign table: đồng bộ tên trường với bảng điều hành
  var crows='';d.campaigns.forEach(function(c){
    crows+='<tr>'
      +'<td><span class="nm">'+esc(fmtCamp(c.name))+'</span>'+(c.msg_type==='mandatory'?' <span class="pill p-warn" style="font-size:9px;padding:1px 6px">BẮT BUỘC</span>':'')+'</td>'
      +'<td class="num">'+(c.sentSessions||c.sent||'—')+'</td>'
      +'<td class="num"><b>'+c.opens+'</b></td>'
      +'<td class="num">'+pill(c.verifiedReach!=null?c.verifiedReach:c.reach,c.sent)+'</td>'
      +'<td class="num">'+(c.avgOpenCount!=null?c.avgOpenCount+'x':'—')+'</td>'
      +'<td class="num">'+(c.clickRate!=null?c.clickRate+'%':'—')+'</td>'
      +'<td class="num" style="font-size:11px;color:var(--faint);font-weight:400">'+fmtTime(c.last)+'</td>'
    +'</tr>';
  });
  var campP='<div class="panel"><div class="panel-h">Hiệu quả theo chiến dịch</div>'
    +(d.campaigns.length
      ?'<div class="tw"><table><thead><tr>'
        +'<th>Chiến dịch</th>'
        +'<th class="num" data-tip="Lượt gửi = số email đã gửi">Lượt gửi</th>'
        +'<th class="num" data-tip="Người mở = unique openers">Người mở</th>'
        +'<th class="num" data-tip="Reach = Người mở ÷ Người nhận">Reach</th>'
        +'<th class="num" data-tip="Avg mở/người = Lượt mở ÷ Người mở">Avg mở</th>'
        +'<th class="num" data-tip="Click Rate = Người click ÷ Lượt gửi">Click Rate</th>'
        +'<th data-tip="Thời gian gửi gần nhất">Thời gian gửi</th>'
        +'</tr></thead><tbody>'+crows+'</tbody></table></div>'
      :'<div class="nd">Chưa có dữ liệu</div>')
    +'</div>';
  var ins=insightsOf(d),ih='<div class="ins">';
  ins.slice(0,4).forEach(function(i){ih+='<div class="in '+(i.t==='warn'?'warn':i.t==='good'?'good':'')+'"><div class="mk"></div><div class="x">'+i.x+'</div></div>';});
  ih+='</div>';
  return masthead('ex')+'<div class="wrap"><section style="padding-top:22px">'+headline+campP
    +'<div style="margin-top:14px"><div class="eyebrow">Điểm chính</div>'+ih+'</div>'
    +'<div class="foot">Cập nhật '+new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+'</div></section></div>';
}

/* ── app ── */
var _days=0,_from=null,_to=null,_mode='op',_theme='dark',_filter={},_density='comfortable',_inited=false,_tipInited=false,_cmds=[],_cmdSel=0,_cmdFiltered=[];
function isoDate(ms){if(!ms)return '';var d=new Date(ms);return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function onRange(){var f=(document.getElementById('dt-from')||{}).value,t=(document.getElementById('dt-to')||{}).value;if(!f||!t)return;_from=new Date(f+'T00:00:00').getTime();_to=new Date(t+'T23:59:59').getTime();if(_from>_to){var x=_from;_from=_to;_to=x;}_days=0;paint();}
function toggleDtPop(e){e.stopPropagation();var p=document.getElementById('dt-pop');if(p)p.style.display=p.style.display==='block'?'none':'block';}
try{var _st=localStorage.getItem('shb-et-theme');if(_st)_theme=_st;}catch(e){}
try{var _sd=localStorage.getItem('shb-et-density');if(_sd)_density=_sd;}catch(e){}

function applyTheme(){document.documentElement.setAttribute('data-theme',_theme);}
function applyDensity(){document.documentElement.setAttribute('data-density',_density);}
function setFilter(k,v){if(v===''||v==null)delete _filter[k];else _filter[k]=v;paint();}
var _cselOpen=false;
function openCampSel(e){e.stopPropagation();var dd=document.getElementById('camp-dd');if(!dd)return;var open=dd.style.display==='block';dd.style.display=open?'none':'block';if(!open){var inp=dd.querySelector('.csel-inp');if(inp){inp.value='';inp.focus();filterCampSel('');}}_cselOpen=!open;}
function filterCampSel(q){var list=document.getElementById('camp-list');if(!list)return;var qq=norm(q);list.querySelectorAll('.csel-opt').forEach(function(el){var t=norm(el.textContent);el.style.display=(qq===''||t.indexOf(qq)>-1)?'':'none';});}
function pickCamp(v){setFilter('campaign',v);var dd=document.getElementById('camp-dd');if(dd)dd.style.display='none';}
document.addEventListener('click',function(){var dd=document.getElementById('camp-dd');if(dd)dd.style.display='none';var dp=document.getElementById('dt-pop');if(dp)dp.style.display='none';});
function clearFilter(k){delete _filter[k];paint();}
function clearAllFilters(){_filter={};paint();}
function jump(sel){var el=document.querySelector(sel);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}

function render(){
  _TBL={};_tblState={};
  var cl=windowLogs(_days,0),pl=windowLogs(_days,1);
  // Áp dụng filter cho hero chart để section 1 đồng bộ với các section khác
  var _F=(_filter&&typeof _filter==='object')?_filter:{};
  var _cl=cl;
  if(Object.keys(_F).some(function(k){return _F[k];})){
    var _sk={};
    cl.forEach(function(l){
      var k=l.id+'||'+l.rcpt;
      if(!_sk[k])_sk[k]={campaign:l.campaign||'',initiative:l.initiative||'',msg_type:l.msg_type||'',dept:l.dept||'',role:l.role||'',uas:[]};
      if(l.pos==='top'&&l.ua)_sk[k].uas.push(l.ua);
      if(l.dept)_sk[k].dept=l.dept;if(l.role)_sk[k].role=l.role;
    });

    _cl=cl.filter(function(l){
      var k=l.id+'||'+l.rcpt,s=_sk[k]||{};
      if(_F.campaign&&(s.campaign||'unknown')!==_F.campaign)return false;
      if(_F.initiative&&(s.initiative||'')!==_F.initiative)return false;
      if(_F.msg_type&&(s.msg_type||'')!==_F.msg_type)return false;
      if(_F.dept&&(s.dept||'(Chưa phân loại)')!==_F.dept)return false;
      if(_F.role&&(s.role||'(Chưa phân loại)')!==_F.role)return false;
      if(_F.device&&!((_sk[k]&&_sk[k].uas)||[]).some(function(ua){return deviceOf(ua)===_F.device;}))return false;
      return true;
    });
  }
  var ser=dailySeries(_cl,_days);
  var d=process(cl),cur=quickMetrics(cl),prev=quickMetrics(pl);
  if(!d){
    var isEmpty=!LOGS||!LOGS.length;
    var emptyMsg=isEmpty?'Chưa có sự kiện nào trong Supabase. Kiểm tra biến môi trường SUPABASE_URL + SUPABASE_SERVICE_KEY trên Vercel, hoặc gửi email HTML đầu tiên từ Outlook.':'Gửi email HTML từ Outlook để bắt đầu đo lường.';
    return masthead(_mode)+'<div class="wrap"><div style="text-align:center;padding:80px 20px"><div style="font-size:42px;color:var(--faint)">'+( isEmpty?'⚠️':'—')+'</div><h2 style="color:var(--text-2);font-weight:600;margin:14px 0 8px;font-size:18px">Chưa có dữ liệu</h2><p style="color:var(--muted)">'+emptyMsg+'</p></div></div>';
  }
  if(d.empty){
    return masthead(_mode)+'<div class="wrap">'+filterStatusBar()+filterBar(d)+'<div class="notice" style="margin-top:14px"><b>Không có dữ liệu khớp bộ lọc.</b> Hãy bỏ bớt điều kiện lọc hoặc <button class="fclear" onclick="clearAllFilters()" style="margin-left:4px">Xóa tất cả lọc</button></div></div>';
  }
  return _mode==='ex'?executive(d,cur,prev):operational(d,cur,prev,ser);
}

function paint(){
  try{
    applyTheme();applyDensity();
    document.getElementById('app').innerHTML=render();
    mountAllTables();wireNav();wireChart();countUp();init();initTooltip();
  }catch(err){
    var app=document.getElementById('app');
    if(app)app.innerHTML='<div style="padding:40px 32px;font-family:monospace;max-width:860px;margin:0 auto">'
      +'<div style="color:#ff7d96;font-size:18px;font-weight:700;margin-bottom:16px">⚠ Dashboard Error</div>'
      +'<pre style="font-size:12px;background:rgba(255,255,255,.06);padding:18px;border-radius:12px;overflow-x:auto;white-space:pre-wrap;color:#bdb8db;border:1px solid rgba(255,255,255,.1)">'
      +String(err.stack||err.message||err)+'</pre>'
      +'<div style="margin-top:20px;display:flex;gap:10px">'
      +'<button onclick="_filter={};paint()" style="padding:9px 18px;background:#8b7bff;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700">Xóa lọc & Thử lại</button>'
      +'<button onclick="location.reload()" style="padding:9px 18px;background:rgba(255,255,255,.08);color:#bdb8db;border:1px solid rgba(255,255,255,.12);border-radius:10px;cursor:pointer">Reload trang</button>'
      +'</div></div>';
    console.error('[SHB Dashboard]',err);
  }
}
function flt(days){_from=null;_to=null;_days=days;paint();}
function setMode(m){_mode=m;paint();window.scrollTo(0,0);}
function toggleTheme(){_theme=_theme==='dark'?'light':'dark';try{localStorage.setItem('shb-et-theme',_theme);}catch(e){}paint();}
function toggleDensity(){_density=_density==='compact'?'comfortable':'compact';try{localStorage.setItem('shb-et-density',_density);}catch(e){}applyDensity();}
function segView(attr,el){document.querySelectorAll('.seg-tg button').forEach(function(b){b.classList.remove('on');});el.classList.add('on');document.getElementById('segbox').innerHTML=segBars(window.__seg[attr],attr);}
function exportFU(){var rows=window.__fu||[];if(!rows.length)return;var csv='Nguoi Nhan,Email,Phong Ban,Cap Bac,Chien Dich,Thoi Gian Mo\n';rows.forEach(function(r){csv+='"'+fmtRcpt(r.rcpt)+'","'+esc(r.rcpt)+'","'+(r.dept||'')+'","'+(r.role||'')+'","'+fmtCamp(r.campaign)+'","'+fmtTime(r.first)+'"\n';});var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mo-chua-click-'+new Date().toISOString().slice(0,10)+'.csv';a.click();}

/* ── UI functions ── */
function initTooltip(){
  if(_tipInited)return;_tipInited=true;
  var box=document.createElement('div');box.id='tip';document.body.appendChild(box);
  document.addEventListener('mouseover',function(e){
    var el=e.target.closest('[data-tip]');
    if(!el){box.style.display='none';return;}
    box.innerHTML=el.getAttribute('data-tip');box.style.display='block';
  });
  document.addEventListener('mousemove',function(e){
    if(box.style.display==='none')return;
    var x=e.clientX+16,y=e.clientY+16,w=box.offsetWidth,h=box.offsetHeight;
    if(x+w>window.innerWidth-8)x=e.clientX-w-16;
    if(y+h>window.innerHeight-8)y=e.clientY-h-16;
    box.style.left=x+'px';box.style.top=y+'px';
  });
  document.addEventListener('mouseout',function(e){
    if(!e.relatedTarget||!e.relatedTarget.closest('[data-tip]'))box.style.display='none';
  });
}

function countUp(){
  try{if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    document.querySelectorAll('.kv,.tier .tv,.exec-kp .v,.dh-v').forEach(function(el){
      var txt=el.textContent.trim();var m=txt.match(/^(\d[\d.,]*)(.*)$/);if(!m)return;
      var target=parseFloat(m[1].replace(/,/g,''));var suf=m[2]||'';if(isNaN(target)||target<=0)return;
      var start=performance.now(),dur=700;
      function tick(now){var p=Math.min(1,(now-start)/dur);var e=1-Math.pow(1-p,3);el.textContent=Math.round(target*e)+suf;if(p<1)requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    });
  }catch(e){}
}

function wireChart(){
  try{
    var box=document.querySelector('.hero-chart');if(!box)return;
    var svg=box.querySelector('svg.chart-svg');if(!svg)return;
    box.style.position='relative';
    var tip=document.createElement('div');tip.className='ctip';tip.style.display='none';box.appendChild(tip);
    var dots=svg.querySelectorAll('circle.dot');if(!dots.length)return;
    svg.addEventListener('mousemove',function(e){
      var rect=svg.getBoundingClientRect(),x=e.clientX-rect.left,best=null,bd=1e9;
      dots.forEach(function(d){var dr=d.getBoundingClientRect();var cx=dr.left+dr.width/2-rect.left;var dd=Math.abs(cx-x);if(dd<bd){bd=dd;best=d;}});
      if(!best||bd>60)return;
      var t=best.querySelector('title');if(!t)return;
      var br=best.getBoundingClientRect();tip.textContent=t.textContent;tip.style.display='block';tip.style.left=(br.left+br.width/2-box.getBoundingClientRect().left)+'px';tip.style.top=(br.top-box.getBoundingClientRect().top-40)+'px';
      dots.forEach(function(d){d.setAttribute('r',d===best?'5':'3');});
    });
    svg.addEventListener('mouseleave',function(){tip.style.display='none';dots.forEach(function(d){d.setAttribute('r','3');});});
  }catch(e){}
}

function wireNav(){
  if(_mode!=='op')return;
  var links=document.querySelectorAll('.subnav a');
  var secs=[];links.forEach(function(a){var t=document.querySelector(a.getAttribute('href'));if(t)secs.push({a:a,t:t});});
  if(!('IntersectionObserver' in window))return;
  var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.remove('on');});var m=secs.find(function(x){return x.t===e.target;});if(m)m.a.classList.add('on');}});},{rootMargin:'-130px 0px -65% 0px'});
  secs.forEach(function(x){obs.observe(x.t);});
}

/* ── command palette ── */
function buildCmds(){return [
  {t:'→ Tổng quan',a:function(){jump('#s-ov');}},
  {t:'→ Phân khúc',a:function(){jump('#s-seg');}},
  {t:'→ Chiến dịch',a:function(){jump('#s-camp');}},
  {t:'→ Đối tượng',a:function(){jump('#s-aud');}},
  {t:'→ Squad/Dự án',a:function(){jump('#s-ini');}},
  {t:'→ Chất lượng dữ liệu',a:function(){jump('#s-health');}},
  {t:'→ Từ điển chỉ số',a:function(){jump('#s-dict');}},
  {t:'Khoảng thời gian · Tất cả',a:function(){flt(0);}},
  {t:'Khoảng thời gian · 30 ngày',a:function(){flt(30);}},
  {t:'Khoảng thời gian · 7 ngày',a:function(){flt(7);}},
  {t:'Xóa tất cả bộ lọc',a:function(){clearAllFilters();}},
  {t:'Giao diện · Sáng / Tối',a:function(){toggleTheme();}},
  {t:'Mật độ · Thoáng / Gọn',a:function(){toggleDensity();}},
  {t:'Chế độ · Tóm tắt lãnh đạo',a:function(){setMode('ex');}},
  {t:'Chế độ · Bảng điều hành',a:function(){setMode('op');}}
];}
function ensureCmdk(){if(document.getElementById('cmdk-ov'))return;var ov=document.createElement('div');ov.id='cmdk-ov';ov.className='cmdk-ov';ov.innerHTML='<div class="cmdk" onclick="event.stopPropagation()"><input class="cmdk-in" id="cmdk-in" placeholder="Gõ lệnh…" oninput="cmdFilter(this.value)" onkeydown="cmdKey(event)"><div class="cmdk-list" id="cmdk-list"></div><div class="cmdk-hint"><span>↑↓ chọn</span><span>⏎ thực hiện</span><span>esc đóng</span></div></div>';ov.addEventListener('click',closeCmd);document.body.appendChild(ov);}
function openCmd(){ensureCmdk();_cmds=buildCmds();_cmdSel=0;cmdFilter('');document.getElementById('cmdk-ov').classList.add('show');var i=document.getElementById('cmdk-in');i.value='';setTimeout(function(){i.focus();},20);}
function closeCmd(){var o=document.getElementById('cmdk-ov');if(o)o.classList.remove('show');}
function cmdFilter(q){q=(q||'').toLowerCase();_cmdFiltered=_cmds.filter(function(c){return c.t.toLowerCase().indexOf(q)>-1;});_cmdSel=0;var box=document.getElementById('cmdk-list');if(!box)return;box.innerHTML=_cmdFiltered.map(function(c,i){return '<div class="cmdk-it'+(i===0?' sel':'')+'" data-i="'+i+'" onclick="cmdRun('+i+')">'+c.t+'</div>';}).join('')||'<div class="cmdk-it">Không có kết quả</div>';}
function cmdSelMove(d){var n=_cmdFiltered.length;if(!n)return;_cmdSel=(_cmdSel+d+n)%n;var its=document.querySelectorAll('#cmdk-list .cmdk-it');its.forEach(function(el,i){el.classList.toggle('sel',i===_cmdSel);});var sel=its[_cmdSel];if(sel)sel.scrollIntoView({block:'nearest'});}
function cmdRun(i){var c=_cmdFiltered[i!=null?i:_cmdSel];closeCmd();if(c&&c.a)setTimeout(c.a,60);}
function cmdKey(e){if(e.key==='ArrowDown'){e.preventDefault();cmdSelMove(1);}else if(e.key==='ArrowUp'){e.preventDefault();cmdSelMove(-1);}else if(e.key==='Enter'){e.preventDefault();cmdRun();}else if(e.key==='Escape')closeCmd();}
function init(){if(_inited)return;_inited=true;document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();var o=document.getElementById('cmdk-ov');if(o&&o.classList.contains('show'))closeCmd();else openCmd();}});}

paint();
setInterval(function(){location.reload();},900000); // 15 phút

  } // end clientCode
  var src=clientCode.toString();
  return src.slice(src.indexOf('{')+1,src.lastIndexOf('}'));
})();
