import React, { useMemo, useState } from "react";
import { Check, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
  detectPopulatedSpecialFields,
  hasTotalMismatch,
  isRowValid,
} from "../utils/boardUtils";

interface OperatorMatrixViewProps {
  rows: BoardRow[];
  especialesConfig: SpecialsConfig;
  onChangeOperatorFormat: (numero: number, newFormat: SpecialFormat) => void;
  onUpdateRow: (id: string, patch: Partial<BoardRow>) => void;
  onUpsertCell: (
    numero: number,
    dia: DayName,
    patch: Partial<BoardRow>
  ) => void;
  onRemoveOperator: (numero: number) => void;
  onAddOperatorWeek: (numero: number) => void;
  onAddMultipleOperators: (numeros: number[]) => void;
  nextOperatorNumber: number;
}

type NumericFieldKey =
  | "NP"
  | "NC"
  | "EP"
  | "MED"
  | "CP"
  | "AP"
  | SpecialFieldKey;

export const OperatorMatrixView: React.FC<OperatorMatrixViewProps> = ({
  rows,
  especialesConfig,
  onChangeOperatorFormat,
  onUpdateRow,
  onUpsertCell,
  onRemoveOperator,
  onAddOperatorWeek,
  onAddMultipleOperators,
  nextOperatorNumber,
}) => {
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

  const handleNumericInput = (
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
    } else if (value > 0) {
      onUpsertCell(numero, dia, { [field]: value });
    }
  };

  const handleTotalEscritoInput = (
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
    } else if (value !== null) {
      onUpsertCell(numero, dia, { total_escrito: value });
    }
  };

  const handleAbsenceInput = (
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
    } else if (value !== "") {
      onUpsertCell(numero, dia, patch);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Multi-Operator Selector Bar */}
      <div className="office-card p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] text-[#5b6c70]">
            <span className="font-semibold text-[#15262b] tabular-nums">
              {operatorGroups.length}{" "}
              {operatorGroups.length === 1 ? "operador" : "operadores"}
            </span>{" "}
            en pantalla · Cada tarjeta muestra Lunes a Viernes y solo los especiales de su formato.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen((prev) => !prev)}
              className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[13px] cursor-pointer whitespace-nowrap"
            >
              <span>Elegir varios operadores (1–22)</span>
              {pickerOpen ? (
                <ChevronUp className="w-4 h-4 text-[#5b6c70]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#5b6c70]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onAddOperatorWeek(nextOperatorNumber)}
              className="office-btn-primary inline-flex items-center gap-1.5 px-3.5 text-[13px] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Operador {nextOperatorNumber}</span>
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="mt-3 pt-3 border-t border-[#d5dee0]">
            <p className="text-[12px] text-[#5b6c70] mb-2">
              Marca los números de operador que aparecen en el pizarrón para crear sus semanas completas de una vez:
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

      {/* Empty State */}
      {operatorGroups.length === 0 && (
        <div className="office-card p-8 text-center">
          <p className="text-[15px] font-semibold text-[#15262b]">
            No hay operadores cargados todavía.
          </p>
          <p className="text-[13px] text-[#5b6c70] mt-1">
            Agrega un operador o usa el selector de arriba para marcar varios números del 1 al 22.
          </p>
          <button
            type="button"
            onClick={() => onAddOperatorWeek(1)}
            className="office-btn-primary mt-4 inline-flex items-center gap-1.5 px-4 text-[13px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Operador 1 (semana completa)</span>
          </button>
        </div>
      )}

      {/* Operator Weekly Matrix Cards */}
      {operatorGroups.map(({ numero, dayMap }) => {
        const opRows = Array.from(dayMap.values());
        const weeklyTotal = opRows.reduce((acc, r) => acc + calcTotal(r), 0);
        const weeklyAP = opRows.reduce((acc, r) => acc + r.AP, 0);
        const weeklySpecials = opRows.reduce(
          (acc, r) => acc + calcSpecials(r),
          0
        );

        const validDays = opRows.filter((r) => isRowValid(r)).length;
        const reviewDays = opRows.length - validDays;
        const hasAnyDuda = opRows.some((r) => r.duda.trim().length > 0);
        const currentFormat: SpecialFormat =
          especialesConfig[numero] ?? "ninguno";

        // Show ONLY the special fields for this operator's format.
        // If Ninguno, show any populated special fields detected unexpectedly by Gemini so nothing is hidden.
        const specialFieldKeys: SpecialFieldKey[] =
          currentFormat !== "ninguno"
            ? SPECIAL_FORMAT_FIELDS[currentFormat]
            : Array.from(
                new Set(
                  opRows.flatMap((r) => detectPopulatedSpecialFields(r))
                )
              );

        return (
          <section key={numero} className="office-card overflow-hidden">
            {/* Operator Header */}
            <div className="px-4 py-3 bg-[#f8fafa] border-b border-[#d5dee0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h3 className="text-[15px] font-semibold text-[#15262b] tabular-nums">
                  Operador {numero}
                </h3>
                <span className="text-[13px] tabular-nums font-semibold text-[#15262b]">
                  Total semana: {weeklyTotal}
                </span>
                {weeklyAP > 0 && (
                  <span className="text-[12px] tabular-nums text-[#5b6c70]">
                    · AP: {weeklyAP}
                  </span>
                )}
                {reviewDays === 0 ? (
                  <span className="status-pill-ok tabular-nums">
                    Cuadra ({validDays})
                  </span>
                ) : (
                  <span className="status-pill-review tabular-nums">
                    Revisar ({reviewDays})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor={`op-format-${numero}`}
                  className="text-[12px] font-medium text-[#5b6c70] whitespace-nowrap"
                >
                  Especiales:
                </label>
                <select
                  id={`op-format-${numero}`}
                  value={currentFormat}
                  onChange={(e) =>
                    onChangeOperatorFormat(
                      numero,
                      e.target.value as SpecialFormat
                    )
                  }
                  className="office-control px-2.5 text-[12px] font-medium cursor-pointer"
                >
                  {SPECIAL_FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemoveOperator(numero)}
                  title={`Quitar Operador ${numero}`}
                  aria-label={`Quitar Operador ${numero}`}
                  className="p-2 text-[#8a989b] hover:text-[#b42318] rounded-[8px] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal 5-Day + Weekly Total Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#d5dee0] bg-white text-[#15262b]">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold border-r border-[#d5dee0] min-w-[146px]">
                      Concepto
                    </th>
                    {DAYS.map((dia) => {
                      const row = dayMap.get(dia);
                      const valid = row ? isRowValid(row) : true;
                      return (
                        <th
                          key={dia}
                          className="px-2 py-2 text-center font-semibold border-r border-[#d5dee0] min-w-[98px]"
                        >
                          <div className="flex flex-col items-center gap-1 leading-tight">
                            <span className="text-[#15262b]">{dia}</span>
                            {row &&
                              (valid ? (
                                <span className="status-pill-ok">Cuadra</span>
                              ) : (
                                <span className="status-pill-review">
                                  Revisar
                                </span>
                              ))}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2 text-right font-semibold bg-[#f8fafa] text-[#15262b] min-w-[90px]">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#dfe6e8]">
                  {/* Standard 6 Marker Color Rows */}
                  {CALL_COLOR_LEGEND.map((field) => {
                    const fieldKey = field.code as NumericFieldKey;
                    const rowSum = opRows.reduce(
                      (acc, r) => acc + r[fieldKey],
                      0
                    );
                    return (
                      <tr key={field.code} className="hover:bg-[#f8fafa]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-[#d5dee0] font-medium text-[#15262b] whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-[2px] shrink-0 inline-block"
                              style={{ backgroundColor: field.swatchColor }}
                              aria-hidden="true"
                            />
                            <span>{field.code}</span>
                            {field.code === "AP" && (
                              <span className="text-[11px] text-[#8a989b] font-normal">
                                (no suma)
                              </span>
                            )}
                          </span>
                        </td>

                        {DAYS.map((dia) => {
                          const cellRow = dayMap.get(dia);
                          const val = cellRow ? cellRow[fieldKey] : 0;
                          const isAbsence = cellRow
                            ? cellRow.ausencia !== ""
                            : false;
                          return (
                            <td
                              key={dia}
                              className={`px-1.5 py-0.5 border-r border-[#dfe6e8] ${
                                isAbsence ? "bg-[#eef2f3]" : ""
                              }`}
                            >
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                disabled={isAbsence}
                                placeholder=""
                                value={val === 0 ? "" : val}
                                aria-label={`${field.code} Op ${numero} ${dia}`}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) =>
                                  handleNumericInput(
                                    numero,
                                    dia,
                                    cellRow,
                                    fieldKey,
                                    e.target.value
                                  )
                                }
                                className="office-cell-input w-full px-2 py-1 text-center font-semibold disabled:text-[#8a989b]"
                              />
                            </td>
                          );
                        })}

                        <td className="px-3 py-1 text-right tabular-nums font-semibold text-[#15262b] bg-[#f8fafa]">
                          {rowSum}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Special Fields (ONLY those belonging to this operator's format) */}
                  {specialFieldKeys.map((specKey) => {
                    const rowSum = opRows.reduce(
                      (acc, r) => acc + r[specKey],
                      0
                    );
                    return (
                      <tr key={specKey} className="hover:bg-[#f8fafa]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-[#d5dee0] font-medium text-[#5b6c70] whitespace-nowrap">
                          {SPECIAL_FIELD_LABELS[specKey]}
                        </td>

                        {DAYS.map((dia) => {
                          const cellRow = dayMap.get(dia);
                          const val = cellRow ? cellRow[specKey] : 0;
                          const isAbsence = cellRow
                            ? cellRow.ausencia !== ""
                            : false;
                          return (
                            <td
                              key={dia}
                              className={`px-1.5 py-0.5 border-r border-[#dfe6e8] ${
                                isAbsence ? "bg-[#eef2f3]" : ""
                              }`}
                            >
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                disabled={isAbsence}
                                placeholder=""
                                value={val === 0 ? "" : val}
                                aria-label={`${SPECIAL_FIELD_LABELS[specKey]} Op ${numero} ${dia}`}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) =>
                                  handleNumericInput(
                                    numero,
                                    dia,
                                    cellRow,
                                    specKey,
                                    e.target.value
                                  )
                                }
                                className="office-cell-input w-full px-2 py-1 text-center font-semibold disabled:text-[#8a989b]"
                              />
                            </td>
                          );
                        })}

                        <td className="px-3 py-1 text-right tabular-nums font-semibold text-[#15262b] bg-[#f8fafa]">
                          {rowSum}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Total Calculado */}
                  <tr className="bg-[#f8fafa] font-semibold border-t border-[#d5dee0]">
                    <td className="sticky left-0 z-10 bg-[#f8fafa] px-3 py-2 border-r border-[#d5dee0] text-[#15262b] whitespace-nowrap">
                      Total calculado
                    </td>
                    {DAYS.map((dia) => {
                      const cellRow = dayMap.get(dia);
                      const dayTotal = cellRow ? calcTotal(cellRow) : 0;
                      const valid = cellRow ? isRowValid(cellRow) : true;
                      return (
                        <td
                          key={dia}
                          className={`px-2 py-2 text-center tabular-nums border-r border-[#d5dee0] ${
                            !cellRow
                              ? "text-[#8a989b]"
                              : valid
                              ? "text-[#0b6e78]"
                              : "text-[#b42318]"
                          }`}
                        >
                          {cellRow ? dayTotal : ""}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums text-[15px] font-bold text-[#15262b]">
                      {weeklyTotal}
                    </td>
                  </tr>

                  {/* Total Escrito */}
                  <tr>
                    <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-[#d5dee0] font-medium text-[#15262b] whitespace-nowrap">
                      Total escrito
                    </td>
                    {DAYS.map((dia) => {
                      const cellRow = dayMap.get(dia);
                      const mismatch = cellRow
                        ? hasTotalMismatch(cellRow)
                        : false;
                      const val = cellRow?.total_escrito ?? null;
                      const isAbsence = cellRow
                        ? cellRow.ausencia !== ""
                        : false;
                      return (
                        <td
                          key={dia}
                          className={`px-1.5 py-0.5 border-r border-[#dfe6e8] ${
                            isAbsence ? "bg-[#eef2f3]" : ""
                          }`}
                        >
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            disabled={isAbsence}
                            placeholder=""
                            value={val === null ? "" : val}
                            aria-label={`Total escrito Op ${numero} ${dia}`}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              handleTotalEscritoInput(
                                numero,
                                dia,
                                cellRow,
                                e.target.value
                              )
                            }
                            className={`office-cell-input w-full px-2 py-1 text-center font-semibold ${
                              cellRow && mismatch && !isAbsence
                                ? "!border-[#b42318] text-[#b42318]"
                                : ""
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 text-right tabular-nums text-[12px] text-[#5b6c70] bg-[#f8fafa]">
                      {weeklySpecials > 0 ? `Esp: ${weeklySpecials}` : ""}
                    </td>
                  </tr>

                  {/* Ausencia */}
                  <tr>
                    <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-[#d5dee0] font-medium text-[#5b6c70] whitespace-nowrap">
                      Ausencia
                    </td>
                    {DAYS.map((dia) => {
                      const cellRow = dayMap.get(dia);
                      return (
                        <td
                          key={dia}
                          className="px-1.5 py-0.5 border-r border-[#dfe6e8]"
                        >
                          <select
                            value={cellRow?.ausencia ?? ""}
                            aria-label={`Ausencia Op ${numero} ${dia}`}
                            onChange={(e) =>
                              handleAbsenceInput(
                                numero,
                                dia,
                                cellRow,
                                e.target.value as AbsenceType
                              )
                            }
                            className="office-cell-input w-full px-1.5 py-1 text-[12px] text-[#15262b] cursor-pointer"
                          >
                            {ABSENCE_OPTIONS.map((opt) => (
                              <option key={opt || "none"} value={opt}>
                                {opt === "" ? "" : opt}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 bg-[#f8fafa]" />
                  </tr>

                  {/* Duda row (only if any day has duda) */}
                  {hasAnyDuda && (
                    <tr className="bg-[#fff3bf]/50">
                      <td className="sticky left-0 z-10 bg-[#fff3bf]/50 px-3 py-1.5 border-r border-[#d5dee0] font-semibold text-[#b42318] whitespace-nowrap">
                        Dudas
                      </td>
                      {DAYS.map((dia) => {
                        const cellRow = dayMap.get(dia);
                        const dudaText = cellRow?.duda ?? "";
                        return (
                          <td
                            key={dia}
                            className="px-1.5 py-1.5 border-r border-[#dfe6e8] align-top"
                          >
                            {cellRow && dudaText.trim() ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={dudaText}
                                  onChange={(e) =>
                                    onUpdateRow(cellRow.id, {
                                      duda: e.target.value,
                                    })
                                  }
                                  className="office-control w-full px-2 py-1 text-[12px] text-[#b42318] border-[#b42318]/50"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateRow(cellRow.id, { duda: "" })
                                  }
                                  className="office-btn-secondary inline-flex items-center justify-center gap-1 px-2 text-[11px] font-semibold text-[#0b6e78] border-[#0b6e78]/40 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Resuelta</span>
                                </button>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 bg-[#f8fafa]" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
};
