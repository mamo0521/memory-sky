// Copyright (c) 2026 mamo and contributors. MIT.
export function lensDust(T) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("aSeed", new T.Float32BufferAttribute([0.13, 0.38, 0.67, 0.91], 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: T.NormalBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime,uDpr;
      varying float vAlpha,vSeed;
      void main(){
        float cycle=(uTime+aSeed*32.0)/32.0;
        float phase=fract(cycle);
        float progress=clamp(phase/.28,0.0,1.0);
        float lane=fract(aSeed*7.13+floor(cycle)*.381);
        float x=mix(-1.18,1.18,progress);
        float y=mix(-.75,.75,lane)+.12*sin(progress*3.14159);
        gl_Position=vec4(x,y,0.0,1.0);
        gl_PointSize=mix(18.0,42.0,aSeed)*uDpr;
        vAlpha=smoothstep(0.0,.18,progress)*(1.0-smoothstep(.75,1.0,progress))*.12;
        vSeed=aSeed;
      }`,
    fragmentShader: `
      varying float vAlpha,vSeed;
      void main(){
        float r=length(gl_PointCoord-.5)*2.0;
        float soft=(.82+.18*r*r)*(1.0-smoothstep(.84,1.0,r));
        vec3 color=mix(vec3(.96,.90,.77),vec3(.79,.84,1.0),vSeed);
        gl_FragColor=vec4(color,soft*vAlpha);
      }`
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}
