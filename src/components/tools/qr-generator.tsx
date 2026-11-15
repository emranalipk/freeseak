"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "./image-utils";

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

export function QrGenerator() {
  const [text, setText] = useState("https://freeseak.com");
  const [size, setSize] = useState("512");
  const [ecc, setEcc] = useState("M");
  const [darkColor, setDarkColor] = useState("#173B70");
  const [lightColor, setLightColor] = useState("#FFFFFF");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  const options = useMemo(
    () => ({
      margin: 2,
      errorCorrectionLevel: ecc as "L" | "M" | "Q" | "H",
      color: { dark: darkColor, light: lightColor },
    }),
    [ecc, darkColor, lightColor],
  );

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const trimmed = text.trim();
      if (!trimmed) {
        if (!cancelled) {
          setDataUrl("");
          setError("");
        }
        return;
      }
      try {
        const url = await QRCode.toDataURL(trimmed, {
          width: parseInt(size, 10),
          ...options,
        });
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setDataUrl("");
          setError("That text is too long for a QR code — try a shorter link.");
        }
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, size, options]);

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
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const svg = await QRCode.toString(trimmed, { type: "svg", ...options });
      download(new Blob([svg], { type: "image/svg+xml" }), "freeseak-qr-code.svg");
    } catch {
      setError("Could not create the SVG — try again.");
    }
  };

  const lowContrast =
    darkColor.toLowerCase() === lightColor.toLowerCase() ||
    (darkColor === "#00000000" && lightColor === "#00000000");

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
                {error
                  ? error
                  : "Type something above and your QR code appears here instantly."}
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
            disabled={!text.trim() || !!error}
            className="flex-1"
          >
            <ImageDown className="size-4" aria-hidden="true" />
            SVG
          </Button>
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-col gap-4">
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
            <Select value={ecc} onValueChange={setEcc}>
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

        {lowContrast && (
          <p className="text-[12.5px] font-medium text-destructive">
            The code and background colours are the same — scanners won’t read
            that. Pick two different colours.
          </p>
        )}

        <p className="mt-auto text-[12px] leading-relaxed text-muted-foreground">
          Tip: keep the code colour darker than the background — scanners read
          that far more reliably.
        </p>
      </div>
    </div>
  );
}
