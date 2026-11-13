/* Bảng phụ thông minh – Thầy Lê Văn Hùng (bản dùng trong web Kiến Học Toán) */
(function(){
window.__bpHost=(function(){try{return window.parent!==window&&window.parent.__bpHost||null}catch(e){return null}})();

"use strict";
/* ================== LÕI DÙNG CHUNG ================== */
const COL={a:'#e4572e',b:'#2e86de',c:'#16a34a',d:'#9b51e0',e:'#f2a541',ink:'#1b2234',mut:'#5d6678',grid:'#e8ebf3',axis:'#6b7386',pri:'#4f46e5'};
const $=(s,r=document)=>r.querySelector(s);
const TOOLS=[];const T=o=>TOOLS.push(o);
const GROUPS=['Lớp 6–7','Lớp 8–9','Lớp 10','Lớp 11','Lớp 12','Công cụ lớp học'];
const clean=x=>+(+x).toFixed(10);
function fmt(x,d=2){if(x===undefined||x===null||!isFinite(x))return '—';const s=String(+(+x).toFixed(d));return s.replace('-','−').replace('.',',');}
const gcd=(a,b)=>{a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));while(b){[a,b]=[b,a%b]}return a};
const lcm=(a,b)=>a/gcd(a,b)*b;
const isInt=x=>Math.abs(x-Math.round(x))<1e-9;
function F(n,d){ // phân số HTML rút gọn
  if(d===0)return '∄';if(d<0){n=-n;d=-d}
  const g=gcd(n,d)||1;n/=g;d/=g;const s=n<0?'−':'';n=Math.abs(n);
  return d===1?s+n:`${s}<span class="fr"><span>${n}</span><span>${d}</span></span>`;}
function Fraw(n,d){return `<span class="fr"><span>${n}</span><span>${d}</span></span>`}
function numOrFrac(n,d){ if(isInt(n)&&isInt(d))return F(Math.round(n),Math.round(d)); return fmt(n/d,4);}
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e;}

function mkCanvas(parent,w,h){
  const c=document.createElement('canvas');const k=2;c.width=w*k;c.height=h*k;c.className='cv';
  c.style.aspectRatio=w+'/'+h;parent.appendChild(c);
  const ctx=c.getContext('2d');ctx.setTransform(k,0,0,k,0,0);c.W=w;c.H=h;c.ctx=ctx;
  c.pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*w/r.width,(e.clientY-r.top)*h/r.height]};
  c.clear=(bg='#fcfdff')=>{ctx.fillStyle=bg;ctx.fillRect(0,0,w,h)};
  return c;}
function drag(c,{down,move,up,hover}){
  let on=false;
  c.addEventListener('pointerdown',e=>{const p=c.pos(e);if(down&&down(p,e)!==false){on=true;c.setPointerCapture(e.pointerId);e.preventDefault();}});
  c.addEventListener('pointermove',e=>{const p=c.pos(e);if(on){move&&move(p,e)}else hover&&hover(p,e)});
  const end=()=>{if(on){on=false;up&&up()}};
  c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
}
/* Vẽ cơ bản */
function line(ctx,x1,y1,x2,y2,col,w=2,dash){ctx.save();ctx.strokeStyle=col;ctx.lineWidth=w;if(dash)ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
function dot(ctx,x,y,col,r=6,label,lc){ctx.save();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
  if(label){ctx.fillStyle=lc||col;ctx.font='bold 15px Segoe UI,Arial';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillText(label,x+7,y-5);}ctx.restore();}
function txt(ctx,s,x,y,col=COL.ink,size=14,align='center',base='middle',bold){ctx.save();ctx.fillStyle=col;ctx.font=(bold?'bold ':'')+size+'px Segoe UI,Arial';ctx.textAlign=align;ctx.textBaseline=base;ctx.fillText(s,x,y);ctx.restore();}
function arrow(ctx,x1,y1,x2,y2,col,w=3,head=12){ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=w;const a=Math.atan2(y2-y1,x2-x1);const L=Math.hypot(x2-x1,y2-y1);
  if(L<1){ctx.restore();return}const hx=x2-Math.cos(a)*Math.min(head,L)*0.8,hy=y2-Math.sin(a)*Math.min(head,L)*0.8;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(hx,hy);ctx.stroke();ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(a-0.4),y2-head*Math.sin(a-0.4));ctx.lineTo(x2-head*Math.cos(a+0.4),y2-head*Math.sin(a+0.4));ctx.closePath();ctx.fill();ctx.restore();}

/* Hệ trục tọa độ */
class Plot{
  constructor(c,v){this.c=c;this.ctx=c.ctx;this.v=Object.assign({xmin:-10,xmax:10,ymin:-6.5,ymax:6.5},v);this.home=Object.assign({},this.v);}
  X(x){return (x-this.v.xmin)/(this.v.xmax-this.v.xmin)*this.c.W}
  Y(y){return this.c.H-(y-this.v.ymin)/(this.v.ymax-this.v.ymin)*this.c.H}
  ix(px){return this.v.xmin+px/this.c.W*(this.v.xmax-this.v.xmin)}
  iy(py){return this.v.ymin+(this.c.H-py)/this.c.H*(this.v.ymax-this.v.ymin)}
  static step(range,px){const raw=range/(px/60);const p=Math.pow(10,Math.floor(Math.log10(raw)));for(const m of [1,2,5,10])if(m*p>=raw)return m*p;return 10*p;}
  grid(opt={}){
    const {ctx,c,v}=this;c.clear();
    const sx=Plot.step(v.xmax-v.xmin,c.W),sy=Plot.step(v.ymax-v.ymin,c.H);
    ctx.lineWidth=1;
    // ô nhỏ
    ctx.strokeStyle='#f1f3f8';ctx.beginPath();
    for(let x=Math.ceil(v.xmin/(sx/5))*(sx/5);x<=v.xmax;x+=sx/5){const X=this.X(x);ctx.moveTo(X,0);ctx.lineTo(X,c.H)}
    for(let y=Math.ceil(v.ymin/(sy/5))*(sy/5);y<=v.ymax;y+=sy/5){const Y=this.Y(y);ctx.moveTo(0,Y);ctx.lineTo(c.W,Y)}
    ctx.stroke();
    ctx.strokeStyle=COL.grid;ctx.beginPath();
    for(let x=Math.ceil(v.xmin/sx)*sx;x<=v.xmax;x+=sx){const X=this.X(x);ctx.moveTo(X,0);ctx.lineTo(X,c.H)}
    for(let y=Math.ceil(v.ymin/sy)*sy;y<=v.ymax;y+=sy){const Y=this.Y(y);ctx.moveTo(0,Y);ctx.lineTo(c.W,Y)}
    ctx.stroke();
    const ox=Math.min(Math.max(this.X(0),0),c.W),oy=Math.min(Math.max(this.Y(0),0),c.H);
    arrow(ctx,0,oy,c.W,oy,COL.axis,1.5,9);arrow(ctx,ox,c.H,ox,0,COL.axis,1.5,9);
    txt(ctx,'x',c.W-10,oy+14,COL.axis,14,'center','middle',true);txt(ctx,'y',ox-12,10,COL.axis,14,'center','middle',true);
    if(opt.labels!==false){
      ctx.font='12px Segoe UI,Arial';ctx.fillStyle=COL.mut;
      for(let x=Math.ceil(v.xmin/sx)*sx;x<=v.xmax;x+=sx){if(Math.abs(x)<sx/2)continue;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(fmt(clean(x),4),this.X(x),Math.min(oy+4,c.H-16))}
      for(let y=Math.ceil(v.ymin/sy)*sy;y<=v.ymax;y+=sy){if(Math.abs(y)<sy/2)continue;ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(fmt(clean(y),4),Math.max(ox-5,26),this.Y(y))}
      ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('O',ox-4,oy+3);
    }
  }
  fn(f,col,w=2.5,dash){
    const {ctx,c}=this;ctx.save();ctx.strokeStyle=col;ctx.lineWidth=w;if(dash)ctx.setLineDash(dash);ctx.beginPath();
    let pen=false,py=0;const lim=(this.v.ymax-this.v.ymin)*4;
    for(let px=0;px<=c.W;px+=0.5){const x=this.ix(px);let y;try{y=f(x)}catch(e){y=NaN}
      if(!isFinite(y)||Math.abs(y)>1e6){pen=false;continue}
      const Y=this.Y(y);
      if(pen&&Math.abs(y-py)>lim){pen=false}
      if(!pen){ctx.moveTo(px,Y);pen=true}else ctx.lineTo(px,Y);py=y;}
    ctx.stroke();ctx.restore();}
  seg(x1,y1,x2,y2,col,w=2,dash){line(this.ctx,this.X(x1),this.Y(y1),this.X(x2),this.Y(y2),col,w,dash)}
  pt(x,y,col,label,r=6){dot(this.ctx,this.X(x),this.Y(y),col,r,label)}
  inf(a,b,c,col,w=2.5,dash){ // đường thẳng ax+by=c
    const v=this.v;if(Math.abs(b)>1e-12){this.seg(v.xmin-1,(c-a*(v.xmin-1))/b,v.xmax+1,(c-a*(v.xmax+1))/b,col,w,dash)}
    else if(Math.abs(a)>1e-12){const x=c/a;this.seg(x,v.ymin-1,x,v.ymax+1,col,w,dash)}}
  panZoom(redraw){
    const c=this.c;let st=null;
    drag(c,{down:(p)=>{st={p,v:Object.assign({},this.v)}},move:(p)=>{const dx=(p[0]-st.p[0])/c.W*(st.v.xmax-st.v.xmin),dy=(p[1]-st.p[1])/c.H*(st.v.ymax-st.v.ymin);
      this.v.xmin=st.v.xmin-dx;this.v.xmax=st.v.xmax-dx;this.v.ymin=st.v.ymin+dy;this.v.ymax=st.v.ymax+dy;redraw()}});
    c.addEventListener('wheel',e=>{e.preventDefault();const p=c.pos(e);this.zoom(e.deltaY>0?1.15:1/1.15,this.ix(p[0]),this.iy(p[1]));redraw()},{passive:false});
  }
  zoom(k,cx,cy){const v=this.v;if(cx===undefined){cx=(v.xmin+v.xmax)/2;cy=(v.ymin+v.ymax)/2}
    v.xmin=cx+(v.xmin-cx)*k;v.xmax=cx+(v.xmax-cx)*k;v.ymin=cy+(v.ymin-cy)*k;v.ymax=cy+(v.ymax-cy)*k;}
  reset(){Object.assign(this.v,this.home)}
}

/* Dịch biểu thức người dùng nhập -> hàm JS an toàn */
function compile(expr){
  const s=String(expr).toLowerCase().replace(/\s+/g,'').replace(/π/g,'pi').replace(/×/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/√/g,'sqrt').replace(/,/g,'.');
  if(!s)throw new Error('Biểu thức trống');
  const fns=['asin','acos','atan','sqrt','cbrt','floor','sin','cos','tan','cot','abs','exp','ln','log'],cs=['pi','x','e'];
  const tk=[];let i=0;
  while(i<s.length){const ch=s[i];
    if(/[\d.]/.test(ch)){let j=i;while(j<s.length&&/[\d.]/.test(s[j]))j++;tk.push({t:'n',v:s.slice(i,j)});i=j;continue}
    if(/[a-z]/.test(ch)){let m=fns.find(f=>s.startsWith(f,i));if(m){tk.push({t:'f',v:m});i+=m.length;continue}
      m=cs.find(f=>s.startsWith(f,i));if(m){tk.push({t:'n',v:m});i+=m.length;continue}
      throw new Error('Không hiểu "'+s.slice(i,i+6)+'"')}
    if('+-*/^()'.includes(ch)){tk.push({t:ch,v:ch});i++;continue}
    throw new Error('Kí tự không hợp lệ: '+ch)}
  let o='',pv=null;
  for(const k of tk){if(pv&&(pv.t==='n'||pv.t===')')&&(k.t==='n'||k.t==='f'||k.t==='('))o+='*';o+=k.v;pv=k}
  o=o.replace(/\^/g,'**').replace(/(^|[(+\/-]|(?<!\*)\*)-/g,'$1(-1)*');
  const f=new Function('x',`const sin=Math.sin,cos=Math.cos,tan=Math.tan,cot=t=>1/Math.tan(t),asin=Math.asin,acos=Math.acos,atan=Math.atan,sqrt=Math.sqrt,cbrt=Math.cbrt,abs=Math.abs,exp=Math.exp,ln=Math.log,log=Math.log10,pi=Math.PI,e=Math.E,floor=Math.floor;return (${o});`);
  f(1.2345);return f;}

/* Bộ điều khiển */
function slider(p,label,min,max,step,val,on,show){
  const d=el('div','sl');d.innerHTML=`<div class="tp"><span>${label}</span><span></span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${val}">`;
  p.appendChild(d);const inp=d.querySelector('input'),sp=d.querySelector('.tp span:last-child');
  const o={get v(){return +inp.value},set(x){inp.value=x;upd()},el:d,inp};
  function upd(){sp.innerHTML=show?show(+inp.value):fmt(+inp.value,3)}
  inp.addEventListener('input',()=>{upd();on&&on(+inp.value)});upd();return o;}
function btn(p,t,on,cls='b'){const b=el('button',cls,t);b.type='button';b.onclick=on;p.appendChild(b);return b;}
function seg(p,opts,val,on){const d=el('div','seg');const o={v:val,el:d,set(x){o.v=x;d.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==String(x)))}};
  for(const [v,t] of opts){const b=el('button','',t);b.type='button';b.dataset.v=v;b.onclick=()=>{o.set(v);on&&on(v)};d.appendChild(b)}
  p.appendChild(d);o.set(val);return o;}
function num(p,label,val,on,w){const d=el('label','ni',`${label}<input type="number" step="any" value="${val}">`);p.appendChild(d);const i=d.querySelector('input');if(w)i.style.width=w+'px';
  i.addEventListener('input',()=>{const v=parseFloat(i.value);if(isFinite(v))on&&on(v)});return {get v(){const v=parseFloat(i.value);return isFinite(v)?v:0},set(x){i.value=x},inp:i};}
function chk(p,label,val,on){const d=el('label','chk',`<input type="checkbox" ${val?'checked':''}> ${label}`);p.appendChild(d);const i=d.querySelector('input');i.onchange=()=>on&&on(i.checked);return {get v(){return i.checked},set(x){i.checked=x}};}
function row(p){const r=el('div','row');p.appendChild(r);return r;}
function info(p){const d=el('div','info');p.appendChild(d);return d;}
function h3(p,t){p.appendChild(el('h3','',t))}
function note(p,t){p.appendChild(el('p','note',t))}
function layout(body){const g=el('div','tg');const st=el('div','stage'),ct=el('div','ctrl');g.append(st,ct);body.appendChild(g);return {st,ct};}
function animLoop(fn){ // chỉ chạy khi công cụ đang hiển thị
  let last=null;function f(ts){const dt=last==null?0:Math.min(0.1,(ts-last)/1000);last=ts;fn(dt);requestAnimationFrame(f)}requestAnimationFrame(f);}
let beepCtx=null;
function beep(freq=880,dur=0.25,times=1){try{beepCtx=beepCtx||new (window.AudioContext||window.webkitAudioContext)();
  for(let i=0;i<times;i++){const o=beepCtx.createOscillator(),g=beepCtx.createGain();o.frequency.value=freq;o.connect(g);g.connect(beepCtx.destination);
  const t0=beepCtx.currentTime+i*(dur+0.12);g.gain.setValueAtTime(0.25,t0);g.gain.exponentialRampToValueAtTime(0.001,t0+dur);o.start(t0);o.stop(t0+dur);}}catch(e){}}
/* ================== LỚP 6–7 ================== */
/* ============ BẢNG PHỤ THÔNG MINH: GeoGebra + Scribble Ink ============ */
T({id:'bangphu',ic:'✏️',t:'Bảng phụ thông minh (GeoGebra + Ink)',tag:'Mọi lớp',
d:'Vừa viết tay như Scribble Ink (bút, dạ quang, laser, chữ, nhiều trang) vừa dựng hình động như GeoGebra (điểm, đoạn, đường tròn, vuông góc, song song, giao điểm, đo góc – độ dài – diện tích, đồ thị). Bút thông minh tự nắn nét vẽ tay thành hình.',
init(body){
let SY=null;let W=1280,H=720;const KEY=window.__bpHost?'bangphu_lop':'bangphu_v2';
body.appendChild(el('style','',`
.bp,.bp *{-webkit-tap-highlight-color:transparent}
.bp{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.bp button,.bp label{touch-action:manipulation}
.bp input[type=text],.bp input[type=number],.bp-in,.bp-paste{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
.bp-paste{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:20;background:#fff;border:2px dashed #6366f1;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px #0003;width:min(340px,90%);font:14px Segoe UI,Arial;color:#334155;display:none}
.bp-paste .box{margin-top:8px;min-height:70px;border:1.5px solid #c7d2fe;border-radius:10px;padding:8px;outline:none;background:#f8fafc;font-size:15px}
@media (pointer:coarse){.bp-t{width:44px!important;height:44px!important}.bp-t .i{font-size:23px;height:28px}.bp-sw{width:27px;height:27px}
  .bp-sub .b,.bp-st .b,.bp-pop .b{padding:7px 11px;font-size:14px}.bp-menu button{padding:10px}.bp-rp{width:240px}.bp-rp input{height:30px}.bp-tb .chk input{width:20px;height:20px}}
.bp{position:relative;display:flex;flex-direction:column;gap:4px;height:calc(100vh - 10px);min-height:420px}
body.board .wrap{grid-template-columns:1fr}
body.board nav.side{display:none}
body.board nav.side.open{display:block;position:fixed;left:0;top:0;height:100vh;width:290px;z-index:60;box-shadow:6px 0 30px #0004}
body.board main{padding:4px 6px 0}
.bp-who{color:#4338ca;font-weight:700;margin-left:14px}
body.board footer{display:none}
body.board header.top{display:none}
body.board #v-bangphu>.thead{display:none}
.bp-tb{display:flex;flex-wrap:wrap;align-items:center;gap:3px 3px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:3px 6px;box-shadow:0 1px 3px #0001;flex:none}
.bp-g{display:flex;flex-wrap:nowrap;gap:0;align-items:center;padding-right:3px;border-right:1px solid #e5e7eb}
.bp-g:last-child{border-right:0}
.bp-gt{writing-mode:vertical-rl;transform:rotate(180deg);font:700 8.5px Segoe UI,Arial;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;text-align:center;padding:0 1px}
.bp-t .l{display:none}
.bp-t{display:flex;align-items:center;justify-content:center;width:33px;height:34px;padding:0;border:1.5px solid transparent;border-radius:9px;background:none;cursor:pointer;font:600 10px Segoe UI,Arial;color:#374151;line-height:1.1;text-align:center}
.bp-t .i{font-size:19px;height:26px;display:flex;align-items:center;justify-content:center;color:#1e293b}
.bp-t:hover{background:#f3f4f6}
.bp-t.on{background:#eef2ff;border-color:#6366f1;color:#3730a3}
.bp-sub{display:contents;font-size:13px}
.bp-tb .grp{font-size:13px;gap:3px;padding:0 5px;border-left:1px solid #e5e7eb;min-height:30px}
.bp-tb .grp:empty{display:none}
.bp-sub .grp{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.bp-sub .b{padding:2px 7px;font-size:13px;min-width:28px}
.bp-sub .seg button{padding:3px 9px;font-size:12.5px}
.bp-sw{width:19px;height:19px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #94a3b8;cursor:pointer;padding:0}
.bp-sw.on{box-shadow:0 0 0 3px #4f46e5}
.bp-cv{position:relative;flex:1;min-height:0}
.bp-cv canvas.cv{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto!important}
.bp-cv canvas{cursor:crosshair}
.bp-in{position:absolute;z-index:5;font:22px Segoe UI,Arial;border:1.5px dashed #6366f1;background:#fffffff2;padding:0 6px;border-radius:6px;min-width:180px;outline:none}
.bp-st{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#374151;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:2px 8px;flex:none;white-space:nowrap;overflow:hidden;align-items:center}
.bp-st>span:first-child{overflow:hidden;text-overflow:ellipsis;align-self:center}
.bp-st>span:last-child{display:flex;align-items:center;gap:4px;flex:none}
.bp-st .grp{display:flex;align-items:center;gap:3px;padding:0 6px;border-right:1px solid #e5e7eb}
.bp-st .b{padding:1px 7px;font-size:13px;min-width:26px}
.bp-st b{color:#3730a3}
.bp-ctx input[type=text]{width:170px;font:14px Consolas,monospace;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px}
.bp-ctx input[type=number]{width:64px;font:14px Segoe UI;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px}
.bp-alg{position:absolute;left:8px;top:8px;width:270px;max-height:calc(100% - 16px);overflow:auto;background:#fffffff2;border:1px solid #c7d2fe;border-radius:10px;padding:8px 10px;font:13px Segoe UI,Arial;color:#1f2937;box-shadow:0 4px 14px #0002;display:none;user-select:none}
.bp-alg h4{margin:0 0 4px;font-size:13px;color:#4338ca}
.bp-alg div{padding:2px 0;border-bottom:1px dashed #e5e7eb;cursor:pointer}
.bp-alg div.on{background:#fef3c7}
.bp-alg i{color:#9ca3af;font-style:normal}
.bp-menu{position:absolute;z-index:40;background:#fff;border:1px solid #c7d2fe;border-radius:12px;box-shadow:0 14px 34px #0003;padding:6px;display:none;width:300px}
.bp-menu .mh{font:700 12px Segoe UI;color:#6366f1;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px}
.bp-menu button{display:flex;gap:10px;align-items:center;width:100%;border:0;background:none;padding:5px 8px;border-radius:8px;cursor:pointer;text-align:left;font:14px Segoe UI,Arial;color:#1e293b}
.bp-menu button:hover{background:#f1f5f9}.bp-menu button.on{background:#eef2ff;outline:1.5px solid #6366f1}
.bp-menu b{display:block;font-weight:700}.bp-menu small{color:#6b7280;font-size:12px}
.bp-rp{position:absolute;right:8px;top:8px;z-index:6;display:none;background:#ffffffe8;border:1px solid #c7d2fe;border-radius:10px;padding:6px 10px;font:12.5px Segoe UI,Arial;color:#334155;box-shadow:0 4px 12px #0002;width:210px}
.bp-rp label{display:block;margin:2px 0}.bp-rp b{float:right;color:#4338ca}.bp-rp input{width:100%;accent-color:#f97316}
.bp-pop{position:absolute;z-index:6;display:none;gap:4px;background:#fff;border:1px solid #c7d2fe;border-radius:10px;box-shadow:0 6px 18px #0002;padding:4px}
.bp-pop .b{padding:3px 9px;font-size:13px}
.bp-xyz{left:10px;top:56px;flex-direction:column;gap:6px;padding:9px 11px;font:14px Segoe UI,Arial;color:#1e293b;max-width:calc(100% - 20px)}
.bp-xyz .xh{font-weight:700;color:#4f46e5}.bp-xyz .xr{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.bp-xyz .xr b{font-size:17px;color:#475569}
.bp-xyz input[type=text]{width:54px;padding:5px 6px;border:1px solid #cbd5e1;border-radius:7px;font:16px Consolas,monospace;text-align:center}.bp-xyz input.xn{width:46px;font-weight:700;color:#4f46e5}
.bp-xyz .b{padding:6px 11px;font-size:14px}.bp-xyz .xm{color:#dc2626;font-size:13px}.bp-xyz .xm:empty{display:none}.bp-xyz .xt{font-size:12px;color:#64748b}
.bp-pg{font-weight:700;color:#3730a3;min-width:44px;text-align:center}

.bp.compact{overflow:hidden}
.bp.compact .bp-tb{position:absolute;left:4px;right:4px;top:0;z-index:30;transform:translateY(calc(-100% - 10px));opacity:0;transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s;box-shadow:0 10px 28px #0003;pointer-events:none}
.bp.compact.tb-on .bp-tb{transform:none;opacity:1;pointer-events:auto}
.bp.compact .bp-st{position:absolute;left:4px;right:4px;bottom:0;z-index:30;transform:translateY(calc(100% + 8px));opacity:0;transition:transform .28s,opacity .2s;box-shadow:0 -6px 20px #0002;pointer-events:none}
.bp.compact.st-on .bp-st{transform:none;opacity:1;pointer-events:auto}
.bp-hd{position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:29;display:none;align-items:center;gap:2px;background:#ffffffee;border:1px solid #c7d2fe;border-top:0;border-radius:0 0 14px 14px;box-shadow:0 4px 14px #0002;padding:2px 6px 3px;font:600 13px Segoe UI,Arial;color:#3730a3}
.bp.compact .bp-hd{display:flex}.bp.compact.tb-on .bp-hd{display:none}
.bp-hd button{border:0;background:none;cursor:pointer;font:inherit;color:inherit;padding:4px 8px;border-radius:9px;display:flex;align-items:center;gap:5px;min-height:32px}
.bp-hd button:hover{background:#eef2ff}.bp-hd .cur{display:flex;align-items:center;gap:4px}.bp-hd .cur svg{width:20px;height:20px}
.bp-hd .sw{width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 1px #94a3b8}
.bp-msg{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:28;background:#1e1b4bee;color:#fff;font:14px Segoe UI,Arial;padding:7px 14px;border-radius:12px;max-width:80%;box-shadow:0 6px 18px #0003;display:none;pointer-events:none}
.bp-msg b{color:#fde68a}.bp.compact .bp-msg.on{display:block}
@media (pointer:coarse){.bp-hd button{min-height:40px;padding:6px 12px}}
#v-bangphu:fullscreen{overflow:hidden;background:#f3f5fb;padding:5px 8px}
#v-bangphu:-webkit-full-screen{overflow:hidden;background:#f3f5fb;padding:5px 8px;width:100%;height:100%}
`));
const wrap=el('div','bp');body.appendChild(wrap);
const tb=el('div','bp-tb'),s1=el('div','bp-sub'),cvw=el('div','bp-cv'),sb=el('div','bp-st'),s2=el('div','bp-sub');
wrap.append(tb,cvw,sb);
const c=mkCanvas(cvw,W,H),ctx=c.ctx;
c.pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]};
function fit(){const fs=(document.fullscreenElement||document.webkitFullscreenElement)===body,r0=wrap.getBoundingClientRect(),top=fs?r0.top:r0.top+window.scrollY;
  if(!fs){const ov=document.documentElement.scrollHeight-window.innerHeight;if(ov>0){const r1=wrap.getBoundingClientRect();wrap._pad=Math.max(0,Math.min(150,document.documentElement.scrollHeight-(r1.bottom+window.scrollY)))}else if(wrap._pad&&(wrap._rs||0)<3&&performance.now()-(wrap._rt||0)>1500){wrap._rt=performance.now();wrap._rs=(wrap._rs||0)+1;wrap._pad=0}if(window.scrollY>0&&document.body.classList.contains('board'))window.scrollTo(0,0)}const want=Math.max(420,Math.floor(window.innerHeight-top-(fs?6:4)-(fs?0:(wrap._pad||0))));if(Math.abs(wrap.offsetHeight-want)>1)wrap.style.height=want+'px';
  const r=cvw.getBoundingClientRect(),nw=Math.round(r.width),nh=Math.round(r.height);if(nw<50||nh<50||(nw===W&&nh===H))return;
  pages.forEach(p=>{p.view.ox+=(nw-W)/2;p.view.oy+=(nh-H)/2});W=nw;H=nh;c.width=W*2;c.height=H*2;c.W=W;c.H=H;ctx.setTransform(2,0,0,2,0,0);inval();dirty=true}
const alg=el('div','bp-alg');cvw.appendChild(alg);
const sbL=el('span'),sbR=el('span');sb.append(sbL,el('span','',''));sb.lastChild.append(sbR,el('span','bp-who','Thầy Lê Văn Hùng · ☎ 09388 29 686'));

/* ---------- Trạng thái ---------- */
const PAL=['#111827','#e11d48','#2563eb','#16a34a','#f59e0b','#9333ea','#0891b2','#ffffff'];
let showHid=false,selAt=null,col='#111827',wid=3,tool='sel',bg='luoi',showAx=false,showLb=true,snapOn=false,showAlg=false;
const newPage=()=>({key:'p'+Math.random().toString(36).slice(2,9),objs:[],nid:1,view:{ox:W/2,oy:H/2,z:1},undo:[],redo:[]});
let pages=[newPage()],pi=0;const Pg=()=>pages[pi];
let sel=null,hov=null,pend=[],mouse=null,act=null,laser=[],msg='',msgT=0;const flash=new Map(),lbBox=new Map();
const cache=new Map(),inval=()=>cache.clear();let dirty=true;const D=()=>{dirty=true};
const V=()=>Pg().view,sc=()=>50*V().z;
const S=(x,y)=>[V().ox+x*sc(),V().oy-y*sc()];
const Wd=(X,Y)=>[(X-V().ox)/sc(),(V().oy-Y)/sc()];
const byId=id=>Pg().objs.find(o=>o.id===id);
const PTS=new Set(['rat','pt','pon','ft','eqp','mid','int','sym','rot','ax','pq','pd','mir','par4','ctr','3pt','3pon','3mid','3tr','3par4','3sqv','3up','3vert','3apex','3int','3pol','3foot','3footp','3onp','3ons','3int2','3intlp']);const DRG=new Set(['rat','pt','pon','eqp','ax','pq','pd','3pt','3pon','3vert','3apex','3pol','3onp','3ons']);const canDrag=o=>DRG.has(o.t)||(o.t==='rot'&&o.dr);
const refs=o=>{const r=[];for(const k of ['a','b','c','d','p','l','o','on','top'])if(typeof o[k]==='number')r.push(o[k]);if(o.ps)r.push(...o.ps);for(const k of ['ln','pl','l1','l2']){const v=o[k];if(Array.isArray(v))r.push(...v);else if(typeof v==='number')r.push(v)}return r};
const un=(x,y)=>{const l=Math.hypot(x,y);return l<1e-12?null:[x/l,y/l]};
const cl01=u=>Math.max(0,Math.min(1,u));
function gstep(){const s=sc();for(const k of [0.05,0.1,0.2,0.25,0.5,1,2,5,10,20,50,100])if(k*s>=34)return k;return 200}
function say(s){msg=s;msgT=performance.now();D();try{showMsg(s)}catch(e){}}

/* ---------- Hình học động ---------- */
const Pt=(x,y)=>({k:'P',x,y});
function need(id){const g=geo(id);if(!g||g.k!=='P')throw 0;return g}
function geo(id){if(cache.has(id))return cache.get(id);cache.set(id,undefined);const o=byId(id);let g;
  try{g=o?calc(o):undefined}catch(e){g=undefined}
  if(g&&g.k==='P'&&!(isFinite(g.x)&&isFinite(g.y)))g=undefined;cache.set(id,g);return g}
const fnc={};function fnOf(ex){if(!(ex in fnc)){try{fnc[ex]=compile(ex)}catch(e){fnc[ex]=null}}return fnc[ex]}
function calc(o){const t=o.t;
  if(t[0]==='3')return calc3(o);
  if(t==='pt')return Pt(o.x,o.y);
  if(t==='pon'){const h=geo(o.on);if(!h)return;
    if(h.k==='L'){const [x1,y1,x2,y2]=h.l;let u=o.u;if(h.kind==='seg')u=cl01(u);else if(h.kind==='ray')u=Math.max(0,u);return Pt(x1+u*(x2-x1),y1+u*(y2-y1))}
    if(h.k==='C')return Pt(h.cx+h.r*Math.cos(o.u),h.cy+h.r*Math.sin(o.u));return}
  if(t==='rot'){const C=need(o.c),P=need(o.p),a=o.ang*Math.PI/180,dx=P.x-C.x,dy=P.y-C.y;return Pt(C.x+dx*Math.cos(a)-dy*Math.sin(a),C.y+dx*Math.sin(a)+dy*Math.cos(a))}
  if(t==='ax'){const B=need(o.a),C=need(o.b);return Pt((B.x+C.x)/2-o.u*(C.y-B.y),(B.y+C.y)/2+o.u*(C.x-B.x))}
  if(t==='pq'){const A=need(o.a),B=need(o.b);return Pt(A.x-o.u*(B.y-A.y),A.y+o.u*(B.x-A.x))}
  if(t==='pd'){const A=need(o.a),B=need(o.b),C=need(o.c);return Pt(C.x+o.u*(B.x-A.x),C.y+o.u*(B.y-A.y))}
  if(t==='par4'){const A=need(o.a),B=need(o.b),C=need(o.c);return Pt(A.x+B.x-C.x,A.y+B.y-C.y)}
  if(t==='mir'){const P=need(o.p),A=need(o.a),B=need(o.b),d=un(B.x-A.x,B.y-A.y);if(!d)return;const mx=(A.x+B.x)/2,my=(A.y+B.y)/2,k=2*((P.x-mx)*d[0]+(P.y-my)*d[1]);return Pt(P.x-k*d[0],P.y-k*d[1])}
  if(t==='ctr'){const A=need(o.a),B=need(o.b),C=need(o.c),d=2*(A.x*(B.y-C.y)+B.x*(C.y-A.y)+C.x*(A.y-B.y));if(Math.abs(d)<1e-9)return;
    if(o.kd==='G')return Pt((A.x+B.x+C.x)/3,(A.y+B.y+C.y)/3);
    if(o.kd==='I'){const a=Math.hypot(B.x-C.x,B.y-C.y),b=Math.hypot(C.x-A.x,C.y-A.y),c=Math.hypot(A.x-B.x,A.y-B.y),sm=a+b+c;return Pt((a*A.x+b*B.x+c*C.x)/sm,(a*A.y+b*B.y+c*C.y)/sm)}
    const a2=A.x*A.x+A.y*A.y,b2=B.x*B.x+B.y*B.y,c2=C.x*C.x+C.y*C.y,ux=(a2*(B.y-C.y)+b2*(C.y-A.y)+c2*(A.y-B.y))/d,uy=(a2*(C.x-B.x)+b2*(A.x-C.x)+c2*(B.x-A.x))/d;
    return o.kd==='O'?Pt(ux,uy):Pt(A.x+B.x+C.x-2*ux,A.y+B.y+C.y-2*uy)}
  if(t==='tuyen'){const A=need(o.a),B=need(o.b),C=need(o.c),mx=(B.x+C.x)/2,my=(B.y+C.y)/2;if(Math.hypot(A.x-mx,A.y-my)<1e-9)return;return {k:'L',kind:'seg',l:[A.x,A.y,mx,my]}}
  if(t==='cao'){const A=need(o.a),B=need(o.b),C=need(o.c),dx=C.x-B.x,dy=C.y-B.y,L2=dx*dx+dy*dy;if(L2<1e-12)return;const u=((A.x-B.x)*dx+(A.y-B.y)*dy)/L2,fx=B.x+u*dx,fy=B.y+u*dy;
    if(Math.hypot(A.x-fx,A.y-fy)<1e-9)return;return {k:'L',kind:'seg',l:[A.x,A.y,fx,fy],u}}
  if(t==='rat'){const A=need(o.a),B=need(o.b),s=(o.m||1)+(o.nn||1),k=(o.m||1)/s;return Pt(A.x+k*(B.x-A.x),A.y+k*(B.y-A.y))}
  if(t==='mid'){const a=need(o.a),b=need(o.b);return Pt((a.x+b.x)/2,(a.y+b.y)/2)}
  if(t==='eqp'){const A=need(o.a),P=need(o.c),Q=need(o.d),L=Math.hypot(Q.x-P.x,Q.y-P.y);if(L<1e-9)return;let ux,uy;
    if(o.ln!=null){const h=geo(o.ln);if(!h||h.k!=='L')return;const d=un(h.l[2]-h.l[0],h.l[3]-h.l[1]);if(!d)return;ux=d[0]*o.sg;uy=d[1]*o.sg}else{ux=Math.cos(o.u);uy=Math.sin(o.u)}return Pt(A.x+ux*L,A.y+uy*L)}
  if(t==='ft'){const h=geo(o.o);if(!h||h.k!=='L')return;return Pt(h.l[2],h.l[3])}
  if(t==='amk'){need(o.a);need(o.b);need(o.c);return {k:'M'}}
  if(t==='smk'){need(o.a);need(o.b);return {k:'M'}}
  if(t==='reg')return {k:'G',p:o.ps.map(i=>{const q=need(i);return [q.x,q.y]})};
  if(t==='int')return inter(geo(o.a),geo(o.b))[o.k];
  if(t==='sym'){const p=need(o.p),h=geo(o.o);if(!h)return;if(h.k==='P')return Pt(2*h.x-p.x,2*h.y-p.y);
    if(h.k==='L'){const [x1,y1,x2,y2]=h.l,dx=x2-x1,dy=y2-y1,u=((p.x-x1)*dx+(p.y-y1)*dy)/(dx*dx+dy*dy);return Pt(2*(x1+u*dx)-p.x,2*(y1+u*dy)-p.y)}return}
  if(t==='seg'||t==='line'||t==='ray'){const a=need(o.a),b=need(o.b);if(Math.hypot(a.x-b.x,a.y-b.y)<1e-9)return;return {k:'L',kind:t,l:[a.x,a.y,b.x,b.y]}}
  if(t==='perp'||t==='par'){const h=geo(o.l),p=need(o.p);if(!h||h.k!=='L')return;let dx=h.l[2]-h.l[0],dy=h.l[3]-h.l[1];if(t==='perp')[dx,dy]=[-dy,dx];return {k:'L',kind:'line',l:[p.x,p.y,p.x+dx,p.y+dy]}}
  if(t==='tt'){const a=need(o.a),b=need(o.b),dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<1e-9)return;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;return {k:'L',kind:'line',l:[mx,my,mx-dy,my+dx]}}
  if(t==='pg'){const a=need(o.a),b=need(o.b),q=need(o.c),u1=un(a.x-b.x,a.y-b.y),u2=un(q.x-b.x,q.y-b.y);if(!u1||!u2)return;
    let dx=u1[0]+u2[0],dy=u1[1]+u2[1];if(Math.hypot(dx,dy)<1e-9){dx=-u1[1];dy=u1[0]}return {k:'L',kind:'ray',l:[b.x,b.y,b.x+dx,b.y+dy]}}
  if(t==='circ'){const a=need(o.c),b=need(o.p),r=Math.hypot(a.x-b.x,a.y-b.y);if(r<1e-9)return;return {k:'C',cx:a.x,cy:a.y,r}}
  if(t==='circD'){const a=need(o.a),b=need(o.b),r=Math.hypot(a.x-b.x,a.y-b.y)/2;if(r<1e-9)return;return {k:'C',cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,r}}
  if(t==='circR'){const a=need(o.c);return {k:'C',cx:a.x,cy:a.y,r:o.rad}}
  if(t==='circ3'){const A=need(o.a),B=need(o.b),C=need(o.c);const d=2*(A.x*(B.y-C.y)+B.x*(C.y-A.y)+C.x*(A.y-B.y));if(Math.abs(d)<1e-9)return;
    const a2=A.x*A.x+A.y*A.y,b2=B.x*B.x+B.y*B.y,c2=C.x*C.x+C.y*C.y;const ux=(a2*(B.y-C.y)+b2*(C.y-A.y)+c2*(A.y-B.y))/d,uy=(a2*(C.x-B.x)+b2*(A.x-C.x)+c2*(B.x-A.x))/d;
    return {k:'C',cx:ux,cy:uy,r:Math.hypot(A.x-ux,A.y-uy)}}
  if(t==='cpy'){const h=geo(o.o);if(!h)return;const k=o.k||1,tx=o.tx||0,ty=o.ty||0;if(h.k==='G')return {k:'G',p:h.p.map(a=>[a[0]*k+tx,a[1]*k+ty])};if(h.k==='C')return {k:'C',cx:h.cx*k+tx,cy:h.cy*k+ty,r:h.r*k};return}
  if(t==='poly')return {k:'G',p:o.ps.map(i=>{const q=need(i);return [q.x,q.y]})};
  if(t==='fn'){const f=fnOf(o.ex);return f?{k:'F',f}:undefined}
  if(t==='ang'){need(o.a);need(o.b);need(o.c);return {k:'M'}}
  if(t==='dist'){need(o.a);need(o.b);return {k:'M'}}
  if(t==='area'){const h=geo(o.o);return h?{k:'M'}:undefined}
  return {k:'X'};}
