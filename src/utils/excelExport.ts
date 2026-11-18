import * as XLSX from "xlsx";
import { BoardRow } from "../types/board";
import {
  calcSpecials,
  calcTotal,
  formatDateMMDDYYYY,
  getDayOffset,
  sortBoardRows,
} from "./boardUtils";

const EXCEL_HEADERS = [
  "Fecha",
  "Número",
  "Operador",
  "NP",
  "NC",
  "EP",
  "MED",
  "CP",
  "AP",
  "Clarificaciones",
  "Referidos",
  "Órdenes",
  "Llamadas a oficinas",
  "Farmacias, DI y labs",
  "Especialistas",
  "Llamadas perdidas",
  "Llamadas anotadas",
  "Especiales",
  "Total",
  "Total escrito",
  "Ausencia",
];

export function exportBoardToExcel(rows: BoardRow[], mondayDateISO: string): void {
  const sortedRows = sortBoardRows(rows);

  const worksheetData: (string | number | null)[][] = [EXCEL_HEADERS];

  for (const row of sortedRows) {
    const fechaTexto = formatDateMMDDYYYY(mondayDateISO, getDayOffset(row.dia));
    const especiales = calcSpecials(row);
    const total = calcTotal(row);

    worksheetData.push([
      fechaTexto,
      row.numero,
      "", // Operador: VACÍO siempre
      row.NP,
      row.NC,
      row.EP,
      row.MED,
      row.CP,
      row.AP,
      row.clarificaciones,
      row.referidos,
      row.ordenes,
      row.oficinas,
      row.farmacias,
      row.especialistas,
      row.perdidas,
      row.anotadas,
      especiales,
      total,
      row.total_escrito === null ? "" : row.total_escrito,
      row.ausencia,
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Enforce exact cell types so Fecha stays TEXT ("s") in mm/dd/aaaa and Total escrito stays empty when missing
  for (let r = 1; r <= sortedRows.length; r++) {
    const fechaAddress = XLSX.utils.encode_cell({ r, c: 0 });
    if (worksheet[fechaAddress]) {
      worksheet[fechaAddress].t = "s";
      worksheet[fechaAddress].z = "@";
    }

    const totalEscritoAddress = XLSX.utils.encode_cell({ r, c: 19 });
    if (sortedRows[r - 1].total_escrito === null) {
      delete worksheet[totalEscritoAddress];
    }
  }

  worksheet["!cols"] = [
    { wch: 12 }, // Fecha
    { wch: 9 },  // Número
    { wch: 16 }, // Operador
    { wch: 7 },  // NP
    { wch: 7 },  // NC
    { wch: 7 },  // EP
    { wch: 7 },  // MED
    { wch: 7 },  // CP
    { wch: 7 },  // AP
    { wch: 14 }, // Clarificaciones
    { wch: 11 }, // Referidos
    { wch: 10 }, // Órdenes
    { wch: 19 }, // Llamadas a oficinas
    { wch: 21 }, // Farmacias, DI y labs
    { wch: 13 }, // Especialistas
    { wch: 17 }, // Llamadas perdidas
    { wch: 17 }, // Llamadas anotadas
    { wch: 11 }, // Especiales
    { wch: 9 },  // Total
    { wch: 13 }, // Total escrito
    { wch: 13 }, // Ausencia
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos pizarrón");

  const filename = `Pizarron semana ${mondayDateISO} (lector).xlsx`;
  XLSX.writeFile(workbook, filename);
}
