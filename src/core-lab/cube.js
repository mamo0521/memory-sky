// 玻璃方块：一个固定在星图世界里、匀速慢转的透明立方体（36 秒一圈；用户转星图 = 从别的角度看它），里面关着一颗三色渐变球。真三维：每个像素对立方体做 slab 求交，得到进入的面和出去的面。
// 「折射」= 每个前表面各看到一个被推开、放大的球像，所以球在棱上是断开错位的；面的外角再印一弯淡蓝网点的折射球影。
// 球 = 半调网点渐变：暗侧蓝网点（大→小）→ 紫网点（小→大→小）→ 亮侧黄网点（小→大，最亮处近乎平涂）。蓝和紫同一张 45° 网、错开半格，半径之和小于半格对角线，所以只并置不叠印（不出藏蓝）；
// 黄用 15° 的另一张网，和紫重叠处宿主印成玫红；蓝和黄的范围不相交（不出绿）。渐变方向固定在屏幕上（光从右上偏前），不随立方体转。所有大小同一种画法，画幅半径 12 像素以下才退成三块平涂。
// 整个球像是实心的 coreSolid，后面的球和连线透不过来，玻璃面照旧透。所有深色线 = 橘 + 紫叠印的深碳灰，线宽随大小连续变细。
window.CORE_LAB.push({id:'cube',solid:true,name:'11 · 玻璃方块',note:'一个匀速慢慢转的玻璃立方体，深碳灰的细棱线，里面关着一颗网点印出来的渐变球：左边蓝、往右变紫、中间玫红、右上亮黄；隔着三个面看，球在棱上断开错位成三个像，面的外角有一弯淡淡的蓝网点球影；球的像是实心的，挡住后面的球和连线，玻璃面照旧透。它是真的立在星图里的：拖着转星图，就是把同一个方块转着看，球的明暗方向不变。',glsl:`
const float cube_H=.45;
vec3 cube_rx(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
vec3 cube_ry(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
vec3 cube_rz(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
float cube_max3(vec3 v){return max(v.x,max(v.y,v.z));}
float cube_min3(vec3 v){return min(v.x,min(v.y,v.z));}
// 到零线的距离，单位 = 设备像素（用真梯度长度，斜线和横竖线一样粗）
float cube_dpx(float v){return v/max(length(vec2(dFdx(v),dFdy(v))),.00001);}
float cube_screen(vec2 q,float ang,float pitch,float v,float dpr){
  float c=cos(ang), s=sin(ang);
  vec2 u=vec2(c*q.x+s*q.y,-s*q.x+c*q.y)/pitch;
  float d=length(fract(u)-.5);
  float rad=sqrt(clamp(v,0.,1.))*.74;
  float aa=.7/(dpr*pitch);
  return (1.-smoothstep(-aa,aa,d-rad))*step(.42,rad*pitch);
}
// 一套网点：u = 网格坐标，rad = 点半径（格为单位，超过 .707 就连成平涂）
float cube_dot(vec2 u,float rad,float pitch,float dpr){
  float aa=.7/(dpr*pitch);
  return (1.-smoothstep(-aa,aa,length(fract(u)-.5)-rad))*step(.24,rad*pitch);
}
// 玻璃面排线：hs = 疏密（1 密 / 2 疏）
float cube_hatch(vec3 x,vec3 m,float hs,float hw,float dpr){
  float hk=m.x*(x.y+x.z)/(.085*hs)+m.z*(x.x-x.y)/(.052*hs);
  float hf=max(fwidth(hk),.00001);
  return (1.-smoothstep(-.7,.7,abs(fract(hk)-.5)/hf-hw))*(1.-smoothstep(.3,.45,hf*dpr));
}
// 求交（coreInk 和 coreSolid 共用）：slab 求交，给出光线、进出距离、方块内覆盖率 inside、进入面 m 和它在屏幕上的法线方向 nd
void cube_trace(vec2 p,float t,float rpx,float dpr,out vec3 ro,out vec3 rd,out vec3 tmn,out vec3 tmx,out float tN,out float tF,out float gpx,out float inside,out vec3 m,out vec3 nn,out vec2 nd){
  float px=1./(rpx*dpr);
  // 匀速自转，36 秒一圈。物体 -> 屏幕 = Fy * uCamRot * Fy * 自转（同 facet.js：自转写在 p 的坐标里、y 朝下，镜头坐标 y 朝上，两边各翻一次）
  float a=t*TAU/36.+.45, b=.62, c=.13;
  mat3 M=mat3(cube_rz(cube_rx(cube_ry(vec3(1.,0.,0.),a),b),c),cube_rz(cube_rx(cube_ry(vec3(0.,1.,0.),a),b),c),cube_rz(cube_rx(cube_ry(vec3(0.,0.,1.),a),b),c));
  mat3 Fy=mat3(1.,0.,0., 0.,-1.,0., 0.,0.,1.);
  mat3 W=Fy*uCamRot*Fy*M;
  // 向量 * 矩阵 = 用转置（纯旋转的逆）乘：屏幕 -> 物体
  rd=vec3(0.,0.,1.)*W;
  ro=vec3(p,-2.)*W;
  rd+=step(abs(rd),vec3(.0001))*.0002;
  vec3 inv=1./rd;
  vec3 t1=(-cube_H-ro)*inv, t2=(cube_H-ro)*inv;
  tmn=min(t1,t2); tmx=max(t1,t2);
  tN=cube_max3(tmn); tF=cube_min3(tmx);
  float g=tF-tN;
  gpx=cube_dpx(g);
  inside=smoothstep(-.6,.6,gpx)*step(-4.*px,g);
  m=step(vec3(tN),tmn);
  nn=-sign(rd)*m;
  nd=(W*nn).xy;
}
// 球的像（共用）：按这个面的法线推开、放大。返回这个像素在球像里的覆盖率；q = 球像里的单位坐标，R = 像的半径
float cube_ball(vec2 p,vec2 nd,float inside,float rpx,float dpr,out vec2 q,out float R){
  float px=1./(rpx*dpr);
  // 球的大小、推开多少都随画幅连续变（分档的话，核心大小在分界线附近晃时球会一跳一跳）
  float Rs=mix(.31,.27,smoothstep(20.,56.,rpx));
  float push=mix(.2,.17,smoothstep(42.,58.,rpx));
  R=Rs*1.2;
  q=(p-nd*push)/R;
  return inside*(1.-smoothstep(-px,px,(length(q)-1.)*R));
}
// 实心轮廓：三个面上球像的并集；玻璃面、球影、棱线以外都是 0
float coreSolid(vec2 p,float t,float rpx,float dpr){
  vec3 ro,rd,tmn,tmx,m,nn; float tN,tF,gpx,inside; vec2 nd,q; float R;
  cube_trace(p,t,rpx,dpr,ro,rd,tmn,tmx,tN,tF,gpx,inside,m,nn,nd);
  return cube_ball(p,nd,inside,rpx,dpr,q,R);
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  float px=1./(rpx*dpr);
  // 大 / 中两档的细节（十字中线、虚棱、排线、球影）在分界线附近淡入淡出，不硬切
  float big=smoothstep(44.,56.,rpx), mid=smoothstep(22.,30.,rpx);
  vec3 ro,rd,tmn,tmx,m,nn; float tN,tF,gpx,inside; vec2 nd;
  cube_trace(p,t,rpx,dpr,ro,rd,tmn,tmx,tN,tF,gpx,inside,m,nn,nd);
  // 线宽（CSS 像素，随大小连续变）：外轮廓 17→.6 / 36→.72 / 118→1.2；前棱 .48 / .55 / .83；背面虚棱和十字中线再细一点
  float wO=min(.5+.006*rpx,1.25);
  float wE=min(.42+.0035*rpx,.85);
  float wB=min(.36+.0025*rpx,.66);
  float hwS=wO*dpr;
  float outline=inside*(1.-smoothstep(hwS-.6,hwS+.6,gpx));

  // 进入的面（前）和出去的面（后）
  vec3 mb=step(tmx,vec3(tF));
  vec3 x=ro+rd*tN, y=ro+rd*tF;

  // 前面的棱
  float e=cube_H-cube_max3(abs(x)*(1.-m));
  float hwE=wE*.5*dpr;
  float edge=inside*(1.-smoothstep(hwE-.6,hwE+.6,cube_dpx(e)));
  float frame=max(edge,outline);

  // 面的十字中线、背面的虚棱：最小那档放不下，省掉
  float dm=cube_min3(abs(x)+m*9.);
  float hwM=wB*.5*dpr;
  float cross_=mid*inside*(1.-smoothstep(hwM-.6,hwM+.6,cube_dpx(dm)));
  float eb=cube_H-cube_max3(abs(y)*(1.-mb));
  float dash=step(.42,fract((y.x+y.y+y.z)*mix(5.,8.5,big)));
  float back=mid*inside*dash*(1.-smoothstep(hwM-.6,hwM+.6,cube_dpx(eb)));

  // 球的像：按这个面的法线推开、放大
  vec2 q; float R;
  float B=cube_ball(p,nd,inside,rpx,dpr,q,R);
  float rq=length(q);
  vec3 n3=vec3(q,-sqrt(max(1.-rq*rq,0.)));
  // 明暗：光固定在屏幕上（右上偏前）。sv = 0 最暗（左下球边）… 1 最亮；再加一层很淡的低频云纹
  float lam=dot(n3,vec3(.851,-.300,-.431));
  float sv=pow(clamp((lam+.9)/1.9,0.,1.),1.5);
  sv+=(vnoise(q*1.6+vec2(t*.03,-t*.02)+m.xy*3.1+m.z*5.7)-.5)*.1;
  // 三套网点的半径（格为单位）：蓝 大→小；紫 小→大→小；黄 小→大→平涂。蓝 + 紫 ≤ .66 < 半格对角线 .707 → 不叠；蓝到 .36 收完，黄从 .36 才起 → 不叠
  float rB=.72*clamp(1.-sv/.36,0.,1.);
  float rP=min(.66*clamp((sv-.06)/.30,0.,1.),.70*clamp((.95-sv)/.50,0.,1.));
  float rY=.78*clamp((sv-.36)/.36,0.,1.);
  float bpitch=clamp(rpx*.03,1.3,3.4);
  vec2 bq=p*rpx/bpitch;
  vec2 u45=vec2(bq.x+bq.y,bq.y-bq.x)*.70710678;
  vec2 u15=vec2(.9659258*bq.x+.2588190*bq.y,-.2588190*bq.x+.9659258*bq.y);
  float dB, dP, dY;
  if(rpx>=12.){
    dB=cube_dot(u45,rB,bpitch,dpr);
    dP=cube_dot(u45+.5,rP,bpitch,dpr);
    dY=cube_dot(u15,rY,bpitch,dpr);
  }else{
    dB=step(sv,.3); dY=step(.52,sv); dP=(1.-dB)*(1.-dY);
  }

  // 玻璃面：稀疏的蓝色细排线，不同面方向 / 疏密不同，朝上的面留纸；中档排线减半、更细
  float hw=mix(.22,.3,big)*dpr;
  float hatch=mid*inside*(1.-m.y)*mix(cube_hatch(x,m,2.,hw,dpr),cube_hatch(x,m,1.,hw,dpr),big);

  // 折射球影：面的外角一弯淡淡的蓝网点
  float pitch=clamp(rpx*.03,1.6,3.6);
  vec2 gc=nd*cube_H*1.95;
  float rg=.31;
  float dg=length(p-gc)/rg;
  float G=inside*(1.-smoothstep(-px,px,(dg-1.)*rg));
  float gv=mix(.5,.08,smoothstep(0.,1.,dg));
  float ghost=mid*G*cube_screen(p*rpx,.7853982,pitch,gv,dpr);

  // 深碳灰的线（橘 + 紫叠印）；线压在所有东西上面
  // 球边一道很细的碳灰线（.45–.7 CSS 像素），亮黄一侧在米色纸上也有清楚的边
  float wR=min(.4+.003*rpx,.7)/rpx;
  float rim=B*smoothstep(-px,px,(rq-1.)*R+wR);
  float line=max(max(frame,rim),max(back,cross_*.95*big)*(1.-B)+cross_*.95*big*B);
  float keep=1.-line;
  float blue=max(max(hatch,ghost)*(1.-B)*.84,B*dB*.92)*keep;
  return vec4(blue,line*.95,max(line*.95,B*dP*.94*keep),B*dY*.96*keep);
}
`});
