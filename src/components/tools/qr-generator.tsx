"use client";

/**
 * QR Generator — static QR codes for links/text, Wi-Fi, contact cards and
 * e-mail, with an optional logo baked into the middle (error correction
 * rises to High so the code still scans). Everything is drawn on the
 * device; the `qrcode` library does the encoding, a canvas does the logo.
 */

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, ImageDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob, imageErrorMessage, loadImageFile } from "./image-utils";
import {
  buildEmailPayload,
  buildVCardPayload,
  buildWifiPayload,
  contrastVerdict,
} from "@/lib/qr-payloads";

const SIZES = [
  { value: "256", label: "256 × 256 — web" },
  { value: "512", label: "512 × 512 — standard" },
  { value: "1024", label: "1024 × 1024 — print" },
];

const ECC = [
  { value: "L", label: "Low — 7% (densest)" },
  { value: "M", label: "Medium — 15% (recommended)" },
  { value: "Q", label: "Quartile — 25%" },
  { value: "H", label: "High — 30% (most robust)" },
];

const MODES = [
  { value: "link", label: "Link or text" },
  { value: "wifi", label: "Wi-Fi network" },
  { value: "vcard", label: "Contact card (vCard)" },
  { value: "email", label: "E-mail" },
] as const;

type QrMode = (typeof MODES)[number]["value"];

