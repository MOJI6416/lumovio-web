"use client";

import type { AvatarColor } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Slider } from "@/components/ui/Slider";

/** The square the server keeps (`PROFILE_PHOTO_SIZE`; a value import from contracts would bring zod into the page). */
const OUTPUT = 512;
const MAX_ZOOM = 4;

/** Where the circle stands on the picture: its centre in the picture's pixels and how far in it is zoomed (1 — the short side fits). */
type Frame = { cx: number; cy: number; zoom: number };

/** The frame kept inside the picture: the circle's square never leaves it. */
function clamp(f: Frame, w: number, h: number): Frame {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, f.zoom));
  const half = Math.min(w, h) / (2 * zoom);
  return { zoom, cx: Math.min(w - half, Math.max(half, f.cx)), cy: Math.min(h - half, Math.max(half, f.cy)) };
}

/** A chosen file opened as a picture, with the address it is drawn from (revoked by whoever opened it). */
export type Picture = { img: HTMLImageElement; url: string };

/**
 * Opens the chosen file as the browser draws it — upright by its EXIF — before "Move and scale" shows: a file the
 * browser can't open (HEIC outside Safari, not a picture at all) is refused here, said at the photo, with no dialog.
 */
export function loadPicture(file: File): Promise<Picture> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve({ img, url }) : fail());
    img.onerror = fail;
    img.src = url;
  });
}

/**
 * "Move and scale" (design-system 7.17): the chosen photo under a circle, as the avatar will show it. Drag (a finger or
 * the mouse) moves it, a pinch, the wheel or the slider zooms it (up to 4×), arrows and +/− do the same from the keyboard;
 * the circle never leaves the picture. "Done" gives the circle's square as a 512 px image (WebP, PNG where the browser
 * can't write WebP); the server makes it its own WebP.
 */
export function PhotoCrop({
  picture,
  color,
  onCancel,
  onDone,
}: {
  picture: Picture;
  /** The avatar's colour: what shows through a transparent picture, as in the avatar. */
  color: AvatarColor;
  onCancel: () => void;
  /** The circle's square; null — the browser couldn't draw it. */
  onDone: (image: Blob | null) => void;
}) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const { img, url: src } = picture;
  const [frame, setFrame] = useState<Frame>({ cx: img.naturalWidth / 2, cy: img.naturalHeight / 2, zoom: 1 });
  const [side, setSide] = useState(0);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const onWheel = useRef<(e: WheelEvent) => void>(() => {});

  // The stage as it mounts (the dialog's body comes a moment later): its side in CSS px — the dialog's width up to
  // 320, a phone's sheet is narrower — and the wheel, listened to directly so it zooms instead of scrolling the dialog.
  const stageRef = useCallback((el: HTMLDivElement | null) => {
    stage.current = el;
    if (!el) return;
    const ro = new ResizeObserver(() => setSide(el.clientWidth));
    ro.observe(el);
    setSide(el.clientWidth);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      onWheel.current(e);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = side ? (side / Math.min(w, h)) * frame.zoom : 0;
  const update = (f: Frame) => setFrame(clamp(f, w, h));
  /** Zooms to `zoom` keeping the picture's point under (px, py) — the stage's coordinates — where it is. */
  const zoomAt = (zoom: number, px = side / 2, py = side / 2) => {
    if (!scale) return;
    const next = (side / Math.min(w, h)) * Math.min(MAX_ZOOM, Math.max(1, zoom));
    const ix = frame.cx + (px - side / 2) / scale;
    const iy = frame.cy + (py - side / 2) / scale;
    update({ zoom, cx: ix - (px - side / 2) / next, cy: iy - (py - side / 2) / next });
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: frame.zoom };
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.get(e.pointerId);
    if (!was || !scale) return;
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomAt((pinch.current.zoom * dist) / pinch.current.dist, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
    } else if (pointers.current.size === 1) {
      update({ ...frame, cx: frame.cx - (at.x - was.x) / scale, cy: frame.cy - (at.y - was.y) / scale });
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  onWheel.current = (e) => {
    const at = local(e);
    zoomAt(frame.zoom * Math.exp(-e.deltaY / 400), at.x, at.y);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!scale) return;
    // A tenth of the circle a press, the whole picture's width at most a few presses away.
    const step = side / 10 / scale;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (m) update({ ...frame, cx: frame.cx + m[0], cy: frame.cy + m[1] });
    else if (e.key === "+" || e.key === "=") zoomAt(frame.zoom * 1.15);
    else if (e.key === "-" || e.key === "_") zoomAt(frame.zoom / 1.15);
    else return;
    e.preventDefault();
  };

  const done = () => {
    setBusy(true);
    const half = Math.min(w, h) / (2 * frame.zoom);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, frame.cx - half, frame.cy - half, half * 2, half * 2, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        onDone(blob);
      },
      "image/webp",
      0.92,
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} title={t("photoCropTitle")} size="sm">
      <div className="flex flex-col items-center gap-6">
        <div
          ref={stageRef}
          role="application"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a drag surface with its own keys (arrows move, +/− zoom), as its name tells a screen reader; the slider below is the standard control
          tabIndex={0}
          aria-label={t("photoCropArea")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
          className="relative aspect-square w-full max-w-80 cursor-grab touch-none select-none overflow-hidden rounded-md active:cursor-grabbing"
          style={{ background: `var(--avatar-${color})` }}
        >
          {scale > 0 && (
            // biome-ignore lint/performance/noImgElement: the person's own file, shown from memory
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none origin-top-left"
              style={{ width: w * scale, height: h * scale, left: side / 2 - frame.cx * scale, top: side / 2 - frame.cy * scale }}
            />
          )}
          {/* The circle the avatar will show; outside it the picture is veiled. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100vmax_var(--scrim)]" />
        </div>
        <Slider
          value={frame.zoom}
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          onValueChange={(z) => zoomAt(z)}
          label={t("photoZoom")}
          valueText={`${Math.round(frame.zoom * 100)} %`}
          className="max-w-80"
        />
      </div>
      <DialogActions>
        <Button variant="secondary" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button onClick={done} loading={busy}>
          {tc("done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
