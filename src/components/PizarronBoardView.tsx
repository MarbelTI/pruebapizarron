import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  ABSENCE_OPTIONS,
  AbsenceType,
  BoardRow,
  CALL_COLOR_LEGEND,
  DAYS,
  DayName,
  SPECIAL_FIELD_LABELS,
  SPECIAL_FORMAT_FIELDS,
  SPECIAL_FORMAT_OPTIONS,
  SpecialFieldKey,
  SpecialFormat,
  SpecialsConfig,
} from "../types/board";
import {
  calcSpecials,
  calcTotal,
  createEmptyRow,
  detectPopulatedSpecialFields,
  formatSpecialNotation,
  getSpecialFormatForDisplay,
  hasTotalMismatch,
  isRowValid,
} from "../utils/boardUtils";

interface PizarronBoardViewProps {
  rows: BoardRow[];
  especialesConfig: SpecialsConfig;
  nextOperatorNumber: number;
  onUpdateRow: (id: string, patch: Partial<BoardRow>) => void;
  onUpsertCell: (
    numero: number,
    dia: DayName,
    patch: Partial<BoardRow>
  ) => void;
  onChangeOperatorFormat: (numero: number, newFormat: SpecialFormat) => void;
  onAddOperatorWeek: (numero: number) => void;
  onAddMultipleOperators: (numeros: number[]) => void;
  onRemoveOperator: (numero: number) => void;
}

type NumericFieldKey =
  | "NP"
  | "NC"
  | "EP"
  | "MED"
  | "CP"
  | "AP"
  | SpecialFieldKey;

