"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Download, Globe, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageDropZone } from "./image-drop";
import {
  downloadBlob,
  encodeImage,
  formatBytes,
  imageErrorMessage,
  loadImageFile,
  loadJsZip,
} from "./image-utils";

/**
 * FreeSeak — Favicon Generator (v1.0.0).
 *
 * Turns one image into a complete modern icon pack (favicon.ico with
 * 16/32/48 built as a real multi-size ICO, PNGs for browsers and touch
 * devices, maskable Android icons, an SVG favicon, a Windows tile config,
 * a web manifest and a copy-paste HTML snippet) — one branded .zip, built
 * entirely in the browser.
 */

/** every raster the pack ships, and what each is for */
const PNG_SIZES = [
  { size: 16, file: "favicon-16x16.png", kind: "plain" },
  { size: 32, file: "favicon-32x32.png", kind: "plain" },
  { size: 48, file: "favicon-48x48.png", kind: "plain" },
  { size: 96, file: "favicon-96x96.png", kind: "plain" },
  { size: 150, file: "mstile-150x150.png", kind: "plain" },
  { size: 180, file: "apple-touch-icon.png", kind: "apple" },
  { size: 192, file: "android-chrome-192x192.png", kind: "plain" },
  { size: 512, file: "android-chrome-512x512.png", kind: "plain" },
  { size: 192, file: "android-chrome-maskable-192x192.png", kind: "maskable" },
  { size: 512, file: "android-chrome-maskable-512x512.png", kind: "maskable" },
] as const;

/** the .ico bundles these three (PNG-in-ICO, valid since Vista) */
const ICO_SIZES = [16, 32, 48] as const;

/** the <head> snippet — theme colour tracks the tile background colour */
function buildSnippet(themeColor: string): string {
  return `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${themeColor}">
<meta name="msapplication-config" content="/browserconfig.xml">`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(blob);
  });
}

/** maskable icon: the logo shrunk into the safe zone (central ~80% circle),
 * flattened onto the tile background so any launcher can crop it freely */
function drawMaskable(
  img: HTMLImageElement,
  size: number,
  bg: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const inner = size * 0.7; /* logo fits inside the safe zone with margin */
  const scale = Math.min(inner / img.width, inner / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode-failed"))),
      "image/png",
    ),
  );
}

/** concatenate PNGs into a multi-size .ico (PNG-in-ICO binary format) */
async function buildIco(
  pngs: { size: number; blob: Blob }[],
): Promise<Blob> {
  const buffers = await Promise.all(
    pngs.map(async (p) => new Uint8Array(await p.blob.arrayBuffer())),
  );
  const headerBytes = 6;
  const entryBytes = 16;
  let offset = headerBytes + entryBytes * pngs.length;
  const total = offset + buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); /* reserved */
  view.setUint16(2, 1, true); /* 1 = icon */
  view.setUint16(4, pngs.length, true);
  pngs.forEach((p, i) => {
    const e = headerBytes + entryBytes * i;
    out[e] = p.size >= 256 ? 0 : p.size;
    out[e + 1] = p.size >= 256 ? 0 : p.size;
    out[e + 2] = 0; /* colour count */
    out[e + 3] = 0; /* reserved */
    view.setUint16(e + 4, 1, true); /* colour planes */
    view.setUint16(e + 6, 32, true); /* bits per pixel */
    view.setUint32(e + 8, buffers[i].length, true);
    view.setUint32(e + 12, offset, true);
    out.set(buffers[i], offset);
    offset += buffers[i].length;
  });
  return new Blob([out], { type: "image/x-icon" });
}

interface Pack {
  ico: Blob;
  svg: Blob;
  browserconfig: Blob;
  pngs: { size: number; file: string; kind: string; blob: Blob; url: string }[];
  totalBytes: number;
  note?: string;
}

