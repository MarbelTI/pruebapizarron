import React from "react";
import { RotateCcw } from "lucide-react";
import {
  SPECIAL_FORMAT_OPTIONS,
  SpecialFormat,
  SpecialsConfig,
} from "../types/board";

interface SpecialsConfigPanelProps {
  especialesConfig: SpecialsConfig;
  onChangeFormat: (numero: number, format: SpecialFormat) => void;
  onResetDefaults: () => void;
  compact?: boolean;
}

export const SpecialsConfigPanel: React.FC<SpecialsConfigPanelProps> = ({
  especialesConfig,
  onChangeFormat,
  onResetDefaults,
  compact = false,
}) => {
  const activeCount = Object.values(especialesConfig).filter(
    (fmt) => fmt !== "ninguno"
  ).length;

  return (
    <section className="office-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#d5dee0]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-[#15262b]">
              Especiales de esta semana
            </h2>
            <span className="status-pill-ok tabular-nums">
              {activeCount} {activeCount === 1 ? "configurado" : "configurados"}
            </span>
          </div>
          <p className="text-[12px] text-[#5b6c70] mt-0.5">
            Define qué operadores anotan números especiales antes de leer la foto. Lo que elijas queda guardado para la próxima semana.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="office-btn-secondary inline-flex items-center gap-1.5 px-3 text-[12px] self-start sm:self-center cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#5b6c70]" />
          <span>Restablecer predeterminados</span>
        </button>
      </div>

      {/* Format Quick Reference */}
      {!compact && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-[12px]">
          <div className="border border-[#dfe6e8] rounded-[8px] px-3 py-2 bg-[#f8fafa]">
            <div className="font-semibold text-[#15262b]">
              Doctora (3) · <span className="tabular-nums text-[#0b6e78]">X / Y-Z</span>
            </div>
            <div className="text-[#5b6c70] mt-0.5">
              Arriba: Clarificaciones · Abajo izq.: Referidos · Abajo der.: Órdenes
            </div>
          </div>
          <div className="border border-[#dfe6e8] rounded-[8px] px-3 py-2 bg-[#f8fafa]">
            <div className="font-semibold text-[#15262b]">
              Oficinas (3) · <span className="tabular-nums text-[#0b6e78]"># / #-#</span>
            </div>
            <div className="text-[#5b6c70] mt-0.5">
              Arriba: Oficinas · Abajo izq.: Farmacias, DI y labs · Abajo der.: Anotadas
            </div>
          </div>
          <div className="border border-[#dfe6e8] rounded-[8px] px-3 py-2 bg-[#f8fafa]">
            <div className="font-semibold text-[#15262b]">
              Cruz (4) · <span className="text-[#0b6e78]">Mini cruz</span>
            </div>
            <div className="text-[#5b6c70] mt-0.5">
              Arriba: Oficinas / Farmacias · Abajo: Perdidas / Anotadas
            </div>
          </div>
          <div className="border border-[#dfe6e8] rounded-[8px] px-3 py-2 bg-[#f8fafa]">
            <div className="font-semibold text-[#15262b]">
              Dos números · <span className="tabular-nums text-[#0b6e78]">A | B</span>
            </div>
            <div className="text-[#5b6c70] mt-0.5">
              A: Farmacias, DI y labs · B: Especialistas
            </div>
          </div>
        </div>
      )}

      {/* 1..22 Operator Selector Grid */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {Array.from({ length: 22 }, (_, idx) => idx + 1).map((num) => {
          const current = especialesConfig[num] ?? "ninguno";
          const isConfigured = current !== "ninguno";
          return (
            <div
              key={num}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[8px] border transition-colors ${
                isConfigured
                  ? "bg-[#e1f0f1]/55 border-[#0b6e78]/35"
                  : "bg-white border-[#dfe6e8]"
              }`}
            >
              <label
                htmlFor={`esp-op-${num}`}
                className={`text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                  isConfigured ? "text-[#0b6e78]" : "text-[#15262b]"
                }`}
              >
                Op. {num}
              </label>
              <select
                id={`esp-op-${num}`}
                value={current}
                onChange={(e) =>
                  onChangeFormat(num, e.target.value as SpecialFormat)
                }
                className="office-control px-2 text-[12px] font-medium min-w-[138px] cursor-pointer"
              >
                {SPECIAL_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
};
