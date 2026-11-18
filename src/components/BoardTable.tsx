import React from "react";
import { Trash2, Check, Plus } from "lucide-react";
import {
  ABSENCE_OPTIONS,
  AbsenceType,
  BoardRow,
  DAYS,
  DayName,
} from "../types/board";
import { calcTotal, hasTotalMismatch, isRowValid } from "../utils/boardUtils";

interface BoardTableProps {
  rows: BoardRow[];
  totalRowsCount: number;
  nextOperatorNumber: number;
  onUpdateRow: (id: string, patch: Partial<BoardRow>) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
  onAddOperatorWeek: (operatorNumber: number) => void;
}

type NumericFieldKey =
  | "NP"
  | "NC"
  | "EP"
  | "MED"
  | "CP"
  | "AP"
  | "clarificaciones"
  | "referidos"
  | "ordenes"
  | "oficinas"
  | "farmacias"
  | "especialistas"
  | "perdidas"
  | "anotadas";

const NUMERIC_COLUMNS: {
  key: NumericFieldKey;
  label: string;
  title?: string;
  swatchColor?: string;
}[] = [
  { key: "NP", label: "NP", title: "Morado", swatchColor: "#7e22ce" },
  { key: "NC", label: "NC", title: "Naranja", swatchColor: "#ea580c" },
  { key: "EP", label: "EP", title: "Negro", swatchColor: "#15262b" },
  { key: "MED", label: "MED", title: "Azul", swatchColor: "#1d4ed8" },
  { key: "CP", label: "CP", title: "Rojo", swatchColor: "#b42318" },
  {
    key: "AP",
    label: "AP",
    title: "Verde (no suma al total)",
    swatchColor: "#15803d",
  },
  { key: "clarificaciones", label: "Clarificaciones" },
  { key: "referidos", label: "Referidos" },
  { key: "ordenes", label: "Órdenes" },
  { key: "oficinas", label: "Llamadas a oficinas" },
  { key: "farmacias", label: "Farmacias" },
  { key: "especialistas", label: "Especialistas" },
  { key: "perdidas", label: "Llamadas perdidas" },
  { key: "anotadas", label: "Llamadas anotadas" },
];