function onL(h,u){return h.kind==='seg'?u>-1e-9&&u<1+1e-9:h.kind==='ray'?u>-1e-9:true}
function inter(g1,g2){if(!g1||!g2)return [];
  if(g1.k==='C'&&g2.k==='L')[g1,g2]=[g2,g1];
  if(g1.k==='L'&&g2.k==='L'){const [a,b,c2,d]=g1.l,[e,f,g,h]=g2.l,dx1=c2-a,dy1=d-b,dx2=g-e,dy2=h-f,den=dx1*dy2-dy1*dx2;if(Math.abs(den)<1e-12)return [];
    const s=((e-a)*dy2-(f-b)*dx2)/den,u=((e-a)*dy1-(f-b)*dx1)/den;if(!onL(g1,s)||!onL(g2,u))return [];return [Pt(a+s*dx1,b+s*dy1)]}
  if(g1.k==='L'&&g2.k==='C'){const [a,b,c2,d]=g1.l,dx=c2-a,dy=d-b,fx=a-g2.cx,fy=b-g2.cy,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-g2.r*g2.r,Dd=B*B-4*A*C;if(Dd<-1e-12)return [];
    const sq=Math.sqrt(Math.max(0,Dd));return [(-B-sq)/(2*A),(-B+sq)/(2*A)].map(s=>onL(g1,s)?Pt(a+s*dx,b+s*dy):undefined)}
  if(g1.k==='C'&&g2.k==='C'){const dx=g2.cx-g1.cx,dy=g2.cy-g1.cy,d=Math.hypot(dx,dy);if(d<1e-12||d>g1.r+g2.r+1e-9||d<Math.abs(g1.r-g2.r)-1e-9)return [];
    const a=(g1.r*g1.r-g2.r*g2.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,g1.r*g1.r-a*a)),mx=g1.cx+a*dx/d,my=g1.cy+a*dy/d;return [Pt(mx-h*dy/d,my+h*dx/d),Pt(mx+h*dy/d,my-h*dx/d)]}
  return [];}

/* ---------- Đối tượng, hoàn tác, lưu ---------- */
const LBL='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function nextName(){const used=new Set(Pg().objs.filter(o=>o.n).map(o=>o.n));for(let k=0;k<99;k++)for(const ch of LBL){const n=k?ch+k:ch;if(!used.has(n))return n}return '?'}
function add(o){o.id=Pg().nid++;if(o.col===undefined)o.col=col;if(PTS.has(o.t)&&!o.n)o.n=nextName();Pg().objs.push(o);flash.set(o.id,performance.now());inval();D();return o.id}
const snap0=()=>JSON.stringify({o:Pg().objs,n:Pg().nid});
function pushUndo(b){const p=Pg();p.undo.push(b);if(p.undo.length>150)p.undo.shift();p.redo=[];persist()}
function txn(fn){const b=snap0();fn();if(snap0()!==b)pushUndo(b);D()}
function restore(s){s=__syFix(s);setTimeout(()=>{try{updHidBtn()}catch(_){}},0);const d=JSON.parse(s);Pg().objs=d.o;Pg().nid=d.n;sel=null;pend=[];inval();D();persist()}
function undo(){const p=Pg();if(!p.undo.length)return say('Không còn bước để hoàn tác');p.redo.push(snap0());restore(p.undo.pop())}
function redo(){const p=Pg();if(!p.redo.length)return;p.undo.push(snap0());restore(p.redo.pop())}
function delWith(ids){const kill=new Set(ids);let ch=true;while(ch){ch=false;for(const o of Pg().objs)if(!kill.has(o.id)&&refs(o).some(r=>kill.has(r))){kill.add(o.id);ch=true}}
  Pg().objs=Pg().objs.filter(o=>!kill.has(o.id));if(sel!=null&&kill.has(sel))sel=null;pend=pend.filter(i=>!kill.has(i));inval();D()}
let pT=null;function persist(){clearTimeout(pT);pT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify({pages:pages.map(p=>({objs:p.objs,nid:p.nid,view:p.view,mode:p.mode,cam:p.cam,imgs:usedImgs(p)})),pi,bg}))}catch(e){say('⚠️ Ảnh quá lớn nên không tự lưu được trong trình duyệt – hãy dùng nút 💾 Lưu bài')}},400)}
function usedImgs(p){const r={},m=p.imgs||{};p.objs.forEach(o=>{if(o.t==='img'&&m[o.key])r[o.key]=m[o.key]});for(const u of p.undo.slice(-20))for(const k in m)if(!r[k]&&u.includes(k))r[k]=m[k];return r}
function loadData(d){if(!d||!d.pages||!d.pages.length)return false;pages=d.pages.map(p=>Object.assign(newPage(),p,{undo:[],redo:[]}));pi=Math.min(d.pi||0,pages.length-1);if(d.bg)bg=d.bg;sel=null;pend=[];inval();D();return true}
if(!window.__bpHost)try{loadData(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){}

/* ---------- Bắt đối tượng ---------- */
function dSeg(px,py,x1,y1,x2,y2,kind='seg'){const dx=x2-x1,dy=y2-y1,L=dx*dx+dy*dy;let u=L?((px-x1)*dx+(py-y1)*dy)/L:0;if(kind==='seg')u=cl01(u);else if(kind==='ray')u=Math.max(0,u);return Math.hypot(px-x1-u*dx,py-y1-u*dy)}
function inPoly(p,q){let ins=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const [xi,yi]=q[i],[xj,yj]=q[j];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)ins=!ins}return ins}
function hitDist(o,p){
  if(o.t==='ink'){const q=o.pts.map(a=>S(a[0],a[1]));let m=Math.hypot(p[0]-q[0][0],p[1]-q[0][1]);for(let i=1;i<q.length;i++)m=Math.min(m,dSeg(p[0],p[1],q[i-1][0],q[i-1][1],q[i][0],q[i][1]));return m-o.w*V().z/2}
  if(o.t==='img'){const [X,Y]=S(o.x,o.y),w=o.w*sc(),h=o.h*sc();return p[0]>=X&&p[0]<=X+w&&p[1]>=Y&&p[1]<=Y+h?8:1e9}
  if(o.t==='text'){const [X,Y]=S(o.x,o.y),fs=o.size*V().z;ctx.font=fs+'px Segoe UI,Arial';const w=ctx.measureText(o.s).width;return p[0]>=X-4&&p[0]<=X+w+4&&p[1]>=Y-4&&p[1]<=Y+fs*1.25?0:1e9}
  if(o.t==='amk'||o.t==='smk'){try{if(o.t==='smk'){const A=need(o.a),B=need(o.b),[X1,Y1]=S(A.x,A.y),[X2,Y2]=S(B.x,B.y);return Math.max(0,Math.hypot(p[0]-(X1+X2)/2,p[1]-(Y1+Y2)/2)-12)}
    const B=need(o.b),[X,Y]=S(B.x,B.y),d=Math.hypot(p[0]-X,p[1]-Y),r=amkR(o);return d<r+8?Math.max(0,Math.min(Math.abs(d-r),d<r?4:9)):1e9}catch(e){return 1e9}}
  const lb=lbBox.get(o.id);if(lb&&p[0]>=lb[0]&&p[0]<=lb[0]+lb[2]&&p[1]>=lb[1]&&p[1]<=lb[1]+lb[3])return 0;
  const g=geo(o.id);if(!g)return 1e9;
  if(g.k==='S3')return hit3(o,g,p);
  if(g.k==='P'){const [X,Y]=S(g.x,g.y);return Math.hypot(p[0]-X,p[1]-Y)}
  if(g.k==='L'){const [x1,y1]=S(g.l[0],g.l[1]),[x2,y2]=S(g.l[2],g.l[3]);return dSeg(p[0],p[1],x1,y1,x2,y2,g.kind)}
  if(g.k==='C'){const [X,Y]=S(g.cx,g.cy);return Math.abs(Math.hypot(p[0]-X,p[1]-Y)-g.r*sc())}
  if(g.k==='G'||g.k==='PL'){const q=g.p.map(a=>S(a[0],a[1]));let m=1e9;for(let i=0;i<q.length;i++){const j=(i+1)%q.length;m=Math.min(m,dSeg(p[0],p[1],q[i][0],q[i][1],q[j][0],q[j][1]))}return inPoly(p,q)?Math.min(m,7):m}
  if(g.k==='F'){const x=Wd(p[0],p[1])[0],y=g.f(x);if(!isFinite(y))return 1e9;return Math.abs(S(x,y)[1]-p[1])*0.8}
  return 1e9;}
const vis=o=>!o.hid||showHid;
function hitAt(p,f=()=>true,tol=9){const os=Pg().objs.filter(vis);let best=null,bd=1e9;
  for(const o of os){if(!PTS.has(o.t)||!f(o))continue;const d=hitDist(o,p);if(d<12&&d<bd){bd=d;best=o.id}}if(best!=null)return best;
  for(let i=os.length-1;i>=0;i--){const o=os[i];if(PTS.has(o.t)||!f(o))continue;const d=hitDist(o,p);if(d<tol&&d<bd-0.5){bd=d;best=o.id}}return best}
