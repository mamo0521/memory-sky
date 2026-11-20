// 三角面球：一颗固定在星图世界里、慢慢自转的正二十面体（用户转星图 = 从别的角度看它；光固定在镜头左上，面转过去就换一档印法）。每个三角面按朝光的程度换一种印法（留纸 / 网点 / 排线 / 蓝平涂 / 碳灰平涂），棱用碳灰墨线（橘叠紫）勾出来。
window.CORE_LAB.push({id:'facet',solid:true,name:'8 · 三角面球',note:'二十个三角面拼成的球，慢慢转：朝光的面留纸、往暗处依次是网点、排线、蓝平涂、碳灰平涂，棱也是碳灰线；每隔几秒有一两个面亮成橘或黄；透过浅色的面能看见背面的虚线棱和里面的紫核（颗粒质感、毛边，和外面的普通球一样；压在核上的网点印成碳灰）。整颗是实心的，挡住后面的球和连线。它是真的立在星图里的：拖着转星图，就是把同一颗多面体转着看，光一直从左上来，转过去的面跟着换印法。',glsl:`
const float facet_H=.5245;
mat3 facet_rot(vec3 a,float g){
  float c=cos(g), s=sin(g), k=1.-c;
  return mat3(k*a.x*a.x+c, k*a.x*a.y+s*a.z, k*a.x*a.z-s*a.y,
              k*a.x*a.y-s*a.z, k*a.y*a.y+c, k*a.y*a.z+s*a.x,
              k*a.x*a.z+s*a.y, k*a.y*a.z-s*a.x, k*a.z*a.z+c);
}
void facet_hit(vec3 N,float id,vec2 p,inout float zf,inout vec3 nf,inout float idf,inout float zb,inout vec3 nb){
  float s=N.z<0.?-1.:1.;
  vec3 M=N*s;
  float mz=max(M.z,.0001);
  float a=(facet_H-dot(M.xy,p))/mz;
  if(a<zf){zf=a;nf=M;idf=id+(s<0.?10.:0.);}
  float b=-(facet_H+dot(M.xy,p))/mz;
  if(b>zb){zb=b;nb=-M;}
}
void facet_e1(vec3 M,vec3 x,vec3 n,inout float best,inout vec3 bm){
  if(dot(M,n)>.99)return;
  float nz=abs(n.z)<.0001?.0001:n.z;
  float d=(facet_H-dot(M,x))/max(length(M.xy-M.z*n.xy/nz),.0001);
  if(d<best){best=d;bm=M;}
}
void facet_e(vec3 N,vec3 x,vec3 n,inout float best,inout vec3 bm){
  facet_e1(N,x,n,best,bm);
  facet_e1(-N,x,n,best,bm);
}
// 公共求交：自转 + 跟镜头转之后的十条面法线 + 每个像素最前 / 最后的面；返回外轮廓（投影出来的凸多边形）的覆盖率。coreInk 和 coreSolid 共用，严丝合缝。
float facet_sil(vec2 p,float t,float px,out vec3 n[10],out float zf,out vec3 nf,out float idf,out float zb,out vec3 nb,out float sd){
  // 物体 -> 世界 = 原来的自转；世界 -> 镜头 = uCamRot。自转是在 p 的坐标（y 朝下）里写的，镜头坐标 y 朝上，所以 uCamRot 两边各翻一次 y；镜头不动（单位阵）时两次翻转抵消 = 原来的朝向。
  mat3 Fy=mat3(1.,0.,0., 0.,-1.,0., 0.,0.,1.);
  mat3 R=Fy*uCamRot*Fy*facet_rot(normalize(vec3(.3,1.,.2)),t*TAU/36.)*facet_rot(normalize(vec3(1.,.2,.5)),.55);
  float q=.57735, A=.35682, B=.93417;
  n[0]=R*vec3(q,q,q); n[1]=R*vec3(q,q,-q); n[2]=R*vec3(q,-q,q); n[3]=R*vec3(-q,q,q);
  n[4]=R*vec3(0.,A,B); n[5]=R*vec3(0.,-A,B); n[6]=R*vec3(B,0.,A); n[7]=R*vec3(B,0.,-A); n[8]=R*vec3(A,B,0.); n[9]=R*vec3(-A,B,0.);
  zf=99.; zb=-99.; idf=0.;
  nf=vec3(0.,0.,1.); nb=vec3(0.,0.,-1.);
  for(int i=0;i<10;i++)facet_hit(n[i],float(i),p,zf,nf,idf,zb,nb);
  // 到轮廓的屏幕距离（里正外负）
  sd=(zf-zb)/max(length(nf.xy/max(nf.z,.0001)-nb.xy/min(nb.z,-.0001)),.0001);
  return smoothstep(-px,px,sd);
}
// 实心轮廓：二十面体的外轮廓，随自转和镜头转动变化
float coreSolid(vec2 p,float t,float rpx,float dpr){
  if(length(p)>.72)return 0.;
  vec3 n[10]; float zf, zb, idf, sd; vec3 nf, nb;
  return facet_sil(p,t,1./(rpx*dpr),n,zf,nf,idf,zb,nb,sd);
}
// 大 / 小两档画法（大的五档明暗 + 里面的紫核；小的三档）。在 44–56 像素之间两档叠着淡入淡出，棱线宽 hw 连续变
vec4 facet_ink(vec2 p,float t,float rpx,float dpr,bool big,float hw){
  if(length(p)>.72)return vec4(0.);
  float px=1./(rpx*dpr);
  vec3 n[10]; float zf, zb, idf, sd; vec3 nf, nb;
  float hit=facet_sil(p,t,px,n,zf,nf,idf,zb,nb,sd);
  if(hit<=0.)return vec4(0.);
  // 正面的棱
  vec3 xf=vec3(p,zf), bm=vec3(0.);
  float ef=9.;
  for(int i=0;i<10;i++)facet_e(n[i],xf,nf,ef,bm);
  ef=min(ef,sd*.5);
  float edge=1.-smoothstep(-px,px,ef-hw);
  // 这个面印成哪一档
  float lam=dot(nf,normalize(vec3(-.48,-.58,.66)));
  float lev;
  if(big)lev=lam>.80?0.:(lam>.56?1.:(lam>.26?2.:(lam>-.06?3.:4.)));
  else lev=lam>.62?0.:(lam>.12?3.:4.);
  // 点亮的面
  float lit=0.;
  for(int k=0;k<3;k++){
    float fk=float(k), slot=t/4.6+fk*.37;
    float id=floor(hash(vec2(floor(slot),fk*9.1+2.))*20.);
    if(abs(id-idf)<.5&&fract(slot)<.64)lit=fk<1.5?1.:2.;
  }
  float blue=0., orange=0., purple=0., yellow=0.;
  float leak=mix(.86,1.,step(.05,hash(floor(p*rpx*1.3))));
  if(lit>.5){
    if(lit<1.5)orange=.92*leak; else yellow=.95*leak;
  }else if(lev<.5){
  }else if(lev<1.5){
    float pitch=max(.042,2.6/rpx);
    vec2 u=vec2(p.x+p.y,p.y-p.x)*.70711/pitch;
    blue=(1.-smoothstep(-px/pitch,px/pitch,length(fract(u)-.5)-.27))*.92;
  }else if(lev<2.5){
    float pitch=max(.040,3./rpx), ha=hash(vec2(idf,7.3))*3.14159;
    float c=dot(p,vec2(cos(ha),sin(ha)))/pitch;
    blue=(1.-smoothstep(-px/pitch,px/pitch,abs(fract(c)-.5)-.21))*.92;
  }else if(lev<3.5){
    blue=.84*leak;
  }else{
    orange=.9*leak; purple=.9*leak;   // 最暗一档：橘叠紫 = 碳灰平涂
  }
  if(big&&lit<.5&&lev<2.5){
    // 透过浅色的面：背面的虚线棱 + 里面的紫核
    // 紫核：和外面的普通球一个质感——边用低频噪声抖出毛边，里面是颗粒（八成四底色 + 朝光一侧漏白小点 + 背光一侧两层墨的深斑）
    float cr=.2, rc=cr*rpx, cpx=px/cr;
    vec2 cq=p*rpx, cn=p/cr;
    float rag=length(cn)+(vnoise(cq*.8+13.)-.5)*min(.06,1.6/rc);
    float core=1.-smoothstep(1.-1.2*cpx,1.+1.2*cpx,rag);
    float glight=clamp(dot(cn,vec2(-.64,-.77))*.5+.5,0.,1.);
    float gh=hash(floor(cq*1.25)+5.);
    float ga=step(gh,mix(1.,.68,smoothstep(.35,1.,glight)));
    float gdeep=step(1.-.3*smoothstep(.45,1.,1.-glight)*smoothstep(.3,.7,vnoise(cq*.22+7.)),hash(floor(cq*1.25)+31.));
    float grain=ga*mix(.84,2.,gdeep);
    vec3 xb=vec3(p,zb), bb=vec3(1.,0.,0.);
    float eb=9.;
    for(int i=0;i<10;i++)facet_e(n[i],xb,nb,eb,bb);
    float along=dot(xb,normalize(cross(nb,bb)));
    float dash=step(.42,fract(along*12.+.2));
    float bl=(1.-smoothstep(-px,px,eb-max(.003,.38/rpx)))*dash*(1.-core);
    blue=max(blue,bl*.9);
    purple=max(purple,core*grain);
    // 压在紫核上的网点 / 排线改印橘（橘叠紫 = 碳灰），不再是蓝叠紫的深靛
    orange=max(orange,blue*core*ga); blue*=1.-step(.03,core);
  }
  // 棱 = 碳灰（橘 + 紫）；棱上蓝、黄让开，免得第三种墨串色
  orange=mix(orange,1.,edge); purple=mix(purple,1.,edge);
  float facet_k=1.-step(.03,edge);
  blue*=facet_k; yellow*=facet_k;
  return vec4(blue,orange,purple,yellow)*hit;
}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  float k=smoothstep(44.,56.,rpx);
  float hw=mix(.5/rpx,max(.0055,.6/rpx),k);   // 小尺寸棱线封顶 1 个 CSS 像素
  vec4 o=facet_ink(p,t,rpx,dpr,k>=.999,hw);
  if(k>.001&&k<.999)o=mix(o,facet_ink(p,t,rpx,dpr,true,hw),k);
  return o;
}`});
