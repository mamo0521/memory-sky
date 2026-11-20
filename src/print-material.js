import {ShaderMaterial,Matrix3,Vector3,Vector4,CustomBlending,AddEquation,OneFactor,NormalBlending,ZeroFactor,SrcColorFactor,OneMinusDstAlphaFactor,OneMinusSrcAlphaFactor} from 'three';

// 「印刷纸」外观。
// 分两步画：
//   1. 每颗球只往「墨量图」里记账——四种油墨各占一个通道（蓝 R / 橘 G / 紫 B / 黄 A），
//      一层墨记 0.5，叠加相加：0.5 = 一层，1.0 = 同色叠了两层。球的画法（平涂 / 颗粒 / 半色调 / 线网）只决定哪里有墨。
//   2. 合成那一步读墨量图：单色处印油墨色，两种墨重叠处直接印成配好的「第三色」，最多算两层。
// 这样第三色是指定的、不是墨压墨算出来的，叠多少颗也不会发黑。

const vertexShader = `
  varying vec2 vDisc;
  void main() {
    vDisc = uv * 2.0 - 1.0;
    vec4 center = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
    vec2 scale = vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
    center.xy += position.xy * scale;
    gl_Position = projectionMatrix * center;
  }
`;

// mode：0 半色调 / 1 渐变线网 / 2 颗粒 / 3 平涂 / 4 核心（同心圈）
export function printMaterial(ink, mode, angle, seed) {
  const chan = [0,0,0,0]; chan[ink] = 1;
  const material = new ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,
    blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneFactor,blendDst:OneFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneFactor,
    uniforms:{uChan:{value:new Vector4(...chan)},uMode:{value:mode},uAng:{value:angle},uSeed:{value:seed},uOpacity:{value:1},uRadiusPx:{value:10},uDpr:{value:2}},
    vertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vDisc;
      uniform vec4 uChan; uniform int uMode; uniform float uAng,uSeed,uOpacity,uRadiusPx,uDpr;
      float hash(vec2 p){p=fract(p*vec2(123.34,456.21)+uSeed);p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 n=vDisc/.965; float d=length(n);          // 球边在 .965（和光球同一口径）
        float rc=max(uRadiusPx,.5);                     // 球在屏幕上的半径（CSS 像素）
        vec2 q=n*rc;                                    // 以球心为原点的 CSS 像素坐标：纹理钉在球上，跟着球走
        float px=1./(rc*uDpr);                          // 一个设备像素有多大（以半径为 1）
        float ragged=d+(vnoise(q*.8)-.5)*min(.06,1.6/rc);
        float mask=1.-smoothstep(1.-1.2*px,1.+1.2*px,ragged);
        float ca=cos(uAng),sa=sin(uAng); mat2 TURN=mat2(ca,sa,-sa,ca); q=TURN*q; n=TURN*n;   // 每颗球的纹理朝向各转各的
        mat2 ROT=mat2(.7071,-.7071,.7071,.7071), INV=mat2(.7071,.7071,-.7071,.7071);
        float a=1., deep=0.;
        if(uMode==0){
          float cell=clamp(rc*.15,1.25,6.);   // 小球的网点跟着缩（下限 1.25px），不然只剩几颗
          vec2 g=ROT*q/cell; vec2 f=fract(g)-.5;
          vec2 cq=INV*((floor(g)+.5)*cell);
          float u=clamp(dot(cq/rc,vec2(-.7071,-.7071))*.5+.5,0.,1.);
          float rad=.54*sqrt(mix(.16,.98,u));
          float w=.8/(cell*uDpr);
          a=max(1.-smoothstep(rad-w,rad+w,length(f)),.10);
        }else if(uMode==1){
          float pitch=clamp(rc*.17,1.45,7.);   // 小球的线跟着变细变密（下限 1.45px），不然只剩几道齿
          vec2 cs=vec2(pitch*1.6,pitch);
          vec2 gs=(ROT*q)/cs;
          float w=.6/uDpr; a=0.;
          for(int i=-1;i<=1;i++){
            vec2 id=floor(gs)+vec2(float(i),0.);
            vec2 cq=INV*((id+.5)*cs);
            float u=clamp(dot(cq/rc,vec2(.7071,.7071))*.5+.5,0.,1.);
            float tone=mix(1.,.13,pow(u,.85));   // 最淡的一头停在短划上（再淡就散成看不见的点，那一角会空掉）
            float T=.5*pitch*pow(tone,.75);   // 最实的一头线挨着线、几乎实心，往另一头缝才慢慢张开
            float L=max(T,cs.x*clamp(tone*1.3-.05,0.,.7));
            vec2 dp=(gs-(id+.5))*cs;
            float dist=length(vec2(max(abs(dp.x)-(L-T),0.),dp.y))-T;
            a=max(a,1.-smoothstep(-w,w,dist));
          }
          a*=mix(.82,1.,step(.07,hash(floor(q*1.4))));
        }else if(uMode==2){
          float light=clamp(dot(n,vec2(.7071,.7071))*.5+.5,0.,1.);
          a=step(hash(floor(q*1.25)),mix(1.,.42,smoothstep(.35,1.,light)));
          float shade=clamp(dot(n,vec2(-.6,-.8))*.5+.5,0.,1.);
          deep=step(1.-.5*smoothstep(.45,1.,shade)*smoothstep(.3,.7,vnoise(q*.22+7.)),hash(floor(q*1.25)+31.));   // 深色斑点 = 记成同色两层
          a*=mix(.84,1.,deep);   // 底色的墨量和平涂对齐（八成四）；给满十成的话，同一种墨颗粒球总比别的浓、橘的还偏红
        }else if(uMode==3){
          a=.84*(.9+.1*vnoise(q*.12))*mix(.7,1.,step(.035,hash(floor(q*1.1))));
        }else{
          // 核心：实心 + 外面几圈越来越细的同心线
          float band=clamp(rc*.085,2.4,9.);
          float r=d*rc;
          float core=1.-smoothstep(rc*.5-.7/uDpr,rc*.5+.7/uDpr,r);
          float k=(r-rc*.5)/band;
          float thick=mix(.42,.10,clamp((d-.5)/.5,0.,1.));
          float ring=1.-smoothstep(thick-.6/(band*uDpr),thick+.6/(band*uDpr),abs(fract(k)-.5));
          a=max(core*.9,ring*step(.5,d));
        }
        float v=a*mask*uOpacity*(1.+deep)*.5;
        gl_FragColor=uChan*v;
      }
    `
  });
  material.rotation=0; material.sizeAttenuation=true;   // Sprite 点击判定要读这两个
  Object.defineProperty(material,'opacity',{get(){return this.uniforms.uOpacity.value;},set(value){this.uniforms.uOpacity.value=value;},configurable:true});
  return material;
}

// 合成：墨量图 → 画面。uInk 四色、uDeep 同色两层的加深色、uPair 六对的第三色（0-1,0-2,0-3,1-2,1-3,2-3）。
export function printComposite(texture) {
  const v3 = n => Array.from({length:n},()=>new Vector3(1,1,1));
  return new ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,blending:NormalBlending,premultipliedAlpha:true,toneMapped:false,
    uniforms:{tInk:{value:texture},uInk:{value:v3(4)},uDeep:{value:v3(4)},uPair:{value:v3(6)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tInk; uniform vec3 uInk[4],uDeep[4],uPair[6];
      void main(){
        vec4 m=texture2D(tInk,vUv);
        float s[4]; s[0]=m.r; s[1]=m.g; s[2]=m.b; s[3]=m.a;
        int i1=0,i2=1; float A=-1.,B=-1.;
        for(int i=0;i<4;i++){
          float one=min(s[i]*2.,1.);
          if(one>A){B=A;i2=i1;A=one;i1=i;}else if(one>B){B=one;i2=i;}
        }
        if(A<=.003){gl_FragColor=vec4(0.);return;}
        B=max(B,0.);
        float twice=clamp(s[i1]*2.-1.,0.,1.);
        vec3 c1=mix(uInk[i1],uDeep[i1],twice);
        int lo=i1<i2?i1:i2, hi=i1<i2?i2:i1;
        int k=lo==0?hi-1:(lo==1?hi+1:5);
        vec3 col=(c1*(A-B)+uPair[k]*B)/A;      // 重叠处吃满第三色，其余是先到的那一色
        gl_FragColor=vec4(col*A,A);
      }
    `
  });
}

