// 陀螺仪：正中一颗网点球，外面几个带宽度的扁环各绕各的轴慢慢翻转。真三维：每个像素对球和每个环所在的平面求交，按远近互相遮挡。
// 环面固定在星图世界里（法线用 uCamRot 转进镜头）：拖着转星图 = 换个角度看同一台陀螺仪，环的椭圆和前后遮挡跟着变；转到正侧面时画成一根细线段。
// 「镀铬」= 朝光的一段留纸只勾边，侧光的一段沿带宽排线，背光的一段实心，再叠一层第二种墨出第三色。深色一律是碳灰（橘叠紫），碳灰处不留蓝。
window.CORE_LAB.push({id:'gyro',name:'7 · 陀螺仪',note:'一颗蓝网点球（背光面的网点换成碳灰、越背光越大直到连成一片），外面橘、黄、紫、蓝四个扁环各绕各的轴慢慢翻，近的压远的、绕到球后面会被挡住；环朝光处留纸勾边、背光处印成碳灰。它是立在星图里的实物：拖着转星图，环的椭圆和谁压谁跟着变，转到正侧面就是一根细线。',glsl:`
float gyro_screen(vec2 q,float ang,float pitch,float v,float dpr){
  float c=cos(ang), s=sin(ang);
  vec2 u=vec2(c*q.x+s*q.y,-s*q.x+c*q.y)/pitch;
  float d=length(fract(u)-.5);
  float rad=sqrt(clamp(v,0.,1.))*.74;
  float aa=.7/(dpr*pitch);
  return (1.-smoothstep(-aa,aa,d-rad))*step(.42,rad*pitch);
}
// 返回 (覆盖, 本色墨, 叠印墨, 交点 z)。tilt = 环面朝向离正对镜头偏多少，az = 往哪边倒。
vec4 gyro_ring(vec2 p,float tilt,float az,float R,float w,float fill,float mode,float rpx,float px,float tk,float hm){
  tilt*=tk;
  // tilt / az 定的是环在世界里的法线（世界 y 朝上，所以 y 取反：镜头不动时和原来屏幕里的样子一致）。
  // 世界 -> 镜头用 uCamRot，再把 y 翻回屏幕朝下。面内参考轴 A 同样转过去。
  vec3 n=uCamRot*vec3(sin(tilt)*cos(az),-sin(tilt)*sin(az),cos(tilt));
  vec3 A=uCamRot*vec3(-sin(az),-cos(az),0.);
  n.y=-n.y; A.y=-A.y;
  float nz=(n.z<0.?-1.:1.)*max(abs(n.z),.002);
  float z=-(n.x*p.x+n.y*p.y)/nz;
  float d0=max(length(vec3(p,z)),.0001);
  float g=max(length(vec2(p.x-z*n.x/nz,p.y-z*n.y/nz))/d0,.001);
  float hmin=hm/rpx;
  float hw=max(w*.5/g,hmin);
  float ins=hw-abs(d0-R)/g;
  float cover=smoothstep(-px,px,ins);
  // 侧视：椭圆扁到短半轴不足一条线宽时，补一根沿长轴的细线段（长 2R），环不会断、不会消失；z 取朝观众的那半圈
  vec2 nd=n.xy/max(length(n.xy),.0001);
  float se=dot(p,nd), sa=dot(p,vec2(-nd.y,nd.x));
  float thin=1.-smoothstep(hmin,2.*hmin,R*abs(n.z));
  // 很扁时「值 / 梯度」估出来的距离在椭圆两端外面会失真（长出尖刺），用椭圆的外接长方形裁掉
  cover*=smoothstep(-px,px,R+max(w*.5,hmin)-abs(sa))*smoothstep(-px,px,R*abs(n.z)+max(w*.5*abs(n.z),hmin)-abs(se));
  float seg=smoothstep(-px,px,hmin*thin-abs(se))*smoothstep(-px,px,R-abs(sa))*min(1.,thin*4.);
  cover=max(cover,seg);
  z=mix(z,sqrt(max(R*R-sa*sa,0.)),thin);
  vec3 X=vec3(p,z);
  float d=max(length(X),.0001);
  vec2 gq=vec2(dot(X,A),dot(X,cross(n,A)))/d;
  float fw=length(fwidth(gq));
  float lam=dot(X/d,normalize(vec3(-.55,-.6,.58)));
  float fl=fwidth(lam)*.7+.0001;
  float lw=max(.011,.65/rpx);
  float edge=1.-smoothstep(-px,px,ins-lw);
  // 这一处的带子在屏幕上不足约两个像素宽（侧着看）：勾边 + 留纸 + 排线放不下，合并成一条实心线
  float sol=1.-smoothstep(1.3,1.9,w*.5/g/hmin);
  float own=1., over=0.;
  if(mode>1.5){
    float N=floor(TAU*R*rpx/3.4);
    float duty=mix(.24,.8,smoothstep(.5,-.1,lam));
    float aw=N/TAU*fw*.7;
    float ph=atan(gq.y,gq.x)/TAU*N;
    float hat=aw>.45?step(.5,duty):1.-smoothstep(-aw,aw,abs(fract(ph)-.5)-duty*.5);
    float lit=smoothstep(-fl,fl,lam-.5);
    float dark=1.-smoothstep(-fl,fl,lam+.1);
    float glint=smoothstep(-fl,fl,lam+.8)*(1.-smoothstep(-fl,fl,lam+.71));
    float tone=max(hat*(1.-lit),dark)*(1.-glint);
    tone=mix(tone,dark*(1.-glint),sol);
    own=max(max(edge,tone),fill);
    over=fill>.5?tone:(1.-smoothstep(-fl,fl,lam+.38))*(1.-glint);
  }else if(mode>.5){
    float tone=1.-smoothstep(-fl,fl,lam-.62);
    own=max(max(edge,tone),fill);
    over=1.-smoothstep(-fl,fl,lam+.3);
  }
  if(mode>.5)own=max(own,sol);
  return vec4(cover,own,over,z);
}
// 三档画法（mode 0 小 / 1 中 / 2 大）。球和环的大小、带宽、哪几个环在 = 随 f1（小→中）、f2（中→大）连续变，
// 画法（网点 / 排线 / 平涂）在分界线附近两档叠着淡入淡出（硬切的话，核心大小在分界线附近晃时会一跳一跳）
vec4 gyro_ink(vec2 p,float t,float rpx,float dpr,float mode,float f1,float f2){
  float r=length(p), px=1./(rpx*dpr);
  // 小尺寸：带宽封顶约 1.2 个 CSS 像素（像大的那颗等比缩小），放不下的环淡掉
  float Rs=mix(mix(.34,.31,f1),.28,f2), w=mix(min(.068,1.2/rpx),.068,f2);
  vec4 RR=mix(mix(vec4(.57,.62,.74,.87),vec4(.52,.62,.70,.88),f1),vec4(.50,.62,.74,.86),f2);
  vec4 en=mix(mix(vec4(1.,0.,0.,1.),vec4(1.,0.,1.,1.),f1),vec4(1.),f2);
  float tk=mix(.8,1.,f1), hm=mix(.45,.65,f2);
  // 每个环：倾角在「略斜」和「很斜」之间慢慢摆，倒的方向慢慢转一圈
  vec4 q0=gyro_ring(p,.82+.42*sin(t*TAU/19.),.6+t*TAU/17.,RR.x,w,0.,mode,rpx,px,tk,hm);
  vec4 q1=gyro_ring(p,.80+.44*sin(t*TAU/27.+2.),2.1-t*TAU/23.,RR.y,w,1.,mode,rpx,px,tk,hm);
  vec4 q2=gyro_ring(p,.84+.40*sin(t*TAU/35.+4.),3.9+t*TAU/31.,RR.z,w,0.,mode,rpx,px,tk,hm);
  vec4 q3=gyro_ring(p,.78+.40*sin(t*TAU/45.+1.),1.2-t*TAU/41.,RR.w,w,0.,mode,rpx,px,tk,hm);
  // 球
  float sm=1.-smoothstep(-px,px,r-Rs);
  float zs=sqrt(max(Rs*Rs-r*r,0.));
  // 中间那颗球的明暗慢慢转（约 26 秒一圈）：亮面和碳灰的暗月牙绕着球走，像球自己在转
  float gyro_la=3.97+t*TAU/26.;
  float lamS=dot(vec3(p,zs)/Rs,vec3(.815*cos(gyro_la),.815*sin(gyro_la),.58));
  float fs=fwidth(lamS)*.7+.0001;
  float sb=1., sp=0.;
  if(mode>1.5){
    float pitch=clamp(rpx*.03,1.6,3.6);
    float vb=mix(.13,1.3,smoothstep(.8,-.2,lamS))*(1.-smoothstep(.93,.96,lamS));
    float rim=smoothstep(-px,px,r-(Rs-max(.011,.65/rpx)));
    sb=max(gyro_screen(p*rpx,.7853982,pitch,vb,dpr),rim);
    // 背光面：同一张网上的点换成碳灰，越背光越大，最后连成一片
    sp=gyro_screen(p*rpx,.7853982,pitch,smoothstep(.05,-.7,lamS)*1.3,dpr*2.);   // 边收窄一半：碳灰点外面那圈「蓝让开」的浅边才不显眼
  }else{
    sp=1.-smoothstep(-fs,fs,lamS+.05);
    if(mode>.5)sb=1.-smoothstep(-fs,fs,lamS-.955);
  }
  // 遮挡：环在球后面的那段被球挡住；环与环按交点远近互相压
  float cv[4]; float zz[4]; float vs[4];
  cv[0]=q0.x*en.x*(1.-sm*step(q0.w,0.)); zz[0]=q0.w;
  cv[1]=q1.x*en.y*(1.-sm*step(q1.w,0.)); zz[1]=q1.w;
  cv[2]=q2.x*en.z*(1.-sm*step(q2.w,0.)); zz[2]=q2.w;
  cv[3]=q3.x*en.w*(1.-sm*step(q3.w,0.)); zz[3]=q3.w;
  float front=1.;
  for(int i=0;i<4;i++){
    float v=cv[i];
    for(int j=0;j<4;j++){ if(j!=i)v*=1.-cv[j]*step(zz[i],zz[j]); }
    vs[i]=v;
    front*=1.-cv[i]*step(0.,zz[i]);
  }
  // 碳灰 = 橘 + 紫同处满墨。球：亮面蓝网点，背光面碳灰
  vec4 o=sm*front*vec4(sb*.92,sp*.92,sp*.92,0.);
  o+=vs[0]*vec4(0.,q0.y*.92,q0.z*.92,0.);            // 橘环，背光段叠紫 = 碳灰
  o+=vs[1]*vec4(0.,0.,q1.z*.85,q1.y*.92);            // 黄环，背光段叠紫 = 玫红
  o+=vs[2]*vec4(0.,q2.z*.92,q2.y*.92,0.);            // 紫环，背光段叠橘 = 碳灰
  o+=vs[3]*vec4(q3.y*.92,q3.z*.92,q3.z*.92,0.);      // 蓝环，背光段换成碳灰
  // 有碳灰的地方蓝一律让开（宿主只认墨量最大的两种，蓝混进来会串成红 / 靛）
  o.x*=1.-step(.03,min(o.y,o.z));
  return o;
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  float f1=smoothstep(22.,30.,rpx), f2=smoothstep(44.,56.,rpx);
  float lo=rpx<38.?0.:1., k=rpx<38.?f1:f2;
  vec4 o=gyro_ink(p,t,rpx,dpr,lo+step(.999,k),f1,f2);
  if(k>.001&&k<.999)o=mix(o,gyro_ink(p,t,rpx,dpr,lo+1.,f1,f2),k);
  return o;
}`});
