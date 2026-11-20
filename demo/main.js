import {createMemorySky} from '../src/index.js';
import {data} from './memories.js';
import './demo.css';
// 试玩页默认开成印刷纸。地址栏可带 ?look=sky&core=gyro 开成指定外观和核心。
// 控制台里也能切：sky.setLook('sky')、sky.setCore('cube')、sky.setShape('ring')。
const params=new URLSearchParams(location.search);
const host=document.querySelector('#sky');
window.sky=createMemorySky(host,{data,title:'Memory Sky / 记忆星穹',look:params.get('look')||'print',core:params.get('core')||'eclipse'});

// 新手引导：一根手画箭头指着右上角换外观的按钮。点过一次那个按钮就不再出现。
const HINT_KEY='memory-sky-demo-hint-done';
const seen=()=>{try{return localStorage.getItem(HINT_KEY)==='1';}catch{return false;}};
const look=host.querySelector('.ms-look');
if(look&&!seen()){
  const hint=document.createElement('div');
  hint.className='demo-hint';
  hint.innerHTML='<svg viewBox="0 0 96 76" aria-hidden="true"><path class="demo-hint-line" d="M10 70C22 52 50 66 50 44C50 24 66 14 86 10"/><path class="demo-hint-line" d="M72 4L86 10L77 22"/></svg><span>点这里换风格</span>';
  host.append(hint);
  const place=()=>{
    const h=host.getBoundingClientRect(),b=look.getBoundingClientRect();
    hint.style.right=Math.max(4,h.right-b.left-10)+'px';
    hint.style.top=(b.bottom-h.top+2)+'px';
  };
  place();addEventListener('resize',place);
  look.addEventListener('click',()=>{
    hint.classList.add('demo-hint-out');
    setTimeout(()=>hint.remove(),400);
    removeEventListener('resize',place);
    try{localStorage.setItem(HINT_KEY,'1');}catch{}
  },{once:true});
}
