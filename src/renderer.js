import {starAccents} from './star-accents.js';
import {ringLayout} from './ring-layout.js';
import {orbitFor, orbitPosition} from './orbit-layout.js';
import {lensDust} from './lens-dust.js';
import {threadMaterial} from './thread-material.js';
import {lightMaterial} from './light-materials.js';
import {printMaterial,printComposite,printCoreMaterial,printCoreVariant,printCoreSpot,printCoreBlock,printOccluder,CORE_R0} from './print-material.js';
import './core-lab/_init.js';
import './core-lab/eclipse.js';
import './core-lab/glyph.js';
import './core-lab/gyro.js';
import './core-lab/facet.js';
import './core-lab/chrome.js';
import './core-lab/cube.js';
import './core-lab/isobar.js';
import {printDeco, printFine, printStamp} from './print-deco.js';
import * as Three from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
// 本包不改宿主页面的全局色彩管理：颜色按画稿上的显示值原样用。
class DisplayColor extends Three.Color {
  setHex(value){ return super.setHex(value, Three.LinearSRGBColorSpace); }
  setStyle(value){ return super.setStyle(value, Three.LinearSRGBColorSpace); }
}
const THREE = {...Three, Color: DisplayColor, OrbitControls: TrackballControls};
// 数据由调用方给、不联网取；
// 点名牌 / 选中 / 取消选中走 opts.onOpen / onPick / onClear；纸纹图片和字体都在包里。
const PAPER_ASSET = {
  fleck: new URL('./assets/paper/fleck-v2.webp', import.meta.url).href,
  mottle: new URL('./assets/paper/mottle-1.webp', import.meta.url).href,
  felt: new URL('./assets/paper/felt-1-c2.jpg', import.meta.url).href,
};