// 核心（印刷纸外观）：形状 = 实心核 + 往外扩的涟漪 + 飞出去的蓝色小墨点，全是蓝一色。
// （liquid() 是一层流动「液态」底色的写法，目前没有调用。）
// 和别的球一样记进墨量图（蓝墨 + 黄墨），所以和压到它的球有叠色。
// 坐标：vDisc 的 1 = 这张片的边；实心核半径 CORE_R0，所以片的边长 = 核直径 / CORE_R0。
export const CORE_R0 = .37;
export function printCoreMaterial() {
  const material = new ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,
    blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneFactor,blendDst:OneFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneFactor,
    uniforms:{uT:{value:0},uUnitPx:{value:30},uDpr:{value:2},uOpacity:{value:1},uBlue:{value:new Vector3(.41,.59,.83)},uPurple:{value:new Vector3(.7,.42,.8)},uYellow:{value:new Vector3(.97,.85,.53)}},
    vertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vDisc;
      uniform float uT,uUnitPx,uDpr,uOpacity; uniform vec3 uBlue,uPurple,uYellow;
      const float TAU=6.2831853;
      float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return .55*vnoise(p)+.3*vnoise(p*2.03+11.)+.15*vnoise(p*4.1+23.);}
      // 液态颜色：先把坐标揉一揉（两层慢慢流的噪声互相推），再按揉出来的纹路分蓝 / 紫 / 黄
      vec3 liquid(vec2 p){
        vec2 w=p*1.5+1.5*vec2(fbm(p*1.2+vec2(uT*.06,0.)),fbm(p*1.2+vec2(7.,-uT*.05)));
        float f1=fbm(w+uT*.04), f2=fbm(w*1.6-uT*.035+3.);
        vec3 col=mix(uBlue,uPurple,smoothstep(.40,.60,f1));
        col=mix(col,uBlue*uBlue*1.15,smoothstep(.62,.78,f1)*.6);      // 深处压一点更浓的蓝
        return mix(col,uYellow,smoothstep(.58,.72,f2)*.9);
      }
      void main(){
        vec2 p=vDisc; float r=length(p), th=atan(p.y,p.x);
        if(r>1.03){discard;}
        float rpx=max(uUnitPx,1.), px=1./(rpx*uDpr); vec2 q=p*rpx;
        float r0=${CORE_R0};
        float body=1.-smoothstep(r0-px*1.5,r0+px*1.5,r);
        // 涟漪：圈距 .075；粗细从贴着核的那圈起一路变细（每一圈都比里面那圈细），到 .78 处细到没有。
        // 核和圈之间留一道固定的空（gap）：圈是从这道空的外沿冒出来的，不贴着核往外撕——
        // 贴着撕的话，每一圈刚离开核的那一瞬会在核边上露出一条头发丝细的白缝。
        // 粗细按「这一圈的圈心在哪」定，整圈一个粗细；圈的里沿过了那道空才整圈淡入——
        // 不拿那道空去裁圈：裁的话圈刚冒头时只露一丝，看着是「细 → 粗 → 细」。
        // 一拍一拍地走：新圈冒出来以后先慢、临到下一圈要出时快——核外空着一大截的那一段时间就很短。
        float band=.075, gap=.14*band, tt=uT*.42, ph=floor(tt)+pow(fract(tt),2.4), k=(r-r0)/band-ph, rcen=r0+(floor(k)+.5+ph)*band;
        float fade=pow(clamp(1.-(rcen-r0)/(.78-r0),0.,1.),1.25), thick=.36*fade;
        float born=smoothstep(0.,.08*band,rcen-thick*band-(r0+gap));
        body=max(body,(1.-smoothstep(thick-px/band,thick+px/band,abs(fract(k)-.5)))*born*smoothstep(.04,.45,fade));   // last factor: the outer hairline rings also get lighter, so they melt away instead of ending as a crisp thin circle
        float blue=0.,yellow=0.;
        if(r>r0){
          float v=log(r/r0)/log(1./r0), flow=-uT*.075, K=9., J=30., vv=v+flow;
          for(int di=-1;di<=1;di++)for(int dj=-1;dj<=1;dj++){
            vec2 id=vec2(floor(vv*K)+float(di),floor(th/TAU*J)+float(dj));
            vec2 idw=vec2(id.x,mod(id.y,J));
            float h1=hash(idw),h2=hash(idw+17.3),h3=hash(idw+41.7);
            float cv=(id.x+.3+.4*h1)/K-flow, ca=(id.y+.3+.4*h2)/J*TAU;
            if(cv<=.02||cv>=1.)continue;
            float cr=r0*pow(1./r0,cv);
            vec2 c=cr*vec2(cos(ca),sin(ca));
            float size=max(.55,rpx*mix(.02,.03,cv)*(.55+.9*h1))*(1.-smoothstep(.8,1.,cv))*smoothstep(.02,.12,cv);
            float cov=step(h3,.3)*(1.-smoothstep(-.7/uDpr,.7/uDpr,length((p-c)*rpx)-size));
            blue=max(blue,cov*step(h2,.5));   // 只留蓝墨点
          }
        }
        // 和别的球一样往墨量图里记账：核、涟漪、蓝墨点记在蓝墨通道，黄墨点记在黄墨通道。
        // 这样核心和压到它的球有叠色（蓝×橘、蓝×紫…），也没有谁永远在最前面的问题。
        float leak=mix(.86,1.,step(.05,hash(floor(q*1.3))));     // 一点点漏墨
        float b=max(body*.9,blue)*leak, y=yellow*leak;
        if(max(b,y)<.004){discard;}
        gl_FragColor=vec4(b,0.,0.,y)*(.5*uOpacity);
      }
    `
  });
  material.rotation=0; material.sizeAttenuation=true;
  Object.defineProperty(material,'opacity',{get(){return this.uniforms.uOpacity.value;},set(value){this.uniforms.uOpacity.value=value;},configurable:true});
  return material;
}

// 核心的其他画法（core-lab/ 里每版一个文件）：每版一段 GLSL——
// 一个 coreInk(p,t,rpx,dpr)，返回蓝 / 橘 / 紫 / 黄四种墨的墨量（0–2 层）。和涟漪那版一样记进墨量图。
const CORE_HELPERS = `
  const float TAU=6.2831853;
  float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
  float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){return .55*vnoise(p)+.3*vnoise(p*2.03+11.)+.15*vnoise(p*4.1+23.);}