const isK=(id,k)=>{const g=geo(id);return !!g&&g.k===k};
const isCurve=o=>{const g=geo(o.id);return !!g&&(g.k==='L'||g.k==='C')};
function pickPoint(p,tolP=12){
  const h=hitAt(p,o=>PTS.has(o.t));if(h!=null&&hitDist(byId(h),p)<tolP)return h;
  const cur=Pg().objs.filter(o=>vis(o)&&isCurve(o)&&hitDist(o,p)<10).sort((a,b)=>hitDist(a,p)-hitDist(b,p));
  let best=null,bd=12;
  for(let i=0;i<cur.length;i++)for(let j=i+1;j<cur.length;j++)inter(geo(cur[i].id),geo(cur[j].id)).forEach((q,k)=>{if(!q)return;const [X,Y]=S(q.x,q.y),d=Math.hypot(X-p[0],Y-p[1]);if(d<bd){bd=d;best={a:cur[i].id,b:cur[j].id,k}}});
  if(best)return add(Object.assign({t:'int'},best));
  const [x,y]=Wd(p[0],p[1]);
  if(cur.length){const o=cur[0],g=geo(o.id);let u;if(g.k==='L'){const [x1,y1,x2,y2]=g.l,dx=x2-x1,dy=y2-y1;u=((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)}else u=Math.atan2(y-g.cy,x-g.cx);return add({t:'pon',on:o.id,u})}
  let X=x,Y=y;if(snapOn){const s=gstep();X=Math.round(x/s)*s;Y=Math.round(y/s)*s}
  return add({t:'pt',x:+X.toFixed(4),y:+Y.toFixed(4)});}
function bases(id,acc=new Set()){const o=byId(id);if(!o)return acc;if(o.t==='pt'||o.t==='text'||(o.t==='img'&&!o.lock))acc.add(o);else refs(o).forEach(r=>bases(r,acc));return acc}

/* ---------- Thanh công cụ ---------- */
const sv=s=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
const dt=(x,y,c='#2563eb')=>`<circle cx="${x}" cy="${y}" r="2.4" fill="${c}" stroke="none"/>`;
const IC={
 pt:sv(dt(12,12)+`<circle cx="12" cy="12" r="5" stroke="#93c5fd"/>`),
 rat:sv(`<path d="M3 17L21 7"/>`+dt(3,17)+dt(21,7)+dt(9,13.7,'#e11d48')+`<path d="M5.5 20.5l3-1.7M14 15.8l6-3.3" stroke="#e11d48" stroke-width="1.4"/>`),
 mid:sv(`<path d="M3 18L21 6"/>`+dt(3,18)+dt(21,6)+dt(12,12,'#e11d48')),
 int:sv(`<path d="M3 19L21 5M3 6l18 13"/>`+dt(12,12.4,'#e11d48')),
 sym:sv(dt(5,18)+dt(19,6)+`<circle cx="12" cy="12" r="2.2"/><path d="M6.5 16.7l4-3.4M13.5 10.7l4-3.4" stroke-dasharray="2 2"/>`),
 seg:sv(`<path d="M4 18L20 6"/>`+dt(4,18)+dt(20,6)),
 line:sv(`<path d="M1 21L23 3"/>`+dt(7,16)+dt(17,8)),
 angc:sv(`<path d="M4 19H21M4 19L16 6"/><path d="M10 19A6 6 0 0 0 8.2 14.6" stroke="#16a34a" stroke-width="1.6"/>`+dt(4,19)),
 ray:sv(`<path d="M5 18L23 4"/>`+dt(5,18)+dt(13,11.8)),
 tri:sv(`<path d="M12 3.5L21 19.5H3Z" fill="#fde68a"/><path d="M9 21.5l3 2 3-2" stroke="#6366f1"/>`+dt(12,3.5)+dt(3,19.5)+dt(21,19.5)),
 symP:sv(dt(4,18)+dt(20,6)+`<circle cx="12" cy="12" r="2.4"/><path d="M6.5 16.2l3.4-2.6M14.1 10.4l3.4-2.6" stroke-dasharray="2 2"/>`),
 symL:sv(`<path d="M12 2V22" stroke="#e11d48" stroke-dasharray="3 2"/><path d="M5 12h4M15 12h4" stroke-dasharray="2 2"/>`+dt(4,12)+dt(20,12)),
 ctrG:sv(`<path d="M12 3L21.5 20H2.5Z"/><path d="M12 3L12 20M2.5 20L16.8 11.5M21.5 20L7.3 11.5" stroke-width="1" stroke-dasharray="2 1.5"/>`+dt(12,14.3,'#e11d48')),
 ctrO:sv(`<path d="M12 3L21.5 20H2.5Z"/><circle cx="12" cy="14.2" r="10.2" stroke-width="1" stroke="#e11d48"/>`+dt(12,14.2,'#e11d48')),
 ctrH:sv(`<path d="M12 3L21.5 20H2.5Z"/><path d="M12 3V20M2.5 20L17.6 11.8M21.5 20L6.4 11.8" stroke-width="1" stroke-dasharray="2 1.5"/>`+dt(12,14.6,'#e11d48')),
 ctrI:sv(`<path d="M12 3L21.5 20H2.5Z"/><circle cx="12" cy="14.3" r="5.5" stroke-width="1" stroke="#e11d48"/>`+dt(12,14.3,'#e11d48')),
 tuyen:sv(`<path d="M12 3L21.5 20H2.5Z"/><path d="M12 3V20" stroke="#e11d48"/><path d="M7 18.5v3M17 18.5v3" stroke-width="1.2"/>`+dt(12,20,'#e11d48')),
 cao:sv(`<path d="M8 3L22 20H2Z"/><path d="M8 3V20" stroke="#e11d48"/><path d="M8 17h3v3" stroke-width="1.2"/>`),
 '3pt':sv(`<path d="M3 17L9 11H21L15 17Z" stroke-width="1" stroke="#94a3b8"/>`+dt(12,14)),
 '3mid':sv(`<path d="M4 19L20 5"/>`+dt(4,19)+dt(20,5)+dt(12,12,'#e11d48')+`<path d="M4 9L9 4" stroke-width="1" stroke="#94a3b8"/>`),
 '3seg':sv(`<path d="M3 15L9 9H21L15 15Z" stroke-width="1" stroke="#94a3b8"/><path d="M6 20L18 4"/>`+dt(6,20)+dt(18,4)),
 '3int':sv(`<path d="M3 20L21 4M3 8l18 10"/>`+dt(12,12,'#e11d48')+`<path d="M3 4h4" stroke-width="1"/>`),
 '3poly':sv(`<path d="M4 8L13 3L21 9L12 21Z" fill="#fecdd3"/><path d="M4 8L21 9" stroke-dasharray="2 2"/>`),
 '3dist':sv(`<path d="M4 18L20 6M3 14.5l2 4M19 3.5l2 4"/><text x="3" y="9" font-size="7" fill="currentColor" stroke="none">3D</text>`),
 '3xyz':sv(`<path d="M6 19V5M6 19H20M6 19L16 9" stroke-width="1.6"/>`+dt(15,9,'#e11d48')),
 '3ax':sv(`<path d="M8 15V3M8 15H22M8 15L2 21" stroke-width="1.8"/><path d="M8 3l-2 3M8 3l2 3M22 15l-3-2M22 15l-3 2"/>`),
 '3on':sv(`<path d="M3 16L9 9H22L16 16Z" fill="#e0e7ff"/>`+dt(13,12.5,'#e11d48')),
 '3line':sv(`<path d="M2 21L22 3"/><path d="M2 13l6-5h12" stroke-width="1" stroke="#94a3b8"/>`+dt(8,15.5)+dt(16,8.5)),
 '3ray':sv(`<path d="M6 19L22 4"/>`+dt(6,19)+dt(13,12.5)),
 '3perp':sv(`<path d="M2 18L8 13H22L16 18Z" fill="#e0e7ff"/><path d="M12 15.5V2" stroke="#e11d48"/><path d="M12 12.5h3v3" stroke-width="1"/>`+dt(12,4)),
 '3par':sv(`<path d="M2 17L14 5M10 21L22 9"/>`+dt(16,15)),
 '3plane':sv(`<path d="M2 17L8 7H22L16 17Z" fill="#c7d2fe"/>`+dt(7,14)+dt(12,10)+dt(17,13)),
 '3ppar':sv(`<path d="M2 11L7 4H22L17 11Z M2 21L7 14H22L17 21Z" fill="#c7d2fe"/>`),
 '3pperp':sv(`<path d="M2 20L7 14H22L17 20Z" fill="#c7d2fe"/><path d="M10 17V3L15 1V15" fill="#fecdd3"/>`),
 solid:sv(`<path d="M4 8H16V20H4Z M4 8L9 3H21V15L16 20 M16 8L21 3" fill="#dbeafe"/>`),
 rot3:sv(`<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M18 2v4.5h-4.5"/>`),
 view3:sv(`<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>`),
 vert3:sv(`<path d="M12 3V21M8 7l4-4 4 4M8 17l4 4 4-4"/>`),
 quad:sv(`<path d="M7 5H19L22 17H3Z" fill="#bbf7d0"/><path d="M9 21.5l3 2 3-2" stroke="#6366f1"/>`+dt(7,5)+dt(19,5)+dt(22,17)+dt(3,17)),
 poly:sv(`<path d="M4 19L11 4L20 15Z" fill="#c7d2fe"/>`+dt(4,19)+dt(11,4)+dt(20,15)),
 perp:sv(`<path d="M2 18H22M12 3V18M12 14h4v4"/>`+dt(12,6)),
 par:sv(`<path d="M2 15L18 5M6 21L22 11"/>`+dt(14,16)),
 tt:sv(`<path d="M3 15H21"/><path d="M12 3V21" stroke="#e11d48"/>`+dt(3,15)+dt(21,15)),
 pg:sv(`<path d="M4 19H21M4 19L16 4"/><path d="M4 19L22 11" stroke="#e11d48" stroke-dasharray="3 2"/>`),
 circ:sv(`<circle cx="12" cy="12" r="8.5"/>`+dt(12,12)+dt(20.5,12)),
 circR:sv(`<circle cx="12" cy="12" r="8.5"/><path d="M12 12L18 6"/>`+dt(12,12)),
 circD:sv(`<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12H20.5" stroke="#e11d48"/>`+dt(3.5,12)+dt(20.5,12)+dt(12,12,'#94a3b8')),
 circ3:sv(`<circle cx="12" cy="12" r="8.5"/>`+dt(4,9.5)+dt(17,19)+dt(17.5,5.6)),
 ang:sv(`<path d="M4 19H21M4 19L15 5"/><path d="M11 19A7 7 0 0 0 8.4 13.5" stroke="#e11d48"/>`),
 dist:sv(`<path d="M4 16L20 8M3 12.5l2 4M19 4.5l2 4"/><text x="9" y="9" font-size="7" fill="currentColor" stroke="none">cm</text>`),
 area:sv(`<path d="M4 19L9 5L20 9L18 19Z" fill="#bbf7d0"/><text x="9" y="16" font-size="8" fill="#166534" stroke="none">S</text>`),
 segc:sv(`<path d="M3 8L13 4"/><path d="M5 20L17 15" stroke="#e11d48"/><path d="M7 4.5l1.2 3M7.5 15.5l1.2 3" stroke-width="1.4"/><circle cx="5" cy="20" r="9" stroke-dasharray="2 2" stroke-width="1" stroke="#94a3b8"/>`+dt(3,8)+dt(13,4)+dt(5,20)+dt(17,15,'#e11d48')),
 amk:sv(`<path d="M4 20H21M4 20L14 4"/><path d="M12 20A8 8 0 0 0 8.2 13.3" stroke="#e11d48"/><path d="M15.5 20A11.5 11.5 0 0 0 10 10.4" stroke="#e11d48"/>`),
 smk:sv(`<path d="M3 18L21 6"/><path d="M9.5 9.5l3 4.5M12.5 7.5l3 4.5" stroke="#e11d48" stroke-width="2"/>`+dt(3,18)+dt(21,6)),
 cpy:sv(`<path d="M3 14L7 5L12 12Z" fill="#bfdbfe"/><path d="M12 21L16.5 11L22 19Z" fill="#60a5fa" fill-opacity=".6"/><path d="M10 15.5l3.5 1.5" stroke-dasharray="2 2"/>`),
 fill:sv(`<path d="M4 19L10 5L20 12Z" fill="#60a5fa" fill-opacity=".55"/><path d="M15 21c0-2 2-4 2-4s2 2 2 4a2 2 0 0 1-4 0Z" fill="#2563eb" stroke="none"/>`),
 fn:sv(`<path d="M2 20H22M5 3V22"/><path d="M6 6Q12 30 21 5" stroke="#2563eb"/>`)};
const TL=[
 ['Viết tay',[['sel','↖','Chọn / kéo'],['pen','✏️','Bút'],['smart','✨','Bút thông minh'],['hl','🖍️','Dạ quang'],['erase','🧽','Tẩy'],['laser','🔴','Laser'],['text','🔤','Chữ'],['imgf','🖼️','Chèn ảnh từ máy'],['imgp','📋','Dán ảnh đã sao chép (Ctrl+V)'],['pan','✋','Kéo bảng']]],
 ['Điểm',[['ptm',IC.pt,'Điểm ▾']]],
 ['Đường',[['lnm',IC.seg,'Đường ▾'],['tri',IC.tri,'Tam giác ▾'],['quad',IC.quad,'Tứ giác ▾']]],
 ['Tròn',[['crm',IC.circ,'Đường tròn ▾']]],
 ['Không gian',[['p3m',IC['3pt'],'Điểm ▾'],['l3m',IC['3line'],'Đường ▾'],['pl3m',IC['3plane'],'Mặt phẳng ▾'],['3dist',IC['3dist'],'Độ dài'],['solid',IC.solid,'Khối ▾'],['vert3',IC.vert3,'Kéo theo chiều cao (Shift)'],['rot3',IC.rot3,'Tự xoay'],['ax3',IC['3ax'],'Trục Oxyz'],['view3',IC.view3,'Góc nhìn SGK']]],
 ['Kí hiệu',[['amk',IC.amk,'Kí hiệu góc'],['smk',IC.smk,'Kí hiệu cạnh'],['fill',IC.fill,'Tô màu đa giác'],['cpy',IC.cpy,'Tách hình (kéo bản sao)']]],
 ['Đo · Vẽ',[['ang',IC.ang,'Đo góc'],['dist',IC.dist,'Độ dài'],['area',IC.area,'Diện tích'],['fn',IC.fn,'Đồ thị y=f(x)']]]];
const HINT={cpy:'Bấm vào <b>bên trong</b> một đa giác, vùng đã tô hoặc hình tròn rồi <b>kéo</b> bản sao ra chỗ trống. Kéo đỉnh của bản sao thì hình gốc đổi theo và ngược lại · kéo ô vuông ở góc (hoặc nút 🔍) để phóng to, thu nhỏ.',sel:'<b>Nhấn giữ một điểm</b> để đổi tên · kéo <b>điểm tự do</b> (chấm xanh) để cả hình thay đổi theo · bấm chọn một hình rồi bấm màu để đổi màu, phím Delete để xóa · kéo chỗ trống để dời bảng.',
 pen:'Viết, vẽ tự do như bảng phấn. Lăn chuột để phóng to/thu nhỏ, giữ chuột phải để kéo bảng.',
 smart:'Vẽ phác bằng tay: nét thẳng → <b>đoạn thẳng</b>, vòng tròn → <b>đường tròn</b>, tam giác/tứ giác → <b>đa giác động</b>, chấm → <b>điểm</b>.',
 hl:'Tô dạ quang để nhấn mạnh (nét trong suốt).',erase:'Rê qua nét hoặc hình cần xóa (xóa một hình sẽ xóa cả các hình dựng từ nó).',
 laser:'Bút chỉ laser: vệt sáng tự mờ dần, không để lại dấu.',text:'Bấm vào bảng rồi gõ chữ, Enter để xong. Bấm đúp vào chữ (công cụ Chọn) để sửa.',pan:'Kéo để di chuyển bảng; lăn chuột để phóng to/thu nhỏ.',
 symP:'Bấm điểm cần lấy đối xứng, rồi bấm tâm đối xứng (một điểm).',symL:'Bấm điểm cần lấy đối xứng, rồi bấm trục đối xứng (một đường thẳng / đoạn thẳng).',
 ctrG:'Bấm vào một tam giác (hoặc bấm 3 đỉnh) → <b>trọng tâm G</b>.',ctrO:'Bấm vào một tam giác (hoặc bấm 3 đỉnh) → <b>tâm đường tròn ngoại tiếp O</b>.',
 ctrH:'Bấm vào một tam giác (hoặc bấm 3 đỉnh) → <b>trực tâm H</b>.',ctrI:'Bấm vào một tam giác (hoặc bấm 3 đỉnh) → <b>tâm đường tròn nội tiếp I</b>.',
 tuyen:'Bấm đỉnh của tam giác, rồi bấm cạnh đối diện (hoặc bấm 2 đỉnh còn lại) → <b>đường trung tuyến</b>.',cao:'Bấm đỉnh của tam giác, rồi bấm cạnh đối diện (hoặc 2 đỉnh còn lại) → <b>đường cao</b> và <b>chân đường cao H</b> (tự kéo dài cạnh nếu chân đường cao nằm ngoài; nhấn giữ H để đổi tên).',
 segc:'<b>Bước 1:</b> bấm vào đoạn thẳng mẫu (hoặc 2 điểm). <b>Bước 2:</b> bấm điểm đầu của đoạn mới. <b>Bước 3:</b> bấm để chọn hướng – bấm lên một tia/đường thẳng đi qua điểm đầu để đặt đoạn trên đó. Kéo điểm cuối để xoay; đoạn mới luôn bằng đoạn mẫu.',
 amk:'Chọn kiểu kí hiệu ở thanh trên, rồi bấm vào <b>phía trong một góc</b> (gần đỉnh) – hoặc bấm 3 điểm A, O (đỉnh), B. Các góc bằng nhau dùng cùng một kiểu kí hiệu.',
 smk:'Chọn kiểu kí hiệu ở thanh trên, rồi bấm vào một <b>cạnh</b> (hoặc 2 điểm). Các cạnh bằng nhau dùng cùng số gạch; mũi tên để kí hiệu hai cạnh song song.',
 fill:'Chọn màu, rồi bấm vào <b>bên trong</b> đa giác hoặc hình tròn để tô (bấm lại để bỏ tô). Muốn tô một vùng bất kì: bấm lần lượt các điểm, bấm lại điểm đầu để khép kín.',
 '3pt':'Bấm lên mặt đáy (lưới) để đặt điểm; bấm lên một cạnh để lấy điểm thuộc cạnh. Kéo điểm: di chuyển ngang; giữ Shift hoặc bật ↕ để kéo lên/xuống.',
 '3mid':'Bấm 1 cạnh (hoặc 2 điểm) → trung điểm.',
 '3xyz':'Nhập tên và tọa độ (x; y; z) ở bảng nhỏ góc trên bên trái, rồi bấm “Tạo điểm” (hoặc Enter). Có thể tạo nhiều điểm liên tiếp.',
 '3on':'Bấm lên đường thẳng / cạnh, mặt phẳng, mặt của khối hoặc mặt cầu → điểm nằm trên đối tượng đó (kéo được nhưng không rời khỏi đối tượng).',
 '3line':'Bấm 2 điểm → đường thẳng (vẽ kéo dài hai phía).','3ray':'Bấm gốc, rồi bấm 1 điểm trên tia.',
 '3perp':'Bấm 1 điểm và 1 đường thẳng (hoặc 1 mặt phẳng / mặt của khối) → đường vuông góc, tự tạo hình chiếu H.','3par':'Bấm 1 điểm và 1 đường thẳng / cạnh → đường song song.',
 '3plane':'Bấm 3 điểm (hoặc 1 cạnh + 1 điểm), hoặc bấm thẳng vào một mặt của khối → mặt phẳng.','3ppar':'Bấm 1 điểm + 1 mặt phẳng (mặt của khối), hoặc 2 đường thẳng → mặt phẳng song song.',
 '3pperp':'Bấm 1 điểm + 1 đường thẳng → mặt phẳng vuông góc với đường; hoặc 1 đường + 1 mặt phẳng → mặt phẳng chứa đường và vuông góc với mặt đó.','3seg':'Bấm 2 điểm (đỉnh, điểm trên cạnh, hoặc điểm mới trên mặt đáy) → đoạn thẳng; nét khuất tự vẽ nét đứt.',
 '3int':'Bấm 2 đường thẳng / cạnh cùng một mặt phẳng, hoặc 1 đường thẳng + 1 mặt phẳng → giao điểm (tự kéo dài nếu cần).','3poly':'Bấm lần lượt các điểm, bấm lại điểm đầu để tạo mặt (thiết diện) được tô màu.',
 '3dist':'Bấm 2 điểm (hoặc 1 cạnh) → độ dài.','solid':'Chọn hình trong danh sách “Khối ▾”, rồi bấm lên mặt đáy để đặt hình.',
 pt:'Bấm để đặt điểm (nhấn giữ một điểm để đổi tên). Bấm lên đường thẳng/đường tròn → <b>điểm thuộc đường</b>; bấm vào chỗ hai đường cắt nhau → <b>giao điểm</b>.',
 mid:'Bấm 2 điểm (hoặc bấm 1 đoạn thẳng).',angc:'Nhập số đo góc và chọn chiều ở ô bên cạnh. Bấm <b>đỉnh O</b> rồi bấm <b>một điểm A trên cạnh có sẵn</b> (hoặc bấm vào đoạn thẳng, gần đầu O) → vẽ tia OB với góc AOB đúng số đo.',rat:'Nhập tỉ lệ <b>AM : MB</b> ở ô bên cạnh, rồi bấm điểm đầu A và điểm cuối B (hoặc bấm vào đoạn thẳng, gần đầu A). Kéo điểm vừa tạo dọc đoạn thẳng để đổi tỉ lệ.',int:'Bấm lần lượt 2 đường (thẳng hoặc tròn) để lấy giao điểm.',sym:'Bấm điểm cần lấy đối xứng, rồi bấm tâm đối xứng (một điểm) hoặc trục đối xứng (một đường thẳng).',
 seg:'Bấm 2 điểm.',line:'Bấm 2 điểm.',ray:'Bấm gốc tia, rồi bấm 1 điểm trên tia.',quad:'Chọn loại tứ giác trong danh sách xổ xuống, rồi bấm vào bảng để đặt. Kéo các đỉnh xanh: hình luôn giữ đúng tính chất (song song, cân, vuông…).',tri:'Chọn loại tam giác trong danh sách xổ xuống, rồi bấm vào bảng để đặt. Kéo các đỉnh xanh: tam giác luôn giữ đúng tính chất (đều, cân, vuông…).',poly:'Bấm lần lượt các đỉnh, bấm lại đỉnh đầu (hoặc Enter) để khép kín.',
 perp:'Bấm 1 đường thẳng hoặc 1 cạnh hình, rồi bấm 1 điểm → đường vuông góc.',par:'Bấm 1 đường thẳng hoặc 1 cạnh hình, rồi bấm 1 điểm → đường song song.',tt:'Bấm 2 điểm (hoặc 1 đoạn thẳng) → đường trung trực.',pg:'Bấm 3 điểm A, O (đỉnh), B → tia phân giác góc AOB.',
 circ:'Bấm tâm, rồi bấm 1 điểm nằm trên đường tròn.',circR:'Nhập bán kính r, rồi bấm vào vị trí tâm.',circ3:'Bấm 3 điểm → đường tròn đi qua 3 điểm.',circD:'Bấm 2 điểm A, B → đường tròn đường kính AB.',
 ang:'Bấm 3 điểm A, O (đỉnh), B → số đo góc AOB.',dist:'Bấm 2 điểm (hoặc 1 đoạn thẳng) → độ dài.',area:'Bấm vào một đa giác hoặc đường tròn → chu vi và diện tích.',fn:'Nhập hàm số y = f(x) rồi bấm “Vẽ”. Ví dụ: x^2-2x-3, 2sin(x), sqrt(x).'};
const tbtn={};
let btn3d;const gdivs={};
{const gd=el('div','bp-g');gd.appendChild(el('span','bp-gt','Bảng'));
  const mk=(ic,lb,fn)=>{const b=el('button','bp-t',`<span class="i">${ic}</span><span class="l">${lb}</span>`);b.type='button';b.title=lb;b.onclick=fn;gd.appendChild(b)};
  mk('☰','Danh mục',()=>$('#side').classList.toggle('open'));
  btn3d=(mk('🧊','Không gian 3D',()=>toggle3d()),gd.lastChild);
  mk('📌','Ẩn / ghim thanh công cụ (phím Tab)',()=>setCompact(!wrap.classList.contains('compact')));
  mk('⛶','Toàn màn hình',()=>{const fe=document.fullscreenElement||document.webkitFullscreenElement;if(fe){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
    const rq=body.requestFullscreen||body.webkitRequestFullscreen;if(rq)try{const r=rq.call(body);if(r&&r.catch)r.catch(()=>say('Trình duyệt này không cho toàn màn hình – hãy dùng “Thêm vào Màn hình chính” để mở như ứng dụng'))}catch(e){}else say('Trình duyệt này không hỗ trợ toàn màn hình – hãy dùng “Thêm vào Màn hình chính”')});
  tb.appendChild(gd)}
TL.forEach(([g,list])=>{const gd=el('div','bp-g');gdivs[g]=gd;gd.appendChild(el('span','bp-gt',g));
  list.forEach(([id,ic,lb])=>{const b=el('button','bp-t',`<span class="i">${ic}</span><span class="l">${lb}</span>`);b.type='button';b.title=lb;b.dataset.tool=id;b.onclick=()=>setTool(id);gd.appendChild(b);tbtn[id]=b});tb.appendChild(gd)});

tbtn.solid.onclick=()=>{const open=menu.style.display==='block'&&menuG==='solid';if(tool!=='solid')setTool('solid');open?closeMenu():openMenu('solid')};
tbtn.vert3.onclick=()=>{vertMode=!vertMode;updMode();say(vertMode?'↕ Kéo điểm sẽ di chuyển theo chiều cao (lên/xuống)':'Kéo điểm sẽ di chuyển trên mặt phẳng nằm ngang')};
tbtn.rot3.onclick=()=>{autoRot=!autoRot;updMode();D()};
tbtn.ax3.onclick=()=>{showAx=!showAx;try{cAx.set(showAx)}catch(_){}updMode();D();say(showAx?'📐 Đã hiện hệ trục tọa độ Oxyz':'Đã ẩn hệ trục tọa độ')};
tbtn.view3.onclick=()=>{autoRot=false;keepPivot(()=>{Pg().cam={th:-125,ph:22}});updMode();D();persist()};
['tri','quad'].forEach(g=>{tbtn[g].onclick=()=>{const open=menu.style.display==='block'&&menuG===g;if(tool!==g)setTool(g);open?closeMenu():openMenu(g)}});
const PTM=[['pt','Điểm','điểm tự do, điểm thuộc đường'],['int','Giao điểm','của hai đường thẳng / đường tròn'],['mid','Trung điểm','của hai điểm hoặc một đoạn thẳng'],['rat','Điểm chia theo tỉ lệ','M thuộc AB với AM : MB = m : n'],
  ['symP','Đối xứng qua điểm','điểm đối xứng qua một tâm'],['symL','Đối xứng qua đường','điểm đối xứng qua một trục'],['ctrG','Trọng tâm','giao ba đường trung tuyến'],
  ['ctrO','Tâm đường tròn ngoại tiếp','giao ba đường trung trực'],['ctrH','Trực tâm','giao ba đường cao'],['ctrI','Tâm đường tròn nội tiếp','giao ba đường phân giác']];
const LNM=[['seg','Đoạn thẳng','bấm 2 điểm'],['line','Đường thẳng','bấm 2 điểm'],['ray','Tia','bấm gốc, rồi bấm 1 điểm trên tia'],['pg','Đường phân giác','bấm 3 điểm A, O (đỉnh), B'],['tuyen','Đường trung tuyến','bấm đỉnh, rồi bấm cạnh đối diện'],['perp','Đường vuông góc','bấm 1 đường (hoặc cạnh), rồi bấm 1 điểm'],
  ['par','Đường song song','bấm 1 đường (hoặc cạnh), rồi bấm 1 điểm'],['tt','Đường trung trực','bấm 1 đoạn thẳng / cạnh, hoặc 2 điểm'],['cao','Đường cao','bấm đỉnh, rồi bấm cạnh đối diện'],['segc','Đoạn bằng đoạn cho trước','bấm đoạn mẫu, bấm điểm đầu, rồi chọn hướng'],['angc','Góc cho trước','có sẵn cạnh OA, vẽ tia OB tạo góc α° cho trước']];
const P3M=[['3pt','Điểm','tạo điểm trong không gian (kéo lên/xuống bằng Shift hoặc ↕)'],['3xyz','Điểm theo tọa độ','nhập tọa độ (x; y; z) để tạo điểm chính xác'],['3on','Điểm trên đối tượng','điểm nằm trên đường, mặt phẳng, mặt của khối, mặt cầu'],['3mid','Trung điểm','của 2 điểm hoặc 1 cạnh'],['3int','Giao điểm','của 2 đường thẳng, hoặc đường thẳng với mặt phẳng']];
const L3M=[['3line','Đường thẳng','qua 2 điểm'],['3seg','Đoạn thẳng','giữa 2 điểm'],['3ray','Tia','gốc và 1 điểm trên tia'],['3perp','Đường vuông góc','qua 1 điểm, vuông góc với đường / mặt phẳng'],['3par','Đường song song','qua 1 điểm, song song với đường thẳng']];
const PL3M=[['3plane','Mặt phẳng','qua 3 điểm, điểm + đường, hoặc bấm vào một mặt của khối'],['3ppar','Mặt phẳng song song','với mặt phẳng (qua 1 điểm) hoặc với 1 đường thẳng'],['3pperp','Mặt phẳng vuông góc','với đường thẳng (qua 1 điểm) hoặc với mặt phẳng (chứa 1 đường)'],['3poly','Mặt / thiết diện (tô màu)','bấm lần lượt các đỉnh của đa giác']];
const CRM=[['circ','Tâm và một điểm','bấm tâm, rồi bấm 1 điểm trên đường tròn'],['circR','Tâm và bán kính','nhập bán kính r, rồi bấm tâm'],['circ3','Qua 3 điểm','đường tròn đi qua 3 điểm (ngoại tiếp)'],['circD','Đường kính AB','bấm 2 đầu mút của đường kính']];
const SUB={crm:[CRM,'Chọn cách vẽ đường tròn'],ptm:[PTM,'Chọn loại điểm'],lnm:[LNM,'Chọn loại đường'],p3m:[P3M,'Điểm trong không gian'],l3m:[L3M,'Đường trong không gian'],pl3m:[PL3M,'Mặt phẳng']};
['crm','ptm','lnm','p3m','l3m','pl3m'].forEach(g=>{tbtn[g].onclick=()=>{const open=menu.style.display==='block'&&menuG===g;open?closeMenu():openMenu(g)}});
/* Hàng 1: màu, nét, nền, tùy chọn, ngữ cảnh */
const gCol=el('div','grp');const sws=[];
PAL.forEach(cc=>{const b=el('button','bp-sw');b.type='button';b.style.background=cc;b.title=cc;b.onclick=()=>{col=cc;try{updHd()}catch(_){}sws.forEach(x=>x.classList.toggle('on',x===b));
  if(sel!=null){const o=byId(sel);if(o)txn(()=>{o.col=cc})}D()};gCol.appendChild(b);sws.push(b)});sws[0].classList.add('on');
const gW=el('div','grp');gW.innerHTML='Nét: <input type="range" min="1" max="12" step="1" value="3" style="width:70px"> <b>3</b>';
const wIn=gW.querySelector('input'),wB=gW.querySelector('b');wIn.oninput=()=>{wid=+wIn.value;wB.textContent=wid};
const gBg=el('div','grp');gBg.appendChild(el('span','','Nền:'));
const bgSeg=seg(gBg,[['trang','Trắng'],['luoi','Lưới'],['oli','Ô li'],['den','Bảng đen']],bg,v=>{bg=v;persist();D()});
let penOnly=false;const gOp=el('div','grp');
const cAx=chk(gOp,'Oxy',showAx,v=>{showAx=v;try{updMode()}catch(_){}D()}),cLb=chk(gOp,'Nhãn',showLb,v=>{showLb=v;D()}),cSn=chk(gOp,'Bắt lưới',snapOn,v=>{snapOn=v}),cPen=chk(gOp,'✍️ Chỉ bút viết',penOnly,v=>{penOnly=v;say(v?'✍️ Chế độ bút cảm ứng: <b>bút</b> để viết, <b>ngón tay</b> để kéo / xoay / phóng to – tì tay lên màn hình không bị vẽ bậy':'Ngón tay và bút đều viết được')}),cAl=chk(gOp,'Đại số',showAlg,v=>{showAlg=v;alg.style.display=v?'block':'none';D()});
const cAxL=[...gOp.querySelectorAll('label')].find(l=>l.textContent.trim()==='Oxy');
const gCtx=el('div','grp bp-ctx');
s1.append(gCol,gW,gBg,gOp,gCtx);
const rWrap=el('span','','Bán kính r = <input type="number" min="0.1" step="0.5" value="2">');const rIn=rWrap.querySelector('input');
const fWrap=el('span','','y = <input type="text" value="x^2-2x-3"> ');const fIn=fWrap.querySelector('input');
const fBtn=btn(fWrap,'Vẽ',()=>{const ex=fIn.value.trim();if(!fnOf(ex)){say('⚠️ Không hiểu biểu thức “'+ex+'”');return}txn(()=>add({t:'fn',ex,col:col==='#111827'?'#2563eb':col}));say('Đã vẽ y = '+ex)},'b p');
const AST={st:'1',fl:false},SST={st:'1'},FST={a:.35};
const SEQ={mk:true};const segcWrap=el('span','');chk(segcWrap,'Tự kí hiệu hai đoạn bằng nhau',SEQ.mk,v=>{SEQ.mk=v});
const amkWrap=el('span','');amkWrap.appendChild(el('span','','Kiểu: '));seg(amkWrap,[['1','◜ 1 cung'],['2','2 cung'],['3','3 cung'],['t','cung có gạch'],['r','∟ góc vuông']],AST.st,v=>{AST.st=v});chk(amkWrap,'Tô màu góc',AST.fl,v=>{AST.fl=v});
const smkWrap=el('span','');smkWrap.appendChild(el('span','','Kiểu: '));seg(smkWrap,[['1','| 1 gạch'],['2','|| 2 gạch'],['3','||| 3 gạch'],['>','› song song'],['>>','›› song song']],SST.st,v=>{SST.st=v});
const AGS={a:60,cw:false};const angWrap=el('span','bp-angc');angWrap.innerHTML='Góc = <input type="number" min="1" max="180" step="1" value="60" style="width:60px">° ';
const angIn=angWrap.querySelector('input');angIn.onkeydown=e=>e.stopPropagation();
const angDir=seg(angWrap,[['ccw','↺ Ngược chiều kim đồng hồ'],['cw','↻ Cùng chiều']],'ccw',v=>{AGS.cw=v==='cw';const o=sel!=null&&byId(sel);if(o&&o.gv){txn(()=>{o.ang=(AGS.cw?-1:1)*Math.abs(o.ang)});say('📐 Đã đổi chiều tia')}});
angIn.oninput=()=>{const v=parseFloat(String(angIn.value).replace(',','.'));if(!(v>0&&v<=180))return;AGS.a=v;const o=sel!=null&&byId(sel);if(o&&o.gv){txn(()=>{o.ang=(o.ang<0?-1:1)*v});say('📐 Góc = '+fmt(v,2)+'°')}};
const RST={m:1,n:2};const ratWrap=el('span','bp-rat');ratWrap.innerHTML='Tỉ lệ <i>AM : MB</i> = <input type="number" min="0.1" step="1" value="1" style="width:52px"> : <input type="number" min="0.1" step="1" value="2" style="width:52px">';
const ratIn=ratWrap.querySelectorAll('input');ratIn.forEach((inp,i)=>{inp.onkeydown=e=>e.stopPropagation();inp.oninput=()=>{const v=parseFloat(String(inp.value).replace(',','.'));if(!(v>0))return;RST[i?'n':'m']=v;const o=sel!=null&&byId(sel);if(o&&o.t==='rat'){txn(()=>{o[i?'nn':'m']=v});say('📏 '+ratLbl(o))}}});
const fillWrap=el('span','');fillWrap.appendChild(el('span','','Độ đậm: '));seg(fillWrap,[[.18,'Nhạt'],[.35,'Vừa'],[.6,'Đậm']],FST.a,v=>{FST.a=+v});
fIn.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')fBtn.click()};rIn.onkeydown=e=>e.stopPropagation();

/* Hàng 2: thao tác */
const tb2=(p,t,ti,fn,cls)=>{const b=btn(p,t,fn,cls);b.title=ti;return b};
const gU=el('div','grp');tb2(gU,'↶','Hoàn tác (Ctrl+Z)',undo);tb2(gU,'↷','Làm lại (Ctrl+Y)',redo);
tb2(gU,'🗑','Xóa hình đã chọn (Delete)',()=>{if(sel==null)return say('Hãy dùng công cụ Chọn để bấm vào hình cần xóa');txn(()=>delWith([sel]))});
const hidBtn=tb2(gU,'🙈 0','Hiện các hình đang ẩn',()=>{showHid=!showHid;if(!showHid&&sel!=null&&(byId(sel)||{}).hid)sel=null;updHidBtn();inval();D()});
tb2(gU,'🧹','Xóa hết trang này',()=>txn(()=>{Pg().objs=[];sel=null;pend=[];inval()}));
const gZ=el('div','grp');tb2(gZ,'−','Thu nhỏ',()=>zoomAt([W/2,H/2],1/1.25));tb2(gZ,'+','Phóng to',()=>zoomAt([W/2,H/2],1.25));tb2(gZ,'⌂','Về gốc tọa độ, 100%',()=>{Object.assign(V(),{ox:W/2,oy:H/2,z:1});inval();D();persist()});
const gP=el('div','grp');tb2(gP,'◀','Trang trước',()=>goPage(pi-1));const pgLb=el('span','bp-pg');pgLb.title='Trang hiện tại';gP.appendChild(pgLb);tb2(gP,'▶','Trang sau',()=>goPage(pi+1));
tb2(gP,'＋','Thêm trang mới',()=>{pages.splice(pi+1,0,newPage());goPage(pi+1)});
tb2(gP,'✖','Bỏ trang này',()=>{if(pages.length===1){txn(()=>{Pg().objs=[]});return}pages.splice(pi,1);goPage(Math.min(pi,pages.length-1))});
const gF=el('div','grp');
tb2(gF,'🖼️','Lưu ảnh PNG',()=>{draw(true);const a=el('a');a.href=c.toDataURL('image/png');a.download='bang-phu-trang-'+(pi+1)+'.png';document.body.appendChild(a);a.click();a.remove();D()});
tb2(gF,'💾','Lưu bài (tệp .json)',()=>{const s=JSON.stringify({app:'bangphu',pages:pages.map(p=>({objs:p.objs,nid:p.nid,view:p.view,mode:p.mode,cam:p.cam,imgs:usedImgs(p)})),pi,bg});const a=el('a');a.href=URL.createObjectURL(new Blob([s],{type:'application/json'}));a.download='bang-phu.json';document.body.appendChild(a);a.click();a.remove()});
const fIn2=el('input');fIn2.type='file';fIn2.accept='.json,application/json';fIn2.style.display='none';gF.appendChild(fIn2);
tb2(gF,'📂','Mở bài đã lưu',()=>fIn2.click());
fIn2.onchange=()=>{const f=fIn2.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{if(loadData(JSON.parse(r.result))){bgSeg.set(bg);goPage(pi);persist();say('Đã mở bài “'+f.name+'”')}else say('⚠️ Tệp không đúng định dạng')}catch(e){say('⚠️ Không đọc được tệp')}};r.readAsText(f);fIn2.value=''};
tb2(gF,'🎬 Ví dụ','Ví dụ dựng hình: đường tròn ngoại tiếp',demo,'b p');
s1.append(gU);tb.appendChild(s1);sb.lastChild.prepend(gZ,gP,gF);
/* ---------- Thanh công cụ tự ẩn ---------- */
const hd=el('div','bp-hd'),msgEl=el('div','bp-msg');wrap.append(hd,msgEl);
hd.innerHTML=`<button type="button" data-h="open" title="Hiện thanh công cụ">🛠 <span class="cur"></span> ▾</button><button type="button" data-h="undo" title="Hoàn tác">↶</button><button type="button" data-h="redo" title="Làm lại">↷</button><button type="button" data-h="pin" title="Ghim thanh công cụ">📌</button>`;
hd.onclick=e=>{const b=e.target.closest('[data-h]');if(!b)return;const k=b.dataset.h;if(k==='open')showTb(true,true);if(k==='undo')undo();if(k==='redo')redo();if(k==='pin')setCompact(false)};
let tbT=null,stT=null,tbSticky=false;
function setCompact(v){wrap.classList.toggle('compact',v);wrap.classList.remove('tb-on','st-on');try{localStorage.setItem('bp_compact',v?'1':'0')}catch(e){}updHd();say(v?'Thanh công cụ đã <b>ẩn</b>: đưa chuột lên mép trên (hoặc bấm 🛠) để hiện lại':'Đã <b>ghim</b> thanh công cụ')}
function showTb(on,sticky){if(!wrap.classList.contains('compact'))return;clearTimeout(tbT);wrap.classList.toggle('tb-on',on);if(on){tbSticky=!!sticky}}
function hideTbSoon(ms=700){if(!wrap.classList.contains('compact'))return;clearTimeout(tbT);tbT=setTimeout(()=>{if(menu.style.display==='block')return hideTbSoon(ms);wrap.classList.remove('tb-on')},ms)}
function showMsg(s){if(!wrap.classList.contains('compact'))return;msgEl.innerHTML='💡 '+s;msgEl.classList.add('on');clearTimeout(stT);stT=setTimeout(()=>msgEl.classList.remove('on'),4500)}
function updHd(){const c=hd.querySelector('.cur');if(!c)return;const b=tbtn[tool];const grp=Object.keys(SUB).find(g=>SUB[g][0].some(a=>a[0]===tool));const ic=(grp?tbtn[grp]:b);c.innerHTML=(ic?ic.querySelector('.i').innerHTML:'')+`<span>${(b&&b.title)||(grp&&tbtn[grp].title)||''}</span><i class="sw" style="background:${col}"></i>`}
wrap.addEventListener('pointermove',e=>{if(!wrap.classList.contains('compact')||e.pointerType==='touch')return;const r=wrap.getBoundingClientRect(),y=e.clientY-r.top;
  if(y<14)showTb(true);else if(wrap.classList.contains('tb-on')&&!tb.contains(e.target)&&!menu.contains(e.target)&&!tbSticky&&y>tb.offsetHeight+30)hideTbSoon();
  if(y>r.height-12){wrap.classList.add('st-on');clearTimeout(wrap._st);}else if(wrap.classList.contains('st-on')&&!sb.contains(e.target)){clearTimeout(wrap._st);wrap._st=setTimeout(()=>wrap.classList.remove('st-on'),600)}});
tb.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!tbSticky)hideTbSoon(900)});
cvw.addEventListener('pointerdown',()=>{if(wrap.classList.contains('tb-on')){tbSticky=false;hideTbSoon(150)}},true);
tb.addEventListener('click',e=>{const b=e.target.closest('.bp-t');if(b&&b.dataset.tool&&!SUB[b.dataset.tool]&&!['tri','quad','solid'].includes(b.dataset.tool)&&wrap.classList.contains('compact')){tbSticky=false;hideTbSoon(500)}});
setTimeout(()=>{menu.addEventListener('click',()=>{if(wrap.classList.contains('compact')){tbSticky=false;setTimeout(()=>hideTbSoon(400),50)}})},0);
document.addEventListener('keydown',e=>{if(!body.classList.contains('on'))return;const tg=(e.target.tagName||'');if(tg==='TEXTAREA'||tg==='INPUT')return;if(e.key==='Tab'){e.preventDefault();if(!wrap.classList.contains('compact'))setCompact(true);else showTb(!wrap.classList.contains('tb-on'),true)}});
{let v='1';try{v=localStorage.getItem('bp_compact')||'1'}catch(e){}if(v==='1')wrap.classList.add('compact')}
function goPage(i){if(i<0||i>=pages.length)return;setTimeout(()=>{try{updHidBtn();updMode();if(!is3()&&(tool[0]==='3'||tool==='solid'))setTool('sel');if(is3()&&gdivs['Điểm'].contains(tbtn[tool]||null))setTool('sel')}catch(_){}},0);closeText();pi=i;sel=null;pend=[];act=null;inval();D();persist()}
function setTool(id){if(__syDeny(id))return;closeText();try{xyzShow(id==='3xyz')}catch(_){}try{fmenu.style.display='none';hiFace=null}catch(_){}if(id!=='tri'&&id!=='quad'&&id!=='solid')try{closeMenu()}catch(_){}tool=id;pend=[];act=null;Object.entries(tbtn).forEach(([k,b])=>b.classList.toggle('on',k===id));try{tbtn.ax3.classList.toggle('on',showAx);tbtn.vert3.classList.toggle('on',vertMode);tbtn.rot3.classList.toggle('on',autoRot)}catch(_){}
  for(const g in SUB){const it=SUB[g][0].find(a=>a[0]===id);if(it){tbtn[g].classList.add('on');tbtn[g].querySelector('.i').innerHTML=IC[id];tbtn[g].title=it[1]}}
  gCtx.innerHTML='';if(id==='circR')gCtx.appendChild(rWrap);if(id==='amk')gCtx.appendChild(amkWrap);if(id==='segc')gCtx.appendChild(segcWrap);if(id==='smk')gCtx.appendChild(smkWrap);if(id==='fill')gCtx.appendChild(fillWrap);if(id==='rat')gCtx.appendChild(ratWrap);if(id==='angc')gCtx.appendChild(angWrap);if(id==='fn'){gCtx.appendChild(fWrap);setTimeout(()=>fIn.focus(),0)}
  try{updHd()}catch(_){}c.style.cursor=id==='pan'?'grab':id==='sel'?'default':id==='text'?'text':id==='laser'||id==='erase'?'none':'crosshair';D()}

/* ---------- Bút thông minh: nhận dạng nét ---------- */
function rdp(q,eps){if(q.length<3)return q.slice();const [a,b]=[q[0],q[q.length-1]];let md=-1,mi=0;
  for(let i=1;i<q.length-1;i++){const d=dSeg(q[i][0],q[i][1],a[0],a[1],b[0],b[1],Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6?'seg':'line');if(d>md){md=d;mi=i}}
  if(md>eps){const l=rdp(q.slice(0,mi+1),eps),r=rdp(q.slice(mi),eps);return l.slice(0,-1).concat(r)}return [a,b]}
function corners(v,cyc,minD){let ch=true;v=v.slice();
  while(ch&&v.length>2){ch=false;const n=v.length;
    for(let i=cyc?0:1;i<(cyc?n:n-1);i++){const a=v[(i-1+n)%n],b=v[i],q=v[(i+1)%n];
      const u1=un(b[0]-a[0],b[1]-a[1]),u2=un(q[0]-b[0],q[1]-b[1]);const turn=u1&&u2?Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1]))):0;
      if(turn<0.5||Math.hypot(b[0]-a[0],b[1]-a[1])<minD){v.splice(i,1);ch=true;break}}}
  return v}
function smartInk(q){const xs=q.map(v=>v[0]),ys=q.map(v=>v[1]),Dm=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  let L=0;for(let i=1;i<q.length;i++)L+=Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]);
  if(Dm<10){pickPoint(q[0],16);say('✨ Đã nhận dạng: điểm');return}
  const f=q[0],l=q[q.length-1],ch=Math.hypot(l[0]-f[0],l[1]-f[1]),closed=ch<Math.max(20,0.25*Dm)&&L>2*Dm;
  if(!closed){let md=0;for(const v of q)md=Math.max(md,dSeg(v[0],v[1],f[0],f[1],l[0],l[1],'line'));
    if(md<Math.max(7,0.07*ch)){const A=pickPoint(f,16),B=pickPoint(l,16);if(A!==B){add({t:'seg',a:A,b:B,col});say('✨ Đã nhận dạng: đoạn thẳng');return}}
    const vs=corners(rdp(q,Math.max(7,0.06*Dm)),false,0.12*Dm);
    if(vs.length>=3&&vs.length<=6){const ids=vs.map(v=>pickPoint(v,16));for(let i=1;i<ids.length;i++)if(ids[i]!==ids[i-1])add({t:'seg',a:ids[i-1],b:ids[i],col});say('✨ Đã nhận dạng: đường gấp khúc');return}
  }else{const cx=xs.reduce((a,b)=>a+b)/q.length,cy=ys.reduce((a,b)=>a+b)/q.length,rs=q.map(v=>Math.hypot(v[0]-cx,v[1]-cy)),mr=rs.reduce((a,b)=>a+b)/rs.length,
      cv=Math.sqrt(rs.reduce((a,r)=>a+(r-mr)*(r-mr),0)/rs.length)/mr;
    let vs=rdp(q,Math.max(7,0.06*Dm));if(vs.length>1&&Math.hypot(vs[0][0]-vs[vs.length-1][0],vs[0][1]-vs[vs.length-1][1])<0.25*Dm)vs.pop();vs=corners(vs,true,0.12*Dm);
    if(cv<0.08||(cv<0.15&&(vs.length<3||vs.length>6))){const C=pickPoint([cx,cy],16),a=Math.atan2(f[1]-cy,f[0]-cx),P=pickPoint([cx+mr*Math.cos(a),cy+mr*Math.sin(a)],16);
      if(C!==P){add({t:'circ',c:C,p:P,col});say('✨ Đã nhận dạng: đường tròn (kéo tâm hoặc điểm trên đường tròn để chỉnh)');return}}
    if(vs.length>=3&&vs.length<=6){const ids=vs.map(v=>pickPoint(v,16));if(new Set(ids).size===ids.length){add({t:'poly',ps:ids,col});say('✨ Đã nhận dạng: '+(['','','','tam giác','tứ giác','ngũ giác','lục giác'][ids.length]));return}}}
  add({t:'ink',pts:q.map(v=>Wd(v[0],v[1]).map(z=>+z.toFixed(4))),col,w:wid/V().z});say('Nét vẽ chưa rõ hình — đã giữ nguyên nét tay');}

