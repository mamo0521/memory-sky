import {ringLayout} from './ring-layout.js';
// Copyright (c) 2026 mamo and contributors. MIT.
import { starAccents } from "./star-accents.js";
import { orbitFor, orbitPosition } from "./orbit-layout.js";
import { lensDust } from "./lens-dust.js";
import { threadMaterial } from "./thread-material.js";
import { lightMaterial } from "./light-materials.js";
import * as Three from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
// Keep the artwork's display RGB values without changing the host's color management.
class DisplayColor extends Three.Color {
  setHex(value){ return super.setHex(value, Three.LinearSRGBColorSpace); }
  setStyle(value){ return super.setStyle(value, Three.LinearSRGBColorSpace); }
}
const THREE = { ...Three, Color: DisplayColor, OrbitControls: TrackballControls };
const Q = { hiNeg: [218, 161, 124], hiPos: [233.67977, 213.920617, 179.051499], loNeg: [190, 194, 236], loPos: [195, 167, 222] };
const FINISH = {
  hiNeg: { stroke: [230, 182, 137] },
  hiPos: { stroke: [252.639065, 229.741372, 188.525637] },
  loNeg: { stroke: [203, 218, 250] },
  loPos: { stroke: [215, 192, 236] }
};
function nodeFinish(n) {
  return FINISH[(+n.arousal >= 0.5 ? "hi" : "lo") + (+n.valence >= 0 ? "Pos" : "Neg")];
}
const BLUE = [200, 214, 251];
const R5 = 10, STEP = 0.7;
function impRadius(i) {
  return R5 * Math.pow(STEP, 5 - Math.max(1, Math.min(5, i)));
}
const SIZE = { core: R5 * 2, baseline: R5 * 1.05, wiki: impRadius(4) };
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function cssRgb(c) {
  return "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";
}
function cssA(c, a) {
  return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
}
function hexInt(c) {
  return (c[0] | 0) << 16 | (c[1] | 0) << 8 | (c[2] | 0);
}
function emotionColor(v, a) {
  const vv = Number.isFinite(+v) ? +v : 0;
  const aa = Number.isFinite(+a) ? +a : 0;
  if (aa >= 0.5) return (vv >= 0 ? Q.hiPos : Q.hiNeg).slice();
  return (vv >= 0 ? Q.loPos : Q.loNeg).slice();
}
function nodeColor(n) {
  return n.kind === "event" ? emotionColor(n.valence, n.arousal) : BLUE.slice();
}
function nodeRadius(n) {
  return n.kind === "core" ? SIZE.core : n.kind === "baseline" ? SIZE.baseline : n.kind === "wiki" ? SIZE.wiki : impRadius(n.importance);
}
function hash(str, seed) {
  let h = 2166136261 ^ (seed || 0);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e5 / 1e5;
}
function layout(nodes, links, softlinks) {
  const idx = Object.create(null);
  nodes.forEach((n, i) => {
    idx[n.id] = i;
    const h1 = hash(n.id, 1), h2 = hash(n.id, 2), h3 = hash(n.id, 3);
    const rr = 30 + h1 * 70, phi = Math.acos(1 - 2 * h2), th = 6.2832 * h3;
    n.x = rr * Math.sin(phi) * Math.cos(th);
    n.y = rr * Math.cos(phi);
    n.z = rr * Math.sin(phi) * Math.sin(th);
    n.pinned = n.kind === "core";
    if (n.pinned) {
      n.x = n.y = n.z = 0;
    }
  });
  const REST_VAR = 0.82;
  const restOf = (a, b, base, seed) => base * (1 - REST_VAR + 2 * REST_VAR * hash(a + "|" + b, seed));
  const edges = [];
  (links || []).forEach(([a, b]) => {
    if (idx[a] != null && idx[b] != null) edges.push([idx[a], idx[b], 0.06, restOf(a, b, 60, 59)]);
  });
  (softlinks || []).forEach(([a, b]) => {
    if (idx[a] != null && idx[b] != null) edges.push([idx[a], idx[b], 0.022, restOf(a, b, 88, 61)]);
  });
  const N = nodes.length, REP = 2e3, CENTER = 85e-4;
  const space = nodes.map((n) => n.pinned ? 1 : 0.28 + 1.9 * Math.pow(hash(n.id, 73), 1.6));
  const pull = nodes.map((n) => 0.65 + 0.7 * hash(n.id, 79));
  const radii = nodes.map((n) => n.kind === "core" ? SIZE.core : impRadius(n.importance || 3));
  const fx = new Float64Array(N), fy = new Float64Array(N), fz = new Float64Array(N);
  for (let it = 0; it < 320; it++) {
    fx.fill(0);
    fy.fill(0);
    fz.fill(0);
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
      const d2 = dx * dx + dy * dy + dz * dz + 12, inv = 1 / Math.sqrt(d2);
      const distance = Math.sqrt(Math.max(0, d2 - 12));
      const f = Math.max(REP * Math.sqrt(space[i] * space[j]) / d2, (radii[i] + radii[j] + 3 - distance) * 0.9);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      fx[i] += dx * f;
      fy[i] += dy * f;
      fz[i] += dz * f;
      fx[j] -= dx * f;
      fy[j] -= dy * f;
      fz[j] -= dz * f;
    }
    for (const [i, j, k, rest] of edges) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y, dz = nodes[j].z - nodes[i].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01, f = k * (dist - rest) / dist;
      fx[i] += dx * f;
      fy[i] += dy * f;
      fz[i] += dz * f;
      fx[j] -= dx * f;
      fy[j] -= dy * f;
      fz[j] -= dz * f;
    }
    const cool = Math.max(0.15, 1 - it / 340);
    for (let i = 0; i < N; i++) {
      if (nodes[i].pinned) {
        nodes[i].x = nodes[i].y = nodes[i].z = 0;
        continue;
      }
      fx[i] -= nodes[i].x * CENTER * pull[i];
      fy[i] -= nodes[i].y * CENTER * pull[i];
      fz[i] -= nodes[i].z * CENTER * pull[i];
      nodes[i].x += Math.max(-12, Math.min(12, fx[i])) * cool;
      nodes[i].y += Math.max(-12, Math.min(12, fy[i])) * cool;
      nodes[i].z += Math.max(-12, Math.min(12, fz[i])) * cool;
    }
  }
}
const _bodyCache = {};
function bodyTexture(col) {
  const key = (col[0] | 0) + "," + (col[1] | 0) + "," + (col[2] | 0);
  if (_bodyCache[key]) return _bodyCache[key];
  const S = 512, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const x = cv.getContext("2d"), c = S / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
  const solid = cssRgb(col), rim = cssRgb(mix(col, [255, 255, 255], 0.72));
  g.addColorStop(0, solid);
  g.addColorStop(0.91, solid);
  g.addColorStop(0.945, rim);
  g.addColorStop(0.978, cssA(col, 1));
  g.addColorStop(1, cssA(col, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const img = x.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) {
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
    }
    if (d[i + 3] < 1) d[i + 3] = 1;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  _bodyCache[key] = t;
  return t;
}
const _NOISE_GLSL = [
  "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
  "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
  "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
  "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
  "float snoise(vec3 v){",
  "  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);",
  "  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);",
  "  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);",
  "  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;",
  "  i=mod289(i);",
  "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
  "  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;",
  "  vec4 j=p-49.0*floor(p*ns.z*ns.z);",
  "  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);",
  "  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);",
  "  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);",
  "  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));",
  "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
  "  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);",
  "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
  "  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;",
  "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;",
  "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
  "}",
  "float fbm(vec3 p){ float f=0.0,a=0.5; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.03; a*=0.55; } return f; }"
].join("\n");
function coreBodyMaterial(T) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uStudy: { value: 1 } },
    vertexShader: [
      "varying vec3 vN; varying vec3 vV; varying vec3 vP;",
      "void main(){ vP=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.0);",
      "  vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }"
    ].join("\n"),
    fragmentShader: _NOISE_GLSL + [
      "uniform float uTime; uniform float uOpacity; uniform float uStudy;",
      "varying vec3 vN; varying vec3 vV; varying vec3 vP;",
      "void main(){",
      "  vec3 col = vec3(0.784,0.839,0.984);",
      "  float rim = pow(1.0-max(0.0,dot(normalize(vN),normalize(vV))),3.2);",
      "  float flow = 0.5+0.5*sin(vP.y*5.0+vP.x*3.0-uTime*0.35);",
      "  col = mix(col,vec3(0.88,0.93,1.0),uStudy*rim*(0.20+0.12*flow));",
      "  gl_FragColor = vec4(col, uOpacity);",
      "}"
    ].join("\n")
  });
}
function coreAuraMaterial(T, o) {
  const c = new T.Color(o.col);
  const hsl = {};
  c.getHSL(hsl);
  const cT = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 2.6 + 0.28), Math.max(0.34, hsl.l - 0.16));
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uStudy: { value: 1 },
      uAmp: { value: o.amp },
      uFreq: { value: o.freq },
      uSpeed: { value: o.speed },
      uAlpha: { value: o.alpha },
      uBase: { value: o.base },
      uPhase: { value: o.phase },
      uUp: { value: o.up },
      uTip: { value: o.tip },
      uSat: { value: o.sat == null ? 0.8 : o.sat },
      uRim: { value: o.rim == null ? 0 : o.rim },
      uRimPow: { value: o.rimPow == null ? 1.6 : o.rimPow },
      uCol: { value: new T.Vector3(c.r, c.g, c.b) },
      uColTip: { value: new T.Vector3(cT.r, cT.g, cT.b) }
    },
    vertexShader: "precision highp float;\n" + _NOISE_GLSL + [
      "uniform float uTime,uAmp,uFreq,uSpeed,uBase,uPhase,uUp,uStudy;",
      "varying float vLobe; varying float vRim;",
      "void main(){",
      "  vec3 vP = normalize(position);",
      "  vRim = 1.0 - abs(normalize(normalMatrix * vP).z);",
      "  float n1 = snoise(vP*uFreq + vec3(0.0, -uTime*uSpeed, uPhase));",
      "  float n2 = snoise(vP*(uFreq*2.1) + vec3(uTime*uSpeed*0.5, -uTime*uSpeed*1.25, uPhase*1.7+3.0));",
      "  float shared = snoise(vP*1.55 + vec3(0.0,-uTime*0.13,2.4));",
      "  float detail = snoise(vP*3.2 + vec3(uTime*0.035,-uTime*0.17,1.2));",
      "  float oldField=0.72*n1+0.28*n2;",
      "  float lobe = 0.5 + 0.5*mix(oldField,0.82*shared+0.18*detail,uStudy);",
      "  lobe = pow(clamp(lobe,0.0,1.0), 2.55);",
      "  float upB = 1.0 + uUp*max(vP.y, 0.0);",
      "  vLobe = clamp(lobe*upB, 0.0, 1.4);",
      "  vec3 p = position * (uBase + uAmp*lobe*upB*mix(1.0,0.82,uStudy));",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "uniform float uAlpha,uOpacity,uTip,uSat,uRim,uRimPow,uStudy; uniform vec3 uCol,uColTip;",
      "varying float vLobe; varying float vRim;",
      "void main(){",
      "  float fade = 1.0 - uTip*smoothstep(0.15, 1.1, vLobe);",
      "  fade *= mix(1.0, pow(clamp(vRim,0.0,1.0), uRimPow), uRim);",
      "  vec3 col = mix(uCol, uColTip, uSat*smoothstep(0.20, 1.00, vLobe));",
      "  fade *= mix(1.0,1.0-smoothstep(0.72,1.0,vRim),uStudy*0.94);",
      "  gl_FragColor = vec4(col, uAlpha*fade*uOpacity);",
      "}"
    ].join("\n")
  });
}
var CORE_AURA = [
  { amp: 0.4, freq: 0.55, speed: 0.16, alpha: 0.38, base: 1.012, col: "#b0c6fb", up: 0.45, tip: 0.95, phase: 7.3, swirl: 0.04, sat: 0.85, rim: 0.75, rimPow: 1.35 },
  { amp: 0.13, freq: 0.85, speed: 0.26, alpha: 0.95, base: 1, col: "#d4e0fd", up: 0.25, tip: 0.55, phase: 1.1, swirl: -0.07, sat: 0.45, rim: 1, rimPow: 1.5 },
  { amp: 0.15, freq: 2.4, speed: 0.42, alpha: 0.62, base: 1.028, col: "#b8cfff", up: 0.78, tip: 0.8, phase: 4.7, swirl: 0.13, sat: 1, rim: 1, rimPow: 2.1 }
];
const _haloTex = {};
function haloTexture(kind) {
  if (_haloTex[kind]) return _haloTex[kind];
  const S = 512, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const x = cv.getContext("2d"), c = S / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
  if (kind === "core") {
    g.addColorStop(0, "rgba(255,255,255,0.00)");
    g.addColorStop(0.3, "rgba(255,255,255,0.26)");
    g.addColorStop(0.41, "rgba(255,255,255,0.44)");
    g.addColorStop(0.49, "rgba(255,255,255,0.36)");
    g.addColorStop(0.58, "rgba(255,255,255,0.24)");
    g.addColorStop(0.7, "rgba(255,255,255,0.155)");
    g.addColorStop(0.85, "rgba(255,255,255,0.072)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.00)");
    g.addColorStop(0.48, "rgba(255,255,255,0.22)");
    g.addColorStop(0.58, "rgba(255,255,255,0.34)");
    g.addColorStop(0.76, "rgba(255,255,255,0.18)");
  }
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const img = x.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    if (d[i + 3] < 1) d[i + 3] = 1;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  _haloTex[kind] = t;
  return _haloTex[kind];
}
const STARMAP_VER = 536;
const SM_OFF = new Set(String(new URLSearchParams(location.search).get("sm_off") || "").split(",").map((s) => s.trim()).filter(Boolean));
export function createRenderer(container, opts) {
  opts = opts || {};
  if (!opts.data) throw new Error("Memory Sky requires data");
  const T = THREE;
  let study = opts.study !== false;
  let familyIds = null, familyEpoch = 0;
  let shape = "free", chosenShape = "free", shapeMix = 0, ringMix = 0, spiralAngle = 0, spiralPaused = false;
  if (!T) {
    const p = document.createElement("div");
    p.style.cssText = "color:#fff;padding:16px;font-size:13px";
    p.textContent = "\u661F\u56FE\u9700\u8981 three.js";
    container.appendChild(p);
    return { destroy() {
    }, setExpanded() {
    }, resetView() {
    }, isExpanded() {
      return false;
    }, refresh() {
    } };
  }
  const labels = document.createElement("div");
  labels.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2";
  container.appendChild(labels);
  if (SM_OFF.has("ver")) {
    const v = document.createElement("div");
    v.style.cssText = "position:absolute;left:8px;top:8px;z-index:9;transform:none;background:rgba(20,16,34,.85);color:#ffe;font:12px/1.6 monospace;padding:4px 8px;border-radius:6px;pointer-events:none";
    v.textContent = "starmap v" + STARMAP_VER + " \xB7 mips:" + (haloTexture("core").generateMipmaps ? "ON" : "off");
    container.appendChild(v);
  }
  let W = container.clientWidth || 1, H = container.clientHeight || 1;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(opts.expanded ? 78 : 66, W / H, 0.5, 6e3);
  let targetFov = opts.expanded ? 78 : 66;
  const DEF_POS = new T.Vector3(0, 0, 230);
  const EXP_POS = new T.Vector3(149, 62, 620);
  const CORE_POS = new T.Vector3(0, 0, 0);
  const SPIRAL_POS = new T.Vector3(0, 0, 540);
  const overviewPosition = () => expanded ? shape !== "free" ? new T.Vector3(0,0,700) : EXP_POS : DEF_POS;
  camera.position.copy(opts.expanded ? EXP_POS : DEF_POS);
  const renderer = new T.WebGLRenderer({ antialias: !SM_OFF.has("aa"), alpha: true });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(renderer.domElement);
  if (SM_OFF.has("shift")) {
    renderer.domElement.style.transform = "none";
    renderer.domElement.style.transition = "none";
    labels.style.transform = "none";
    labels.style.transition = "none";
  }
  let idleSpin = true, _spinLastT = 0, _tNow = 0;
  const _nowSec = () => _tNow;
  const _spinAxis = new T.Vector3(), _spinOff = new T.Vector3(), _spinH = new T.Vector3();
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.staticMoving = false;
  controls.dynamicDampingFactor = 0.12;
  controls.rotateSpeed = 2;
  controls.noPan = true;
  controls.minDistance = 40;
  controls.maxDistance = 820;
  controls.enablePan = false;
  controls.enabled = !!opts.expanded;
  let interacting = false, _spinResumeAt = 0;
  controls.addEventListener("start", () => {
    flying = false;
    interacting = true;
  });
  controls.addEventListener("end", () => {
    interacting = false;
    _spinResumeAt = _nowSec() + 0.8;
  });
  const haloView = new T.Vector3();
  const edgeA = new T.Vector3(), edgeB = new T.Vector3(), edgeDir = new T.Vector3();
  const raycaster = new T.Raycaster();
  const mouse = new T.Vector2();
  let nodes = [], links = [], softlinks = [], sprites = [], dustLayers = [], dustPoints = null, lineSeg = null, softSeg = null, hlLines = null, adj = Object.create(null), focusedNeighbors = null;
  const dustScale = () => renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360);
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
    // 只给最大的一批球画轨道，且封顶 ORBIT_PATHS 条（2026-09-09）：判据原本只有"半径够大"，
    // 示例数据里够格的才 13 颗，mamo 真实记忆库里有 26 颗（23 条五星 + 3 份底色）＝画满一屏线。
    // 半径降序、同径按 id 排＝可复现（本仓打分平局同规矩）。
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
  const foreground = SM_OFF.has("dust") ? null : lensDust(T);
  if (foreground) scene.add(foreground);
  const accents = starAccents(T, scene);
  function flyTo(pos, center, rate) {
    target.copy(pos);
    tLook.copy(center || CORE_POS);
    flightRate = rate || 0.08;
    flying = true;
  }
  function clear() {
    accents.clear();
    sprites.forEach((s) => {
      scene.remove(s.body);
      scene.remove(s.glow);
      if (s.shells) s.shells.forEach((sh) => scene.remove(sh.mesh));
    });
    sprites = [];
    labels.innerHTML = "";
    dustLayers.forEach((d) => {
      scene.remove(d);
      d.geometry.dispose();
      d.material.dispose();
    });
    dustLayers = [];
    dustPoints = null;
    if (lineSeg) scene.remove(lineSeg);
    if (softSeg) scene.remove(softSeg);
    if (hlLines) {
      scene.remove(hlLines);
      hlLines.geometry.dispose();
      hlLines.material.dispose();
      hlLines = null;
    }
  }
  function build() {
    clear();
    maxAct = Math.max(1, ...nodes.map((n) => n.activation || 0));
    nodes.forEach((n) => {
      const col = nodeColor(n), r = nodeRadius(n);
      const isCore = n.kind === "core";
      let body, coreMat = null, shells = null;
      if (isCore) {
        coreMat = coreBodyMaterial(T);
        body = new T.Mesh(new T.SphereGeometry(r * 1, 64, 44), coreMat);
        body.position.set(n.x, n.y, n.z);
        body.renderOrder = 2;
        body.userData = n;
        shells = (SM_OFF.has("aura") ? [] : CORE_AURA).map((o) => {
          const m = coreAuraMaterial(T, o);
          const sh = new T.Mesh(new T.SphereGeometry(r * 1, 72, 48), m);
          sh.position.set(n.x, n.y, n.z);
          sh.renderOrder = 2;
          scene.add(sh);
          return { mesh: sh, mat: m, swirl: o.swirl };
        });
      } else {
        const bMat = new T.SpriteMaterial({ map: bodyTexture(col), transparent: true, depthWrite: false, depthTest: false });
        body = new T.Sprite(bMat);
        body.position.set(n.x, n.y, n.z);
        const bScale = r * 2.05;
        body.scale.set(bScale, bScale, 1);
        body.renderOrder = 2;
        body.userData = n;
      }
      const gCol = isCore ? 10466536 : hexInt(col);
      const gMat = new T.SpriteMaterial({ map: haloTexture(isCore ? "core" : "normal"), color: new T.Color(gCol), transparent: true, depthWrite: false, depthTest: false, blending: T.NormalBlending, opacity: 0 });
      const glow = new T.Sprite(gMat);
      glow.position.set(n.x, n.y, n.z);
      glow.renderOrder = 1;
      if (SM_OFF.has("glow")) glow.visible = false;
      scene.add(glow);
      scene.add(body);
      const lab = document.createElement("button");
      lab.type = "button";
      lab.className = "ms-label";
      lab.tabIndex = -1;
      lab.addEventListener("click", (e) => {
        e.stopPropagation();
        opts.onOpen?.(n);
      });
      lab.style.cssText = "position:absolute;transform:translate(-50%,0);opacity:0;pointer-events:none";
      const _b = document.createElement("b");
      _b.textContent = n.title || "";
      lab.append(_b);
      if (n.date) {
        const _d = document.createElement("span");
        _d.style.opacity = ".55";
        _d.textContent = " " + String(n.date).slice(5);
        lab.append(_d);
      }
      labels.appendChild(lab);
      const oldBody = body.material, oldGlow = glow.material;
      const finish = n.kind === "event" ? nodeFinish(n) : null;
      const nextBody = isCore ? oldBody : lightMaterial(col, { stroke: finish?.stroke });
      const nextGlow = lightMaterial(isCore ? [159, 180, 232] : col, { halo: true, core: isCore });
      body.material = study ? nextBody : oldBody;
      glow.material = study ? nextGlow : oldGlow;
      if (coreMat) coreMat.uniforms.uStudy.value = study ? 1 : 0;
      if (shells) shells.forEach((sh) => sh.mat.uniforms.uStudy.value = study ? 1 : 0);
      const sp = { oldBody, oldGlow, nextBody, nextGlow, n, body, glow, lab, r, coreMat, shells, base: new T.Vector3(n.x, n.y, n.z), ph: hash(n.id, 9) * 6.28, ph2: hash(n.id, 11) * 6.28 };
      sprites.push(sp);
    });
    const pos = Object.create(null);
    sprites.forEach((s) => pos[s.n.id] = s.body.position);
    adj = Object.create(null);
    function addAdj(a, b) {
      (adj[a] || (adj[a] = /* @__PURE__ */ new Set())).add(b);
      (adj[b] || (adj[b] = /* @__PURE__ */ new Set())).add(a);
    }
    (links || []).forEach(([a, b]) => addAdj(a, b));
    (softlinks || []).forEach(([a, b]) => addAdj(a, b));
    function seg(list, color, op) {
      const pts = [];
      (list || []).forEach(([a, b]) => {
        const A = pos[a], B = pos[b];
        if (A && B) {
          pts.push(A.x, A.y, A.z, B.x, B.y, B.z);
        }
      });
      if (!pts.length) return null;
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      const m = threadMaterial(color, op);
      const ls = new T.LineSegments(geo, m);
      ls.userData.edges = list.filter(([a, b]) => pos[a] && pos[b]);
      scene.add(ls);
      return ls;
    }
    softSeg = seg(softlinks, 10985410, 0.07);
    lineSeg = seg(links, 15129798, 0.5);
    if (!SM_OFF.has("dust")) {
      dustPoints = makeDust(1600, 2200);
      scene.add(dustPoints);
      dustLayers.push(dustPoints);
    }
  }
  const DUST_PALETTE = [[245, 228, 198], [190, 194, 236]];
  const DUST_QUOTA = [297, 58, 35, 24, 9];
  const DUST_BANDS = [[0.8, 1.4], [1.4, 2.2], [2.2, 3.5], [3.5, 5], [5, 7]];
  const DUST_SCALE_REF = 246.4, DUST_DISTANCE_REF = 1250;
  function makeDust(count, radius) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const mag = new Float32Array(count), rnd = new Float32Array(count * 4);
    const qSum = DUST_QUOTA.reduce((a, b) => a + b, 0);
    let acc = 0;
    const cut = DUST_QUOTA.map((q) => (acc += q) / qSum);
    for (let i = 0; i < count; i++) {
      const ct = 2 * hash("d" + i, 3) - 1, st = Math.sqrt(1 - ct * ct), ph = 6.283185 * hash("d" + i, 5);
      const r = radius * Math.cbrt(0.02 + 0.98 * hash("d" + i, 7));
      let X = r * st * Math.cos(ph), Y = r * st * Math.sin(ph), Z = r * ct;
      if (hash("band" + i, 2) < 0.63) {
        const angle = ph + 0.32 * Math.sin(ph * 3);
        const radial = radius * (0.5 + 0.5 * hash("band" + i, 4));
        const thickness = (hash("band" + i, 6) + hash("band" + i, 8) - 1) * 180;
        X = radial * Math.cos(angle);
        Z = radial * Math.sin(angle);
        Y = 0.52 * X + 0.16 * Z + 90 * Math.sin(angle * 3) + thickness;
      }
      pos[i * 3] = X;
      pos[i * 3 + 1] = Y;
      pos[i * 3 + 2] = Z;
      const P = DUST_PALETTE[Math.floor(hash("d" + i, 13) * DUST_PALETTE.length) % DUST_PALETTE.length];
      col[i * 3] = P[0] / 255;
      col[i * 3 + 1] = P[1] / 255;
      col[i * 3 + 2] = P[2] / 255;
      for (let k = 0; k < 4; k++) rnd[i * 4 + k] = hash("r" + i, 17 + k);
      const u = hash("m" + i, 23);
      let b = 0;
      while (b < 4 && u > cut[b]) b++;
      const e = DUST_BANDS[b], tgt = e[0] + (e[1] - e[0]) * hash("m" + i, 29);
      mag[i] = tgt * DUST_DISTANCE_REF / DUST_SCALE_REF;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    g.setAttribute("aRnd", new T.BufferAttribute(rnd, 4));
    g.setAttribute("aMag", new T.BufferAttribute(mag, 1));
    const m = new T.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: T.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: dustScale() },
        uMaxPx: { value: 7 },
        uTwSmall: { value: 1.8 },
        uTwBig: { value: 5 },
        uTwUp: { value: 0.85 },
        uTwDn: { value: 0.22 },
        uGateLo: { value: 0.55 },
        uGateHi: { value: 0.92 },
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
            vec3 pos = position;
            // A coherent spatial wave drifts the cloud; brightness has its own clock.
            float wave = dot(position, vec3(.0021, -.0013, .0017));
            float drift = uTime * .024;
            vec3 flow = vec3(cos(wave + drift), sin(wave * .7 - drift), cos(wave * .4 + drift * .6));
            pos += flow * (3.0 + 6.0 * aRnd.x);
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            float ps = aMag * (uScale / max(1.0, -mv.z));
            gl_PointSize = min(ps, uMaxPx*uDpr);       // \u53EA\u5C01\u9876\u4E0D\u8BBE\u4E0B\u9650\uFF1A\u8FDC\u7684\u5C31\u8BE5\u5C0F\u5230\u4E00\u4E24\u4E2A\u50CF\u7D20
            float t = uTime;
            float amt = 1.0 - smoothstep(uTwSmall*uDpr, uTwBig*uDpr, ps);
            float rate = 4.0 + 10.0*aRnd.z;                    // \u6BCF\u9897\u5FEB\u95EA\u901F\u5EA6\u4E0D\u540C
            float gs   = 0.09 + 0.20*aRnd.w;                   // \u6BCF\u9897\u5F00\u7A97\u5468\u671F\u4E0D\u540C
            float gate = smoothstep(uGateLo, uGateHi, sin(t*gs*6.2832 + 6.2832*aRnd.x));
            float fast = 0.5 + 0.5*sin(t*rate + 6.2832*aRnd.y);
            float s = gate * (fast*2.0 - 1.0);         // -1..1\uFF1Bgate \u5173\u7740\u65F6\u6052\u4E3A 0 \u2192 \u5E38\u4EAE\u90A3\u4E9B\u7EB9\u4E1D\u4E0D\u52A8\u3001\u6EE1\u4EAE\u5EA6
            vTw = 1.0 + amt * (s > 0.0 ? s*uTwUp : s*uTwDn);
            gl_Position = projectionMatrix * mv;
          }`,
      fragmentShader: `
          precision highp float;
          varying vec3 vCol; varying float vTw;
          void main(){
            float d = length(gl_PointCoord - vec2(0.5));
            gl_FragColor = vec4(vCol * vTw, 1.0-smoothstep(0.40,0.5,d));
          }`
    });
    const pts = new T.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }
  function animate(ts) {
    if (!alive) return;
    if (t0 == null) {
      t0 = ts;
      _rawLast = 0;
    }
    const _raw = (ts - t0) / 1e3;
    const frameDt = Math.min(0.05, Math.max(0, _raw - _rawLast));
    _tAcc += frameDt;
    _rawLast = _raw;
    const t = _tAcc;
    _tNow = t;
    shapeMix = T.MathUtils.lerp(shapeMix, shape !== "free" ? 1 : 0, 1 - Math.exp(-frameDt / 0.65));
    ringMix=T.MathUtils.lerp(ringMix,shape==="ring"?1:0,1-Math.exp(-frameDt/.65));
    if (shape !== "free" && !spiralPaused && expanded && !focused && !interacting && !SM_OFF.has("spin")) spiralAngle += frameDt * 0.035;
    if (foreground) {
      foreground.visible = expanded;
      foreground.material.uniforms.uTime.value = t;
      foreground.material.uniforms.uDpr.value = renderer.getPixelRatio();
    }
    if (dustPoints) {
      const u = dustPoints.material.uniforms;
      u.uTime.value = t;
      u.uScale.value = dustScale();
      u.uDpr.value = renderer.getPixelRatio();
      dustPoints.rotation.x = Math.sin(t * 0.021) * 0.045;
      dustPoints.rotation.y = Math.cos(t * 0.037) * 0.07;
      dustPoints.rotation.z = t * 0.012;
    }
    sprites.forEach((s) => {
      const n = s.n, heat = Math.min(1, (n.activation || 0) / maxAct);
      let op, sizeMul;
      const isCore = n.kind === "core";
      if (isCore) {
        op = 1;
        sizeMul = 0.82;
      } else if (n.kind === "wiki" || n.kind === "baseline") {
        op = 0.68;
        sizeMul = 0.82;
      } else {
        op = 0.7 + 0.1 * heat;
        sizeMul = 0.78 + 0.12 * heat;
      }
      const br = 0.5 + 0.5 * Math.sin(t * (isCore ? 1.05 : 1.3) + s.ph);
      const drift = Math.min(4.2, 1.8 + s.r * 0.05);
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
      const bScale = 0.94 + 0.1 * br;
      const gs = s.displayRadius * 2.05 * (1.64 + 0.18 * sizeMul) * bScale * (isCore ? 1.39 : 1);
      haloView.copy(s.body.position).applyMatrix4(camera.matrixWorldInverse);
      const radiusPx = s.displayRadius * (H * 0.5 / Math.tan(camera.fov * Math.PI / 360)) / Math.max(1, -haloView.z);
      const haloScale = gs;
      s.glow.scale.set(haloScale, haloScale, 1);
      s.nextGlow.uniforms.uInner.value = s.displayRadius * 2 / haloScale;
      s.nextGlow.uniforms.uGain.value = 1;
      if (!isCore) s.nextBody.uniforms.uRadiusPx.value = Math.max(0.5, radiusPx);
      if (!isCore) s.nextBody.uniforms.uTime.value = t + s.ph;
      const bright = !focused || s === focused || focusedNeighbors && focusedNeighbors.has(n.id);
      const opBreath = isCore ? 0.78 + 0.22 * br : 0.72 + 0.36 * br;
      s.glow.material.opacity = Math.min(1, (bright ? op : op * 0.08) * opBreath);
      if (s.coreMat) {
        s.coreMat.uniforms.uTime.value = t;
        s.coreMat.uniforms.uOpacity.value = bright ? 1 : 0.12;
        const pulse = 1 + 0.035 * Math.sin(t * 0.9);
        s.body.scale.setScalar(pulse*shapeScale);
        s.body.rotation.y = t * 0.07;
        s.body.rotation.z = Math.sin(t * 0.11) * 0.12;
        if (s.shells) s.shells.forEach((sh) => {
          sh.mesh.position.copy(s.body.position);
          sh.mesh.scale.setScalar(pulse*shapeScale);
          sh.mesh.rotation.z = t * sh.swirl * (study ? 0.18 : 1);
          sh.mat.uniforms.uTime.value = t;
          sh.mat.uniforms.uOpacity.value = bright ? 1 : 0.1;
        });
      } else {
        s.body.scale.set(s.r*2.05*shapeScale,s.r*2.05*shapeScale,1);
        s.body.material.opacity = bright ? 1 : 0.12;
      }
    });
    const byId = new Map(sprites.map((s) => [s.n.id, s]));
    const fadeStep = 1 - Math.exp(-frameDt / 0.18);
    if (orbitLines) {
      const opacity = (focused ? .22 : .4) * T.MathUtils.smoothstep(shapeMix, .9, 1) * (1 - ringMix);   // 2026-09-09 mamo：轨道太淡几乎看不到（原 .14/.24 + 远景衰到 .18）
      orbitLines.material.opacity = opacity;
      orbitLines.visible = opacity > .001;
    }
    for (const [line, goal] of [[lineSeg, focused ? 0.1 : 0.42], [softSeg, focused ? 0.025 : 0.115], [hlLines, 0.68]]) {
      if (!line) continue;
      line.material.opacity = T.MathUtils.lerp(line.material.opacity, goal * (1 - shapeMix), fadeStep);
      line.visible = shapeMix < 0.999;
      const attr = line.geometry.attributes.position;
      (line.userData.edges || []).forEach(([a, b], i) => {
        if (familyIds && (!familyIds.has(a) || !familyIds.has(b))) {
          attr.setXYZ(i * 2, 0, 0, 0);
          attr.setXYZ(i * 2 + 1, 0, 0, 0);
          return;
        }
        const A = byId.get(a), B = byId.get(b);
        if (!A || !B) return;
        edgeA.copy(A.body.position);
        edgeB.copy(B.body.position);
        edgeDir.subVectors(edgeB, edgeA);
        const len = edgeDir.length();
        edgeDir.normalize();
        const trim = Math.min(1, len / Math.max(1e-3, A.r + B.r));
        edgeA.addScaledVector(edgeDir, A.r * trim);
        edgeB.addScaledVector(edgeDir, -B.r * trim);
        attr.setXYZ(i * 2, edgeA.x, edgeA.y, edgeA.z);
        attr.setXYZ(i * 2 + 1, edgeB.x, edgeB.y, edgeB.z);
      });
      attr.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
    if (flying) {
      if (focused) {
        target.add(spiralView.copy(focused.body.position).sub(tLook));
        tLook.copy(focused.body.position);
      }
      camera.position.lerp(target, flightRate);
      controls.target.lerp(tLook, flightRate);
      if (camera.position.distanceTo(target) < 4 && controls.target.distanceTo(tLook) < 2) flying = false;
    }
    if (!flying && expanded && !familyIds) {
      const orbitDistance = camera.position.distanceTo(controls.target);
      if (focused && orbitDistance < 440) controls.target.lerp(focused.body.position, 0.07);
      else if (!focused || orbitDistance > 520) controls.target.lerp(CORE_POS, focused ? 0.014 : 0.04);
    }
    if (shape === "free" && idleSpin && !flying && !focused && !interacting && t >= _spinResumeAt && !SM_OFF.has("spin")) {
      const dt = Math.min(0.033, Math.max(0, t - _spinLastT));
      const SPIN_RATE = 0.5, tt = t * SPIN_RATE;
      const sp = (0.075 + 0.05 * Math.sin(tt * 0.017)) * SPIN_RATE;
      _spinAxis.set(Math.sin(tt * 0.011) * 0.35, 1, Math.sin(tt * 7e-3 + 1.7) * 0.35).normalize();
      _spinOff.copy(camera.position).sub(controls.target);
      _spinOff.applyAxisAngle(_spinAxis, sp * dt);
      camera.up.applyAxisAngle(_spinAxis, sp * dt);
      _spinH.crossVectors(_spinAxis, _spinOff);
      if (_spinH.lengthSq() < 1e-8) {
        camera.position.copy(controls.target).add(_spinOff);
        _spinLastT = t;
      } else {
        _spinH.normalize();
        _spinOff.applyAxisAngle(_spinH, 7e-3 * SPIN_RATE * Math.sin(tt * 0.019) * dt);
        camera.up.applyAxisAngle(_spinH, 7e-3 * SPIN_RATE * Math.sin(tt * 0.019) * dt).normalize();
        camera.position.copy(controls.target).add(_spinOff);
      }
    }
    _spinLastT = t;
    if (Math.abs(camera.fov - targetFov) > 1e-3) {
      camera.fov = T.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-frameDt / 0.28));
      camera.updateProjectionMatrix();
    }
    controls.update();
    sprites.forEach((s) => {
      const visible = !familyIds || familyIds.has(s.n.id);
      s.body.visible = visible;
      s.glow.visible = visible && !SM_OFF.has("glow");
      if (s.shells) s.shells.forEach((sh) => sh.mesh.visible = visible);
    });
    accents.update(t, expanded, camera, W, H, interacting || flying);
    renderer.render(scene, camera);
    updateLabels();
    raf = requestAnimationFrame(animate);
  }
  function labelBottomPad() {
    return 48;
  }
  function updateLabels() {
    const v = new T.Vector3();
    const globalView = camera.position.distanceTo(controls.target) > 480;
    const bottomPad = labelBottomPad();
    sprites.forEach((s) => {
      s.lab.style.pointerEvents = "none";
      s.lab.tabIndex = -1; s.lab.setAttribute("aria-hidden","true");
      v.copy(s.body.position).project(camera);
      const dist = Math.max(1, camera.position.distanceTo(s.body.position));
      const fovScale = H / (2 * Math.tan(camera.fov * Math.PI / 360));
      const radiusPx = (s.displayRadius||s.r) * 1.08 / dist * fovScale;
      const isNb = focusedNeighbors && focusedNeighbors.has(s.n.id);
      const show = !globalView && (focused === s || isNb && radiusPx >= 11);
      if (familyIds && !familyIds.has(s.n.id) || !show || v.z > 1) {
        s.lab.style.opacity = "0"; s.lab.hidden=true;
        return;
      }
      const x = (v.x * 0.5 + 0.5) * W;
      const cy = (-v.y * 0.5 + 0.5) * H, off = Math.max(12, radiusPx + 6);
      let y = cy + off;
      if (y > H - bottomPad) y = cy - off - 26;
      if (x < -36 || x > W + 36 || y < 0 || y > H - bottomPad) {
        s.lab.style.opacity = "0"; s.lab.hidden=true;
        return;
      }
      const fadeStart = H - bottomPad - 44;
      const fade = y > fadeStart ? Math.max(0.35, (H - bottomPad - y) / 44) : 1;
      s.lab.style.fontSize = Math.max(10, Math.min(11, radiusPx * 0.34)) + "px";
      s.lab.style.left = x + "px";
      s.lab.style.top = y + "px";
      s.lab.hidden=false; s.lab.style.opacity = String(fade);
      s.lab.style.pointerEvents = "auto";
      s.lab.tabIndex = 0; s.lab.removeAttribute("aria-hidden");
    });
  }
  function onClick(e) {
    if (!expanded) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(sprites.filter((s) => !familyIds || familyIds.has(s.n.id)).map((s) => s.body));
    if (hit.length) {
      focusNode(sprites.find((s) => s.body === hit[0].object));
    } else {
      clearFocus();
    }
  }
  function clearFocus() {
    accents.clear();
    targetFov = expanded ? 78 : 66;
    const had = !!focused;
    focused = null;
    focusedNeighbors = null;
    flying = false;
    if (hlLines) {
      scene.remove(hlLines);
      hlLines.geometry.dispose();
      hlLines.material.dispose();
      hlLines = null;
    }
    if (had) opts.onClear?.();
  }
  function focusNode(s) {
    if (!s) return;
    accents.pulse(s, _nowSec());
    focused = s;
    targetFov = 66;
    spiralPaused = true;
    idleSpin = false;
    const id = s.n.id, p = s.body.position;
    opts.onPick?.(s.n);
    focusedNeighbors = new Set([...adj[id] || []].filter((nid) => !familyIds || familyIds.has(nid)));
    const pos = Object.create(null);
    sprites.forEach((s2) => pos[s2.n.id] = s2.body.position);
    if (hlLines) {
      scene.remove(hlLines);
      hlLines.geometry.dispose();
      hlLines.material.dispose();
      hlLines = null;
    }
    const pts = [];
    let spread = s.r * (shape!=="free"?(s.n.kind==="core"?3:.6):1) * 3;
    focusedNeighbors.forEach((nid) => {
      const B = pos[nid];
      if (!B) return;
      pts.push(p.x, p.y, p.z, B.x, B.y, B.z);
      spread = Math.max(spread, p.distanceTo(new T.Vector3(B.x, B.y, B.z)));
    });
    if (pts.length) {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      hlLines = new T.LineSegments(geo, threadMaterial(15985362, 0));
      hlLines.userData.edges = [...focusedNeighbors].filter((nid) => pos[nid]).map((nid) => [id, nid]);
      scene.add(hlLines);
    }
    const dist = Math.min(265, Math.max(82, spread * 1.18 + 42));
    const dir = camera.position.clone().sub(p).normalize();
    target.copy(p).add(dir.multiplyScalar(dist));
    tLook.copy(p);
    flying = true;
  }
  function resize() {
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    controls.handleResize();
  }
  async function load() {
    const d = structuredClone(opts.data);
    nodes = d.nodes || [];
    links = d.links || [];
    softlinks = d.softlinks || [];
    const dropped = new Set(nodes.filter((n) => n.kind === "wiki").map((n) => n.id));
    if (dropped.size) {
      nodes = nodes.filter((n) => !dropped.has(n.id));
      const keep = ([a, b]) => !dropped.has(a) && !dropped.has(b);
      links = links.filter(keep);
      softlinks = softlinks.filter(keep);
    }
    layout(nodes, links, softlinks);
    build();
    arrangeSpiral();
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(animate);
  }
  let moved = 0, downXY = null;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downXY = [e.clientX, e.clientY];
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downXY) return;
    const d = Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]);
    downXY = null;
    if (d < 6) onClick(e);
  });
  const onWin = () => resize();
  window.addEventListener("resize", onWin);
  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => resize());
    ro.observe(container);
  }
  const ready = load();
  function frameFamily() {
    const selected = sprites.filter((s) => familyIds && familyIds.has(s.n.id));
    if (!selected.length) return;
    const box = new T.Box3();
    selected.forEach((s) => box.expandByPoint(shape !== "free" ? new T.Vector3() : s.base));
    const center = box.getCenter(new T.Vector3());
    let radius = 20;
    selected.forEach((s) => radius = Math.max(radius, (shape === "ring" ? s.ring.length() : shape === "spiral" ? s.orbit.radius : s.base.distanceTo(center)) + s.r * (shape !== "free" ? (s.n.kind === "core" ? 3 : .6) : 1)));
    const halfFov = Math.atan(Math.tan(targetFov * Math.PI / 360) * Math.min(0.65, camera.aspect * 0.9));
    const distance = Math.max(100, radius / Math.sin(halfFov) * 1.2);
    controls.maxDistance = Math.max(820, distance * 1.2);
    const direction = camera.position.clone().sub(controls.target).normalize();
    flyTo(center.clone().addScaledVector(direction, distance), center, 0.065);
  }
  return {
    focus(id) {
      const s = sprites.find((s2) => s2.n.id === id && (!familyIds || familyIds.has(id)));
      if (s) focusNode(s);
    },
    setShape(value) {
      chosenShape = ["spiral","ring"].includes(value) ? value : "free";
      shape = familyIds ? "free" : chosenShape;   // 星座固定按自由星空画，造型只管整片星穹
      clearFocus();
      spiralPaused = false;
      idleSpin = !familyIds;
      arrangeSpiral();
      if (familyIds) frameFamily();
      else flyTo(overviewPosition(), CORE_POS, 0.065);
    },
    async setFamily(ids) {
      const epoch = ++familyEpoch;
      await ready;
      if (!alive || epoch !== familyEpoch) return 0;
      clearFocus();
      familyIds = ids ? new Set(ids) : null;
      shape = familyIds ? "free" : chosenShape;
      idleSpin = !familyIds;
      spiralPaused = false;
      arrangeSpiral();
      if (familyIds) frameFamily();
      else {
        controls.maxDistance = expanded ? 820 : 260;
        flyTo(overviewPosition(), CORE_POS, 0.065);
      }
      return sprites.filter((s) => !familyIds || familyIds.has(s.n.id)).length;
    },
    setStudy(value) {
      study = !!value;
      sprites.forEach((s) => {
        s.body.material = study ? s.nextBody : s.oldBody;
        s.glow.material = study ? s.nextGlow : s.oldGlow;
        if (s.coreMat) s.coreMat.uniforms.uStudy.value = study ? 1 : 0;
        if (s.shells) s.shells.forEach((sh) => sh.mat.uniforms.uStudy.value = study ? 1 : 0);
      });
    },
    refresh: load,
    isExpanded() {
      return expanded;
    },
    setExpanded(b) {
      ++familyEpoch;
      if (!b) {
        familyIds = null;
        arrangeSpiral();
      }
      spiralPaused = false;
      expanded = !!b;
      targetFov = expanded ? 78 : 66;
      controls.enabled = expanded;
      controls.maxDistance = expanded ? 820 : 260;
      clearFocus();
      idleSpin = true;
      flyTo(overviewPosition(), CORE_POS, expanded ? 0.055 : 0.075);
      setTimeout(resize, 60);
      setTimeout(resize, 360);
    },
    resetView() {
      spiralPaused = false;
      clearFocus();
      if (familyIds) {
        idleSpin = false;
        frameFamily();
      } else {
        idleSpin = true;
        flyTo(overviewPosition(), CORE_POS, 0.075);
      }
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWin);
      if (ro) ro.disconnect();
      try {
        controls.dispose();
        const geometries = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set();
        scene.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (o.material) materials.add(o.material);
        });
        sprites.forEach((s) => [s.oldBody, s.nextBody, s.oldGlow, s.nextGlow].forEach((m) => materials.add(m)));
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
      } catch (e) {
      }
      try {
        container.removeChild(renderer.domElement);
        container.removeChild(labels);
      } catch (e) {
      }
    }
  };
}
