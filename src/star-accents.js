// Copyright (c) 2026 mamo and contributors. MIT.
export function starAccents(T, scene) {
  const geometry = new T.PlaneGeometry(2, 2);
  const material = (uniforms, vertexShader, fragmentShader) => new T.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  });
  const ring = new T.Mesh(geometry, material(
    { uAlpha: { value: 0 }, uColor: { value: new T.Color("#e4eaff") } },
    "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    `varying vec2 vUv; uniform float uAlpha; uniform vec3 uColor;
     void main(){float d=length(vUv-.5)*2.; float rim=exp(-pow((d-.82)/.025,2.));
       float soft=exp(-pow((d-.82)/.09,2.));gl_FragColor=vec4(uColor,(rim*.7+soft*.3)*uAlpha);}`
  ));
  const meteor = new T.Mesh(geometry, material(
    { uHead: { value: new T.Vector2() }, uViewport: { value: new T.Vector2(1, 1) }, uAlpha: { value: 0 }, uLength: { value: 64 }, uDirection: { value: new T.Vector2(0.86, 0.51) } },
    `varying vec2 vUv; uniform vec2 uHead,uViewport,uDirection; uniform float uLength;
     void main(){vUv=uv;vec2 normal=vec2(-uDirection.y,uDirection.x);
       vec2 p=uHead+uDirection*(uv.x-1.)*uLength+normal*(uv.y-.5)*8.;
       gl_Position=vec4(p/uViewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}`,
    `varying vec2 vUv; uniform float uAlpha;
     void main(){float tail=pow(vUv.x,2.)*(1.-smoothstep(.95,1.,vUv.x));
       float thin=exp(-pow((vUv.y-.5)*16.,2.));float glow=exp(-pow((vUv.y-.5)*5.,2.));
       gl_FragColor=vec4(.93,.92,1.,(thin*.8+glow*.2)*tail*uAlpha);}`
  ));
  meteor.material.side = T.DoubleSide;
  ring.renderOrder = 80;
  meteor.renderOrder = 81;
  ring.frustumCulled = meteor.frustumCulled = false;
  ring.visible = meteor.visible = false;
  scene.add(ring, meteor);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pulse = null, meteorStart = null, nextMeteor = 4 + Math.random() * 3, origin = { x: 0, y: 0 };
  return {
    pulse(sprite, t) {
      pulse = { sprite, start: t };
    },
    clear() {
      pulse = null;
      ring.visible = false;
    },
    update(t, expanded, camera, w, h, quiet) {
      ring.visible = false;
      meteor.visible = false;
      if (!expanded || reduceMotion.matches) {
        pulse = null;
        meteorStart = null;
        nextMeteor = t + 12;
        return;
      }
      if (pulse) {
        const age = (t - pulse.start) / 1.05, s = pulse.sprite;
        if (age >= 1 || !s.body.visible) pulse = null;
        else {
          ring.visible = true;
          ring.position.copy(s.body.position);
          ring.quaternion.copy(camera.quaternion);
          ring.scale.setScalar((s.displayRadius||s.r) * (1 + 1.15 * (1 - Math.pow(1 - age, 2))) / 0.82);
          ring.material.uniforms.uAlpha.value = 0.36 * Math.sin(Math.PI * Math.sqrt(age)) * Math.pow(1 - age, 0.65);
          const color = s.body.material.uniforms?.uColor?.value;
          if (color?.isVector3) ring.material.uniforms.uColor.value.setRGB(0.4 + 0.6 * color.x, 0.4 + 0.6 * color.y, 0.4 + 0.6 * color.z);
          else ring.material.uniforms.uColor.value.set("#e4eaff");
        }
      }
      if (meteorStart === null && t >= nextMeteor && !quiet) {
        meteorStart = t;
        origin = { x: w * (0.08 + Math.random() * 0.45), y: h * (0.12 + Math.random() * 0.34) };
        meteor.material.uniforms.uLength.value = Math.min(115, w * 0.29);
      }
      if (meteorStart !== null) {
        const age = (t - meteorStart) / 1.5;
        if (age >= 1) {
          meteorStart = null;
          nextMeteor = t + 14 + Math.random() * 10;
          return;
        }
        meteor.visible = true;
        const u = meteor.material.uniforms, travel = Math.min(220, w * 0.56) * age;
        u.uViewport.value.set(w, h);
        u.uHead.value.set(origin.x + travel * 0.86, origin.y + travel * 0.51);
        u.uAlpha.value = 0.65 * Math.pow(Math.sin(Math.PI * age), 0.8) * (quiet ? 0.3 : 1);
      }
    }
  };
}
