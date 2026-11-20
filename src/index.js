import {createRenderer,printPaper,PRINT_DEFAULT} from './renderer.js';
import './style.css';

// 底部渐变的预设色：酸性紫 / 酸性绿 / 柠檬黄（叠在纸上做正片叠底）
const GRAD_PRESETS=[['#B65CFF','酸性紫'],['#8FE33B','酸性绿'],['#F2F03C','柠檬黄'],['#C9733A','土橘']];

/** Mount an isolated constellation. Memory text stays in the supplied data. */
export function createMemorySky(host, {data, title='记忆星穹', background, onOpen, look, core}={}) {
  if(!host || !data || !Array.isArray(data.nodes)) throw new TypeError('Provide a host element and data.nodes');
  data=structuredClone(data);
  data.nodes=data.nodes.map(n=>({...n,kind:n.kind||'event',importance:Number.isFinite(n.importance)?Math.max(1,Math.min(5,n.importance)):3,activation:Number.isFinite(n.activation)?n.activation:1}));
  const ids=new Set();
  for(const node of data.nodes){
    if(typeof node.id!=='string'||ids.has(node.id)) throw new TypeError('Each memory needs a unique string id');
    ids.add(node.id);
  }
  // 连线先收拾一遍：两头都得是在场的记忆、同一对只留一条、任何一头是灵魂核心的线丢掉（核心不和任何记忆连线）。
  const coreIds=new Set(data.nodes.filter(n=>n.kind==='core').map(n=>n.id));
  const edgeKey=(a,b)=>JSON.stringify([a,b].sort());
  const seen=new Set();
  const tidy=list=>(Array.isArray(list)?list:[]).filter(e=>{
    if(!Array.isArray(e))return false;
    const [a,b]=e;
    if(!ids.has(a)||!ids.has(b)||a===b||coreIds.has(a)||coreIds.has(b))return false;
    const key=edgeKey(a,b);if(seen.has(key))return false;seen.add(key);return true;
  });
  data.links=tidy(data.links);
  // 同一个星座的成员两两相连：星图会把它们拉成一小撮，这一撮里面的线画得很淡、外面描一圈轮廓。
  const soft=new Set((Array.isArray(data.softlinks)?data.softlinks:[]).filter(Array.isArray).map(([a,b])=>edgeKey(a,b)));
  for(const f of data.families||[]){
    const members=[...new Set(f.members||[])].filter(id=>ids.has(id)&&!coreIds.has(id));
    for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
      const key=edgeKey(members[i],members[j]);
      if(seen.has(key))continue;
      seen.add(key);soft.delete(key);data.links.push([members[i],members[j]]);
    }
  }
  // 淡线：已经有实线的那一对不再画淡线
  data.softlinks=tidy((Array.isArray(data.softlinks)?data.softlinks:[]).filter(e=>Array.isArray(e)&&soft.has(edgeKey(e[0],e[1]))));
  const root=document.createElement('section');root.className='memory-sky';root.setAttribute('aria-label',title);
  const map=document.createElement('div');map.className='ms-map';root.append(map);
  // 印刷纸外观才显示的两层：底部一道渐变、四周一圈旧黄。都盖在星图上面、字和按钮下面。
  const gradLayer=document.createElement('div');gradLayer.className='ms-grad';const edgeLayer=document.createElement('div');edgeLayer.className='ms-edge';root.append(gradLayer,edgeLayer);
  const heading=document.createElement('div');heading.className='ms-heading';heading.textContent=title;root.append(heading);
  const hint=document.createElement('p');hint.className='ms-hint';hint.innerHTML='<span class="ms-hint-zh">拖动探索 · 点亮一颗星，再点名字读记忆</span><span class="ms-hint-en">interactive archive // drag to orbit</span>';root.append(hint);
  const button=(text,label)=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(label)b.setAttribute('aria-label',label);return b;};
  // 右上角两颗钮：左边换外观（一大一小两颗星，印刷纸下转半圈），右边「＋」开选项面板。所有选项都在这一个面板里。
  const ctrl=document.createElement('div');ctrl.className='ms-ctrl';root.append(ctrl);
  const lookBtn=button('','换成印刷纸');lookBtn.className='ms-btn ms-look';
  lookBtn.innerHTML='<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7 1.5c.5 3.4 1.6 4.5 5 5-3.4.5-4.5 1.6-5 5-.5-3.4-1.6-4.5-5-5 3.4-.5 4.5-1.6 5-5z"/><path d="M12.4 9.6c.25 1.6.75 2.1 2.3 2.4-1.55.25-2.05.75-2.3 2.3-.25-1.55-.75-2.05-2.3-2.3 1.55-.3 2.05-.8 2.3-2.4z"/></svg>';
  const plus=button('＋','星穹选项');plus.className='ms-btn ms-plus';plus.setAttribute('aria-expanded','false');
  ctrl.append(lookBtn,plus);
  const menu=document.createElement('div');menu.className='ms-panel';menu.setAttribute('role','group');menu.setAttribute('aria-label','星穹选项');menu.hidden=true;root.append(menu);
  // 面板里每一行都是「两个字的标签 + 右边的控件」。
  function row(label,control,cls=''){
    const r=document.createElement('div');r.className=('ms-row '+cls).trim();const t=document.createElement('span');t.textContent=label;
    r.append(t,control);menu.append(r);return r;
  }
  const box=cls=>{const d=document.createElement('div');d.className=cls;return d;};
  // 选项一律横排点选：定数的一行等分（.ms-chips），多的是能左右划的条（.ms-strip），右边缘淡出提示还有。
  // 每颗是 <button>，aria-pressed 表示选中；左右键在一排里挪焦点。
  function stripMouse(el){   // 电脑上用鼠标也能横着划：滚轮上下滚 = 左右滚；按住拖 = 左右拖（拖过 4px 就不算点击）。手机触摸本来就能划，这里只管鼠标和触控板
    el.addEventListener('wheel',e=>{ if(Math.abs(e.deltaY)<=Math.abs(e.deltaX)||el.scrollWidth<=el.clientWidth) return; e.preventDefault(); el.scrollLeft+=e.deltaY; },{passive:false});
    let x0=0,s0=0,down=false,moved=false;
    el.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse'||e.button!==0) return; down=true; moved=false; x0=e.clientX; s0=el.scrollLeft; });
    window.addEventListener('pointermove',e=>{ if(!down) return; const dx=e.clientX-x0; if(!moved&&Math.abs(dx)>4){ moved=true; el.style.scrollSnapType='none'; el.style.cursor='grabbing'; } if(moved) el.scrollLeft=s0-dx; });
    window.addEventListener('pointerup',()=>{ if(!down) return; down=false; el.style.scrollSnapType=''; el.style.cursor=''; if(moved){ el._dragged=true; setTimeout(()=>{el._dragged=false;},0); } });
    el.addEventListener('click',e=>{ if(el._dragged){ e.stopPropagation(); e.preventDefault(); } },true);
  }
    function chips(label,aria,options,cls,{strip=false,make}={}){
    const group=box(strip?'ms-strip '+(cls||''):'ms-chips '+(cls||''));group.setAttribute('role','group');group.setAttribute('aria-label',aria);
    const add=([value,text])=>{const b=make?make(value,text):button(text);b.dataset.value=value;b.setAttribute('aria-pressed','false');group.append(b);return b;};
    options.forEach(add);
    group.addEventListener('keydown',e=>{
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      const list=[...group.children],i=list.indexOf(document.activeElement);if(i<0)return;
      e.preventDefault();const next=list[Math.max(0,Math.min(list.length-1,i+(e.key==='ArrowRight'?1:-1)))];next.focus({preventScroll:true});reveal(group,next);
    });
    if(strip){group.addEventListener('scroll',()=>fade(group),{passive:true});stripMouse(group);}
    const r=row(label,group);
    return {group,row:r,add,
      mark(value){let on=null;for(const b of group.children){const p=b.dataset.value===String(value);b.setAttribute('aria-pressed',String(p));if(p)on=b;}return on;},
      onPick(fn){group.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&group.contains(b))fn(b.dataset.value);});}};
  }
  function fade(group){group.classList.toggle('ms-more',group.scrollLeft+group.clientWidth<group.scrollWidth-2);}
  // 把选中的（或给定的）那颗挪进看得见的地方；面板关着时量不到宽度，开面板时再调一次
  function reveal(group,b=group.querySelector('[aria-pressed=true]')){
    if(b&&group.clientWidth&&group.scrollWidth>group.clientWidth){
      const l=b.offsetLeft-group.offsetLeft,r=l+b.offsetWidth;
      if(l<group.scrollLeft)group.scrollLeft=Math.max(0,l-12);else if(r>group.scrollLeft+group.clientWidth)group.scrollLeft=r-group.clientWidth+16;
    }
    fade(group);
  }
  const families=data.families||[];
  const SHAPES=[['free','自由星空'],['spiral','恒星轨道'],['ring','星环']];
  const shapeChips=chips('造型','星图造型',SHAPES,'ms-3');
  // 核心：一排能左右划的文字小标签，和「星座」那排一样
  const coreChips=chips('核心','核心画法',[],'ms-tags',{strip:true});
  const familyChips=chips('星座','记忆星座',[['','全部'],...families.map((f,i)=>[String(i),f.title])],'ms-tags',{strip:true});
  let shapeValue='free',familyValue='';
  function applyShape(value){shapeValue=['spiral','ring'].includes(value)?value:'free';shapeChips.mark(shapeValue);renderer.setShape(shapeValue);}
  // 外观：星穹 = 夜空；印刷纸 = 旧纸底 + 油墨球。「核心 / 渐变」两行只在印刷纸下出现，「背景」只在星穹下出现。
  // 落下的字母和划过的小星星一直开着（面板里不让选）。
  const gradBox=box('ms-sub');
  // 颜色：一排圆色块——最左是自选（彩色细圈里一颗当前色，点开取色器），右边是预设；正在用的那颗外面一圈深墨细环
  const colorLine=box('ms-line');const colorTag=document.createElement('i');colorTag.textContent='颜色';
  const dots=box('ms-dots');dots.setAttribute('role','group');dots.setAttribute('aria-label','底部渐变色');
  const pick=document.createElement('span');pick.className='ms-pick';pick.title='自选颜色';
  const gradColor=document.createElement('input');gradColor.type='color';gradColor.setAttribute('aria-label','自选渐变色');pick.append(gradColor);dots.append(pick);
  const presetDots=GRAD_PRESETS.map(([c,name])=>{const b=button('',name);b.dataset.value=c;b.style.setProperty('--c',c);dots.append(b);return b;});
  colorLine.append(colorTag,dots);gradBox.append(colorLine);
  // 位置 / 透明：细的橘色网点滑杆，划过的那段点密
  function rangeTouch(i){   // 手机上滑杆好拖：手指按哪儿圆钮就跳到哪儿、按住左右拖就跟着走（iOS 自带的只认按准小圆钮再拖，按偏了就不动）
    const put=e=>{const r=i.getBoundingClientRect(),k=Math.max(0,Math.min(1,(e.clientX-r.left-6)/Math.max(1,r.width-12))),mn=+i.min||0,mx=+i.max||100,st=+i.step||1;
      const v=Math.round((mn+k*(mx-mn))/st)*st; if(String(v)!==i.value){i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));}};
    i.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();try{i.setPointerCapture(e.pointerId);}catch(_){}i._drag=true;put(e);});
    i.addEventListener('pointermove',e=>{if(i._drag)put(e);});
    const end=()=>{i._drag=false;}; i.addEventListener('pointerup',end); i.addEventListener('pointercancel',end);
  }
    const gradInput=(text,attrs)=>{const l=document.createElement('label');const t=document.createElement('i');t.textContent=text;const w=document.createElement('span');w.className='ms-rng';const i=document.createElement('input');i.type='range';Object.assign(i,attrs);i.setAttribute('aria-label','底部渐变'+text);rangeTouch(i);w.append(i);l.append(t,w);gradBox.append(l);return i;};
  const gradHeight=gradInput('位置',{min:0,max:100,step:2}),gradAlpha=gradInput('透明',{min:0,max:100,step:5});
  const gradRow=row('渐变',gradBox,'ms-top ms-sep');
  const BACKGROUNDS=[['#726786','星穹紫'],['#5c526b','暮紫'],['#454651','墨灰'],['#6c728e','夜蓝']];
  const bgBox=box('ms-swatches');
  const swatches=BACKGROUNDS.map(([color,name])=>{const b=button('',name);b.className='ms-swatch';b.style.background=color;b.dataset.value=color;b.setAttribute('aria-pressed','false');bgBox.append(b);return b;});
  const bgRow=row('背景',bgBox,'ms-sep');
  const printOnly=[coreChips.row,gradRow];
  const deco={letters:true,stars:true,grad:'#A996D8',gradH:40,gradA:100};
  let lookValue='sky';
  function applyLook(value){
    lookValue=value==='print'?'print':'sky';const print=lookValue==='print';
    renderer.setLook(lookValue);
    printPaper(root,print?PRINT_DEFAULT.paper:null,false);   // 纸铺在整块上；四周的旧黄由 .ms-edge 那一层画
    root.classList.toggle('ms-print',print);
    lookBtn.classList.toggle('ms-flip',print);lookBtn.title=print?'换成星穹':'换成印刷纸';lookBtn.setAttribute('aria-label',lookBtn.title);
    for(const el of printOnly)el.hidden=!print;
    bgRow.hidden=print;
  }
  function applyCore(id){renderer.setCore(id);if(!coreChips.mark(id))coreChips.mark('ripple');reveal(coreChips.group);}
  let gradCustom=deco.grad.toLowerCase();   // 自选那颗显示的颜色：上次自己挑的，选预设时不变
  function applyDeco(){
    renderer.setDeco(deco);
    root.style.setProperty('--ms-grad-c',deco.grad);root.style.setProperty('--ms-grad-h',deco.gradH+'%');root.style.setProperty('--ms-grad-a',String(deco.gradA/100));
    const preset=presetDots.find(b=>b.dataset.value===deco.grad.toUpperCase());
    if(!preset)gradCustom=deco.grad.toLowerCase();
    for(const b of presetDots)b.setAttribute('aria-pressed',String(b===preset));pick.setAttribute('aria-pressed',String(!preset));
    gradColor.value=gradCustom;gradHeight.value=deco.gradH;gradAlpha.value=deco.gradA;
    gradHeight.parentNode.style.setProperty('--p',String(deco.gradH/100));gradAlpha.parentNode.style.setProperty('--p',String(deco.gradA/100));
  }
  function applyBackground(color){root.style.setProperty('--ms-bg',color);for(const b of swatches)b.setAttribute('aria-pressed',String(b.dataset.value===color));}
  const reset=button('回到全图');reset.className='ms-reset';menu.append(reset);
  const panel=document.createElement('section');panel.className='ms-memory ms-glass';panel.hidden=true;panel.setAttribute('aria-label','记忆正文');
  const close=button('×','收起记忆');close.className='ms-close';
  const date=document.createElement('p');date.className='ms-date';
  const memoryTitle=document.createElement('h2');memoryTitle.tabIndex=-1;
  const content=document.createElement('div');content.className='ms-content';
  const scores=document.createElement('p');scores.className='ms-scores';
  const divider=document.createElement('hr');divider.className='ms-divider';
  panel.append(close,date,memoryTitle,scores,divider,content);root.append(panel);
  const status=document.createElement('div');status.className='ms-status';status.setAttribute('role','status');root.append(status);
  host.append(root);
  let returnFocus=null, destroyed=false;
  function closePanel(restore=false){panel.hidden=true;hint.hidden=false;if(restore && returnFocus?.isConnected)returnFocus.focus();}
  function openMemory(node){
    returnFocus=document.activeElement;
    date.textContent=node.date||'';memoryTitle.textContent=node.title||'无题记忆';
    content.textContent=node.content||'这颗星还没有写下正文。';
    // 打分一行：重要度、愉快、激动；哪个字段有数才写哪个，核心和星座简介没有就整行不显示
    const num=v=>v!=null&&v!==''&&Number.isFinite(+v), sign=v=>(+v<0?'−':'')+Math.abs(+v).toFixed(1).replace(/\.0$/,'');
    const parts=[num(node.importance)&&`重要度 ${+node.importance} / 5`,num(node.valence)&&`愉快 ${sign(node.valence)}`,num(node.arousal)&&`激动 ${sign(node.arousal)}`].filter(Boolean);
    scores.textContent=parts.join(' · ');scores.hidden=!parts.length||node.kind==='core';
    panel.hidden=false;hint.hidden=true;panel.scrollTop=0;memoryTitle.focus({preventScroll:true});onOpen?.(node);
  }
  const renderer=createRenderer(map,{expanded:true,data,study:true,onOpen:openMemory,onPick:()=>closePanel(),onClear:()=>closePanel()});
  renderer.setStamp({line:['i was born in','every memory of you'],sign:'',bars:true,bottom:66,scale:1.18});   // 右下角落款：编号 + slogan + 三道粗横线
  applyBackground(BACKGROUNDS.some(([c])=>c===String(background).toLowerCase())?String(background).toLowerCase():BACKGROUNDS[0][0]);
  applyShape('free');
  for(const {id,name} of renderer.coreStyles())coreChips.add([id,name]);
  familyChips.mark('');
  applyDeco();applyCore(core||'ripple');applyLook(look);
  const setMenu=open=>{menu.hidden=!open;plus.setAttribute('aria-expanded',String(open));if(open)for(const g of [coreChips.group,familyChips.group])reveal(g);};
  plus.onclick=()=>setMenu(menu.hidden);
  lookBtn.onclick=()=>applyLook(lookValue==='print'?'sky':'print');
  close.onclick=()=>closePanel(true);
  shapeChips.onPick(async value=>{if(familyValue!==''){await chooseFamily('');if(destroyed)return;}applyShape(value);setMenu(false);});
  for(const b of swatches)b.onclick=()=>applyBackground(b.dataset.value);
  coreChips.onPick(applyCore);
  for(const b of presetDots)b.onclick=()=>{deco.grad=b.dataset.value;applyDeco();};
  gradColor.oninput=()=>{deco.grad=gradColor.value.toUpperCase();applyDeco();};
  gradHeight.oninput=()=>{deco.gradH=Number(gradHeight.value);applyDeco();};
  gradAlpha.oninput=()=>{deco.gradA=Number(gradAlpha.value);applyDeco();};
  async function chooseFamily(value){
    familyValue=value;familyChips.mark(value);reveal(familyChips.group);
    closePanel();
    const f=value===''?null:families[Number(value)];
    const count=await renderer.setFamily(f?.members||null);if(destroyed)return;
    status.textContent=f?`${f.title} · ${count} 颗记忆`:'';
    setMenu(false);
    if(f)openMemory({title:f.title,content:f.description});
  }
  familyChips.onPick(chooseFamily);
  reset.onclick=async()=>{setMenu(false);if(familyValue!==''){await chooseFamily('');if(destroyed)return;}renderer.resetView();};   // 回到全图：先退出星座，再把镜头拉回原位
  root.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!plus.contains(e.target))setMenu(false);});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!panel.hidden)closePanel(true);else if(!menu.hidden){setMenu(false);plus.focus();}}});
  return {
    setShape(value){if(familyValue!=='')chooseFamily('');applyShape(value);},
    setBackground(color){applyBackground(color);},
    setLook(value){applyLook(value);},
    setCore(id){applyCore(id);},
    focus(id){renderer.focus(id);},
    rec:renderer.rec,   // 录制用接口（film/ 逐帧出片），见 renderer.js 的 rec
    destroy(){destroyed=true;renderer.destroy();root.remove();}
  };
}
