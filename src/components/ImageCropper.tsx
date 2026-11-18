import React, { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, RotateCcw, Upload, ScanText } from "lucide-react";

interface CropRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

type DragMode =
  | "none"
  | "move"
  | "draw"
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

interface ImageCropperProps {
  imageSrc: string;
  isLoading: boolean;
  onCancel: () => void;
  onConfirmCrop: (croppedDataUrl: string, base64: string, mimeType: string) => void;
}

const DEFAULT_CROP: CropRect = {
  x: 0.04,
  y: 0.04,
  width: 0.92,
  height: 0.92,
};

const MIN_SIZE = 0.05;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  isLoading,
  onCancel,
  onConfirmCrop,
}) => {
  const [rotatedSrc, setRotatedSrc] = useState<string>(imageSrc);
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    normX: number;
    normY: number;
    startCrop: CropRect;
  } | null>(null);

  useEffect(() => {
    if (rotationDeg === 0) {
      setRotatedSrc(imageSrc);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      const swap = rotationDeg === 90 || rotationDeg === 270;
      canvas.width = swap ? img.naturalHeight : img.naturalWidth;
      canvas.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setRotatedSrc(canvas.toDataURL("image/jpeg", 0.95));
      setCrop(DEFAULT_CROP);
    };
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc, rotationDeg]);

  const getNormPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  }, []);

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    if (isLoading) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getNormPoint(e.clientX, e.clientY);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      normX: pt.x,
      normY: pt.y,
      startCrop: { ...crop },
    };
    setDragMode(mode);
    containerRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === "none" || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pt = getNormPoint(e.clientX, e.clientY);
    const dx = pt.x - dragStartRef.current.normX;
    const dy = pt.y - dragStartRef.current.normY;
    const s = dragStartRef.current.startCrop;

    if (dragMode === "draw") {
      const x1 = dragStartRef.current.normX;
      const y1 = dragStartRef.current.normY;
      const x2 = pt.x;
      const y2 = pt.y;
      const nx = Math.min(x1, x2);
      const ny = Math.min(y1, y2);
      const nw = Math.max(MIN_SIZE, Math.abs(x2 - x1));
      const nh = Math.max(MIN_SIZE, Math.abs(y2 - y1));
      setCrop({
        x: clamp(nx, 0, 1 - nw),
        y: clamp(ny, 0, 1 - nh),
        width: Math.min(nw, 1 - nx),
        height: Math.min(nh, 1 - ny),
      });
      return;
    }

    if (dragMode === "move") {
      setCrop({
        x: clamp(s.x + dx, 0, 1 - s.width),
        y: clamp(s.y + dy, 0, 1 - s.height),
        width: s.width,
        height: s.height,
      });
      return;
    }

    let left = s.x;
    let top = s.y;
    let right = s.x + s.width;
    let bottom = s.y + s.height;

    if (dragMode.includes("w")) {
      left = clamp(s.x + dx, 0, right - MIN_SIZE);
    }
    if (dragMode.includes("e")) {
      right = clamp(s.x + s.width + dx, left + MIN_SIZE, 1);
    }
    if (dragMode.includes("n")) {
      top = clamp(s.y + dy, 0, bottom - MIN_SIZE);
    }
    if (dragMode.includes("s")) {
      bottom = clamp(s.y + s.height + dy, top + MIN_SIZE, 1);
    }

    setCrop({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode !== "none") {
      setDragMode("none");
      dragStartRef.current = null;
      containerRef.current?.releasePointerCapture?.(e.pointerId);
    }
  };

  const handleRotate = () => {
    if (isLoading) return;
    setRotationDeg((prev) => (prev + 90) % 360);
  };

  const handleConfirm = () => {
    if (isLoading || !imgRef.current) return;
    const img = imgRef.current;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;

    const sx = Math.round(crop.x * natW);
    const sy = Math.round(crop.y * natH);
    const sw = Math.max(10, Math.round(crop.width * natW));
    const sh = Math.max(10, Math.round(crop.height * natH));

    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const mimeType = "image/jpeg";
    const dataUrl = canvas.toDataURL(mimeType, 0.92);
    const base64 = dataUrl.split(",")[1] ?? "";
    onConfirmCrop(dataUrl, base64, mimeType);
  };

  return (
    <section className="office-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#d5dee0]">
        <div>
          <h2 className="text-[17px] font-semibold text-[#15262b]">
            Recortar el pizarrón
          </h2>
          <p className="text-[13px] text-[#5b6c70] mt-0.5">
            Arrastra las esquinas o dibuja un rectángulo para dejar visible solo el pizarrón. Solo se enviará este recorte.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRotate}
            disabled={isLoading}
            className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-[#5b6c70]" />
            <span>Girar 90°</span>
          </button>
          <button
            type="button"
            onClick={() => setCrop(DEFAULT_CROP)}
            disabled={isLoading}
            className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#5b6c70]" />
            <span>Restablecer recorte</span>
          </button>
        </div>
      </div>

      {/* Crop Canvas Area */}
      <div className="mt-4 flex justify-center bg-[#f3f6f6] border border-[#dfe6e8] rounded-[8px] p-2 sm:p-4 overflow-hidden">
        <div
          ref={containerRef}
          onPointerDown={(e) => startDrag("draw", e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative inline-block select-none touch-none max-w-full cursor-crosshair"
        >
          <img
            ref={imgRef}
            src={rotatedSrc}
            alt="Foto del pizarrón para recortar"
            draggable={false}
            onLoad={(e) => {
              const target = e.currentTarget;
              setImgDimensions({ w: target.naturalWidth, h: target.naturalHeight });
            }}
            className="block max-h-[65vh] w-auto max-w-full object-contain pointer-events-none"
          />

          {/* Subtle outer mask */}
          <div
            className="absolute inset-x-0 top-0 bg-white/55 pointer-events-none"
            style={{ height: `${crop.y * 100}%` }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-white/55 pointer-events-none"
            style={{ height: `${(1 - crop.y - crop.height) * 100}%` }}
          />
          <div
            className="absolute left-0 bg-white/55 pointer-events-none"
            style={{
              top: `${crop.y * 100}%`,
              height: `${crop.height * 100}%`,
              width: `${crop.x * 100}%`,
            }}
          />
          <div
            className="absolute right-0 bg-white/55 pointer-events-none"
            style={{
              top: `${crop.y * 100}%`,
              height: `${crop.height * 100}%`,
              width: `${(1 - crop.x - crop.width) * 100}%`,
            }}
          />

          {/* Active Crop Selection Rectangle */}
          <div
            onPointerDown={(e) => startDrag("move", e)}
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
            className="absolute border-2 border-[#0b6e78] cursor-move"
          >
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-b border-white/50" />
              <div className="border-r border-white/50" />
              <div className="border-r border-white/50" />
              <div />
            </div>

            {/* 8 Resize Handles */}
            <div
              onPointerDown={(e) => startDrag("nw", e)}
              className="absolute -top-3 -left-3 w-7 h-7 flex items-center justify-center cursor-nwse-resize"
            >
              <span className="w-3.5 h-3.5 bg-white border-2 border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("ne", e)}
              className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center cursor-nesw-resize"
            >
              <span className="w-3.5 h-3.5 bg-white border-2 border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("sw", e)}
              className="absolute -bottom-3 -left-3 w-7 h-7 flex items-center justify-center cursor-nesw-resize"
            >
              <span className="w-3.5 h-3.5 bg-white border-2 border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("se", e)}
              className="absolute -bottom-3 -right-3 w-7 h-7 flex items-center justify-center cursor-nwse-resize"
            >
              <span className="w-3.5 h-3.5 bg-white border-2 border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("n", e)}
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-10 h-5 flex items-center justify-center cursor-ns-resize"
            >
              <span className="w-6 h-1.5 bg-white border border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("s", e)}
              className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-10 h-5 flex items-center justify-center cursor-ns-resize"
            >
              <span className="w-6 h-1.5 bg-white border border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("w", e)}
              className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-5 h-10 flex items-center justify-center cursor-ew-resize"
            >
              <span className="w-1.5 h-6 bg-white border border-[#0b6e78] rounded-[2px] block" />
            </div>
            <div
              onPointerDown={(e) => startDrag("e", e)}
              className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-5 h-10 flex items-center justify-center cursor-ew-resize"
            >
              <span className="w-1.5 h-6 bg-white border border-[#0b6e78] rounded-[2px] block" />
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center text-[#15262b] p-4 text-center">
              <div className="w-8 h-8 border-3 border-[#dfe6e8] border-t-[#0b6e78] rounded-full animate-spin mb-3" />
              <p className="text-[15px] font-semibold">Leyendo el pizarrón...</p>
              <p className="text-[12px] text-[#5b6c70] mt-1">
                Esto suele tardar unos segundos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-4 border-t border-[#d5dee0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-[12px] text-[#5b6c70] tabular-nums">
          {imgDimensions
            ? `Recorte aproximado: ${Math.round(crop.width * imgDimensions.w)} × ${Math.round(crop.height * imgDimensions.h)} px`
            : "Cargando imagen..."}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="office-btn-secondary inline-flex items-center gap-1.5 px-4 text-[13px] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#5b6c70]" />
            <span>Cambiar foto</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !imgDimensions}
            className="office-btn-primary inline-flex items-center gap-2 px-5 text-[13px] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ScanText className="w-4 h-4" />
            <span>{isLoading ? "Leyendo pizarrón..." : "Leer pizarrón"}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