/* ---------- Dựng hình (công cụ GeoGebra) ---------- */
const isP=id=>isK(id,'P'),isL=id=>isK(id,'L');
/* ---------- Hình vẽ sẵn: tam giác & tứ giác ---------- */
const SH={tri:{deu:['Tam giác đều','3 cạnh bằng nhau','M16 3L29 25H3Z'],can:['Tam giác cân','2 cạnh bên bằng nhau','M16 2L25 25H7Z'],
  vuong:['Tam giác vuông','có một góc vuông','M5 4V25H29Z'],vc:['Tam giác vuông cân','vừa vuông vừa cân','M7 4V25H28Z'],
  nhon:['Tam giác nhọn','cả ba góc đều nhọn','M13 3L29 25H3Z'],tu:['Tam giác tù','có một góc tù','M9 15L31 25H1Z']},
solid:{tudien:['Tứ diện','4 đỉnh, 4 mặt tam giác','<path d="M4 22L17 26L28 18L15 3Z M17 26L15 3" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 22L28 18" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],choptg:['Hình chóp tam giác','S.ABC','<path d="M3 21L16 26L29 19L16 2Z M16 26L16 2" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 21L29 19" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],chopt:['Hình chóp tứ giác','S.ABCD, đáy hình bình hành','<path d="M2 22H20L30 16 M2 22L15 2L20 22 M15 2L30 16" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 22L12 16H30 M12 16L15 2" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],chopdeu:['Hình chóp tứ giác đều','đáy hình vuông, đỉnh trên tâm','<path d="M3 23H21L28 17 M3 23L15 3L21 23 M15 3L28 17" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 23L10 17H28 M10 17L15 3" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],langtru:['Hình lăng trụ tam giác',"ABC.A'B'C'",'<path d="M3 8L13 12L28 5Z M3 8V22L13 26V12 M13 26L28 19V5" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 22L28 19" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],hop:['Hình hộp',"ABCD.A'B'C'D'",'<path d="M4 12H22L20 26H2Z M4 12L12 5H30L28 19L20 26 M22 12L30 5" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 26L10 19H28 M10 19L12 5" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],hhcn:['Hình hộp chữ nhật','các mặt là hình chữ nhật','<path d="M2 12H22V26H2Z M2 12L10 6H30V20L22 26 M22 12L30 6" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 26L10 20H30 M10 20V6" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],lp:['Hình lập phương','6 mặt là hình vuông','<path d="M3 10H21V26H3Z M3 10L11 3H29V19L21 26 M21 10L29 3" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 26L11 19H29 M11 19V3" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],tru:['Hình trụ','đáy là hình tròn','<path d="M4 6A12 3.5 0 1 0 28 6A12 3.5 0 1 0 4 6 M4 6V22A12 3.5 0 0 0 28 22V6" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 22A12 3.5 0 0 1 28 22" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],non:['Hình nón','đỉnh S, đáy là hình tròn','<path d="M16 2L4 21A12 3.5 0 0 0 28 21L16 2" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 21A12 3.5 0 0 1 28 21" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>'],cau:['Hình cầu','tâm O, bán kính R','<path d="M16 2A12 12 0 1 0 16 26A12 12 0 1 0 16 2 M4 14A12 3.5 0 0 0 28 14" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 14A12 3.5 0 0 1 28 14" fill="none" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="2.5 2"/>']},
 quad:{thang:['Hình thang','có hai cạnh đối song song','M9 6H21L30 24H2Z'],thangcan:['Hình thang cân','hai cạnh bên bằng nhau','M9 6H23L30 24H2Z'],
  thangvuong:['Hình thang vuông','có một góc vuông','M3 6H19L30 24H3Z'],binhhanh:['Hình bình hành','các cạnh đối song song','M10 6H31L23 24H2Z'],
  hcn:['Hình chữ nhật','bốn góc vuông','M2 6H30V24H2Z'],thoi:['Hình thoi','bốn cạnh bằng nhau','M16 2L29 14L16 26L3 14Z'],vuong:['Hình vuông','bốn cạnh bằng nhau, bốn góc vuông','M6 3H26V23H6Z']}};
let shp={tri:null,quad:null,solid:null},menuG='tri';
const shS=()=>260/sc();
function shGeom(g,k,cx,cy,s){const P=(x,y)=>[cx+x*s,cy+y*s];
  if(g==='tri'){const T={deu:[[0,0.5761],[-0.5,-0.29],[0.5,-0.29]],can:[[0,0.48],[-0.4,-0.4],[0.4,-0.4]],vuong:[[-0.45,-0.35],[0.55,-0.35],[-0.45,0.35]],
      vc:[[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4]],nhon:[[-0.1,0.5],[-0.5,-0.35],[0.5,-0.3]],tu:[[-0.25,0.1],[-0.6,-0.2],[0.6,-0.2]]}[k];return T.map(a=>P(...a))}
  const Q={thang:[[-0.3,0.35],[0.195,0.35],[0.55,-0.35],[-0.55,-0.35]],thangcan:[[-0.3,0.35],[0.3,0.35],[0.55,-0.35],[-0.55,-0.35]],
    thangvuong:[[-0.5,0.3535],[0.13,0.3535],[0.55,-0.35],[-0.5,-0.35]],binhhanh:[[-0.35,0.3],[0.6,0.3],[0.35,-0.3],[-0.6,-0.3]],
    hcn:[[-0.55,0.3],[0.55,0.3],[0.55,-0.3],[-0.55,-0.3]],thoi:[[-0.25,0.3062],[0.45,0.3062],[0.1,-0.3],[-0.6,-0.3]],vuong:[[-0.35,0.35],[0.35,0.35],[0.35,-0.35],[-0.35,-0.35]]}[k];
  return Q.map(a=>P(...a))}
function makeShape(g,k,cx,cy){const G=shGeom(g,k,cx,cy,shS()),used=new Set(Pg().objs.filter(o=>o.n).map(o=>o.n)),N=[],n=g==='tri'?3:4;
  for(let i=0;N.length<n;i++){const nn=i<26?LBL[i]:LBL[i%26]+Math.floor(i/26);if(!used.has(nn))N.push(nn)}
  const F=(i)=>add({t:'pt',x:+G[i][0].toFixed(4),y:+G[i][1].toFixed(4),n:N[i]}),X=(i,o)=>add(Object.assign(o,{n:N[i]}));let A,B,C,Dd,tk,ra;
  if(g==='tri'){
    if(k==='deu'){B=F(1);C=F(2);A=X(0,{t:'rot',c:B,p:C,ang:60});tk=[1,1,1]}
    else if(k==='can'){B=F(1);C=F(2);A=X(0,{t:'ax',a:B,b:C,u:1.1});tk=[1,0,1]}
    else if(k==='vuong'){A=F(0);B=F(1);C=X(2,{t:'pq',a:A,b:B,u:0.7});ra=[0]}
    else if(k==='vc'){A=F(0);B=F(1);C=X(2,{t:'rot',c:A,p:B,ang:90});tk=[1,0,1];ra=[0]}
    else{A=F(0);B=F(1);C=F(2)}
    add({t:'poly',ps:[A,B,C],col:col==='#111827'?'#2563eb':col,tk,ra,nm:SH.tri[k][0]})}
  else{
    if(k==='thang'){A=F(0);Dd=F(3);C=F(2);B=X(1,{t:'pd',a:Dd,b:C,c:A,u:0.45})}
    else if(k==='thangcan'){A=F(0);Dd=F(3);C=F(2);B=X(1,{t:'mir',p:A,a:Dd,b:C});tk=[0,1,0,1]}
    else if(k==='thangvuong'){Dd=F(3);C=F(2);A=X(0,{t:'pq',a:Dd,b:C,u:0.67});B=X(1,{t:'pd',a:Dd,b:C,c:A,u:0.6});ra=[0,3]}
    else if(k==='binhhanh'){A=F(0);Dd=F(3);C=F(2);B=X(1,{t:'par4',a:A,b:C,c:Dd});tk=[1,2,1,2]}
    else if(k==='hcn'){Dd=F(3);C=F(2);A=X(0,{t:'pq',a:Dd,b:C,u:0.6/1.1});B=X(1,{t:'par4',a:A,b:C,c:Dd});tk=[1,2,1,2];ra=[0,1,2,3]}
    else if(k==='thoi'){Dd=F(3);C=F(2);A=X(0,{t:'rot',c:Dd,p:C,ang:60,dr:1});B=X(1,{t:'par4',a:A,b:C,c:Dd});tk=[1,1,1,1]}
    else{Dd=F(3);C=F(2);A=X(0,{t:'rot',c:Dd,p:C,ang:90});B=X(1,{t:'par4',a:A,b:C,c:Dd});tk=[1,1,1,1];ra=[0,1,2,3]}
    add({t:'poly',ps:[A,B,C,Dd],col:col==='#111827'?'#2563eb':col,tk,ra,nm:SH.quad[k][0]})}
  return N}
const menu=el('div','bp-menu');wrap.appendChild(menu);
function openMenu(g){menuG=g;
  if(SUB[g]){menu.innerHTML='<div class="mh">'+SUB[g][1]+'</div>'+SUB[g][0].map(([k,n,d])=>`<button type="button" data-k="${k}"${tool===k?' class="on"':''}><span style="width:34px;display:flex;justify-content:center;color:#1e293b">${IC[k]}</span><span><b>${n}</b><small>${d}</small></span></button>`).join('');
    const r=tbtn[g].getBoundingClientRect(),w=wrap.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(w.width-305,r.left-w.left))+'px';menu.style.top=(r.bottom-w.top+4)+'px';menu.style.display='block';return}
  const items=SH[g];
  menu.innerHTML=`<div class="mh">Chọn ${g==='tri'?'loại tam giác':g==='quad'?'loại tứ giác':'hình không gian'}</div>`+Object.entries(items).map(([k,v])=>`<button type="button" data-k="${k}"${shp[g]===k?' class="on"':''}><svg width="34" height="28" viewBox="0 0 32 28">${v[2][0]==='<'?v[2]:`<path d="${v[2]}" fill="#dbeafe" stroke="#2563eb" stroke-width="1.8" stroke-linejoin="round"/>`}</svg><span><b>${v[0]}</b><small>${v[1]}</small></span></button>`).join('');
  const r=tbtn[g].getBoundingClientRect(),w=wrap.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(w.width-305,r.left-w.left))+'px';menu.style.top=(r.bottom-w.top+4)+'px';menu.style.display='block'}
const closeMenu=()=>{menu.style.display='none'};
menu.onclick=e=>{const b=e.target.closest('button[data-k]');if(!b)return;const g=menuG;if(SUB[g]){closeMenu();setTool(b.dataset.k);return}shp[g]=b.dataset.k;closeMenu();if(tool!==g)setTool(g);tbtn[g].title=SH[g][shp[g]][0];
  say('Bấm vào bảng để đặt <b>'+SH[g][shp[g]][0].toLowerCase()+'</b> (tâm hình ở chỗ bấm)');D()};
document.addEventListener('pointerdown',e=>{if(menu.style.display==='block'&&!menu.contains(e.target)&&!tbtn.tri.contains(e.target)&&!tbtn.quad.contains(e.target)&&!tbtn.ptm.contains(e.target)&&!tbtn.crm.contains(e.target)&&!tbtn.lnm.contains(e.target)&&!tbtn.solid.contains(e.target)&&!['p3m','l3m','pl3m'].some(g=>tbtn[g].contains(e.target)))closeMenu()},true);
function edgeAt(p){let best=null,bd=9;for(const o of Pg().objs){if(!vis(o))continue;const g=geo(o.id);if(!g)continue;
    if(o.t==='seg'){const [x1,y1]=S(g.l[0],g.l[1]),[x2,y2]=S(g.l[2],g.l[3]),d=dSeg(p[0],p[1],x1,y1,x2,y2);if(d<bd){bd=d;best=[o.a,o.b]}}
    else if(o.t==='poly'){const q=g.p.map(a=>S(a[0],a[1]));for(let i=0;i<q.length;i++){const j=(i+1)%q.length,d=dSeg(p[0],p[1],q[i][0],q[i][1],q[j][0],q[j][1]);if(d<bd){bd=d;best=[o.ps[i],o.ps[j]]}}}}return best}
function segOf(e){const ex=Pg().objs.find(o=>o.t==='seg'&&((o.a===e[0]&&o.b===e[1])||(o.a===e[1]&&o.b===e[0])));if(ex)return ex.id;
  const pl=Pg().objs.find(o=>o.t==='poly'&&o.ps.includes(e[0])&&o.ps.includes(e[1]));return add({t:'seg',a:e[0],b:e[1],col:pl?pl.col:col})}
function footName(){const used=new Set(Pg().objs.filter(o=>o.n).map(o=>o.n));for(const n of ['H','K','I','E','F','D','M','N'])if(!used.has(n))return n;return nextName()}
function cornerAt(p){const nb=new Map(),addE=(a,b)=>{if(a===b)return;if(!nb.has(a))nb.set(a,new Set());if(!nb.has(b))nb.set(b,new Set());nb.get(a).add(b);nb.get(b).add(a)};
  for(const o of Pg().objs){if(!vis(o))continue;if(o.t==='seg'||o.t==='ray'||o.t==='line')addE(o.a,o.b);else if(o.t==='poly'||o.t==='reg')o.ps.forEach((v,i)=>addE(v,o.ps[(i+1)%o.ps.length]))}
  let best=null,bd=70;for(const [v,set] of nb){const g=geo(v);if(!g||g.k!=='P')continue;const V0=S(g.x,g.y),d=Math.hypot(p[0]-V0[0],p[1]-V0[1]);if(d>=bd||d<4)continue;const ns=[...set];
    for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const g1=geo(ns[i]),g2=geo(ns[j]);if(!g1||!g2||g1.k!=='P'||g2.k!=='P')continue;const P1=S(g1.x,g1.y),P2=S(g2.x,g2.y);
      const u=[P1[0]-V0[0],P1[1]-V0[1]],w=[P2[0]-V0[0],P2[1]-V0[1]],q=[p[0]-V0[0],p[1]-V0[1]],cr=(a,b)=>a[0]*b[1]-a[1]*b[0],s0=cr(u,w);if(Math.abs(s0)<1e-6)continue;
      if(Math.sign(cr(u,q))===Math.sign(s0)&&Math.sign(cr(q,w))===Math.sign(s0)){bd=d;best=[ns[i],v,ns[j]]}}}return best}
function setMark(t,k){const ex=Pg().objs.find(o=>o.t===t&&o.b===k.b&&(t==='smk'?(o.a===k.a||o.a===k.b)&&(o.b===k.b||o.b===k.a):(o.a===k.a&&o.c===k.c)||(o.a===k.c&&o.c===k.a)))||
    (t==='smk'?Pg().objs.find(o=>o.t==='smk'&&((o.a===k.a&&o.b===k.b)||(o.a===k.b&&o.b===k.a))):null);
  const stl=t==='amk'?{st:AST.st,fl:AST.fl||undefined}:{st:SST.st};if(ex){Object.assign(ex,stl);if(!stl.fl)delete ex.fl;inval();say('Đã đổi kiểu kí hiệu');return ex.id}
  const id=add(Object.assign({t},k,stl));say(t==='amk'?'✅ Đã kí hiệu góc '+nm(k.a)+nm(k.b)+nm(k.c)+' – chọn cùng kiểu kí hiệu cho các góc bằng nhau':'✅ Đã kí hiệu cạnh '+nm(k.a)+nm(k.b)+' – chọn cùng kiểu kí hiệu cho các cạnh bằng nhau');return id}
function fillTarget(p){let best=null,ba=1e18;for(const o of Pg().objs){if(!vis(o))continue;const g=geo(o.id);if(!g)continue;let area=null;
    if((o.t==='poly'||o.t==='reg')&&g.k==='G'){const q=g.p.map(a=>S(a[0],a[1]));if(inPoly(p,q)){let A2=0;for(let i=0;i<q.length;i++){const j=(i+1)%q.length;A2+=q[i][0]*q[j][1]-q[j][0]*q[i][1]}area=Math.abs(A2)/2}}
    else if(g.k==='C'){const [X,Y]=S(g.cx,g.cy),r=g.r*sc();if(Math.hypot(p[0]-X,p[1]-Y)<r)area=Math.PI*r*r}
    if(area!=null&&area<ba){ba=area;best=o.id}}return best}
function geoClick(p){const T2=tool;if(T2[0]==='3'||T2==='solid')return geoClick3(p);
  if(T2==='pt'){pickPoint(p);return}
  if(T2==='tri'||T2==='quad'){const k=shp[T2];if(!k){openMenu(T2);return}const [x,y]=Wd(...p),N=makeShape(T2,k,x,y);setTool('sel');
    say('✅ Đã vẽ '+SH[T2][k][0].toLowerCase()+' '+N.join('')+' – kéo các đỉnh màu xanh để thay đổi, hình luôn giữ đúng tính chất');return}
  if(T2==='angc'){const done=(O,A)=>{const a=Math.min(180,Math.max(0.1,AGS.a))*(AGS.cw?-1:1);const B=add({t:'rot',c:O,p:A,ang:a,dr:1,gv:1});add({t:'ray',a:O,b:B});add({t:'ang',a:A,b:O,c:B,col:'#16a34a'});sel=B;
      const nm=i=>{const q=byId(i);return (q&&q.n)||'?'};say('📐 Đã vẽ tia '+nm(O)+nm(B)+' với góc '+nm(A)+nm(O)+nm(B)+' = '+fmt(Math.abs(a),2)+'°. Kéo điểm '+nm(B)+' để đổi số đo, hoặc sửa số ở ô Góc.')};
    if(!pend.length&&hitAt(p,o=>PTS.has(o.t))==null){const e=edgeAt(p);if(e){const g0=geo(e[0]),g1=geo(e[1]),q0=S(g0.x,g0.y),q1=S(g1.x,g1.y);Math.hypot(p[0]-q0[0],p[1]-q0[1])<=Math.hypot(p[0]-q1[0],p[1]-q1[1])?done(e[0],e[1]):done(e[1],e[0]);return}}
    const id=pickPoint(p);if(pend.length&&pend[0]===id)return;pend.push(id);if(pend.length===1){const q=byId(id);say('Đỉnh góc là '+((q&&q.n)||'O')+'. Bấm tiếp một điểm trên cạnh có sẵn.')}if(pend.length===2){done(pend[0],pend[1]);pend=[]}return}
  if(T2==='rat'){const done=(a,b)=>{const id=add({t:'rat',a,b,m:RST.m,nn:RST.n});sel=id;say('📏 Đã lấy điểm '+ratLbl(byId(id))+' — kéo điểm dọc đoạn thẳng để đổi tỉ lệ, hoặc sửa số ở ô Tỉ lệ');};
    if(!pend.length&&hitAt(p,o=>PTS.has(o.t))==null){const e=edgeAt(p);if(e){const g0=geo(e[0]),g1=geo(e[1]),d0=Math.hypot(p[0]-S(g0.x,g0.y)[0],p[1]-S(g0.x,g0.y)[1]),d1=Math.hypot(p[0]-S(g1.x,g1.y)[0],p[1]-S(g1.x,g1.y)[1]);d0<=d1?done(e[0],e[1]):done(e[1],e[0]);return}}
    const id=pickPoint(p);if(pend.length&&pend[0]===id)return;pend.push(id);if(pend.length===2){done(pend[0],pend[1]);pend=[]}return}
  if(['seg','line','ray','tt','dist','mid','circ','circD'].includes(T2)){
    if(!pend.length&&['mid','tt','dist','circD'].includes(T2)&&hitAt(p,o=>PTS.has(o.t))==null){const e=edgeAt(p);if(e){add({t:T2,a:e[0],b:e[1]});return}}
    const id=pickPoint(p);if(pend.length&&pend[0]===id)return;pend.push(id);
    if(pend.length===2){add(T2==='circ'?{t:'circ',c:pend[0],p:pend[1]}:{t:T2,a:pend[0],b:pend[1]});pend=[]}return}
  if(T2==='circR'){const r=parseFloat(String(rIn.value).replace(',','.'));if(!(r>0))return say('⚠️ Bán kính phải là số dương');add({t:'circR',c:pickPoint(p),rad:r});return}
  if(['circ3','ang','pg'].includes(T2)){const id=pickPoint(p);if(pend.includes(id))return;pend.push(id);if(pend.length===3){add({t:T2,a:pend[0],b:pend[1],c:pend[2]});pend=[]}return}
  if(T2==='poly'){const id=pickPoint(p);if(pend.length>=3&&id===pend[0]){add({t:'poly',ps:pend.slice()});pend=[]}else if(!pend.includes(id))pend.push(id);return}
  if(T2==='tuyen'||T2==='cao'){const mkTC=(a,b,c2)=>{const id=add({t:T2,a,b,c:c2});if(T2==='cao'&&geo(id)){const g=geo(id),B=need(b),C=need(c2);
        if(Math.hypot(g.l[2]-B.x,g.l[3]-B.y)<1e-6||Math.hypot(g.l[2]-C.x,g.l[3]-C.y)<1e-6){say('Chân đường cao kẻ từ '+nm(a)+' trùng với một đỉnh ('+(Math.hypot(g.l[2]-B.x,g.l[3]-B.y)<1e-6?nm(b):nm(c2))+') – tam giác vuông tại đỉnh đó');return}
        const fn=footName();add({t:'ft',o:id,n:fn});say('✅ Đã vẽ đường cao '+nm(a)+fn+' ('+fn+' là chân đường cao, nằm trên đường thẳng '+nm(b)+nm(c2)+') – nhấn giữ điểm '+fn+' để đổi tên')}};
    if(pend.length===1&&hitAt(p,o=>PTS.has(o.t))==null){const e=edgeAt(p);if(e&&!e.includes(pend[0])){mkTC(pend[0],e[0],e[1]);pend=[];return}}
    const id=pickPoint(p);if(pend.includes(id))return;pend.push(id);if(pend.length===3){mkTC(pend[0],pend[1],pend[2]);pend=[]}return}
  if(T2==='segc'){const hp=hitAt(p,o=>PTS.has(o.t));
    if(pend.length<2){if(!pend.length&&hp==null){const e=edgeAt(p);if(e){pend=[e[0],e[1]];return say('✅ Đã chọn đoạn mẫu <b>'+nm(e[0])+nm(e[1])+'</b>. Bước 2: bấm vào <b>điểm đầu</b> của đoạn mới.')}return say('Bước 1: bấm vào một <b>đoạn thẳng</b> (hoặc cạnh hình) làm đoạn mẫu, hoặc bấm 2 điểm đầu mút.')}
      if(hp==null)return;if(pend.includes(hp))return;pend.push(hp);if(pend.length===2)say('✅ Đã chọn đoạn mẫu <b>'+nm(pend[0])+nm(pend[1])+'</b>. Bước 2: bấm vào <b>điểm đầu</b> của đoạn mới.');return}
    if(pend.length===2){pend.push(pickPoint(p));return say('Bước 3: bấm để chọn <b>hướng</b> của đoạn mới (bấm lên một tia hoặc đường thẳng đi qua '+nm(pend[2])+' để đặt đoạn trên đó).')}
    const [s1,s2,a]=pend,A=need(a),w=Wd(...p);if(Math.hypot(w[0]-A.x,w[1]-A.y)<1e-6)return;
    const ln=hitAt(p,o=>isL(o.id)&&(()=>{const h=geo(o.id),[x1,y1,x2,y2]=h.l;const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);return L>1e-9&&Math.abs((A.x-x1)*dy-(A.y-y1)*dx)/L<1e-6})());
    let id;if(ln!=null){const h=geo(ln),d=un(h.l[2]-h.l[0],h.l[3]-h.l[1]);id=add({t:'eqp',a,c:s1,d:s2,ln,sg:((w[0]-A.x)*d[0]+(w[1]-A.y)*d[1])>=0?1:-1})}
    else id=add({t:'eqp',a,c:s1,d:s2,u:+Math.atan2(w[1]-A.y,w[0]-A.x).toFixed(5)});
    add({t:'seg',a,b:id});if(SEQ.mk){const ex=Pg().objs.find(o=>o.t==='smk'&&((o.a===s1&&o.b===s2)||(o.a===s2&&o.b===s1)));const used=new Set(Pg().objs.filter(o=>o.t==='smk').map(o=>o.st));
      const st=ex?ex.st:(['1','2','3','>','>>'].find(k=>!used.has(k))||'1');if(!ex)add({t:'smk',a:s1,b:s2,st});add({t:'smk',a,b:id,st})}
    pend=[];say('✅ Đã vẽ đoạn <b>'+nm(a)+nm(id)+' = '+nm(s1)+nm(s2)+'</b>'+(ln!=null?' trên đường đã chọn':'')+'. Kéo điểm '+nm(id)+' để đổi hướng – độ dài luôn bằng đoạn mẫu.');return}
  if(T2==='amk'){const hp=hitAt(p,o=>PTS.has(o.t));
    if(!pend.length&&hp==null){const cr=cornerAt(p);if(cr){setMark('amk',{a:cr[0],b:cr[1],c:cr[2]});return}return say('Bấm vào <b>phía trong một góc</b> (gần đỉnh) của tam giác/đa giác, hoặc bấm lần lượt 3 điểm A, O (đỉnh), B')}
    if(hp==null)return;if(pend.includes(hp))return;pend.push(hp);if(pend.length===3){setMark('amk',{a:pend[0],b:pend[1],c:pend[2]});pend=[]}return}
  if(T2==='smk'){const hp=hitAt(p,o=>PTS.has(o.t));
    if(!pend.length&&hp==null){const e=edgeAt(p);if(e){setMark('smk',{a:e[0],b:e[1]});return}return say('Bấm vào một <b>cạnh</b> (đoạn thẳng, cạnh đa giác), hoặc bấm 2 điểm đầu mút')}
    if(hp==null)return;if(pend.includes(hp))return;pend.push(hp);if(pend.length===2){setMark('smk',{a:pend[0],b:pend[1]});pend=[]}return}
  if(T2==='fill'){const fc=col==='#111827'?'#60a5fa':col,hp=hitAt(p,o=>PTS.has(o.t));
    if(!pend.length&&hp==null){const h=fillTarget(p);if(h!=null){const o=byId(h);if(o.t==='reg'){o.col=fc;o.fa=FST.a}else if(o.fill===fc&&(o.fa||.35)===FST.a){delete o.fill;delete o.fa;say('Đã bỏ tô màu')}else{o.fill=fc;o.fa=FST.a}inval();return}
      return say('Bấm vào <b>bên trong</b> một đa giác hoặc hình tròn để tô màu, hoặc bấm lần lượt các điểm (bấm lại điểm đầu) để tô một vùng')}
    if(hp==null)return;if(pend.length>=3&&hp===pend[0]){add({t:'reg',ps:pend.slice(),col:fc,fa:FST.a});pend=[];return}if(!pend.includes(hp))pend.push(hp);return}
  if(T2==='perp'||T2==='par'){const hp=hitAt(p,o=>PTS.has(o.t));let hl=hitAt(p,o=>isL(o.id));
    if(hl==null&&hp==null&&!pend.some(isL)){const e=edgeAt(p);if(e)hl=segOf(e)}
    if(hl!=null&&hp==null&&!pend.some(isL))pend.push(hl);else pend.push(pickPoint(p));
    const Ls=pend.find(isL),Pp=pend.find(isP);if(Ls!=null&&Pp!=null){add({t:T2,l:Ls,p:Pp});pend=[]}else if(pend.length>1)pend=[pend[pend.length-1]];return}
  if(T2==='int'){const h=hitAt(p,isCurve);if(h==null)return;if(pend[0]===h)return;pend.push(h);
    if(pend.length===2){const r=inter(geo(pend[0]),geo(pend[1]));let n=0;r.forEach((q,k)=>{if(q){add({t:'int',a:pend[0],b:pend[1],k});n++}});if(!n)say('Hai đường này hiện không cắt nhau');pend=[]}return}
  if(T2==='symP'){if(!pend.length){pend.push(pickPoint(p));return}const o=pickPoint(p);if(o!==pend[0])add({t:'sym',p:pend[0],o});pend=[];return}
  if(T2==='symL'){if(!pend.length){if(hitAt(p,o=>PTS.has(o.t))==null&&hitAt(p,o=>isL(o.id))!=null)return say('Hãy bấm vào điểm cần lấy đối xứng trước, sau đó mới bấm trục');pend.push(pickPoint(p));return}
    const hl=hitAt(p,o=>isL(o.id));if(hl==null)return say('⚠️ Hãy bấm vào một đường thẳng (đoạn thẳng, tia…) làm trục đối xứng');add({t:'sym',p:pend[0],o:hl});pend=[];return}
  if(T2.startsWith('ctr')){const kd=T2[3],NM={G:'G',O:'O',H:'H',I:'I'}[kd],nmOk=!Pg().objs.some(o=>o.n===NM);
    const mk=(a,b,c2)=>{const id=add({t:'ctr',kd,a,b,c:c2,n:nmOk?NM:undefined});if(!geo(id))say('⚠️ Ba điểm thẳng hàng – không tạo được tam giác');return id};
    if(!pend.length&&hitAt(p,o=>PTS.has(o.t))==null){const hp=hitAt(p,o=>o.t==='poly'&&o.ps.length===3);if(hp!=null){const q=byId(hp).ps;mk(q[0],q[1],q[2]);return}}
    const id=pickPoint(p);if(pend.includes(id))return;pend.push(id);if(pend.length===3){mk(...pend);pend=[]}return}
  if(T2==='sym'){if(!pend.length){pend.push(pickPoint(p));return}const hp=hitAt(p,o=>PTS.has(o.t)),hl=hitAt(p,o=>isL(o.id));
    const o=hp!=null?hp:hl!=null?hl:pickPoint(p);if(o!==pend[0])add({t:'sym',p:pend[0],o});pend=[];return}
  if(T2==='area'){const h=hitAt(p,o=>isK(o.id,'G')||isK(o.id,'C'));if(h!=null)add({t:'area',o:h});else say('Hãy bấm vào một đa giác hoặc đường tròn');return}
}
function demo(){goPage(pi);if(Pg().objs.length){pages.splice(pi+1,0,newPage());goPage(pi+1)}
  txn(()=>{const A=add({t:'pt',x:-3.5,y:-2}),B=add({t:'pt',x:3,y:-2}),C=add({t:'pt',x:0.8,y:3});add({t:'poly',ps:[A,B,C],col:'#2563eb'});
    const d1=add({t:'tt',a:A,b:B,col:'#9333ea'}),d2=add({t:'tt',a:B,b:C,col:'#9333ea'});const O=add({t:'int',a:d1,b:d2,k:0});add({t:'circ',c:O,p:A,col:'#e11d48'});
    add({t:'ang',a:B,b:C,c:A,col:'#16a34a'});add({t:'text',x:-6.4,y:6.3,s:'Đường tròn ngoại tiếp tam giác – kéo A, B, C để quan sát!',size:22,col:'#111827'})});
  setTool('sel');say('🎬 Hai đường trung trực cắt nhau tại tâm đường tròn ngoại tiếp. Hãy kéo các điểm A, B, C!')}

/* ---------- Vẽ ---------- */
const cm=cc=>bg==='den'?(cc==='#111827'?'#f8fafc':cc==='#ffffff'?'#111827':cc==='#1d4ed8'||cc==='#2563eb'?'#93c5fd':cc==='#9333ea'?'#d8b4fe':cc):cc;
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function pill(s,X,Y,cc){ctx.save();ctx.font='bold 15px Segoe UI,Arial';const w=ctx.measureText(s).width+14,h=24;ctx.fillStyle=bg==='den'?'#0b1f17ee':'#ffffffee';ctx.strokeStyle=cc;ctx.lineWidth=1.5;rr(X-w/2,Y-h/2,w,h,7);ctx.fill();ctx.stroke();
  ctx.fillStyle=cc;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,X,Y+1);ctx.restore();return [X-w/2,Y-h/2,w,h]}
function drawBg(clean){const dark=bg==='den';
  if(dark){const g=ctx.createRadialGradient(W/2,H/2,100,W/2,H/2,800);g.addColorStop(0,'#24493a');g.addColorStop(1,'#16332a');ctx.fillStyle=g}else ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);if(is3())return;
  const gs=gstep(),s=sc(),[x0,y1]=Wd(0,0),[x1,y0]=Wd(W,H);
  const grid=(st,cc,lw)=>{ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=lw;ctx.beginPath();for(let x=Math.ceil(x0/st)*st;x<=x1;x+=st){const X=Math.round(S(x,0)[0])+.5;ctx.moveTo(X,0);ctx.lineTo(X,H)}
    for(let y=Math.ceil(y0/st)*st;y<=y1;y+=st){const Y=Math.round(S(0,y)[1])+.5;ctx.moveTo(0,Y);ctx.lineTo(W,Y)}ctx.stroke();ctx.restore()};
  if(bg==='luoi'){grid(gs/2,'#f1f3f8',1);grid(gs,'#dfe3ec',1)}
  if(bg==='oli'){grid(gs/4,'#dbe7fb',1);grid(gs,'#8fb0e8',1.2)}
  if(showAx){const [OX,OY]=S(0,0),ac=dark?'#e2e8f0':'#475569';ctx.save();line(ctx,0,OY,W,OY,ac,1.4);line(ctx,OX,H,OX,0,ac,1.4);
    ctx.fillStyle=ac;ctx.beginPath();ctx.moveTo(W,OY);ctx.lineTo(W-11,OY-5);ctx.lineTo(W-11,OY+5);ctx.fill();ctx.beginPath();ctx.moveTo(OX,0);ctx.lineTo(OX-5,11);ctx.lineTo(OX+5,11);ctx.fill();
    ctx.font='12px Segoe UI,Arial';ctx.textAlign='center';ctx.textBaseline='top';const ty=Math.min(H-16,Math.max(2,OY+4));
    for(let x=Math.ceil(x0/gs)*gs;x<=x1;x+=gs){if(Math.abs(x)<gs/2)continue;const X=S(x,0)[0];line(ctx,X,OY-3,X,OY+3,ac,1);ctx.fillText(fmt(x,2),X,ty)}
    ctx.textAlign='right';ctx.textBaseline='middle';const tx=Math.max(26,Math.min(W-4,OX-5));
    for(let y=Math.ceil(y0/gs)*gs;y<=y1;y+=gs){if(Math.abs(y)<gs/2)continue;const Y=S(0,y)[1];line(ctx,OX-3,Y,OX+3,Y,ac,1);ctx.fillText(fmt(y,2),tx,Y)}
    ctx.font='bold 15px Segoe UI';ctx.textAlign='left';ctx.fillText('x',W-14,OY-14);ctx.fillText('y',OX+8,10);ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('O',OX-4,OY+3);ctx.restore()}}
function inkPath(q){ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);if(q.length===1){ctx.lineTo(q[0][0]+0.1,q[0][1]);return}
  for(let i=1;i<q.length-1;i++){const mx=(q[i][0]+q[i+1][0])/2,my=(q[i][1]+q[i+1][1])/2;ctx.quadraticCurveTo(q[i][0],q[i][1],mx,my)}const z=q[q.length-1];ctx.lineTo(z[0],z[1])}
function lineEnds(g){let [x1,y1]=S(g.l[0],g.l[1]),[x2,y2]=S(g.l[2],g.l[3]);const L=Math.hypot(x2-x1,y2-y1)||1,ux=(x2-x1)/L,uy=(y2-y1)/L,E=6000;
  if(g.kind==='line'){x1-=ux*E;y1-=uy*E;x2+=ux*E;y2+=uy*E}else if(g.kind==='ray'){x2=x1+ux*E;y2=y1+uy*E}return [x1,y1,x2,y2]}
const imgEl={};function imgOf(key){if(imgEl[key])return imgEl[key];const src=(Pg().imgs||{})[key]||allImg(key);if(!src)return null;const im=new Image();im.onload=()=>{D()};im.src=src;imgEl[key]=im;return im}
function allImg(key){for(const pg of pages)if(pg.imgs&&pg.imgs[key])return pg.imgs[key];return null}
function shape(o,g,cc,lw,under){ // vẽ hình dạng (dùng cho cả viền nổi bật)
  if(o.t==='img'){const [X,Y]=S(o.x,o.y),w=o.w*sc(),h=o.h*sc();ctx.save();if(under){ctx.strokeStyle=cc;ctx.lineWidth=Math.min(6,lw/2);ctx.strokeRect(X-2,Y-2,w+4,h+4);
      if(sel===o.id&&!o.lock){ctx.fillStyle='#fff';ctx.strokeStyle='#f59e0b';ctx.lineWidth=2;ctx.fillRect(X+w-7,Y+h-7,14,14);ctx.strokeRect(X+w-7,Y+h-7,14,14)}}
    else{const im=imgOf(o.key);if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,X,Y,w,h);else{ctx.strokeStyle='#94a3b8';ctx.setLineDash([6,4]);ctx.strokeRect(X,Y,w,h)}}ctx.restore();return}
  ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=lw;ctx.lineCap=ctx.lineJoin='round';
  if(o.t==='ink'){const q=o.pts.map(a=>S(a[0],a[1]));if(o.hl&&!under){ctx.globalAlpha=.38;ctx.lineCap='square'}inkPath(q);ctx.stroke()}
  else if(o.t==='text'){const [X,Y]=S(o.x,o.y),fs=o.size*V().z;ctx.font=fs+'px Segoe UI,Arial';ctx.textBaseline='top';if(under){const w=ctx.measureText(o.s).width;ctx.globalAlpha=.3;ctx.fillStyle=cc;rr(X-5,Y-4,w+10,fs*1.25+8,6);ctx.fill()}else{ctx.fillStyle=cc;ctx.fillText(o.s,X,Y)}}
  else if(g.k==='L'){const e=lineEnds(g);ctx.beginPath();ctx.moveTo(e[0],e[1]);ctx.lineTo(e[2],e[3]);ctx.stroke()}
  else if(g.k==='C'){const [X,Y]=S(g.cx,g.cy);ctx.beginPath();ctx.arc(X,Y,g.r*sc(),0,7);ctx.stroke()}
  else if(g.k==='G'){const q=g.p.map(a=>S(a[0],a[1]));ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath();
    ctx.stroke();
    if(!under&&o.ra)o.ra.forEach(i=>{const n=q.length,b=q[i],u1=un(q[(i+1)%n][0]-b[0],q[(i+1)%n][1]-b[1]),u2=un(q[(i-1+n)%n][0]-b[0],q[(i-1+n)%n][1]-b[1]);if(!u1||!u2)return;const m=13;
      ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(b[0]+u1[0]*m,b[1]+u1[1]*m);ctx.lineTo(b[0]+(u1[0]+u2[0])*m,b[1]+(u1[1]+u2[1])*m);ctx.lineTo(b[0]+u2[0]*m,b[1]+u2[1]*m);ctx.stroke()});
    if(!under&&o.tk)o.tk.forEach((n,i)=>{if(!n)return;const a=q[i],b=q[(i+1)%q.length],u=un(b[0]-a[0],b[1]-a[1]);if(!u)return;const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;ctx.lineWidth=2.2;
      for(let j=0;j<n;j++){const off=(j-(n-1)/2)*6;ctx.beginPath();ctx.moveTo(mx+u[0]*off-u[1]*8,my+u[1]*off+u[0]*8);ctx.lineTo(mx+u[0]*off+u[1]*8,my+u[1]*off-u[0]*8);ctx.stroke()}})}
  else if(g.k==='F'){ctx.beginPath();let pen=false,py=null;for(let X=0;X<=W;X+=2){const x=Wd(X,0)[0],y=g.f(x);if(!isFinite(y)){pen=false;continue}const Y=S(0,y)[1];
      if(Math.abs(Y)>4*H||(py!=null&&Math.abs(Y-py)>H)){pen=false;py=Y;continue}if(pen)ctx.lineTo(X,Y);else ctx.moveTo(X,Y);pen=true;py=Y}ctx.stroke()}
  else if(g.k==='P'){ctx.beginPath();ctx.arc(...S(g.x,g.y),under?11:5,0,7);ctx.fillStyle=cc;if(under)ctx.globalAlpha=.45;ctx.fill()}
  ctx.restore()}
