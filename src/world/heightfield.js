// Fast height lookups and ray marching over the (non-uniform) terrain grid samples.
// Used for label occlusion, double-click targets and camera clamping — far cheaper than
// raycasting the full terrain mesh.
export class HeightField {
  constructor(xs, zs, heights) {
    this.xs = xs;
    this.zs = zs;
    this.h = heights;
    this.n = xs.length;
  }
  _find(arr, v) {
    let lo = 0, hi = arr.length - 2;
    if (v <= arr[0]) return 0;
    if (v >= arr[hi + 1]) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid] <= v) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  sample(x, z) {
    const { xs, zs, h, n } = this;
    const i = this._find(xs, x), j = this._find(zs, z);
    const tx = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i])));
    const tz = Math.max(0, Math.min(1, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  /** first hit distance of a ray against max(ground, sea level), or Infinity */
  raycast(ox, oy, oz, dx, dy, dz, maxDist = 6000, water = true) {
    let t = 0, step = 2;
    let prevT = 0;
    while (t < maxDist) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      let g = this.sample(x, z);
      if (water) g = Math.max(g, 0);
      if (y < g) {
        // refine
        let lo = prevT, hi = t;
        for (let k = 0; k < 8; k++) {
          const m = (lo + hi) / 2;
          const gy = Math.max(water ? 0 : -1e9, this.sample(ox + dx * m, oz + dz * m));
          if (oy + dy * m < gy) hi = m;
          else lo = m;
        }
        return hi;
      }
      prevT = t;
      step = Math.max(1.5, Math.min(25, (y - g) * 0.5));
      t += step;
    }
    return Infinity;
  }
}
