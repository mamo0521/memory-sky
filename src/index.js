import {createRenderer} from './renderer.js';
import './style.css';

/** Mount an isolated constellation. Memory text stays in the supplied data. */
export function createMemorySky(host, {data, title='记忆星穹', background, onOpen}={}) {
  if(!host || !data || !Array.isArray(data.nodes)) throw new TypeError('Provide a host element and data.nodes');
  data=structuredClone(data);
  data.nodes=data.nodes.map(n=>({...n,kind:n.kind||'event',importance:Number.isFinite(n.importance)?Math.max(1,Math.min(5,n.importance)):3,activation:Number.isFinite(n.activation)?n.activation:1}));
  const ids=new Set();
  for(const node of data.nodes){
    if(typeof node.id!=='string'||ids.has(node.id)) throw new TypeError('Each memory needs a unique string id');
    ids.add(node.id);
  }
  // Membership supplies a minimal chain even when no explicit edges were provided.
  data.links=[...(data.links||[])];
  const edgeKey=(a,b)=>JSON.stringify([a,b].sort());
  const edges=new Set([...data.links,...(data.softlinks||[])].map(([a,b])=>edgeKey(a,b)));
  for(const f of data.families||[]){
    const members=[...new Set(f.members||[])].filter(id=>ids.has(id));
    for(let i=1;i<members.length;i++){
      const pair=[members[i-1],members[i]],key=edgeKey(...pair);
      if(!edges.has(key)){data.links.push(pair);edges.add(key);}
    }
  }
  const root=document.createElement('section');root.className='memory-sky';root.setAttribute('aria-label',title);
  const map=document.createElement('div');map.className='ms-map';root.append(map);
  const heading=document.createElement('div');heading.className='ms-heading';heading.textContent=title;root.append(heading);
  const hint=document.createElement('p');hint.className='ms-hint';hint.textContent='拖动探索 · 点亮一颗星，再点名字读记忆';root.append(hint);
  const button=(text,label)=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(label)b.setAttribute('aria-label',label);return b;};
  const plus=button('+','记忆星座与寻找');plus.className='ms-plus ms-glass';plus.setAttribute('aria-expanded','false');root.append(plus);
  const gear=button('','星穹设置');gear.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"/><path d="M2 12.8799V11.1199C2 10.0799 2.85 9.21994 3.9 9.21994C5.71 9.21994 6.45 7.93994 5.54 6.36994C5.02 5.46994 5.33 4.29994 6.24 3.77994L7.97 2.78994C8.76 2.31994 9.78 2.59994 10.25 3.38994L10.36 3.57994C11.26 5.14994 12.74 5.14994 13.65 3.57994L13.76 3.38994C14.23 2.59994 15.25 2.31994 16.04 2.78994L17.77 3.77994C18.68 4.29994 18.99 5.46994 18.47 6.36994C17.56 7.93994 18.3 9.21994 20.11 9.21994C21.15 9.21994 22.01 10.0699 22.01 11.1199V12.8799C22.01 13.9199 21.16 14.7799 20.11 14.7799C18.3 14.7799 17.56 16.0599 18.47 17.6299C18.99 18.5399 18.68 19.6999 17.77 20.2199L16.04 21.2099C15.25 21.6799 14.23 21.3999 13.76 20.6099L13.65 20.4199C12.75 18.8499 11.27 18.8499 10.36 20.4199L10.25 20.6099C9.78 21.3999 8.76 21.6799 7.97 21.2099L6.24 20.2199C5.33 19.6999 5.02 18.5299 5.54 17.6299C6.45 16.0599 5.71 14.7799 3.9 14.7799C2.85 14.7799 2 13.9199 2 12.8799Z"/></svg>';gear.className='ms-plus ms-gear ms-glass';gear.setAttribute('aria-expanded','false');root.append(gear);
  const menu=document.createElement('div');menu.className='ms-menu ms-glass';menu.hidden=true;root.append(menu);
  const settings=document.createElement('div');settings.className='ms-menu ms-settings ms-glass';settings.hidden=true;root.append(settings);
  function select(into,label,options){
    const field=document.createElement('label');field.textContent=label;const control=document.createElement('select');
    for(const [value,text] of options){const o=document.createElement('option');o.value=value;o.textContent=text;control.append(o);}
    field.append(control);into.append(field);return control;
  }
  function group(into,label){const g=document.createElement('div');g.className='ms-group';const t=document.createElement('span');t.textContent=label;g.append(t);const row=document.createElement('div');row.className='ms-row';g.append(row);into.append(g);return row;}
  const families=data.families||[];
  const family=select(menu,'记忆星座',[['','全部记忆'],...families.map((f,i)=>[String(i),f.title])]);
  const directory=select(menu,'寻找记忆',[['','选择一颗星…'],...data.nodes.map(n=>[n.id,n.title||n.id])]);
  const SHAPES=[['free','自由星空'],['spiral','恒星轨道'],['ring','星环']];
  const shapeRow=group(settings,'造型');
  const shapeButtons=new Map(SHAPES.map(([value,text])=>{const b=button(text);b.dataset.value=value;b.setAttribute('aria-pressed','false');shapeRow.append(b);return [value,b];}));
  let shapeValue='free';
  function applyShape(value){shapeValue=['spiral','ring'].includes(value)?value:'free';for(const [v,b] of shapeButtons)b.setAttribute('aria-pressed',String(v===shapeValue));renderer.setShape(shapeValue);}
  const BACKGROUNDS=[['#726786','星穹紫'],['#5c526b','暮紫'],['#454651','墨灰'],['#6c728e','夜蓝']];
  const bgRow=group(settings,'背景');bgRow.classList.add('ms-swatches');
  const swatches=BACKGROUNDS.map(([color,name])=>{const b=button('',name);b.className='ms-swatch';b.style.background=color;b.dataset.value=color;b.setAttribute('aria-pressed','false');bgRow.append(b);return b;});
  function applyBackground(color){root.style.setProperty('--ms-bg',color);for(const b of swatches)b.setAttribute('aria-pressed',String(b.dataset.value===color));}
  const reset=button('重置视角');reset.className='ms-reset';settings.append(reset);
  const panel=document.createElement('section');panel.className='ms-memory ms-glass';panel.hidden=true;panel.setAttribute('aria-label','记忆正文');
  const close=button('×','收起记忆');close.className='ms-close';
  const date=document.createElement('p');date.className='ms-date';
  const memoryTitle=document.createElement('h2');memoryTitle.tabIndex=-1;
  const content=document.createElement('div');content.className='ms-content';
  const divider=document.createElement('hr');divider.className='ms-divider';
  panel.append(close,date,memoryTitle,divider,content);root.append(panel);
  const status=document.createElement('div');status.className='ms-status';status.setAttribute('role','status');root.append(status);
  host.append(root);
  let returnFocus=null, destroyed=false;
  function closePanel(restore=false){panel.hidden=true;hint.hidden=false;if(restore && returnFocus?.isConnected)returnFocus.focus();}
  function openMemory(node){
    returnFocus=document.activeElement;
    date.textContent=node.date||'';memoryTitle.textContent=node.title||'无题记忆';
    content.textContent=node.content||'这颗星还没有写下正文。';
    panel.hidden=false;hint.hidden=true;panel.scrollTop=0;memoryTitle.focus({preventScroll:true});onOpen?.(node);
  }
  const renderer=createRenderer(map,{expanded:true,data,study:true,onOpen:openMemory,onPick:()=>closePanel(),onClear:()=>closePanel()});
  applyBackground(BACKGROUNDS.some(([c])=>c===String(background).toLowerCase())?String(background).toLowerCase():BACKGROUNDS[0][0]);
  applyShape('free');
  const setMenu=open=>{menu.hidden=!open;plus.setAttribute('aria-expanded',String(open));if(open)setSettings(false);};
  const setSettings=open=>{settings.hidden=!open;gear.setAttribute('aria-expanded',String(open));if(open)setMenu(false);};
  plus.onclick=()=>setMenu(menu.hidden);
  gear.onclick=()=>setSettings(settings.hidden);
  close.onclick=()=>closePanel(true);
  for(const [value,b] of shapeButtons)b.onclick=async()=>{if(family.value!==''){family.value='';await chooseFamily();if(destroyed)return;}applyShape(value);setSettings(false);};
  for(const b of swatches)b.onclick=()=>applyBackground(b.dataset.value);
  async function chooseFamily(){
    closePanel();
    const f=family.value===''?null:families[Number(family.value)];
    const count=await renderer.setFamily(f?.members||null);if(destroyed)return;
    status.textContent=f?`${f.title} · ${count} 颗记忆`:'';
    for(const option of directory.options) option.disabled=!!(f && option.value && !f.members.includes(option.value));
    directory.value='';setMenu(false);
    if(f)openMemory({title:f.title,content:f.description});
  }
  family.onchange=chooseFamily;
  directory.onchange=()=>{if(directory.value)renderer.focus(directory.value);setMenu(false);};
  reset.onclick=()=>{renderer.resetView();setSettings(false);};
  root.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&e.target!==plus)setMenu(false);if(!settings.contains(e.target)&&e.target!==gear)setSettings(false);});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!panel.hidden)closePanel(true);else {setMenu(false);setSettings(false);plus.focus();}}});
  return {
    setShape(value){if(family.value!==''){family.value='';chooseFamily();}applyShape(value);},
    setBackground(color){applyBackground(color);},
    focus(id){renderer.focus(id);},
    destroy(){destroyed=true;renderer.destroy();root.remove();}
  };
}