export const BoardTable: React.FC<BoardTableProps> = ({
  rows,
  totalRowsCount,
  nextOperatorNumber,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onAddOperatorWeek,
}) => {
  const handleNumberChange = (
    id: string,
    field: NumericFieldKey | "numero",
    rawValue: string
  ) => {
    if (rawValue === "") {
      onUpdateRow(id, { [field]: field === "numero" ? 1 : 0 });
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    const min = field === "numero" ? 1 : 0;
    const max = field === "numero" ? 22 : 9999;
    const clamped = Math.max(min, Math.min(max, parsed));
    onUpdateRow(id, { [field]: clamped });
  };

  const handleTotalEscritoChange = (id: string, rawValue: string) => {
    if (rawValue.trim() === "") {
      onUpdateRow(id, { total_escrito: null });
      return;
    }
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    onUpdateRow(id, { total_escrito: Math.max(0, Math.min(9999, parsed)) });
  };

  const handleAbsenceChange = (id: string, value: AbsenceType) => {
    if (value !== "") {
      onUpdateRow(id, {
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
      });
    } else {
      onUpdateRow(id, { ausencia: "" });
    }
  };

  if (rows.length === 0) {
    return (
      <div className="office-card p-8 text-center">
        <p className="text-[15px] font-semibold text-[#15262b]">
          {totalRowsCount === 0
            ? "No hay filas cargadas todavía."
            : "No hay filas que coincidan con este filtro."}
        </p>
        <p className="text-[13px] text-[#5b6c70] mt-1">
          {totalRowsCount === 0
            ? "Agrega la semana completa de un operador (Lunes a Viernes) para cargar los números a mano."
            : "Cambia el filtro de arriba para ver el resto de las filas."}
        </p>
        {totalRowsCount === 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onAddOperatorWeek(nextOperatorNumber)}
              className="office-btn-primary inline-flex items-center gap-1.5 px-4 text-[13px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                Agregar semana completa (Operador {nextOperatorNumber})
              </span>
            </button>
            <button
              type="button"
              onClick={onAddRow}
              className="office-btn-secondary inline-flex items-center gap-1.5 px-3.5 text-[13px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Solo 1 día</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="office-card overflow-hidden">
      <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-20 bg-[#f8fafa] border-b border-[#d5dee0] text-[#15262b]">
            <tr>
              <th className="sticky left-0 z-30 bg-[#f8fafa] px-2.5 py-2.5 text-left font-semibold whitespace-nowrap border-r border-[#d5dee0] min-w-[72px]">
                Número
              </th>
              <th className="sticky left-[72px] z-30 bg-[#f8fafa] px-2.5 py-2.5 text-left font-semibold whitespace-nowrap border-r border-[#d5dee0] min-w-[114px]">
                Día
              </th>

              {NUMERIC_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  title={col.title}
                  className="px-2 py-2.5 text-right font-semibold whitespace-nowrap border-r border-[#dfe6e8] min-w-[68px]"
                >
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {col.swatchColor && (
                      <span
                        className="w-3 h-3 rounded-[2px] shrink-0 inline-block"
                        style={{ backgroundColor: col.swatchColor }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{col.label}</span>
                  </span>
                </th>
              ))}

              <th className="px-2.5 py-2.5 text-right font-semibold whitespace-nowrap border-r border-[#d5dee0] bg-[#f3f6f6] min-w-[120px]">
                Total calculado
              </th>
              <th className="px-2.5 py-2.5 text-right font-semibold whitespace-nowrap border-r border-[#dfe6e8] min-w-[104px]">
                Total escrito
              </th>
              <th className="px-2.5 py-2.5 text-left font-semibold whitespace-nowrap border-r border-[#dfe6e8] min-w-[126px]">
                Ausencia
              </th>
              <th className="px-2.5 py-2.5 text-left font-semibold whitespace-nowrap border-r border-[#dfe6e8] min-w-[210px]">
                Duda
              </th>
              <th className="px-2.5 py-2.5 text-center font-semibold whitespace-nowrap min-w-[70px]">
                Quitar
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#dfe6e8]">
            {rows.map((row) => {
              const valid = isRowValid(row);
              const totalCalculado = calcTotal(row);
              const mismatch = hasTotalMismatch(row);
              const hasDuda = row.duda.trim().length > 0;
              const isAbsence = row.ausencia !== "";

              return (
                <tr
                  key={row.id}
                  className="bg-white hover:bg-[#f8fafa] transition-colors"
                >
                  {/* Número */}
                  <td className="sticky left-0 z-10 bg-white px-2 py-1 border-r border-[#d5dee0]">
                    <input
                      type="number"
                      min={1}
                      max={22}
                      value={row.numero}
                      aria-label="Número de operador"
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        handleNumberChange(row.id, "numero", e.target.value)
                      }
                      className="office-cell-input w-14 px-2 py-1 text-right font-semibold text-[#15262b]"
                    />
                  </td>

                  {/* Día */}
                  <td className="sticky left-[72px] z-10 bg-white px-2 py-1 border-r border-[#d5dee0]">
                    <select
                      value={row.dia}
                      aria-label="Día de la semana"
                      onChange={(e) =>
                        onUpdateRow(row.id, { dia: e.target.value as DayName })
                      }
                      className="office-cell-input w-full px-2 py-1 text-[13px] font-medium text-[#15262b] cursor-pointer"
                    >
                      {DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Numeric Call Columns (0s blank without visible boxes until hover/edit) */}
                  {NUMERIC_COLUMNS.map((col) => {
                    const val = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-1 py-1 border-r border-[#dfe6e8] ${
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
                          aria-label={`${col.label} operador ${row.numero} ${row.dia}`}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            handleNumberChange(row.id, col.key, e.target.value)
                          }
                          className="office-cell-input w-full min-w-[52px] px-2 py-1 text-right font-semibold"
                        />
                      </td>
                    );
                  })}

                  {/* Total calculado + Status Pill */}
                  <td className="px-2.5 py-1 text-right border-r border-[#d5dee0] bg-[#f8fafa]">
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums font-bold text-[14px] text-[#15262b]">
                        {totalCalculado}
                      </span>
                      {valid ? (
                        <span className="status-pill-ok">Cuadra</span>
                      ) : (
                        <span className="status-pill-review">Revisar</span>
                      )}
                    </div>
                  </td>

                  {/* Total escrito */}
                  <td
                    className={`px-1.5 py-1 border-r border-[#dfe6e8] ${
                      isAbsence ? "bg-[#eef2f3]" : ""
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      disabled={isAbsence}
                      placeholder=""
                      value={row.total_escrito === null ? "" : row.total_escrito}
                      aria-label={`Total escrito operador ${row.numero} ${row.dia}`}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        handleTotalEscritoChange(row.id, e.target.value)
                      }
                      className={`office-cell-input w-full min-w-[74px] px-2 py-1 text-right font-semibold ${
                        mismatch && !isAbsence
                          ? "!border-[#b42318] text-[#b42318]"
                          : ""
                      }`}
                    />
                  </td>

                  {/* Ausencia */}
                  <td className="px-1.5 py-1 border-r border-[#dfe6e8]">
                    <select
                      value={row.ausencia}
                      aria-label={`Ausencia operador ${row.numero} ${row.dia}`}
                      onChange={(e) =>
                        handleAbsenceChange(
                          row.id,
                          e.target.value as AbsenceType
                        )
                      }
                      className="office-cell-input w-full px-2 py-1 text-[13px] text-[#15262b] cursor-pointer"
                    >
                      {ABSENCE_OPTIONS.map((opt) => (
                        <option key={opt || "none"} value={opt}>
                          {opt === "" ? "" : opt}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Duda */}
                  <td className="px-1.5 py-1 border-r border-[#dfe6e8]">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={row.duda}
                        placeholder=""
                        aria-label={`Duda operador ${row.numero} ${row.dia}`}
                        onChange={(e) =>
                          onUpdateRow(row.id, { duda: e.target.value })
                        }
                        className={`office-cell-input w-full px-2 py-1 text-[13px] ${
                          hasDuda
                            ? "!border-[#b42318] bg-[#fff3bf]/40 text-[#b42318] font-medium"
                            : ""
                        }`}
                      />
                      {hasDuda && (
                        <button
                          type="button"
                          onClick={() => onUpdateRow(row.id, { duda: "" })}
                          title="Marcar duda como resuelta"
                          aria-label="Marcar duda como resuelta"
                          className="office-btn-secondary p-1.5 text-[#0b6e78] border-[#0b6e78]/40 shrink-0 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Quitar fila */}
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.id)}
                      title="Eliminar fila"
                      aria-label={`Eliminar fila operador ${row.numero} ${row.dia}`}
                      className="p-2 text-[#8a989b] hover:text-[#b42318] rounded-[8px] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
