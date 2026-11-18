/* Straighten math verification — run with: bun scripts/test-crop-straighten.ts
 * Property: every corner of the inscribed rect must lie inside the tilted
 * image rectangle, for any aspect ratio and any |angle| ≤ 15°. */
function inscribedRect(bw: number, bh: number, thetaDeg: number) {
  const a = (thetaDeg * Math.PI) / 180;
  const s = Math.abs(Math.sin(a));
  const c = Math.cos(a);
  if (s === 0) return { w: bw, h: bh };
  if (2 * s * c >= bh / bw) return { w: bh / (2 * s), h: bh / (2 * c) };
  if (2 * s * c >= bw / bh) return { w: bw / (2 * c), h: bw / (2 * s) };
  const denom = c * c - s * s;
  return { w: (bw * c - bh * s) / denom, h: (bh * c - bw * s) / denom };
}

let failures = 0;
function inside(W: number, H: number, deg: number, w: number, h: number): boolean {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  // box corners in the image's own frame (rotate box corners by ∓deg)
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const u = sx * (w / 2) * c + sy * (h / 2) * s;   // rotate by +deg
    const v = -sx * (w / 2) * s + sy * (h / 2) * c;
    if (Math.abs(u) > W / 2 + 1e-6 || Math.abs(v) > H / 2 + 1e-6) return false;
  }
  return true;
}

// exact regressions
const r1 = inscribedRect(1000, 1000, 15);
if (Math.abs(r1.w - 816.5) > 0.5 || Math.abs(r1.h - 816.5) > 0.5) { failures++; console.log("FAIL square 15°:", r1); } else console.log("PASS square 1000 15° =", r1.w.toFixed(1));
const r2 = inscribedRect(6000, 400, 15);
if (Math.abs(r2.w - 772.8) > 0.5 || Math.abs(r2.h - 207.1) > 0.5) { failures++; console.log("FAIL wide 15°:", r2); } else console.log("PASS wide 6000×400 15° =", r2.w.toFixed(1), "×", r2.h.toFixed(1));
const r3 = inscribedRect(100, 600, 15);
if (Math.abs(r3.w - 51.76) > 0.5 || Math.abs(r3.h - 193.1) > 0.5) { failures++; console.log("FAIL tall 15°:", r3); } else console.log("PASS tall 100×600 15° =", r3.w.toFixed(1), "×", r3.h.toFixed(1));
const r4 = inscribedRect(640, 480, 0);
if (r4.w !== 640 || r4.h !== 480) { failures++; console.log("FAIL 0°:", r4); } else console.log("PASS 0° identity");

// property sweep: 300 random aspect/angle combos, all four corners inside
let bad = 0;
for (let i = 0; i < 300; i++) {
  const W = 40 + Math.random() * 6000;
  const H = 40 + Math.random() * 6000;
  const deg = (Math.random() * 30 - 15);
  const { w, h } = inscribedRect(W, H, deg);
  if (w <= 0 || h <= 0 || !inside(W, H, deg, w, h)) bad++;
}
console.log(bad === 0 ? "PASS property sweep: 300/300 boxes fully inside the tilted image" : `FAIL property sweep: ${bad} boxes poke outside`);
failures += bad;
console.log(failures === 0 ? "\nALL STRAIGHTEN TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