function perpMark(o,g,cc){const h=geo(o.l);if(!h)return;const p=need(o.p),[x1,y1,x2,y2]=h.l,dx=x2-x1,dy=y2-y1,u=((p.x-x1)*dx+(p.y-y1)*dy)/(dx*dx+dy*dy);
  const F=S(x1+u*dx,y1+u*dy),A=S(x1,y1),B=S(x2,y2),u1=un(B[0]-A[0],B[1]-A[1]),u2=[-u1[1],u1[0]],s=10;
  ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(F[0]+u1[0]*s,F[1]+u1[1]*s);ctx.lineTo(F[0]+u1[0]*s+u2[0]*s,F[1]+u1[1]*s+u2[1]*s);ctx.lineTo(F[0]+u2[0]*s,F[1]+u2[1]*s);ctx.stroke();ctx.restore()}
function footMark(o,g,cc){const B=S(...xy(o.b)),C=S(...xy(o.c)),A=S(g.l[0],g.l[1]),F=S(g.l[2],g.l[3]);ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=1.6;
  if(o.t==='cao'){const u1=un(C[0]-B[0],C[1]-B[1]),u2=un(A[0]-F[0],A[1]-F[1]);if(u1&&u2){const s=11,sg=((A[0]-F[0])*0+1);ctx.beginPath();ctx.moveTo(F[0]+u1[0]*s,F[1]+u1[1]*s);ctx.lineTo(F[0]+(u1[0]+u2[0])*s,F[1]+(u1[1]+u2[1])*s);ctx.lineTo(F[0]+u2[0]*s,F[1]+u2[1]*s);ctx.stroke()}
    if(g.u<0||g.u>1){const E=g.u<0?B:C;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(E[0],E[1]);ctx.lineTo(F[0],F[1]);ctx.stroke()}}
  else{const u=un(C[0]-B[0],C[1]-B[1]);if(u)[[B,F],[F,C]].forEach(([P,Q])=>{const mx=(P[0]+Q[0])/2,my=(P[1]+Q[1])/2;ctx.beginPath();ctx.moveTo(mx-u[1]*7,my+u[0]*7);ctx.lineTo(mx+u[1]*7,my-u[0]*7);ctx.stroke()})}
  ctx.restore()}
const xy=id=>{const q=need(id);return [q.x,q.y]};
const nm=id=>(byId(id)||{}).n||'?';
function measure(o,cc){lbBox.delete(o.id);
  if(o.t==='dist'){const a=need(o.a),b=need(o.b),[X1,Y1]=S(a.x,a.y),[X2,Y2]=S(b.x,b.y),n=un(-(Y2-Y1),X2-X1)||[0,-1];
    line(ctx,X1,Y1,X2,Y2,cc,1.2,[5,4]);const s=nm(o.a)+nm(o.b)+' = '+fmt(Math.hypot(a.x-b.x,a.y-b.y),2);lbBox.set(o.id,pill(s,(X1+X2)/2+n[0]*18*(n[1]>0?-1:1),(Y1+Y2)/2+n[1]*18*(n[1]>0?-1:1),cc))}
  if(o.t==='ang'){const A=need(o.a),B=need(o.b),C=need(o.c),[XB,YB]=S(B.x,B.y),[XA,YA]=S(A.x,A.y),[XC,YC]=S(C.x,C.y);
    const u1=un(XA-XB,YA-YB),u2=un(XC-XB,YC-YB);if(!u1||!u2)return;const deg=Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1])))*180/Math.PI,r=30;
    ctx.save();ctx.strokeStyle=cc;ctx.fillStyle=cc;ctx.lineWidth=2;
    if(Math.abs(deg-90)<0.05){const s=16;ctx.beginPath();ctx.moveTo(XB+u1[0]*s,YB+u1[1]*s);ctx.lineTo(XB+(u1[0]+u2[0])*s,YB+(u1[1]+u2[1])*s);ctx.lineTo(XB+u2[0]*s,YB+u2[1]*s);ctx.stroke();ctx.globalAlpha=.18;ctx.lineTo(XB,YB);ctx.fill()}
    else{const a1=Math.atan2(u1[1],u1[0]);let d=Math.atan2(u2[1],u2[0])-a1;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
      ctx.beginPath();ctx.arc(XB,YB,r,a1,a1+d,d<0);ctx.stroke();ctx.globalAlpha=.18;ctx.lineTo(XB,YB);ctx.closePath();ctx.fill()}
    ctx.restore();let bx=u1[0]+u2[0],by=u1[1]+u2[1];const bu=un(bx,by)||[-u1[1],u1[0]];
    lbBox.set(o.id,pill(o.sh?'∠'+nm(o.b)+' = '+fmt(deg,1)+'°':'∠'+nm(o.a)+nm(o.b)+nm(o.c)+' = '+fmt(deg,1)+'°',XB+bu[0]*(o.sh?70:62),YB+bu[1]*(o.sh?62:44),cc))}
  if(o.t==='area'){const g=geo(o.o);if(!g)return;let s,X,Y;
    if(g.k==='G'){let A2=0,Pm=0,cx=0,cy=0;const q=g.p;for(let i=0;i<q.length;i++){const j=(i+1)%q.length;A2+=q[i][0]*q[j][1]-q[j][0]*q[i][1];Pm+=Math.hypot(q[j][0]-q[i][0],q[j][1]-q[i][1]);cx+=q[i][0];cy+=q[i][1]}
      [X,Y]=S(cx/q.length,cy/q.length);s='Chu vi = '+fmt(Pm,2)+'  ·  S = '+fmt(Math.abs(A2)/2,2)}
    else{[X,Y]=S(g.cx,g.cy);Y+=28;s='C = '+fmt(2*Math.PI*g.r,2)+'  ·  S = '+fmt(Math.PI*g.r*g.r,2)}
    lbBox.set(o.id,pill(s,X,Y,cc))}}
function drawPt(o,g){const [X,Y]=S(g.x,g.y),free=o.t==='pt'||o.t==='3pt',on=!free&&canDrag(o),dark=bg==='den';
  ctx.save();ctx.beginPath();ctx.arc(X,Y,free||on?5.5:4.5,0,7);ctx.fillStyle=free?'#2563eb':on?'#38bdf8':(dark?'#e5e7eb':'#374151');ctx.fill();ctx.lineWidth=1.8;ctx.strokeStyle=dark?'#16332a':'#fff';ctx.stroke();
  if(showLb&&o.n){ctx.font='bold 17px Segoe UI,Arial';ctx.textBaseline='bottom';ctx.lineWidth=4;ctx.strokeStyle=dark?'#16332a':'#ffffff';ctx.strokeText(o.n,X+7,Y-5);ctx.fillStyle=dark?'#f8fafc':(o.col&&o.col!=='#111827'&&o.col!=='#ffffff'?o.col:'#1e293b');ctx.fillText(o.n,X+7,Y-5)}ctx.restore()}
const amkR=o=>o.st==='r'?18:o.st==='2'?32:o.st==='3'?38:28;
function drawAmk(o,cc){const A=need(o.a),B=need(o.b),C=need(o.c),[XB,YB]=S(B.x,B.y),[XA,YA]=S(A.x,A.y),[XC,YC]=S(C.x,C.y);const u1=un(XA-XB,YA-YB),u2=un(XC-XB,YC-YB);if(!u1||!u2)return;
  const a1=Math.atan2(u1[1],u1[0]);let d=Math.atan2(u2[1],u2[0])-a1;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;if(Math.abs(d)<0.02||Math.abs(Math.abs(d)-Math.PI)<0.02)return;
  const on=sel===o.id;ctx.save();ctx.strokeStyle=on?'#f59e0b':cc;ctx.fillStyle=cc;ctx.lineWidth=on?3.4:2.2;ctx.lineCap='round';
  if(o.st==='r'){const s=amkR(o);ctx.beginPath();ctx.moveTo(XB+u1[0]*s,YB+u1[1]*s);ctx.lineTo(XB+(u1[0]+u2[0])*s,YB+(u1[1]+u2[1])*s);ctx.lineTo(XB+u2[0]*s,YB+u2[1]*s);ctx.stroke();
    if(o.fl){ctx.globalAlpha=.22;ctx.lineTo(XB,YB);ctx.closePath();ctx.fill()}ctx.restore();return}
  const n=o.st==='2'?2:o.st==='3'?3:1,R0=amkR(o);
  if(o.fl){ctx.save();ctx.globalAlpha=.22;ctx.beginPath();ctx.moveTo(XB,YB);ctx.arc(XB,YB,R0,a1,a1+d,d<0);ctx.closePath();ctx.fill();ctx.restore()}
  for(let i=0;i<n;i++){const r=R0-i*5;ctx.beginPath();ctx.arc(XB,YB,r,a1,a1+d,d<0);ctx.stroke()}
  if(o.st==='t'){const m=a1+d/2,c1=[Math.cos(m),Math.sin(m)];ctx.beginPath();ctx.moveTo(XB+c1[0]*(R0-7),YB+c1[1]*(R0-7));ctx.lineTo(XB+c1[0]*(R0+7),YB+c1[1]*(R0+7));ctx.stroke()}
  ctx.restore()}
function drawSmk(o,cc){const A=need(o.a),B=need(o.b),[X1,Y1]=S(A.x,A.y),[X2,Y2]=S(B.x,B.y),u=un(X2-X1,Y2-Y1);if(!u)return;const mx=(X1+X2)/2,my=(Y1+Y2)/2,nv=[-u[1],u[0]];
  const on=sel===o.id;ctx.save();ctx.strokeStyle=on?'#f59e0b':cc;ctx.lineWidth=on?3.2:2.3;ctx.lineCap='round';ctx.lineJoin='round';
  if(o.st==='>'||o.st==='>>'){const n=o.st==='>'?1:2;for(let j=0;j<n;j++){const off=(j-(n-1)/2)*8,tx=mx+u[0]*(off+4),ty=my+u[1]*(off+4);ctx.beginPath();ctx.moveTo(tx-u[0]*8+nv[0]*7,ty-u[1]*8+nv[1]*7);ctx.lineTo(tx,ty);ctx.lineTo(tx-u[0]*8-nv[0]*7,ty-u[1]*8-nv[1]*7);ctx.stroke()}}
  else{const n=o.st==='2'?2:o.st==='3'?3:1;for(let j=0;j<n;j++){const off=(j-(n-1)/2)*6;ctx.beginPath();ctx.moveTo(mx+u[0]*off+nv[0]*8,my+u[1]*off+nv[1]*8);ctx.lineTo(mx+u[0]*off-nv[0]*8,my+u[1]*off-nv[1]*8);ctx.stroke()}}
  ctx.restore()}
function fillShape(g,fc,fa){ctx.save();ctx.globalAlpha=fa;ctx.fillStyle=fc;ctx.beginPath();if(g.k==='G'){g.p.map(a=>S(a[0],a[1])).forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath()}else if(g.k==='C'){const [X,Y]=S(g.cx,g.cy);ctx.arc(X,Y,g.r*sc(),0,7)}ctx.fill();ctx.restore()}
function draw(clean){inval();drawBg(clean);const os=Pg().objs,now=performance.now();
  const marks=id=>{if(clean)return;const o=byId(id);if(!o)return;const g=geo(id);if(!g&&o.t!=='ink'&&o.t!=='text')return;
    if(sel===id)shape(o,g,'#f59e0b',(o.t==='ink'?o.w*V().z:3)+9,true);
    else if(hov===id&&!['pen','hl','smart','laser','text','pan'].includes(tool))shape(o,g,tool==='erase'?'#ef4444':'#818cf8',(o.t==='ink'?o.w*V().z:3)+7,true);
    if(pend.includes(id))shape(o,g,'#22c55e',(o.t==='ink'?o.w*V().z:3)+8,true);
    const f=flash.get(id);if(f!=null){const k=1-(now-f)/700;if(k<=0)flash.delete(id);else{ctx.save();ctx.globalAlpha=k;shape(o,g,'#22c55e',12,true);ctx.restore()}}};
  const MS=['ang','dist','area'];
  const each=(test,fn)=>{for(const o of os){if(!test(o))continue;if(o.hid){if(clean||!showHid){lbBox.delete(o.id);continue}ctx.save();ctx.globalAlpha=.28;try{fn(o)}finally{ctx.restore()}}else fn(o)}};
  each(o=>o.t==='img',o=>{shape(o,null,'',1);marks(o.id)});
  each(o=>o.t==='reg'||o.t==='cpy'||(o.fill&&o.t[0]!=='3'),o=>{const g=geo(o.id);if(!g||!(g.k==='G'||g.k==='C'))return;let f=o;if(o.t==='cpy'&&!o.fill){f=byId(o.o);while(f&&f.t==='cpy'&&!f.fill)f=byId(f.o)}if(!f)return;const fc=f.t==='reg'?f.col:f.fill;if(fc)fillShape(g,cm(fc),f.fa||.35);else if(o.t==='cpy')fillShape(g,'#93c5fd',.15)});
  if(is3())draw3d(clean,marks);
  each(o=>!PTS.has(o.t)&&!MS.includes(o.t)&&o.t[0]!=='3'&&o.t!=='img',o=>{marks(o.id);
    if(o.t==='ink'){shape(o,null,cm(o.col),o.w*V().z);return}if(o.t==='text'){shape(o,null,cm(o.col),1);return}
    const g=geo(o.id);if(!g)return;if(o.t==='reg')return;if(o.t==='amk'||o.t==='smk'){try{(o.t==='amk'?drawAmk:drawSmk)(o,cm(o.col))}catch(e){}return}shape(o,g,cm(o.col),o.t==='fn'?2.6:2.4);if(o.t==='cpy')try{cpyDeco(o,g)}catch(e){}if(o.t==='perp')perpMark(o,g,cm(o.col));if(o.t==='cao'||o.t==='tuyen')try{footMark(o,g,cm(o.col))}catch(e){}});
  each(o=>MS.includes(o.t),o=>{marks(o.id);if(geo(o.id))try{measure(o,o.col==='#111827'?(bg==='den'?'#5eead4':'#0f766e'):cm(o.col))}catch(e){}});
  each(o=>PTS.has(o.t),o=>{marks(o.id);const g=geo(o.id);if(g){drawPt(o,g);if(o.t==='rat'&&!clean)try{ratDeco(o,g)}catch(e){}}});
  if(!clean){popUpd();syncRp()}
  if(!clean){
    // nét đang vẽ
    if(act&&act.k==='ink'){const q=act.scr;ctx.save();ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=cm(tool==='hl'?hlCol():col);ctx.lineWidth=tool==='hl'?hlW():wid;if(tool==='hl')ctx.globalAlpha=.38;if(tool==='smart')ctx.setLineDash([2,6]);inkPath(q);ctx.stroke();ctx.restore()}
    // xem trước khi dựng hình
    if(mouse&&pend.length&&!act){const M=mouse,pp=pend.filter(isP).map(id=>{const g=geo(id);return S(g.x,g.y)});ctx.save();ctx.strokeStyle='#6366f1';ctx.lineWidth=1.6;ctx.setLineDash([6,5]);
      if(tool==='circD'&&pp[0]){const mx=(pp[0][0]+M[0])/2,my=(pp[0][1]+M[1])/2;ctx.beginPath();ctx.arc(mx,my,Math.hypot(M[0]-pp[0][0],M[1]-pp[0][1])/2,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(pp[0][0],pp[0][1]);ctx.lineTo(M[0],M[1]);ctx.stroke()}
      else if(tool==='circ'&&pp[0]){ctx.beginPath();ctx.arc(pp[0][0],pp[0][1],Math.hypot(M[0]-pp[0][0],M[1]-pp[0][1]),0,7);ctx.stroke()}
      else if(['line','ray'].includes(tool)&&pp[0]){const g={l:[...Wd(...pp[0]),...Wd(...M)],kind:tool};if(Math.hypot(M[0]-pp[0][0],M[1]-pp[0][1])>2){const e=lineEnds(g);line(ctx,e[0],e[1],e[2],e[3],'#6366f1',1.6,[6,5])}}
      else if(tool==='segc'){if(pend.length===3){const g1=geo(pend[0]),g2=geo(pend[1]),gA=geo(pend[2]);if(g1&&g2&&gA){const L=Math.hypot(g2.x-g1.x,g2.y-g1.y)*sc(),A=S(gA.x,gA.y),d=un(M[0]-A[0],M[1]-A[1]);
          ctx.beginPath();ctx.arc(A[0],A[1],L,0,7);ctx.stroke();if(d){ctx.setLineDash([]);ctx.lineWidth=2.5;ctx.strokeStyle='#e11d48';ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(A[0]+d[0]*L,A[1]+d[1]*L);ctx.stroke();ctx.fillStyle='#e11d48';ctx.beginPath();ctx.arc(A[0]+d[0]*L,A[1]+d[1]*L,5,0,7);ctx.fill();
          ctx.font='bold 14px Segoe UI';ctx.fillText('= '+nm(pend[0])+nm(pend[1])+' = '+fmt(L/sc(),2),A[0]+d[0]*L+10,A[1]+d[1]*L-10)}}}
        else if(pp.length===2){ctx.setLineDash([]);ctx.lineWidth=5;ctx.strokeStyle='#22c55e88';ctx.beginPath();ctx.moveTo(pp[0][0],pp[0][1]);ctx.lineTo(pp[1][0],pp[1][1]);ctx.stroke()}}
      else if(['perp','par'].includes(tool)){const Ls=pend.find(isL);if(Ls!=null){const h=geo(Ls);let dx=h.l[2]-h.l[0],dy=h.l[3]-h.l[1];if(tool==='perp')[dx,dy]=[-dy,dx];const w=Wd(...M),e=lineEnds({l:[w[0],w[1],w[0]+dx,w[1]+dy],kind:'line'});line(ctx,e[0],e[1],e[2],e[3],'#6366f1',1.6,[6,5])}}
      else if(pp.length){ctx.beginPath();pp.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.lineTo(M[0],M[1]);if((tool==='poly'||tool==='fill')&&pp.length>=2)ctx.lineTo(pp[0][0],pp[0][1]);ctx.stroke()}
      ctx.restore()}
    if(mouse&&(tool==='tri'||tool==='quad')&&shp[tool]&&!act&&menu.style.display!=='block'){const q=shGeom(tool,shp[tool],...Wd(...mouse),shS()).map(a=>S(a[0],a[1]));
      ctx.save();ctx.strokeStyle='#6366f1';ctx.fillStyle='#6366f11a';ctx.lineWidth=1.6;ctx.setLineDash([6,5]);ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath();ctx.stroke();ctx.restore()}
    if(mouse&&tool==='circR'&&!act){const r=parseFloat(String(rIn.value).replace(',','.'));if(r>0){ctx.save();ctx.strokeStyle='#6366f1';ctx.setLineDash([6,5]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mouse[0],mouse[1],r*sc(),0,7);ctx.stroke();ctx.restore()}}
    if(lp){const g=geo(lp.id);if(g){const [X,Y]=S(g.x,g.y),k=Math.min(1,(now-lp.t0)/LPT);ctx.save();ctx.strokeStyle='#f59e0b';ctx.lineWidth=3.5;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(X,Y,14,-Math.PI/2,-Math.PI/2+k*2*Math.PI);ctx.stroke();ctx.restore()}}
    // laser
    laser=laser.filter(a=>now-a.t<900);if(laser.length){ctx.save();ctx.lineCap='round';
      for(let i=1;i<laser.length;i++){const a=laser[i-1],b=laser[i];if(b.brk)continue;const k=1-(now-b.t)/900;ctx.strokeStyle=`rgba(239,68,68,${k*0.9})`;ctx.shadowColor='#ef4444';ctx.shadowBlur=14;ctx.lineWidth=2+7*k;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.restore()}
    if(mouse&&tool==='laser'){ctx.save();ctx.fillStyle='#ef4444';ctx.shadowColor='#ef4444';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(mouse[0],mouse[1],7,0,7);ctx.fill();ctx.restore()}
    if(mouse&&tool==='erase'){ctx.save();ctx.strokeStyle='#64748b';ctx.fillStyle='#f1f5f966';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mouse[0],mouse[1],13,0,7);ctx.fill();ctx.stroke();ctx.restore()}
  }
  status();if(showAlg)algebra()}
const hlCol=()=>col==='#111827'||col==='#ffffff'?'#facc15':col,hlW=()=>Math.max(14,wid*4);
let lastSt='';function status(){const h=(msg&&performance.now()-msgT<5000)?msg:(is3()&&tool==='sel'?'🧊 Kéo <b>sang trái/phải</b>: hình quay quanh <b>trục thẳng đứng</b> · kéo <b>lên/xuống</b>: hình nghiêng quanh <b>trục nằm ngang</b> (hoặc dùng 2 thanh trượt góc phải) · kéo điểm xanh để di chuyển (giữ <b>Shift</b> hoặc bật ↕ để kéo lên/xuống) · chuột phải để dời bảng · lăn chuột để phóng to':HINT[tool]);
  let r='';if(is3())r=`🧊 xoay ${Math.round(((cam().th%360)+360)%360)}° · nghiêng ${Math.round(cam().ph)}°  ·  `;else if(mouse){const [x,y]=Wd(...mouse);r=`x = ${fmt(x,2)} ; y = ${fmt(y,2)}  ·  `}r+=`thu phóng ${Math.round(V().z*100)}%`;
  const s=h+'|'+r+'|'+pi+'/'+pages.length;if(s===lastSt)return;lastSt=s;sbL.innerHTML='💡 '+h;sbL.title=sbL.textContent;sbR.textContent=r;pgLb.textContent=(pi+1)+' / '+pages.length}
const TN={eqp:'Điểm (đoạn bằng đoạn cho trước)',ft:'Chân đường cao',amk:'Kí hiệu góc',smk:'Kí hiệu cạnh',reg:'Vùng tô màu',img:'Ảnh',circD:'Đường tròn','3seg':'Đoạn thẳng','3poly':'Mặt','3cyl':'Hình trụ','3cone':'Hình nón','3sph':'Hình cầu','3dist':'Độ dài',tuyen:'Trung tuyến',cao:'Đường cao',ctr:'Điểm đặc biệt của tam giác',pd:'Đỉnh (trên đường song song)',mir:'Đỉnh (đối xứng)',par4:'Đỉnh (dựng)',rot:'Đỉnh (dựng)',ax:'Đỉnh (trên trục đối xứng)',pq:'Đỉnh (trên đường vuông góc)',pt:'Điểm',pon:'Điểm thuộc đường',mid:'Trung điểm',rat:'Điểm chia theo tỉ lệ',int:'Giao điểm',sym:'Điểm đối xứng',seg:'Đoạn thẳng',line:'Đường thẳng',ray:'Tia',perp:'Đường vuông góc',par:'Đường song song',tt:'Trung trực',pg:'Phân giác',circ:'Đường tròn',circR:'Đường tròn',circ3:'Đường tròn',poly:'Đa giác',ang:'Góc',dist:'Độ dài',area:'Diện tích',fn:'Đồ thị'};
let lastAlg='';function algebra(){const rows=[];
  for(const o of Pg().objs){if(o.t==='ink'||o.t==='text')continue;const g=geo(o.id);let s;
    if(!g)s=`${o.n||TN[o.t]||o.nm||o.t}: <i>không xác định</i>`;
    else if(g.p3)s=`<b>${o.n}</b> = (${fmt(g.p3[0],2)}; ${fmt(g.p3[1],2)}; ${fmt(g.p3[2],2)}) <i>${o.t==='3pt'?'Điểm':o.t==='3int'||o.t==='3int2'||o.t==='3intlp'?'Giao điểm':o.t==='3foot'||o.t==='3footp'?'Hình chiếu':o.t==='3onp'?'Điểm trên mặt phẳng':o.t==='3ons'?'Điểm trên mặt cầu':o.t==='3pol'?'Điểm trên đường':o.t==='3mid'?'Trung điểm':o.t==='3pon'?'Điểm trên cạnh':'Đỉnh'}</i>`;
    else if(LINE3.has(o.t))s=`${o.t==='3ray'?'Tia':'Đường thẳng'} ${o.a!=null&&o.b!=null?nm(o.a)+nm(o.b):o.t==='3parl'?'qua '+nm(o.p)+' ∥ '+lineTxt(o.ln):'qua '+nm(o.p)+' ⊥ mặt phẳng'}`;
    else if(PLANE3.has(o.t))s=`Mặt phẳng (${o.pn||''})${o.t==='3plane'?' ≡ ('+nm(o.a)+nm(o.b)+nm(o.c)+')':o.t==='3ppar'?' qua '+nm(o.p)+', song song':o.t==='3pperp'?' qua '+nm(o.p)+' ⊥ '+lineTxt(o.ln):o.t==='3pparl'?' chứa '+lineTxt(o.l1)+' ∥ '+lineTxt(o.l2):' chứa '+lineTxt(o.ln)+', vuông góc'}`;
    else if(o.t==='3seg'||o.t==='3dist')s=`Đoạn ${nm(o.a)}${nm(o.b)} = ${fmt(len3(sub3(g.A,g.B)),2)}`;
    else if(o.t==='3solid')s=`${o.nm} ${o.ps.map(nm).join('')}`;
    else if(o.t==='3poly')s=`Mặt (${o.ps.map(nm).join('')})`;
    else if(o.t==='3cyl'||o.t==='3cone')s=`${o.t==='3cyl'?'Hình trụ':'Hình nón'}: r = ${fmt(g.r,2)}, h = ${fmt(Math.abs(g.T[2]-g.C[2]),2)}, V = ${fmt(solidVol(o,g),2)}`;
    else if(o.t==='3sph')s=`Hình cầu: R = ${fmt(g.r,2)}, V = ${fmt(solidVol(o,g),2)}`;
    else if(g.k==='P')s=`<b>${o.n}</b> = (${fmt(g.x,2)}; ${fmt(g.y,2)}) <i>${o.t==='ctr'?{G:'Trọng tâm',O:'Tâm đường tròn ngoại tiếp',H:'Trực tâm',I:'Tâm đường tròn nội tiếp'}[o.kd]:TN[o.t]}</i>`;
    else if(o.t==='seg')s=`Đoạn ${nm(o.a)}${nm(o.b)} = ${fmt(Math.hypot(g.l[2]-g.l[0],g.l[3]-g.l[1]),2)}`;
    else if(o.t==='tuyen'||o.t==='cao')s=`${TN[o.t]} kẻ từ ${nm(o.a)} = ${fmt(Math.hypot(g.l[2]-g.l[0],g.l[3]-g.l[1]),2)}`;
    else if(['line','ray','tt'].includes(o.t))s=`${TN[o.t]} ${nm(o.a)}${nm(o.b)}`;
    else if(o.t==='perp'||o.t==='par')s=`${TN[o.t]} qua ${nm(o.p)}`;
    else if(o.t==='pg')s=`Phân giác góc ${nm(o.a)}${nm(o.b)}${nm(o.c)}`;
    else if(g.k==='C')s=`Đường tròn tâm (${fmt(g.cx,2)}; ${fmt(g.cy,2)}), r = ${fmt(g.r,2)}`;
    else if(o.t==='poly')s=`${o.nm||'Đa giác'} ${o.ps.map(nm).join('')}${o.fill?' (tô màu)':''}`;
    else if(o.t==='fn')s=`y = ${o.ex}`;
    else if(o.t==='amk')s=`Kí hiệu góc ${nm(o.a)}${nm(o.b)}${nm(o.c)}`;else if(o.t==='smk')s=`Kí hiệu cạnh ${nm(o.a)}${nm(o.b)}`;else if(o.t==='reg')s=`Vùng tô màu ${o.ps.map(nm).join('')}`;
    else if(o.t==='ang'){const A=need(o.a),B=need(o.b),C=need(o.c),u1=un(A.x-B.x,A.y-B.y),u2=un(C.x-B.x,C.y-B.y);s=u1&&u2?`∠${nm(o.a)}${nm(o.b)}${nm(o.c)} = ${fmt(Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1])))*180/Math.PI,1)}°`:'Góc: không xác định'}
    else if(o.t==='dist'){const a=need(o.a),b=need(o.b);s=`${nm(o.a)}${nm(o.b)} = ${fmt(Math.hypot(a.x-b.x,a.y-b.y),2)}`}
    else s=TN[o.t]||o.t;
    rows.push(`<div data-id="${o.id}"${sel===o.id?' class="on"':''}${o.hid?' style="opacity:.5"':''}><span data-eye="1" title="${o.hid?'Hiện lại':'Ẩn'}" style="cursor:pointer">${o.hid?'🙈':'👁'}</span> <span style="color:${o.col==='#ffffff'?'#111':o.col}">■</span> ${s}</div>`)}
  const h='<h4>📋 Bảng đại số</h4>'+(rows.join('')||'<i>Chưa có đối tượng hình học</i>');if(h!==lastAlg){alg.innerHTML=h;lastAlg=h}}
alg.onclick=e=>{const d=e.target.closest('div[data-id]');if(!d)return;const id=+d.dataset.id;if(e.target.closest('[data-eye]')){toggleHide(id);return}sel=id;selAt=null;D()};

/* ---------- KHÔNG GIAN 3D (kiểu GeoGebra 3D) ---------- */
const P3T=new Set(['3pt','3pon','3mid','3tr','3par4','3sqv','3up','3vert','3apex','3int','3pol','3foot','3footp','3onp','3ons','3int2','3intlp']);
let vertMode=false,autoRot=false;
const is3=()=>Pg().mode==='3d';
const cam=()=>Pg().cam||(Pg().cam={th:-125,ph:22});
const rad=a=>a*Math.PI/180;
function basis(){const t=rad(cam().th),f=rad(cam().ph);return {ex:[Math.cos(t),-Math.sin(t),0],ey:[Math.sin(t)*Math.sin(f),Math.cos(t)*Math.sin(f),Math.cos(f)],v:[-Math.sin(t)*Math.cos(f),-Math.cos(t)*Math.cos(f),Math.sin(f)]}}
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul3=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const crs3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len3=a=>Math.hypot(a[0],a[1],a[2]),lerp3=(a,b,u)=>add3(a,mul3(sub3(b,a),u));
function prj(P){const B=basis();return [dot3(P,B.ex),dot3(P,B.ey),dot3(P,B.v)]}
function q3(id){const g=geo(id);if(!g||!g.p3)throw 0;return g.p3}
function calc3(o){const t=o.t;let P;{const X=calcExt(o);if(X!==null)return X}
  if(t==='3pt')P=[o.x,o.y,o.z];
  else if(t==='3pon')P=lerp3(q3(o.a),q3(o.b),o.u);
  else if(t==='3mid')P=lerp3(q3(o.a),q3(o.b),.5);
  else if(t==='3tr')P=add3(q3(o.p),sub3(q3(o.b),q3(o.a)));
  else if(t==='3par4')P=sub3(add3(q3(o.a),q3(o.c)),q3(o.b));
  else if(t==='3sqv'){const A=q3(o.a),B=q3(o.b),ux=B[0]-A[0],uy=B[1]-A[1],bs=o.s?B:A;P=[bs[0]-uy*o.k,bs[1]+ux*o.k,bs[2]]}
  else if(t==='3up'){const p=q3(o.p);P=[p[0],p[1],p[2]+len3(sub3(q3(o.b),q3(o.a)))]}
  else if(t==='3vert'){const p=q3(o.p);P=[p[0],p[1],p[2]+o.h]}
  else if(t==='3apex'){const Q=o.ps.map(q3),c=mul3(Q.reduce(add3),1/Q.length);P=[c[0],c[1],c[2]+o.h]}
  else if(t==='3int'){const A=q3(o.a),B=q3(o.b),C=q3(o.c),Dp=q3(o.d),d1=sub3(B,A),d2=sub3(Dp,C),w=sub3(A,C),a=dot3(d1,d1),b=dot3(d1,d2),c2=dot3(d2,d2),d=dot3(d1,w),e=dot3(d2,w),den=a*c2-b*b;
    if(Math.abs(den)<1e-10*a*c2)return;const s=(b*e-c2*d)/den,u=(a*e-b*d)/den,P1=add3(A,mul3(d1,s)),P2=add3(C,mul3(d2,u));if(len3(sub3(P1,P2))>1e-4*(1+Math.sqrt(a)+Math.sqrt(c2)))return;P=lerp3(P1,P2,.5);
    const r=prj(P);return {k:'P',x:r[0],y:r[1],p3:P,ext:[s,u]}}
  if(P){if(!P.every(isFinite))return;const r=prj(P);return {k:'P',x:r[0],y:r[1],p3:P}}
  if(t==='3seg'||t==='3dist'){const A=q3(o.a),B=q3(o.b),a=prj(A),b=prj(B);if(len3(sub3(A,B))<1e-9)return;return {k:'L',kind:'seg',l:[a[0],a[1],b[0],b[1]],A,B}}
  if(t==='3poly'){const Q=o.ps.map(q3);return {k:'G',p:Q.map(q=>{const r=prj(q);return [r[0],r[1]]}),P3:Q}}
  if(t==='3solid')return {k:'S3',P3:o.ps.map(q3)};
  if(t==='3cyl'||t==='3cone'||t==='3sph'){const C=q3(o.c),Pp=q3(o.p),T=o.top!=null?q3(o.top):null,r=t==='3sph'?len3(sub3(Pp,C)):Math.hypot(Pp[0]-C[0],Pp[1]-C[1]);if(r<1e-6)return;return {k:'S3',C,r,T}}
  return {k:'X'}}
function hit3(o,g,p){if(o.t==='3solid'){const Q=g.P3.map(q=>{const r=prj(q);return S(r[0],r[1])});let m=1e9;for(const [i,j] of o.e)m=Math.min(m,dSeg(p[0],p[1],Q[i][0],Q[i][1],Q[j][0],Q[j][1]));return m}
  const c=prj(g.C),[X,Y]=S(c[0],c[1]),d=Math.hypot(p[0]-X,p[1]-Y);return d<g.r*sc()?Math.min(7,Math.abs(d-g.r*sc())):1e9}
function ground(p,z0=0){const B=basis(),[X,Y]=Wd(p[0],p[1]),f=rad(cam().ph),sf=Math.sin(f);let D=Math.abs(sf)<0.08?0:(z0-Y*Math.cos(f))/sf;
  let P=add3(add3(mul3(B.ex,X),mul3(B.ey,Y)),mul3(B.v,D));if(Math.abs(sf)>=0.08)P[2]=z0;
  if(snapOn){P[0]=Math.round(P[0]*2)/2;P[1]=Math.round(P[1]*2)/2;P[2]=Math.round(P[2]*2)/2}return P.map(z=>+z.toFixed(3))}
function edges3(){const L=[];for(const o of Pg().objs){if(!vis(o))continue;
  if(o.t==='3seg')L.push([o.a,o.b]);else if(o.t==='3solid')o.e.forEach(([i,j])=>L.push([o.ps[i],o.ps[j]]));else if(o.t==='3poly')o.ps.forEach((a,i)=>L.push([a,o.ps[(i+1)%o.ps.length]]))}return L}
function edge3At(p){let best=null,bd=8;for(const e of edges3()){const A=geo(e[0]),B=geo(e[1]);if(!A||!B)continue;const [x1,y1]=S(A.x,A.y),[x2,y2]=S(B.x,B.y),d=dSeg(p[0],p[1],x1,y1,x2,y2);if(d<bd){bd=d;best=e}}return best}
const is3P=o=>P3T.has(o.t);
function pick3(p){const h=hitAt(p,is3P);if(h!=null&&hitDist(byId(h),p)<12)return h;
  const e=edge3At(p);if(e){const A=geo(e[0]),B=geo(e[1]),[X1,Y1]=S(A.x,A.y),[X2,Y2]=S(B.x,B.y);let u=cl01(((p[0]-X1)*(X2-X1)+(p[1]-Y1)*(Y2-Y1))/((X2-X1)**2+(Y2-Y1)**2||1));if(snapOn)u=Math.round(u*4)/4;return add({t:'3pon',a:e[0],b:e[1],u:+u.toFixed(4)})}
  const G=ground(p,0);return add({t:'3pt',x:G[0],y:G[1],z:G[2]})}
function nmP(n){return n&&!Pg().objs.some(o=>o.n===n)?n:nextName()}
const PR=n=>{const f=[[...Array(n).keys()],[...Array(n).keys()].map(i=>i+n)],e=[];for(let i=0;i<n;i++){const j=(i+1)%n;f.push([i,j,j+n,i+n]);e.push([i,j],[i+n,j+n],[i,i+n])}return {f,e}};
const PY=n=>{const f=[[...Array(n).keys()].map(i=>i+1)],e=[];for(let i=1;i<=n;i++){const j=i%n+1;f.push([0,i,j]);e.push([0,i],[i,j])}return {f,e}};
function makeSolid(k,cx,cy){const s=4.4/V().z,P=(x,y,z,n)=>add({t:'3pt',x:+(cx+x*s).toFixed(3),y:+(cy+y*s).toFixed(3),z:+(z*s).toFixed(3),n:nmP(n)}),X=(o,n)=>add(Object.assign(o,{n:nmP(n)}));
  const col3=col==='#111827'?'#1d4ed8':col,SO=(ps,fe,nm)=>add(Object.assign({t:'3solid',ps,nm,col:col3},fe));let ids;
  if(k==='tudien'){const A=P(0,-0.6,0,'A'),B=P(0.6,0.2,0,'B'),C=P(-0.35,0.7,0,'C'),Dd=P(0,0.05,0.9,'D');SO([Dd,A,B,C],PY(3),'Tứ diện');ids=[A,B,C,Dd]}
  else if(k==='choptg'){const S=P(-0.05,0.1,1,'S'),A=P(0,-0.6,0,'A'),B=P(0.6,0.2,0,'B'),C=P(-0.35,0.7,0,'C');SO([S,A,B,C],PY(3),'Hình chóp tam giác');ids=[S,A,B,C]}
  else if(k==='chopt'){const A=P(0.45,-0.55,0,'A'),B=P(0.45,0.6,0,'B'),C=P(-0.45,0.6,0,'C'),Dd=X({t:'3par4',a:A,b:B,c:C},'D'),S=P(0,0,1.3,'S');SO([S,A,B,C,Dd],PY(4),'Hình chóp tứ giác');ids=[S,A,B,C,Dd]}
  else if(k==='chopdeu'){const A=P(0.5,-0.5,0,'A'),B=P(0.5,0.5,0,'B'),C=X({t:'3sqv',a:A,b:B,k:1,s:1},'C'),Dd=X({t:'3sqv',a:A,b:B,k:1,s:0},'D'),S=X({t:'3apex',ps:[A,B,C,Dd],h:1.2*s},'S');SO([S,A,B,C,Dd],PY(4),'Hình chóp tứ giác đều');ids=[S,A,B,C,Dd]}
  else if(k==='langtru'){const A=P(0,-0.65,0,'A'),B=P(0.6,0.1,0,'B'),C=P(-0.3,0.65,0,'C'),A1=P(0,-0.65,0.9,"A'"),B1=X({t:'3tr',p:B,a:A,b:A1},"B'"),C1=X({t:'3tr',p:C,a:A,b:A1},"C'");SO([A,B,C,A1,B1,C1],PR(3),'Hình lăng trụ tam giác');ids=[A,B,C,A1]}
  else if(['hop','hhcn','lp'].includes(k)){let A,B,C,Dd,A1;
    if(k==='hop'){A=P(0.45,-0.6,0,'A');B=P(0.45,0.55,0,'B');C=P(-0.45,0.7,0,'C');Dd=X({t:'3par4',a:A,b:B,c:C},'D');A1=P(0.2,-0.5,0.8,"A'")}
    else{A=P(0.45,-0.6,0,'A');B=P(0.45,0.6,0,'B');C=X({t:'3sqv',a:A,b:B,k:k==='lp'?1:0.75,s:1},'C');Dd=X({t:'3sqv',a:A,b:B,k:k==='lp'?1:0.75,s:0},'D');A1=k==='lp'?X({t:'3up',p:A,a:A,b:B},"A'"):X({t:'3vert',p:A,h:0.7*s},"A'")}
    const B1=X({t:'3tr',p:B,a:A,b:A1},"B'"),C1=X({t:'3tr',p:C,a:A,b:A1},"C'"),D1=X({t:'3tr',p:Dd,a:A,b:A1},"D'");
    SO([A,B,C,Dd,A1,B1,C1,D1],PR(4),{hop:'Hình hộp',hhcn:'Hình hộp chữ nhật',lp:'Hình lập phương'}[k]);ids=[A,B,C,Dd]}
  else if(k==='tru'||k==='non'){const O=P(0,0,0,'O'),A=P(0,0.55,0,k==='tru'?'A':'A'),T=X({t:'3vert',p:O,h:(k==='tru'?1:1.2)*s},k==='tru'?"O'":'S');add({t:k==='tru'?'3cyl':'3cone',c:O,p:A,top:T,col:col3});ids=[O,A,T]}
  else if(k==='cau'){const O=P(0,0,0.6,'O'),A=P(0,0.6,0.6,'A');add({t:'3sph',c:O,p:A,col:col3});ids=[O,A]}
  return ids.map(i=>byId(i).n)}
function geoClick3(p){const T2=tool;if(['3on','3line','3ray','3perp','3par','3plane','3ppar','3pperp','3int'].includes(T2))return geoClickExt(p);
  if(T2==='3pt'){pick3(p);return}
  if(T2==='3xyz'){say('Nhập tọa độ ở bảng nhỏ góc trên bên trái rồi bấm “Tạo điểm”');try{xyzShow(true)}catch(_){}return}
  if(T2==='3seg'||T2==='3dist'||T2==='3mid'){if(!pend.length&&T2!=='3seg'&&hitAt(p,is3P)==null){const e=edge3At(p);if(e){add({t:T2,a:e[0],b:e[1]});return}}
    const id=pick3(p);if(pend[0]===id)return;pend.push(id);if(pend.length===2){add({t:T2,a:pend[0],b:pend[1]});pend=[]}return}
  if(T2==='3poly'){const id=pick3(p);if(pend.length>=3&&id===pend[0]){add({t:'3poly',ps:pend.slice(),col:col==='#111827'?'#e11d48':col});pend=[]}else if(!pend.includes(id))pend.push(id);return}
  if(T2==='3int'){const e=edge3At(p);if(!e)return say('Hãy bấm vào một cạnh hoặc đoạn thẳng');pend.push(e);
    if(pend.length===2){const [e1,e2]=pend;pend=[];const id=add({t:'3int',a:e1[0],b:e1[1],c:e2[0],d:e2[1]});if(!geo(id)){delWith([id]);say('⚠️ Hai đường thẳng này không cắt nhau (chéo nhau hoặc song song)')}else say('✅ Đã lấy giao điểm '+byId(id).n)}else say('Bấm tiếp đường thẳng thứ hai');return}
  if(T2==='solid'){const k=shp.solid;if(!k){openMenu('solid');return}const G=ground(p,0),N=makeSolid(k,G[0],G[1]);setTool('sel');
    say('✅ Đã vẽ '+SH.solid[k][0].toLowerCase()+' – kéo chỗ trống để xoay, kéo điểm xanh để thay đổi hình');return}}
/* ---------- 3D: đường thẳng, mặt phẳng, điểm trên đối tượng ---------- */
const LINE3=new Set(['3line','3ray','3perpl','3perpp','3parl']),PLANE3=new Set(['3plane','3ppar','3pparl','3pperp','3pperpl']);
const nrm3=a=>{const l=len3(a);return l<1e-12?null:mul3(a,1/l)};
function anyPerp(n){const a=Math.abs(n[0])<0.9?[1,0,0]:[0,1,0];return nrm3(crs3(n,a))}
function lineOf(ref){if(Array.isArray(ref))return [q3(ref[0]),q3(ref[1])];const g=geo(ref);if(!g||!g.A)throw 0;return [g.A,g.B]}
function mkPlane(O,n,ctr,sz){n=nrm3(n);if(!n)throw 0;const u=anyPerp(n),v=crs3(n,u);return {k:'PL',O,n,u,v,ctr,sz}}
function plane3(A,B,C){const n=crs3(sub3(B,A),sub3(C,A));if(len3(n)<1e-9*(1+len3(sub3(B,A))*len3(sub3(C,A))))throw 0;const nn=nrm3(n),u=nrm3(sub3(B,A)),v=crs3(nn,u),ctr=mul3(add3(add3(A,B),C),1/3);
  const sz=Math.max(2.2,1.3*Math.max(len3(sub3(A,ctr)),len3(sub3(B,ctr)),len3(sub3(C,ctr))));return {k:'PL',O:A,n:nn,u,v,ctr,sz}}
function planeOf(ref){if(Array.isArray(ref))return plane3(q3(ref[0]),q3(ref[1]),q3(ref[2]));const g=geo(ref);if(!g||g.k!=='PL')throw 0;return g}
function calcExt(o){const t=o.t;
  const PP=P=>{if(!P||!P.every(isFinite))return;const r=prj(P);return {k:'P',x:r[0],y:r[1],p3:P}};
  const LL=(A,Bq,kind)=>{if(len3(sub3(A,Bq))<1e-9)return;const a=prj(A),b=prj(Bq);return {k:'L',kind,l:[a[0],a[1],b[0],b[1]],A,B:Bq}};
  const PLn=g=>{const c=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>add3(add3(g.ctr,mul3(g.u,i*g.sz)),mul3(g.v,j*g.sz)));g.C4=c;g.p=c.map(q=>{const r=prj(q);return [r[0],r[1]]});return g};
  if(t==='3pol'){const [A,B]=lineOf(o.ln);return PP(lerp3(A,B,o.u))}
  if(t==='3foot'){const P=q3(o.p),[A,B]=lineOf(o.ln),d=sub3(B,A),u=dot3(sub3(P,A),d)/dot3(d,d);return PP(lerp3(A,B,u))}
  if(t==='3footp'){const P=q3(o.p),g=planeOf(o.pl);return PP(sub3(P,mul3(g.n,dot3(sub3(P,g.O),g.n))))}
  if(t==='3onp'){const g=planeOf(o.pl);return PP(add3(add3(g.O,mul3(g.u,o.s)),mul3(g.v,o.tt)))}
  if(t==='3ons'){const C=q3(o.c),r=len3(sub3(q3(o.p),C));return PP([C[0]+r*Math.cos(o.la)*Math.cos(o.lo),C[1]+r*Math.cos(o.la)*Math.sin(o.lo),C[2]+r*Math.sin(o.la)])}
  if(t==='3int2'){const [A,B]=lineOf(o.l1),[C,Dq]=lineOf(o.l2),d1=sub3(B,A),d2=sub3(Dq,C),w=sub3(A,C),a=dot3(d1,d1),b=dot3(d1,d2),c2=dot3(d2,d2),d=dot3(d1,w),e=dot3(d2,w),den=a*c2-b*b;
    if(Math.abs(den)<1e-10*a*c2)return;const s=(b*e-c2*d)/den,u=(a*e-b*d)/den,P1=add3(A,mul3(d1,s)),P2=add3(C,mul3(d2,u));if(len3(sub3(P1,P2))>1e-4*(1+Math.sqrt(a)+Math.sqrt(c2)))return;const R=PP(lerp3(P1,P2,.5));if(R)R.ext2=[[A,B,s],[C,Dq,u]];return R}
  if(t==='3intlp'){const [A,B]=lineOf(o.ln),g=planeOf(o.pl),d=sub3(B,A),dn=dot3(d,g.n);if(Math.abs(dn)<1e-9*len3(d))return;const s=dot3(sub3(g.O,A),g.n)/dn,R=PP(add3(A,mul3(d,s)));if(R)R.ext2=[[A,B,s]];return R}
  if(t==='3line')return LL(q3(o.a),q3(o.b),'line');
  if(t==='3ray')return LL(q3(o.a),q3(o.b),'ray');
  if(t==='3parl'){const P=q3(o.p),[A,B]=lineOf(o.ln);return LL(P,add3(P,sub3(B,A)),'line')}
  if(t==='3perpp'){const P=q3(o.p),g=planeOf(o.pl);return LL(P,add3(P,g.n),'line')}
  if(t==='3plane'){return PLn(plane3(q3(o.a),q3(o.b),q3(o.c)))}
  if(t==='3ppar'){const P=q3(o.p),g=planeOf(o.pl);return PLn(Object.assign(mkPlane(P,g.n,P,g.sz),{u:g.u,v:g.v}))}
  if(t==='3pparl'){const [A,B]=lineOf(o.l1),[C,Dq]=lineOf(o.l2),n=crs3(sub3(B,A),sub3(Dq,C));if(len3(n)<1e-9)return;const ctr=lerp3(A,B,.5);return PLn(mkPlane(A,n,ctr,Math.max(2.2,len3(sub3(B,A))*0.9)))}
  if(t==='3pperp'){const P=q3(o.p),[A,B]=lineOf(o.ln);return PLn(mkPlane(P,sub3(B,A),P,Math.max(2.2,len3(sub3(B,A))*0.7)))}
  if(t==='3pperpl'){const [A,B]=lineOf(o.ln),g=planeOf(o.pl),n=crs3(sub3(B,A),g.n);if(len3(n)<1e-9*len3(sub3(B,A)))return;const ctr=lerp3(A,B,.5),pl=mkPlane(A,n,ctr,Math.max(2.2,len3(sub3(B,A))*0.8));
    const u=nrm3(sub3(B,A)),v=crs3(pl.n,u);return PLn(Object.assign(pl,{u,v}))}
  return null}
