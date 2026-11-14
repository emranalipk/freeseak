'use client';

import { useRef, useState } from 'react';
import { ChevronsLeftRight, RefreshCw } from 'lucide-react';

interface CompareSliderProps {
  beforeSrc: string;
  /** null while the first preview is still processing */
  afterSrc: string | null;
  width: number;
  height: number;
  busy?: boolean;
  /** when true, show the untouched original instead of the result */
  peek?: boolean;
}

function clampPos(v: number) {
  return Math.min(100, Math.max(0, v));
}

export function CompareSlider({ beforeSrc, afterSrc, width, height, busy, peek }: CompareSliderProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    setPos(clampPos(((clientX - rect.left) / rect.width) * 100));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) updateFromClientX(e.clientX);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture already released
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPos((p) => clampPos(p - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPos((p) => clampPos(p + step));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-ew-resize select-none overflow-hidden rounded-xl border border-border bg-muted"
      style={{ aspectRatio: `${Math.max(1, width)} / ${Math.max(1, height)}`, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-testid="compare-slider"
    >
      <img
        src={beforeSrc}
        alt="Original image, before enhancement"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {afterSrc && !peek ? (
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <img
            src={afterSrc}
            alt="Enhanced image, after processing"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        </div>
      ) : null}

      {/* Divider handle */}
      <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.35)]" />
        <button
          type="button"
          role="slider"
          aria-label="Comparison position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="absolute top-1/2 left-0 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronsLeftRight className="size-5" aria-hidden />
        </button>
      </div>

      {/* Labels */}
      {peek ? (
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
          Original (unedited)
        </span>
      ) : (
        <>
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
            Before
          </span>
          <span className="absolute right-2 top-2 rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-white">
            After
          </span>
        </>
      )}

      {busy ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/55 py-2 text-[13px] text-white">
          <RefreshCw className="size-3.5 animate-spin" aria-hidden />
          Enhancing preview…
        </div>
      ) : null}
    </div>
  );
}
