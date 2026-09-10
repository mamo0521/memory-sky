// Copyright (c) 2026 mamo and contributors. MIT.
// A broad annulus, with jittered positions and only a small collision clearance.
export function ringLayout(items, hash) {
  const placed=[];
  for(const item of [...items].sort((a,b)=>b.radius-a.radius||a.id.localeCompare(b.id))){
    if(item.core){placed.push({...item,x:0,y:0,z:0});continue;}
    let state=Math.floor(hash(item.id,137)*0xffffffff)||1;
    const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
    let candidate;
    for(let attempt=0;attempt<600;attempt++){
      const radius=Math.sqrt(155**2+random()*(230**2-155**2))+(attempt>450?(attempt-450)*.25:0);
      const angle=random()*Math.PI*2;
      candidate={...item,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,z:(random()-.5)*7};
      if(placed.every(p=>p.core||Math.hypot(p.x-candidate.x,p.y-candidate.y)>=(p.radius+item.radius)*.6+3))break;
    }
    placed.push(candidate);
  }
  return placed;
}