/* bấm chọn đối tượng 3D */
function lineAt(p){const e=edge3At(p);if(e)return e;const h=hitAt(p,o=>LINE3.has(o.t),8);return h}
function faceList(p){const [X,Y]=Wd(p[0],p[1]),B=basis(),L=[];
  const test=(ref,Q,ids)=>{if(Q.length<3)return;const pr=Q.map(q=>{const r=prj(q);return [r[0],r[1]]});if(!inPoly([X,Y],pr))return;const n=crs3(sub3(Q[1],Q[0]),sub3(Q[2],Q[0]));if(len3(n)<1e-12)return;
    const nv=dot3(n,B.v);if(Math.abs(nv)<1e-9)return;L.push({ref,D:(dot3(n,Q[0])-X*dot3(n,B.ex)-Y*dot3(n,B.ey))/nv,ids,Q})};
  for(const o of Pg().objs){if(!vis(o))continue;const g=geo(o.id);if(!g)continue;
    if(o.t==='3solid')o.f.forEach(f=>test([o.ps[f[0]],o.ps[f[1]],o.ps[f[2]]],f.map(i=>g.P3[i]),f.map(i=>o.ps[i])));
    else if(o.t==='3poly')test(o.ps.slice(0,3),g.P3,o.ps);
    else if(PLANE3.has(o.t))test(o.id,g.C4,null)}
  L.sort((a,b)=>b.D-a.D);return L}
function faceAt(p){const [X,Y]=Wd(p[0],p[1]),B=basis();let best=null,bd=-1e9;
  const test=(ref,Q)=>{if(Q.length<3)return;const pr=Q.map(q=>{const r=prj(q);return [r[0],r[1]]});if(!inPoly([X,Y],pr))return;let n=crs3(sub3(Q[1],Q[0]),sub3(Q[2],Q[0]));if(len3(n)<1e-12)return;
    const nv=dot3(n,B.v);if(Math.abs(nv)<1e-9)return;const D=(dot3(n,Q[0])-X*dot3(n,B.ex)-Y*dot3(n,B.ey))/nv;if(D>bd){bd=D;best=ref}};
  for(const o of Pg().objs){if(!vis(o))continue;const g=geo(o.id);if(!g)continue;
    if(o.t==='3solid')o.f.forEach(f=>test([o.ps[f[0]],o.ps[f[1]],o.ps[f[2]]],f.map(i=>g.P3[i])));
    else if(o.t==='3poly')test(o.ps.slice(0,3),g.P3);
    else if(PLANE3.has(o.t))test(o.id,g.C4)}
  return best}
function classify(p){const h=hitAt(p,is3P);if(h!=null&&hitDist(byId(h),p)<12)return {k:'P',id:h};const l=lineAt(p);if(l!=null)return {k:'L',ref:l};const f=faceAt(p);if(f!=null)return {k:'PL',ref:f};return {k:'G'}}
function rayPlane(p,g){const B=basis(),[X,Y]=Wd(p[0],p[1]),nv=dot3(g.n,B.v);if(Math.abs(nv)<1e-4)return null;const D=(dot3(g.n,g.O)-X*dot3(g.n,B.ex)-Y*dot3(g.n,B.ey))/nv;return add3(add3(mul3(B.ex,X),mul3(B.ey,Y)),mul3(B.v,D))}
function onPlanePt(p,ref){const g=planeOf(ref),P=rayPlane(p,g);if(!P)return null;const w=sub3(P,g.O);return add({t:'3onp',pl:ref,s:+dot3(w,g.u).toFixed(4),tt:+dot3(w,g.v).toFixed(4)})}
function sphAt(p){for(const o of Pg().objs){if(o.t!=='3sph'||!vis(o))continue;const g=geo(o.id);if(!g)continue;const c=prj(g.C),[X,Y]=S(c[0],c[1]);if(Math.hypot(p[0]-X,p[1]-Y)<g.r*sc())return o}return null}
function sphAngles(p,o){const g=geo(o.id),B=basis(),[X,Y]=Wd(p[0],p[1]),C=g.C,c=prj(C),dx=X-c[0],dy=Y-c[1],r=g.r;let dz=r*r-dx*dx-dy*dy;dz=dz>0?Math.sqrt(dz):0;
  const P=add3(add3(add3(C,mul3(B.ex,dx)),mul3(B.ey,dy)),mul3(B.v,dz)),w=nrm3(sub3(P,C))||[1,0,0];return {la:Math.asin(Math.max(-1,Math.min(1,w[2]))),lo:Math.atan2(w[1],w[0])}}
const greek='αβγδεθλμ';function nextPl(){const used=new Set(Pg().objs.filter(o=>o.pn).map(o=>o.pn));for(let k=0;k<9;k++)for(const ch of greek){const n=k?ch+k:ch;if(!used.has(n))return n}return 'P'}
const lineTxt=ref=>{if(Array.isArray(ref))return nm(ref[0])+nm(ref[1]);const o=byId(ref)||{};return o.a!=null&&o.b!=null?nm(o.a)+nm(o.b):o.p!=null?'đường qua '+nm(o.p):'d'};
function ptOf(c,p){return c.k==='P'?c.id:pick3(p)}
const fmenu=el('div','bp-pop');cvw.appendChild(fmenu);fmenu.style.flexDirection='column';fmenu.addEventListener('pointerdown',e=>e.stopPropagation());
let hiFace=null;
const xyzP=el('div','bp-pop bp-xyz');cvw.appendChild(xyzP);['pointerdown','wheel'].forEach(k=>xyzP.addEventListener(k,e=>e.stopPropagation()));
xyzP.innerHTML=`<div class="xh">📍 Tạo điểm theo tọa độ</div><div class="xr"><span>Tên</span><input data-k="n" type="text" class="xn"><b>(</b><input data-k="x" type="text" value="0" title="hoành độ x"><b>;</b><input data-k="y" type="text" value="0" title="tung độ y"><b>;</b><input data-k="z" type="text" value="0" title="cao độ z"><b>)</b></div>
<div class="xr"><label><input type="checkbox" data-k="g" checked> Vẽ đường gióng</label><button type="button" class="b p" data-k="ok">➕ Tạo điểm</button><button type="button" class="b" data-k="x0" title="Đóng">✖</button></div><div class="xm"></div><div class="xt">Nhận số âm, số thập phân (1,5) và phân số (3/2).</div>`;
const xq=k=>xyzP.querySelector(`[data-k="${k}"]`);
function xyzShow(v){xyzP.style.display=v?'flex':'none';if(!v)return;if(!showAx){showAx=true;try{cAx.set(true);updMode()}catch(_){}}const n=xq('n');if(!n.value||Pg().objs.some(o=>o.n===n.value))n.value=nextName();xyzP.querySelector('.xm').textContent='';setTimeout(()=>{xq('x').focus();xq('x').select()},0);D()}
function xyzNum(s){s=String(s).trim().replace(/,/g,'.').replace(/−/g,'-');const m=s.match(/^(-?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/);if(m)return +m[1]/ +m[2];return s===''?NaN:Number(s)}
function xyzMake(){const X=xyzNum(xq('x').value),Y=xyzNum(xq('y').value),Z=xyzNum(xq('z').value),m=xyzP.querySelector('.xm');
  if(![X,Y,Z].every(isFinite)){m.textContent='⚠️ Tọa độ phải là số, ví dụ: −2 ; 1,5 ; 3/2';return}
  if(Math.max(Math.abs(X),Math.abs(Y),Math.abs(Z))>50){m.textContent='⚠️ Tọa độ quá lớn (giới hạn ±50)';return}
  const n=xq('n').value.trim();if(n&&Pg().objs.some(o=>o.n===n)){m.textContent='⚠️ Tên “'+n+'” đã có – hãy đặt tên khác';return}
  m.textContent='';let id;txn(()=>{const o={t:'3pt',x:+X.toFixed(4),y:+Y.toFixed(4),z:+Z.toFixed(4)};if(n)o.n=n;if(xq('g').checked)o.gi=1;id=add(o)});
  const o=byId(id);say(`✅ Đã tạo điểm <b>${o.n}(${fmt(X,2)}; ${fmt(Y,2)}; ${fmt(Z,2)})</b> – nhập tiếp để tạo điểm khác`);xq('n').value=nextName();xq('x').focus();xq('x').select();D()}
xyzP.querySelectorAll('input[type=text]').forEach(i=>{i.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();xyzMake()}});i.addEventListener('focus',()=>i.select())});
xq('ok').onclick=xyzMake;xq('x0').onclick=()=>setTool('sel');
function faceName(F){return F.ids?'mặt ('+F.ids.map(nm).join('')+')':'mặt phẳng ('+((byId(F.ref)||{}).pn||'')+')'}
function chooseFace(p,L,cb){const k=c.getBoundingClientRect().width/W;fmenu.innerHTML='<div style="font:600 12px Segoe UI;color:#6366f1;padding:2px 4px">Chọn mặt phẳng:</div>';
  L.forEach(F=>{const b=btn(fmenu,faceName(F),()=>{fmenu.style.display='none';hiFace=null;cb(F)});b.onmouseenter=()=>{hiFace={Q:F.Q,t:performance.now()+1e9};D()};b.onmouseleave=()=>{hiFace=null;D()}});
  btn(fmenu,'✖ Hủy',()=>{fmenu.style.display='none';hiFace=null;D()});
  fmenu.style.left=Math.min(W-200,p[0]+10)*k+'px';fmenu.style.top=Math.min(H-40*L.length-60,p[1]+10)*k+'px';fmenu.style.display='flex'}
function geoClickExt(p,forced){const T2=tool;let c=forced||classify(p);
  if(!forced&&c.k==='PL'){const L=faceList(p);if(L.length>1){chooseFace(p,L,F=>{txn(()=>geoClickExt(p,{k:'PL',ref:F.ref}));if(F.Q){hiFace={Q:F.Q,t:performance.now()+900}}D()});return}}
  if(T2==='3on'){if(c.k==='P')return say('Đây đã là một điểm – hãy bấm lên đường, mặt phẳng, mặt của khối hoặc mặt cầu');
    if(c.k==='L'){const [A,B]=lineOf(c.ref),a=prj(A),b=prj(B),[X1,Y1]=S(a[0],a[1]),[X2,Y2]=S(b[0],b[1]);let u=((p[0]-X1)*(X2-X1)+(p[1]-Y1)*(Y2-Y1))/((X2-X1)**2+(Y2-Y1)**2||1);
      const o=Array.isArray(c.ref)?null:byId(c.ref);if(!o||o.t==='3seg')u=cl01(u);add({t:'3pol',ln:c.ref,u:+u.toFixed(4)});return}
    const sp=sphAt(p);if(sp&&c.k!=='PL'){const a=sphAngles(p,sp);add({t:'3ons',c:sp.c,p:sp.p,la:a.la,lo:a.lo});return}
    if(c.k==='PL'){if(onPlanePt(p,c.ref)==null)say('⚠️ Mặt phẳng đang nhìn ngang – hãy xoay hình rồi bấm lại');return}
    return say('Hãy bấm lên một đường thẳng, cạnh, mặt phẳng, mặt của khối hoặc mặt cầu')}
  if(T2==='3line'||T2==='3ray'){const id=ptOf(c,p);if(pend[0]===id)return;pend.push(id);if(pend.length===2){add({t:T2,a:pend[0],b:pend[1]});pend=[]}return}
  if(T2==='3perp'||T2==='3par'){
    if(c.k==='P'||c.k==='G'){if(pend.some(x=>x.k==='P'))pend=pend.filter(x=>x.k!=='P');pend.push({k:'P',id:ptOf(c,p)})}
    else if(c.k==='L'){pend=pend.filter(x=>x.k==='P');pend.push(c)}
    else if(c.k==='PL'&&T2==='3perp'){pend=pend.filter(x=>x.k==='P');pend.push(c)}
    else return say('Đường song song: hãy chọn một điểm và một đường thẳng');
    const P=pend.find(x=>x.k==='P'),O=pend.find(x=>x.k!=='P');if(!P||!O){say(P?'Bấm tiếp đường thẳng'+(T2==='3perp'?' hoặc mặt phẳng':''):'Bấm tiếp một điểm');return}
    pend=[];
    if(T2==='3par'){add({t:'3parl',p:P.id,ln:O.ref});say('✅ Đã dựng đường thẳng qua '+nm(P.id)+' song song với '+lineTxt(O.ref));return}
    if(O.k==='L'){const H=add({t:'3foot',p:P.id,ln:O.ref,n:nmP('H')});if(len3(sub3(q3(P.id),q3(H)))<1e-6){delWith([H]);return say('⚠️ Điểm nằm trên đường thẳng – hãy chọn điểm nằm ngoài')}
      add({t:'3line',a:P.id,b:H,ra:{ln:O.ref}});say('✅ Đã dựng đường vuông góc '+nm(P.id)+byId(H).n+' (H là hình chiếu của '+nm(P.id)+')');return}
    const H=add({t:'3footp',p:P.id,pl:O.ref,n:nmP('H')});if(len3(sub3(q3(P.id),q3(H)))<1e-6){delWith([H]);add({t:'3perpp',p:P.id,pl:O.ref});return say('✅ Đã dựng đường vuông góc với mặt phẳng tại '+nm(P.id))}
    add({t:'3line',a:P.id,b:H,ra:{pl:O.ref}});say('✅ Đã dựng đường thẳng '+nm(P.id)+byId(H).n+' vuông góc với mặt phẳng (H là hình chiếu)');return}
  if(T2==='3plane'){if(c.k==='PL'&&!pend.length&&Array.isArray(c.ref)){add({t:'3plane',a:c.ref[0],b:c.ref[1],c:c.ref[2],pn:nextPl()});return say('✅ Đã tạo mặt phẳng chứa mặt ('+c.ref.map(nm).join('')+')')}
    let ids=[];if(c.k==='L'&&Array.isArray(c.ref))ids=c.ref;else if(c.k==='L'){const o=byId(c.ref);ids=o.a!=null&&o.b!=null?[o.a,o.b]:[o.p]}else ids=[ptOf(c,p)];
    for(const i of ids)if(!pend.includes(i))pend.push(i);
    if(pend.length>=3){const [a,b,c2]=pend;pend=[];try{plane3(q3(a),q3(b),q3(c2))}catch(e){return say('⚠️ Ba điểm thẳng hàng – không xác định mặt phẳng')}add({t:'3plane',a,b,c:c2,pn:nextPl()});say('✅ Đã tạo mặt phẳng ('+[a,b,c2].map(nm).join('')+')')}
    else say('Đã chọn '+pend.length+' điểm – bấm tiếp');return}
  if(T2==='3ppar'||T2==='3pperp'){
    if(c.k==='P'||c.k==='G'){pend=pend.filter(x=>x.k!=='P');pend.push({k:'P',id:ptOf(c,p)})}else pend.push(c);
    const P=pend.find(x=>x.k==='P'),Ls=pend.filter(x=>x.k==='L'),Pl=pend.find(x=>x.k==='PL');
    if(T2==='3ppar'){if(P&&Pl){pend=[];add({t:'3ppar',p:P.id,pl:Pl.ref,pn:nextPl()});return say('✅ Đã dựng mặt phẳng qua '+nm(P.id)+' song song với mặt phẳng đã chọn')}
      if(Ls.length>=2){pend=[];const id=add({t:'3pparl',l1:Ls[0].ref,l2:Ls[1].ref,pn:nextPl()});if(!geo(id)){delWith([id]);return say('⚠️ Hai đường thẳng song song – không xác định')}return say('✅ Đã dựng mặt phẳng chứa '+lineTxt(Ls[0].ref)+' và song song với '+lineTxt(Ls[1].ref))}
      return say('Chọn: 1 điểm + 1 mặt phẳng, hoặc 2 đường thẳng (mặt phẳng chứa đường thứ nhất, song song đường thứ hai)')}
    if(P&&Ls.length){pend=[];add({t:'3pperp',p:P.id,ln:Ls[0].ref,pn:nextPl()});return say('✅ Đã dựng mặt phẳng qua '+nm(P.id)+' vuông góc với '+lineTxt(Ls[0].ref))}
    if(Ls.length&&Pl){pend=[];const id=add({t:'3pperpl',ln:Ls[0].ref,pl:Pl.ref,pn:nextPl()});if(!geo(id)){delWith([id]);return say('⚠️ Đường thẳng đang vuông góc với mặt phẳng – không xác định duy nhất')}return say('✅ Đã dựng mặt phẳng chứa '+lineTxt(Ls[0].ref)+' và vuông góc với mặt phẳng đã chọn')}
    if(pend.length>3)pend=pend.slice(-1);return say('Chọn: 1 điểm + 1 đường thẳng, hoặc 1 đường thẳng + 1 mặt phẳng')}
  if(T2==='3int'){if(c.k!=='L'&&c.k!=='PL')return say('Hãy bấm vào đường thẳng / cạnh, hoặc mặt phẳng');pend.push(c);
    if(pend.length<2)return say('Bấm tiếp đối tượng thứ hai');const [x,y]=pend;pend=[];let id;
    if(x.k==='L'&&y.k==='L')id=add({t:'3int2',l1:x.ref,l2:y.ref});else if(x.k==='PL'&&y.k==='PL')return say('Giao của hai mặt phẳng: hãy lấy giao điểm của từng cặp đường thẳng');
    else id=add({t:'3intlp',ln:x.k==='L'?x.ref:y.ref,pl:x.k==='PL'?x.ref:y.ref});
    if(!geo(id)){delWith([id]);say('⚠️ Không có giao điểm (chéo nhau hoặc song song)')}else say('✅ Đã lấy giao điểm '+byId(id).n);return}
}
function drawExt(o,g,cc,seg3,hl,plain,B){const L=Math.max(2.5,5/V().z);
  if(LINE3.has(o.t)){const d=sub3(g.B,g.A),k=L/len3(d);const E1=o.t==='3ray'?g.A:sub3(g.A,mul3(d,k)),E2=add3(g.B,mul3(d,k));hl(o,(c1,w)=>plain(E1,E2,c1,w));seg3(E1,E2,cc,2);
    if(o.ra){try{const H=g.B,d1=nrm3(sub3(g.A,H));let d2;if(o.ra.ln!=null){const [A,Bq]=lineOf(o.ra.ln);d2=nrm3(sub3(Bq,A))}else d2=planeOf(o.ra.pl).u;
      const s=14/sc();const c1=add3(H,mul3(d1,s)),c2=add3(c1,mul3(d2,s)),c3=add3(H,mul3(d2,s));[c1,c2,c3].reduce((a,b2)=>(plain(a,b2,cc,1.4),b2))}catch(e){}}return true}
  if(PLANE3.has(o.t)){if(o.col==='#111827')cc=cm('#6366f1');const q=g.p.map(a=>S(a[0],a[1]));hl(o,(c1,w)=>{for(let i=0;i<4;i++)plain(g.C4[i],g.C4[(i+1)%4],c1,w)});
    ctx.save();ctx.globalAlpha*=.13;ctx.fillStyle=cc;ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath();ctx.fill();ctx.restore();
    for(let i=0;i<4;i++)seg3(g.C4[i],g.C4[(i+1)%4],cc,1.3);if(showLb&&o.pn){ctx.save();ctx.fillStyle=cc;ctx.font='italic bold 18px Times New Roman,serif';ctx.fillText('('+o.pn+')',q[2][0]+4,q[2][1]);ctx.restore()}return true}
  return false}