export function FaviconGenerator() {
  const [loaded, setLoaded] = useState<{
    file: File;
    img: HTMLImageElement;
    width: number;
    height: number;
    url: string;
  } | null>(null);
  const [siteName, setSiteName] = useState("");
  const [touchBg, setTouchBg] = useState("#FFFFFF");
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const urlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const addFile = useCallback(async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) {
      toast.error("That file isn't an image", {
        description: "Use a square PNG for the sharpest results — other images are centre-cropped.",
      });
      return;
    }
    try {
      const res = await loadImageFile(file);
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      setLoaded({ file, img: res.img, width: res.width, height: res.height, url });
      setPack(null);
    } catch (err) {
      toast.error(`Couldn't read “${file.name}”`, {
        description: imageErrorMessage(err),
      });
    }
  }, []);

  const generate = useCallback(async () => {
    if (!loaded || busy) return;
    setBusy(true);
    try {
      const pngs: Pack["pngs"] = [];
      let svg: Blob | null = null;
      for (const { size, file, kind } of PNG_SIZES) {
        if (kind === "maskable") {
          const blob = await drawMaskable(loaded.img, size, touchBg);
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          pngs.push({ size, file, kind, blob, url });
          continue;
        }
        /* centre-crop to a square at each size (cover fit). The apple-touch
           icon is flattened: iOS composites transparent PNGs onto BLACK on
           home screens, so a transparent logo ships with an ugly black tile */
        const isAppleTouch = kind === "apple";
        const encoded = await encodeImage(loaded.img, {
          width: size,
          height: size,
          fit: "cover",
          mime: "image/png",
          quality: 1,
          ...(isAppleTouch ? { background: touchBg } : {}),
        });
        const url = URL.createObjectURL(encoded.blob);
        urlsRef.current.push(url);
        pngs.push({ size, file, kind, blob: encoded.blob, url });
        /* favicon.svg = the 32 px render inside an SVG shell — an honest
           raster-in-SVG for browsers that prefer SVG icons; swap in a real
           vector of your logo if you have one */
        if (file === "favicon-32x32.png") {
          const dataUrl = await blobToDataUrl(encoded.blob);
          svg = new Blob(
            [
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image width="32" height="32" href="${dataUrl}"/></svg>`,
            ],
            { type: "image/svg+xml" },
          );
        }
      }
      const ico = await buildIco(
        ICO_SIZES.map((size) => ({
          size,
          blob: pngs.find((p) => p.size === size)!.blob,
        })),
      );
      /* the 32 px render always happens (PNG_SIZES includes it) — this guard
         keeps TypeScript honest about it */
      if (!svg) throw new Error("encode-failed");
      const browserconfig = new Blob(
        [
          `<?xml version="1.0" encoding="utf-8"?><browserconfig><msapplication><tile><square150x150logo src="/mstile-150x150.png"/><TileColor>${touchBg}</TileColor></tile></msapplication></browserconfig>`,
        ],
        { type: "text/xml" },
      );
      const totalBytes =
        ico.size + svg.size + browserconfig.size +
        pngs.reduce((sum, p) => sum + p.blob.size, 0);
      const smallestSide = Math.min(loaded.width, loaded.height);
      setPack({
        ico,
        svg,
        browserconfig,
        pngs,
        totalBytes,
        note:
          smallestSide < 512
            ? `Your image is ${smallestSide} px on its short side — every icon larger than that (96 px and up) is upscaled and may look soft. A square image of at least 512 × 512 px gives the sharpest pack.`
            : undefined,
      });
      toast.success("Favicon pack ready", {
        description:
          "15 files: icons, SVG, maskable set, tile config, manifest, README — built on your device.",
      });
    } catch {
      toast.error("Couldn't build the pack", {
        description: "Try a different image — PNG with transparency works best.",
      });
    } finally {
      setBusy(false);
    }
  }, [loaded, busy, touchBg]);

  const download = useCallback(async () => {
    if (!pack || zipping) return;
    setZipping(true);
    try {
      const name = siteName.trim() || "My Site";
      const manifest = {
        name,
        short_name: name.length > 12 ? `${name.slice(0, 12).trim()}…` : name,
        start_url: "/",
        theme_color: touchBg,
        background_color: touchBg,
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/android-chrome-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/android-chrome-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      };
      const readme = `FreeSeak favicon pack — ${name}
==================================================

1. Copy ALL files in this zip into the root folder of your website
   (the same folder as your index.html).

2. Add these lines to the <head> of every page:

${buildSnippet(touchBg)}

3. Publish. Hard-refresh (Ctrl+F5 / Cmd+Shift+R) — browsers cache
   favicons aggressively.

Files in this pack
------------------
favicon.ico                 16 + 32 + 48 px, all browsers
favicon.svg                 SVG shell around the 32 px render — swap in a
                            real vector of your logo if you have one
favicon-16x16.png           modern browsers
favicon-32x32.png           modern browsers
favicon-48x48.png           desktop browsers
favicon-96x96.png           Google / Android shortcut size
apple-touch-icon.png        180 px — iOS home screen / bookmarks, flattened
                            onto the tile background colour
android-chrome-192x192.png  Android home screen
android-chrome-512x512.png  Android home screen (hi-dpi)
android-chrome-maskable-192x192.png  Android adaptive icon — logo shrunk
                            into the safe zone so any launcher shape crops
                            it without cutting the artwork
android-chrome-maskable-512x512.png  maskable, hi-dpi
mstile-150x150.png          Windows tile image
browserconfig.xml           points Windows at the tile + its colour
site.webmanifest            app name, brand colours + icon links

Notes
-----
• The snippet uses root-relative paths (/favicon.ico). If your site lives
  in a subfolder (github.io/site/ …), strip the leading slash — favicon.ico
  instead of /favicon.ico — or the icons will 404.
• theme-color in the snippet and the manifest is ${touchBg}. Change it if
  you rebrand later.

Generated with FreeSeak — free, private, browser-only tools.
https://freeseak.com
`;
      /* the zip's inner names are the conventional filenames the HTML
         snippet references — the brand rides on the .zip itself */
      const JSZip = await loadJsZip();
      const zip = new JSZip();
      zip.file("favicon.ico", pack.ico);
      zip.file("favicon.svg", pack.svg);
      zip.file("browserconfig.xml", pack.browserconfig);
      for (const p of pack.pngs) zip.file(p.file, p.blob);
      zip.file(
        "site.webmanifest",
        JSON.stringify(manifest, null, 2),
      );
      zip.file("README.txt", readme);
      const zipped = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipped, "freeseak-favicon-pack.zip");
      toast.success("Saved freeseak-favicon-pack.zip", {
        description: `${formatBytes(pack.totalBytes)} of icons + manifest + instructions.`,
      });
    } catch {
      toast.error("Couldn't build the zip — try again.");
    } finally {
      setZipping(false);
    }
  }, [pack, zipping, siteName]);

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildSnippet(touchBg));
      toast.success("HTML snippet copied", {
        description: "Paste it into the <head> of every page.",
      });
    } catch {
      toast.error("Couldn't copy — select the snippet and copy manually.");
    }
  }, [touchBg]);

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone onFiles={addFile} compact={!!loaded} />

      {loaded && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={loaded.url}
              alt="Your uploaded image, centre-cropped to a square"
              className="size-20 rounded-xl border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-foreground">
                {loaded.file.name}
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {loaded.width} × {loaded.height} px —{" "}
                {loaded.width === loaded.height
                  ? "already square"
                  : "centre-cropped to a square"}
              </p>
            </div>
            <div className="w-full max-w-64">
              <Label htmlFor="site-name">Site name (for the manifest)</Label>
              <Input
                id="site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="My Site"
                className="mt-1.5"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="touch-bg">Tile background colour</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1.5">
                <input
                  id="touch-bg"
                  type="color"
                  value={touchBg}
                  onChange={(e) => setTouchBg(e.target.value)}
                  className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  aria-label="Background colour for the apple-touch and maskable icons"
                />
                <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                  {touchBg}
                </span>
              </div>
              <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground">
                iOS fills transparent home-screen icons with black, and
                Android crops maskable icons to a shape — the apple-touch and
                maskable icons are flattened onto this colour to survive both.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setLoaded(null);
                setPack(null);
              }}
              className="gap-1.5 text-muted-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Start over
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={generate} disabled={busy} className="gap-1.5">
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Globe className="size-4" aria-hidden="true" />
              )}
              Generate favicon pack
            </Button>
            {pack && (
              <Button
                type="button"
                variant="outline"
                onClick={download}
                disabled={zipping}
                className="gap-1.5"
              >
                {zipping ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download freeseak-favicon-pack.zip
              </Button>
            )}
            {pack && (
              <p className="text-[12.5px] text-muted-foreground">
                <CheckCircle2
                  className="mr-1 inline size-3.5 text-mint-deep dark:text-mint"
                  aria-hidden="true"
                />
                favicon.ico (16+32+48) · 10 PNGs + favicon.svg · tile config ·
                manifest · README — {formatBytes(pack.totalBytes)}
              </p>
            )}
          </div>

          {pack?.note && (
            <p className="text-[12.5px] text-amber-600 dark:text-amber-400">
              {pack.note}
            </p>
          )}

          {pack && (
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* how the icons actually look at real sizes */}
              <div className="flex items-end gap-4 rounded-xl border border-border p-4">
                {[16, 32, 48].map((size) => {
                  const p = pack.pngs.find((x) => x.size === size)!;
                  return (
                    <div key={size} className="flex flex-col items-center gap-1.5">
                      <img src={p.url} alt={`${size} px favicon`} width={size} height={size} />
                      <span className="text-[10.5px] text-muted-foreground">{size} px</span>
                    </div>
                  );
                })}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
                    <img
                      src={pack.pngs.find((x) => x.size === 16)!.url}
                      alt=""
                      width={16}
                      height={16}
                    />
                    <span className="max-w-28 truncate text-[11px] text-muted-foreground">
                      {siteName.trim() || "My Site"}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-muted-foreground">tab preview</span>
                </div>
              </div>

              {/* the snippet to paste */}
              <div className="min-w-0 flex-1 rounded-xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <p className="text-[12.5px] font-medium text-muted-foreground">
                    Add to your &lt;head&gt;
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copySnippet}
                    className="gap-1.5"
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    Copy
                  </Button>
                </div>
                <pre className="overflow-x-auto p-3 text-[11.5px] leading-relaxed text-foreground">
                  <code>{buildSnippet(touchBg)}</code>
                </pre>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
