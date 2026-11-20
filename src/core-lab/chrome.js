// 酸性金属：一颗固定在星图世界里、慢慢翻滚的金属正十二面体。每个面按它在镜头里的朝向反射一片「环境」：
// 朝天 = 留纸 + 黄网点；朝两侧 = 碳灰网点（右边比左边亮一档）；朝地 / 正对镜头 = 上半碳灰由密到疏、下半让给蓝网点由疏到密（碳灰和蓝分区并置，不叠）。
// 每个面另有一个按面编号的固定小亮度偏移（四色着色，相邻面一定不同）。环境固定在镜头里，用户转星图时面依次转进天 / 侧 / 地换颜色。
// 所有大小走同一条路：网点间距跟着片半径缩（rpx*.0425，夹在 1.4–5 个 CSS 像素）；片半径 10–14 像素以下平滑退成每个面一个灰度。实体：外轮廓里挡住后面的球和连线。
window.CORE_LAB.push({id:'chrome',solid:true,name:'10 · 酸性金属',note:'一颗金属十二面体慢慢翻滚，每个面像镜子一样映出不同的环境：朝天的面留白带黄点，朝两边的面是深浅不同的碳灰网点，朝下和正对你的面上半是碳灰、下半透出一抹蓝色反光；相邻的面颜色或深浅一定不一样，棱上留一道细缝。它是真的立在星图里的：拖着转星图，面转到哪边就换成哪边的颜色。拉远了还是同一种画法，它是实心的，挡住后面的球。',glsl:`
const float chrome_H=.5086;
vec3 chrome_rx(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
vec3 chrome_ry(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
vec3 chrome_rz(vec3 v,float a){float c=cos(a),s=sin(a);return vec3(c*v.x-s*v.y,s*v.x+c*v.y,v.z);}
void chrome_slab(vec3 n,float id,vec3 ro,vec3 rd,inout float tN,inout float tF,inout vec3 nn,inout float fid){
  float d=dot(rd,n), o=dot(ro,n);
  if(abs(d)<.00001)d=.00001;
  float sg=d>0.?1.:-1.;
  float t1=(-sg*chrome_H-o)/d, t2=(sg*chrome_H-o)/d;
  if(t1>tN){tN=t1;nn=-sg*n;fid=id+(sg>0.?1.:0.);}
  tF=min(tF,t2);
}
void chrome_hit(vec3 ro,vec3 rd,out float tN,out float tF,out vec3 nn,out float fid){
  tN=-100.; tF=100.; nn=vec3(0.,0.,1.); fid=0.;
  chrome_slab(vec3(0.,.525731,.850651),0.,ro,rd,tN,tF,nn,fid);
  chrome_slab(vec3(0.,.525731,-.850651),2.,ro,rd,tN,tF,nn,fid);
  chrome_slab(vec3(.525731,.850651,0.),4.,ro,rd,tN,tF,nn,fid);
  chrome_slab(vec3(.525731,-.850651,0.),6.,ro,rd,tN,tF,nn,fid);
  chrome_slab(vec3(.850651,0.,.525731),8.,ro,rd,tN,tF,nn,fid);
  chrome_slab(vec3(-.850651,0.,.525731),10.,ro,rd,tN,tF,nn,fid);
}
void chrome_top2(float a,inout float m1,inout float m2){
  a=abs(a);
  if(a>m1){m2=m1;m1=a;}else if(a>m2){m2=a;}
}
// 每个面的固定亮度偏移（-1.5 / -.5 / .5 / 1.5 四档）：十二个面的四色着色，相邻两个面一定不同档
float chrome_off(float id){
  if(id<.5)return -1.5; if(id<1.5)return .5; if(id<2.5)return -1.5; if(id<3.5)return -.5;
  if(id<4.5)return .5; if(id<5.5)return 1.5; if(id<6.5)return -1.5; if(id<7.5)return 1.5;
  if(id<8.5)return 1.5; if(id<9.5)return -.5; if(id<10.5)return .5; return -.5;
}
// 翻滚 + 跟镜头转 + 求交（coreInk 和 coreSolid 共用）：返回 g = 光线在体内走过的长度，g>0 = 打中。
// R = 物体 -> 屏幕（p 的坐标：y 朝下、z 离开观众）= F * uCamRot * F * 自转；镜头坐标是 y 朝上、z 朝观众，所以两边各翻一次 y 和 z。屏幕 -> 物体用 v*R（纯旋转，转置 = 逆）。
float chrome_trace(vec2 p,float t,out vec3 ro,out vec3 rd,out float tN,out vec3 nn,out float fid,out mat3 R){
  float a=t*TAU/29.+.6, b=t*TAU/43.+.9, c=.38;
  mat3 M=mat3(chrome_rz(chrome_ry(chrome_rx(vec3(1.,0.,0.),b),a),c),
              chrome_rz(chrome_ry(chrome_rx(vec3(0.,1.,0.),b),a),c),
              chrome_rz(chrome_ry(chrome_rx(vec3(0.,0.,1.),b),a),c));
  mat3 F=mat3(1.,0.,0., 0.,-1.,0., 0.,0.,-1.);
  R=F*uCamRot*F*M;
  rd=vec3(0.,0.,1.)*R;
  ro=vec3(p,-2.)*R;
  float tF;
  chrome_hit(ro,rd,tN,tF,nn,fid);
  return tF-tN;
}
// 外轮廓覆盖率：gpx = 离轮廓多少个设备像素（里正外负）
float chrome_cover(float g,float px,out float gpx){
  gpx=g/max(fwidth(g),.00001);
  return smoothstep(-.7,.7,gpx)*step(-4.*px,g);
}
// 实心轮廓：十二面体的外轮廓（随翻滚和镜头转动变化的凸多边形）
float coreSolid(vec2 p,float t,float rpx,float dpr){
  vec3 ro,rd,nn; float tN,fid,gpx; mat3 R;
  float g=chrome_trace(p,t,ro,rd,tN,nn,fid,R);
  return chrome_cover(g,1./(rpx*dpr),gpx);
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  vec3 ro,rd,nn; float tN,fid,gpx; mat3 R;
  float g=chrome_trace(p,t,ro,rd,tN,nn,fid,R);
  float px=1./(rpx*dpr);
  float inside=chrome_cover(g,px,gpx);

  // 棱：面与面之间留一道细纸缝
  vec3 x=ro+rd*tN;
  float m1=0., m2=0.;
  chrome_top2(dot(x,vec3(0.,.525731,.850651)),m1,m2);
  chrome_top2(dot(x,vec3(0.,.525731,-.850651)),m1,m2);
  chrome_top2(dot(x,vec3(.525731,.850651,0.)),m1,m2);
  chrome_top2(dot(x,vec3(.525731,-.850651,0.)),m1,m2);
  chrome_top2(dot(x,vec3(.850651,0.,.525731)),m1,m2);
  chrome_top2(dot(x,vec3(-.850651,0.,.525731)),m1,m2);
  float e=(m1-m2)/.894;
  float epx=e/max(fwidth(e),.00001);
  float hwE=clamp(.0045*rpx,.36,.5)*dpr;   // 细缝总宽约 .72–1 个 CSS 像素
  float edge=1.-smoothstep(hwE-.7,hwE+.7,epx);

  // 这个面在镜头里的朝向（x 右、y 上、z 朝观众）-> 反射哪一片环境
  vec3 nf=R*nn;
  float up=-nf.y, sd=nf.x, fr=-nf.z;
  float sky=smoothstep(-.05,.6,up);
  float gnd=smoothstep(0.,-.7,up);
  float frn=smoothstep(.72,.98,fr);
  float dark=max(gnd,frn);
  float off=chrome_off(fid);
  // 面的基础碳灰量：天 = 亮，侧 = 中（右亮左暗），地 / 正对 = 暗；再加面编号的小偏移
  float Dn=clamp(.46-.40*sky+.34*gnd+.30*frn-.20*sd+.05*off,.03,.95);
  // 蓝反光占这个面的多少：朝地的面大半是蓝，正对镜头的面只在下沿一带
  float bsh=clamp(.9*gnd+.45*frn,0.,1.)*(1.-smoothstep(.05,.3,up));
  float bon=smoothstep(0.,.25,bsh);

  // 面内渐变坐标 gu：正对的面沿竖直方向（上端 -1 到下端 1）；越朝侧面，方向越横过来（靠外轮廓的一头 -1、靠里的一头 1）
  vec2 dir=normalize(vec2(-1.4*sd,1.));
  float nd=dot(nf.xy,dir);
  float gu=dot(p-nf.xy*chrome_H,dir)/(.389*sqrt(max(1.-nd*nd,.04)));
  float gamp=mix(.13,.42,dark);
  float D=mix(min(Dn+gamp,.97),max(Dn-gamp,0.),smoothstep(-1.,.7,gu));
  // 拉长的低频噪声做一点糊亮纹（只在侧面 / 天面，幅度比面间差小）
  vec3 tu=normalize(cross(nn,vec3(.3,.9,.4)));
  vec3 tv=cross(nn,tu);
  float seed=dot(nn,vec3(7.,13.,29.));
  float st=fbm(vec2(dot(x,tu)*5.5+seed,dot(x,tv)*1.1-seed));
  D+=.16*(st-.5)*(1.-dark)*smoothstep(.12,.3,Dn);
  // 碳灰和蓝分区并置：分界线 sp 以上是碳灰（往分界线网点缩到最小），以下是蓝（离分界线越远网点越大），中间隔一条窄窄的留白
  float sp=mix(.75,-.45,bsh)-.25*sd+.1*off;
  float k=gu-sp;
  D*=mix(1.,(.1+.9*smoothstep(-.04,-.3,k))*step(k,-.04),bon);
  float B=clamp(.8-.22*sd+.06*off,.5,.95)*(.1+.9*smoothstep(.04,.9,k))*step(.04,k)*bon;
  // 黄：朝天的面；越正对天越稀（接近留纸），稍偏一点是中等黄点
  float Y=smoothstep(.3,.6,up)*mix(.62,.14,smoothstep(.55,.95,up))*mix(.55,1.25,smoothstep(-1.,1.,gu))*(1.-.45*sd+.1*off);
  // 片半径 10–14 像素以下网点已经没意义：平滑退成每个面一种墨一个灰度（仍是细网点）
  float fine=smoothstep(10.,14.,rpx);
  float blueface=step(.6,bsh);
  D=mix(Dn*(1.-blueface),D,fine);
  B=mix(.45*blueface,B,fine);
  D=clamp(D,0.,1.); Y=clamp(Y,0.,1.);

  // 半色调：网格固定在纸上 45 度；点距跟着片半径等比缩，下限 1.4 个 CSS 像素
  float s=clamp(rpx*.0425,1.4,5.);
  vec2 q=vec2(p.x+p.y,p.y-p.x)*.70711*rpx/s;
  float aw=.7/(s*dpr);
  float d1=length(fract(q)-.5);
  float dotk=smoothstep(aw,-aw,d1-sqrt(D)*.74);
  dotk=max(dotk,step(.9,D));
  dotk*=step(.05,D);
  float dotb=smoothstep(aw,-aw,d1-sqrt(B)*.74)*step(.04,B);
  float d2=length(fract(q+.5)-.5);
  float doty=smoothstep(aw,-aw,d2-sqrt(Y)*.5)*step(.03,Y);

  // 棱两边墨少的地方（浅色面、碳灰和蓝之间的留白带）：纸缝里补一道细碳灰线（约 .6 个 CSS 像素），不然读不出折角
  float hwL=.3*dpr;
  float line=(1.-smoothstep(hwL-.7,hwL+.7,epx))*(1.-smoothstep(.16,.34,max(D,B)));

  float hwS=clamp(.0076*rpx,.65,.9)*dpr;   // 外轮廓线宽 .65–.9 个 CSS 像素
  float outline=inside*(1.-smoothstep(hwS-.7,hwS+.7,gpx));
  float carbon=max(max(dotk*(1.-edge),line),outline)*inside*.95;
  // 蓝、黄只印在完全没有碳灰的像素上（碳灰的抗锯齿边上也让开），免得第三种墨串色
  float clearK=(1.-edge)*(1.-step(.02,max(max(dotk,line),outline)));
  float blue=dotb*inside*clearK*.92;
  float yellow=doty*inside*clearK*(1.-step(.02,dotb))*.95;
  return vec4(blue,carbon,carbon,yellow);
}`});
