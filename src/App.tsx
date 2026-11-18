import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  Plus,
  ArrowUpDown,
  AlertCircle,
  Image as ImageIcon,
  Keyboard,
  Crop,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import {
  BoardRow,
  CALL_COLOR_LEGEND,
  createDefaultSpecialsConfig,
  DAYS,
  DayName,
  SpecialFormat,
  SpecialsConfig,
} from "./types/board";
import {
  createEmptyRow,
  createOperatorWeekRows,
  formatDateDDMMYYYY,
  getMondayOfCurrentWeek,
  getNextAvailableOperatorNumber,
  isMondayISO,
  isRowValid,
  loadSpecialsConfig,
  normalizeApiRow,
  remapRowSpecials,
  saveSpecialsConfig,
  snapToMondayISO,
  sortBoardRows,
  sortBoardRowsByOperator,
} from "./utils/boardUtils";
import { exportBoardToExcel } from "./utils/excelExport";
import { ImageCropper } from "./components/ImageCropper";
import { BoardTable } from "./components/BoardTable";
import { CroppedPhotoViewer } from "./components/CroppedPhotoViewer";
import { OperatorMatrixView } from "./components/OperatorMatrixView";
import { RankingView } from "./components/RankingView";
import { SpecialsConfigPanel } from "./components/SpecialsConfigPanel";
import { PizarronBoardView } from "./components/PizarronBoardView";

type AppPhase = "upload" | "crop" | "review";
type RowFilter = "all" | "review" | "valid";
type ReviewViewMode = "pizarron" | "matrix" | "ranking" | "table";

const FALLBACK_ERROR_MSG =
  "No se pudo leer la foto. Intenta en un rato o carga los números a mano";

const REVIEW_TABS: { id: ReviewViewMode; label: string }[] = [
  { id: "pizarron", label: "Pizarrón" },
  { id: "matrix", label: "Carga por operador" },
  { id: "ranking", label: "Ranking semanal" },
  { id: "table", label: "Tabla completa" },
];

