/*
 * FreeSeak "Enhance Image" worker.
 * 100% client-side image enhancement - no servers, no uploads, no accounts.
 * Pipeline: denoise -> auto levels -> color -> bicubic upscale -> unsharp mask.
 */
'use strict';

var MAX_OUTPUT_PIXELS = 25000000;

function clampIdx(v, hi) {
  return v < 0 ? 0 : v > hi ? hi : v;
}

/* ------------------------------------------------------------------ */
/* Bicubic (Catmull-Rom, a = -0.5) separable resampling                */
/* ------------------------------------------------------------------ */

function cubicWeight(t) {
  var a = -0.5;
  var at = t < 0 ? -t : t;
  if (at <= 1) return (a + 2) * at * at * at - (a + 3) * at * at + 1;
  if (at < 2) return a * at * at * at - 5 * a * at * at + 8 * a * at - 4 * a;
  return 0;
}

function resampleBicubic(src, sw, sh, dw, dh) {
  // Horizontal pass: sw -> dw
  var tmp = new Uint8ClampedArray(dw * sh * 4);
  var xs = new Int32Array(dw * 4);
  var xw = new Float32Array(dw * 4);
  var sx = dw / sw;
  var dx, k;
  for (dx = 0; dx < dw; dx++) {
    var fx = (dx + 0.5) / sx - 0.5;
    var x0 = Math.floor(fx);
    var t = fx - x0;
    var sum = 0;
    for (k = 0; k < 4; k++) {
      var wgt = cubicWeight(t + 1 - k);
      xw[dx * 4 + k] = wgt;
      sum += wgt;
      xs[dx * 4 + k] = clampIdx(x0 - 1 + k, sw - 1);
    }
    if (sum !== 0) {
      xw[dx * 4] /= sum;
      xw[dx * 4 + 1] /= sum;
      xw[dx * 4 + 2] /= sum;
      xw[dx * 4 + 3] /= sum;
    }
  }
  for (var y = 0; y < sh; y++) {
    var row = y * sw * 4;
    var orow = y * dw * 4;
    for (dx = 0; dx < dw; dx++) {
      var i0 = xs[dx * 4] * 4 + row;
      var i1 = xs[dx * 4 + 1] * 4 + row;
      var i2 = xs[dx * 4 + 2] * 4 + row;
      var i3 = xs[dx * 4 + 3] * 4 + row;
      var w0 = xw[dx * 4];
      var w1 = xw[dx * 4 + 1];
      var w2 = xw[dx * 4 + 2];
      var w3 = xw[dx * 4 + 3];
      var o = orow + dx * 4;
      tmp[o] = src[i0] * w0 + src[i1] * w1 + src[i2] * w2 + src[i3] * w3;
      tmp[o + 1] = src[i0 + 1] * w0 + src[i1 + 1] * w1 + src[i2 + 1] * w2 + src[i3 + 1] * w3;
      tmp[o + 2] = src[i0 + 2] * w0 + src[i1 + 2] * w1 + src[i2 + 2] * w2 + src[i3 + 2] * w3;
      tmp[o + 3] = src[i0 + 3] * w0 + src[i1 + 3] * w1 + src[i2 + 3] * w2 + src[i3 + 3] * w3;
    }
  }
  // Vertical pass: sh -> dh
  var out = new Uint8ClampedArray(dw * dh * 4);
  var ys = new Int32Array(dh * 4);
  var yw = new Float32Array(dh * 4);
  var sy = dh / sh;
  var dy;
  for (dy = 0; dy < dh; dy++) {
    var fy = (dy + 0.5) / sy - 0.5;
    var y0 = Math.floor(fy);
    var ty = fy - y0;
    var sum2 = 0;
    for (k = 0; k < 4; k++) {
      var wy = cubicWeight(ty + 1 - k);
      yw[dy * 4 + k] = wy;
      sum2 += wy;
      ys[dy * 4 + k] = clampIdx(y0 - 1 + k, sh - 1);
    }
    if (sum2 !== 0) {
      yw[dy * 4] /= sum2;
      yw[dy * 4 + 1] /= sum2;
      yw[dy * 4 + 2] /= sum2;
      yw[dy * 4 + 3] /= sum2;
    }
  }
  var rowLen = dw * 4;
  for (dy = 0; dy < dh; dy++) {
    var r0 = ys[dy * 4] * rowLen;
    var r1 = ys[dy * 4 + 1] * rowLen;
    var r2 = ys[dy * 4 + 2] * rowLen;
    var r3 = ys[dy * 4 + 3] * rowLen;
    var yy0 = yw[dy * 4];
    var yy1 = yw[dy * 4 + 1];
    var yy2 = yw[dy * 4 + 2];
    var yy3 = yw[dy * 4 + 3];
    var ob = dy * rowLen;
    for (var x4 = 0; x4 < rowLen; x4++) {
      out[ob + x4] = tmp[r0 + x4] * yy0 + tmp[r1 + x4] * yy1 + tmp[r2 + x4] * yy2 + tmp[r3 + x4] * yy3;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Edge-preserving denoise (separable bilateral approximation)         */
/* ------------------------------------------------------------------ */

function bilateralPass(src, dst, w, h, radius, lut, horizontal) {
  var n = w * h;
  var lum = new Uint8Array(n);
  for (var i = 0, p = 0; i < n; i++, p += 4) {
    lum[i] = (src[p] * 77 + src[p + 1] * 150 + src[p + 2] * 29) >> 8;
  }
  var k, j, wt, idx, lc, wsum, r, g, b, o;
  if (horizontal) {
    for (var y = 0; y < h; y++) {
      var row = y * w;
      for (var x = 0; x < w; x++) {
        idx = row + x;
        lc = lum[idx];
        wsum = 0;
        r = 0;
        g = 0;
        b = 0;
        for (k = -radius; k <= radius; k++) {
          var xx = x + k;
          if (xx < 0) xx = 0;
          else if (xx >= w) xx = w - 1;
          j = row + xx;
          var dl = lc - lum[j];
          wt = lut[dl < 0 ? -dl : dl];
          var q = j * 4;
          r += src[q] * wt;
          g += src[q + 1] * wt;
          b += src[q + 2] * wt;
          wsum += wt;
        }
        o = idx * 4;
        dst[o] = r / wsum;
        dst[o + 1] = g / wsum;
        dst[o + 2] = b / wsum;
        dst[o + 3] = src[o + 3];
      }
    }
  } else {
    for (var x2 = 0; x2 < w; x2++) {
      for (var y2 = 0; y2 < h; y2++) {
        idx = y2 * w + x2;
        lc = lum[idx];
        wsum = 0;
        r = 0;
        g = 0;
        b = 0;
        for (k = -radius; k <= radius; k++) {
          var yy = y2 + k;
          if (yy < 0) yy = 0;
          else if (yy >= h) yy = h - 1;
          j = yy * w + x2;
          var dl2 = lc - lum[j];
          wt = lut[dl2 < 0 ? -dl2 : dl2];
          var q2 = j * 4;
          r += src[q2] * wt;
          g += src[q2 + 1] * wt;
          b += src[q2 + 2] * wt;
          wsum += wt;
        }
        o = idx * 4;
        dst[o] = r / wsum;
        dst[o + 1] = g / wsum;
        dst[o + 2] = b / wsum;
        dst[o + 3] = src[o + 3];
      }
    }
  }
}

function denoise(data, w, h, strength) {
  var radius = strength < 30 ? 1 : strength < 70 ? 2 : 3;
  var sigma = 3 + strength * 0.37;
  var lut = new Float32Array(256);
  for (var d = 0; d < 256; d++) lut[d] = Math.exp(-(d * d) / (2 * sigma * sigma));
  var tmp = new Uint8ClampedArray(data.length);
  bilateralPass(data, tmp, w, h, radius, lut, true);
  var out = new Uint8ClampedArray(data.length);
  bilateralPass(tmp, out, w, h, radius, lut, false);
  return out;
}

/* ------------------------------------------------------------------ */
/* Gaussian-ish blur (for unsharp mask)                                */
/* ------------------------------------------------------------------ */

function blur1(src, dst, w, h, horizontal) {
  var x, y, k, o;
  if (horizontal) {
    for (y = 0; y < h; y++) {
      var row = y * w * 4;
      for (x = 0; x < w; x++) {
        var xa = (x > 0 ? x - 1 : 0) * 4 + row;
        var xb = x * 4 + row;
        var xc = (x < w - 1 ? x + 1 : w - 1) * 4 + row;
        o = xb;
        for (k = 0; k < 4; k++) dst[o + k] = (src[xa + k] + 2 * src[xb + k] + src[xc + k]) / 4;
      }
    }
  } else {
    var rl = w * 4;
    for (y = 0; y < h; y++) {
      var ya = (y > 0 ? y - 1 : 0) * rl;
      var yb = y * rl;
      var yc = (y < h - 1 ? y + 1 : h - 1) * rl;
      for (x = 0; x < w; x++) {
        var xo = x * 4;
        o = yb + xo;
        for (k = 0; k < 4; k++) dst[o + k] = (src[ya + xo + k] + 2 * src[yb + xo + k] + src[yc + xo + k]) / 4;
      }
    }
  }
}

function blur2x(data, w, h) {
  var t1 = new Uint8ClampedArray(data.length);
  var t2 = new Uint8ClampedArray(data.length);
  blur1(data, t1, w, h, true);
  blur1(t1, t2, w, h, false);
  blur1(t2, t1, w, h, true);
  blur1(t1, t2, w, h, false);
  return t2;
}

function unsharpMask(data, w, h, amount) {
  var blur = blur2x(data, w, h);
  var threshold = 2;
  for (var i = 0; i < data.length; i += 4) {
    for (var k = 0; k < 3; k++) {
      var diff = data[i + k] - blur[i + k];
      var ad = diff < 0 ? -diff : diff;
      if (ad > threshold) data[i + k] = data[i + k] + amount * diff;
    }
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Auto levels (gentle per-channel histogram stretch)                  */
/* ------------------------------------------------------------------ */

function autoLevels(data) {
  var h0 = new Uint32Array(256);
  var h1 = new Uint32Array(256);
  var h2 = new Uint32Array(256);
  for (var i = 0; i < data.length; i += 4) {
    h0[data[i]]++;
    h1[data[i + 1]]++;
    h2[data[i + 2]]++;
  }
  var total = data.length / 4;
  var clip = Math.max(1, Math.floor(total * 0.004));
  var luts = [];
  var hists = [h0, h1, h2];
  for (var c = 0; c < 3; c++) {
    var hist = hists[c];
    var acc = 0;
    var low = 0;
    var high = 255;
    for (var v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc > clip) {
        low = v;
        break;
      }
    }
    acc = 0;
    for (v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc > clip) {
        high = v;
        break;
      }
    }
    var lut = new Uint8ClampedArray(256);
    var range = high - low;
    if (range < 16 || range > 250) {
      for (v = 0; v < 256; v++) lut[v] = v;
    } else {
      for (v = 0; v < 256; v++) lut[v] = ((v - low) * 255) / range;
    }
    luts.push(lut);
  }
  for (i = 0; i < data.length; i += 4) {
    var r = data[i];
    var g = data[i + 1];
    var b = data[i + 2];
    data[i] = r * 0.15 + luts[0][r] * 0.85;
    data[i + 1] = g * 0.15 + luts[1][g] * 0.85;
    data[i + 2] = b * 0.15 + luts[2][b] * 0.85;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Brightness / contrast / saturation / temperature / tint             */
/* ------------------------------------------------------------------ */

function applyColor(data, brightness, contrast, saturation, temperature, tint) {
  var f = (100 + contrast) / 100;
  var b = brightness * 1.28;
  // temperature: + = warmer (more red, less blue); tint: + = magenta (less green)
  var kt = temperature / 50;
  var kn = tint / 50;
  var gainR = 1 + 0.25 * kt + 0.1 * kn;
  var gainG = 1 - 0.22 * kn;
  var gainB = 1 - 0.25 * kt + 0.1 * kn;
  var lutR = new Uint8ClampedArray(256);
  var lutG = new Uint8ClampedArray(256);
  var lutB = new Uint8ClampedArray(256);
  for (var v = 0; v < 256; v++) {
    var base = (v - 128) * f + 128 + b;
    lutR[v] = base * gainR;
    lutG[v] = base * gainG;
    lutB[v] = base * gainB;
  }
  var s = 1 + saturation / 100;
  var doSat = saturation !== 0;
  for (var i = 0; i < data.length; i += 4) {
    var r = lutR[data[i]];
    var g = lutG[data[i + 1]];
    var bl = lutB[data[i + 2]];
    if (doSat) {
      var gray = r * 0.299 + g * 0.587 + bl * 0.114;
      r = gray + (r - gray) * s;
      g = gray + (g - gray) * s;
      bl = gray + (bl - gray) * s;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = bl;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Clarity: local contrast via large-radius unsharp mask               */
/* ------------------------------------------------------------------ */

function boxPass(src, dst, w, h, r, horizontal) {
  var win = 2 * r + 1;
  var x, y, k;
  if (horizontal) {
    var rl = w * 4;
    for (y = 0; y < h; y++) {
      var row = y * rl;
      var sR = 0, sG = 0, sB = 0, sA = 0;
      for (k = -r; k <= r; k++) {
        var qi = clampIdx(k, w - 1) * 4 + row;
        sR += src[qi]; sG += src[qi + 1]; sB += src[qi + 2]; sA += src[qi + 3];
      }
      for (x = 0; x < w; x++) {
        var o = row + x * 4;
        dst[o] = sR / win; dst[o + 1] = sG / win; dst[o + 2] = sB / win; dst[o + 3] = sA / win;
        var addI = clampIdx(x + r + 1, w - 1) * 4 + row;
        var remI = clampIdx(x - r, w - 1) * 4 + row;
        sR += src[addI] - src[remI];
        sG += src[addI + 1] - src[remI + 1];
        sB += src[addI + 2] - src[remI + 2];
        sA += src[addI + 3] - src[remI + 3];
      }
    }
  } else {
    for (x = 0; x < w; x++) {
      var xo = x * 4;
      var sR2 = 0, sG2 = 0, sB2 = 0, sA2 = 0;
      for (k = -r; k <= r; k++) {
        var qi2 = clampIdx(k, h - 1) * w * 4 + xo;
        sR2 += src[qi2]; sG2 += src[qi2 + 1]; sB2 += src[qi2 + 2]; sA2 += src[qi2 + 3];
      }
      for (y = 0; y < h; y++) {
        var o2 = y * w * 4 + xo;
        dst[o2] = sR2 / win; dst[o2 + 1] = sG2 / win; dst[o2 + 2] = sB2 / win; dst[o2 + 3] = sA2 / win;
        var addI2 = clampIdx(y + r + 1, h - 1) * w * 4 + xo;
        var remI2 = clampIdx(y - r, h - 1) * w * 4 + xo;
        sR2 += src[addI2] - src[remI2];
        sG2 += src[addI2 + 1] - src[remI2 + 1];
        sB2 += src[addI2 + 2] - src[remI2 + 2];
        sA2 += src[addI2 + 3] - src[remI2 + 3];
      }
    }
  }
}

function applyClarity(data, w, h, amount) {
  var radius = Math.max(3, Math.round(Math.min(w, h) / 80));
  var t1 = new Uint8ClampedArray(data.length);
  var t2 = new Uint8ClampedArray(data.length);
  boxPass(data, t1, w, h, radius, true);
  boxPass(t1, t2, w, h, radius, false);
  boxPass(t2, t1, w, h, radius, true);
  boxPass(t1, t2, w, h, radius, false);
  for (var i = 0; i < data.length; i += 4) {
    data[i] = data[i] + amount * (data[i] - t2[i]);
    data[i + 1] = data[i + 1] + amount * (data[i + 1] - t2[i + 1]);
    data[i + 2] = data[i + 2] + amount * (data[i + 2] - t2[i + 2]);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Image analysis for "Scan & Auto-tune"                               */
/* ------------------------------------------------------------------ */

function analyzeImage(input) {
  var data = input.data;
  var w = input.width;
  var h = input.height;
  var n = w * h;
  var lum = new Uint8Array(n);
  var hist = new Uint32Array(256);
  var sumR = 0, sumG = 0, sumB = 0, satSum = 0, satCount = 0;
  for (var i = 0, p = 0; i < n; i++, p += 4) {
    var r = data[p];
    var g = data[p + 1];
    var b = data[p + 2];
    var L = (r * 77 + g * 150 + b * 29) >> 8;
    lum[i] = L;
    hist[L]++;
    sumR += r; sumG += g; sumB += b;
    var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (mx > 0) {
      satSum += (mx - mn) / mx;
      satCount++;
    }
  }
  var clip = n * 0.01;
  var acc = 0, p1 = 0, p99 = 255, v;
  for (v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc > clip) { p1 = v; break; }
  }
  acc = 0;
  for (v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > clip) { p99 = v; break; }
  }
  // Laplacian sample: variance = blur metric, median abs deviation = noise metric
  var samples = [];
  var lapVarAcc = 0, lapVarCount = 0;
  var step = 2;
  for (var y = step; y < h - step; y += step) {
    for (var x = step; x < w - step; x += step) {
      var idx = y * w + x;
      var lap = 4 * lum[idx] - lum[idx - 1] - lum[idx + 1] - lum[idx - w] - lum[idx + w];
      lapVarAcc += lap * lap;
      lapVarCount++;
      samples.push(lap < 0 ? -lap : lap);
    }
  }
  var med = 0, mad = 0;
  if (samples.length) {
    samples.sort(function (a, b) { return a - b; });
    med = samples[samples.length >> 1];
    var dev = [];
    for (i = 0; i < samples.length; i += 3) dev.push(Math.abs(samples[i] - med));
    dev.sort(function (a, b) { return a - b; });
    mad = dev[dev.length >> 1];
  }
  return {
    meanLum: (sumR * 0.299 + sumG * 0.587 + sumB * 0.114) / n,
    p1: p1,
    p99: p99,
    lapVar: lapVarCount ? lapVarAcc / lapVarCount : 0,
    noise: mad,
    satMean: satCount ? satSum / satCount : 0,
    avgR: sumR / n,
    avgG: sumG / n,
    avgB: sumB / n,
  };
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

function enhancePipeline(input, settings, report) {
  var data = input.data;
  var w = input.width;
  var h = input.height;
  var st = settings;
  if (st.denoise > 0) {
    report('denoise');
    data = denoise(data, w, h, st.denoise);
  }
  if (st.autoLevels) {
    report('autolevels');
    data = autoLevels(data);
  }
  if (st.brightness !== 0 || st.contrast !== 0 || st.saturation !== 0 || st.temperature !== 0 || st.tint !== 0) {
    report('color');
    data = applyColor(data, st.brightness, st.contrast, st.saturation, st.temperature || 0, st.tint || 0);
  }
  if (st.clarity > 0) {
    report('clarity');
    data = applyClarity(data, w, h, (st.clarity / 100) * 0.65);
  }
  if (st.scale > 1) {
    var dw = Math.round(w * st.scale);
    var dh = Math.round(h * st.scale);
    if (dw * dh > MAX_OUTPUT_PIXELS) {
      var err = new Error('Output would exceed 25 megapixels. Choose a lower upscale factor for this image.');
      err.code = 'OUTPUT_TOO_LARGE';
      throw err;
    }
    report('upscale');
    data = resampleBicubic(data, w, h, dw, dh);
    w = dw;
    h = dh;
  }
  if (st.sharpen > 0) {
    report('sharpen');
    data = unsharpMask(data, w, h, (st.sharpen / 100) * 1.6);
  }
  return { data: data, width: w, height: h };
}

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg) return;
  if (msg.type === 'analyze') {
    try {
      var metrics = analyzeImage(msg.image);
      self.postMessage({ type: 'analyzed', id: msg.id, metrics: metrics });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: (err && err.message) || String(err) });
    }
    return;
  }
  if (msg.type !== 'enhance') return;
  var t0 = Date.now();
  try {
    var out = enhancePipeline(msg.image, msg.settings, function (stage) {
      self.postMessage({ type: 'progress', id: msg.id, stage: stage });
    });
    self.postMessage(
      { type: 'done', id: msg.id, width: out.width, height: out.height, data: out.data.buffer, ms: Date.now() - t0 },
      [out.data.buffer]
    );
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      code: err && err.code,
      message: (err && err.message) || String(err),
    });
  }
};
