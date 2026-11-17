'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  FlipHorizontal,
  ImagePlus,
  Loader2,
  RotateCcw,
  RotateCw,
  ScanLine,
  Smile,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { downloadBlob } from '../image-utils';
import {
  EnhanceClient,
  FORMAT_META,
  MAX_FILE_BYTES,
  MAX_OUTPUT_PIXELS,
  PRESETS,
  PREVIEW_MAX_DIM,
  type EnhanceSettings,
  type OutputFormat,
  type PreparedImage,
  type PresetKey,
  type Scale,
  autoSettingsFromMetrics,
  flipImageData,
  formatBytes,
  imageDataToCanvas,
  imageDataToObjectUrl,
  prepareImage,
  rotateImageData,
  scaleImageData,
  toImageData,
} from '@/lib/enhance-image';
import { useHandoff } from '@/lib/file-handoff';
import { CompareSlider } from './compare-slider';

interface LoadedState {
  info: Omit<PreparedImage, 'fullData' | 'previewData'>;
  fullData: ImageData;
  previewData: ImageData;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const PRESET_LIST: Array<{ key: keyof typeof PRESETS; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'auto', label: 'Auto', icon: Sparkles },
  { key: 'photo', label: 'Photo', icon: Camera },
  { key: 'portrait', label: 'Portrait', icon: Smile },
  { key: 'text', label: 'Text & Scan', icon: ScanLine },
];

const SCALE_LIST: Array<{ value: Scale; label: string }> = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
];

const FORMAT_LIST: Array<{ value: OutputFormat; label: string }> = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

const STAGE_LABELS: Record<string, string> = {
  denoise: 'Reducing noise',
  autolevels: 'Balancing tones',
  color: 'Adjusting color',
  clarity: 'Enhancing clarity',
  upscale: 'Upscaling',
  sharpen: 'Sharpening details',
};

const STORAGE_KEY = 'freeseak.enhance.v1';

const ACCEPTED_TYPES = 'JPG · PNG · WebP · GIF · BMP · AVIF';