export default function App() {
  const [mondayDate, setMondayDate] = useState<string>(() =>
    getMondayOfCurrentWeek()
  );
  const [especialesConfig, setEspecialesConfig] = useState<SpecialsConfig>(
    () => loadSpecialsConfig()
  );
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [sourceImageSrc, setSourceImageSrc] = useState<string | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [filter, setFilter] = useState<RowFilter>("all");
  const [isReading, setIsReading] = useState<boolean>(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [showMobilePhoto, setShowMobilePhoto] = useState<boolean>(false);
  const [showCropSpecials, setShowCropSpecials] = useState<boolean>(false);
  const [confirmDownloadOpen, setConfirmDownloadOpen] =
    useState<boolean>(false);
  const [selectedOpToAdd, setSelectedOpToAdd] = useState<number>(1);
  const [sortMode, setSortMode] = useState<"day" | "operator">("day");
  const [viewMode, setViewMode] = useState<ReviewViewMode>("pizarron");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeSourceObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      revokeSourceObjectUrl();
    };
  }, [revokeSourceObjectUrl]);

  const handleChangeOperatorFormat = useCallback(
    (numero: number, newFormat: SpecialFormat) => {
      const oldFormat = especialesConfig[numero] ?? "ninguno";
      if (oldFormat === newFormat) return;

      const nextConfig: SpecialsConfig = {
        ...especialesConfig,
        [numero]: newFormat,
      };
      setEspecialesConfig(nextConfig);
      saveSpecialsConfig(nextConfig);

      // Si ya hay filas cargadas, reubicar sus especiales en orden sin volver a leer la foto
      setRows((prev) =>
        prev.map((row) =>
          row.numero === numero
            ? remapRowSpecials(row, oldFormat, newFormat)
            : row
        )
      );
    },
    [especialesConfig]
  );

  const handleResetSpecialsDefaults = useCallback(() => {
    const defaults = createDefaultSpecialsConfig();
    setRows((prev) =>
      prev.map((row) => {
        const oldFormat = especialesConfig[row.numero] ?? "ninguno";
        const newFormat = defaults[row.numero] ?? "ninguno";
        return oldFormat !== newFormat
          ? remapRowSpecials(row, oldFormat, newFormat)
          : row;
      })
    );
    setEspecialesConfig(defaults);
    saveSpecialsConfig(defaults);
  }, [especialesConfig]);

  const loadImageFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      revokeSourceObjectUrl();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setSourceImageSrc(url);
      setReadError(null);
      setPhase("crop");
    },
    [revokeSourceObjectUrl]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT"
      ) {
        const items = e.clipboardData?.items;
        const hasImage = items
          ? Array.from(items).some((item) => item.type.startsWith("image/"))
          : false;
        if (!hasImage) return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            loadImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loadImageFile]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const handleConfirmCrop = async (
    dataUrl: string,
    base64: string,
    mimeType: string
  ) => {
    setCroppedDataUrl(dataUrl);
    setIsReading(true);
    setReadError(null);

    try {
      const response = await fetch("/api/leer-pizarron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          especialesConfig,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !Array.isArray(data.filas)) {
        setReadError(FALLBACK_ERROR_MSG);
        setRows([]);
        setViewMode("pizarron");
        setPhase("review");
        return;
      }

      const normalized = data.filas.map(
        (item: Parameters<typeof normalizeApiRow>[0], idx: number) =>
          normalizeApiRow(item, idx)
      );
      setRows(sortBoardRows(normalized));
      setFilter("all");
      setViewMode("pizarron");
      setPhase("review");
    } catch {
      setReadError(FALLBACK_ERROR_MSG);
      setRows([]);
      setViewMode("pizarron");
      setPhase("review");
    } finally {
      setIsReading(false);
    }
  };

  const handleStartManual = () => {
    revokeSourceObjectUrl();
    setSourceImageSrc(null);
    setCroppedDataUrl(null);
    setReadError(null);
    if (rows.length === 0) {
      const week = createOperatorWeekRows(1);
      setRows(week);
      setSelectedOpToAdd(2);
      setSortMode("operator");
    }
    setViewMode("pizarron");
    setPhase("review");
  };

  const handleResetToUpload = () => {
    revokeSourceObjectUrl();
    setSourceImageSrc(null);
    setCroppedDataUrl(null);
    setReadError(null);
    setShowMobilePhoto(false);
    setPhase("upload");
  };

  const handleUpdateRow = useCallback((id: string, patch: Partial<BoardRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }, []);

  const handleUpsertCell = useCallback(
    (numero: number, dia: DayName, patch: Partial<BoardRow>) => {
      setRows((prev) => {
        const idx = prev.findIndex(
          (r) => r.numero === numero && r.dia === dia
        );
        if (idx >= 0) {
          return prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        }
        return [...prev, { ...createEmptyRow(numero, dia), ...patch }];
      });
    },
    []
  );

  const handleDeleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const handleRemoveOperator = useCallback((numero: number) => {
    setRows((prev) => {
      const updated = prev.filter((r) => r.numero !== numero);
      setSelectedOpToAdd(getNextAvailableOperatorNumber(updated));
      return updated;
    });
  }, []);

  const handleAddOperatorWeek = (operatorNumber: number) => {
    setRows((prev) => {
      const existingDays = new Set(
        prev.filter((r) => r.numero === operatorNumber).map((r) => r.dia)
      );
      const missingDays = DAYS.filter((d) => !existingDays.has(d));
      const daysToAdd = missingDays.length > 0 ? missingDays : DAYS;
      const newRows = daysToAdd.map((dia) =>
        createEmptyRow(operatorNumber, dia)
      );
      const updated = [...prev, ...newRows];
      setSelectedOpToAdd(getNextAvailableOperatorNumber(updated));
      return updated;
    });
    setFilter("all");
  };

  const handleAddMultipleOperators = (numeros: number[]) => {
    setRows((prev) => {
      let updated = [...prev];
      const sortedNums = [...numeros].sort((a, b) => a - b);
      for (const num of sortedNums) {
        const existingDays = new Set(
          updated.filter((r) => r.numero === num).map((r) => r.dia)
        );
        const missingDays = DAYS.filter((d) => !existingDays.has(d));
        if (missingDays.length > 0) {
          updated = [
            ...updated,
            ...missingDays.map((dia) => createEmptyRow(num, dia)),
          ];
        }
      }
      setSelectedOpToAdd(getNextAvailableOperatorNumber(updated));
      return updated;
    });
    setFilter("all");
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const nextNum = last ? Math.min(22, last.numero) : selectedOpToAdd;
      const nextDay = last ? last.dia : "Lunes";
      return [...prev, createEmptyRow(nextNum, nextDay)];
    });
    setFilter("all");
  };

  const handleToggleSort = () => {
    setRows((prev) => {
      if (sortMode === "day") {
        setSortMode("operator");
        return sortBoardRowsByOperator(prev);
      }
      setSortMode("day");
      return sortBoardRows(prev);
    });
  };

  const { validCount, reviewCount, filteredRows } = useMemo(() => {
    let valid = 0;
    let review = 0;
    const filtered: BoardRow[] = [];

    for (const row of rows) {
      const ok = isRowValid(row);
      if (ok) valid++;
      else review++;

      if (
        filter === "all" ||
        (filter === "valid" && ok) ||
        (filter === "review" && !ok)
      ) {
        filtered.push(row);
      }
    }

    return { validCount: valid, reviewCount: review, filteredRows: filtered };
  }, [rows, filter]);

  const handleDownloadClick = () => {
    if (rows.length === 0) return;
    if (reviewCount > 0) {
      setConfirmDownloadOpen(true);
      return;
    }
    exportBoardToExcel(rows, mondayDate);
  };

  const handleConfirmDownloadAnyway = () => {
    setConfirmDownloadOpen(false);
    exportBoardToExcel(rows, mondayDate);
  };

  const mondayValid = isMondayISO(mondayDate);
  const suggestedMonday = snapToMondayISO(mondayDate);
  const fridayDisplay = formatDateDDMMYYYY(mondayDate, 4);
  const mondayDisplay = formatDateDDMMYYYY(mondayDate, 0);

  const configuredSpecialsCount = useMemo(
    () =>
      Object.values(especialesConfig).filter((fmt) => fmt !== "ninguno").length,
    [especialesConfig]
  );

  return (
    <div className="min-h-screen bg-[#f3f6f6] text-[#15262b] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#d5dee0] sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 min-h-[58px]">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              if (!isReading) handleResetToUpload();
            }}
            className="text-[21px] font-semibold tracking-tight text-[#15262b] whitespace-nowrap shrink-0 py-3"
          >
            Lector del pizarrón
          </a>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 ml-auto">
            {/* View Tabs on the right (no loose gray buttons) */}
            {phase === "review" && (
              <nav
                aria-label="Vistas del pizarrón"
                className="flex items-center gap-5 overflow-x-auto self-stretch"
              >
                {REVIEW_TABS.map((tab) => {
                  const active = viewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setViewMode(tab.id)}
                      className={`relative py-4 text-[14px] font-semibold whitespace-nowrap cursor-pointer border-b-2 transition-colors ${
                        active
                          ? "text-[#0b6e78] border-[#0b6e78]"
                          : "text-[#5b6c70] border-transparent hover:text-[#15262b]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-2 shrink-0 py-2">
              {phase !== "upload" && (
                <button
                  type="button"
                  onClick={handleResetToUpload}
                  disabled={isReading}
                  className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#5b6c70]" />
                  <span className="hidden sm:inline">Subir otra foto</span>
                  <span className="sm:hidden">Nueva foto</span>
                </button>
              )}

              {phase === "review" && (
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  disabled={rows.length === 0}
                  className="office-btn-primary inline-flex items-center gap-1.5 px-4 text-[13px] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Hidden file input shared across views */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Week Selector & Color Guide */}
        <section className="office-card px-4 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Monday Date Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <label
                htmlFor="monday-date-input"
                className="text-[13px] font-semibold text-[#15262b] whitespace-nowrap"
              >
                Lunes de la semana:
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="monday-date-input"
                  type="date"
                  value={mondayDate}
                  onChange={(e) => {
                    if (e.target.value) setMondayDate(e.target.value);
                  }}
                  className="office-control px-3 text-[13px] tabular-nums font-medium"
                />
                <span className="text-[13px] text-[#5b6c70] tabular-nums">
                  {mondayDisplay} al {fridayDisplay}
                </span>
              </div>

              {!mondayValid && (
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#15262b] bg-[#fff3bf] border border-[#d5dee0] rounded-[8px] px-2.5 py-1.5">
                  <span>Esta fecha no es lunes.</span>
                  <button
                    type="button"
                    onClick={() => setMondayDate(suggestedMonday)}
                    className="font-semibold text-[#0b6e78] underline hover:text-[#095a62] cursor-pointer"
                  >
                    Cambiar al lunes {formatDateDDMMYYYY(suggestedMonday, 0)}
                  </button>
                </div>
              )}
            </div>

            {/* Marker Color Guide (12px squares next to names, never background) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#5b6c70] border-t lg:border-t-0 pt-2.5 lg:pt-0 border-[#d5dee0]">
              <span className="font-semibold text-[#15262b]">Colores:</span>
              {CALL_COLOR_LEGEND.map((item) => (
                <span
                  key={item.code}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span
                    className="w-3 h-3 rounded-[2px] shrink-0 inline-block"
                    style={{ backgroundColor: item.swatchColor }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-[#15262b]">
                    {item.code}
                  </span>
                  <span>{item.colorLabel}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* PHASE 1: Upload or Paste + Configurable Specials Panel */}
        {phase === "upload" && (
          <div className="space-y-4">
            <SpecialsConfigPanel
              especialesConfig={especialesConfig}
              onChangeFormat={handleChangeOperatorFormat}
              onResetDefaults={handleResetSpecialsDefaults}
            />

            <section className="office-card p-6 sm:p-10">
              <div className="max-w-2xl mx-auto">
                <h1 className="text-[20px] sm:text-[22px] font-semibold text-[#15262b] text-center">
                  Sube la foto del pizarrón semanal
                </h1>
                <p className="text-[14px] text-[#5b6c70] text-center mt-1.5">
                  Después podrás recortar solo el pizarrón antes de leer los números. La foto no se guarda en ningún lado.
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  className={`mt-6 border-2 border-dashed rounded-[12px] p-8 sm:p-10 text-center transition-colors ${
                    isDraggingFile
                      ? "border-[#0b6e78] bg-[#e1f0f1]/50"
                      : "border-[#cfd8db] bg-[#f8fafa] hover:border-[#8a989b]"
                  }`}
                >
                  <div className="w-11 h-11 rounded-[8px] bg-white border border-[#dfe6e8] flex items-center justify-center mx-auto text-[#0b6e78]">
                    <ImageIcon className="w-5 h-5" />
                  </div>

                  <p className="mt-3.5 text-[15px] font-semibold text-[#15262b]">
                    Arrastra la foto aquí o selecciónala desde tu equipo
                  </p>
                  <p className="mt-1 text-[13px] text-[#5b6c70]">
                    También puedes pegar una imagen directamente con{" "}
                    <kbd className="px-1.5 py-0.5 text-[12px] tabular-nums bg-white border border-[#cfd8db] rounded-[4px] text-[#15262b]">
                      Ctrl + V
                    </kbd>
                  </p>

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="office-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 text-[14px] whitespace-nowrap cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Elegir foto</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartManual}
                      className="office-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 text-[14px] whitespace-nowrap cursor-pointer"
                    >
                      <Keyboard className="w-4 h-4 text-[#5b6c70]" />
                      <span>Cargar números a mano</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PHASE 2: Crop + Accessible Specials Config before reading */}
        {phase === "crop" && sourceImageSrc && (
          <div className="space-y-4">
            <div className="office-card px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-[13px]">
                <SlidersHorizontal className="w-4 h-4 text-[#0b6e78]" />
                <span className="font-semibold text-[#15262b]">
                  Especiales de esta semana:
                </span>
                <span className="status-pill-ok tabular-nums">
                  {configuredSpecialsCount}{" "}
                  {configuredSpecialsCount === 1
                    ? "configurado"
                    : "configurados"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCropSpecials((prev) => !prev)}
                className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[12px] cursor-pointer"
              >
                <span>
                  {showCropSpecials
                    ? "Ocultar configuración"
                    : "Revisar o cambiar especiales"}
                </span>
                {showCropSpecials ? (
                  <ChevronUp className="w-4 h-4 text-[#5b6c70]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#5b6c70]" />
                )}
              </button>
            </div>

            {showCropSpecials && (
              <SpecialsConfigPanel
                especialesConfig={especialesConfig}
                onChangeFormat={handleChangeOperatorFormat}
                onResetDefaults={handleResetSpecialsDefaults}
                compact
              />
            )}

            <ImageCropper
              imageSrc={sourceImageSrc}
              isLoading={isReading}
              onCancel={() => fileInputRef.current?.click()}
              onConfirmCrop={handleConfirmCrop}
            />
          </div>
        )}

        {/* PHASE 3: Review & Edit */}
        {phase === "review" && (
          <div className="space-y-4">
            {/* Error Banner if Gemini failed */}
            {readError && (
              <div
                role="alert"
                className="office-card border-[#b42318]/40 bg-[#fdecea] text-[#b42318] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-[#b42318] shrink-0 mt-0.5" />
                  <p className="text-[13px] font-medium">{readError}</p>
                </div>
                {sourceImageSrc && (
                  <button
                    type="button"
                    onClick={() => {
                      setReadError(null);
                      setPhase("crop");
                    }}
                    className="text-[13px] font-semibold text-[#b42318] underline self-start sm:self-center whitespace-nowrap cursor-pointer"
                  >
                    Reintentar lectura
                  </button>
                )}
              </div>
            )}

            {/* Status Summary & Contextual Controls */}
            <div className="office-card px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="status-pill-ok tabular-nums">
                  {validCount} cuadran
                </span>
                <span
                  className={
                    reviewCount > 0
                      ? "status-pill-review tabular-nums"
                      : "status-pill-ok tabular-nums"
                  }
                >
                  {reviewCount} por revisar
                </span>
                <span className="text-[12px] text-[#5b6c70] tabular-nums">
                  · {rows.length} {rows.length === 1 ? "casilla" : "casillas"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {sourceImageSrc && (
                  <button
                    type="button"
                    onClick={() => setPhase("crop")}
                    className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] whitespace-nowrap cursor-pointer"
                  >
                    <Crop className="w-4 h-4 text-[#5b6c70]" />
                    <span>Ajustar recorte</span>
                  </button>
                )}

                {croppedDataUrl && viewMode !== "ranking" && (
                  <button
                    type="button"
                    onClick={() => setShowMobilePhoto((prev) => !prev)}
                    className="lg:hidden office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] whitespace-nowrap cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-[#5b6c70]" />
                    <span>
                      {showMobilePhoto ? "Ocultar foto" : "Ver foto"}
                    </span>
                  </button>
                )}

                {viewMode === "table" && (
                  <>
                    <div className="inline-flex items-center border border-[#cfd8db] rounded-[8px] overflow-hidden bg-white min-h-[36px]">
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className={`px-2.5 h-[34px] text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          filter === "all"
                            ? "bg-[#e1f0f1] text-[#0b6e78]"
                            : "text-[#5b6c70] hover:text-[#15262b]"
                        }`}
                      >
                        Todas ({rows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("review")}
                        className={`px-2.5 h-[34px] text-[12px] font-semibold border-l border-[#d5dee0] transition-colors whitespace-nowrap cursor-pointer ${
                          filter === "review"
                            ? "bg-[#fdecea] text-[#b42318]"
                            : "text-[#5b6c70] hover:text-[#15262b]"
                        }`}
                      >
                        Revisar ({reviewCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("valid")}
                        className={`px-2.5 h-[34px] text-[12px] font-semibold border-l border-[#d5dee0] transition-colors whitespace-nowrap cursor-pointer ${
                          filter === "valid"
                            ? "bg-[#e1f0f1] text-[#0b6e78]"
                            : "text-[#5b6c70] hover:text-[#15262b]"
                        }`}
                      >
                        Cuadran ({validCount})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleSort}
                      disabled={rows.length < 2}
                      className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <ArrowUpDown className="w-4 h-4 text-[#5b6c70]" />
                      <span>
                        {sortMode === "operator" ? "Por día" : "Por operador"}
                      </span>
                    </button>

                    <div className="inline-flex items-center border border-[#cfd8db] rounded-[8px] bg-white overflow-hidden min-h-[36px]">
                      <select
                        value={selectedOpToAdd}
                        onChange={(e) =>
                          setSelectedOpToAdd(Number(e.target.value))
                        }
                        aria-label="Número de operador para agregar semana completa"
                        className="px-2 h-[34px] text-[13px] tabular-nums font-semibold text-[#15262b] bg-[#f8fafa] border-r border-[#d5dee0] focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 22 }, (_, i) => i + 1).map(
                          (num) => (
                            <option key={num} value={num}>
                              Op. {num}
                            </option>
                          )
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddOperatorWeek(selectedOpToAdd)}
                        className="inline-flex items-center gap-1 px-3 h-[34px] text-[13px] font-medium text-[#15262b] hover:bg-[#f3f6f6] whitespace-nowrap cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#0b6e78]" />
                        <span>Semana completa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddRow}
                      title="Agregar una sola fila"
                      className="office-btn-secondary inline-flex items-center gap-1 px-2.5 text-[13px] whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#5b6c70]" />
                      <span>1 día</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile collapsible photo */}
            {croppedDataUrl && showMobilePhoto && viewMode !== "ranking" && (
              <div className="lg:hidden">
                <CroppedPhotoViewer croppedDataUrl={croppedDataUrl} />
              </div>
            )}

            {/* Main Content */}
            {viewMode === "ranking" ? (
              <RankingView
                rows={rows}
                onSelectOperator={() => setViewMode("matrix")}
                onDownloadExcel={handleDownloadClick}
              />
            ) : (
              <div
                className={
                  croppedDataUrl
                    ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start"
                    : "block"
                }
              >
                <div className="min-w-0">
                  {viewMode === "pizarron" ? (
                    <PizarronBoardView
                      rows={rows}
                      especialesConfig={especialesConfig}
                      nextOperatorNumber={selectedOpToAdd}
                      onUpdateRow={handleUpdateRow}
                      onUpsertCell={handleUpsertCell}
                      onChangeOperatorFormat={handleChangeOperatorFormat}
                      onAddOperatorWeek={handleAddOperatorWeek}
                      onAddMultipleOperators={handleAddMultipleOperators}
                      onRemoveOperator={handleRemoveOperator}
                    />
                  ) : viewMode === "matrix" ? (
                    <OperatorMatrixView
                      rows={rows}
                      especialesConfig={especialesConfig}
                      onChangeOperatorFormat={handleChangeOperatorFormat}
                      onUpdateRow={handleUpdateRow}
                      onUpsertCell={handleUpsertCell}
                      onRemoveOperator={handleRemoveOperator}
                      onAddOperatorWeek={handleAddOperatorWeek}
                      onAddMultipleOperators={handleAddMultipleOperators}
                      nextOperatorNumber={selectedOpToAdd}
                    />
                  ) : (
                    <BoardTable
                      rows={filteredRows}
                      totalRowsCount={rows.length}
                      nextOperatorNumber={selectedOpToAdd}
                      onUpdateRow={handleUpdateRow}
                      onDeleteRow={handleDeleteRow}
                      onAddRow={handleAddRow}
                      onAddOperatorWeek={handleAddOperatorWeek}
                    />
                  )}
                </div>

                {croppedDataUrl && (
                  <aside className="hidden lg:block sticky top-[72px]">
                    <CroppedPhotoViewer croppedDataUrl={croppedDataUrl} />
                  </aside>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Modal for downloading with review rows */}
      {confirmDownloadOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#15262b]/35 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-download-title"
        >
          <div className="office-card max-w-md w-full p-5">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="confirm-download-title"
                className="text-[16px] font-semibold text-[#15262b]"
              >
                Hay {reviewCount} {reviewCount === 1 ? "fila" : "filas"} por revisar. ¿Descargar igual?
              </h2>
              <button
                type="button"
                onClick={() => setConfirmDownloadOpen(false)}
                aria-label="Cerrar aviso"
                className="p-1 text-[#5b6c70] hover:text-[#15262b] rounded-[8px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[13px] text-[#5b6c70] mt-2">
              Las casillas marcadas en rojo tienen diferencias entre el total calculado y el total escrito, o tienen una duda pendiente.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDownloadOpen(false)}
                className="office-btn-secondary px-4 text-[13px] cursor-pointer"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmDownloadAnyway}
                className="office-btn-primary px-4 text-[13px] cursor-pointer"
              >
                Descargar igual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
