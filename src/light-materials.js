// Copyright (c) 2026 mamo and contributors. MIT.
import { ShaderMaterial, Vector3, NormalBlending } from "three";
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
export function lightMaterial(rgb, { halo = false, core = false, stroke = null } = {}) {
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
    uniforms: { uColor: { value: new Vector3(...rgb.map((c) => c / 255)) }, uOpacity: { value: 1 }, uStroke: { value: new Vector3(...(stroke || rgb).map((c) => c / 255)) }, uRadiusPx: { value: 10 }, uGain: { value: 1 }, uInner: { value: 0.55 }, uTime: { value: 0 }, uCore: { value: core ? 1 : 0 } },
    vertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vDisc;
      uniform vec3 uColor,uStroke;
      uniform float uOpacity,uInner,uTime,uCore,uGain,uRadiusPx;
      void main() {
        float r = length(vDisc);
        float pixel = max(fwidth(r),0.0001);
        ${halo ? `
        float outside = max(0.0,r-uInner);
        float width = max(0.08,1.0-uInner);
        float x = outside/width;
        float tight = exp(-x*x*44.0);
        float broad = exp(-x*x*5.8);
        float edge = 1.0-smoothstep(0.82,1.0,r);
        float inside = smoothstep(uInner*0.45,uInner,r);
        float alpha = (0.38*tight+0.20*broad)*edge*inside*uGain;
        gl_FragColor=vec4(uColor,alpha*uOpacity);
        ` : `
        float coverage = 1.0-smoothstep(0.965-pixel*0.6,0.965+pixel*0.6,r);
        float rimWidth = max(0.016,pixel*0.65);
        float ring = exp(-pow((r-0.941)/rimWidth,2.0));
        float angle = atan(vDisc.y,vDisc.x);
        float quiet = 0.88+0.12*sin(angle*2.0+uTime*0.24);
        float rimPx=1.15*smoothstep(0.0,12.0,uRadiusPx);
        float strokeWidth=min(.45,rimPx/uRadiusPx);
        float border=smoothstep(.965-strokeWidth-pixel*.3,.965-strokeWidth+pixel*.3,r);
        vec3 color = ${stroke ? "mix(uColor,uStroke,border)" : "mix(uColor,vec3(1.0),ring*0.48*quiet)"};
        gl_FragColor=vec4(color,coverage*uOpacity);
        `}
      }
    `
  });
  material.rotation = 0;
  material.sizeAttenuation = true;
  Object.defineProperty(material, "opacity", { get() {
    return this.uniforms.uOpacity.value;
  }, set(value) {
    this.uniforms.uOpacity.value = value;
  }, configurable: true });
  return material;
}
