// Copyright (c) 2026 mamo and contributors. MIT.
// Independent circular orbits; angles and rates are stable for each memory.
export function orbitFor(item, hash) {
  if (item.core) return { radius: 0, phase: 0, tilt: 0, node: 0, rate: 0 };
  const radius = 115 + 140 * Math.pow(hash(item.id, 171), .8);
  const planar = hash(item.id, 172) < .6;
  return {
    radius,
    phase: hash(item.id, 173) * Math.PI * 2,
    tilt: planar ? .85 + hash(item.id, 174) * .3 : .15 + hash(item.id, 174) * 2.6,
    node: planar ? .22 + hash(item.id, 175) * .2 : hash(item.id, 175) * Math.PI * 2,
    rate: Math.pow(170 / radius, 1.5) * (.75 + hash(item.id, 176) * .8),
  };
}
export function orbitPosition(orbit, time, out) {
  const angle = orbit.phase + time * orbit.rate;
  const x = Math.cos(angle) * orbit.radius;
  const y = Math.sin(angle) * orbit.radius;
  const cy = y * Math.cos(orbit.tilt);
  return out.set(x * Math.cos(orbit.node) - cy * Math.sin(orbit.node),
    x * Math.sin(orbit.node) + cy * Math.cos(orbit.node), y * Math.sin(orbit.tilt));
}
