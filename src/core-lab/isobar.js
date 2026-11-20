// 曲线球：一颗固定在星图世界里的透明球，被一圈圈纬线（等高线）箍住。每一圈在球正面的一段是实线，绕到背面的一段是点线，外面一道细轮廓圆。
// 正交投影：每个像素对应球面上前、后两个点，先在镜头坐标里求出来，用 uCamRot 的转置换回世界坐标，再换到「绕球轴」的物体坐标里取纬度 h，等间距处出线；
// h 上加一个沿经度行进的大波（球中腰偏北一带最强、两极趋 0）= 线一起拱成大 S 形，波峰处散开、波谷处挤拢。用户转星图 = 镜头转，球像地球仪一样跟着转过去。
window.CORE_LAB.push({id:'isobar',name:'13 · 曲线球',note:'一颗透明的球，被一圈圈蓝色等高线箍住，外面一道细细的圆轮廓。平视着看：线近乎水平、微微往下弯，只在最上面露出一点极点的小圈；朝我们这面是实线，绕到背面的半圈是小点线，隔着球看得见。它是真的立在星图里的：拖着转星图，它像地球仪一样跟着转，极点能转到正中间也能转到背后。球自己慢慢自转，一道大波沿着中腰滑过，把中间几圈线一起拱成大 S 形。缩小以后圈数少一些、线更细、波更小，仍然是一颗有轮廓的球。',glsl:`
float isobar_v(vec3 P,vec3 a,vec3 e1,vec3 e2,float R,float t,float N,float A,out float lon){
  float h=clamp(dot(P,a)/R,-1.,1.);
  lon=atan(dot(P,e2),dot(P,e1));
  float l=lon+t*TAU/50.;
  float c=1.-h*h;
  // 位移场 w(h,l,t)：线画在 h+w 取等间距值的地方，所以要求 d(h+w)/dh = 1+dw/dh 处处 > 0（线不相交、不折叠）。
  // 主波 = A*m*E(u)*sin(th)，u=h-.15（镜头不动时轴只朝我们前倾 12 度，球正面的正中是 h=sin12=.21，包络中心放在 .15 = 屏幕上正中略偏下，大波落在球正面中部），
  //        E=exp(-(u/.38)^2)（钟形，两极趋 0：h=.85 处位移只剩 A*.03、h=1 处 A*.007，极点小椭圆保持规整），
  //        th=3l+.8h-t*TAU/20（绕球一圈 3 个周期 = 正面看得见一个半；20 秒走过一个波长；周期数不进 d/dh），m=.8+.2cos(l-...) 在 [.6,1]。
  //        A 按大小分三档：大 .24（约 3.4 个线间距，间距 = 2/28）、中 .13（约 1.2 个间距，2/19）、小 .07（约 .4 个间距，2/11）。
  //   |d主波/dh| <= A*E*sqrt((2u/.38^2)^2+.8^2)，对 h 取最大 = 2.313*A  ->  .555 / .301 / .162
  // 次波 = .025*c*sin(l-3h+...)，c=1-h^2： |d/dh| <= .025*(2|h|+3c) <= .083
  // 呼吸 = .010*sin(9h+...)：             |d/dh| <= .010*9 = .090
  // 合计（逐点相加后再取最大，h 上扫 4 万点）dw/dh >= -.727 / -.473 / -.335，即 1+dw/dh >= .273 / .527 / .665 > 0；最挤处线距不小于平时的 .27 / .53 / .67 倍。
  float u=h-.15;
  float E=exp(-u*u/.1444);
  float th=3.*l+.8*h-t*TAU/20.;
  float w=A*(.8+.2*cos(l-t*TAU/67.+.9))*E*sin(th)
         +.025*c*sin(l-3.*h+t*.23+1.7)
         +.010*sin(h*9.+t*.50);
  return (h+w)*.5*N+.5*N;
}
// 三档画法（小 / 中 / 大：曲线条数、起伏、线宽、背面的点）。在分界线附近两档叠着淡入淡出，不硬切
vec4 isobar_ink(vec2 p,float t,float rpx,float dpr,float tier){
  float r=length(p), px=1./(rpx*dpr);
  float big=step(1.5,tier), mid=step(.5,tier);
  float R=.72;
  float inside=1.-smoothstep(R-px,R+px,r);
  float z=sqrt(max(R*R-r*r,0.));
  // 球轴 = 固定的世界方向：镜头不动时朝观众前倾 12 度、向右歪 6 度。
  float ph=radians(12.), ro=radians(6.);
  float cp=cos(ph), sp=sin(ph), cr=cos(ro), sr=sin(ro);
  vec3 a=vec3(sr*cp,cr*cp,sp);
  vec3 e1=vec3(cr,-sr,0.);
  vec3 e2=vec3(-sr*sp,-cr*sp,cp);
  float N=mix(11.,mix(19.,28.,big),mid);
  float A=mix(.07,mix(.13,.24,big),mid);
  // 镜头坐标（y 朝上）里的正面 / 背面球面点 -> 世界坐标。v*M = transpose(M)*v，WebGL1 没有 transpose()。
  vec3 Pf=vec3(p.x,-p.y,z)*uCamRot;
  vec3 Pb=vec3(p.x,-p.y,-z)*uCamRot;
  float lf, lb;
  float vf=isobar_v(Pf,a,e1,e2,R,t,N,A,lf);
  float vb=isobar_v(Pb,a,e1,e2,R,t,N,A,lb);
  float gf=max(length(vec2(dFdx(vf),dFdy(vf))),1e-5);
  float gb=max(length(vec2(dFdx(vb),dFdy(vb))),1e-5);
  float df=abs(fract(vf)-.5)/gf;
  // 线宽（CSS 像素）：大 1.4、中 .75、小 .62；线挤到间距不足时变细淡出。
  float hw=min(mix(.31,mix(.375,.70,big),mid)*dpr,.3/gf);
  float line=(1.-smoothstep(hw-.6,hw+.6,df))*smoothstep(.0,.25,hw);
  float db=abs(fract(vb)-.5)/gb;
  float hk=(floor(vb)+.5)/N*2.-1.;
  float rr=R*sqrt(max(1.-hk*hk,0.));
  float M=max(6.,floor(TAU*rr*rpx/mix(3.6,4.6,big)+.5));
  float al=(fract((lb+t*TAU/50.)*M/TAU)-.5)*TAU/M*rr/px;
  float rd=min(mix(.42,.68,big)*dpr,.3/gb);
  float dots=(1.-smoothstep(-.6,.6,length(vec2(db,al))-rd))*smoothstep(.0,.3,rd)*mid;
  // 轮廓圆：大 .8、中 .75、小 .7 CSS 像素宽的一道蓝线，正压在球的边上。
  float ow=mix(.35,mix(.375,.40,big),mid)*dpr;
  float rim=1.-smoothstep(ow-.6,ow+.6,abs(r-R)/px);
  float leak=mix(.86,1.,step(.05,hash(floor(p*rpx*1.3))));
  float blue=max(max(line,dots*.9)*inside,rim)*leak;
  return vec4(blue,0.,0.,0.);
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  float f1=smoothstep(26.,34.,rpx), f2=smoothstep(54.,66.,rpx);
  float lo=rpx<45.?0.:1., k=rpx<45.?f1:f2;
  vec4 o=isobar_ink(p,t,rpx,dpr,lo+step(.999,k));
  if(k>.001&&k<.999)o=mix(o,isobar_ink(p,t,rpx,dpr,lo+1.),k);
  return o;
}`});
