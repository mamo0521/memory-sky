// 字符球：一颗由 3×5 点阵字符排成的行星。受光面（左上）字稀或留纸，背光面（右下）密到实心，最暗处那几格改印深碳灰（橘墨 + 紫墨叠印，那几格不印蓝）。
// 条带沿经度慢慢移动 = 自转；个别格子在各自的随机时刻换一个字。
// rpx*.06 < 3（格子不足 3 像素）时退化成：球形轮廓 + 半色调网点 + 背光侧实心月牙（最暗的一弯是深碳灰）。
//
// 字形位图：3 列 × 5 行，位号 n = 行*3 + 列（行 0 在上，列 0 在左），值 = Σ 2^n。
// 一行的值 = 左1 + 中2 + 右4，再乘 8^行（1, 8, 64, 512, 4096）。按墨量从稀到密：
//
//  1 '.'  1 点     2 ':'  2 点     3 '-'  3 点     4 '+'  5 点
//    ...  0          ...  0          ...  0          ...  0
//    ...  0          .#.  2*8        ...  0          .#.  2*8
//    ...  0          ...  0          ###  7*64       ###  7*64
//    ...  0          .#.  2*512      ...  0          .#.  2*512
//    .#.  2*4096     ...  0          ...  0          ...  0
//    = 8192          = 16+1024       = 448           = 16+448+1024
//                    = 1040                          = 1488
//
//  5 '='  6 点     6 'o'  8 点     7 'x'  9 点     8 '#'  12 点
//    ...  0          ...  0          #.#  5          #.#  5
//    ###  7*8        ###  7*8        #.#  5*8        ###  7*8
//    ...  0          #.#  5*64       .#.  2*64       #.#  5*64
//    ###  7*512      ###  7*512      #.#  5*512      ###  7*512
//    ...  0          ...  0          #.#  5*4096     #.#  5*4096
//    = 56+3584       = 56+320+3584   = 5+40+128      = 5+56+320
//    = 3640          = 3960            +2560+20480     +3584+20480
//                                    = 23213         = 24445
//
//  9 '8'  13 点    10 '@' 14 点    11 实心块 15 点（点与点并成一整块）
//    ###  7          ###  7          ###
//    #.#  5*8        ###  7*8        ###
//    ###  7*64       #.#  5*64       ###
//    #.#  5*512      ###  7*512      ###
//    ###  7*4096     ###  7*4096     ###
//    = 7+40+448      = 7+56+320      = 32767
//      +2560+28672     +3584+28672
//    = 31727         = 32639
window.CORE_LAB.push({id:'glyph',spot:true,name:'4 · 字符球',note:'一颗用点阵字符排出来的行星：亮面字稀、暗面字密到实心，最暗的一弯印成深碳灰，条带慢慢自转，偶尔有个字自己换一下。',glsl:`
float glyph_bits(float i){
  if(i<.5)return 0.;
  if(i<1.5)return 8192.;
  if(i<2.5)return 1040.;
  if(i<3.5)return 448.;
  if(i<4.5)return 1488.;
  if(i<5.5)return 3640.;
  if(i<6.5)return 3960.;
  if(i<7.5)return 23213.;
  if(i<8.5)return 24445.;
  if(i<9.5)return 31727.;
  if(i<10.5)return 32639.;
  return 32767.;
}
float glyph_bit(float v,float n){
  float d=floor(exp2(n)+.5);
  return floor(mod((v+.5)/d,2.));
}
vec2 glyph_shade(vec2 c,float t,float R){
  vec2 q=c/R;
  float rr=min(dot(q,q),1.);
  vec3 n=vec3(q,sqrt(1.-rr));
  float lam=dot(n,normalize(vec3(-.62,-.58,.53)));
  float lat=asin(clamp(n.y,-1.,1.)), lon=atan(n.x,n.z+.0001)+t*.11;
  float w1=fbm(vec2(lon*1.3,lat*3.+7.));
  float w2=fbm(vec2(lon*2.6+31.,lat*6.5));
  float bandv=clamp(.5+.36*sin(lat*9.+3.2*(w1-.5))+.75*(w2-.5),0.,1.);
  float lit=smoothstep(-.3,.85,lam);
  float b=lit*(.35+.65*bandv)+.1*bandv;
  return vec2(clamp(1.-.84*b,0.,1.),lam);
}
// 实心轮廓：整颗球的圆面
float coreSolid(vec2 p,float t,float rpx,float dpr){float px=1./(rpx*dpr); return 1.-smoothstep(-px,px,length(p)-.62);}
// 球底的纸色：比纸深一点点，正片叠底印在最上面——后面的球照样透过来叠色，只是整颗球像垫了一张旧一点的纸
vec4 coreSpot(vec2 p,float t,float rpx,float dpr){float px=1./(rpx*dpr); return vec4(.97,.96,.94,1.-smoothstep(-px,px,length(p)-.62));}
vec4 coreInk(vec2 p,float t,float rpx,float dpr){
  // 所有大小走同一条路：字符格子铺满球，格子按像素缩小；小到点阵认不出时，同一格里的字形平滑换成一块按明暗定大小的小方块。
  // （不按大小整个换造型，缩小时看着还是同一颗球。）
  float R=.62, r=length(p), px=1./(rpx*dpr);
  float disc=1.-smoothstep(-px,px,r-R);          // 球的圆边：边上的格子被圆裁掉一部分，轮廓是圆的（按格心取舍的话上下会是平顶）
  float cw=clamp(rpx*.06,2.2,7.);
  vec2 cs=vec2(cw,cw*1.5)/rpx;
  vec2 cq=p/cs+.5;
  vec2 id=floor(cq);
  vec2 c=id*cs;
  float blue=0., carbon=0.;
  if(length(c)<R+length(cs)*.5){
    vec2 sh=glyph_shade(c,t,R);
    float dark=sh.x;
    float idx=clamp(floor(dark*11.99+(hash(id+7.7)-.5)*.9),1.,11.);
    float tt=t*.45+hash(id+3.1)*29.;
    float k=floor(tt);
    if(hash(id+vec2(k*1.37,k*.71+5.))<.045){
      idx=clamp(idx+floor(hash(id+k+11.)*9.)-4.,1.,10.);
    }
    vec2 g=(cq-id)*vec2(4.,6.)-.5;
    vec2 gi=clamp(floor(g),vec2(0.),vec2(2.,4.));
    vec2 f=g-gi-.5;
    float n=gi.y*3.+gi.x;
    float wg=.7*4./(cw*dpr);
    float hs=min(max(mix(.33,.45,dark),1.4/cw),.5);
    float d=max(abs(f.x),abs(f.y))-hs;
    float dotm=1.-smoothstep(-wg,wg,d);
    float dbox=max(abs(g.x-1.5)-1.5,abs(g.y-2.5)-2.5);
    float boxm=1.-smoothstep(-wg,wg,dbox);
    float merge=step(10.5,idx);
    float glyphInk=mix(dotm*glyph_bit(glyph_bits(idx),n),boxm,merge);
    // 小格子：一块小方块，越暗越大（最亮的格子留空）
    vec2 f2=abs(cq-id-.5);
    float fill=mix(.3,1.,smoothstep(.12,.9,dark));
    float dpx=max((f2.x-.43*fill)*cw,(f2.y-.45*fill)*cw*1.5);
    float blockInk=(1.-smoothstep(-.6/dpr,.6/dpr,dpx))*step(.16,dark);
    float ink=mix(blockInk,glyphInk,smoothstep(3.3,4.3,cw))*disc;
    // 背光的一弯（右下）整格印深碳灰（橘 + 紫），不印蓝；别的格子一层蓝
    if(sh.y<-.22){carbon=ink*.95;}else{blue=ink;}
  }
  // 轮廓：一圈很细的蓝线（约 0.7 个 CSS 像素），碳灰那一弯上让位
  float lw=.35/rpx;
  float ring=(1.-smoothstep(lw-px,lw+px,abs(r-R+lw)))*.9;
  blue=max(blue,ring*step(carbon,.01));
  return vec4(blue,carbon,carbon,0.);
}`});