/* vẽ 3D */
function draw3d(clean,marks){const B=basis(),v=B.v,os=Pg().objs,dark=bg==='den',ink3=dark?'#e2e8f0':'#1e293b';
  const visO=o=>!o.hid||(!clean&&showHid);
  // lưới mặt đáy & trục
  if(bg==='luoi'||bg==='oli'){ctx.save();ctx.strokeStyle=dark?'#ffffff22':'#e2e8f0';ctx.lineWidth=1;ctx.beginPath();const N=8;
    const pv0=pivot3()||[0,0,0],gx=Math.round(pv0[0]),gy=Math.round(pv0[1]);for(let i=-N;i<=N;i++){for(const [a,b] of [[[gx+i,gy-N,0],[gx+i,gy+N,0]],[[gx-N,gy+i,0],[gx+N,gy+i,0]]]){const p1=prj(a),p2=prj(b),s1=S(p1[0],p1[1]),s2=S(p2[0],p2[1]);ctx.moveTo(s1[0],s1[1]);ctx.lineTo(s2[0],s2[1])}}ctx.stroke();ctx.restore()}
  // các mặt che khuất
  const faces=[];for(const o of os){if(o.t!=='3solid'||!visO(o))continue;const g=geo(o.id);if(!g)continue;const Q=g.P3,cen=mul3(Q.reduce(add3),1/Q.length);
    for(const f of o.f){const F=f.map(i=>Q[i]);let n=crs3(sub3(F[1],F[0]),sub3(F[2],F[0]));if(len3(n)<1e-12)continue;if(dot3(n,sub3(F[0],cen))<0)n=mul3(n,-1);const nv=dot3(n,v);if(nv<=1e-9)continue;
      faces.push({n,k:dot3(n,F[0]),nv,nx:dot3(n,B.ex),ny:dot3(n,B.ey),pr:F.map(q=>{const r=prj(q);return [r[0],r[1]]})})}}
  const hidden=P=>{const r=prj(P),e=1e-6*(1+len3(P));for(const F of faces){if(!inPoly([r[0],r[1]],F.pr))continue;const Dp=(F.k-r[0]*F.nx-r[1]*F.ny)/F.nv;if(Dp>r[2]+1e-4)return true}return false};
  const seg3=(A,Bp,cc,lw,dashAll)=>{const a=prj(A),b=prj(Bp),sa=S(a[0],a[1]),sb=S(b[0],b[1]),n=Math.max(6,Math.min(90,Math.ceil(Math.hypot(sb[0]-sa[0],sb[1]-sa[1])/7)));
    const h=[];for(let i=0;i<n;i++)h.push(dashAll||hidden(lerp3(A,Bp,(i+.5)/n)));ctx.save();ctx.strokeStyle=cc;ctx.lineCap='round';
    let i=0;while(i<n){let j=i;while(j+1<n&&h[j+1]===h[i])j++;const P1=lerp3(A,Bp,i/n),P2=lerp3(A,Bp,(j+1)/n),r1=prj(P1),r2=prj(P2),s1=S(r1[0],r1[1]),s2=S(r2[0],r2[1]);
      ctx.setLineDash(h[i]?[7,5]:[]);ctx.lineWidth=h[i]?Math.max(1.2,lw*.75):lw;ctx.beginPath();ctx.moveTo(s1[0],s1[1]);ctx.lineTo(s2[0],s2[1]);ctx.stroke();i=j+1}ctx.restore()};
  const ring=(C,r,z,cc,lw,hideFn)=>{const n=96;ctx.save();ctx.strokeStyle=cc;ctx.lineCap='round';let prev=null;
    for(let i=0;i<n;i++){const t1=i/n*2*Math.PI,t2=(i+1)/n*2*Math.PI,P1=[C[0]+r*Math.cos(t1),C[1]+r*Math.sin(t1),z],P2=[C[0]+r*Math.cos(t2),C[1]+r*Math.sin(t2),z],hd=hideFn(lerp3(P1,P2,.5));
      const a=prj(P1),b=prj(P2),s1=S(a[0],a[1]),s2=S(b[0],b[1]);ctx.setLineDash(hd?[7,5]:[]);ctx.lineDashOffset=0;ctx.lineWidth=hd?Math.max(1.2,lw*.75):lw;ctx.beginPath();ctx.moveTo(s1[0],s1[1]);ctx.lineTo(s2[0],s2[1]);ctx.stroke()}ctx.restore()};
  const hl=(o,draw1)=>{if(clean)return;const c1=sel===o.id?'#f59e0b':hov===o.id&&tool==='sel'?'#818cf8':hov===o.id&&tool==='erase'?'#ef4444':null;if(c1){ctx.save();ctx.globalAlpha=.55;draw1(c1,9);ctx.restore()}
    const f=flash.get(o.id);if(f!=null){const k=1-(performance.now()-f)/700;if(k<=0)flash.delete(o.id);else{ctx.save();ctx.globalAlpha=k*.7;draw1('#22c55e',10);ctx.restore()}}};
  const plain=(A,Bp,cc,lw)=>{const a=prj(A),b=prj(Bp),s1=S(a[0],a[1]),s2=S(b[0],b[1]);ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=lw;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s1[0],s1[1]);ctx.lineTo(s2[0],s2[1]);ctx.stroke();ctx.restore()};
  if(showAx){let N=5;for(const o of os){if(!P3T.has(o.t)||!visO(o))continue;const g=geo(o.id);if(g&&g.p3)N=Math.max(N,Math.ceil(Math.max(...g.p3.map(Math.abs)))+1)}N=Math.min(N,50);
    const O=[0,0,0],o0=prj(O),[OX,OY]=S(o0[0],o0[1]);
    [['x',[1,0,0],dark?'#f87171':'#dc2626'],['y',[0,1,0],dark?'#4ade80':'#16a34a'],['z',[0,0,1],dark?'#60a5fa':'#2563eb']].forEach(([n,e,cc])=>{
      seg3(mul3(e,-N),O,cc,1.3,true);seg3(O,mul3(e,N+0.7),cc,2);
      const a=prj(mul3(e,N+0.7)),[X,Y]=S(a[0],a[1]),p1=prj(e),[X1,Y1]=S(p1[0],p1[1]),step=Math.hypot(X1-OX,Y1-OY),u=un(X1-OX,Y1-OY);
      if(u){ctx.save();ctx.fillStyle=cc;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(X-u[0]*13-u[1]*6,Y-u[1]*13+u[0]*6);ctx.lineTo(X-u[0]*13+u[1]*6,Y-u[1]*13-u[0]*6);ctx.fill();
        ctx.font='italic bold 19px "Times New Roman",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,X+u[0]*14,Y+u[1]*14);ctx.restore()}
      if(!u||step<5)return;const ev=step<14?5:step<26?2:1;let nn=[-u[1],u[0]];if(nn[1]<-0.2||(Math.abs(nn[1])<=0.2&&nn[0]>0))nn=[-nn[0],-nn[1]];
      ctx.save();ctx.strokeStyle=cc;ctx.fillStyle=cc;ctx.lineWidth=1.6;ctx.font='12px Segoe UI,Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      for(let k=-N;k<=N;k++){if(!k)continue;const q=prj(mul3(e,k)),[tx,ty]=S(q[0],q[1]);ctx.beginPath();ctx.moveTo(tx-nn[0]*4,ty-nn[1]*4);ctx.lineTo(tx+nn[0]*4,ty+nn[1]*4);ctx.stroke();
        if(k%ev===0)ctx.fillText(String(k).replace('-','−'),tx+nn[0]*14,ty+nn[1]*14)}ctx.restore()});
    ctx.save();ctx.fillStyle=dark?'#e2e8f0':'#334155';ctx.font='italic bold 17px "Times New Roman",serif';ctx.fillText('O',OX-18,OY+18);ctx.beginPath();ctx.arc(OX,OY,3.5,0,7);ctx.fill();ctx.restore();
    // đường gióng của các điểm tạo theo tọa độ
    for(const o of os){if(o.t!=='3pt'||!o.gi||!visO(o))continue;const P=[o.x,o.y,o.z],F=[o.x,o.y,0],gc=dark?'#94a3b8':'#64748b';
      if(Math.abs(o.z)>1e-9)seg3(P,F,gc,1.2,true);if(Math.abs(o.y)>1e-9)seg3(F,[o.x,0,0],gc,1.2,true);if(Math.abs(o.x)>1e-9)seg3(F,[0,o.y,0],gc,1.2,true);
      if(Math.abs(o.z)>1e-9){seg3(P,[0,0,o.z],gc,1,true)}
      const r=prj(P),[X,Y]=S(r[0],r[1]);ctx.save();ctx.font='13px Segoe UI,Arial';ctx.fillStyle=dark?'#cbd5e1':'#475569';ctx.fillText(`(${fmt(o.x,2)}; ${fmt(o.y,2)}; ${fmt(o.z,2)})`,X+10,Y+20);ctx.restore()}}
  for(const o of os){if(o.t[0]!=='3'||P3T.has(o.t)||!visO(o))continue;const g=geo(o.id);if(!g)continue;const cc=cm(o.col||'#1d4ed8');if(o.hid){ctx.save();ctx.globalAlpha=.28}
    try{
    if(drawExt(o,g,cc,seg3,hl,plain,B)){}
    else if(o.t==='3solid'){hl(o,(c1,w)=>o.e.forEach(([i,j])=>plain(g.P3[i],g.P3[j],c1,w)));o.e.forEach(([i,j])=>seg3(g.P3[i],g.P3[j],cc,2.4))}
    else if(o.t==='3seg'){marks(o.id);seg3(g.A,g.B,cc,2.2)}
    else if(o.t==='3dist'){seg3(g.A,g.B,cc,1.2,true);const m=lerp3(g.A,g.B,.5),r=prj(m),[X,Y]=S(r[0],r[1]);lbBox.set(o.id,pill(nm(o.a)+nm(o.b)+' = '+fmt(len3(sub3(g.A,g.B)),2),X,Y-16,dark?'#5eead4':'#0f766e'))}
    else if(o.t==='3poly'){marks(o.id);const q=g.p.map(a=>S(a[0],a[1]));ctx.save();ctx.globalAlpha*=.16;ctx.fillStyle=cc;ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath();ctx.fill();ctx.restore();
      g.P3.forEach((a,i)=>seg3(a,g.P3[(i+1)%g.P3.length],cc,2.2))}
    else if(o.t==='3cyl'||o.t==='3cone'){const C=g.C,r=g.r,T=g.T,cyl=o.t==='3cyl',vh=[v[0],v[1]],up=v[2]>0;
      const back=P=>(P[0]-C[0])*vh[0]+(P[1]-C[1])*vh[1]<0;
      hl(o,(c1,w)=>{ring(C,r,C[2],c1,w,()=>false);if(cyl)ring([T[0],T[1]],r,T[2],c1,w,()=>false)});
      if(cyl){const top=T[2]>C[2];ring(C,r,C[2],cc,2.4,P=>back(P)&&(top?up:!up));ring(C,r,T[2],cc,2.4,P=>back(P)&&(top?!up:up));
        const d=[-vh[1],vh[0]],L=Math.hypot(...d)||1;[1,-1].forEach(sg=>{const P1=[C[0]+sg*r*d[0]/L,C[1]+sg*r*d[1]/L,C[2]],P2=[P1[0],P1[1],T[2]];plain(P1,P2,cc,2.4)});
        seg3(C,[C[0],C[1],T[2]],cc,1.2,true);}
      else{const Ss=prj(T),ss=S(Ss[0],Ss[1]),n=360,pts=[];for(let i=0;i<n;i++){const t1=i/n*2*Math.PI,P1=[C[0]+r*Math.cos(t1),C[1]+r*Math.sin(t1),C[2]],a=prj(P1);pts.push([P1,S(a[0],a[1])])}
        const fv=i=>{const a=pts[i][1],b=pts[(i+1)%n][1];return (a[0]-ss[0])*(b[1]-a[1])-(a[1]-ss[1])*(b[0]-a[0])};const tg=[];for(let i=0;i<n;i++)if(Math.sign(fv(i))!==Math.sign(fv((i+1)%n)))tg.push((i+1)%n);
        const hideBase=(T[2]-C[2])*v[2]>0;let hidArc=()=>hideBase;
        if(tg.length>=2){const [i1,i2]=tg,inA=i=>i1<i2?(i>=i1&&i<i2):(i>=i1||i<i2);let bi=0,bm=1e9;for(let i=0;i<n;i++){const P=pts[i][0],d=(P[0]-C[0])*vh[0]+(P[1]-C[1])*vh[1];if(d<bm){bm=d;bi=i}}const backIsA=inA(bi);
          hidArc=P=>{if(!hideBase)return false;let a=Math.atan2(P[1]-C[1],P[0]-C[0]);if(a<0)a+=2*Math.PI;const i=Math.floor(a/(2*Math.PI)*n)%n;return inA(i)===backIsA};
          tg.slice(0,2).forEach(i=>plain(T,pts[i][0],cc,2.4))}
        ring(C,r,C[2],cc,2.4,hidArc);seg3(C,T,cc,1.2,true)}
      const Pp=q3(o.p);seg3(C,Pp,cc,1.2,true)}
    else if(o.t==='3sph'){const C=g.C,r=g.r,c=prj(C),[X,Y]=S(c[0],c[1]);hl(o,(c1,w)=>{ctx.save();ctx.strokeStyle=c1;ctx.lineWidth=w;ctx.beginPath();ctx.arc(X,Y,r*sc(),0,7);ctx.stroke();ctx.restore()});
      ctx.save();ctx.strokeStyle=cc;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(X,Y,r*sc(),0,7);ctx.stroke();ctx.restore();ring(C,r,C[2],cc,2,P=>dot3(sub3(P,C),v)<0);seg3(C,q3(o.p),cc,1.2,true)}
    }catch(e){}finally{if(o.hid)ctx.restore()}}
  if(!clean&&act&&act.k==='rot'&&act.ax){const pv=act.pv||pivot3()||[0,0,0],L=Math.max(3,8/V().z);let A,Bq;
    if(act.ax==='h'){A=[pv[0],pv[1],pv[2]-L];Bq=[pv[0],pv[1],pv[2]+L]}else{A=sub3(pv,mul3(B.ex,L));Bq=add3(pv,mul3(B.ex,L))}
    const a=prj(A),b=prj(Bq),s1=S(a[0],a[1]),s2=S(b[0],b[1]);ctx.save();ctx.strokeStyle='#f97316';ctx.lineWidth=2;ctx.setLineDash([10,6]);ctx.beginPath();ctx.moveTo(s1[0],s1[1]);ctx.lineTo(s2[0],s2[1]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f97316';ctx.font='bold 14px Segoe UI';const lx=act.ax==='h'?s2[0]+8:s2[0]-120,ly=act.ax==='h'?s2[1]+14:s2[1]-10;ctx.fillText(act.ax==='h'?'↻ quay quanh trục đứng':'↕ nghiêng quanh trục ngang',lx,ly);ctx.restore()}
  if(hiFace&&!clean){if(performance.now()>hiFace.t)hiFace=null;else{const q=hiFace.Q.map(P=>{const r=prj(P);return S(r[0],r[1])});ctx.save();ctx.fillStyle='#f59e0b55';ctx.strokeStyle='#f59e0b';ctx.lineWidth=3;ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();dirty=true}}
  for(const o of os){if((o.t!=='3int2'&&o.t!=='3intlp')||!visO(o))continue;const g=geo(o.id);if(!g||!g.ext2)continue;
    g.ext2.forEach(([A,Bq,t])=>{if(t>=-1e-6&&t<=1+1e-6)return;seg3(t<0?A:Bq,g.p3,dark?'#94a3b8':'#64748b',1.4)})}
  // đường kéo dài của giao điểm
  for(const o of os){if(o.t!=='3int'||!visO(o))continue;const g=geo(o.id);if(!g||!g.ext)continue;const [s,u]=g.ext;
    [[o.a,o.b,s],[o.c,o.d,u]].forEach(([a,b,t])=>{if(t>=-1e-6&&t<=1+1e-6)return;const A=q3(a),Bp=q3(b),E=t<0?A:Bp;seg3(E,g.p3,dark?'#94a3b8':'#64748b',1.4)})}
}
function solidVol(o,g){if(o.t==='3cyl')return Math.PI*g.r*g.r*Math.abs(g.T[2]-g.C[2]);if(o.t==='3cone')return Math.PI*g.r*g.r*Math.abs(g.T[2]-g.C[2])/3;if(o.t==='3sph')return 4/3*Math.PI*g.r**3;return null}
function pivot3(){let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],n=0;
  for(const o of Pg().objs){if(!vis(o))continue;let pts=[];
    if(P3T.has(o.t)){const g=geo(o.id);if(g&&g.p3)pts=[g.p3]}
    else if(o.t==='3cyl'||o.t==='3cone'||o.t==='3sph'){const g=geo(o.id);if(g){const r=g.r;pts=[[g.C[0]-r,g.C[1]-r,g.C[2]-(o.t==='3sph'?r:0)],[g.C[0]+r,g.C[1]+r,g.C[2]+(o.t==='3sph'?r:0)]]}}
    for(const P of pts){n++;for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],P[i]);mx[i]=Math.max(mx[i],P[i])}}}
  return n?[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2]:null}
function keepPivot(fn,pv){pv=pv||pivot3();if(!pv){fn();inval();return}const r0=prj(pv),s0=S(r0[0],r0[1]);fn();inval();const r1=prj(pv);V().ox=s0[0]-r1[0]*sc();V().oy=s0[1]+r1[1]*sc();inval()}
function updMode(){const m3=is3();Object.entries(gdivs).forEach(([n,d])=>{const g2=['Điểm','Đường','Tròn','Kí hiệu','Đo · Vẽ'].includes(n),g3=n==='Không gian';d.style.display=(g3&&!m3)||(g2&&m3)?'none':''});btn3d.classList.toggle('on',m3);
  tbtn.vert3.classList.toggle('on',vertMode);tbtn.rot3.classList.toggle('on',autoRot);tbtn.ax3.classList.toggle('on',showAx);try{if(cAxL)cAxL.lastChild.textContent=' '+(m3?'Oxyz':'Oxy')}catch(_){}}
function toggle3d(){const to=is3()?'2d':'3d';if(Pg().objs.length){pages.splice(pi+1,0,Object.assign(newPage(),{mode:to}));goPage(pi+1)}else{Pg().mode=to;inval()}
  if(to==='3d')Pg().cam={th:-125,ph:22};updMode();setTool('sel');persist();
  say(to==='3d'?'🧊 Đã mở bảng KHÔNG GIAN: chọn “Khối ▾” để vẽ hình chóp, lăng trụ, hình hộp…; kéo chỗ trống để xoay hình':'Đã trở về bảng phẳng (2D)');D()}

/* ---------- Chèn / dán ảnh ---------- */
function addImageSrc(src,at){const im=new Image();im.onload=()=>{let w=im.naturalWidth,h=im.naturalHeight,data=src;const MX=1400;
    if(w>MX||h>MX||src.length>900000){const k=Math.min(1,MX/Math.max(w,h)),cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);const cx2=cv.getContext('2d');cx2.fillStyle='#fff';cx2.fillRect(0,0,cv.width,cv.height);cx2.drawImage(im,0,0,cv.width,cv.height);
      data=cv.toDataURL('image/jpeg',0.86);if(data.length>src.length&&k===1)data=src;w=cv.width;h=cv.height}
    const fit=Math.min(1,0.6*W/w,0.6*H/h),ww=w*fit/sc(),hh=h*fit/sc(),P=at||(mouse&&mouse[0]>0&&mouse[1]>0?mouse:[W/2,H/2]),[cx,cy]=Wd(P[0],P[1]);
    const key='im'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);(Pg().imgs||(Pg().imgs={}))[key]=data;
    txn(()=>{const id=add({t:'img',key,x:+(cx-ww/2).toFixed(3),y:+(cy+hh/2).toFixed(3),w:+ww.toFixed(3),h:+hh.toFixed(3)});sel=id;selAt=[P[0],P[1]-hh*sc()/2]});
    setTool('sel');say('🖼️ Đã dán ảnh – kéo để di chuyển, kéo ô vuông góc dưới phải để đổi cỡ, bấm 🔒 Khóa để viết lên ảnh');D()};
  im.onerror=()=>say('⚠️ Không đọc được ảnh này');im.src=src}
function addImageFile(file,at){if(!file||!/^image\//.test(file.type))return false;const r=new FileReader();r.onload=()=>addImageSrc(r.result,at);r.readAsDataURL(file);return true}
const imgIn=el('input');imgIn.type='file';imgIn.accept='image/*';imgIn.style.display='none';wrap.appendChild(imgIn);
imgIn.onchange=()=>{const f=imgIn.files[0];if(f)addImageFile(f);imgIn.value=''};
tbtn.imgf.onclick=()=>imgIn.click();
const pbox=el('div','bp-paste','<b>📋 Dán ảnh</b> <span style="float:right;cursor:pointer" data-x="1">✖</span><div>Trên máy tính bảng: <b>chạm và giữ</b> vào ô bên dưới → chọn <b>Dán</b> (Paste).<br>Trên máy tính: bấm vào ô rồi nhấn <b>Ctrl+V</b>.</div><div class="box" contenteditable="true"></div>');
cvw.appendChild(pbox);const pin=pbox.querySelector('.box');pbox.addEventListener('pointerdown',e=>e.stopPropagation());pbox.querySelector('[data-x]').onclick=()=>{pbox.style.display='none'};
function openPasteBox(){pin.innerHTML='';pbox.style.display='block';try{pin.focus()}catch(_){}}
pin.addEventListener('input',()=>{const im=pin.querySelector('img');if(im&&im.src){const src=im.src;pin.innerHTML='';pbox.style.display='none';
    if(src.startsWith('data:'))addImageSrc(src);else fetch(src).then(r=>r.blob()).then(b=>{const fr=new FileReader();fr.onload=()=>addImageSrc(fr.result);fr.readAsDataURL(b)}).catch(()=>say('⚠️ Không lấy được ảnh này – hãy lưu ảnh vào máy rồi dùng nút 🖼️'))}});
tbtn.imgp.onclick=async()=>{try{if(!navigator.clipboard||!navigator.clipboard.read||!window.isSecureContext){openPasteBox();return}const items=await navigator.clipboard.read();
    for(const it of items){const ty=it.types.find(t=>t.startsWith('image/'));if(ty){const bl=await it.getType(ty);addImageFile(new File([bl],'paste',{type:ty}));return}}
    say('Trong bộ nhớ tạm chưa có ảnh – hãy sao chép (Copy) một ảnh trước, rồi bấm lại hoặc nhấn Ctrl+V')}catch(e){openPasteBox()}};
document.addEventListener('paste',e=>{if(!body.classList.contains('on'))return;const fromBox=pbox.contains(e.target);if(fromBox)setTimeout(()=>{if(!pin.querySelector('img'))pbox.style.display='none'},50);const tg=(e.target.tagName||'');if(tg==='TEXTAREA'||(tg==='INPUT'&&e.target.type!=='checkbox'&&e.target.type!=='range'))return;
  const items=[...(e.clipboardData&&e.clipboardData.items||[])];const it=items.find(i=>i.kind==='file'&&i.type.startsWith('image/'));
  if(it){e.preventDefault();addImageFile(it.getAsFile());return}
  const html=e.clipboardData&&e.clipboardData.getData('text/html');const m=html&&html.match(/<img[^>]+src="(data:image[^"]+)"/i);if(m){e.preventDefault();addImageSrc(m[1]);return}
  const txt=e.clipboardData&&e.clipboardData.getData('text/plain');if(txt&&txt.trim()){e.preventDefault();const P=mouse||[W/2,H/2],w=Wd(P[0],P[1]);txn(()=>add({t:'text',x:w[0],y:w[1],s:txt.trim().split('\n')[0].slice(0,200),size:(16+wid*2)/V().z,col}));say('Đã dán chữ lên bảng')}});
cvw.addEventListener('dragover',e=>{e.preventDefault()});
cvw.addEventListener('drop',e=>{e.preventDefault();const f=[...(e.dataTransfer&&e.dataTransfer.files||[])].find(x=>x.type.startsWith('image/'));if(f)addImageFile(f,c.pos(e));else say('Hãy kéo thả một tệp ảnh (PNG, JPG…)')});

/* ---------- Ẩn / hiện đối tượng ---------- */
const rp=el('div','bp-rp');cvw.appendChild(rp);
rp.innerHTML='<label>↻ Quay quanh trục đứng <b></b><input type="range" min="0" max="360" step="1"></label><label>↕ Nghiêng (trục ngang) <b></b><input type="range" min="-89" max="89" step="1"></label>';
const [rTh,rPh]=rp.querySelectorAll('input'),[bTh,bPh]=rp.querySelectorAll('b');
rTh.oninput=()=>{keepPivot(()=>{cam().th=+rTh.value-360});D();persist()};rPh.oninput=()=>{keepPivot(()=>{cam().ph=+rPh.value});D();persist()};
rp.addEventListener('pointerdown',e=>e.stopPropagation());
function syncRp(){if(!is3()){rp.style.display='none';return}rp.style.display='block';const t=((Math.round(cam().th)%360)+360)%360,f=Math.round(cam().ph);
  if(document.activeElement!==rTh)rTh.value=t;if(document.activeElement!==rPh)rPh.value=f;bTh.textContent=t+'°';bPh.textContent=f+'°'}
const pop=el('div','bp-pop');cvw.appendChild(pop);
const popLock=btn(pop,'🔒 Khóa',()=>{const o=byId(sel);if(o&&o.t==='img'){txn(()=>{o.lock=!o.lock});say(o.lock?'🔒 Đã khóa ảnh – có thể viết, vẽ lên ảnh mà ảnh không bị xê dịch':'🔓 Đã mở khóa ảnh – kéo để di chuyển, kéo ô vuông góc dưới phải để phóng to/thu nhỏ');lastPop='';D()}});
const popZo=btn(pop,'🔍－',()=>{const o=byId(sel);if(o&&o.t==='cpy')txn(()=>cpyScale(o,0.8))}),popZi=btn(pop,'🔍＋',()=>{const o=byId(sel);if(o&&o.t==='cpy')txn(()=>cpyScale(o,1.25))});popZo.title='Thu nhỏ hình tách';popZi.title='Phóng to hình tách';
const popHide=btn(pop,'👁 Ẩn',()=>{if(sel!=null)toggleHide(sel)});const popDel=btn(pop,'🗑 Xóa',()=>{if(sel!=null)txn(()=>delWith([sel]))});
popHide.title='Ẩn / hiện đối tượng đang chọn (phím H)';popDel.title='Xóa đối tượng đang chọn (Delete)';
function toggleHide(id){const o=byId(id);if(!o)return;const h=!o.hid;txn(()=>{if(h)o.hid=true;else delete o.hid});
  if(h&&!showHid)sel=null;const n=o.n||TN[o.t]||'đối tượng';say(h?'🙈 Đã ẩn '+n+(showHid?'':' – bấm nút 🙈 (số hình ẩn) trên thanh công cụ để xem lại'):'👁 Đã hiện lại '+n);updHidBtn();D()}
let lastPop='';function popUpd(){const o=sel!=null&&byId(sel);if(!o||tool!=='sel'||act||txIn){if(lastPop!=='none'){pop.style.display='none';lastPop='none'}return}
  let a=selAt;const g=geo(sel);if(g&&g.k==='P')a=S(g.x,g.y);else if(!a)a=[W/2,40];
  const k=c.getBoundingClientRect().width/W,x=Math.max(4,Math.min(W-170,a[0]+14))*k,y=Math.max(4,Math.min(H-44,a[1]-50))*k,key=sel+'|'+x+'|'+y+'|'+!!o.hid+'|'+!!o.lock;popLock.style.display=o.t==='img'?'':'none';popZo.style.display=popZi.style.display=o.t==='cpy'?'':'none';popLock.textContent=o.lock?'🔓 Mở khóa':'🔒 Khóa';
  if(key===lastPop)return;lastPop=key;popHide.textContent=o.hid?'👁 Hiện lại':'🙈 Ẩn';pop.style.left=x+'px';pop.style.top=y+'px';pop.style.display='flex'}
function updHidBtn(){const n=Pg().objs.filter(o=>o.hid).length;hidBtn.textContent=(showHid?'👁 ':'🙈 ')+n;hidBtn.classList.toggle('p',showHid);
  hidBtn.title=showHid?'Đang hiện mờ '+n+' hình ẩn – bấm để giấu lại':'Có '+n+' hình đang ẩn – bấm để hiện mờ, rồi chọn hình và bấm “Hiện lại”'}

/* ---------- Chữ ---------- */
let txIn=null;function closeText(){if(txIn)txIn.blur()}
function openName(id){closeText();const o=byId(id),g=geo(id);if(!o||!g||g.k!=='P')return;const r=c.getBoundingClientRect(),k=r.width/W,[X,Y]=S(g.x,g.y);
  const inp=el('input','bp-in');inp.type='text';inp.maxLength=8;inp.value=o.n||'';inp.style.minWidth='0';inp.style.width='120px';inp.style.fontWeight='700';inp.style.color='#1e293b';
  inp.style.left=Math.min(r.width-130,(X+12)*k)+'px';inp.style.top=Math.max(0,(Y-44)*k)+'px';inp.title='Gõ tên mới rồi nhấn Enter (Esc để hủy)';cvw.appendChild(inp);txIn=inp;
  setTimeout(()=>{inp.focus();inp.select()},0);sel=id;showLb=true;cLb.set(true);say('✍️ Gõ tên mới cho điểm '+(o.n||'')+' rồi nhấn Enter');let done=false;
  const fin=ok=>{if(done)return;done=true;const s2=inp.value.trim().replace(/\s+/g,'');inp.remove();if(txIn===inp)txIn=null;
    if(ok&&s2&&s2!==o.n){if(Pg().objs.some(q=>q!==o&&q.n===s2))say('⚠️ Tên “'+s2+'” đã có điểm khác dùng – hãy chọn tên khác');
      else{const old=o.n;txn(()=>{o.n=s2});flash.set(id,performance.now());say('✅ Đã đổi tên điểm '+old+' thành '+s2)}}D()};
  inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false)};inp.onblur=()=>fin(true)}
let lp=null;const LPT=600;function cancelLp(){if(lp){clearTimeout(lp.tm);lp=null;D()}}
function openText(p,o){closeText();const r=c.getBoundingClientRect(),k=r.width/W;const P=o?S(o.x,o.y):p;
  const inp=el('input','bp-in');inp.type='text';inp.value=o?o.s:'';inp.style.left=P[0]*k+'px';inp.style.top=(P[1]*k-3)+'px';inp.style.color=bg==='den'?'#111':(o?o.col:col);
  inp.style.fontSize=Math.max(12,(o?o.size*V().z:16+wid*2)*k)+'px';cvw.appendChild(inp);txIn=inp;try{inp.focus()}catch(_){}setTimeout(()=>inp.focus(),0);
  const w=Wd(...P);let done=false;
  const fin=ok=>{if(done)return;done=true;const s=inp.value.trim();inp.remove();if(txIn===inp)txIn=null;
    if(ok)txn(()=>{if(o){if(s)o.s=s;else delWith([o.id])}else if(s)add({t:'text',x:w[0],y:w[1],s,size:(16+wid*2)/V().z,col})});D()};
  inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false)};inp.onblur=()=>fin(true)}

