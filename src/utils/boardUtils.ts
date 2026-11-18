import {
  AbsenceType,
  ApiBoardRow,
  BoardRow,
  createDefaultSpecialsConfig,
  DAYS,
  DayName,
  SPECIAL_FORMAT_FIELDS,
  SpecialFieldKey,
  SpecialFormat,
  SpecialsConfig,
} from "../types/board";

const SPECIALS_STORAGE_KEY = "lector_pizarron_especiales_v1";
const VALID_SPECIAL_FORMATS: SpecialFormat[] = [
  "ninguno",
  "doctora",
  "oficinas",
  "cruz",
  "dos",
];

export function isValidSpecialFormat(val: unknown): val is SpecialFormat {
  return (
    typeof val === "string" &&
    VALID_SPECIAL_FORMATS.includes(val as SpecialFormat)
  );
}

export function loadSpecialsConfig(): SpecialsConfig {
  const defaults = createDefaultSpecialsConfig();
  try {
    const raw = window.localStorage.getItem(SPECIALS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return defaults;
    const result: SpecialsConfig = { ...defaults };
    for (let i = 1; i <= 22; i++) {
      const candidate = parsed[String(i)];
      if (isValidSpecialFormat(candidate)) {
        result[i] = candidate;
      }
    }
    return result;
  } catch {
    return defaults;
  }
}

export function saveSpecialsConfig(config: SpecialsConfig): void {
  try {
    window.localStorage.setItem(SPECIALS_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function detectPopulatedSpecialFields(
  row: BoardRow
): SpecialFieldKey[] {
  if (row.clarificaciones > 0 || row.referidos > 0 || row.ordenes > 0) {
    return ["clarificaciones", "referidos", "ordenes"];
  }
  if (row.perdidas > 0) {
    return ["oficinas", "farmacias", "perdidas", "anotadas"];
  }
  if (row.oficinas > 0 || row.anotadas > 0) {
    return ["oficinas", "farmacias", "anotadas"];
  }
  if (row.farmacias > 0 || row.especialistas > 0) {
    return ["farmacias", "especialistas"];
  }
  return [];
}

/**
 * Reubica los números especiales de una fila en orden (1.º, 2.º, 3.º, 4.º)
 * cuando cambia el formato configurado de un operador después de leer la foto.
 */
export function remapRowSpecials(
  row: BoardRow,
  oldFormat: SpecialFormat,
  newFormat: SpecialFormat
): BoardRow {
  if (oldFormat === newFormat) return row;

  const sourceFields =
    oldFormat !== "ninguno"
      ? SPECIAL_FORMAT_FIELDS[oldFormat]
      : detectPopulatedSpecialFields(row);

  const orderedValues = sourceFields.map((key) => row[key]);

  const cleared: BoardRow = {
    ...row,
    clarificaciones: 0,
    referidos: 0,
    ordenes: 0,
    oficinas: 0,
    farmacias: 0,
    especialistas: 0,
    perdidas: 0,
    anotadas: 0,
  };

  const targetFields = SPECIAL_FORMAT_FIELDS[newFormat];
  for (let i = 0; i < targetFields.length && i < orderedValues.length; i++) {
    cleared[targetFields[i]] = orderedValues[i];
  }

  return cleared;
}

export function getSpecialFormatForDisplay(
  row: BoardRow,
  configuredFormat: SpecialFormat
): SpecialFormat {
  if (configuredFormat !== "ninguno") return configuredFormat;
  if (row.clarificaciones > 0 || row.referidos > 0 || row.ordenes > 0) {
    return "doctora";
  }
  if (row.perdidas > 0) return "cruz";
  if (row.oficinas > 0 || row.anotadas > 0) return "oficinas";
  if (row.farmacias > 0 || row.especialistas > 0) return "dos";
  return "ninguno";
}

export function formatSpecialNotation(
  row: BoardRow,
  configuredFormat: SpecialFormat
): string | null {
  const effective = getSpecialFormatForDisplay(row, configuredFormat);
  const totalSpec = calcSpecials(row);
  if (effective === "ninguno" || totalSpec === 0) return null;

  if (effective === "doctora") {
    return `${row.clarificaciones} / ${row.referidos}-${row.ordenes}`;
  }
  if (effective === "oficinas") {
    return `${row.oficinas} / ${row.farmacias}-${row.anotadas}`;
  }
  if (effective === "dos") {
    return `${row.farmacias} | ${row.especialistas}`;
  }
  if (effective === "cruz") {
    return `${row.oficinas}·${row.farmacias} / ${row.perdidas}·${row.anotadas}`;
  }
  return null;
}

export function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diffToMonday
  );
  return formatLocalISO(monday);
}

export function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(isoDate: string): Date | null {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isMondayISO(isoDate: string): boolean {
  const d = parseISODateLocal(isoDate);
  return d !== null && d.getDay() === 1;
}

export function snapToMondayISO(isoDate: string): string {
  const d = parseISODateLocal(isoDate);
  if (!d) return getMondayOfCurrentWeek();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + diffToMonday
  );
  return formatLocalISO(monday);
}

export function addDaysToISO(isoDate: string, offsetDays: number): Date {
  const base =
    parseISODateLocal(isoDate) ?? parseISODateLocal(getMondayOfCurrentWeek())!;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offsetDays
  );
}

export function formatDateMMDDYYYY(
  mondayISO: string,
  dayOffset: number
): string {
  const d = addDaysToISO(mondayISO, dayOffset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDateDDMMYYYY(
  mondayISO: string,
  dayOffset: number
): string {
  const d = addDaysToISO(mondayISO, dayOffset);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function getDayOffset(dia: DayName): number {
  const idx = DAYS.indexOf(dia);
  return idx >= 0 ? idx : 0;
}

export function calcSpecials(row: BoardRow): number {
  return (
    row.clarificaciones +
    row.referidos +
    row.ordenes +
    row.oficinas +
    row.farmacias +
    row.especialistas +
    row.perdidas +
    row.anotadas
  );
}

export function calcTotal(row: BoardRow): number {
  // AP NO suma al total
  return row.NP + row.NC + row.EP + row.MED + row.CP + calcSpecials(row);
}

export function isRowValid(row: BoardRow): boolean {
  const hasDuda = row.duda.trim().length > 0;
  if (hasDuda) return false;

  const totalCalculado = calcTotal(row);

  if (row.ausencia !== "") {
    return totalCalculado === 0 && row.AP === 0 && row.total_escrito === null;
  }

  return row.total_escrito !== null && totalCalculado === row.total_escrito;
}

export function hasTotalMismatch(row: BoardRow): boolean {
  if (row.ausencia !== "") {
    return calcTotal(row) !== 0 || row.AP !== 0 || row.total_escrito !== null;
  }
  if (row.total_escrito === null) return true;
  return calcTotal(row) !== row.total_escrito;
}

export function normalizeAbsence(raw: string): AbsenceType {
  const clean = (raw ?? "").trim().toLowerCase();
  if (!clean) return "";
  if (clean.includes("perm")) return "Permiso";
  if (clean.includes("falt") || clean === "f") return "Faltó";
  if (clean.includes("vac")) return "Vacaciones";
  if (clean.includes("lib")) return "Libre";
  return "";
}

export function normalizeDay(raw: string): DayName {
  const clean = (raw ?? "").trim().toLowerCase();
  if (clean.startsWith("lun")) return "Lunes";
  if (clean.startsWith("mar")) return "Martes";
  if (clean.startsWith("mi")) return "Miércoles";
  if (clean.startsWith("jue")) return "Jueves";
  if (clean.startsWith("vie")) return "Viernes";
  return "Lunes";
}

function toSafeInt(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

export function normalizeApiRow(raw: ApiBoardRow, index: number): BoardRow {
  const ausencia = normalizeAbsence(raw.ausencia);
  const rawTotal = raw.total_escrito;
  const totalEscrito =
    rawTotal === null ||
    rawTotal === undefined ||
    Number.isNaN(Number(rawTotal)) ||
    Number(rawTotal) < 0
      ? null
      : Math.round(Number(rawTotal));

  const numeroRaw = Number(raw.numero);
  const numero =
    Number.isFinite(numeroRaw) && numeroRaw >= 1
      ? Math.round(numeroRaw)
      : 1;

  return {
    id: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    numero,
    dia: normalizeDay(raw.dia),
    NP: toSafeInt(raw.NP),
    NC: toSafeInt(raw.NC),
    EP: toSafeInt(raw.EP),
    MED: toSafeInt(raw.MED),
    CP: toSafeInt(raw.CP),
    AP: toSafeInt(raw.AP),
    clarificaciones: toSafeInt(raw.clarificaciones),
    referidos: toSafeInt(raw.referidos),
    ordenes: toSafeInt(raw.ordenes),
    oficinas: toSafeInt(raw.oficinas),
    farmacias: toSafeInt(raw.farmacias),
    especialistas: toSafeInt(raw.especialistas),
    perdidas: toSafeInt(raw.perdidas),
    anotadas: toSafeInt(raw.anotadas),
    total_escrito: totalEscrito,
    ausencia,
    duda: (raw.duda ?? "").trim(),
  };
}

export function createEmptyRow(numero = 1, dia: DayName = "Lunes"): BoardRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    numero,
    dia,
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
    ausencia: "",
    duda: "",
  };
}

export function createOperatorWeekRows(numero = 1): BoardRow[] {
  return DAYS.map((dia) => createEmptyRow(numero, dia));
}

export function getNextAvailableOperatorNumber(rows: BoardRow[]): number {
  const used = new Set(rows.map((r) => r.numero));
  for (let n = 1; n <= 22; n++) {
    if (!used.has(n)) return n;
  }
  return 1;
}

export function sortBoardRows(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => {
    const dayDiff = getDayOffset(a.dia) - getDayOffset(b.dia);
    if (dayDiff !== 0) return dayDiff;
    return a.numero - b.numero;
  });
}

export function sortBoardRowsByOperator(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => {
    if (a.numero !== b.numero) return a.numero - b.numero;
    return getDayOffset(a.dia) - getDayOffset(b.dia);
  });
}