/* Shared button + pill classes (mirror the FreeSeak design system) */
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 flex-1 sm:flex-none';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 h-9 px-4 py-2 text-muted-foreground';
const PILL_ACTIVE =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition disabled:pointer-events-none disabled:opacity-50 border-navy bg-navy text-white dark:border-[#22477F] dark:bg-[#22477F]';
const PILL_IDLE =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition disabled:pointer-events-none disabled:opacity-50 border-border bg-card text-muted-foreground hover:border-primary hover:text-primary';
const GROUP_TITLE = 'text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground';
const RANGE_INPUT =
  'h-4 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-moz-range-thumb]:size-[14px] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-card';
const ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50';

function activeStages(st: EnhanceSettings): string[] {
  const stages: string[] = [];
  if (st.denoise > 0) stages.push('denoise');
  if (st.autoLevels) stages.push('autolevels');
  if (st.brightness !== 0 || st.contrast !== 0 || st.saturation !== 0 || st.temperature !== 0 || st.tint !== 0) stages.push('color');
  if (st.clarity > 0) stages.push('clarity');
  if (st.scale > 1) stages.push('upscale');
  if (st.sharpen > 0) stages.push('sharpen');
  return stages;
}

function signed(v: number) {
  return v > 0 ? `+${v}` : `${v}`;
}

function SliderRow({
  label,
  value,
  min,
  max,
  signedValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  signedValue?: boolean;
  onChange: (_v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
          {signedValue ? signed(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={RANGE_INPUT}
        aria-label={label}
      />
    </div>
  );
}

export function EnhanceTool() {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [settings, setSettings] = useState<EnhanceSettings>(PRESETS.auto);
  const [presetKey, setPresetKey] = useState<PresetKey>('auto');
  const [format, setFormat] = useState<OutputFormat>('jpeg');
  const [quality, setQuality] = useState(92);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [peek, setPeek] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const clientRef = useRef<EnhanceClient | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const afterUrlRef = useRef<string | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const presetKeyRef = useRef<PresetKey>('auto');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    presetKeyRef.current = presetKey;
  }, [presetKey]);

  const showNotice = useCallback((kind: 'ok' | 'error', text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ kind, text });
    if (kind === 'ok') {
      noticeTimer.current = setTimeout(() => setNotice(null), 6000);
    }
  }, []);

  const getClient = () => {
    if (!clientRef.current) clientRef.current = new EnhanceClient();
    return clientRef.current;
  };

  const revokeAfter = useCallback(() => {
    if (afterUrlRef.current) {
      URL.revokeObjectURL(afterUrlRef.current);
      afterUrlRef.current = null;
    }
  }, []);

  /* Restore last-used settings (stored only on this device).
     The read happens in a task, so the effect body itself stays
     render-safe — same pattern as the recent-tools chips. */
  useEffect(() => {
    const restore = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { settings?: Partial<EnhanceSettings>; format?: OutputFormat; quality?: number };
        if (saved.settings) {
          setSettings((s) => ({ ...s, ...saved.settings, scale: (saved.settings?.scale ?? s.scale) as Scale }));
          setPresetKey('custom');
        }
        if (saved.format && saved.format in FORMAT_META) setFormat(saved.format);
        if (typeof saved.quality === 'number') setQuality(saved.quality);
      } catch {
        // ignore corrupted storage
      }
    };
    const t = setTimeout(restore, 0);
    return () => clearTimeout(t);
  }, []);

  /* Persist settings on change */
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, format, quality }));
    } catch {
      // storage unavailable - not critical
    }
  }, [settings, format, quality]);

  const runPreview = useCallback(
    async (current: LoadedState, st: EnhanceSettings) => {
      const id = ++runIdRef.current;
      setBusy(true);
      try {
        const res = await getClient().run(
          { data: current.previewData.data, width: current.previewData.width, height: current.previewData.height },
          st
        );
        if (id !== runIdRef.current) return;
        const ctx = imageDataToCanvas(toImageData(res.data, res.width, res.height)).getContext('2d');
        if (!ctx) throw new Error('Canvas 2D is not available.');
        const canvas = ctx.canvas;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not encode the preview.');
        if (id !== runIdRef.current) return;
        revokeAfter();
        const url = URL.createObjectURL(blob);
        afterUrlRef.current = url;
        setAfterUrl(url);
      } catch (err) {
        if (id === runIdRef.current) {
          showNotice('error', `Preview failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      } finally {
        if (id === runIdRef.current) setBusy(false);
      }
    },
    [revokeAfter, showNotice]
  );

  /* Debounced preview re-run whenever the image or settings change */
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void runPreview(loaded, settings);
    }, 220);
    return () => clearTimeout(t);
  }, [loaded, settings, runPreview]);

  const loadFileRef = useRef<(_file: File) => Promise<void>>(async () => {});
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) void loadFileRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      runIdRef.current++;
      clientRef.current?.dispose();
      if (afterUrlRef.current) URL.revokeObjectURL(afterUrlRef.current);
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        showNotice('error', 'Unsupported file — please choose an image (JPG, PNG, WebP or similar).');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        showNotice('error', `That file is too large. Images up to ${formatBytes(MAX_FILE_BYTES)} are supported.`);
        return;
      }
      setLoadingFile(true);
      setNotice(null);
      try {
        const prep = await prepareImage(file);
        if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
        srcUrlRef.current = prep.srcUrl;
        revokeAfter();
        setAfterUrl(null);
        setPeek(false);
        const { fullData, previewData, ...info } = prep;
        setLoaded({ info, fullData, previewData });
        // Fresh "Auto" state gets a one-click analysis pass; user-tuned settings are kept.
        void getClient()
          .analyze({ data: previewData.data, width: previewData.width, height: previewData.height })
          .then((m) => {
            if (presetKeyRef.current === 'auto') {
              setSettings((s) => ({ ...s, ...autoSettingsFromMetrics(m) }));
            }
          })
          .catch(() => {});
        showNotice(
          'ok',
          `Image ready — ${prep.origW} × ${prep.origH} px · ${formatBytes(prep.fileBytes)} · processed on your device` +
            (prep.downscaled
              ? ` · over the 16 MP processing cap, so the base size is reduced to ${prep.fullData.width} × ${prep.fullData.height}`
              : ''),
        );
      } catch (err) {
        showNotice('error', `Could not read this image: ${err instanceof Error ? err.message : 'unknown error'}`);
      } finally {
        setLoadingFile(false);
      }
    },
    [revokeAfter, showNotice]
  );

  /* Keep the paste handler's ref current without touching refs during render */
  useEffect(() => {
    loadFileRef.current = loadFile;
  }, [loadFile]);

  /* v0.9.3: an image handed over from the homepage router opens here
     automatically — the visitor drops once, never twice */
  useHandoff((f) => {
    void loadFileRef.current(f);
  });

  const handleAutoTune = async () => {
    if (!loaded) return;
    setAnalyzing(true);
    try {
      const m = await getClient().analyze({
        data: loaded.previewData.data,
        width: loaded.previewData.width,
        height: loaded.previewData.height,
      });
      const auto = autoSettingsFromMetrics(m);
      setSettings((s) => ({ ...s, ...auto, scale: s.scale }));
      setPresetKey('custom');
      showNotice('ok', 'Auto-tuned for this image — analyzed noise, sharpness, exposure, saturation and color cast.');
    } catch (err) {
      showNotice('error', `Analysis failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyPreset = (key: keyof typeof PRESETS) => {
    setSettings((s) => ({ ...PRESETS[key], scale: s.scale }));
    setPresetKey(key);
  };

  const update = (patch: Partial<EnhanceSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setPresetKey('custom');
  };

  const transform = async (kind: 'rotate-left' | 'rotate-right' | 'flip') => {
    const current = loaded;
    if (!current) return;
    try {
      let full: ImageData;
      if (kind === 'flip') full = flipImageData(current.fullData);
      else full = rotateImageData(current.fullData, kind === 'rotate-right' ? 1 : -1);
      const preview = scaleImageData(full, PREVIEW_MAX_DIM);
      if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
      const url = await imageDataToObjectUrl(full);
      srcUrlRef.current = url;
      setLoaded({
        info: { ...current.info, srcUrl: url, origW: full.width, origH: full.height },
        fullData: full,
        previewData: preview,
      });
    } catch (err) {
      showNotice('error', `Transformation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const removeImage = () => {
    runIdRef.current++;
    if (srcUrlRef.current) {
      URL.revokeObjectURL(srcUrlRef.current);
      srcUrlRef.current = null;
    }
    revokeAfter();
    setLoaded(null);
    setAfterUrl(null);
    setPeek(false);
    setSettings(PRESETS.auto);
    setPresetKey('auto');
    setNotice(null);
  };

  const encodeResult = async (res: { data: Uint8ClampedArray; width: number; height: number }) => {
    const canvas = imageDataToCanvas(toImageData(res.data, res.width, res.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    const meta = FORMAT_META[format];
    if (meta.mime === 'image/jpeg') {
      /* JPG has no alpha — matte behind the image or transparent areas
         (PNG logos with transparency) come out black */
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      ctx.canvas.toBlob(resolve, meta.mime, meta.lossy ? quality / 100 : undefined)
    );
    if (!blob) {
      throw new Error(
        format === 'webp'
          ? 'WebP is not supported by this browser — try JPG or PNG instead.'
          : 'Could not encode the result.'
      );
    }
    return blob;
  };

  const handleDownload = async () => {
    if (!loaded) return;
    const basePx = loaded.fullData.width * loaded.fullData.height;
    const outPx = basePx * settings.scale * settings.scale;
    if (outPx > MAX_OUTPUT_PIXELS) {
      const maxScale = Math.max(1, Math.floor(Math.sqrt(MAX_OUTPUT_PIXELS / basePx)));
      showNotice('error', `The result would exceed 25 megapixels. Choose ${maxScale}× or lower for this image.`);
      return;
    }
    setDownloadPct(0);
    try {
      const stages = activeStages(settings);
      const res = await getClient().run(
        { data: loaded.fullData.data, width: loaded.fullData.width, height: loaded.fullData.height },
        settings,
        (stage) => {
          const idx = stages.indexOf(stage);
          if (idx >= 0) setDownloadPct(Math.round(((idx + 1) / stages.length) * 100));
        }
      );
      const blob = await encodeResult(res);
      const baseName = (loaded.info.name.replace(/\.[^.]+$/, '') || 'image').slice(0, 60);
      /* the shared helper adds the brand marker → "photo-2x-freeseak.jpg" */
      downloadBlob(blob, `${baseName}-${settings.scale}x.${FORMAT_META[format].ext}`);
      showNotice('ok', `Saved to your device — ${res.width} × ${res.height} px · ${formatBytes(blob.size)} · done locally in ${(res.ms / 1000).toFixed(1)}s`);
    } catch (err) {
      showNotice('error', `Download failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setDownloadPct(null);
    }
  };

  const handleCopy = async () => {
    if (!loaded || copying) return;
    setCopying(true);
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Clipboard images are not supported in this browser.');
      }
      const res = await getClient().run(
        { data: loaded.fullData.data, width: loaded.fullData.width, height: loaded.fullData.height },
        settings
      );
      const ctx = imageDataToCanvas(toImageData(res.data, res.width, res.height)).getContext('2d');
      if (!ctx) throw new Error('Canvas 2D is not available.');
      const blob = await new Promise<Blob | null>((resolve) => ctx.canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode the image.');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showNotice('ok', `Copied to clipboard — ${res.width} × ${res.height} px PNG, paste it anywhere.`);
    } catch (err) {
      showNotice('error', `Copy unavailable: ${err instanceof Error ? err.message : 'clipboard access was blocked.'}`);
    } finally {
      setCopying(false);
    }
  };

  const outW = loaded ? loaded.fullData.width * settings.scale : 0;
  const outH = loaded ? loaded.fullData.height * settings.scale : 0;
  const basePx = loaded ? loaded.fullData.width * loaded.fullData.height : 0;
  const downloading = downloadPct !== null;
  const stagesNow = activeStages(settings);
  const busyStage =
    downloading && downloadPct
      ? STAGE_LABELS[stagesNow[Math.min(stagesNow.length - 1, Math.ceil((downloadPct / 100) * stagesNow.length) - 1)] ?? ''] ?? null
      : null;
  const lossy = FORMAT_META[format].lossy;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = '';
        }}
        aria-label="Choose an image to enhance"
      />

      {!loaded ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Add an image"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-[1.6px] border-dashed text-center transition-colors gap-2 px-6 py-10 ${
            dragActive ? 'border-primary bg-secondary/60' : 'border-border bg-card hover:border-primary/60 hover:bg-secondary/40'
          }`}
          data-testid="enhance-dropzone"
        >
          <div className="pointer-events-none flex flex-col items-center gap-1.5">
            {loadingFile ? (
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            ) : (
              <ImagePlus className="size-8 text-primary" aria-hidden />
            )}
            <p className="font-display text-[13.5px] font-bold text-foreground">
              {loadingFile ? 'Reading your image…' : 'Drop an image here, or click to browse'}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              You can also paste from the clipboard (Ctrl / Cmd + V) — {ACCEPTED_TYPES}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="enhance-workspace">
          {/* Viewer */}
          <div className="min-w-0 space-y-3">
            <CompareSlider
              beforeSrc={loaded.info.srcUrl}
              afterSrc={afterUrl}
              width={loaded.previewData.width}
              height={loaded.previewData.height}
              busy={busy}
              peek={peek}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" className={ICON_BTN} title="Rotate left" aria-label="Rotate left" onClick={() => void transform('rotate-left')}>
                  <RotateCcw className="size-4" aria-hidden />
                </button>
                <button type="button" className={ICON_BTN} title="Rotate right" aria-label="Rotate right" onClick={() => void transform('rotate-right')}>
                  <RotateCw className="size-4" aria-hidden />
                </button>
                <button type="button" className={ICON_BTN} title="Flip horizontally" aria-label="Flip horizontally" onClick={() => void transform('flip')}>
                  <FlipHorizontal className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${ICON_BTN} ${peek ? 'bg-accent text-accent-foreground' : ''}`}
                  title="Show original (hold comparison)"
                  aria-label="Show original"
                  aria-pressed={peek}
                  onClick={() => setPeek((p) => !p)}
                >
                  <Eye className="size-4" aria-hidden />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className={ICON_BTN} title="Replace image" aria-label="Replace image" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden />
                </button>
                <button type="button" className={ICON_BTN} title="Remove image" aria-label="Remove image" onClick={removeImage}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </div>
            <p className="text-[11.5px] font-semibold text-muted-foreground" data-testid="enhance-info">
              {loaded.info.origW} × {loaded.info.origH} px · {formatBytes(loaded.info.fileBytes)}
              {settings.scale > 1 ? (
                <>
                  {' '}→ output <span className="text-mint-deep dark:text-mint">{outW} × {outH} px</span>
                </>
              ) : (
                ' → output keeps original size'
              )}
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-5 self-start lg:sticky lg:top-20">
            {/* Enhance */}
            <div className="space-y-2.5">
              <p className={GROUP_TITLE}>Enhance</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleAutoTune()}
                  disabled={analyzing}
                  className={presetKey === 'custom' ? PILL_IDLE : PILL_ACTIVE}
                  data-testid="auto-tune"
                >
                  {analyzing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
                  Auto-tune
                </button>
                {PRESET_LIST.map((p) => (
                  <button key={p.key} type="button" onClick={() => applyPreset(p.key)} className={presetKey === p.key ? PILL_ACTIVE : PILL_IDLE}>
                    <p.icon className="size-3.5" aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {SCALE_LIST.map((s) => {
                  const tooBig = basePx * s.value * s.value > MAX_OUTPUT_PIXELS;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      disabled={tooBig}
                      title={tooBig ? 'Result would exceed 25 megapixels' : undefined}
                      onClick={() => update({ scale: s.value })}
                      className={settings.scale === s.value ? PILL_ACTIVE : PILL_IDLE}
                      data-testid={`scale-${s.value}`}
                    >
                      Upscale {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Adjust */}
            <div className="space-y-3">
              <p className={GROUP_TITLE}>Adjust</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <SliderRow label="Noise removal" value={settings.denoise} min={0} max={100} onChange={(v) => update({ denoise: v })} />
                <SliderRow label="Sharpen" value={settings.sharpen} min={0} max={100} onChange={(v) => update({ sharpen: v })} />
                <SliderRow label="Clarity" value={settings.clarity} min={0} max={100} onChange={(v) => update({ clarity: v })} />
                <SliderRow label="Brightness" value={settings.brightness} min={-50} max={50} signedValue onChange={(v) => update({ brightness: v })} />
                <SliderRow label="Contrast" value={settings.contrast} min={-50} max={50} signedValue onChange={(v) => update({ contrast: v })} />
                <SliderRow label="Saturation" value={settings.saturation} min={-50} max={50} signedValue onChange={(v) => update({ saturation: v })} />
                <SliderRow label="Warmth" value={settings.temperature} min={-50} max={50} signedValue onChange={(v) => update({ temperature: v })} />
                <SliderRow label="Tint" value={settings.tint} min={-50} max={50} signedValue onChange={(v) => update({ tint: v })} />
              </div>
              <button
                type="button"
                onClick={() => update({ autoLevels: !settings.autoLevels })}
                className={settings.autoLevels ? PILL_ACTIVE : PILL_IDLE}
                aria-pressed={settings.autoLevels}
              >
                {settings.autoLevels ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                Auto levels
              </button>
            </div>

            {/* Output */}
            <div className="space-y-3">
              <p className={GROUP_TITLE}>Output</p>
              <div className="flex flex-wrap gap-2">
                {FORMAT_LIST.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={format === f.value ? PILL_ACTIVE : PILL_IDLE}
                    aria-pressed={format === f.value}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {lossy ? (
                <SliderRow label="JPG / WebP quality" value={quality} min={50} max={100} onChange={(v) => setQuality(v)} />
              ) : (
                <p className="text-[12px] text-muted-foreground">PNG is lossless — every pixel is kept, files are larger.</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={() => void handleDownload()} disabled={downloading} className={BTN_PRIMARY} data-testid="enhance-download">
                  {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                  {downloading ? `Processing ${downloadPct}%${busyStage ? ` — ${busyStage}` : ''}` : `Download ${settings.scale > 1 ? `${settings.scale}× ` : ''}result`}
                </button>
                <button type="button" onClick={() => void handleCopy()} disabled={copying || downloading} className={BTN_GHOST}>
                  {copying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('auto')}
                  disabled={downloading}
                  className={BTN_GHOST}
                >
                  Reset adjustments
                </button>
              </div>
              <div aria-live="polite" data-testid="enhance-notice">
                {notice ? (
                  <div
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-medium ${
                      notice.kind === 'ok'
                        ? 'border-mint/45 bg-mint/10 text-mint-deep dark:text-mint'
                        : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                    role={notice.kind === 'error' ? 'alert' : 'status'}
                  >
                    {notice.kind === 'ok' ? (
                      <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    )}
                    <span>{notice.text}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loaded ? (
        <p className="mt-3 text-center text-[11.5px] font-semibold text-muted-foreground/70">
          Everything runs on your device — your image never leaves the browser.
        </p>
      ) : null}
    </section>
  );
}
