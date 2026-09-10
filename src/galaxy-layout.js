// Copyright (c) 2026 mamo and contributors. MIT.
export function galaxyLayout(items, hash) {
  const placed = [];
  const outerRadius = 238 * Math.sqrt(1.5);
  const requiredGap = (a, b) => (a.radius + b.radius + (a.space + b.space) / 2) / 0.82;
  const sorted = [...items].sort((a, b) => Number(!!b.core) - Number(!!a.core) || b.radius - a.radius || a.id.localeCompare(b.id));
  for (const item of sorted) {
    if (item.core) {
      placed.push({ ...item, x: 0, y: 0, z: 0, space: 1 });
      continue;
    }
    let best = null, bestClearance = -Infinity;
    for (let attempt = 0; attempt < 800; attempt++) {
      const key = item.id + ":galaxy:" + attempt;
      const u = hash(key, 1);
      const radial = 18 + (outerRadius - 18) * Math.pow(u, 1.45);
      const fraction = radial / outerRadius;
      const space = 1 + 4 * fraction + 38 * fraction * fraction * Math.pow(hash(item.id, 91), 2);
      const inArm = hash(key, 2) < 0.82;
      const angle = inArm ? (hash(key, 3) < 0.5 ? 0 : Math.PI) + fraction * 3.8 + (hash(key, 4) + hash(key, 5) - 1) * 0.55 : hash(key, 6) * Math.PI * 2;
      const x = Math.cos(angle) * radial, y = Math.sin(angle) * radial;
      const candidate = { ...item, x, y, z: 0, space };
      let clearance = Infinity;
      for (const other of placed) {
        clearance = Math.min(clearance, Math.hypot(x - other.x, y - other.y) - requiredGap(candidate, other));
      }
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = candidate;
      }
      if (clearance >= 0) break;
    }
    while (placed.some((other) => Math.hypot(best.x - other.x, best.y - other.y) < requiredGap(best, other))) {
      best.x *= 1.04;
      best.y *= 1.04;
    }
    placed.push(best);
  }
  return placed;
}
