// Copyright (c) 2026 mamo and contributors. MIT.
import { ShaderMaterial, Color, NormalBlending } from "three";
export function threadMaterial(color, opacity, farFade = .18) {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    uniforms: { uColor: { value: new Color().setRGB(((color>>16)&255)/255,((color>>8)&255)/255,(color&255)/255) }, uOpacity: { value: opacity }, uFar: { value: farFade } },
    vertexShader: `varying float vDepth;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `precision highp float;varying float vDepth;uniform vec3 uColor;uniform float uOpacity;uniform float uFar;void main(){float depthFade=mix(1.,uFar,smoothstep(180.,850.,vDepth));gl_FragColor=vec4(uColor,uOpacity*depthFade);}`
  });
  Object.defineProperty(m, "opacity", { get() {
    return this.uniforms.uOpacity.value;
  }, set(v) {
    this.uniforms.uOpacity.value = v;
  }, configurable: true });
  return m;
}
