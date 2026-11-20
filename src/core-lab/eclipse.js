// 日蚀：正中一块深碳灰圆盘（橘 + 紫叠印，硬边正圆不动），后面偏向一侧的日冕全用半色调网点印出来（紫墨在里、黄墨在外，两套版错开一点）。
// 日冕的外沿像软团：半径随角度用低频噪声起伏、慢慢流动，再叠一个 4.6 秒的呼吸；网点大小场跟着外沿走。
window.CORE_LAB.push({id:'eclipse',name:'3 · 日蚀',note:'黑圆盘稳稳挡在前面，光从一侧软软地溢出来：紫网点贴着圆盘、黄网点在外，外沿像软团一样鼓起落下、慢慢呼吸，溢出的方向约 50 秒绕一圈。',glsl:`
float eclipse_ext(vec2 p,vec2 d,float t,float base,float soft){
  float r=max(length(p),.0001);
  vec2 dir=p/r;
  float w=max(.5+.5*dot(dir,d),0.);
  float wa=(vnoise(dir*1.25+vec2(t*.10,-t*.07)+5.3)-.5)*2.;
  float wb=(vnoise(dir*2.05+vec2(-t*.08,t*.11)+11.7)-.5)*2.;
  float wob=clamp(.75*wa+.45*wb,-.7,.7);
  float breath=sin(t*TAU/4.6);
  return (base+.38*pow(w,1.4))*(1.+soft*wob)*(1.+.07*breath);
}
float eclipse_dots(vec2 p,float ang,float pitch,float den,float rpx,float px){
  float ca=cos(ang), sa=sin(ang);
  vec2 f=fract(vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y)/pitch)-.5;
  float rad=.66*sqrt(clamp(den,0.,1.));
  float aa=px/pitch;
  return (1.-smoothstep(-aa,aa,length(f)-rad))*step(.5/rpx,rad*pitch);
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  float r=length(p), px=1./(rpx*dpr), R0=.36;
  float angD=.9+t*TAU/50.;
  vec2 d=vec2(cos(angD),sin(angD));
  float disc=1.-smoothstep(-px,px,r-R0);
  float pur, yel;
  if(rpx>=15.){   // 拉远到核只有十几像素宽之前都印网点；再小才换成两弯实心月牙
    vec2 p2=p-vec2(.8,-.6)*max(.012,1./rpx);
    float pitch=max(.034,min(3.4,max(2.3,rpx*.068))/rpx);   // 点距：大的时候 3.4 像素起，拉远了逐步收到 2.3 像素
    float E=eclipse_ext(p,d,t,.015,.6);
    float v=(r-R0)/E;
    pur=eclipse_dots(p,.26,pitch,1.-v/.56,rpx,px);
    float E2=eclipse_ext(p2,d,t,.015,.6);
    float v2=(length(p2)-R0)/E2;
    yel=eclipse_dots(p2,1.31,pitch,min(1.-v2,(v2-.06)*3.2),rpx,px);
  }else{
    float E=eclipse_ext(p,d,t,0.,.62);
    pur=1.-smoothstep(-px,px,r-(R0+.42*E));
    yel=1.-smoothstep(-px,px,r-(R0+.74*E));
  }
  float open=1.-disc;
  // 圆盘的墨量给到 .99：像黑洞一样不透——压在它上面的平涂球不再隐约透出一个影子；
  // 留 .01 是为了让满墨的网点 / 线（墨量 1）仍然赢过它，叠出白、红那些第三色。
  return vec4(0.,disc*.99,disc*.99+pur*open,yel*open);
}`});