`;
function coreVariantMaterial(glsl, main, blend) {
  const material = new ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,...blend,
    uniforms:{uT:{value:0},uUnitPx:{value:30},uDpr:{value:2},uOpacity:{value:1},uPaper:{value:new Vector3(.93,.9,.84)},uCamRot:{value:new Matrix3()}},
    vertexShader,
    fragmentShader:`precision highp float;
      varying vec2 vDisc;
      uniform float uT,uUnitPx,uDpr,uOpacity; uniform vec3 uPaper;
      uniform mat3 uCamRot;   // 镜头朝向：世界方向 → 镜头里的方向（x 右、y 上、z 朝观众）；会跟镜头转的版用它
      ${CORE_HELPERS}
      ${glsl}
      void main(){ if(length(vDisc)>1.06){discard;} ${main} }`
  });
  material.rotation=0; material.sizeAttenuation=true;
  Object.defineProperty(material,'opacity',{get(){return this.uniforms.uOpacity.value;},set(value){this.uniforms.uOpacity.value=value;},configurable:true});
  return material;
}
export function printCoreVariant(glsl) {
  return coreVariantMaterial(glsl,
    'vec4 s=clamp(coreInk(vec2(vDisc.x,-vDisc.y),uT,max(uUnitPx,1.),uDpr),0.,2.); if(max(max(s.r,s.g),max(s.b,s.a))<.004){discard;} gl_FragColor=s*(.5*uOpacity);',
    {blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneFactor,blendDst:OneFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneFactor});
}
// 专色：四种墨之外另加的一版墨（玻璃方块的亮蓝）。不进墨量图，合成完以后正片叠底印在最上面。
// 画布是透明的、纸在画布后面（CSS），所以「正片叠底」分两遍印：
//   pass 0 把画布上已有的墨乘上专色；pass 1 在还透着纸的地方补上「纸色 × 专色」。
//   两遍加起来 = 整个画面（墨 + 纸）乘上专色。uPaper 是纸色。
export function printCoreSpot(glsl, pass) {
  const material = coreVariantMaterial(glsl,
    pass === 0
      ? 'vec4 sp=coreSpot(vec2(vDisc.x,-vDisc.y),uT,max(uUnitPx,1.),uDpr); float a=clamp(sp.a,0.,1.)*uOpacity; if(a<.004){discard;} gl_FragColor=vec4(mix(vec3(1.),sp.rgb,a),1.);'
      : 'vec4 sp=coreSpot(vec2(vDisc.x,-vDisc.y),uT,max(uUnitPx,1.),uDpr); float a=clamp(sp.a,0.,1.)*uOpacity; if(a<.004){discard;} gl_FragColor=vec4(a*sp.rgb*uPaper,a);',
    pass === 0
      ? {blending:CustomBlending,blendEquation:AddEquation,blendSrc:ZeroFactor,blendDst:SrcColorFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor}
      : {blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneMinusDstAlphaFactor,blendDst:OneFactor,blendSrcAlpha:OneMinusDstAlphaFactor,blendDstAlpha:OneFactor});
  return material;
}

// 实心的核心（各版文件里写 solid:true + coreSolid，返回它实心轮廓的覆盖率）：轮廓以内不透后面的东西。两张片：
//   'ink'   画进墨量图，把已经画上去的（比核心远的）球的墨按轮廓擦掉——比核心近的球排在后面画，照样叠上来；
//   'paper' 画在连线之后、合成片之前，一张纸色的片，把穿过核心的连线挡住。
export function printCoreBlock(kind, glsl) {
  return coreVariantMaterial(glsl,
    `float a=clamp(coreSolid(vec2(vDisc.x,-vDisc.y),uT,max(uUnitPx,1.),uDpr),0.,1.)*uOpacity; if(a<.004){discard;} gl_FragColor=vec4(${kind==='ink'?'vec3(0.)':'uPaper*a'},a);`,
    kind==='ink'
      ? {blending:CustomBlending,blendEquation:AddEquation,blendSrc:ZeroFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneMinusSrcAlphaFactor}
      : {blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneMinusSrcAlphaFactor});
}

// 遮挡片：不画颜色，只在球的圆面里写深度。印刷纸下球是画进墨量图再整张合成的，本身没有前后；
// 有了这张片，飘在球后面的字母、星星和连线才会被球挡住。所有球共用这一份材质。
export function printOccluder() {
  const material = new ShaderMaterial({
    transparent:false,colorWrite:false,depthWrite:true,depthTest:true,
    vertexShader,
    fragmentShader:'precision highp float;varying vec2 vDisc;void main(){if(length(vDisc)>.965){discard;}gl_FragColor=vec4(0.);}'
  });
  material.rotation=0; material.sizeAttenuation=true;
  return material;
}