export const PizarronBoardView: React.FC<PizarronBoardViewProps> = ({
  rows,
  especialesConfig,
  nextOperatorNumber,
  onUpdateRow,
  onUpsertCell,
  onChangeOperatorFormat,
  onAddOperatorWeek,
  onAddMultipleOperators,
  onRemoveOperator,
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    numero: number;
    dia: DayName;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickedOps, setPickedOps] = useState<number[]>([]);

  const operatorGroups = useMemo(() => {
    const map = new Map<number, Map<DayName, BoardRow>>();
    for (const row of rows) {
      if (!map.has(row.numero)) {
        map.set(row.numero, new Map());
      }
      map.get(row.numero)!.set(row.dia, row);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([numero, dayMap]) => ({ numero, dayMap }));
  }, [rows]);

  const activeOperatorSet = useMemo(
    () => new Set(operatorGroups.map((g) => g.numero)),
    [operatorGroups]
  );

  const selectedRow: BoardRow | null = useMemo(() => {
    if (!selectedCell) return null;
    const found = rows.find(
      (r) => r.numero === selectedCell.numero && r.dia === selectedCell.dia
    );
    return found ?? createEmptyRow(selectedCell.numero, selectedCell.dia);
  }, [rows, selectedCell]);

  const handleFieldChange = (
    numero: number,
    dia: DayName,
    existingRow: BoardRow | undefined,
    field: NumericFieldKey,
    rawValue: string
  ) => {
    const clean = rawValue.trim();
    const value =
      clean === ""
        ? 0
        : Math.max(0, Math.min(9999, parseInt(clean, 10) || 0));

    if (existingRow) {
      onUpdateRow(existingRow.id, { [field]: value });
    } else {
      onUpsertCell(numero, dia, { [field]: value });
    }
  };

  const handleTotalEscritoChange = (
    numero: number,
    dia: DayName,
    existingRow: BoardRow | undefined,
    rawValue: string
  ) => {
    const clean = rawValue.trim();
    const value =
      clean === ""
        ? null
        : Math.max(0, Math.min(9999, parseInt(clean, 10) || 0));

    if (existingRow) {
      onUpdateRow(existingRow.id, { total_escrito: value });
    } else {
      onUpsertCell(numero, dia, { total_escrito: value });
    }
  };

  const handleAbsenceChange = (
    numero: number,
    dia: DayName,
    existingRow: BoardRow | undefined,
    value: AbsenceType
  ) => {
    const patch: Partial<BoardRow> =
      value !== ""
        ? {
            ausencia: value,
            NP: 0,
            NC: 0,
            EP: 0,
            MED: 0,
            CP: 0,
            AP: 0,
            clarificaciones: 0,
            referidos: 0,
            ordenes: 0,
            oficinas: 0,
            farmacias: 0,
            especialistas: 0,
            perdidas: 0,
            anotadas: 0,
            total_escrito: null,
          }
        : { ausencia: "" };

    if (existingRow) {
      onUpdateRow(existingRow.id, patch);
    } else {
      onUpsertCell(numero, dia, patch);
    }
  };

  const navigateDay = (direction: -1 | 1) => {
    if (!selectedCell) return;
    const dayIdx = DAYS.indexOf(selectedCell.dia);
    const nextIdx = dayIdx + direction;
    if (nextIdx >= 0 && nextIdx < DAYS.length) {
      setSelectedCell({ numero: selectedCell.numero, dia: DAYS[nextIdx] });
      return;
    }
    const opIdx = operatorGroups.findIndex(
      (g) => g.numero === selectedCell.numero
    );
    if (opIdx < 0) return;
    const nextOpIdx = opIdx + direction;
    if (nextOpIdx >= 0 && nextOpIdx < operatorGroups.length) {
      setSelectedCell({
        numero: operatorGroups[nextOpIdx].numero,
        dia: direction === 1 ? DAYS[0] : DAYS[DAYS.length - 1],
      });
    }
  };

  const togglePickOp = (num: number) => {
    setPickedOps((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]
    );
  };

  const handleConfirmMultipleOps = () => {
    if (pickedOps.length > 0) {
      onAddMultipleOperators(pickedOps);
      setPickedOps([]);
    }
    setPickerOpen(false);
  };

  // Determine existing row in state for selectedCell (so updates mutate real row if present)
  const realSelectedRow = selectedCell
    ? rows.find(
        (r) => r.numero === selectedCell.numero && r.dia === selectedCell.dia
      )
    : undefined;

  const selectedOpFormat = selectedCell
    ? especialesConfig[selectedCell.numero] ?? "ninguno"
    : "ninguno";

  const selectedSpecialFields: SpecialFieldKey[] = useMemo(() => {
    if (!selectedRow) return [];
    if (selectedOpFormat !== "ninguno") {
      return SPECIAL_FORMAT_FIELDS[selectedOpFormat];
    }
    return detectPopulatedSpecialFields(selectedRow);
  }, [selectedOpFormat, selectedRow]);

  return (
    <div className="space-y-4">
      {/* Top Toolbar Card */}
      <div className="office-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] text-[#5b6c70]">
            <span className="font-semibold text-[#15262b]">
              Vista pizarrón
            </span>{" "}
            · Haz clic en cualquier casilla para editar sus números.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen((prev) => !prev)}
              className="office-btn-secondary px-3 text-[13px] cursor-pointer whitespace-nowrap"
            >
              Elegir operadores (1–22)
            </button>
            <button
              type="button"
              onClick={() => onAddOperatorWeek(nextOperatorNumber)}
              className="office-btn-primary inline-flex items-center gap-1.5 px-3.5 text-[13px] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Op. {nextOperatorNumber}</span>
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="mt-3 pt-3 border-t border-[#d5dee0]">
            <p className="text-[12px] text-[#5b6c70] mb-2">
              Marca los operadores del 1 al 22 para agregar sus semanas:
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
              {Array.from({ length: 22 }, (_, i) => i + 1).map((num) => {
                const already = activeOperatorSet.has(num);
                const selected = pickedOps.includes(num);
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={already}
                    onClick={() => togglePickOp(num)}
                    className={`py-1.5 text-[12px] tabular-nums font-semibold rounded-[8px] border transition-colors ${
                      already
                        ? "bg-[#f3f6f6] border-[#dfe6e8] text-[#8a989b] cursor-not-allowed"
                        : selected
                        ? "bg-[#0b6e78] border-[#0b6e78] text-white cursor-pointer"
                        : "bg-white border-[#cfd8db] text-[#15262b] hover:bg-[#f3f6f6] cursor-pointer"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPickedOps([]);
                  setPickerOpen(false);
                }}
                className="office-btn-secondary px-3 text-[12px] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pickedOps.length === 0}
                onClick={handleConfirmMultipleOps}
                className="office-btn-primary px-3.5 text-[12px] disabled:opacity-40 cursor-pointer"
              >
                Agregar {pickedOps.length > 0 ? `(${pickedOps.length})` : ""}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compact Cell Editor Panel (kept inside left column so photo on right stays unobstructed) */}
      {selectedCell && selectedRow && (
        <section
          aria-label={`Editar Operador ${selectedCell.numero} ${selectedCell.dia}`}
          className="office-card p-4 border-[#0b6e78]/45"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#d5dee0]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[15px] font-semibold text-[#15262b] tabular-nums">
                Operador {selectedCell.numero} · {selectedCell.dia}
              </h3>
              {realSelectedRow &&
                (isRowValid(realSelectedRow) ? (
                  <span className="status-pill-ok">Cuadra</span>
                ) : (
                  <span className="status-pill-review">Revisar</span>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="pizarron-edit-format"
                  className="text-[12px] font-medium text-[#5b6c70]"
                >
                  Especiales:
                </label>
                <select
                  id="pizarron-edit-format"
                  value={selectedOpFormat}
                  onChange={(e) =>
                    onChangeOperatorFormat(
                      selectedCell.numero,
                      e.target.value as SpecialFormat
                    )
                  }
                  className="office-control px-2 text-[12px] font-medium cursor-pointer"
                >
                  {SPECIAL_FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateDay(-1)}
                  title="Casilla anterior"
                  aria-label="Casilla anterior"
                  className="office-btn-secondary px-2 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#5b6c70]" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateDay(1)}
                  title="Casilla siguiente"
                  aria-label="Casilla siguiente"
                  className="office-btn-secondary px-2 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-[#5b6c70]" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  title="Cerrar panel"
                  aria-label="Cerrar panel de edición"
                  className="office-btn-secondary px-2.5 text-[12px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4 text-[#5b6c70]" />
                  <span>Cerrar</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {/* 6 Standard Call Fields */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {CALL_COLOR_LEGEND.map((item) => {
                const fieldKey = item.code as NumericFieldKey;
                const val = selectedRow[fieldKey];
                const isAbsence = selectedRow.ausencia !== "";
                return (
                  <div key={item.code}>
                    <label
                      htmlFor={`cell-edit-${item.code}`}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#15262b] mb-1"
                    >
                      <span
                        className="w-3 h-3 rounded-[2px] shrink-0 inline-block"
                        style={{ backgroundColor: item.swatchColor }}
                        aria-hidden="true"
                      />
                      <span>{item.code}</span>
                    </label>
                    <input
                      id={`cell-edit-${item.code}`}
                      type="number"
                      min={0}
                      max={9999}
                      disabled={isAbsence}
                      placeholder="0"
                      value={val === 0 ? "" : val}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        handleFieldChange(
                          selectedCell.numero,
                          selectedCell.dia,
                          realSelectedRow,
                          fieldKey,
                          e.target.value
                        )
                      }
                      className="office-control w-full px-2.5 text-center font-semibold tabular-nums disabled:bg-[#f3f6f6] disabled:text-[#8a989b]"
                    />
                  </div>
                );
              })}
            </div>

            {/* Special Fields (only those of the operator's format) */}
            {selectedSpecialFields.length > 0 && (
              <div className="pt-2 border-t border-[#dfe6e8] grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {selectedSpecialFields.map((specKey) => {
                  const val = selectedRow[specKey];
                  const isAbsence = selectedRow.ausencia !== "";
                  return (
                    <div key={specKey}>
                      <label
                        htmlFor={`cell-edit-${specKey}`}
                        className="block text-[12px] font-semibold text-[#5b6c70] mb-1"
                      >
                        {SPECIAL_FIELD_LABELS[specKey]}
                      </label>
                      <input
                        id={`cell-edit-${specKey}`}
                        type="number"
                        min={0}
                        max={9999}
                        disabled={isAbsence}
                        placeholder="0"
                        value={val === 0 ? "" : val}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          handleFieldChange(
                            selectedCell.numero,
                            selectedCell.dia,
                            realSelectedRow,
                            specKey,
                            e.target.value
                          )
                        }
                        className="office-control w-full px-2.5 text-center font-semibold tabular-nums disabled:bg-[#f3f6f6] disabled:text-[#8a989b]"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Totals, Absence, Duda */}
            <div className="pt-2 border-t border-[#dfe6e8] grid grid-cols-1 sm:grid-cols-[120px_130px_150px_minmax(0,1fr)] gap-2.5 items-end">
              <div>
                <span className="block text-[12px] font-medium text-[#5b6c70] mb-1">
                  Total calculado
                </span>
                <div className="min-h-[36px] px-3 rounded-[8px] border border-[#dfe6e8] bg-[#f3f6f6] flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#15262b] tabular-nums">
                    {calcTotal(selectedRow)}
                  </span>
                  {calcSpecials(selectedRow) > 0 && (
                    <span className="text-[11px] text-[#5b6c70] tabular-nums">
                      esp {calcSpecials(selectedRow)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="cell-edit-total-escrito"
                  className="block text-[12px] font-semibold text-[#15262b] mb-1"
                >
                  Total escrito
                </label>
                <input
                  id="cell-edit-total-escrito"
                  type="number"
                  min={0}
                  max={9999}
                  disabled={selectedRow.ausencia !== ""}
                  placeholder="—"
                  value={
                    selectedRow.total_escrito === null
                      ? ""
                      : selectedRow.total_escrito
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    handleTotalEscritoChange(
                      selectedCell.numero,
                      selectedCell.dia,
                      realSelectedRow,
                      e.target.value
                    )
                  }
                  className={`office-control w-full px-2.5 text-center font-semibold tabular-nums disabled:bg-[#f3f6f6] ${
                    realSelectedRow &&
                    hasTotalMismatch(realSelectedRow) &&
                    selectedRow.ausencia === ""
                      ? "border-[#b42318] text-[#b42318]"
                      : ""
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="cell-edit-ausencia"
                  className="block text-[12px] font-semibold text-[#15262b] mb-1"
                >
                  Ausencia
                </label>
                <select
                  id="cell-edit-ausencia"
                  value={selectedRow.ausencia}
                  onChange={(e) =>
                    handleAbsenceChange(
                      selectedCell.numero,
                      selectedCell.dia,
                      realSelectedRow,
                      e.target.value as AbsenceType
                    )
                  }
                  className="office-control w-full px-2.5 text-[13px] cursor-pointer"
                >
                  {ABSENCE_OPTIONS.map((opt) => (
                    <option key={opt || "none"} value={opt}>
                      {opt === "" ? "Sin ausencia" : opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cell-edit-duda"
                  className="block text-[12px] font-semibold text-[#15262b] mb-1"
                >
                  Duda / nota
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="cell-edit-duda"
                    type="text"
                    value={selectedRow.duda}
                    placeholder="Sin dudas"
                    onChange={(e) => {
                      if (realSelectedRow) {
                        onUpdateRow(realSelectedRow.id, {
                          duda: e.target.value,
                        });
                      } else {
                        onUpsertCell(selectedCell.numero, selectedCell.dia, {
                          duda: e.target.value,
                        });
                      }
                    }}
                    className={`office-control w-full px-2.5 text-[13px] ${
                      selectedRow.duda.trim() !== ""
                        ? "border-[#b42318] text-[#b42318]"
                        : ""
                    }`}
                  />
                  {realSelectedRow && selectedRow.duda.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRow(realSelectedRow.id, { duda: "" })
                      }
                      className="office-btn-secondary px-2.5 text-[12px] text-[#0b6e78] border-[#0b6e78]/40 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resuelta</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {operatorGroups.length === 0 ? (
        <div className="office-card p-8 text-center">
          <p className="text-[15px] font-semibold text-[#15262b]">
            No hay operadores cargados todavía.
          </p>
          <p className="text-[13px] text-[#5b6c70] mt-1">
            Agrega un operador o usa el selector de arriba para marcar varios del 1 al 22.
          </p>
          <button
            type="button"
            onClick={() => onAddOperatorWeek(1)}
            className="office-btn-primary mt-4 inline-flex items-center gap-1.5 px-4 text-[13px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Operador 1</span>
          </button>
        </div>
      ) : (
        /* Full Week Whiteboard Table */
        <div className="office-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#d5dee0] bg-[#f8fafa] text-[#15262b]">
                  <th className="sticky left-0 z-10 bg-[#f8fafa] px-3 py-2.5 text-left font-semibold border-r border-[#d5dee0] w-[58px]">
                    Op.
                  </th>
                  {DAYS.map((dia) => (
                    <th
                      key={dia}
                      className="px-2.5 py-2.5 text-left font-semibold border-r border-[#d5dee0] min-w-[162px]"
                    >
                      {dia}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold min-w-[82px]">
                    Semana
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#d5dee0]">
                {operatorGroups.map(({ numero, dayMap }) => {
                  const opRows = Array.from(dayMap.values());
                  const weeklyTotal = opRows.reduce(
                    (acc, r) => acc + calcTotal(r),
                    0
                  );
                  const format = especialesConfig[numero] ?? "ninguno";
                  const formatLabel =
                    format !== "ninguno"
                      ? SPECIAL_FORMAT_OPTIONS.find((o) => o.value === format)
                          ?.label
                      : null;

                  return (
                    <tr key={numero} className="group hover:bg-[#fafcfc]">
                      {/* Operator Number Left Cell */}
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-[#fafcfc] px-2.5 py-2 border-r border-[#d5dee0] align-middle">
                        <div className="flex items-center justify-between gap-1">
                          <div>
                            <div className="text-[14px] font-bold text-[#15262b] tabular-nums leading-tight">
                              {numero}
                            </div>
                            {formatLabel && (
                              <div className="text-[10px] font-medium text-[#0b6e78] leading-tight mt-0.5 whitespace-nowrap">
                                {formatLabel}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveOperator(numero)}
                            title={`Quitar Operador ${numero}`}
                            aria-label={`Quitar Operador ${numero}`}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#8a989b] hover:text-[#b42318] rounded cursor-pointer transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Day Cells */}
                      {DAYS.map((dia) => {
                        const row = dayMap.get(dia);
                        const isSelected =
                          selectedCell?.numero === numero &&
                          selectedCell?.dia === dia;

                        if (!row) {
                          return (
                            <td
                              key={dia}
                              onClick={() => setSelectedCell({ numero, dia })}
                              className={`px-2.5 py-2 border-r border-[#d5dee0] cursor-pointer align-middle transition-colors ${
                                isSelected
                                  ? "bg-[#fff3bf]"
                                  : "bg-white hover:bg-[#f3f6f6]"
                              }`}
                            >
                              <span className="text-[12px] text-[#8a989b] opacity-0 hover:opacity-100 select-none">
                                + Cargar
                              </span>
                            </td>
                          );
                        }

                        const isAbsence = row.ausencia !== "";
                        const totalCalculado = calcTotal(row);
                        const hasActivity =
                          totalCalculado > 0 ||
                          row.AP > 0 ||
                          row.total_escrito !== null;
                        const mismatch = hasTotalMismatch(row);
                        const hasDuda = row.duda.trim().length > 0;
                        const needsRedBorder =
                          !isAbsence && hasActivity && (mismatch || hasDuda);
                        const absenceInvalid = isAbsence && !isRowValid(row);

                        const effectiveFormat = getSpecialFormatForDisplay(
                          row,
                          format
                        );
                        const specialText = formatSpecialNotation(row, format);

                        if (isAbsence) {
                          return (
                            <td
                              key={dia}
                              onClick={() => setSelectedCell({ numero, dia })}
                              className={`px-2.5 py-2 border-r border-[#d5dee0] cursor-pointer align-middle text-center transition-colors ${
                                isSelected
                                  ? "bg-[#fff3bf]"
                                  : "bg-[#eef2f3] hover:bg-[#e5ebed]"
                              } ${
                                absenceInvalid
                                  ? "ring-2 ring-inset ring-[#b42318]"
                                  : ""
                              }`}
                            >
                              <span className="text-[12px] font-medium text-[#5b6c70]">
                                {row.ausencia}
                              </span>
                              {hasDuda && (
                                <div className="text-[10px] font-semibold text-[#b42318] mt-0.5">
                                  duda
                                </div>
                              )}
                            </td>
                          );
                        }

                        const totalColorValues = [
                          { val: row.NP, color: "#7e22ce" },
                          { val: row.NC, color: "#ea580c" },
                          { val: row.EP, color: "#15262b" },
                          { val: row.MED, color: "#1d4ed8" },
                          { val: row.CP, color: "#b42318" },
                          { val: row.AP, color: "#15803d" },
                        ];

                        const hasWrittenMismatch =
                          row.total_escrito !== null &&
                          totalCalculado !== row.total_escrito;
                        const missingWritten =
                          row.total_escrito === null && hasActivity;

                        return (
                          <td
                            key={dia}
                            onClick={() => setSelectedCell({ numero, dia })}
                            className={`px-2.5 py-2 border-r border-[#d5dee0] cursor-pointer align-middle transition-colors ${
                              isSelected
                                ? "bg-[#fff3bf]"
                                : "bg-white hover:bg-[#f8fafa]"
                            } ${
                              needsRedBorder
                                ? "ring-2 ring-inset ring-[#b42318]"
                                : ""
                            }`}
                          >
                            {!hasActivity && !hasDuda ? (
                              <span className="text-[12px] text-[#8a989b]">
                                —
                              </span>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {/* Single line of 6 marker-colored numbers */}
                                  <div className="flex items-center gap-1.5 whitespace-nowrap tabular-nums text-[12px] leading-tight">
                                    {totalColorValues.map((item, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          color:
                                            item.val > 0
                                              ? item.color
                                              : "#c4cfd2",
                                        }}
                                        className={
                                          item.val > 0
                                            ? "font-semibold"
                                            : "font-normal"
                                        }
                                      >
                                        {item.val}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Specials below in smaller gray */}
                                  {specialText && (
                                    <div className="mt-0.5 text-[11px] text-[#5b6c70] tabular-nums leading-tight">
                                      {effectiveFormat === "cruz" ? (
                                        <span className="inline-grid grid-cols-2 border border-[#d5dee0] rounded-[3px] text-[10px] leading-none bg-[#f8fafa]">
                                          <span className="px-1 py-0.5 border-r border-b border-[#d5dee0] text-center">
                                            {row.oficinas}
                                          </span>
                                          <span className="px-1 py-0.5 border-b border-[#d5dee0] text-center">
                                            {row.farmacias}
                                          </span>
                                          <span className="px-1 py-0.5 border-r border-[#d5dee0] text-center">
                                            {row.perdidas}
                                          </span>
                                          <span className="px-1 py-0.5 text-center">
                                            {row.anotadas}
                                          </span>
                                        </span>
                                      ) : (
                                        <span>{specialText}</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Right side: bold total + optional mismatch red note */}
                                <div className="text-right shrink-0">
                                  <div className="text-[14px] font-bold text-[#15262b] tabular-nums leading-tight">
                                    {totalCalculado}
                                  </div>
                                  {hasWrittenMismatch ? (
                                    <div className="text-[10px] font-semibold text-[#b42318] tabular-nums leading-tight mt-0.5 whitespace-nowrap">
                                      escrito {row.total_escrito}
                                    </div>
                                  ) : missingWritten ? (
                                    <div className="text-[10px] font-semibold text-[#b42318] leading-tight mt-0.5 whitespace-nowrap">
                                      sin escrito
                                    </div>
                                  ) : hasDuda ? (
                                    <div className="text-[10px] font-semibold text-[#b42318] leading-tight mt-0.5 whitespace-nowrap">
                                      duda
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Weekly Total Column */}
                      <td className="px-3 py-2 text-right font-bold text-[14px] text-[#15262b] tabular-nums bg-[#f8fafa] align-middle">
                        {weeklyTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
