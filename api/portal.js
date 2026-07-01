'use strict';
/*
 * Portal gộp 2 dashboard CM về 1 URL: tab Email | Facebook.
 * Mỗi tab nhúng same-origin /api/fb-dashboard và /api/email-dashboard (đều là trang HTML đầy đủ).
 * Iframe lazy-load (chỉ set src khi mở lần đầu) + giữ trạng thái khi chuyển tab.
 * Đây là bước "gộp 1 project" để test/demo trên Vercel trước khi migrate nội bộ.
 */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html><html lang="vi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SHB CM Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0b0916;--bar:rgba(20,17,38,.92);--stroke:rgba(255,255,255,.10);--text:#f2effc;--muted:#9a95bd;--accent:#ef4444;--grad:linear-gradient(135deg,#e11d2a 0%,#fb7427 100%)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);overflow:hidden}
/* Logo + tab nổi (overlay) lên cùng dòng với thanh điều khiển của dashboard (vùng trái masthead trống do brand đã ẩn khi nhúng) */
.topbar{position:absolute;top:0;left:0;right:0;z-index:5;height:63px;pointer-events:none}
.topbar-in{max-width:1200px;margin:0 auto;height:100%;display:flex;align-items:center;gap:14px;padding:0 26px}
.topbar-in>*{pointer-events:auto}
.brand{display:flex;align-items:center;gap:9px}
.logo{flex:none;display:block;border-radius:8px;box-shadow:0 6px 16px -7px rgba(238,115,37,.7)}
.wm{font-size:16px;font-weight:800;letter-spacing:.01em;color:#fff;line-height:1}
.pn{font-size:12px;color:var(--muted);font-weight:600;padding-left:10px;margin-left:2px;border-left:1px solid var(--stroke)}
.seg{display:flex;gap:3px;background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:12px;padding:3px;backdrop-filter:blur(8px)}
.tab{display:flex;align-items:center;gap:7px;background:transparent;border:0;color:var(--muted);font:inherit;font-size:13px;font-weight:700;padding:7px 16px;border-radius:9px;cursor:pointer;transition:.16s}
.tab:hover{color:var(--text)}
.tab.on{color:#fff;background:var(--grad);box-shadow:0 6px 16px -8px rgba(225,29,42,.7)}
.tab .ic{font-size:14px;line-height:1}
.stage{position:absolute;inset:0;background:var(--bg)}
.stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--bg)}
.stage iframe[hidden]{display:none}
.ld{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;gap:10px}
.sp{width:16px;height:16px;border:2px solid var(--stroke);border-top-color:var(--accent);border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media(max-width:560px){.pn{display:none}.tab{padding:7px 12px}}
</style></head>
<body>
<div class="stage">
  <div class="ld" id="ld"><span class="sp"></span><span>Đang tải…</span></div>
  <iframe id="if-fb" title="Facebook Dashboard"></iframe>
  <iframe id="if-email" title="Email Dashboard" hidden></iframe>
</div>
<div class="topbar"><div class="topbar-in">
  <div class="brand">
    <img class="logo" src="/assets/shb-logo-white.png" alt="SHB" height="26">
    <span class="pn">CM Dashboard</span>
  </div>
  <div class="seg">
    <button class="tab on" id="tab-fb" onclick="show('fb')"><span class="ic">📘</span>Facebook</button>
    <button class="tab" id="tab-email" onclick="show('email')"><span class="ic">✉️</span>Email</button>
  </div>
</div></div>
<script>
var SRC={fb:'/api/fb-dashboard',email:'/api/email-dashboard'},loaded={},cur='fb';
function setLoad(on){var l=document.getElementById('ld');if(l)l.style.display=on?'flex':'none';}
function ensure(k){var f=document.getElementById('if-'+k);if(!loaded[k]){setLoad(true);f.onload=function(){loaded[k]=1;if(cur===k)setLoad(false);};f.src=SRC[k];}else if(cur===k){setLoad(false);}}
function show(k){
  cur=k;
  ['fb','email'].forEach(function(x){
    document.getElementById('if-'+x).hidden=(x!==k);
    document.getElementById('tab-'+x).classList.toggle('on',x===k);
  });
  setLoad(!loaded[k]);
  ensure(k);
  try{location.hash=k;}catch(e){}
}
// mở theo hash (#email/#fb) nếu có
var h=(location.hash||'').replace('#','');
show(SRC[h]?h:'fb');
</script>
</body></html>`);
};
