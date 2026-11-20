// 印刷纸外观的画面装饰：
// 慢慢往下落的字母和符号、划过去的手绘小星星。
// 字母：一直从屏幕上方往下落，镜头怎么转都一样（像黑客帝国那种字雨，但不整齐也不密）。
//   它们住在一个以星图中心为中心的方盒里，方盒跟着镜头转（所以「下」永远是屏幕的下）；
//   大小是星图里的真实大小：远的小、近的大，镜头拉远整体跟着变小（和星穹背景的星尘一个道理）。
// 星星：和字母住同一个方盒，从屏幕左下起、沿一道弧划到右边（先陡后平，到头略往下掉），远近铺开、近大远小。
// 位置用固定种子生成，每次打开一样。
function rng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=Math.imul(t^t>>>15,1|t);x^=x+Math.imul(x^x>>>7,61|x);return((x^x>>>14)>>>0)/4294967296;};}
// 字体在包里（src/assets/fonts，由 style.css 声明成 MemorySky* 这几个名字）；没加载到就落到后面的系统字体，画面照常。
const FONTS=['400 96px "MemorySkyAboreto",Georgia,serif','400 96px "MemorySkyPlayfair",Georgia,serif','italic 400 96px "MemorySkyPlayfair",Georgia,serif','400 96px "MemorySkyCaveat","Bradley Hand","Segoe Print",cursive','500 96px Georgia,"Times New Roman",serif','400 96px ui-monospace,Menlo,monospace'];
const MONO=FONTS[5];
const TEXT='IWASBORNINEVERYMEMORYOFYOUstarsandpaper';
const CODE=['{ }','</>','=>','//','&&','#','[ ]','( )',';','::','!=','0x','*','@','%','~','+','_','|'];
const SIGN=['∞','π','λ','Σ','∴','≈','∆','°','√','∫','✦','☽','☉','♄','♃','†','№','¶','§'];
const ELEM=['Au','Ag','Fe','He','Li','Ne','C','O','H₂O','O₂','Na','Hg','Si','Xe'];
const INK='#6e635b';          // 字和星星描边的颜色：比连线的深墨灰一档，不压得太黑
const BOX=330;                // 它们活动的范围：以核心为中心、边长 660 的一个方盒
const NEAR=[85,135];          // 离镜头这么近就淡出：贴到脸上的大字不要（也就限制了最大能有多大）
const STARS=6;
const SIDE=r=>(r<.5?-1:1)*BOX*Math.sqrt(Math.abs(r*2-1));   // 0–1 的随机数 → 左右位置：越靠两边越多，正中间最少（中间是核心，字别老从它身上穿）
// 字母分三档：[个数, 最小字高, 最大字高]（星图里的单位，球的半径大约 2–9）。远近在方盒里均匀铺开。
const TIERS=[[32,7,14],[9,14,24],[1,24,34]];
const EDGE=60;               // 离方盒上下沿这么近就淡掉：拉远到能看见整个方盒时，字不会凭空冒出来