/** rounded rect helper (ctx.roundRect is missing on older browsers) */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function QrGenerator() {
  const [mode, setMode] = useState<QrMode>("link");
  const [text, setText] = useState("https://freeseak.com");
  const [size, setSize] = useState("512");
  const [ecc, setEcc] = useState("M");
  const [darkColor, setDarkColor] = useState("#173B70");
  const [lightColor, setLightColor] = useState("#FFFFFF");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  /* Wi-Fi fields */
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiEncryption, setWifiEncryption] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = useState("no");

  /* vCard fields */
  const [vcName, setVcName] = useState("");
  const [vcOrg, setVcOrg] = useState("");
  const [vcTitle, setVcTitle] = useState("");
  const [vcPhone, setVcPhone] = useState("");
  const [vcEmail, setVcEmail] = useState("");
  const [vcSite, setVcSite] = useState("");

  /* e-mail fields */
  const [emTo, setEmTo] = useState("");
  const [emSubject, setEmSubject] = useState("");
  const [emBody, setEmBody] = useState("");

  /* logo */
  const [logo, setLogo] = useState<{
    source: CanvasImageSource;
    width: number;
    height: number;
    name: string;
  } | null>(null);

  /* what gets encoded, per mode — empty when the mode's key field is missing */
  const payload = useMemo(() => {
    if (mode === "link") return text.trim();
    if (mode === "wifi") {
      if (!wifiSsid.trim()) return "";
      return buildWifiPayload({
        ssid: wifiSsid.trim(),
        password: wifiPassword,
        encryption: wifiEncryption,
        hidden: wifiHidden === "yes",
      });
    }
    if (mode === "vcard") {
      if (!vcName.trim()) return "";
      return buildVCardPayload({
        fullName: vcName,
        org: vcOrg,
        title: vcTitle,
        phone: vcPhone,
        email: vcEmail,
        website: vcSite,
      });
    }
    if (!emTo.trim()) return "";
    return buildEmailPayload({ to: emTo, subject: emSubject, body: emBody });
  }, [
    mode, text, wifiSsid, wifiPassword, wifiEncryption, wifiHidden,
    vcName, vcOrg, vcTitle, vcPhone, vcEmail, vcSite,
    emTo, emSubject, emBody,
  ]);

  /* a logo eats module area — error correction must be High so it still scans */
  const effectiveEcc = logo ? "H" : ecc;

  const options = useMemo(
    () => ({
      margin: 2,
      errorCorrectionLevel: effectiveEcc as "L" | "M" | "Q" | "H",
      color: { dark: darkColor, light: lightColor },
    }),
    [effectiveEcc, darkColor, lightColor],
  );

  const emptyHint =
    mode === "wifi"
      ? "Type the Wi-Fi name and the code appears here — phones will offer to join the network."
      : mode === "vcard"
        ? "Fill in at least the name and the code appears here — phones will offer to save the contact."
        : mode === "email"
          ? "Type the e-mail address and the code appears here — phones will open a new message."
          : "Type something above and your QR code appears here instantly.";

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!payload) {
        if (!cancelled) {
          setDataUrl("");
          setError("");
        }
        return;
      }
      try {
        const sizePx = parseInt(size, 10);
        const base = await QRCode.toDataURL(payload, {
          width: sizePx,
          ...options,
        });
        if (!logo) {
          if (!cancelled) {
            setDataUrl(base);
            setError("");
          }
          return;
        }
        /* composite the logo onto a white patch in the middle */
        const canvas = document.createElement("canvas");
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no-canvas");
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("qr-image"));
          img.src = base;
        });
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        const patch = Math.round(sizePx * 0.26);
        const pad = (sizePx - patch) / 2;
        ctx.fillStyle = lightColor;
        roundRect(ctx, pad, pad, patch, patch, patch * 0.18);
        ctx.fill();
        const inner = patch * 0.74;
        const scale = Math.min(inner / logo.width, inner / logo.height);
        const w = logo.width * scale;
        const h = logo.height * scale;
        ctx.drawImage(logo.source, (sizePx - w) / 2, (sizePx - h) / 2, w, h);
        if (!cancelled) {
          setDataUrl(canvas.toDataURL("image/png"));
          setError("");
        }
      } catch {
        if (!cancelled) {
          setDataUrl("");
          setError(
            "That content is too long for a QR code — shorten the text or turn the error correction down.",
          );
        }
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payload, size, options, logo, lightColor]);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { img, width, height } = await loadImageFile(file);
      setLogo({ source: img, width, height, name: file.name });
    } catch (err) {
      toast.error(imageErrorMessage(err));
    }
  };

  const download = (blob: Blob, filename: string) => {
    /* shared helper — keeps the brand marker on every FreeSeak file */
    downloadBlob(blob, filename);
    toast.success("Your QR code is ready", {
      description: "Generated on your device — it never left your browser.",
    });
  };

  const downloadPng = async () => {
    if (!dataUrl) return;
    try {
      download(await (await fetch(dataUrl)).blob(), "freeseak-qr-code.png");
    } catch {
      setError("Could not save the PNG — try again.");
    }
  };

  const downloadSvg = async () => {
    if (!payload) return;
    try {
      const svg = await QRCode.toString(payload, { type: "svg", ...options });
      download(new Blob([svg], { type: "image/svg+xml" }), "freeseak-qr-code.svg");
    } catch {
      setError("Could not create the SVG — try again.");
    }
  };

  const verdict = useMemo(
    () => contrastVerdict(darkColor, lightColor),
    [darkColor, lightColor],
  );

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_1.1fr]">
      {/* preview */}
      <div className="flex flex-col gap-2.5">
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-border bg-card p-4">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR code preview"
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl border-[1.6px] border-dashed border-border text-center">
              <p className="px-6 text-[13px] font-medium text-muted-foreground">
                {error ? error : emptyHint}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2.5">
          <Button
            type="button"
            onClick={downloadPng}
            disabled={!dataUrl}
            className="flex-1"
          >
            <Download className="size-4" aria-hidden="true" />
            PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={downloadSvg}
            disabled={!payload || !!error}
            className="flex-1"
          >
            <ImageDown className="size-4" aria-hidden="true" />
            SVG
          </Button>
        </div>
        {logo && (
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            The SVG export draws the code only — a code with a logo needs the
            PNG download.
          </p>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qr-mode">QR type</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as QrMode)}>
            <SelectTrigger id="qr-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "link" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-text">Link or text</Label>
            <Textarea
              id="qr-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://your-link.com or any text"
              rows={3}
              className="resize-none"
            />
          </div>
        )}

        {mode === "wifi" && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-wifi-ssid">Network name (SSID)</Label>
              <Input
                id="qr-wifi-ssid"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="e.g. HomeNet"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qr-wifi-enc">Security</Label>
                <Select
                  value={wifiEncryption}
                  onValueChange={(v) =>
                    setWifiEncryption(v as "WPA" | "WEP" | "nopass")
                  }
                >
                  <SelectTrigger id="qr-wifi-enc" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                    <SelectItem value="WEP">WEP (old routers)</SelectItem>
                    <SelectItem value="nopass">Open — no password</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qr-wifi-hidden">Hidden network?</Label>
                <Select value={wifiHidden} onValueChange={setWifiHidden}>
                  <SelectTrigger id="qr-wifi-hidden" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No — visible</SelectItem>
                    <SelectItem value="yes">Yes — hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {wifiEncryption !== "nopass" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qr-wifi-pass">Wi-Fi password</Label>
                <Input
                  id="qr-wifi-pass"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="The network password"
                  autoComplete="off"
                />
              </div>
            )}
          </>
        )}

        {mode === "vcard" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-name">Full name</Label>
              <Input
                id="qr-vc-name"
                value={vcName}
                onChange={(e) => setVcName(e.target.value)}
                placeholder="e.g. Ahmed Raza"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-org">Company</Label>
              <Input
                id="qr-vc-org"
                value={vcOrg}
                onChange={(e) => setVcOrg(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-title">Job title</Label>
              <Input
                id="qr-vc-title"
                value={vcTitle}
                onChange={(e) => setVcTitle(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-phone">Phone</Label>
              <Input
                id="qr-vc-phone"
                value={vcPhone}
                onChange={(e) => setVcPhone(e.target.value)}
                placeholder="+92 300 1234567"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-email">E-mail</Label>
              <Input
                id="qr-vc-email"
                value={vcEmail}
                onChange={(e) => setVcEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="qr-vc-site">Website</Label>
              <Input
                id="qr-vc-site"
                value={vcSite}
                onChange={(e) => setVcSite(e.target.value)}
                placeholder="https://…"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {mode === "email" && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-em-to">To</Label>
              <Input
                id="qr-em-to"
                value={emTo}
                onChange={(e) => setEmTo(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-em-subject">Subject</Label>
              <Input
                id="qr-em-subject"
                value={emSubject}
                onChange={(e) => setEmSubject(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qr-em-body">Message</Label>
              <Textarea
                id="qr-em-body"
                value={emBody}
                onChange={(e) => setEmBody(e.target.value)}
                placeholder="Optional"
                rows={2}
                className="resize-none"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-size">Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger id="qr-size" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-ecc">Error correction</Label>
            <Select
              value={effectiveEcc}
              onValueChange={setEcc}
              disabled={!!logo}
            >
              <SelectTrigger id="qr-ecc" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ECC.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-dark">Code colour</Label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1.5">
              <input
                id="qr-dark"
                type="color"
                value={darkColor}
                onChange={(e) => setDarkColor(e.target.value)}
                className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                aria-label="QR code colour"
              />
              <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                {darkColor}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-light">Background</Label>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1.5">
              <input
                id="qr-light"
                type="color"
                value={lightColor}
                onChange={(e) => setLightColor(e.target.value)}
                className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                aria-label="QR background colour"
              />
              <span className="font-mono text-[12.5px] uppercase text-muted-foreground">
                {lightColor}
              </span>
            </div>
          </div>
        </div>

        {verdict.level !== "ok" && (
          <p
            className={`text-[12.5px] font-medium leading-relaxed ${
              verdict.level === "stop" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {verdict.message}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qr-logo">Logo in the middle (optional)</Label>
          {logo ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1.5">
              <span className="truncate text-[12.5px] text-foreground">
                {logo.name} · error correction raised to High
              </span>
              <button
                type="button"
                onClick={() => setLogo(null)}
                aria-label="Remove the logo"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Input
              id="qr-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={(e) => void pickLogo(e.target.files?.[0])}
              className="text-[12.5px] text-muted-foreground"
            />
          )}
        </div>

        <p className="mt-auto text-[12px] leading-relaxed text-muted-foreground">
          Tip: keep the code colour darker than the background — scanners read
          that far more reliably. Wi-Fi, contact and e-mail codes open the
          matching action on the phone instead of showing raw text.
        </p>
      </div>
    </div>
  );
}
