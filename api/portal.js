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
:root{--bg:#0b0916;--bar:rgba(20,17,38,.92);--stroke:rgba(255,255,255,.10);--text:#f2effc;--muted:#9a95bd;--accent:#8b7bff;--grad:linear-gradient(135deg,#7c5cff 0%,#5b8cff 100%)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;overflow:hidden}
.bar{flex:none;display:flex;align-items:center;gap:18px;padding:11px 22px;background:var(--bar);border-bottom:1px solid var(--stroke);backdrop-filter:blur(20px);z-index:2}
.brand{display:flex;align-items:center;gap:11px}
.logo{width:34px;height:34px;border-radius:10px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px}
.brand .tt{font-size:15px;font-weight:800;letter-spacing:-.01em}
.brand .ss{font-size:11.5px;color:var(--muted);margin-top:1px}
.tabs{display:flex;gap:6px;margin-left:8px}
.tab{display:flex;align-items:center;gap:8px;background:transparent;border:1px solid transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700;padding:8px 18px;border-radius:11px;cursor:pointer;transition:.16s}
.tab:hover{color:var(--text);background:rgba(255,255,255,.05)}
.tab.on{color:#fff;background:var(--grad);box-shadow:0 8px 22px -10px rgba(124,92,255,.8)}
.tab .ic{font-size:15px;line-height:1}
.spacer{flex:1}
.hint{font-size:11.5px;color:var(--muted)}
.stage{flex:1;position:relative;background:var(--bg)}
.stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--bg)}
.stage iframe[hidden]{display:none}
.ld{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;gap:10px}
.sp{width:16px;height:16px;border:2px solid var(--stroke);border-top-color:var(--accent);border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media(max-width:640px){.brand .ss{display:none}.tab{padding:8px 13px}.hint{display:none}}
</style></head>
<body>
<div class="bar">
  <div class="brand"><div class="logo">SHB</div><div><div class="tt">CM Dashboard</div><div class="ss">Change Management · Truyền thông nội bộ</div></div></div>
  <div class="tabs">
    <button class="tab on" id="tab-fb" onclick="show('fb')"><span class="ic">📘</span>Facebook</button>
    <button class="tab" id="tab-email" onclick="show('email')"><span class="ic">✉️</span>Email</button>
  </div>
  <div class="spacer"></div>
  <div class="hint">Bản gộp demo · chuyển tab để xem từng dashboard</div>
</div>
<div class="stage">
  <div class="ld" id="ld"><span class="sp"></span><span>Đang tải…</span></div>
  <iframe id="if-fb" title="Facebook Dashboard"></iframe>
  <iframe id="if-email" title="Email Dashboard" hidden></iframe>
</div>
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