/* ---------- Chuột, bút cảm ứng, chạm ---------- */
function zoomAt(p,f){const v=V(),[wx,wy]=Wd(...p);v.z=Math.max(.1,Math.min(25,v.z*f));v.ox=p[0]-wx*50*v.z;v.oy=p[1]+wy*50*v.z;inval();D();persist()}
function eraseAt(p){inval();const h=hitAt(p,o=>o.t!=='img',13);if(h!=null){delWith([h]);return true}return false}
const ptrs=new Map();let pinch=null,penSeen=false;
c.addEventListener('contextmenu',e=>e.preventDefault());
c.addEventListener('wheel',e=>{e.preventDefault();zoomAt(c.pos(e),Math.pow(1.0015,-e.deltaY))},{passive:false});
c.addEventListener('pointerdown',e=>{const p=c.pos(e);$('#side').classList.remove('open');try{c.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,p);mouse=p;inval();
  if(ptrs.size===2){cancelLp();if(act&&act.b&&snap0()!==act.b)pushUndo(act.b);act=null;const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,m:[(a[0]+b[0])/2,(a[1]+b[1])/2],z:V().z,ox:V().ox,oy:V().oy};D();return}
  if(ptrs.size>2)return;e.preventDefault();closeText();cancelLp();
  if(e.pointerType==='pen'&&!penOnly&&!penSeen){penSeen=true;penOnly=true;cPen.set(true);say('✍️ Đã nhận bút cảm ứng: <b>bút</b> để viết, <b>ngón tay</b> để kéo / xoay / phóng to (tắt ở ô “Chỉ bút viết”)')}
  if(penOnly&&e.pointerType==='touch'&&['pen','hl','smart','erase','laser','text'].includes(tool)){act=is3()?{k:'rot',s:p,th:cam().th,ph:cam().ph}:{k:'pan',s:p,ox:V().ox,oy:V().oy};D();return}
  if(e.button===0&&!['pen','hl','smart','laser','text','pan','erase'].includes(tool)){const h0=hitAt(p,o=>PTS.has(o.t));
    if(h0!=null)lp={id:h0,s:p,t0:performance.now(),tm:setTimeout(()=>{const a=act;lp=null;act=null;pend=[];if(a&&a.b&&snap0()!==a.b)restore(a.b);openName(h0)},LPT)}}
  if(e.button===1||e.button===2||tool==='pan'){act={k:'pan',s:p,ox:V().ox,oy:V().oy};c.style.cursor='grabbing';return}
  if(is3()&&(tool[0]==='3'||tool==='solid')){act={k:'g3',s:p,th:cam().th,ph:cam().ph};D();return}
  if(tool==='pen'||tool==='hl'||tool==='smart'){act={k:'ink',scr:[p]};
    if(is3()){const a0=act;setTimeout(()=>{if(act!==a0)return;const q=a0.scr,l=q[q.length-1];if(Math.hypot(l[0]-q[0][0],l[1]-q[0][1])<8){act={k:'rot',s:l,th:cam().th,ph:cam().ph};c.style.cursor='grabbing';say('🔄 Giữ và kéo để <b>xoay hình</b> (trái – phải, lên – xuống)');D()}},450)}}
  else if(tool==='erase'){act={k:'erase',b:snap0()};eraseAt(p)}
  else if(tool==='laser'){act={k:'laser'};laser.push({x:p[0],y:p[1],t:performance.now(),brk:true})}
  else if(tool==='text')openText(p);
  else if((tool==='sel'||tool==='cpy')&&cpyDown(p)){}else if(tool==='cpy'){}else if(tool==='sel'){const h=hitAt(p);sel=h;selAt=p;const o0=h!=null&&byId(h);
    if(is3()&&(h==null||(o0.t[0]==='3'&&!canDrag(o0))))act={k:'rot',s:p,th:cam().th,ph:cam().ph};
    else if(h==null)act={k:'pan',s:p,ox:V().ox,oy:V().oy};
    else{const o=byId(h),b=snap0(),w=Wd(...p);
      if(o.t==='img'&&o.lock)act={k:'pan',s:p,ox:V().ox,oy:V().oy};
      else if(o.t==='img'&&(()=>{const [X,Y]=S(o.x,o.y);return Math.hypot(p[0]-(X+o.w*sc()),p[1]-(Y+o.h*sc()))<14})())act={k:'imgsz',o,b,w0:o.w,h0:o.h,s:p};
      else if(canDrag(o))act={k:'pt',o,b,s:p,z0:o.z,h0:o.h,vert:e.shiftKey||vertMode};
      else if(o.t==='ink')act={k:'ink2',o,s:w,orig:o.pts.map(a=>a.slice()),b};
      else if(!PTS.has(o.t)){const bs=[...bases(h)];if(bs.length)act={k:'tr',list:bs,s:w,orig:bs.map(q=>[q.x,q.y]),b}}}}
  else txn(()=>geoClick(p));
  D()});
c.addEventListener('pointermove',e=>{const p=c.pos(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,p);mouse=p;inval();if(lp&&Math.hypot(p[0]-lp.s[0],p[1]-lp.s[1])>6)cancelLp();
  if(pinch){if(ptrs.size>=2){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2],v=V();
    const wx=(pinch.m[0]-pinch.ox)/(50*pinch.z),wy=(pinch.oy-pinch.m[1])/(50*pinch.z);v.z=Math.max(.1,Math.min(25,pinch.z*d/pinch.d));v.ox=m[0]-wx*50*v.z;v.oy=m[1]+wy*50*v.z}D();return}
  if(act){const k=act.k;
    if(k==='pan'){V().ox=act.ox+p[0]-act.s[0];V().oy=act.oy+p[1]-act.s[1]}
    else if(k==='ink'){const l=act.scr[act.scr.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>1.5)act.scr.push(p)}
    else if(k==='erase')eraseAt(p);
    else if(k==='laser')laser.push({x:p[0],y:p[1],t:performance.now()});
    else if(k==='g3'){if(Math.hypot(p[0]-act.s[0],p[1]-act.s[1])>6){act.k='rot';c.style.cursor='grabbing'}}
    if(act&&act.k==='imgsz'){const o=act.o,f=Math.max(0.05,(act.w0*sc()+(p[0]-act.s[0]))/(act.w0*sc()));o.w=+(act.w0*f).toFixed(3);o.h=+(act.h0*f).toFixed(3)}
    if(act&&act.k==='rot'){if(act.pv===undefined)act.pv=pivot3();const dx=p[0]-act.s[0],dy=p[1]-act.s[1];
      if(!act.ax&&Math.max(Math.abs(dx),Math.abs(dy))>8){act.ax=Math.abs(dx)>=Math.abs(dy)?'h':'v';act.s=p.slice();act.th=cam().th;act.ph=cam().ph}
      if(act.ax){const ddx=p[0]-act.s[0],ddy=p[1]-act.s[1];keepPivot(()=>{if(act.ax==='h')cam().th=act.th-ddx*0.4;else cam().ph=Math.max(-89,Math.min(89,act.ph+ddy*0.4))},act.pv)}}
    else if(k==='pt'&&act.o.t[0]==='3'){const o=act.o,f=rad(cam().ph),dz=(act.s[1]-p[1])/sc()/Math.max(0.15,Math.cos(f));
      if(o.t==='3pt'){if(act.vert){let z=act.z0+dz;if(snapOn)z=Math.round(z*2)/2;o.z=+z.toFixed(3)}else{const G=ground(p,o.z);o.x=G[0];o.y=G[1]}}
      else if(o.t==='3vert'||o.t==='3apex'){let h=act.h0+dz;if(Math.abs(h)<0.05)h=h<0?-0.05:0.05;o.h=+h.toFixed(3)}
      else if(o.t==='3pol'){try{const [A,Bq]=lineOf(o.ln),a=prj(A),b=prj(Bq),[X1,Y1]=S(a[0],a[1]),[X2,Y2]=S(b[0],b[1]);let u=((p[0]-X1)*(X2-X1)+(p[1]-Y1)*(Y2-Y1))/((X2-X1)**2+(Y2-Y1)**2||1);const lo=byId(o.ln);if(Array.isArray(o.ln)||(lo&&lo.t==='3seg'))u=cl01(u);else if(lo&&lo.t==='3ray')u=Math.max(0,u);if(snapOn)u=Math.round(u*4)/4;o.u=+u.toFixed(4)}catch(e){}}
      else if(o.t==='3onp'){try{const g=planeOf(o.pl),P=rayPlane(p,g);if(P){const w=sub3(P,g.O);o.s=+dot3(w,g.u).toFixed(4);o.tt=+dot3(w,g.v).toFixed(4)}}catch(e){}}
      else if(o.t==='3ons'){const sp=Pg().objs.find(q=>q.t==='3sph'&&q.c===o.c&&q.p===o.p);if(sp){const a=sphAngles(p,sp);o.la=a.la;o.lo=a.lo}}
      else if(o.t==='3pon'){const A=geo(o.a),B=geo(o.b);if(A&&B){const [X1,Y1]=S(A.x,A.y),[X2,Y2]=S(B.x,B.y);let u=cl01(((p[0]-X1)*(X2-X1)+(p[1]-Y1)*(Y2-Y1))/((X2-X1)**2+(Y2-Y1)**2||1));if(snapOn)u=Math.round(u*4)/4;o.u=+u.toFixed(4)}}}
    else if(k==='pt'){const o=act.o,[x,y]=act.map?cpyInv(act.map,Wd(...p)):Wd(...p);
      if(o.t==='pt'){let X=x,Y=y;if(snapOn){const s=gstep();X=Math.round(x/s)*s;Y=Math.round(y/s)*s}o.x=X;o.y=Y}
      else if(o.t==='rat'){const A=need(o.a),B=need(o.b),dx=B.x-A.x,dy=B.y-A.y,L2=dx*dx+dy*dy;if(L2>1e-12){const r=ratSnap(((x-A.x)*dx+(y-A.y)*dy)/L2);if(r[0]!==o.m||r[1]!==o.nn){o.m=r[0];o.nn=r[1];try{ratIn[0].value=r[0];ratIn[1].value=r[1]}catch(_){}say('📏 '+ratLbl(o))}}}
      else if(o.t==='pd'){const A=need(o.a),B=need(o.b),C=need(o.c),dx=B.x-A.x,dy=B.y-A.y,L2=dx*dx+dy*dy;let u=((x-C.x)*dx+(y-C.y)*dy)/L2;if(Math.abs(u)<0.03)u=u<0?-0.03:0.03;o.u=u}
      else if(o.t==='rot'){const C=need(o.c),P=need(o.p);let a=(Math.atan2(y-C.y,x-C.x)-Math.atan2(P.y-C.y,P.x-C.x))*180/Math.PI;while(a<=-180)a+=360;while(a>180)a-=360;if(Math.abs(a)<3)a=a<0?-3:3;if(Math.abs(a)>177)a=a<0?-177:177;if(o.gv){a=Math.round(a);if(a===0)a=1;try{angIn.value=Math.abs(a)}catch(_){}say('📐 Góc = '+Math.abs(a)+'° — kéo đầu tia mới để đổi số đo')}o.ang=a}
      else if(o.t==='eqp'){const A=need(o.a);if(o.ln!=null){const h=geo(o.ln);const d=h&&un(h.l[2]-h.l[0],h.l[3]-h.l[1]);if(d)o.sg=((x-A.x)*d[0]+(y-A.y)*d[1])>=0?1:-1}else{let a=Math.atan2(y-A.y,x-A.x);if(snapOn)a=Math.round(a/(Math.PI/12))*(Math.PI/12);o.u=+a.toFixed(5)}}
      else if(o.t==='ax'||o.t==='pq'){const A=need(o.a),B=need(o.b),px=-(B.y-A.y),py=B.x-A.x,L2=px*px+py*py;
        const bx=o.t==='ax'?(A.x+B.x)/2:A.x,by=o.t==='ax'?(A.y+B.y)/2:A.y;let u=((x-bx)*px+(y-by)*py)/L2;if(Math.abs(u)<0.02)u=u<0?-0.02:0.02;o.u=u}
      else{const g=geo(o.on);if(g&&g.k==='L'){const [x1,y1,x2,y2]=g.l,dx=x2-x1,dy=y2-y1;o.u=((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)}else if(g&&g.k==='C')o.u=Math.atan2(y-g.cy,x-g.cx)}}
    else if(cpyMove(p)){}else if(k==='tr'||k==='ink2'){const [x,y]=Wd(...p);let dx=x-act.s[0],dy=y-act.s[1];if(snapOn&&k==='tr'){const s=gstep();dx=Math.round(dx/s)*s;dy=Math.round(dy/s)*s}
      if(k==='tr')act.list.forEach((q,i)=>{q.x=act.orig[i][0]+dx;q.y=act.orig[i][1]+dy});else act.o.pts=act.orig.map(a=>[a[0]+dx,a[1]+dy])}
    inval()}
  else{const h=['pen','hl','smart','laser','text','pan'].includes(tool)?null:hitAt(p);if(h!==hov)hov=h;
    if(tool==='sel'){const o=hov!=null&&byId(hov);c.style.cursor=!o?'default':(canDrag(o)||o.t==='ink'||o.t==='text'||(!PTS.has(o.t)&&bases(hov).size))?'move':'pointer'}}
  D()});
function endPtr(e){ptrs.delete(e.pointerId);cancelLp();if(pinch){if(ptrs.size<2){pinch=null;persist()}return}
  if(!act)return;const a=act;act=null;
  if(a.k==='g3'){txn(()=>geoClick(a.s))}
  else if(a.k==='rot'){persist();if(tool!=='pan')c.style.cursor=tool==='sel'?'default':'crosshair'}
  else if(a.k==='ink'){const q=a.scr;if(tool==='smart')txn(()=>smartInk(q));
    else txn(()=>add({t:'ink',pts:q.map(v=>Wd(v[0],v[1]).map(z=>+z.toFixed(4))),col:tool==='hl'?hlCol():col,w:(tool==='hl'?hlW():wid)/V().z,hl:tool==='hl'||undefined}))}
  else if(a.b&&snap0()!==a.b)pushUndo(a.b);
  else if(a.k==='pan'||a.k==='rot')persist();
  if(tool==='pan')c.style.cursor='grab';inval();D()}
c.addEventListener('pointerup',endPtr);c.addEventListener('pointercancel',endPtr);
c.addEventListener('pointerleave',()=>{if(!act){mouse=null;hov=null;D()}});
c.addEventListener('dblclick',e=>{if(tool!=='sel')return;const h=hitAt(c.pos(e));const o=h!=null&&byId(h);if(o&&o.t==='text')openText(null,o);else if(o&&PTS.has(o.t))openName(h)});
document.addEventListener('keydown',e=>{if(!body.classList.contains('on'))return;const tg=(e.target.tagName||''),ty=(e.target.type||'');if(tg==='TEXTAREA'||(tg==='INPUT'&&!['checkbox','range','button','radio'].includes(ty)))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo()}
  else if(e.key==='Delete'||e.key==='Backspace'){if(sel!=null){e.preventDefault();txn(()=>delWith([sel]))}}
  else if(e.key==='Escape'){pend=[];sel=null;D()}
  else if(is3()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const C=cam(),st=e.shiftKey?15:5;
    keepPivot(()=>{if(e.key==='ArrowLeft')C.th+=st;if(e.key==='ArrowRight')C.th-=st;if(e.key==='ArrowUp')C.ph=Math.min(89,C.ph+st);if(e.key==='ArrowDown')C.ph=Math.max(-89,C.ph-st)});D();persist()}
  else if(k==='h'&&!e.ctrlKey&&!e.metaKey&&sel!=null)toggleHide(sel);
  else if(e.key==='Enter'&&tool==='poly'&&pend.length>=3){txn(()=>{add({t:'poly',ps:pend.slice()});pend=[]})}});

setTool('sel');bgSeg.set(bg);updHidBtn();updMode();
animLoop(dt=>{if(!body.classList.contains('on'))return;fit();if(autoRot&&is3()&&!act){keepPivot(()=>{cam().th+=dt*18});dirty=true}if(laser.length||flash.size||lp||(act&&act.k==='ink'))dirty=true;if(msg&&performance.now()-msgT>5000&&performance.now()-msgT<5100)dirty=true;if(!dirty)return;dirty=false;draw()});

/* ---------- TÁCH HÌNH: bản sao liên kết hai chiều với hình gốc ---------- */
// o = {t:'cpy', o: mã hình gốc (đa giác, vùng tô, đường tròn), k: tỉ lệ, tx, ty: dời}. Điểm của bản sao = k·(điểm gốc) + (tx, ty).
TN.cpy='Hình tách';
const cpyInv=(o,w)=>{const k=o.k||1;return [(w[0]-(o.tx||0))/k,(w[1]-(o.ty||0))/k]};
function cpySrcPts(o){const s=byId(o.o);if(!s)return [];if(s.ps)return s.ps;if(s.t==='cpy')return cpySrcPts(s);if(typeof s.c==='number')return [s.c];if(typeof s.a==='number'&&geo(s.id)&&geo(s.id).k==='C')return [s.a];return []}
function cpyCen(g){if(g.k==='C')return [g.cx,g.cy];let x=0,y=0;g.p.forEach(a=>{x+=a[0];y+=a[1]});return [x/g.p.length,y/g.p.length]}
function cpyVerts(o){const g=geo(o.id);if(!g)return [];const ids=cpySrcPts(o);
  if(g.k==='G')return g.p.map((a,i)=>({id:ids[i],q:S(a[0],a[1])})).filter(v=>v.id!=null);
  if(g.k==='C'&&ids.length){const h=geo(ids[0]);if(h&&h.k==='P'){const k=o.k||1;return [{id:ids[0],q:S(h.x*k+(o.tx||0),h.y*k+(o.ty||0))}]}}return []}
function cpyBox(o){const g=geo(o.id);if(!g)return null;let q;if(g.k==='G')q=g.p.map(a=>S(a[0],a[1]));else{const [X,Y]=S(g.cx,g.cy),r=g.r*sc();q=[[X-r,Y-r],[X+r,Y+r]]}
  const xs=q.map(a=>a[0]),ys=q.map(a=>a[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
function cpyDeco(o,g){const dark=bg==='den';ctx.save();
  let src=byId(o.o);while(src&&src.t==='cpy')src=byId(src.o);
  if(g.k==='G'&&src&&(src.ra||src.tk)){const q=g.p.map(a=>S(a[0],a[1])),n=q.length;ctx.strokeStyle=cm(o.col||'#2563eb');ctx.lineCap=ctx.lineJoin='round';
    (src.ra||[]).forEach(i=>{const b=q[i];if(!b)return;const u1=un(q[(i+1)%n][0]-b[0],q[(i+1)%n][1]-b[1]),u2=un(q[(i-1+n)%n][0]-b[0],q[(i-1+n)%n][1]-b[1]);if(!u1||!u2)return;const m=13;
      ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(b[0]+u1[0]*m,b[1]+u1[1]*m);ctx.lineTo(b[0]+(u1[0]+u2[0])*m,b[1]+(u1[1]+u2[1])*m);ctx.lineTo(b[0]+u2[0]*m,b[1]+u2[1]*m);ctx.stroke()});
    (src.tk||[]).forEach((t,i)=>{if(!t)return;const a=q[i],b=q[(i+1)%n];if(!a||!b)return;const u=un(b[0]-a[0],b[1]-a[1]);if(!u)return;const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;ctx.lineWidth=2.2;
      for(let j=0;j<t;j++){const off=(j-(t-1)/2)*6;ctx.beginPath();ctx.moveTo(mx+u[0]*off-u[1]*8,my+u[1]*off+u[0]*8);ctx.lineTo(mx+u[0]*off+u[1]*8,my+u[1]*off-u[0]*8);ctx.stroke()}})}
  for(const v of cpyVerts(o)){const so=byId(v.id),dr=so&&canDrag(so),[X,Y]=v.q;
    ctx.beginPath();ctx.arc(X,Y,dr?5.5:4.5,0,7);ctx.fillStyle=dr?(so.t==='pt'?'#2563eb':'#38bdf8'):(dark?'#e5e7eb':'#374151');ctx.fill();ctx.lineWidth=1.8;ctx.strokeStyle=dark?'#16332a':'#fff';ctx.stroke();
    if(showLb&&so&&so.n){const C=S(...cpyCen(g)),u=un(X-C[0],Y-C[1])||[0.7,-0.7],tx=X+u[0]*16,ty=Y+u[1]*16;
      ctx.font='bold 17px Segoe UI,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=4;ctx.strokeStyle=dark?'#16332a':'#fff';ctx.strokeText(so.n,tx,ty);ctx.fillStyle=dark?'#f8fafc':'#1e293b';ctx.fillText(so.n,tx,ty)}}
  const b=cpyBox(o);
  if(b&&sel===o.id&&tool==='sel'){ctx.fillStyle='#fff';ctx.strokeStyle='#f59e0b';ctx.lineWidth=2;ctx.fillRect(b[2]+14,b[3]+14,18,18);ctx.strokeRect(b[2]+14,b[3]+14,18,18);
    ctx.beginPath();ctx.moveTo(b[2]+18,b[3]+28);ctx.lineTo(b[2]+28,b[3]+18);ctx.moveTo(b[2]+22,b[3]+18);ctx.lineTo(b[2]+28,b[3]+18);ctx.lineTo(b[2]+28,b[3]+24);ctx.stroke()}
  if(b&&Math.abs((o.k||1)-1)>0.005){ctx.font='600 13px Segoe UI,Arial';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=dark?'#cbd5e1':'#64748b';ctx.fillText('×'+fmt(o.k,2),b[0],b[3]+8)}
  ctx.restore()}
function cpyScale(o,f){const g=geo(o.id),h=geo(o.o);if(!g||!h)return;const C=cpyCen(g),Cs=cpyCen(h),k=Math.max(.2,Math.min(8,(o.k||1)*f));
  o.k=+k.toFixed(4);o.tx=+(C[0]-k*Cs[0]).toFixed(4);o.ty=+(C[1]-k*Cs[1]).toFixed(4);inval();D()}
function cpyDown(p){
  const cs=Pg().objs.filter(o=>o.t==='cpy'&&vis(o));
  const so=sel!=null&&byId(sel);
  if(so&&so.t==='cpy'&&tool==='sel'){const b=cpyBox(so);if(b&&p[0]>=b[2]+8&&p[0]<=b[2]+38&&p[1]>=b[3]+8&&p[1]<=b[3]+38){const g=geo(so.id);
    act={k:'csz',o:so,b:snap0(),C:cpyCen(g),Cs:cpyCen(geo(so.o)),k0:so.k||1,d0:Math.max(8,Math.hypot(p[0]-S(...cpyCen(g))[0],p[1]-S(...cpyCen(g))[1]))};return true}}
  for(let i=cs.length-1;i>=0;i--){const o=cs[i];for(const v of cpyVerts(o)){if(Math.hypot(p[0]-v.q[0],p[1]-v.q[1])<12){const s=byId(v.id);
    if(s&&canDrag(s)){sel=o.id;selAt=p;act={k:'pt',o:s,b:snap0(),s:p,z0:s.z,h0:s.h,vert:false,map:o};return true}}}}
  const near=hitAt(p,o=>PTS.has(o.t));
  const hc=hitAt(p,o=>o.t==='cpy');
  if(hc!=null&&!(near!=null&&hitDist(byId(near),p)<10)){const o=byId(hc);sel=hc;selAt=p;act={k:'cmv',o,b:snap0(),s:Wd(...p),t0:[o.tx||0,o.ty||0]};return true}
  if(tool==='cpy'){const h=fillTarget(p);
    if(h==null){say('Bấm vào <b>bên trong</b> một đa giác, vùng đã tô hoặc hình tròn rồi kéo ra để tách hình');return true}
    const src=byId(h),b=snap0(),id=add({t:'cpy',o:h,k:1,tx:0,ty:0,col:src.t==='reg'?src.col:(src.col||col)});const o=byId(id);
    sel=id;selAt=p;act={k:'cmv',o,b,s:Wd(...p),t0:[0,0]};say('Kéo bản sao ra chỗ trống. Kéo đỉnh của bản sao thì hình gốc đổi theo; kéo ô vuông ở góc để phóng to, thu nhỏ.');return true}
  return false}
function cpyMove(p){const k=act.k;
  if(k==='cmv'){const [x,y]=Wd(...p);act.o.tx=+(act.t0[0]+x-act.s[0]).toFixed(4);act.o.ty=+(act.t0[1]+y-act.s[1]).toFixed(4);return true}
  if(k==='csz'){const Cs=S(...act.C),d=Math.hypot(p[0]-Cs[0],p[1]-Cs[1]),kk=Math.max(.2,Math.min(8,act.k0*d/act.d0));
    act.o.k=+kk.toFixed(4);act.o.tx=+(act.C[0]-kk*act.Cs[0]).toFixed(4);act.o.ty=+(act.C[1]-kk*act.Cs[1]).toFixed(4);return true}
  return false}

/* ---------- ĐIỂM CHIA ĐOẠN THẲNG THEO TỈ LỆ ---------- */
// o = {t:'rat', a, b, m, n}: điểm M thuộc đoạn AB với AM : MB = m : n
function ratLbl(o){const A=byId(o.a),B=byId(o.b);const a=(A&&A.n)||'A',b=(B&&B.n)||'B',mm=o.n||'M';return a+mm+' : '+mm+b+' = '+fmt(o.m,2)+' : '+fmt(o.nn,2)}
function ratSnap(u){u=Math.max(0.02,Math.min(0.98,u));let best=[1,1],bd=9;for(let q=2;q<=12;q++)for(let m=1;m<q;m++){const d=Math.abs(m/q-u)+q*0.0009;if(d<bd){bd=d;best=[m,q-m]}}
  const g=(x,y)=>y?g(y,x%y):x,k=g(best[0],best[1]);return [best[0]/k,best[1]/k]}
function ratDeco(o,g){if(sel!==o.id&&hov!==o.id)return;const A=geo(o.a),B=geo(o.b);if(!A||!B)return;const P=S(g.x,g.y),dark=bg==='den';
  ctx.save();ctx.font='600 14px Segoe UI,Arial';ctx.textAlign='center';ctx.textBaseline='top';const t=ratLbl(o),w=ctx.measureText(t).width+14;
  ctx.fillStyle=dark?'rgba(15,23,42,.85)':'rgba(255,255,255,.92)';ctx.strokeStyle='#6366f1';ctx.lineWidth=1.2;rr(P[0]-w/2,P[1]+12,w,22,6);ctx.fill();ctx.stroke();
  ctx.fillStyle=dark?'#e0e7ff':'#3730a3';ctx.fillText(t,P[0],P[1]+15);ctx.restore()}

/* ---------- ĐỒNG BỘ VỚI LỚP HỌC (web Kiến Học Toán) ---------- */
const HOST=window.__bpHost||null;
function __syFix(s){if(!SY)return s;try{const d=JSON.parse(s),pk=Pg().key;const keep=d.o.filter(o=>!SY.foreign(pk,o.id));const ids=new Set(keep.map(o=>o.id));
  d.o=keep.concat(Pg().objs.filter(o=>SY.foreign(pk,o.id)&&!SY.gone(pk,o.id)&&!ids.has(o.id)));return JSON.stringify(d)}catch(e){return s}}
function __syDeny(id){if(!SY||SY.canWrite()||['sel','pan','laser'].includes(id))return false;say('🔒 Bảng đang khoá: em xem và kéo thử hình trên máy mình. Khi thầy/cô cho phép, em viết, vẽ được lên bảng chung.');return true}
if(HOST){
  const T=HOST.role==='t',ME=HOST.me||null,myOwn=T?null:ME;
  const K=(pg,id)=>pg+'|'+id;
  const mirror=new Map(),goneS=new Set(),sentImgs=new Set();
  let metaJ='',metaKeys=new Set(),canW=T||!!HOST.can,busy=false,lastSend=0,waitTo=0;
  const BIG=()=>1e12+Math.floor(Math.random()*4e15);
  const newKey=()=>'p'+Math.random().toString(36).slice(2,9);
  const vOut=p=>{const v=p.view,s=50*v.z;return {cx:+((W/2-v.ox)/s).toFixed(4),cy:+((v.oy-H/2)/s).toFixed(4),z:v.z,w:W,h:H}};
  const vIn=(p,m)=>{if(!m||!isFinite(m.cx))return;const z=m.z*Math.min(W/(m.w||W),H/(m.h||H));p.view={ox:W/2-m.cx*50*z,oy:H/2+m.cy*50*z,z}};
  const metaOf=()=>({pi,bg,pages:pages.map(p=>({key:p.key,mode:p.mode||'2d',cam:p.cam||null,view:vOut(p)}))});
  const imgPut=(k,v)=>{pages.forEach(p=>{p.imgs=p.imgs||{};p.imgs[k]=v});sentImgs.add(k)};
  function applyMeta(m,first){
    if(!m||!Array.isArray(m.pages)||!m.pages.length)return;
    metaKeys=new Set(m.pages.map(x=>x.key));
    if(T&&!first)return;
    const np=m.pages.map(x=>{let p=pages.find(q=>q.key===x.key);if(!p){p=Object.assign(newPage(),{key:x.key});if(!T)p.nid=BIG()}
      if(x.mode)p.mode=x.mode;if(x.cam)p.cam=Object.assign({},x.cam);vIn(p,x.view);return p});
    pages=np;pi=Math.max(0,Math.min(np.length-1,m.pi|0));if(m.bg&&m.bg!==bg){bg=m.bg;try{bgSeg.set(bg)}catch(_){}}
    sel=null;pend=[];if(act&&act.k!=='pt')act=null;try{updMode();updHidBtn()}catch(_){}
    if(T)metaJ=JSON.stringify(metaOf());
  }
  function apply(d,first){
    if(!d)return;
    if(d.imgs)for(const k in d.imgs)imgPut(k,d.imgs[k]);
    if(d.meta)applyMeta(d.meta,first);
    for(const it of d.items||[]){const k=K(it.pg,it.id);
      if(!first&&!it.del&&it.own===myOwn&&mirror.has(k))continue;        // tiếng vọng của chính mình
      let p=pages.find(q=>q.key===it.pg);
      if(it.del){mirror.delete(k);goneS.add(k);if(p){const i=p.objs.findIndex(o=>o.id===it.id);if(i>=0){if(sel===it.id)sel=null;p.objs.splice(i,1)}}continue}
      goneS.delete(k);
      if(!p){p=Object.assign(newPage(),{key:it.pg});if(!T)p.nid=BIG();pages.push(p)}
      if(!it.d||typeof it.d!=='object'||!it.d.t)continue;it.d.id=it.id;const j=JSON.stringify(it.d);mirror.set(k,{j,own:it.own});
      const o=p.objs.find(q=>q.id===it.id);
      if(o){if(JSON.stringify(o)!==j){for(const key of Object.keys(o))delete o[key];Object.assign(o,JSON.parse(j))}}
      else p.objs.push(JSON.parse(j));
      if(T&&it.own==null&&p.nid<=it.id)p.nid=it.id+1;
    }
    if(first&&!T)pages.forEach(p=>{if(p.nid<1e12)p.nid=BIG()});
    inval();D();
  }
  function collect(){
    pages.forEach(p=>{if(!p.key)p.key=newKey()});
    const set=[],del=[],imgs={},seen=new Set();let n=0;
    for(const p of pages){if(!T&&!metaKeys.has(p.key))continue;
      for(const o of p.objs){const k=K(p.key,o.id);seen.add(k);const m=mirror.get(k);
        if(!T&&((m&&m.own!==ME)||(!m&&goneS.has(k))))continue;
        if(n>=300)continue;
        const j=JSON.stringify(o);if(m&&m.j===j)continue;
        set.push({pg:p.key,id:o.id,d:o});mirror.set(k,{j,own:m?m.own:myOwn});goneS.delete(k);n++;
        if(o.t==='img'&&o.key&&!sentImgs.has(o.key)){const src=allImg(o.key);if(src){imgs[o.key]=src;sentImgs.add(o.key)}}}}
    for(const [k,m] of mirror){if(seen.has(k))continue;const i=k.indexOf('|'),pg=k.slice(0,i),id=+k.slice(i+1);
      if(!T&&(m.own!==ME||!metaKeys.has(pg)))continue;
      del.push({pg,id});mirror.delete(k)}
    let meta=null;if(T){const mj=JSON.stringify(metaOf());if(mj!==metaJ){metaJ=mj;meta=JSON.parse(mj);metaKeys=new Set(meta.pages.map(x=>x.key))}}
    return (set.length||del.length||meta)?{set,del,imgs:Object.keys(imgs).length?imgs:null,meta}:null;
  }
  function tick(){if(busy||!canW||performance.now()<waitTo)return;const d=collect();if(!d)return;busy=true;lastSend=performance.now();
    Promise.resolve(HOST.push(d)).then(r=>{busy=false;if(r&&r.error){undoSend(d);waitTo=performance.now()+3000;if(r.locked){setCan(false)}else say('⚠️ '+r.error)}},
      e=>{busy=false;undoSend(d);waitTo=performance.now()+2500;say('⚠️ Chưa gửi được lên bảng chung, đang thử lại…')})}
  function undoSend(d){d.set.forEach(x=>{const k=K(x.pg,x.id),m=mirror.get(k);if(m)m.j=''});d.del.forEach(x=>mirror.set(K(x.pg,x.id),{j:'',own:myOwn}));if(d.meta)metaJ='';if(d.imgs)for(const k in d.imgs)sentImgs.delete(k)}
  function dropLocal(){for(const p of pages){p.objs=p.objs.filter(o=>mirror.has(K(p.key,o.id)))}sel=null;pend=[];act=null;inval();D()}
  function resetAll(){const by={};for(const [k,m] of mirror){const i=k.indexOf('|');(by[k.slice(0,i)]=by[k.slice(0,i)]||[]).push(JSON.parse(m.j||'null'))}
    for(const p of pages){p.objs=(by[p.key]||[]).filter(Boolean);p.undo=[];p.redo=[]}sel=null;pend=[];act=null;inval();D()}
  function setCan(v){v=!!v;if(T||v===canW)return;canW=v;document.body.classList.toggle('sy-lock',!v);if(!v){dropLocal();if(!['sel','pan','laser'].includes(tool))setTool('sel');say('🔒 Thầy/cô đã khoá bảng: em xem và kéo thử hình trên máy mình.')}
    else say('✏️ Thầy/cô đã cho phép em viết, vẽ lên bảng chung.');try{HOST.onCan&&HOST.onCan(v)}catch(_){}}
  SY={canWrite:()=>canW,foreign:(pg,id)=>{const m=mirror.get(K(pg,id));return !!m&&m.own!==myOwn},gone:(pg,id)=>goneS.has(K(pg,id)),
    apply,setCan,resetAll,flush:tick,stat:()=>({n:pages.reduce((a,p)=>a+p.objs.length,0),pages:pages.length,pi,can:canW,types:Pg().objs.map(o=>o.t).join(',')}),cv:()=>Pg().objs.filter(o=>o.t==='cpy').map(o=>cpyVerts(o).map(v=>[byId(v.id).n,Math.round(v.q[0]),Math.round(v.q[1])])),pts:()=>Pg().objs.filter(o=>PTS.has(o.t)).map(o=>{const g=geo(o.id);if(!g)return null;const q=S(g.x,g.y);return [o.n,Math.round(q[0]),Math.round(q[1])]}).filter(Boolean)};
  window.__bpSY=SY;
  document.body.classList.add(T?'sy-t':'sy-s');document.body.classList.toggle('sy-lock',!canW);
  if(HOST.init)apply(HOST.init,true);
  if(T&&!(HOST.init&&HOST.init.meta))pages.forEach(p=>{if(!p.key)p.key=newKey()});
  if(!T&&!canW&&!['sel','pan','laser'].includes(tool))setTool('sel');
  setInterval(tick,T?160:220);
}

}});
const t=TOOLS.find(x=>x.id==='bangphu');const v=el('section','tool on');v.id='v-bangphu';document.getElementById('main').appendChild(v);t.init(v);
})();
