import React, { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, X } from "lucide-react";

interface CroppedPhotoViewerProps {
  croppedDataUrl: string;
}

export const CroppedPhotoViewer: React.FC<CroppedPhotoViewerProps> = ({
  croppedDataUrl,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleZoomIn = () =>
    setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))));
  const handleZoomOut = () =>
    setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))));

  return (
    <>
      <div className="office-card flex flex-col overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[#d5dee0] flex items-center justify-between gap-2 bg-white">
          <h3 className="text-[13px] font-semibold text-[#15262b] whitespace-nowrap">
            Foto recortada
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              title="Alejar"
              aria-label="Alejar foto"
              className="p-1.5 text-[#5b6c70] hover:text-[#15262b] hover:bg-[#f3f6f6] rounded-[8px] disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[12px] tabular-nums text-[#5b6c70] px-1 min-w-[44px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Acercar"
              aria-label="Acercar foto"
              className="p-1.5 text-[#5b6c70] hover:text-[#15262b] hover:bg-[#f3f6f6] rounded-[8px] disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              title="Ampliar en pantalla completa"
              aria-label="Ampliar foto"
              className="p-1.5 text-[#5b6c70] hover:text-[#15262b] hover:bg-[#f3f6f6] rounded-[8px] ml-1 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-2 bg-[#f3f6f6] overflow-auto max-h-[72vh]">
          <div
            style={{
              width: `${zoom * 100}%`,
            }}
            className="min-w-full"
          >
            <img
              src={croppedDataUrl}
              alt="Recorte del pizarrón para comparar números"
              className="w-full h-auto block rounded-[4px]"
            />
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#15262b]/35 flex flex-col p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada del pizarrón"
        >
          <div className="office-card flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-[#d5dee0]">
              <span className="text-[14px] font-semibold text-[#15262b]">
                Foto recortada del pizarrón
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            </div>
            <div className="flex-1 bg-[#f3f6f6] overflow-auto p-4 flex items-start justify-center">
              <img
                src={croppedDataUrl}
                alt="Vista ampliada del pizarrón"
                className="max-w-none w-full lg:w-auto lg:max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