/* 记忆星图：真 3D（Three.js + TrackballControls）
 * 发光 = 球本色 + 紧挨细亮描边 + 最外羽化渐隐 + 呼吸。
 * 输入：events / 核 / 底色 / wiki 光球 + 连线 + activation 热度；颜色、大小、3D 位置在这里算。
 * 收起态只看；展开后可旋转 / 缩放 / 点星聚焦高亮。
 */

  // —— 配色（情绪坐标四象限）——
  const Q = { hiNeg: [218,161,124], hiPos: [233.679770,213.920617,179.051499], loNeg: [190,194,236], loPos: [195,167,222] };
  // 四象限各自的内描边色；光晕的形状和强度不随这里变。
  const FINISH = {
    hiNeg:{stroke:[230,182,137]},
    hiPos:{stroke:[252.639065,229.741372,188.525637]},
    loNeg:{stroke:[203,218,250]},
    loPos:{stroke:[215,192,236]}
  };
  // —— 「印刷纸」外观：油墨四色、六个第三色（两墨叠印）、画法比例 ——
  // ink 顺序 = 蓝(安静不愉快) / 橘(激动不愉快) / 紫(安静愉快) / 黄(激动愉快)；pairs 的键是两个 ink 序号。
  export const PRINT_DEFAULT = {
    ink:['#6997D3','#EA6D1A','#C373D9','#F5D561'], paper:'#EEE5D7',
    pairs:{'0-1':'#322B2A','0-2':'#EC2727','0-3':'#1FA84A','1-2':'#473944','1-3':'#F6F2EF','2-3':'#E52ABC'},
    ratio:{flat:60,grain:15,half:15,line:10}
  };
  const INK_LINE = 0x3a2f29, INK_SOFT = 0x7d6f64;
  const PRINT_MODES = [['flat',3],['grain',2],['half',0],['line',1]];
  function hex01(h){ const v=parseInt(String(h).replace('#',''),16); return Number.isFinite(v)?[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255]:[1,1,1]; }
  function inkIndex(n){
    if(n.kind!=='event') return 0;
    const hi=(Number.isFinite(+n.arousal)?+n.arousal:0)>=.5, pos=(Number.isFinite(+n.valence)?+n.valence:0)>=0;
    return hi?(pos?3:1):(pos?2:0);
  }
  function nodeFinish(n){return FINISH[(+n.arousal>=.5?'hi':'lo')+(+n.valence>=0?'Pos':'Neg')];}
  const BLUE = [0xc8, 0xd6, 0xfb];                      // 核/底色/wiki 统一用浅蓝
  const R5 = 10, STEP = 0.70;                           // 5星=R5；每降一级×0.70（落差明显）
                                                        // R5 取 10：缩小球比撑开布局更能留出空隙——撑开布局会把更多球顶出默认视野。
  function impRadius(i) { return R5 * Math.pow(STEP, 5 - Math.max(1, Math.min(5, i))); }
  const SIZE = { core: R5 * 2.0, baseline: R5 * 1.05, wiki: impRadius(4) };   // core 放大到约现在 1.3 倍

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function cssRgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  function cssA(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function hexInt(c) { return ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0); }
  function emotionColor(v, a) {
    // 色卡是四象限分类色，不是连续渐变；插值会把橘/紫掺成粉肉色。
    const vv = Number.isFinite(+v) ? +v : 0;
    const aa = Number.isFinite(+a) ? +a : 0;
    if (aa >= 0.5) return (vv >= 0 ? Q.hiPos : Q.hiNeg).slice();
    return (vv >= 0 ? Q.loPos : Q.loNeg).slice();
  }
  function nodeColor(n) { return n.kind === 'event' ? emotionColor(n.valence, n.arousal) : BLUE.slice(); }
  function nodeRadius(n) {
    return n.kind === 'core' ? SIZE.core : n.kind === 'baseline' ? SIZE.baseline
      : n.kind === 'wiki' ? SIZE.wiki : impRadius(n.importance);
  }
  function hash(str, seed) { let h = 2166136261 ^ (seed || 0); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }

  // —— 力导向布局（像 Obsidian：相关聚拢、无关斥到外圈、连线不乱）——
  function layout(nodes, links, softlinks) {
    const idx = Object.create(null);
    nodes.forEach((n, i) => {
      idx[n.id] = i;
      const h1 = hash(n.id, 1), h2 = hash(n.id, 2), h3 = hash(n.id, 3);
      const rr = 30 + h1 * 70, phi = Math.acos(1 - 2 * h2), th = 6.2832 * h3;
      n.x = rr * Math.sin(phi) * Math.cos(th); n.y = rr * Math.cos(phi); n.z = rr * Math.sin(phi) * Math.sin(th);
      n.pinned = (n.kind === 'core'); if (n.pinned) { n.x = n.y = n.z = 0; }
    });
    // 每条连线的"自然长度"带 ±82% 的随机（REST_VAR）：长度一律相同时，弹簧把所有距离拉成一个数，
    // 看着是一张均匀的网；带上随机后有的紧凑成簇、有的独自拉出去一条长线。
    // 用 hash(两端 id) 而不是随机数：同一对球每次打开长度一样（可复现）。
    const REST_VAR = 0.82;   // 自由星空的距离落差
    const restOf = (a, b, base, seed) => base * (1 - REST_VAR + 2 * REST_VAR * hash(a + '|' + b, seed));
    const edges = [];
    (links || []).forEach(([a, b]) => { if (idx[a] != null && idx[b] != null) edges.push([idx[a], idx[b], 0.06, restOf(a, b, 60, 59)]); });
    (softlinks || []).forEach(([a, b]) => { if (idx[a] != null && idx[b] != null) edges.push([idx[a], idx[b], 0.022, restOf(a, b, 88, 61)]); });
    // 斥力 REP 与向心 CENTER 一起决定整体松紧：88 颗球时整体半径中位约 202、默认视野内约 37 颗、连线长短比约 3.2。
    const N = nodes.length, REP = 2000, CENTER = 0.0085;
    // Different personal space lets linked groups gather, while isolated stars have room.
    const space=nodes.map(n=>n.pinned?1:0.28+1.9*Math.pow(hash(n.id,73),1.6));
    const pull=nodes.map(n=>0.65+0.7*hash(n.id,79));
    const radii=nodes.map(n=>n.kind==='core'?SIZE.core:impRadius(n.importance||3));
    const fx = new Float64Array(N), fy = new Float64Array(N), fz = new Float64Array(N);
    for (let it = 0; it < 320; it++) {
      fx.fill(0); fy.fill(0); fz.fill(0);
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
        const d2 = dx * dx + dy * dy + dz * dz + 12, inv = 1 / Math.sqrt(d2);
        const distance=Math.sqrt(Math.max(0,d2-12));
        const f = Math.max(REP*Math.sqrt(space[i]*space[j])/d2,(radii[i]+radii[j]+3-distance)*.9);
        dx *= inv; dy *= inv; dz *= inv;
        fx[i] += dx * f; fy[i] += dy * f; fz[i] += dz * f; fx[j] -= dx * f; fy[j] -= dy * f; fz[j] -= dz * f;
      }
      for (const [i, j, k, rest] of edges) {
        const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y, dz = nodes[j].z - nodes[i].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01, f = k * (dist - rest) / dist;
        fx[i] += dx * f; fy[i] += dy * f; fz[i] += dz * f; fx[j] -= dx * f; fy[j] -= dy * f; fz[j] -= dz * f;
      }
      const cool = Math.max(0.15, 1 - it / 340);
      for (let i = 0; i < N; i++) {
        if (nodes[i].pinned) { nodes[i].x = nodes[i].y = nodes[i].z = 0; continue; }
        fx[i] -= nodes[i].x * CENTER*pull[i]; fy[i] -= nodes[i].y * CENTER*pull[i]; fz[i] -= nodes[i].z * CENTER*pull[i];
        nodes[i].x += Math.max(-12, Math.min(12, fx[i])) * cool;
        nodes[i].y += Math.max(-12, Math.min(12, fy[i])) * cool;
        nodes[i].z += Math.max(-12, Math.min(12, fz[i])) * cool;
      }
    }
  }

  // 手机上的暗点：小光晕缩小采样时，贴图透明区的"黑"被平均进颜色，整个变成暗色小点。
  // 两个来源：mipmap（WebGL1 下 NPOT 贴图不生成 mipmap，POT 贴图会）和线性过滤的重度缩小。
  // 对策：显式关 mipmap（generateMipmaps=false + LinearFilter），并把透明像素的 RGB 钉成本色（见 bodyTexture / haloTexture）。
  // 预乘 alpha 也能消掉黑边，但 NormalBlending 下 opacity 会被多乘一次（未选中时的淡化失效），所以不用。

  // —— 烘焙贴图：球本色 + 紧贴细亮描边 + 外侧本色羽化光 ——
  const _bodyCache = {};
  function bodyTexture(col) {
    const key = (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0);
    if (_bodyCache[key]) return _bodyCache[key];
    // mipmap 已显式关掉（见下），所以 S 是否为 2 的幂无所谓。
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d'), c = S / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
    const solid = cssRgb(col), rim = cssRgb(mix(col, [255, 255, 255], 0.72));
    g.addColorStop(0.00, solid);
    g.addColorStop(0.91, solid);
    g.addColorStop(0.945, rim);
    g.addColorStop(0.978, cssA(col, 1));
    g.addColorStop(1.00, cssA(col, 0));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // **逐像素钉色**：低 alpha 像素的 RGB 一律钉成球本色、alpha 下限 1/255——
    // 透明区不再是"黑"，缩小采样混进来的是本色（详见 haloTexture 注释）。
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 250) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; }
      if (d[i + 3] < 1) d[i + 3] = 1;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    _bodyCache[key] = t; return t;
  }
  // —— core 蓝色太阳——
  // 真 3D 球 + GLSL 三维噪声：表面焰纹流动（fbm 双层域扭曲）+ 边缘火舌（顶点位移）+ 菲涅尔边缘光。
  const _NOISE_GLSL = [
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    '  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    '  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    '  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    '  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    '  i=mod289(i);',
    '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    '  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    '  vec4 j=p-49.0*floor(p*ns.z*ns.z);',
    '  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    '  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    '  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    '  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    '  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    '  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    '  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',
    'float fbm(vec3 p){ float f=0.0,a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.03; a*=0.55; } return f; }',
  ].join('\n');
  function coreBodyMaterial(T) {   // 内层：干净的 #c8d6fb 发光球（无内部细节，只有极轻的呼吸）
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uStudy: { value: 1 } },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
        'void main(){ vP=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.0);',
        '  vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      ].join('\n'),
      fragmentShader: _NOISE_GLSL + [
        'uniform float uTime; uniform float uOpacity; uniform float uStudy;',
        'varying vec3 vN; varying vec3 vV; varying vec3 vP;',
        'void main(){',
        '  vec3 col = vec3(0.784,0.839,0.984);',   // 整颗就是一块 #c8d6fb——无体积无明暗，发光交给光晕
        '  float rim = pow(1.0-max(0.0,dot(normalize(vN),normalize(vV))),3.2);',
        '  float flow = 0.5+0.5*sin(vP.y*5.0+vP.x*3.0-uTime*0.35);',
        '  col = mix(col,vec3(0.88,0.93,1.0),uStudy*rim*(0.20+0.12*flow));',
        '  gl_FragColor = vec4(col, uOpacity);',
        '}',
      ].join('\n'),
    });
  }
  function coreAuraMaterial(T, o) {   // 软瓣光环：像蓝色小太阳的柔和火苗
    // 低频圆瓣：pow 压平波谷只留圆峰 + 瓣尖水彩晕开 + 顶部瓣加大（高频大幅的噪声会长成一根根尖刺）。
    const c = new T.Color(o.col);
    // 瓣尖用更饱和的同色：越靠近球体边缘越饱和，中间不动。
    // 由 o.col 自动推：色相不动、饱和度拉高、亮度压一点 → 同一支火苗从根部的淡蓝烧到尖上的实蓝。
    const hsl = {}; c.getHSL(hsl);
    const cT = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 2.6 + 0.28), Math.max(0.34, hsl.l - 0.16));
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uStudy: { value: 1 },
        uAmp: { value: o.amp }, uFreq: { value: o.freq }, uSpeed: { value: o.speed },
        uAlpha: { value: o.alpha }, uBase: { value: o.base }, uPhase: { value: o.phase },
        uUp: { value: o.up }, uTip: { value: o.tip },
        uSat: { value: o.sat == null ? 0.8 : o.sat },
        uRim: { value: o.rim == null ? 0 : o.rim },
        uRimPow: { value: o.rimPow == null ? 1.6 : o.rimPow },
        uCol: { value: new T.Vector3(c.r, c.g, c.b) },
        uColTip: { value: new T.Vector3(cT.r, cT.g, cT.b) } },
      // precision 必须放在噪声函数**之前**，否则那些函数已经按默认精度编译完了
      vertexShader: 'precision highp float;\n' + _NOISE_GLSL + [
        'uniform float uTime,uAmp,uFreq,uSpeed,uBase,uPhase,uUp,uStudy;',
        'varying float vLobe; varying float vRim;',
        'void main(){',
        '  vec3 vP = normalize(position);',
        // 边缘遮罩：法线越"侧对"相机（轮廓上）→ vRim 越大；正对相机（球心那一片）→ 接近 0。
        // 软瓣是整颗球壳，不加这个的话它连球心也一起盖住，中间就发灰白。
        '  vRim = 1.0 - abs(normalize(normalMatrix * vP).z);',
        '  float n1 = snoise(vP*uFreq + vec3(0.0, -uTime*uSpeed, uPhase));',
        '  float n2 = snoise(vP*(uFreq*2.1) + vec3(uTime*uSpeed*0.5, -uTime*uSpeed*1.25, uPhase*1.7+3.0));',
        '  float shared = snoise(vP*1.55 + vec3(0.0,-uTime*0.13,2.4));',
        '  float detail = snoise(vP*3.2 + vec3(uTime*0.035,-uTime*0.17,1.2));',
        '  float oldField=0.72*n1+0.28*n2;',
        '  float lobe = 0.5 + 0.5*mix(oldField,0.82*shared+0.18*detail,uStudy);',
        '  lobe = pow(clamp(lobe,0.0,1.0), 2.55);',   // 压平波谷、只留圆峰 → 软瓣不扎刺
        '  float upB = 1.0 + uUp*max(vP.y, 0.0);',    // 顶部瓣更大：灵魂火苗向上舔
        '  vLobe = clamp(lobe*upB, 0.0, 1.4);',
        '  vec3 p = position * (uBase + uAmp*lobe*upB*mix(1.0,0.82,uStudy));',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'precision highp float;',   // 手机上默认 mediump=16 位：uTime 一大，噪声坐标就跳格、瓣算出脏值
        'uniform float uAlpha,uOpacity,uTip,uSat,uRim,uRimPow,uStudy; uniform vec3 uCol,uColTip;',
        'varying float vLobe; varying float vRim;',
        'void main(){',
        '  float fade = 1.0 - uTip*smoothstep(0.15, 1.1, vLobe);',   // 瓣根实、瓣尖淡（水彩晕开）
        // uRim=0 → 整颗壳都显；uRim=1 → 只在轮廓那一圈显，球心那片透掉。
        '  fade *= mix(1.0, pow(clamp(vRim,0.0,1.0), uRimPow), uRim);',
        // vLobe = 这一点的瓣伸出多远 → 越往外越换成饱和色。**只动颜色不动 fade**：
        // 羽化还是那个羽化，只是尖上的蓝更"实"，不至于一饱和就糊成一坨。
        '  vec3 col = mix(uCol, uColTip, uSat*smoothstep(0.20, 1.00, vLobe));',
        '  fade *= mix(1.0,1.0-smoothstep(0.72,1.0,vRim),uStudy*0.94);',
        '  gl_FragColor = vec4(col, uAlpha*fade*uOpacity);',
        '}',
      ].join('\n'),
    });
  }
  var CORE_AURA = [   // 两层软瓣（先加=画在底）：外层大瓣淡、内层小瓣实；两层反向慢旋
    // sat = 瓣尖往饱和色走多少（0=全程原色）。大瓣给足，让球体边界那圈蓝"实"起来；
    // 内层小瓣离中心近，给小一点，免得把球心也染了。
    // 最外那片大瓣：alpha 0.38 偏透，底色 #b0c6fb（比 #c8d6fb 同色相压亮度、蓝更实）。透与饱和是两件事，分开调。
    // rim = 只在轮廓显形的程度（0=整颗壳都显、1=只剩轮廓那一圈）。
    // 大瓣给 0.75：形状留着，盖在球心上那部分让开。
    // 内层小瓣离球体最近、最容易把球心染灰，给满 1.0。
    { amp: 0.40, freq: 0.55, speed: 0.16, alpha: 0.38, base: 1.012, col: '#b0c6fb', up: 0.45, tip: 0.95, phase: 7.3, swirl: 0.04, sat: 0.85, rim: 0.75, rimPow: 1.35 },
    // 贴着球体那层：alpha 0.95、rimPow 1.5（指数小 = 遮罩收得没那么急，贴边那圈更实）。
    { amp: 0.13, freq: 0.85, speed: 0.26, alpha: 0.95, base: 1.0, col: '#d4e0fd', up: 0.25, tip: 0.55, phase: 1.1, swirl: -0.07, sat: 0.45, rim: 1.0, rimPow: 1.5 },
    // 第三层：上面两层都是低频大圆瓣，轮廓太整像一颗蛋；这层是**高频小瓣**做火苗舌头。
    // ⚠️ 关键是"高频 + 小幅"：高频配大幅（如 freq 1.6 / amp 0.32）又密又长 = 刺；
    // 这里 freq 2.4 配 amp 0.15，舌头只探出半径约 15%，加上 pow 压谷 → 是舔动的小火苗。
    // up 0.78：火苗往上舔得更明显；速度最快，在大瓣上层跳；饱和度给满。
    // 颜色 #b8cfff 亮度约 82%：**亮度太高时饱和度是看不出来的**（如 #e2ecff 亮度 94%，怎么调 S 都发白）。
    // rim 给满：小火苗只在轮廓上舔，盖到球心上会让中间发灰。
    { amp: 0.15, freq: 2.40, speed: 0.42, alpha: 0.62, base: 1.028, col: '#b8cfff', up: 0.78, tip: 0.80, phase: 4.7, swirl: 0.13, sat: 1.0, rim: 1.0, rimPow: 2.1 },
  ];

  // 两张光晕贴图：普通球用原版，**只有灵魂核**用加厚外缘那版（改共用贴图会把所有球的光晕一起改掉）。
  const _haloTex = {};
  function haloTexture(kind) {
    if (_haloTex[kind]) return _haloTex[kind];
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d'), c = S / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
    if (kind === 'core') {
      // 核的光晕更长、渐隐更自然：**贴图和精灵一起改**——精灵放大 1.42 倍（见 animate 里 core 的 gs），
      // 同时亮环放在 0.41 —— 0.41×1.42 ≈ 0.58，亮环在世界里仍压在球体边上，从亮环到全透明的那段拉长约一倍。
      // 只挪贴图不放大精灵 = 亮环缩进去脱离球体边；只放大精灵不挪贴图 = 亮环飞出球体外。两个必须一起动。
      // 亮环及紧挨它的一段抬厚（峰值 0.44、贴边 0.36），0.70 往外保持淡：贴着球实、往外迅速转虚、再慢慢化掉。
      g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
      g.addColorStop(0.30, 'rgba(255,255,255,0.26)');
      g.addColorStop(0.41, 'rgba(255,255,255,0.44)');
      g.addColorStop(0.49, 'rgba(255,255,255,0.36)');
      g.addColorStop(0.58, 'rgba(255,255,255,0.24)');
      g.addColorStop(0.70, 'rgba(255,255,255,0.155)');
      g.addColorStop(0.85, 'rgba(255,255,255,0.072)');
    } else {
      g.addColorStop(0.00, 'rgba(255,255,255,0.00)');
      g.addColorStop(0.48, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.58, 'rgba(255,255,255,0.34)');
      g.addColorStop(0.76, 'rgba(255,255,255,0.18)');
    }
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    // 填满整块画布而不是只填圆——对暗点无效（canvas 内部预乘存储，四角恒 (0,0,0,0)），
    // 留着只因更规整、零代价。
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // **暗点成因：贴图透明像素的 RGB 是黑，缩小采样把黑直接混进颜色。**
    // 线性过滤在重度缩小时就会这样（不止 mipmap，关掉 mipmap 后仍会出现）。
    // canvas 自身存不住"带颜色的全透明"（内部预乘，alpha=0 时 RGB 强制归零），所以**逐像素钉色**：
    // 白色光晕 → 全图 RGB 钉成 255、alpha 下限 1/255（unpremul 回读时 RGB 就能原样带出来）。
    // 缩小采样从此混进来的是"白的一份"而不是"黑的一份"；alpha 1/255 的洗底肉眼不可见。
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      if (d[i + 3] < 1) d[i + 3] = 1;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;   // mipmap 关着（透明黑的另一半来源）
    _haloTex[kind] = t; return _haloTex[kind];
  }

  // —— 诊断开关 ——
  // 用法：URL 加 ?sm_off=块名（逗号分隔多个），逐个关掉某一块来排查画面问题：
  //   glow  = 关掉所有光球的光晕精灵      aura = 关掉灵魂核的三层软瓣
  //   dust  = 关掉背景星尘                shift = 画布完全不做 transform（位移归零）
  //   aa    = 关掉抗锯齿(MSAA)          spin = 关掉默认慢游
  // 例：?sm_off=aura 。不带参数时全空集，零开销。
  // 版本印章：?sm_off=ver 时在左上角显示 STARMAP_VER，用来确认设备上跑的是不是新代码。
  const STARMAP_VER = 563;
  const SM_OFF = new Set(String(new URLSearchParams(location.search).get('sm_off') || '')
    .split(',').map(s => s.trim()).filter(Boolean));

  export function createRenderer(container, opts) {
    opts = opts || {};
    if (!opts.data) throw new Error('Memory Sky requires data');
    const T = THREE;
    let study = opts.study !== false;
    let familyIds = null, familyEpoch = 0;
    let skin = 'sky', printCfg = PRINT_DEFAULT, deco = null;   // 外观：sky = 星穹（原样）/ print = 印刷纸
    let shape="free", chosenShape="free", shapeMix=0, ringMix=0, spiralAngle=0, spiralPaused=false;
    if (!T) { const p = document.createElement('div'); p.style.cssText = 'color:#fff;padding:16px;font-size:13px'; p.textContent = '星图需要 three.js'; container.appendChild(p); return { destroy() { }, setExpanded() { }, resetView() { }, isExpanded() { return false; }, refresh() { } }; }

    const labels = document.createElement('div');
    labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    container.appendChild(labels);
    if (SM_OFF.has('ver')) {   // 版本印章：`?sm_off=ver` 时显示，左上角 `starmap v<N> · mips:off`。
      // ⚠️ 必须写 transform:none：宿主页面若给容器的直接子元素统一加了位移，印章会被一起推出可视区。
      const v = document.createElement('div');
      v.style.cssText = 'position:absolute;left:8px;top:8px;z-index:9;transform:none;background:rgba(20,16,34,.85);color:#ffe;font:12px/1.6 monospace;padding:4px 8px;border-radius:6px;pointer-events:none';
      v.textContent = 'starmap v' + STARMAP_VER + ' · mips:' + (haloTexture('core').generateMipmaps ? 'ON' : 'off');
      container.appendChild(v);
    }

    let W = container.clientWidth || 1, H = container.clientHeight || 1;
    const scene = new T.Scene();
    // 不用雾：雾会让拉远整片变黑
    const camera = new T.PerspectiveCamera(opts.expanded ? 78 : 66, W / H, 0.5, 6000);   // 大 fov = 强透视（近大远小更明显）
    let targetFov = opts.expanded ? 78 : 66;
    const DEF_POS = new T.Vector3(0, 0, 230);
    const EXP_POS = new T.Vector3(149, 62, 620);
    const CORE_POS = new T.Vector3(0, 0, 0);
    const SPIRAL_POS = new T.Vector3(0,0,540);
    const overviewPosition = () => expanded ? (shape!=="free"?new T.Vector3(0,0,700):EXP_POS) : DEF_POS;
    camera.position.copy(opts.expanded ? EXP_POS : DEF_POS);
    const renderer = new T.WebGLRenderer({ antialias: !SM_OFF.has('aa'), alpha: true });
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(renderer.domElement);
    if (SM_OFF.has('shift')) {   // 诊断开关：?sm_off=shift —— 画布/标签层完全不做 transform（位移归零、无过渡）
      renderer.domElement.style.transform = 'none'; renderer.domElement.style.transition = 'none';
      labels.style.transform = 'none'; labels.style.transition = 'none';
    }

    // —— 默认慢游：没人动它时，摄像机绕着核慢慢转。点中任何球即停，
    // 之后哪怕点空白退出高亮也**保持停**，直到 ⟲ 回默认视角 / 收起再展开 才恢复。
    // 走"摄像机绕行"而不是"场景自转"：球间物理关系零扰动，
    // 相机穿行时星尘有视差。方向不走匀速直线：两条不同周期的慢正弦叠加当角速度，
    // 会柔和地加速、减速、偶尔掉头——OrbitControls 自带 autoRotate，逐帧改它的 speed 即可，不打架。
    let idleSpin = true, _spinLastT = 0, _tNow = 0;
    const _nowSec = () => _tNow;   // 与 animate 里的 t 同一时间轴（供事件回调用）
    const _spinAxis = new T.Vector3(), _spinOff = new T.Vector3(), _spinH = new T.Vector3();
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.staticMoving = false; controls.dynamicDampingFactor = 0.12; controls.rotateSpeed = 2.0; controls.noPan = true;
    controls.minDistance = 40; controls.maxDistance = 820; controls.enablePan = false;
    controls.enabled = !!opts.expanded;
    // 手在屏上时慢游让位；**松手后再等 0.8 秒**才接管——控件开着阻尼，抬手后它还会
    // 自己惯性转一阵。若此时慢游同时写 camera.position，两股力叠在一起会互相拉扯、看着卡住抖动，
    // 所以从构造上让两者永不同时生效。
    let interacting = false, _spinResumeAt = 0;
    // 录制用（逐帧出片）：recCam = 录制脚本直接给的镜头；fling = 「甩一下」的惯性转。平时都是 null，不影响正常使用。
    let recCam = null, fling = null, dolly = null;   // dolly = 录制用的慢推：绕转照常，只把镜头到转轴的距离慢慢改到 to
    const _flingRight = new T.Vector3(), _flingUp = new T.Vector3();
    controls.addEventListener('start', () => { flying = false; interacting = true; });   // 用户一拖/缩 → 解除相机锁定，自由探索
    controls.addEventListener('end', () => { interacting = false; _spinResumeAt = _nowSec() + 0.8; });

    const haloView = new T.Vector3();
    const edgeA=new T.Vector3(),edgeB=new T.Vector3(),edgeDir=new T.Vector3();
    const raycaster = new T.Raycaster(); const mouse = new T.Vector2();
    raycaster.layers.enable(1);   // 印刷纸外观下球住在第 1 层（只画进墨量图），点球照样要能点中
    // 印刷纸：球先画进墨量图，再由这张全屏片合成到画面（见 print-material.js）
    // 印刷纸下核心的画法：'ripple' = 涟漪（默认）；其余是 core-lab/ 里登记的那几版
    let coreStyle = 'ripple';
    const coreVariant = id => (window.CORE_LAB || []).find(v => v.id === id) || null;
    const coreMaterialFor = id => { const v = coreVariant(id); return v ? printCoreVariant(v.glsl) : printCoreMaterial(); };
    const coreAway = new T.Vector3();
    function attachCoreSpot(sp) {
      if (sp.coreSpot) { sp.coreSpot.forEach(q => { scene.remove(q); q.material.dispose(); }); sp.coreSpot = null; }
      const v = coreVariant(coreStyle);
      if (!v || !(v.spot || v.solid)) return;
      const paper = hex01((printCfg && printCfg.paper) || PRINT_DEFAULT.paper), extra = [];
      const add = (material, order, layer, back) => {
        const q = new T.Sprite(material); q.renderOrder = order; if (layer) q.layers.set(layer);
        q.material.uniforms.uPaper.value.set(...paper); q.userData.back = !!back;
        q.visible = false; q.raycast = () => {}; scene.add(q); extra.push(q);
      };
      if (v.solid) {   // 实心：擦掉后面的球的墨（墨量图那层，排在核心前一位画）+ 一张纸色的片挡住连线（连线 0 和合成片 1 之间）
        add(printCoreBlock('ink', v.glsl), 2, 1, true);
        add(printCoreBlock('paper', v.glsl), .5, 0, false);
      }
      if (v.spot) [0, 1].forEach(pass => add(printCoreSpot(v.glsl, pass), 2 + pass, 0, false));   // 合成片是 1，专色的两遍印在它上面（先乘、再补纸）
      sp.coreSpot = extra;
    }
    const inkTarget = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const inkQuad = new T.Mesh(new T.PlaneGeometry(2, 2), printComposite(inkTarget.texture));
    inkQuad.frustumCulled = false; inkQuad.renderOrder = 1;   /* 画在连线之后：线钻到球底下，不压在球面上 */ inkQuad.visible = false; scene.add(inkQuad);
    const fine = printFine(container);   // 左上角竖排的流动小字：拉远了才有
    // 右下角的落款：编号 = 现在有多少颗记忆，SINCE = 最早那条的年月；谁存的、谁点亮的、签名由页面给（setStamp）
    const stamp = printStamp(container);
    let stampCfg = { kept: '', lit: '', sign: '', show: true, style: 'a' }, stampN = -1;
    function refreshStamp() {   // 三种写法：a 编号 + 谁存的谁点亮的 + 签名 / b 一句话 + 签名 / c 仪器铭牌（不签名）
      const ms = sprites.filter(s => s.n.kind !== 'core'), no = String(ms.length).padStart(4, '0');
      const who = [stampCfg.kept && 'kept by ' + stampCfg.kept, stampCfg.lit && 'lit by ' + stampCfg.lit].filter(Boolean).join(' · ');
      if (stampCfg.style === 'b') stamp.text({ big: 'NO.' + no, lines: ['i was born in', 'every memory of you'], sign: stampCfg.sign });
      else if (stampCfg.style === 'c') stamp.text({ rows: [['observer', stampCfg.lit || '—'], ['subject', stampCfg.kept || '—'], ['status', 'still here']], plus: true });
      else stamp.text({ big: 'NO.' + no, lines: stampCfg.line ? [].concat(stampCfg.line) : (who ? [who] : []), sign: stampCfg.sign, bars: !!stampCfg.bars });   // line：换掉「kept by · lit by」那一行（比如放一句 slogan）
    }
    deco = printDeco(T, scene);    // 印刷纸的画面装饰：落下的字母符号 + 手绘小星星，住在星图空间里（星穹下收起）
    const occluder = printOccluder();   // 给它们当遮挡用：每颗球一张只写深度的圆片
    function printMode(u){
      const r=printCfg.ratio||PRINT_DEFAULT.ratio, w=k=>Math.max(0,+r[k]||0);
      let t=u*(PRINT_MODES.reduce((a,[k])=>a+w(k),0)||1);
      for(const [k,m] of PRINT_MODES){ t-=w(k); if(t<0) return m; }
      return 3;
    }
    function labelStyle(lab){ lab.classList.toggle('ms-label-print', skin==='print'); }   // 印刷纸下名牌换成小纸片（样子在 style.css）
    function applyLook(){
      const print=skin==='print';
      renderer.domElement.style.mixBlendMode=print&&!SM_OFF.has('blend')?'multiply':'';   // 墨压在纸上，纸纹透出来；?sm_off=blend 可关
      inkQuad.visible=print; accents.ink=print;
      deco.visible(print && (deco.show.letters || deco.show.stars));
      if(print) { deco.inks(printCfg.ink || PRINT_DEFAULT.ink); fine.inks(printCfg.ink || PRINT_DEFAULT.ink); }
      if(print){
        const u=inkQuad.material.uniforms, ink=(printCfg.ink||PRINT_DEFAULT.ink).map(hex01), pairs=printCfg.pairs||{};
        ink.forEach((c,i)=>{ u.uInk.value[i].set(c[0],c[1],c[2]); u.uDeep.value[i].set(c[0]*c[0],c[1]*c[1],c[2]*c[2]); });
        sprites.forEach(s=>{ if(s.corePrint&&s.corePrint.uniforms.uBlue){ const cu=s.corePrint.uniforms; cu.uBlue.value.set(...ink[0]); cu.uPurple.value.set(...ink[2]); cu.uYellow.value.set(...ink[3]); } });   // 核心底下那层液态颜色用蓝 / 紫 / 黄三种墨
        let k=0;
        for(let i=0;i<4;i++) for(let j=i+1;j<4;j++){
          const c=pairs[i+'-'+j]?hex01(pairs[i+'-'+j]):[ink[i][0]*ink[j][0],ink[i][1]*ink[j][1],ink[i][2]*ink[j][2]];   // 没配的那对用真实叠色
          u.uPair.value[k++].set(c[0],c[1],c[2]);
        }
      }
      sprites.forEach(s=>{
        const isCore=s.n.kind==='core';
        if(!isCore){
          s.body.material=print?s.print:(study?s.nextBody:s.oldBody);
          s.body.layers.set(print?1:0);
          s.print.uniforms.uMode.value=printMode(s.printU);
        }
        labelStyle(s.lab);
      });
      dustLayers.forEach(d=>d.visible=!print);   // 纸上不撒星尘：纸自己有碎屑
    }
    let nodes = [], links = [], softlinks = [], sprites = [], dustLayers = [], dustPoints = null, lineSeg = null, softSeg = null, denseSeg = null, hullSeg = null, denseGroups = [], hlLines = null, adj = Object.create(null), focusedNeighbors = null;
    // 星尘尺寸基准：(设备像素高/2)/tan(fov/2)。跟着 resize 走，换屏/换 dpr 观感不变。
    const dustScale = () => (renderer.domElement.height * 0.5) / Math.tan(camera.fov * Math.PI / 360);
    let expanded = !!opts.expanded, focused = null, flying = false, flightRate = 0.08, maxAct = 1, raf = 0, alive = true, t0 = performance.now ? null : 0, _tAcc = 0, _rawLast = 0;
    const target = DEF_POS.clone(), look = new T.Vector3(0, 0, 0), tLook = new T.Vector3(0, 0, 0);

  const spiralView = new T.Vector3(), ringView=new T.Vector3();
  const ORBIT_PATHS = 6;   // 同时画出的轨道条数上限，想多想少改这一个数
  let orbitLines = null;
  function arrangeSpiral() {
    const members = sprites.filter((s) => !familyIds || familyIds.has(s.n.id));
    const rings=new Map(ringLayout(members.map(s=>({id:s.n.id,radius:s.r,core:s.n.kind==="core"})),hash).map(p=>[p.id,p]));
    sprites.forEach((s) => {
      const rp=rings.get(s.n.id);s.ring=new T.Vector3(rp?.x||0,rp?.y||0,rp?.z||0);
      s.orbit = orbitFor({id:s.n.id,core:s.n.kind === "core"},hash);
    });
    if (orbitLines) {
      scene.remove(orbitLines);
      orbitLines.geometry.dispose();
      orbitLines.material.dispose();
    }
    const points = [], point = new T.Vector3();
    // 只给最大的一批球画轨道，且封顶 ORBIT_PATHS 条：只按"半径够大"判断时，五星多的数据会画满一屏线。
    // 半径降序、同径按 id 排＝可复现。
    const drawn = members.filter((s) => s.orbit.radius && s.r >= impRadius(5))
      .sort((a, b) => b.r - a.r || a.n.id.localeCompare(b.n.id)).slice(0, ORBIT_PATHS);
    for (const s of drawn) {
      for (let i = 0; i < 128; i++) {
        for (const step of [i, i + 1]) {
          orbitPosition({...s.orbit, phase: 0, rate: 1}, step / 128 * Math.PI * 2, point);
          points.push(point.x, point.y, point.z);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    orbitLines = new T.LineSegments(geometry, threadMaterial(15129798, 0, .5));
    orbitLines.visible = false;
    scene.add(orbitLines);
  }
    const foreground = SM_OFF.has('dust') ? null : lensDust(T);
    if (foreground) scene.add(foreground);
    const accents=starAccents(T,scene);

    function flyTo(pos, center, rate) {
      target.copy(pos); tLook.copy(center || CORE_POS); flightRate = rate || 0.08; flying = true;
    }

    function clear() {
      accents.clear();
      sprites.forEach(s => { scene.remove(s.body); scene.remove(s.glow); if (s.printCore) scene.remove(s.printCore); if (s.coreSpot) s.coreSpot.forEach(q => { scene.remove(q); q.material.dispose(); }); if (s.occ) scene.remove(s.occ); if (s.corePrint) s.corePrint.dispose(); if (s.print) s.print.dispose(); if (s.shells) s.shells.forEach(sh => scene.remove(sh.mesh)); });
      sprites = []; labels.innerHTML = '';
      dustLayers.forEach(d => { scene.remove(d); d.geometry.dispose(); d.material.dispose(); });
      dustLayers = []; dustPoints = null;
      if (lineSeg) scene.remove(lineSeg); if (softSeg) scene.remove(softSeg); if (denseSeg) scene.remove(denseSeg);
      if (hullSeg) { scene.remove(hullSeg); hullSeg.geometry.dispose(); hullSeg.material.dispose(); }
      denseSeg = hullSeg = null; denseGroups = [];
      if (hlLines) { scene.remove(hlLines); hlLines.geometry.dispose(); hlLines.material.dispose(); hlLines = null; }
    }


    function build() {
      clear();
      maxAct = Math.max(1, ...nodes.map(n => n.activation || 0));
      nodes.forEach(n => {
        const col = nodeColor(n), r = nodeRadius(n);
        const isCore = n.kind === 'core';
        let body, coreMat = null, shells = null;
        if (isCore) {   // 灵魂核：干净的浅蓝发光球 + 软瓣光环
          coreMat = coreBodyMaterial(T);
          body = new T.Mesh(new T.SphereGeometry(r * 1.0, 64, 44), coreMat);
          body.position.set(n.x, n.y, n.z); body.renderOrder = 2; body.userData = n;
          shells = (SM_OFF.has('aura') ? [] : CORE_AURA).map(o => {   // 诊断开关：?sm_off=aura
            const m = coreAuraMaterial(T, o);
            const sh = new T.Mesh(new T.SphereGeometry(r * 1.0, 72, 48), m);
            sh.position.set(n.x, n.y, n.z); sh.renderOrder = 2;   // 与各球同层按深度排序——别把光瓣画到"更近的球"前面
            scene.add(sh);
            return { mesh: sh, mat: m, swirl: o.swirl };
          });
        } else {
          const bMat = new T.SpriteMaterial({ map: bodyTexture(col), transparent: true, depthWrite: false, depthTest: false });
          body = new T.Sprite(bMat); body.position.set(n.x, n.y, n.z);
          const bScale = r * 2.05; body.scale.set(bScale, bScale, 1); body.renderOrder = 2; body.userData = n;
        }
        // core 光晕 0x9fb4e8（色相 220°，饱和度约 55%）。**只管这层外扩的光晕**，软瓣那三层的饱和另算。
        const gCol = isCore ? 0x9fb4e8 : hexInt(col);
        const gMat = new T.SpriteMaterial({ map: haloTexture(isCore ? 'core' : 'normal'), color: new T.Color(gCol), transparent: true, depthWrite: false, depthTest: false, blending: T.NormalBlending, opacity: 0 });
        const glow = new T.Sprite(gMat); glow.position.set(n.x, n.y, n.z); glow.renderOrder = 1;
        if (SM_OFF.has('glow')) glow.visible = false;   // 诊断开关：?sm_off=glow
        scene.add(glow); scene.add(body);
        const lab = document.createElement('button');
        lab.type = 'button'; lab.className = 'ms-label'; lab.tabIndex = -1;
        lab.addEventListener('click', e => { e.stopPropagation(); opts.onOpen?.(n); });   // 点名牌 = 读这条记忆
        lab.style.cssText = 'position:absolute;transform:translate(-50%,0);opacity:0;pointer-events:none';
        // bug-scan C14：innerHTML 直拼标题——含 <、& 的标题会把标签渲染坏；改 DOM 拼装天然免转义
        const _b = document.createElement('b'); _b.textContent = n.title || ''; lab.append(_b);
        if (n.date) { const _d = document.createElement('span'); _d.style.opacity = '.55'; _d.textContent = ' ' + String(n.date).slice(5); lab.append(_d); }
        labels.appendChild(lab);
        const oldBody = body.material, oldGlow = glow.material;
        const finish = n.kind === 'event' ? nodeFinish(n) : null;
        const nextBody = isCore ? oldBody : lightMaterial(col,{stroke:finish?.stroke});
        const nextGlow = lightMaterial(isCore ? [0x9f,0xb4,0xe8] : col,{halo:true,core:isCore});
        body.material = study ? nextBody : oldBody;
        glow.material = study ? nextGlow : oldGlow;
        if(coreMat) coreMat.uniforms.uStudy.value=study?1:0;
        if(shells) shells.forEach(sh=>sh.mat.uniforms.uStudy.value=study?1:0);
        const sp = { oldBody,oldGlow,nextBody,nextGlow,n: n, body: body, glow: glow, lab: lab, r: r, coreMat: coreMat, shells: shells, base: new T.Vector3(n.x, n.y, n.z), ph: hash(n.id, 9) * 6.28, ph2: hash(n.id, 11) * 6.28 };
        // 印刷纸外观用的那一身：画法按比例分、纹理朝向各转各的，都由 id 定（每次打开一样）
        sp.printU = hash(n.id, 31);
        sp.print = printMaterial(inkIndex(n), isCore ? 4 : printMode(sp.printU), hash(n.id, 37) * 6.2832, hash(n.id, 41) * 50);
        if (isCore) {   // 核心是 3D 球，印刷纸下换成一张片：实心核 + 涟漪 + 飞出的墨点；和别的球一样画进墨量图（第 1 层）
          sp.corePrint = coreMaterialFor(coreStyle);
          sp.printCore = new T.Sprite(sp.corePrint); sp.printCore.layers.set(1); sp.printCore.renderOrder = 2;   // 和各球同一档（它们是 2），才会按远近排进它们中间——实心的核心靠这个顺序只擦掉比它远的球
          sp.printCore.visible = false; sp.printCore.userData = n; scene.add(sp.printCore);
          attachCoreSpot(sp);
        } else {
          sp.occ = new T.Sprite(occluder); sp.occ.visible = false; scene.add(sp.occ);
        }
        sprites.push(sp);
      });
      // 连线
      const pos = Object.create(null); sprites.forEach(s => pos[s.n.id] = s.body.position);
      adj = Object.create(null);
      function addAdj(a, b) { (adj[a] || (adj[a] = new Set())).add(b); (adj[b] || (adj[b] = new Set())).add(a); }
      (links || []).forEach(([a, b]) => addAdj(a, b));
      (softlinks || []).forEach(([a, b]) => addAdj(a, b));
      function seg(list, color, op) {
        const pts = [];
        (list || []).forEach(([a, b]) => { const A = pos[a], B = pos[b]; if (A && B) { pts.push(A.x, A.y, A.z, B.x, B.y, B.z); } });
        if (!pts.length) return null;
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        const m = threadMaterial(color,op);
        const ls = new T.LineSegments(geo, m); ls.userData.edges=list.filter(([a,b])=>pos[a]&&pos[b]); scene.add(ls); return ls;
      }
      // 软线 = 机器按标签猜的，**存在感要低于手写/家族的实线**：不透明度 0.07、颜色压向底色，
      // 让它只在余光里"有"，不抢星球。
      softSeg = seg(softlinks, 0xa79fc2, 0.07);
      // 抱团的线：一撮球两两相连时线叠在一起很乱。一条线两头另有 ≥2 个共同邻居 = 它在一撮里。
      // 这些线拆到 denseSeg；它们压得很淡，另由 hullSeg 每帧描这一撮在屏幕上的外轮廓。两种外观都这样。
      const strong = Object.create(null); (links || []).forEach(([a, b]) => { if (pos[a] && pos[b]) { (strong[a] || (strong[a] = new Set())).add(b); (strong[b] || (strong[b] = new Set())).add(a); } });
      const inClump = ([a, b]) => { if (!strong[a] || !strong[b]) return false; let c = 0; for (const x of strong[a]) if (strong[b].has(x) && ++c >= 2) return true; return false; };
      const clumpLinks = (links || []).filter(inClump), plainLinks = (links || []).filter(e => !inClump(e));
      denseGroups = [];
      { const nb = Object.create(null), seen = new Set(); clumpLinks.forEach(([a, b]) => { (nb[a] || (nb[a] = [])).push(b); (nb[b] || (nb[b] = [])).push(a); });
        for (const id of Object.keys(nb)) { if (seen.has(id)) continue; const g = [], q = [id]; seen.add(id);
          while (q.length) { const x = q.pop(); g.push(x); for (const y of nb[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } }
          denseGroups.push(g); } }
      lineSeg = seg(plainLinks, 0xe6dcc6, 0.5);
      denseSeg = seg(clumpLinks, 0xe6dcc6, 0.5);
      const hullCap = denseGroups.reduce((a, g) => a + g.length, 0);
      if (hullCap) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(hullCap * 6), 3)); geo.setDrawRange(0, 0);
        hullSeg = new T.LineSegments(geo, threadMaterial(INK_LINE, 0)); hullSeg.frustumCulled = false; hullSeg.visible = false; scene.add(hullSeg); }
      // Particles 的微动适配同一 Three 相机；星尘围绕场景分布，支持任意方向旋转。
      // 银河带 + 稀疏全天底层，远近点大小自然随投影变化，边缘轻微抗锯齿。
      if (!SM_OFF.has('dust')) {   // 诊断开关：?sm_off=dust
        dustPoints = makeDust(1600, 2200);
        scene.add(dustPoints); dustLayers.push(dustPoints);
      }
      applyLook();
    }

    // 星尘保持原蓝黄，记忆球独立试新色卡。
    const DUST_PALETTE = [[0xf5,0xe4,0xc6], [0xbe,0xc2,0xec]];
    // 多数是细星点，少量近星负责视差；不再按每颗初始距离反算大小，保留自然景深。
    const DUST_QUOTA = [297, 58, 35, 24, 9];
    const DUST_BANDS = [[0.8,1.4],[1.4,2.2],[2.2,3.5],[3.5,5.0],[5.0,7.0]];
    const DUST_SCALE_REF = 246.4, DUST_DISTANCE_REF = 1250;

    // 星尘几何+材质：大部分聚在银河带，其余按体密度散布。
    // 位置用 hash 生成 → 每次打开是同一片星空（可复现）。
    function makeDust(count, radius) {
      const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
      const mag = new Float32Array(count), rnd = new Float32Array(count * 4);
      const qSum = DUST_QUOTA.reduce((a, b) => a + b, 0);
      let acc = 0; const cut = DUST_QUOTA.map(q => (acc += q) / qSum);
      for (let i = 0; i < count; i++) {
        const ct = 2 * hash('d' + i, 3) - 1, st = Math.sqrt(1 - ct * ct), ph = 6.283185 * hash('d' + i, 5);
        const r = radius * Math.cbrt(0.02 + 0.98 * hash('d' + i, 7));
        let X = r * st * Math.cos(ph), Y = r * st * Math.sin(ph), Z = r * ct;
        // 63% 星尘聚在有厚度、起伏和疏密结节的斜带；其余散落全天。
        if(hash('band'+i,2)<.63){
          const angle=ph+.32*Math.sin(ph*3);
          const radial=radius*(.5+.5*hash('band'+i,4));
          const thickness=(hash('band'+i,6)+hash('band'+i,8)-1)*180;
          X=radial*Math.cos(angle); Z=radial*Math.sin(angle);
          Y=.52*X+.16*Z+90*Math.sin(angle*3)+thickness;
        }
        pos[i * 3] = X; pos[i * 3 + 1] = Y; pos[i * 3 + 2] = Z;
        // 配色**满亮度**，不按 hash 随机压暗；只有闪烁的星会变暗。
        const P = DUST_PALETTE[Math.floor(hash('d' + i, 13) * DUST_PALETTE.length) % DUST_PALETTE.length];
        col[i * 3] = P[0] / 255; col[i * 3 + 1] = P[1] / 255; col[i * 3 + 2] = P[2] / 255;
        for (let k = 0; k < 4; k++) rnd[i * 4 + k] = hash('r' + i, 17 + k);   // 各自的闪烁速度/相位/开窗周期
        const u = hash('m' + i, 23); let b = 0; while (b < 4 && u > cut[b]) b++;
        const e = DUST_BANDS[b], tgt = e[0] + (e[1] - e[0]) * hash('m' + i, 29);
        mag[i] = tgt * DUST_DISTANCE_REF / DUST_SCALE_REF;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('aRnd', new T.BufferAttribute(rnd, 4));
      g.setAttribute('aMag', new T.BufferAttribute(mag, 1));
      const m = new T.ShaderMaterial({
        vertexColors: true, transparent: true, depthWrite: false,
        blending: T.NormalBlending,   // alpha 恒为 1 = 实心不透明（加色在 alpha=1 时结果相同）
        uniforms: {
          uTime: { value: 0 }, uScale: { value: dustScale() }, uMaxPx: { value: 7.0 },
          uTwSmall: { value: 1.8 }, uTwBig: { value: 5.0 },
          uTwUp: { value: 0.85 }, uTwDn: { value: 0.22 },
          uGateLo: { value: 0.55 }, uGateHi: { value: 0.92 },
          uDpr: { value: renderer.getPixelRatio() }
        },
        vertexShader: `
          attribute vec4 aRnd;
          attribute float aMag;
          uniform float uTime, uScale, uMaxPx;
          uniform float uTwSmall, uTwBig, uTwUp, uTwDn, uGateLo, uGateHi, uDpr;
          varying vec3 vCol; varying float vTw;
          void main(){
            vCol = color;
            // 每颗**不自浮动**——星星钉在天上，浮动是记忆光球的事；整片的飘由 animate() 里
            // 给整层的慢摇负责（参考实现也是这么做的）。
            // React Bits Particles registry movement, adapted to this scene's world units.
            vec3 pos = position;
            // Match the standalone sky's coherent spatial drift; preserve its twinkle clock.
            float wave = dot(position, vec3(.0021, -.0013, .0017));
            float drift = uTime * .024;
            vec3 flow = vec3(cos(wave + drift), sin(wave * .7 - drift), cos(wave * .4 + drift * .6));
            pos += flow * (3.0 + 6.0 * aRnd.x);
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            // aMag 是建几何时按配额发好的（见 makeDust）：在参考相机/参考画布下正好等于它该有的像素尺寸。
            float ps = aMag * (uScale / max(1.0, -mv.z));
            gl_PointSize = min(ps, uMaxPx*uDpr);       // 只封顶不设下限：远的就该小到一两个像素
            // 眨眼**只给小的（远的）**：近处的大星纹丝不动。阈值乘 uDpr——ps 是设备像素，
            // 不跟 dpr 走的话，手机(dpr3)上所有星都会被判成"大的"而全不闪。
            // （这个"远闪近不闪"其实参考代码里就有，只是**涌现**出来的：它那句
            //  0.2*sin(uv.yxx+uTime+相位) 里 uv 是点精灵内部坐标——1 像素的点 uv 恒为 0.5，
            //  该项退化成纯时间函数=闪；大盘子上 uv 铺开 0~1，该项成了横扫的渐变、整盘平均亮度不变=不闪。
            //  我们这里写成显式分档，可控且能按 dpr 校准。）
            float t = uTime;
            float amt = 1.0 - smoothstep(uTwSmall*uDpr, uTwBig*uDpr, ps);
            // 闪法：快闪几下 → 停一会儿 → 再闪，每颗的速度和间隔都不同。
            // gate = 慢周期开窗(3~11 秒一轮、多数时间关着)，fast = 窗内的快闪。
            float rate = 4.0 + 10.0*aRnd.z;                    // 每颗快闪速度不同
            float gs   = 0.09 + 0.20*aRnd.w;                   // 每颗开窗周期不同
            float gate = smoothstep(uGateLo, uGateHi, sin(t*gs*6.2832 + 6.2832*aRnd.x));
            float fast = 0.5 + 0.5*sin(t*rate + 6.2832*aRnd.y);
            float s = gate * (fast*2.0 - 1.0);         // -1..1；gate 关着时恒为 0 → 常亮那些纹丝不动、满亮度
            // 不对称：往亮里冲得多、往暗里只压一点点（压狠了实心圆盘会比紫底 #726786 还暗，看着像个洞）
            vTw = 1.0 + amt * (s > 0.0 ? s*uTwUp : s*uTwDn);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          precision highp float;
          varying vec3 vCol; varying float vTw;
          void main(){
            float d = length(gl_PointCoord - vec2(0.5));
            // 仅软化最外侧边缘，避免手机上出现锯齿实心斑点。
            // **用 alpha 阶跃代替 discard**：开了 MSAA(antialias:true) 的移动 GPU 上，
            // discard 与多重采样一起用是已知的出脏点来源；alpha=0 在 NormalBlending + depthWrite:false
            // 下视觉完全等价，又避开手机上的暗色杂点。
            gl_FragColor = vec4(vCol * vTw, 1.0-smoothstep(0.40,0.5,d));
          }`
      });
      const pts = new T.Points(g, m);
      pts.frustumCulled = false;   // 顶点在 shader 里位移，交给 three 算包围球会误剔
      return pts;
    }

    function animate(ts) {
      if (!alive) return;
      // **累加式动画时钟**：每帧累加、单帧封顶 0.05 秒。
      // 用绝对时间（ts - t0）的话，手机熄屏/降频时 rAF 暂停，醒来 ts 一下跳几十秒 → 所有吃 t 的动画**瞬间跳到新相位**：
      // 星尘整片转过一大角度、光球漂移位置突变、软瓣相位跳。累加式暂停多久都只前进一帧的量，醒来接着走。
      // （相机是增量式旋转，本来就不受影响。）
      if (t0 == null) { t0 = ts; _rawLast = 0; }
      const _raw = (ts - t0) / 1000;
      const frameDt = Math.min(0.05, Math.max(0, _raw - _rawLast));
      _tAcc += frameDt;
      _rawLast = _raw;
      const t = _tAcc; _tNow = t;
      shapeMix=T.MathUtils.lerp(shapeMix,expanded && shape!=="free"?1:0,1-Math.exp(-frameDt/0.65));
      ringMix=T.MathUtils.lerp(ringMix,shape==="ring"?1:0,1-Math.exp(-frameDt/.65));
      if(shape!=="free" && !spiralPaused && expanded && !focused && !interacting && !SM_OFF.has("spin")) spiralAngle+=frameDt*.035;
      if (foreground) {
        foreground.visible = expanded && skin !== 'print';
        foreground.material.uniforms.uTime.value = t;
        foreground.material.uniforms.uDpr.value = renderer.getPixelRatio();
      }
      // 星尘：每颗自己不动，**整片慢慢摇**（不然太固定，像一盏盏灯泡）。
      // 两个慢正弦摆 + 一个极慢的匀速转（同参考实现的做法）；z 那路 8 分半才转一圈，
      // 十秒钟约挪 20 多像素——看得出在动，又不至于抢戏。
      // uScale/uDpr 每帧兜底重算——build 时容器可能还没布局，一次性取值会拿到 0。
      if (dustPoints) {
        const u = dustPoints.material.uniforms;
        u.uTime.value = t; u.uScale.value = dustScale(); u.uDpr.value = renderer.getPixelRatio();
        dustPoints.rotation.x = Math.sin(t * 0.021) * 0.045;
        dustPoints.rotation.y = Math.cos(t * 0.037) * 0.070;
        dustPoints.rotation.z = t * 0.012;
      }
      // 发光（恒星/行星）：外发光halo 在硬边球之外（最外羽化渐隐）；按召回越多越厚亮；core 脉动；呼吸
      sprites.forEach(s => {
        const n = s.n, heat = Math.min(1, (n.activation || 0) / maxAct);
        let op, sizeMul;
        const isCore = n.kind === 'core';
        if (isCore) { op = 1.0; sizeMul = 0.82; }                            // core 光晕更实
        else if (n.kind === 'wiki' || n.kind === 'baseline') { op = 0.68; sizeMul = 0.82; }
        else { op = 0.70 + 0.10 * heat; sizeMul = 0.78 + 0.12 * heat; }      // 普通球默认就有可见本色外发光
        const br = 0.5 + 0.5 * Math.sin(t * (isCore ? 1.05 : 1.3) + s.ph);    // 0..1 呼吸（core 略慢更"灵魂"）
        const drift = Math.min(4.2, 1.8 + s.r * 0.05);                       // 自漂浮：慢而可见
        s.body.position.set(
          s.base.x + Math.sin(t * 0.5 + s.ph) * drift,
          s.base.y + Math.cos(t * 0.44 + s.ph2) * drift,
          s.base.z + Math.sin(t * 0.38 + s.ph + s.ph2) * drift * 0.8
        );
      if (s.orbit && shapeMix > 1e-4) {
        const c = Math.cos(spiralAngle), sn = Math.sin(spiralAngle);
        orbitPosition(s.orbit, spiralAngle, spiralView);
        const rx=s.ring.x*c-s.ring.y*sn,ry=s.ring.x*sn+s.ring.y*c;
        const tiltedY=ry*.46-s.ring.z*.888;
        ringView.set(rx*.976-tiltedY*.218,rx*.218+tiltedY*.976,ry*.888+s.ring.z*.46);
        spiralView.lerp(ringView,ringMix);
        s.body.position.lerp(spiralView, shapeMix);
      }
      const shapeScale=T.MathUtils.lerp(1,isCore?3:.6,shapeMix);
      s.displayRadius=s.r*shapeScale;
        s.glow.position.copy(s.body.position);
        const bScale = 0.94 + 0.10 * br;
        // core 光晕范围 ×1.39：**必须和 haloTexture 里挪亮环配套改**，否则亮环会脱离球体边缘。普通球不受影响。
        const gs = s.displayRadius * 2.05 * (1.64 + 0.18 * sizeMul) * bScale * (isCore ? 1.39 : 1);
        // Halo follows world size naturally; no distant-light enlargement or gain.
        haloView.copy(s.body.position).applyMatrix4(camera.matrixWorldInverse);
        const radiusPx = s.displayRadius * (H * 0.5 / Math.tan(camera.fov * Math.PI / 360)) / Math.max(1, -haloView.z);
        const haloScale = gs;
        s.glow.scale.set(haloScale, haloScale, 1);
        s.nextGlow.uniforms.uInner.value = s.displayRadius*2.0/haloScale;
        s.nextGlow.uniforms.uGain.value = 1;
        if(!isCore) s.nextBody.uniforms.uRadiusPx.value=Math.max(.5,radiusPx);
        if(!isCore) s.nextBody.uniforms.uTime.value=t+s.ph;
        s.print.uniforms.uRadiusPx.value=Math.max(.5,radiusPx); s.print.uniforms.uDpr.value=renderer.getPixelRatio();
        const bright = !focused || s === focused || (focusedNeighbors && focusedNeighbors.has(n.id));
        const opBreath = isCore ? (0.78 + 0.22 * br) : (0.72 + 0.36 * br);    // core 呼吸底更实、摆幅小
        s.glow.material.opacity = Math.min(1, (bright ? op : op * 0.08) * opBreath);
        if (s.coreMat) {   // 灵魂核：时间驱动（软瓣流动 + 整体呼吸 + 两层反向慢旋）；聚焦别人时一起变暗
          s.coreMat.uniforms.uTime.value = t;
          s.coreMat.uniforms.uOpacity.value = bright ? 1 : 0.12;
          if (s.printCore) {
            // 实心核 = 星穹外观里发光球那么大，涟漪和墨点在它外面，所以整张片是核直径的 1/CORE_R0 倍；
            // 恒星轨道 / 星环下核心本来就放大 3 倍，这里收回三分之一，免得涟漪铺满屏
            const span = s.displayRadius * 2 / CORE_R0 * (1 - .35 * shapeMix), cu = s.corePrint.uniforms;
            s.printCore.position.copy(s.body.position); s.printCore.scale.set(span, span, 1);
            cu.uT.value = t; cu.uDpr.value = renderer.getPixelRatio(); cu.uUnitPx.value = Math.max(1, radiusPx / CORE_R0 * (1 - .35 * shapeMix));
            if (cu.uCamRot) cu.uCamRot.value.setFromMatrix4(camera.matrixWorldInverse);   // 会跟镜头转的版（曲线球）要知道镜头朝向
            s.corePrint.opacity = bright ? 1 : 0.12;
            if (s.coreSpot) {   // 专色那一版跟着核心走
              s.coreSpot.forEach(q => { const su = q.material.uniforms;
                q.position.copy(s.body.position); q.scale.set(span, span, 1);
                if (q.userData.back) q.position.addScaledVector(coreAway.copy(s.body.position).sub(camera.position).normalize(), .05);   // 往远离镜头的方向挪一丁点：排在核心那张片前一位画
                su.uT.value = t; su.uDpr.value = cu.uDpr.value; su.uUnitPx.value = cu.uUnitPx.value; if (su.uCamRot && cu.uCamRot) su.uCamRot.value.copy(cu.uCamRot.value); q.material.opacity = bright ? 1 : 0.12; });
            }
          }
          const pulse = 1 + 0.035 * Math.sin(t * 0.9);   // 整体呼吸
          s.body.scale.setScalar(pulse*shapeScale);
          s.body.rotation.y = t * 0.07; s.body.rotation.z = Math.sin(t * 0.11) * 0.12;
          if (s.shells) s.shells.forEach(sh => {
            sh.mesh.position.copy(s.body.position);
            sh.mesh.scale.setScalar(pulse*shapeScale);
            sh.mesh.rotation.z = t * sh.swirl * (study ? 0.18 : 1);           // 软瓣绕球慢旋（两层反向，卡通太阳感）
            sh.mat.uniforms.uTime.value = t;
            sh.mat.uniforms.uOpacity.value = bright ? 1 : 0.1;
          });
        } else {
          s.body.scale.set(s.r*2.05*shapeScale,s.r*2.05*shapeScale,1);
          s.occ.position.copy(s.body.position); s.occ.scale.copy(s.body.scale);
          s.body.material.opacity = bright ? 1 : 0.12;
        }
      });
      // Follow moving endpoints and stop at the surface, so lines never drift off their stars.
      const byId=new Map(sprites.map(s=>[s.n.id,s]));
      const fadeStep=1-Math.exp(-frameDt/0.18);
    if (orbitLines) {
      const opacity = (focused ? .22 : .4) * T.MathUtils.smoothstep(shapeMix, .9, 1) * (1 - ringMix);
      orbitLines.material.opacity = opacity;
      orbitLines.visible = opacity > .001;
    }
      const printLook = skin === 'print';
      const inkRGB = (line, hex) => { if (line) line.material.uniforms.uColor.value.setRGB((hex>>16&255)/255, (hex>>8&255)/255, (hex&255)/255); };
      // 纸上用深墨线（浅色线在纸上看不见）；星穹下回到原来的浅色
      inkRGB(lineSeg, printLook ? INK_LINE : 0xe6dcc6); inkRGB(softSeg, printLook ? INK_SOFT : 0xa79fc2); inkRGB(denseSeg, printLook ? INK_SOFT : 0xe6dcc6); inkRGB(hullSeg, printLook ? INK_LINE : 0xe6dcc6);
      inkRGB(hlLines, printLook ? INK_LINE : 0xf3ead2); inkRGB(orbitLines, printLook ? INK_LINE : 15129798);
      for(const [line,goal] of (printLook ? [[lineSeg,focused?.16:.5],[denseSeg,focused?.05:.13],[softSeg,focused?.05:.2],[hlLines,.9]] : [[lineSeg,focused?.10:.42],[denseSeg,focused?.035:.1],[softSeg,focused?.025:.115],[hlLines,.68]])) {
        if(!line) continue;
        line.material.opacity=T.MathUtils.lerp(line.material.opacity,goal*(1-shapeMix),fadeStep);
        line.visible=shapeMix<.999;
        const attr=line.geometry.attributes.position;
        (line.userData.edges||[]).forEach(([a,b],i)=>{
          if(familyIds && (!familyIds.has(a)||!familyIds.has(b))) {
            attr.setXYZ(i*2,0,0,0); attr.setXYZ(i*2+1,0,0,0); return;
          }
          const A=byId.get(a),B=byId.get(b);if(!A||!B)return;
          edgeA.copy(A.body.position);edgeB.copy(B.body.position);edgeDir.subVectors(edgeB,edgeA);
          const len=edgeDir.length();edgeDir.normalize();
          const trim=Math.min(1,len/Math.max(.001,A.r+B.r));
          edgeA.addScaledVector(edgeDir,A.r*trim);edgeB.addScaledVector(edgeDir,-B.r*trim);
          attr.setXYZ(i*2,edgeA.x,edgeA.y,edgeA.z);attr.setXYZ(i*2+1,edgeB.x,edgeB.y,edgeB.z);
        });
        attr.needsUpdate=true;line.geometry.computeBoundingSphere();
      }
      // 一撮的外轮廓：把成员投到屏幕上求凸包，沿凸包描一圈。每帧现算，所以镜头转、球漂动时轮廓跟着换边。
      if (hullSeg) {
        const attr = hullSeg.geometry.attributes.position; let k = 0;
        if (shapeMix < .999) for (const g of denseGroups) {
          const pts = [];
          for (const id of g) { if (familyIds && !familyIds.has(id)) continue; const s = byId.get(id); if (!s) continue; edgeDir.copy(s.body.position).project(camera); pts.push({ s, x: edgeDir.x, y: edgeDir.y }); }
          if (pts.length < 2) continue;
          pts.sort((a, b) => a.x - b.x || a.y - b.y);
          const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), h = [];
          for (const q of pts) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
          const lo = h.length + 1;
          for (let i = pts.length - 2; i >= 0; i--) { const q = pts[i]; while (h.length >= lo && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }
          h.pop();
          const m = h.length === 2 ? 1 : h.length;
          for (let i = 0; i < m; i++) {
            const A = h[i].s, B = h[(i + 1) % h.length].s;
            edgeA.copy(A.body.position); edgeB.copy(B.body.position); edgeDir.subVectors(edgeB, edgeA);
            const len = edgeDir.length(); edgeDir.normalize();
            const trim = Math.min(1, len / Math.max(.001, A.r + B.r));
            edgeA.addScaledVector(edgeDir, A.r * trim); edgeB.addScaledVector(edgeDir, -B.r * trim);
            attr.setXYZ(k * 2, edgeA.x, edgeA.y, edgeA.z); attr.setXYZ(k * 2 + 1, edgeB.x, edgeB.y, edgeB.z); k++;
          }
        }
        attr.needsUpdate = true; hullSeg.geometry.setDrawRange(0, k * 2);
        hullSeg.material.opacity = lineSeg ? lineSeg.material.opacity : T.MathUtils.lerp(hullSeg.material.opacity, (printLook ? (focused ? .16 : .5) : (focused ? .10 : .42)) * (1 - shapeMix), fadeStep);
        hullSeg.visible = k > 0;
      }
      // 相机：选中后只"飞过去"一次，到位/或用户一动就放手（之后自由转缩，不再锁定）
      if (recCam) {   // 录制：镜头位置 / 看向的点 / 上方向 / 视角全听录制脚本的，飞行、慢游、自动对焦都让位
        flying = false;
        camera.position.copy(recCam.pos); controls.target.copy(recCam.target);
        if (recCam.up) camera.up.copy(recCam.up);
        if (recCam.fov && Math.abs(camera.fov - recCam.fov) > 1e-5) { camera.fov = recCam.fov; camera.updateProjectionMatrix(); }
      }
      if (flying && !recCam) {
        if(focused){
          target.add(spiralView.copy(focused.body.position).sub(tLook));
          tLook.copy(focused.body.position);
        }
        camera.position.lerp(target, flightRate); controls.target.lerp(tLook, flightRate);
        if (camera.position.distanceTo(target) < 4 && controls.target.distanceTo(tLook) < 2) flying = false;
      }
      if (!flying && !recCam && expanded && !familyIds) {
        const orbitDistance = camera.position.distanceTo(controls.target);
        if (focused && orbitDistance < 440) controls.target.lerp(focused.body.position, 0.07);
        // 没选中时：拉远到 440 以外才把转轴慢慢挪回核心。点空白退出特写后转轴留在原处，
        // 不然近处一挪转轴看着就是猛地甩回默认视角。
        else if ((!focused && orbitDistance > 440) || orbitDistance > 520) controls.target.lerp(CORE_POS, focused ? 0.014 : 0.04);
      }
      // 慢游：不掉头、不沿水平纬线直着走。
      // **增量式绕"会摆的斜轴"转**——转轴 = y 轴向两个方向各倾最多 ~20°，倾角自己慢慢游移
      // （两条不同周期的正弦），再叠一路绕水平轴的上下滑。方向恒为正=一直顺时针，只变快慢。
      // 增量式（每帧在当前位置上转一点）而非绝对轨迹：用户拖完/缩放完从**当下位置**平滑接着游，
      // 不会跳；旋转不改半径=尊重用户的缩放距离。转完调用 controls.update() 让控件吃到新位置，不打架。
      if (shape === "free" && idleSpin && !recCam && !flying && !focused && !interacting && t >= _spinResumeAt && !SM_OFF.has('spin')) {
        // dt 封顶 1/30 秒：页面被切走/卡顿后 t 会跳一大截，不封顶就会"忽然转到某个方向"。
        const dt = Math.min(0.033, Math.max(0, t - _spinLastT));
        // SPIN_RATE = 慢游总倍率，**要调快慢只动这一个数**。
        // 所有速率和所有相位频率一起乘它 → 轨迹形状完全不变、只是走得更慢；
        // 若只减角速度不减频率，上下起伏会显得相对变密，"同一条路慢慢走"就变味了。
        // 上下滑幅度 = 速率/频率，两者同乘同一个数、幅度天然守恒（±21° 不受影响）。
        const SPIN_RATE = 0.5, tt = t * SPIN_RATE;
        // 0.075±0.05 再乘 SPIN_RATE：最慢 0.0125 rad/s ≈ 8.4 分钟一圈，
        // 最快 0.0625 rad/s ≈ 100 秒一圈。恒正不掉头。
        const sp = (0.075 + 0.05 * Math.sin(tt * 0.017)) * SPIN_RATE;
        _spinAxis.set(Math.sin(tt * 0.011) * 0.35, 1, Math.sin(tt * 0.007 + 1.7) * 0.35).normalize();
        _spinOff.copy(camera.position).sub(controls.target);
        _spinOff.applyAxisAngle(_spinAxis, sp * dt);
        camera.up.applyAxisAngle(_spinAxis, sp * dt);
        _spinH.crossVectors(_spinAxis, _spinOff);                           // 当前视线的"水平"轴
        // 相机若正好落在转轴上，叉积退化成零向量，normalize 出 (0,0,0) → 后面的旋转变成 NaN/空转。
        // 这一帧就跳过纵向那部分，只做主转。
        if (_spinH.lengthSq() < 1e-8) { camera.position.copy(controls.target).add(_spinOff); _spinLastT = t; }
        else {
        _spinH.normalize();
        // 上下滑：幅度=速率/频率（积分！），0.007/0.019≈0.37rad≈±21°。第一版写 0.05 时积出 ±150°，
        // 相机能荡到极点正下方——数值仿真抓出来的，调这里先算积分幅度。
        _spinOff.applyAxisAngle(_spinH, 0.007 * SPIN_RATE * Math.sin(tt * 0.019) * dt);
        camera.up.applyAxisAngle(_spinH, 0.007 * SPIN_RATE * Math.sin(tt * 0.019) * dt).normalize();
        camera.position.copy(controls.target).add(_spinOff);
        }
      }
      _spinLastT = t;
      // 「甩一下」（录制用）：镜头绕着看向的点额外转一股，速度先在 rise 秒里起来、再按 tau 秒的阻尼指数减下去；慢游照常叠在底下，所以减完就平滑回到平时的慢游
      if (fling && !recCam) {
        const age = t - fling.t0;
        if (age >= 0) {
          const ramp = T.MathUtils.smoothstep(age, 0, fling.rise), v = fling.v0 * ramp * Math.exp(-Math.max(0, age - fling.rise - fling.hold) / fling.tau);
          const a = -v * frameDt;   // 负号：镜头往反方向绕，画面里的星星才顺着手指的方向走
          _spinOff.copy(camera.position).sub(controls.target).applyAxisAngle(fling.axis, a);
          camera.position.copy(controls.target).add(_spinOff); camera.up.applyAxisAngle(fling.axis, a).normalize();
          if (age > fling.rise + fling.hold + fling.tau * 9) fling = null;
        }
      }
      if (dolly && !recCam) {
        const u = T.MathUtils.smootherstep(t - dolly.t0, 0, dolly.dur);
        _spinOff.copy(camera.position).sub(controls.target).setLength(dolly.from + (dolly.to - dolly.from) * u);
        camera.position.copy(controls.target).add(_spinOff);
        if (u >= 1) dolly = null;
      }
      if(!recCam && Math.abs(camera.fov-targetFov)>.001){
        camera.fov=T.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-frameDt/.28));
        camera.updateProjectionMatrix();
      }
      controls.update();
      sprites.forEach(s => {
        const visible = !familyIds || familyIds.has(s.n.id);
        const flatCore = printLook && !!s.printCore;   // 印刷纸下核心的 3D 球和软瓣收起来，换平面片
        s.body.visible = visible && !flatCore; s.glow.visible = visible && !printLook && !SM_OFF.has('glow');
        if(s.shells) s.shells.forEach(sh => sh.mesh.visible = visible && !flatCore);
        if(s.printCore) s.printCore.visible = visible && flatCore;
        if(s.coreSpot) s.coreSpot.forEach(q => { q.visible = visible && flatCore; });
        if(s.occ) s.occ.visible = visible && printLook;
      });
      accents.update(t,expanded,camera,W,H,interacting||flying);
      // 竖排小字：只在印刷纸 + 展开 + 没点着球时有；镜头离星图中心 230 以外全显，推到 150 以内没了
      const fineA = printLook && expanded && !focused && !familyIds ? T.MathUtils.smoothstep(camera.position.distanceTo(controls.target), 150, 230) : 0;
      fine.set(deco.show.letters ? fineA : 0);
      if (stampN !== sprites.length) { stampN = sprites.length; refreshStamp(); }
      stamp.set(stampCfg.show && stampCfg.style !== 'off' ? fineA : 0);
      if (printLook && (deco.show.letters || deco.show.stars)) deco.update(t, frameDt, camera, controls.target);
      if (printLook) {   // 先把球画进墨量图（只画第 1 层），再画其余的 + 合成
        camera.layers.set(1); renderer.setRenderTarget(inkTarget); renderer.render(scene, camera);
        renderer.setRenderTarget(null); camera.layers.set(0);
      }
      renderer.render(scene, camera);
      updateLabels();
      raf = requestAnimationFrame(animate);
    }

    function labelBottomPad() { return 48; }

    function updateLabels() {
      const v = new T.Vector3();
      const globalView = camera.position.distanceTo(controls.target) > 480;
      const bottomPad = labelBottomPad();
      sprites.forEach(s => {
        s.lab.style.pointerEvents = 'none'; s.lab.tabIndex = -1; s.lab.setAttribute('aria-hidden', 'true');
        v.copy(s.body.position).project(camera);
        const dist = Math.max(1, camera.position.distanceTo(s.body.position));
        const fovScale = H / (2 * Math.tan(camera.fov * Math.PI / 360));
        const radiusPx = ((s.displayRadius||s.r) * 1.08 / dist) * fovScale;
        const isNb = focusedNeighbors && focusedNeighbors.has(s.n.id);
        // **点中的那颗一律显示名字**，不卡尺寸门槛（主动点了就是要看名字）。邻居仍留门槛防刷屏：屏幕半径 ≥ 11px。
        const show = !globalView && ((focused === s) || (isNb && radiusPx >= 11));
        if ((familyIds && !familyIds.has(s.n.id)) || !show || v.z > 1) { s.lab.style.opacity = '0'; s.lab.hidden = true; return; }
        const x = ((v.x * 0.5 + 0.5) * W);
        const cy = (-v.y * 0.5 + 0.5) * H, off = Math.max(12, radiusPx + 6);
        // 名字默认挂球下方；底部那片 bottomPad 是被遮住的区域。
        // 挂不下就翻到球上方——不然矮屏幕上点中的球名字正好落进这片区域被藏掉。
        let y = cy + off;
        if (y > H - bottomPad) y = cy - off - 26;   // 26 ≈ 一行标签高
        if (x < -36 || x > W + 36 || y < 0 || y > H - bottomPad) { s.lab.style.opacity = '0'; s.lab.hidden = true; return; }
        const fadeStart = H - bottomPad - 44;
        const fade = y > fadeStart ? Math.max(0.35, (H - bottomPad - y) / 44) : 1;
        s.lab.style.fontSize = Math.max(10, Math.min(11, radiusPx * 0.34)) + 'px';
        s.lab.style.left = x + 'px';
        s.lab.style.top = y + 'px';
        s.lab.hidden = false; s.lab.style.opacity = String(fade);
        s.lab.style.pointerEvents = 'auto'; s.lab.tabIndex = 0; s.lab.removeAttribute('aria-hidden');
      });
    }

    function onClick(e) {
      if (!expanded) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(sprites.filter(s => !familyIds || familyIds.has(s.n.id)).map(s => s.body));
      if (hit.length) { focusNode(sprites.find(s => s.body === hit[0].object)); }
      else if (focused && onLabel(focused, e)) { /* 点到选中那颗的名字 = 还是点它，不动 */ }
      else { const was = !!focused; clearFocus(); if (was) backOff(); else recenter(); }
    }
    function onLabel(s, e) {
      if (!s.lab || +s.lab.style.opacity <= 0) return false;
      const r = s.lab.getBoundingClientRect();
      return r.width > 0 && e.clientX >= r.left - 10 && e.clientX <= r.right + 10 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
    }
    function recenter() {   // 没选中时再点空白：转轴平移回中心，距离和朝向不变
      const c = familyCenter() || CORE_POS;   // 选了星座 / 族时回的是它自己的中心，不跑回整张图的核心
      if (controls.target.distanceTo(c) < 3) return;
      flyTo(c.clone().add(camera.position.clone().sub(controls.target)), c, .07);
    }
    function familyCenter() {
      const selected = sprites.filter(s => familyIds && familyIds.has(s.n.id));
      if (!selected.length) return null;
      const box = new T.Box3(); selected.forEach(s => box.expandByPoint(shape!=="free"?new T.Vector3():s.base));
      return box.getCenter(new T.Vector3());
    }
    function backOff() {   // 退出特写：朝向不变、原地往后退一些，周围的球留在眼前方便点下一颗
      const c = controls.target.clone(), off = camera.position.clone().sub(c), d = off.length();
      if (d < 1) return;
      flyTo(c.clone().add(off.setLength(Math.min(380, Math.max(d * 1.7, 240)))), c, .06);
    }
    function clearFocus() {
      accents.clear();
      targetFov=expanded?78:66;
      const had = !!focused;
      focused = null; focusedNeighbors = null; flying = false; if (hlLines) { scene.remove(hlLines); hlLines.geometry.dispose(); hlLines.material.dispose(); hlLines = null; }
      if (had) opts.onClear?.();
    }
    function focusNode(s) {
      if (!s) return; accents.pulse(s,_nowSec()); focused = s; targetFov=66; spiralPaused=true;
      idleSpin = false;   // 点中球即停慢游；退出高亮也保持停，⟲ 或重进才恢复
      const id = s.n.id, p = s.body.position;
      opts.onPick?.(s.n);
      focusedNeighbors = new Set([...(adj[id] || [])].filter(nid => !familyIds || familyIds.has(nid)));
      const pos = Object.create(null); sprites.forEach(s => pos[s.n.id] = s.body.position);
      // 高亮连线：该球 ↔ 它的 1 跳邻居
      if (hlLines) { scene.remove(hlLines); hlLines.geometry.dispose(); hlLines.material.dispose(); hlLines = null; }
      const pts = []; let spread = s.r * (expanded && shape!=="free"?(s.n.kind==="core"?3:.6):1) * 3;
      focusedNeighbors.forEach(nid => {
        const B = pos[nid]; if (!B) return;
        pts.push(p.x, p.y, p.z, B.x, B.y, B.z);
        spread = Math.max(spread, p.distanceTo(new T.Vector3(B.x, B.y, B.z)));
      });
      if (pts.length) {
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        hlLines = new T.LineSegments(geo, threadMaterial(0xf3ead2,0));
        hlLines.userData.edges=[...focusedNeighbors].filter(nid=>pos[nid]).map(nid=>[id,nid]);
        scene.add(hlLines);
      }
      // 相机：框住该球+邻居，距离不拉太近也不太远。
      const dist = Math.min(265, Math.max(82, spread * 1.18 + 42));
      const dir = camera.position.clone().sub(p).normalize();
      target.copy(p).add(dir.multiplyScalar(dist));
      tLook.copy(p);
      flying = true;   // 飞过去一次；到位或用户一动就停（见 animate / controls 'start'）
    }

    function resize() {
      W = container.clientWidth || 1; H = container.clientHeight || 1;
      camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); controls.handleResize();
      const buf = renderer.getDrawingBufferSize(new T.Vector2()); inkTarget.setSize(Math.max(1, buf.x), Math.max(1, buf.y));
    }

    async function load() {
      const d = structuredClone(opts.data); nodes = d.nodes || []; links = d.links || []; softlinks = d.softlinks || [];
      // wiki 不进星图：数量会越来越多、大小又都一样，塞进来画面很乱。
      // 连线两端有一头是 wiki 的一并去掉。
      const dropped = new Set(nodes.filter(n => n.kind === 'wiki').map(n => n.id));
      if (dropped.size) {
        nodes = nodes.filter(n => !dropped.has(n.id));
        const keep = ([a, b]) => !dropped.has(a) && !dropped.has(b);
        links = links.filter(keep); softlinks = softlinks.filter(keep);
      }
      layout(nodes, links, softlinks); build(); arrangeSpiral(); resize();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(animate);
    }

    let moved = 0, downXY = null;
    renderer.domElement.addEventListener('pointerdown', e => { downXY = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!downXY) return; const d = Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]); downXY = null;
      if (d < 6) onClick(e);   // 区分点击 vs 拖拽
    });
    const onWin = () => resize(); window.addEventListener('resize', onWin);
    let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(container); }
    const ready = load();

    function frameFamily() {
      const selected = sprites.filter(s => familyIds && familyIds.has(s.n.id));
      if(!selected.length) return;
      const center = familyCenter();
      let radius=20; selected.forEach(s => radius=Math.max(radius,(shape==="ring"?s.ring.length():shape==="spiral"?s.orbit.radius:s.base.distanceTo(center))+s.r*(shape!=="free"?(s.n.kind==="core"?3:.6):1)));
      const halfFov = Math.atan(Math.tan(targetFov*Math.PI/360)*Math.min(.65,camera.aspect*.9));
      const distance = Math.max(100, radius/Math.sin(halfFov)*1.2);
      controls.maxDistance=Math.max(820,distance*1.2);
      const direction=camera.position.clone().sub(controls.target).normalize();
      flyTo(center.clone().addScaledVector(direction,distance),center,.065);
    }
    return {
      focus(id) {
        const s = sprites.find(s2 => s2.n.id === id && (!familyIds || familyIds.has(id)));
        if (s) focusNode(s);
      },
      setShape(value) {
        chosenShape=["spiral","ring"].includes(value)?value:"free";
        shape=familyIds?"free":chosenShape;   // 星座固定按自由星空画，造型只管整片星穹
        clearFocus(); spiralPaused=false; idleSpin=!familyIds; arrangeSpiral();
        if(familyIds) frameFamily();
        else flyTo(overviewPosition(),CORE_POS,.065);
      },
      async setFamily(ids) {
        const epoch=++familyEpoch;
        await ready; if(!alive || epoch!==familyEpoch) return 0;
        clearFocus(); familyIds=ids ? new Set(ids) : null; shape=familyIds?"free":chosenShape; idleSpin=!familyIds; spiralPaused=false; arrangeSpiral();
        if(familyIds) frameFamily();
        else { controls.maxDistance=expanded?820:260; flyTo(overviewPosition(),CORE_POS,.065); }
        return sprites.filter(s => !familyIds || familyIds.has(s.n.id)).length;
      },
      setStudy(value) {
        study=!!value;
        sprites.forEach(s=>{
          s.body.material=study?s.nextBody:s.oldBody;
          s.glow.material=study?s.nextGlow:s.oldGlow;
          if(s.coreMat) s.coreMat.uniforms.uStudy.value=study?1:0;
          if(s.shells) s.shells.forEach(sh=>sh.mat.uniforms.uStudy.value=study?1:0);
        });
        applyLook();
      },
      // 外观：'print' = 印刷纸（旧纸 + 油墨球 + 指定第三色）；其它值 = 星穹。cfg 可带 ink / pairs / ratio 覆盖默认。
      setLook(value, cfg) {
        skin = value === 'print' ? 'print' : 'sky';
        printCfg = Object.assign({}, PRINT_DEFAULT, cfg || {});
        applyLook();
      },
      // 印刷纸的画面装饰开关：{letters, stars}
      setStamp(cfg) {   // 右下角落款：{kept, lit, sign, show, right, bottom}
        stampCfg = Object.assign(stampCfg, cfg || {});
        if (cfg && cfg.scale) stamp.scale(cfg.scale);
        if (cfg && (cfg.right != null || cfg.bottom != null)) stamp.place(cfg.right != null ? cfg.right : 14, cfg.bottom != null ? cfg.bottom : 24);
        refreshStamp();
      },
      setCore(id) {   // 换核心画法：不认识的名字一律当涟漪
        const next = coreVariant(id) ? id : 'ripple';
        if (next === coreStyle) return;
        coreStyle = next;
        sprites.forEach(s => {
          if (!s.printCore) return;
          const old = s.corePrint; s.corePrint = coreMaterialFor(coreStyle); s.printCore.material = s.corePrint; old.dispose();
          attachCoreSpot(s);
        });
        applyLook();
      },
      coreStyles() {   // 面板里核心的排法：日蚀、陀螺仪、三角面球、玻璃方块、字符球、酸性金属、涟漪、曲线球；没列到的接在后面
        const ORDER = ['eclipse','gyro','facet','cube','glyph','chrome','ripple','isobar'];
        const all = [{id:'ripple',name:'涟漪'}].concat((window.CORE_LAB || []).map(v => ({id:v.id,name:String(v.name).replace(/^\d+\s*·\s*/,'')})));
        const rank = c => { const i = ORDER.indexOf(c.id); return i < 0 ? 99 : i; };
        return all.sort((a, b) => rank(a) - rank(b));
      },
      setDeco(cfg) { deco.show.letters = !cfg || cfg.letters !== false; deco.show.stars = !cfg || cfg.stars !== false; applyLook(); },
      refresh: load,
      isExpanded() { return expanded; },
      setExpanded(b) {
        ++familyEpoch; if(!b) { familyIds=null; arrangeSpiral(); }
        spiralPaused=false; expanded = !!b; targetFov=expanded?78:66; controls.enabled = expanded; controls.maxDistance = expanded ? 820 : 260; clearFocus();
        idleSpin = true;   // 收起/展开都算"重进"，慢游恢复
        flyTo(overviewPosition(), CORE_POS, expanded ? 0.055 : 0.075);
        setTimeout(resize, 60); setTimeout(resize, 360);
      },
      // —— 录制用接口（film/ 逐帧出片用，正常页面不调）——
      rec: {
        // 镜头：{pos:[x,y,z], target:[x,y,z], up:[x,y,z]?, fov:度?}；传 null 交还给星图自己（从当前位置接着慢游）
        camera(c) {
          if (!c) { recCam = null; controls.maxDistance = expanded ? 820 : 260; controls.minDistance = 40; return; }
          const v = a => a ? new T.Vector3(a[0], a[1], a[2]) : null;
          recCam = { pos: v(c.pos), target: v(c.target) || CORE_POS.clone(), up: v(c.up), fov: c.fov || 0 };
          controls.maxDistance = 1e5; controls.minDistance = .1;
        },
        // 现在的镜头（录制脚本拿来当起点）
        state() { const a = x => [x.x, x.y, x.z]; return { pos: a(camera.position), target: a(controls.target), up: a(camera.up), fov: camera.fov, shapeMix, ringMix, shape }; },
        // 慢推：to = 推到的距离，dur = 用几秒（缓入缓出）
        dolly({ to = 420, dur = 6 } = {}) { dolly = { t0: _tNow, from: camera.position.distanceTo(controls.target), to, dur }; },
        // 甩一下：dir = 手指划的方向（屏幕上，x 向右、y 向上），turn = 一共多转多少弧度，rise = 起速秒数，hold = 全速保持秒数，tau = 阻尼秒数
        fling({ dir = [1, .5], turn = 4, rise = .12, hold = 0, tau = .8 } = {}) {
          const l = Math.hypot(dir[0], dir[1]) || 1, dx = dir[0] / l, dy = dir[1] / l;
          camera.updateMatrixWorld();
          _flingRight.set(1, 0, 0).applyQuaternion(camera.quaternion); _flingUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
          const axis = _flingRight.multiplyScalar(-dy).addScaledVector(_flingUp, dx).normalize();
          fling = { t0: _tNow, axis: axis.clone(), rise, hold, tau, v0: turn / (rise / 2 + hold + tau) };
        },
        // 造型变形立刻到位（硬切镜头用：切过去时新造型已经排好）
        settle() { shapeMix = expanded && shape !== 'free' ? 1 : 0; ringMix = shape === 'ring' ? 1 : 0; flying = false; },
        // 画布像素比：平时封顶 2，录 1080 宽时要放到 1080/393 ≈ 2.75 才清楚
        pixelRatio(k) { renderer.setPixelRatio(k); resize(); },
      },
      resetView() { spiralPaused=false; clearFocus(); if(familyIds) { idleSpin=false; frameFamily(); } else { idleSpin=true; flyTo(overviewPosition(),CORE_POS,.075); } },
      destroy() {
        alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onWin); if (ro) ro.disconnect();
        try {
          controls.dispose();
          const geometries = new Set(), materials = new Set();
          scene.traverse(o => { if(o.geometry) geometries.add(o.geometry); if(o.material) materials.add(o.material); });
          sprites.forEach(s=>[s.oldBody,s.nextBody,s.oldGlow,s.nextGlow].forEach(m=>materials.add(m)));
          geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
          inkTarget.dispose(); renderer.dispose(); renderer.forceContextLoss();
        } catch (e) { }
        try { fine.destroy(); stamp.destroy(); deco.destroy(); occluder.dispose(); container.removeChild(renderer.domElement); container.removeChild(labels); } catch (e) { }
      },
    };
  }

  // 印刷纸的纸底：主页那张纸（碎屑 + 大片深浅 + 细棉绒）+ 三层很淡的做旧斑 + 四周一圈旧黄。
  // 铺在 el 的 inline 背景上；传 null 撤掉，回到样式表里的星穹底。
  export function printPaper(el, paper, edge = true) {   // edge=false：不画四周那圈旧黄（宿主页面自己铺整页纸色时用）
    const st = el.style;
    if (!paper) { ['backgroundImage','backgroundSize','backgroundBlendMode','backgroundColor'].forEach(k => st[k] = ''); return; }
    const svg = (body, w) => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + w + '">' + body + '</svg>') + '")';
    const stain = (id, freq, oct, seed, k, b, w) => svg('<filter id="' + id + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" stitchTiles="stitch" baseFrequency="' + freq + '" numOctaves="' + oct + '" seed="' + seed + '"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .18  0 0 0 ' + k + ' ' + b + '"/></filter><rect width="100%" height="100%" filter="url(#' + id + ')"/>', w);
    const lay = felt => {
      st.backgroundImage = [edge ? 'radial-gradient(120% 92% at 50% 42%,rgba(206,176,134,0) 48%,rgba(206,176,134,.36) 100%)' : 'none',
        'url("' + PAPER_ASSET.fleck + '")', 'url("' + PAPER_ASSET.mottle + '")',
        stain('b1', '.0022 .003', 2, 21, .33, -.155, 1500), stain('b2', '.008 .011', 3, 5, .27, -.128, 820), stain('b3', '.03 .04', 2, 9, .21, -.108, 430),
        'url("' + felt + '")'].join(',');
      st.backgroundSize = 'auto,512px 512px,640px 640px,1500px 1500px,820px 820px,430px 430px,256px 256px';
      st.backgroundBlendMode = 'normal,normal,normal,normal,normal,normal,multiply';
      st.backgroundColor = paper;
    };
    if (printPaper.felt) { lay(printPaper.felt); return; }
    lay(PAPER_ASSET.felt);
    // 棉绒图自带米色：抽成只剩明暗的灰片再叠到纸色上，纸色才是说了算的那个
    const img = new Image();
    img.onload = () => { try {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const im = x.getImageData(0, 0, c.width, c.height), d = im.data, n = d.length / 4, lum = new Float32Array(n); let sum = 0;
      for (let i = 0; i < n; i++) { lum[i] = .299 * d[i*4] + .587 * d[i*4+1] + .114 * d[i*4+2]; sum += lum[i]; }
      const top = sum / n * 1.03;
      for (let i = 0; i < n; i++) { const v = Math.min(255, lum[i] / top * 255); d[i*4] = d[i*4+1] = d[i*4+2] = v; }
      x.putImageData(im, 0, 0); printPaper.felt = c.toDataURL('image/png');
      if (st.backgroundColor) lay(printPaper.felt);   // 这期间没被撤掉才换上
    } catch (e) { } };
    img.src = PAPER_ASSET.felt;
  }
