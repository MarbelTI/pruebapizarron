import React, { useMemo } from "react";
import { Award, Download } from "lucide-react";
import { BoardRow } from "../types/board";
import { calcSpecials, calcTotal, isRowValid } from "../utils/boardUtils";

interface RankingViewProps {
  rows: BoardRow[];
  onSelectOperator: (numero: number) => void;
  onDownloadExcel: () => void;
}

interface OperatorSummary {
  numero: number;
  NP: number;
  NC: number;
  EP: number;
  MED: number;
  CP: number;
  AP: number;
  especiales: number;
  total: number;
  diasConLlamadas: number;
  ausencias: number;
  promedioDiario: number;
  pendientes: number;
}

export const RankingView: React.FC<RankingViewProps> = ({
  rows,
  onSelectOperator,
  onDownloadExcel,
}) => {
  const summaries = useMemo<OperatorSummary[]>(() => {
    const map = new Map<number, OperatorSummary>();

    for (const row of rows) {
      let item = map.get(row.numero);
      if (!item) {
        item = {
          numero: row.numero,
          NP: 0,
          NC: 0,
          EP: 0,
          MED: 0,
          CP: 0,
          AP: 0,
          especiales: 0,
          total: 0,
          diasConLlamadas: 0,
          ausencias: 0,
          promedioDiario: 0,
          pendientes: 0,
        };
        map.set(row.numero, item);
      }

      const dayTotal = calcTotal(row);
      item.NP += row.NP;
      item.NC += row.NC;
      item.EP += row.EP;
      item.MED += row.MED;
      item.CP += row.CP;
      item.AP += row.AP;
      item.especiales += calcSpecials(row);
      item.total += dayTotal;

      if (row.ausencia !== "") {
        item.ausencias += 1;
      } else if (dayTotal > 0 || row.AP > 0) {
        item.diasConLlamadas += 1;
      }

      if (!isRowValid(row)) {
        item.pendientes += 1;
      }
    }

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      promedioDiario:
        item.diasConLlamadas > 0
          ? Math.round(item.total / item.diasConLlamadas)
          : 0,
    }));

    return list.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.numero - b.numero;
    });
  }, [rows]);

  const topOperator = summaries[0] ?? null;
  const teamTotal = summaries.reduce((acc, s) => acc + s.total, 0);
  const teamAverage =
    summaries.length > 0 ? Math.round(teamTotal / summaries.length) : 0;
  const maxTotal = topOperator && topOperator.total > 0 ? topOperator.total : 1;

  if (summaries.length === 0) {
    return (
      <div className="office-card p-8 text-center">
        <p className="text-[15px] font-semibold text-[#15262b]">
          Todavía no hay datos para calcular el ranking semanal.
        </p>
        <p className="text-[13px] text-[#5b6c70] mt-1">
          Carga los números del pizarrón para ver quién obtuvo los totales más altos de la semana.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="office-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[#5b6c70]">
              Mayor puntaje de la semana
            </span>
            <Award className="w-4 h-4 text-[#0b6e78] shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-[20px] font-bold text-[#15262b] tabular-nums">
              Operador {topOperator?.numero}
            </span>
            <span className="text-[17px] tabular-nums font-bold text-[#0b6e78]">
              {topOperator?.total ?? 0} llamadas
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[#5b6c70] tabular-nums">
            Promedio diario: {topOperator?.promedioDiario ?? 0} · Días:{" "}
            {topOperator?.diasConLlamadas ?? 0}
          </p>
        </div>

        <div className="office-card p-4">
          <span className="text-[12px] font-semibold text-[#5b6c70]">
            Total acumulado del equipo
          </span>
          <div className="mt-2 text-[22px] font-bold tabular-nums text-[#15262b]">
            {teamTotal} llamadas
          </div>
          <p className="mt-1 text-[12px] text-[#5b6c70]">
            Entre {summaries.length}{" "}
            {summaries.length === 1 ? "operador" : "operadores"} (sin contar AP)
          </p>
        </div>

        <div className="office-card p-4 flex flex-col justify-between">
          <div>
            <span className="text-[12px] font-semibold text-[#5b6c70]">
              Promedio semanal por operador
            </span>
            <div className="mt-2 text-[22px] font-bold tabular-nums text-[#15262b]">
              {teamAverage} llamadas
            </div>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={onDownloadExcel}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0b6e78] hover:text-[#095a62] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar resumen en Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="office-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#d5dee0] flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-[#15262b]">
              Ranking semanal por operador
            </h3>
            <p className="text-[12px] text-[#5b6c70]">
              Ordenado del total más alto al más bajo. Haz clic en un operador para editar sus días.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-[#f8fafa] border-b border-[#d5dee0] text-[#15262b]">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap w-16">
                  Puesto
                </th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                  Operador
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  Días
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  NP
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  NC
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  EP
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  MED
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  CP
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  Especiales
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap bg-[#f3f6f6] min-w-[160px]">
                  Total semanal
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-[#5b6c70]">
                  AP
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  Prom./día
                </th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe6e8]">
              {summaries.map((item, idx) => {
                const rank = idx + 1;
                const barWidth = Math.max(
                  4,
                  Math.round((item.total / maxTotal) * 100)
                );
                const isFirst = rank === 1 && item.total > 0;

                return (
                  <tr
                    key={item.numero}
                    onClick={() => onSelectOperator(item.numero)}
                    className={`cursor-pointer transition-colors ${
                      isFirst
                        ? "bg-[#e1f0f1]/45 hover:bg-[#e1f0f1]/75"
                        : "bg-white hover:bg-[#f8fafa]"
                    }`}
                  >
                    <td className="px-3 py-2.5 tabular-nums font-bold text-[#15262b]">
                      #{rank}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[#15262b] whitespace-nowrap">
                      Operador {item.numero}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#5b6c70]">
                      {item.diasConLlamadas}
                      {item.ausencias > 0 && (
                        <span className="text-[11px] text-[#8a989b]">
                          {" "}
                          ({item.ausencias} aus.)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.NP || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.NC || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.EP || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.MED || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.CP || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#15262b]">
                      {item.especiales || ""}
                    </td>
                    <td className="px-3 py-2.5 bg-[#f8fafa]">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="w-20 h-2 bg-[#dfe6e8] rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full ${
                              isFirst ? "bg-[#0b6e78]" : "bg-[#5b6c70]"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="tabular-nums font-bold text-[14px] text-[#15262b]">
                          {item.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#5b6c70]">
                      {item.AP || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#15262b]">
                      {item.promedioDiario}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {item.pendientes === 0 ? (
                        <span className="status-pill-ok">Cuadra</span>
                      ) : (
                        <span className="status-pill-review">
                          Revisar ({item.pendientes})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