export function printDeco(T, scene){
  const group=new T.Group(); group.visible=false; scene.add(group);
  const R=rng(20261111);
  const spot=()=>new T.Vector3((R()*2-1)*BOX,(R()*2-1)*BOX,(R()*2-1)*BOX);
  // 抽一个字：字母 46% / 代码符号 24% / 数学星象符号 17% / 元素符号 13%。r 是 0–1 的随机数来源
  const glyph=r=>{
    const k=r();
    if(k<.46)return {ch:TEXT[Math.floor(r()*TEXT.length)],font:r()<.34?FONTS[3]:FONTS[Math.floor(r()*FONTS.length)]};   // 手写体 Caveat 多给一些：字母里四成多是它
    if(k<.70)return {ch:CODE[Math.floor(r()*CODE.length)],font:MONO};
    if(k<.87)return {ch:SIGN[Math.floor(r()*SIGN.length)],font:FONTS[1+Math.floor(r()*2)]};
    return {ch:ELEM[Math.floor(r()*ELEM.length)],font:FONTS[[0,4,5][Math.floor(r()*3)]]};
  };
  // 漏网之鱼：绝大多数字落下来就是那个字，只有 FISH 个一路落一路乱跳——像左上角那排小字里掉出来的。
  // 跳的时候只换字符：字体（等宽）和大小不变；间隔 0.09–0.8 秒，多数很短、偶尔顿一下。
  const FISH=4, FISH_SET='ABCDEFGHJKLMNPQRSTUVWXYZ0123456789&#%+=<>?';
  const fishCh=()=>FISH_SET[Math.floor(Math.random()*FISH_SET.length)], HOP=()=>.09+Math.random()*Math.random()*.7;
  const letterSpecs=TIERS.flatMap(([n,lo,hi])=>Array.from({length:n},()=>[lo,hi])).map(([lo,hi],i)=>{
    const g=glyph(R), size=lo+R()*(hi-lo), fish=i>=TIERS[0][0]&&i<TIERS[0][0]+FISH;   // 鱼从中号那档里出，看得清
    // 落得快慢：大的本来就快一些，再各自乘一个 0.45–1.9 的倍数，差得开
    return {ch:fish?'K':g.ch,font:fish?MONO:g.font,size,fish,x:SIDE(R()),y:(R()*2-1)*BOX,z:(R()*2-1)*BOX,fall:(5+size*.7)*(.45+R()*1.45),rot:(R()-.5)*.5,spin:.25+R()*.3,ph:R()*6.28,swap:0};
  });
  // 每颗星一道弧：u 从 0 走到 1 = 从方盒左边到右边；高度 = y0 + H × sin(1.75u)（起步陡、后面平、最后略降）。
  // 速度差得开：基础每秒 17 单位，六档 ×0.4 / 0.65 / 0.9 / 1.2 / 1.5 / 1.8，再各自抖一点。
  const arc=(st,r)=>{st.H=240+r()*260;st.y0=-BOX+r()*(BOX*2-st.H);st.z=(r()*2-1)*BOX;};
  const starSpecs=Array.from({length:STARS},(_,i)=>{const st={u:R(),v:17*[.4,.65,.9,1.2,1.5,1.8][i%6]*(.9+R()*.2),size:7+R()*10,rot:R()*6.28,spin:(R()-.5)*.8,fill:R()<.4,ink:Math.floor(R()*4),seed:Math.floor(R()*1000)};arc(st,R);return st;});
  const fishTex=new Map();   // 鱼跳来跳去就这四十来个字，贴图各画一次存着
  let letters=[], stars=[], inksKey='', inkList=['#6997D3','#EA6D1A','#C373D9','#F5D561'];
  const inkCol=new T.Color(INK), flashCol=new T.Color();

  function glyphTexture(ch,font){
    const c=document.createElement('canvas'),x=c.getContext('2d');
    x.font=font;const w=Math.ceil(x.measureText(ch).width)+28;c.width=w;c.height=136;
    x.font=font;x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(ch,w/2,70);
    return {tex:new T.CanvasTexture(c),aspect:w/136};
  }
  // 手绘星星：十个顶点各抖一点；同一颗画三张抖得不一样的，轮着放，像逐帧手绘
  function starTexture(st,frame,inks){
    const c=document.createElement('canvas'),x=c.getContext('2d');c.width=c.height=128;
    const path=seed=>{const r=rng(seed);x.beginPath();for(let k=0;k<10;k++){const a=k*Math.PI/5,rad=50*(k%2?.46:1)*(1+(r()-.5)*.22);const px=64+Math.cos(a)*rad+(r()-.5)*6,py=64+Math.sin(a)*rad+(r()-.5)*6;k?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();};
    x.lineJoin='round';
    if(st.fill){path(st.seed+frame*13);x.fillStyle=inks[st.ink]||INK;x.fill();}
    x.strokeStyle=INK;x.lineWidth=5;path(st.seed+frame*13);x.stroke();
    x.globalAlpha=.4;path(st.seed+frame*13+7);x.stroke();
    return new T.CanvasTexture(c);
  }
  const sprite=(map)=>{const m=new T.SpriteMaterial({map,transparent:true,depthWrite:false,depthTest:true});const s=new T.Sprite(m);s.renderOrder=2;group.add(s);return s;};
  function dispose(list){list.forEach(o=>{group.remove(o.sp);o.sp.material.dispose();(o.frames||[o.sp.material.map]).forEach(t=>t.dispose());});fishTex.forEach(t=>t.tex.dispose());fishTex.clear();}
  function buildLetters(){
    dispose(letters);
    letters=letterSpecs.map(L=>{const g=glyphTexture(L.ch,L.font),sp=sprite(g.tex);sp.material.color.copy(inkCol);return {sp,L,aspect:g.aspect,flash:0,ink:INK};});
  }
  function buildStars(inks){
    dispose(stars);
    stars=starSpecs.map(st=>{const frames=[0,1,2].map(f=>starTexture(st,f,inks)),sp=sprite(frames[0]);sp.scale.set(st.size,st.size,1);return {sp,st,frames};});
  }
  buildLetters();
  // 字体到了再重画一遍字（没到之前先用系统字顶着）
  try{Promise.all(['96px "MemorySkyAboreto"','96px "MemorySkyPlayfair"','italic 96px "MemorySkyPlayfair"','96px "MemorySkyCaveat"'].map(f=>document.fonts.load(f).catch(()=>0))).then(()=>{if(group.parent)buildLetters();});}catch(e){}

  return {
    show:{letters:true,stars:true},
    visible(v){group.visible=v;},
    // 油墨色变了就重画星星（填色用的是油墨四色）
    inks(list){const key=list.join(',');if(key===inksKey)return;inksKey=key;inkList=list.slice(0,4);buildStars(list);},
    // t = 星图的动画钟（秒），dt = 这一帧走了多久，target = 星图中心（镜头绕着它转的那一点）
    update(t,dt,camera,target){
      const near=d=>{const k=Math.min(1,Math.max(0,(d-NEAR[0])/(NEAR[1]-NEAR[0])));return k*k*(3-2*k);};
      camera.updateMatrixWorld();
      const e=camera.matrixWorld.elements;   // 镜头的右 / 上 / 后三个方向
      for(const o of letters){
        const {sp,L}=o;
        sp.visible=this.show.letters;if(!sp.visible)continue;
        if(L.fish){
          L.swap-=dt;
          if(L.swap<0){L.swap=HOP();L.ch=fishCh();let tx=fishTex.get(L.ch);if(!tx){tx=glyphTexture(L.ch,MONO);fishTex.set(L.ch,tx);}
            sp.material.map=tx.tex;o.aspect=tx.aspect;o.flash=1;o.ink=inkList[Math.floor(Math.random()*inkList.length)];}   // 跳的那一下直接是油墨色
          if(o.flash>0){o.flash=Math.max(0,o.flash-dt/.9);sp.material.color.copy(inkCol).lerp(flashCol.set(o.ink),Math.min(1,o.flash*2.2));}   // 先整个是油墨色，后半程才退回墨灰
        }
        L.y-=L.fall*dt;if(L.y<-BOX){L.y+=BOX*2;L.x=SIDE(Math.random());}      // 落出方盒底，从顶上另一个位置再落下来
        const x=L.x+Math.sin(t*.4+L.ph)*1.5;
        sp.position.set(target.x+e[0]*x+e[4]*L.y+e[8]*L.z,target.y+e[1]*x+e[5]*L.y+e[9]*L.z,target.z+e[2]*x+e[6]*L.y+e[10]*L.z);
        const h=(L.ch.length>1?Math.min(L.size,18):L.size)*136/96;sp.scale.set(h*o.aspect,h,1);   // 两三个字符的别太大
        sp.material.rotation=L.rot+Math.sin(t*L.spin+L.ph)*.1;       // 只轻轻摆，不翻过去
        sp.material.opacity=near(camera.position.distanceTo(sp.position))*Math.min(1,(BOX-Math.abs(L.y))/EDGE);
      }
      const frame=Math.floor(t/.26)%3;
      for(const {sp,st,frames} of stars){
        sp.visible=this.show.stars;if(!sp.visible)continue;
        st.u+=st.v*dt/(BOX*2);st.rot+=st.spin*dt;
        if(st.u>1){st.u-=1;arc(st,Math.random);}      // 划出右边，换一道弧从左边再来
        const sx=(st.u*2-1)*BOX, sy=st.y0+st.H*Math.sin(1.75*st.u);
        sp.position.set(target.x+e[0]*sx+e[4]*sy+e[8]*st.z,target.y+e[1]*sx+e[5]*sy+e[9]*st.z,target.z+e[2]*sx+e[6]*sy+e[10]*st.z);
        sp.material.rotation=st.rot;sp.material.map=frames[frame];
        sp.material.opacity=near(camera.position.distanceTo(sp.position))*Math.min(1,(BOX-Math.abs(sx))/EDGE);
      }
    },
    destroy(){dispose(letters);dispose(stars);letters=[];stars=[];scene.remove(group);}
  };
}

// 左上角几列竖排小字：像商品包装底下那种不起眼的小字，字符一直在换（参考 reactbits 的 letter glitch）。
// 拉远了才有——纸上拉远了比星穹空，星穹远处有银河；推近或点了某颗球就淡掉。贴在屏幕上，不跟镜头转。
const FINE_COLS=[38,38,31,24,12];      // 每列多少个字符：像一段话排到最后一列没排满
const FINE_SET='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&#%+=/<>.:·-';
export function printFine(container){
  const box=document.createElement('div');box.className='ms-fine';   // 位置可由外壳的样式表挪（它左上角有标题）
  // 字号 8.5px，录屏时也看得清；最上面是三个粗加号
  box.style.cssText='position:absolute;left:12px;top:12px;transform:none;display:none;flex-direction:column;align-items:flex-start;gap:9px;z-index:1;pointer-events:none;opacity:0;font:8.5px/1 ui-monospace,Menlo,monospace;letter-spacing:1.4px;color:#6e635b';
  const marks=document.createElementNS('http://www.w3.org/2000/svg','svg');
  marks.setAttribute('viewBox','0 0 34 10'); marks.style.cssText='display:block;width:40px;height:12px;margin-left:1px';
  marks.innerHTML=[0,12,24].map(x=>`<path d="M${x+5} .6V9.4M${x+.6} 5H${x+9.4}" stroke="#3a2f29" stroke-width="2.4" stroke-linecap="butt"/>`).join('');
  const cols=document.createElement('div'); cols.style.cssText='display:flex;gap:3.2px';
  box.append(marks,cols);
  const pick=()=>FINE_SET[Math.floor(Math.random()*FINE_SET.length)], cells=[];
  for(const n of FINE_COLS){
    const col=document.createElement('div');col.style.cssText='writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl;white-space:nowrap';
    for(let i=0;i<n;i++){const s=document.createElement('span');s.textContent=pick();s.style.transition='color .9s';col.appendChild(s);cells.push(s);}
    cols.appendChild(col);
  }
  container.appendChild(box);
  let timer=0, inks=['#6997D3','#EA6D1A'], shown=0;
  // 每 80 毫秒换 4 个字；换的那一下闪成油墨色，再慢慢退回墨灰
  const tick=()=>{for(let k=0;k<4;k++){const s=cells[Math.floor(Math.random()*cells.length)];s.textContent=pick();s.style.transition='none';s.style.color=inks[Math.floor(Math.random()*inks.length)];requestAnimationFrame(()=>{s.style.transition='color .9s';s.style.color='';});}};
  return {
    inks(list){inks=list.slice(0,4);},
    // a = 0–1 的显示程度；0 就整个收起、也不再换字
    set(a){
      a=Math.round(a*50)/50;if(a===shown)return;shown=a;
      box.style.display=a>0?'flex':'none';box.style.opacity=String(a*.78);
      if(a>0&&!timer)timer=setInterval(tick,80);else if(a<=0&&timer){clearInterval(timer);timer=0;}
    },
    destroy(){if(timer)clearInterval(timer);box.remove();}
  };
}

// 右下角的落款：印刷品边角那种小字——一行大一点的字、一两行小字、可选一个手写签名。很小、不带横线。
// 和左上角的小字同进同出（拉远了才有，推近或点了球就淡掉）；贴在屏幕上，不跟镜头转。
// 内容由 text 传进来：{big:'NO.0131', lines:['KEPT BY … · LIT BY …'], rows:[['OBSERVER','…'],…], plus:true, sign:'…'}
export function printStamp(container,{right=14,bottom=24}={}){
  const box=document.createElement('div');
  box.style.cssText=`position:absolute;right:${right}px;bottom:${bottom}px;transform:none;display:none;z-index:1;pointer-events:none;opacity:0;text-align:right;color:#6e635b;font:5.5px/1.7 ui-monospace,Menlo,monospace;letter-spacing:1.1px;text-transform:uppercase;white-space:nowrap`;
  // 编号：「NO.」是小号等宽字，数字是又细又高的窄体（像 80、90 年代票据上那种竖长数字）
  const big=document.createElement('div'); big.style.cssText='display:flex;justify-content:flex-end;align-items:baseline;gap:3px;line-height:1;color:#3a2f29;margin-bottom:3px';   // baseline：「NO.」和数字底边对齐
  const bigNo=document.createElement('span'); bigNo.textContent='NO.'; bigNo.style.cssText='font-size:8.5px;font-weight:600;letter-spacing:1px';
  const bigN=document.createElement('span');
  bigN.style.cssText='font:400 19px/1 "DIN Condensed","DINCondensed-Bold","Avenir Next Condensed","Roboto Condensed","Arial Narrow",sans-serif;font-weight:700;letter-spacing:.6px;font-variant-numeric:tabular-nums';   // DIN 窄体粗字：老路牌、老票据那种（iPhone / Mac 都自带）
  big.append(bigNo,bigN);
  const body=document.createElement('div');
  const sign=document.createElement('div');
  sign.style.cssText='font:400 23px/.9 "MemorySkyCaveat","Caveat","Bradley Hand","Segoe Print",cursive;letter-spacing:0;text-transform:none;color:#3a2f29;transform:rotate(-7deg);transform-origin:100% 100%;margin:0 2px 0 0';
  const swash=document.createElementNS('http://www.w3.org/2000/svg','svg');
  swash.setAttribute('viewBox','0 0 90 12'); swash.setAttribute('preserveAspectRatio','none');   // 不留边：线的右端和上面的字对齐
  swash.style.cssText='display:block;width:44px;height:8px;margin:5px 0 1px auto;overflow:visible';   // 一笔波浪在签名上面
  swash.innerHTML='<path d="M1 7.2 C 16 5.6, 30 7.4, 46 6.3 S 72 5.5, 89.4 6.6" fill="none" stroke="#3a2f29" stroke-width=".8" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';   // 手划的一笔：微微起伏，不抖
  // 不签名时可以换成三道粗横线（像标签角上那种条纹）
  const bars=document.createElement('div'); bars.style.cssText='display:none;width:28px;margin:7px 0 0 auto';
  bars.innerHTML='<i></i><i></i><i></i>'; [...bars.children].forEach((b,k)=>{b.style.cssText='display:block;height:1.6px;background:#3a2f29;margin-top:'+(k?'2.6px':'0');});
  // 横道下面紧挨着一排斜道
  bars.insertAdjacentHTML('beforeend','<svg viewBox="0 0 28 7" preserveAspectRatio="none" style="display:block;width:28px;height:7px;margin-top:3px">'+[0.8,6.4,12,17.6,23.2].map(x=>`<path d="M${x} 7 L${x+4} 0" stroke="#3a2f29" stroke-width="1.5"/>`).join('')+'</svg>');
  box.append(big,body,swash,sign,bars);
  container.appendChild(box);
  let shown=0;
  const div=(t,css)=>{const d=document.createElement('div');d.textContent=t;if(css)d.style.cssText=css;return d;};
  return {
    text({big:b='',lines=[],rows=[],plus=false,sign:s='',bars:bb=false}={}){
      bars.style.display=bb?'block':'none';
      bigN.textContent=String(b).replace(/^NO\./i,''); big.style.display=b?'flex':'none';
      sign.textContent=s; sign.style.display=s?'block':'none'; swash.style.display=s?'block':'none';
      const kids=lines.map(t=>div(t));
      if(rows.length){   // 两列：左边是项目名、右边是内容，像仪器铭牌
        const g=document.createElement('div'); g.style.cssText='display:inline-grid;grid-template-columns:auto auto;column-gap:7px;text-align:left';
        for(const [k,v] of rows){g.append(div(k,'opacity:.7'),div(v,'color:#3a2f29;font-weight:600'));}
        kids.push(g);
      }
      if(plus)kids.push(div('+ + +','font-size:7px;letter-spacing:2.5px;color:#3a2f29'));
      body.replaceChildren(...kids);
    },
    set(a){a=Math.round(a*50)/50;if(a===shown)return;shown=a;box.style.display=a>0?'block':'none';box.style.opacity=String(a*.82);},
    place(r,b){box.style.right=r+'px';box.style.bottom=b+'px';},
    scale(k){box.style.transformOrigin='100% 100%';box.style.transform=k&&k!==1?'scale('+k+')':'none';},   // 整块放大（录视频用）
    destroy(){box.remove();}
  };
}
