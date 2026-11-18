export type DayName = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes";

export const DAYS: DayName[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
];

export type AbsenceType = "" | "Permiso" | "Faltó" | "Vacaciones" | "Libre";

export const ABSENCE_OPTIONS: AbsenceType[] = [
  "",
  "Permiso",
  "Faltó",
  "Vacaciones",
  "Libre",
];

export type SpecialFormat =
  | "ninguno"
  | "doctora"
  | "oficinas"
  | "cruz"
  | "dos";

export type SpecialFieldKey =
  | "clarificaciones"
  | "referidos"
  | "ordenes"
  | "oficinas"
  | "farmacias"
  | "especialistas"
  | "perdidas"
  | "anotadas";

export type SpecialsConfig = Record<number, SpecialFormat>;

export const SPECIAL_FIELD_LABELS: Record<SpecialFieldKey, string> = {
  clarificaciones: "Clarificaciones",
  referidos: "Referidos",
  ordenes: "Órdenes",
  oficinas: "Llam. oficinas",
  farmacias: "Farmacias, DI y labs",
  especialistas: "Especialistas",
  perdidas: "Llam. perdidas",
  anotadas: "Llam. anotadas",
};

export const SPECIAL_FORMAT_OPTIONS: {
  value: SpecialFormat;
  label: string;
  syntax: string;
  description: string;
  fields: SpecialFieldKey[];
}[] = [
  {
    value: "ninguno",
    label: "Ninguno",
    syntax: "",
    description: "Sin números especiales",
    fields: [],
  },
  {
    value: "doctora",
    label: "Doctora (3)",
    syntax: "X / Y-Z",
    description: "Clarificaciones · Referidos · Órdenes",
    fields: ["clarificaciones", "referidos", "ordenes"],
  },
  {
    value: "oficinas",
    label: "Oficinas (3)",
    syntax: "# / #-#",
    description: "Llam. oficinas · Farmacias, DI y labs · Llam. anotadas",
    fields: ["oficinas", "farmacias", "anotadas"],
  },
  {
    value: "cruz",
    label: "Cruz (4)",
    syntax: "Mini cruz",
    description: "Llam. oficinas · Farmacias, DI y labs · Llam. perdidas · Llam. anotadas",
    fields: ["oficinas", "farmacias", "perdidas", "anotadas"],
  },
  {
    value: "dos",
    label: "Dos números",
    syntax: "A | B",
    description: "Farmacias, DI y labs · Especialistas",
    fields: ["farmacias", "especialistas"],
  },
];

export const SPECIAL_FORMAT_FIELDS: Record<SpecialFormat, SpecialFieldKey[]> = {
  ninguno: [],
  doctora: ["clarificaciones", "referidos", "ordenes"],
  oficinas: ["oficinas", "farmacias", "anotadas"],
  cruz: ["oficinas", "farmacias", "perdidas", "anotadas"],
  dos: ["farmacias", "especialistas"],
};

export function createDefaultSpecialsConfig(): SpecialsConfig {
  const cfg: SpecialsConfig = {};
  for (let i = 1; i <= 22; i++) {
    if (i === 1) cfg[i] = "oficinas";
    else if (i === 6) cfg[i] = "doctora";
    else if (i === 8) cfg[i] = "dos";
    else if (i === 15) cfg[i] = "cruz";
    else cfg[i] = "ninguno";
  }
  return cfg;
}

export const DEFAULT_SPECIALS_CONFIG: SpecialsConfig =
  createDefaultSpecialsConfig();

export interface BoardRow {
  id: string;
  numero: number;
  dia: DayName;
  NP: number;
  NC: number;
  EP: number;
  MED: number;
  CP: number;
  AP: number;
  clarificaciones: number;
  referidos: number;
  ordenes: number;
  oficinas: number;
  farmacias: number;
  especialistas: number;
  perdidas: number;
  anotadas: number;
  total_escrito: number | null;
  ausencia: AbsenceType;
  duda: string;
}

export interface ApiBoardRow {
  numero: number;
  dia: DayName;
  NP: number;
  NC: number;
  EP: number;
  MED: number;
  CP: number;
  AP: number;
  clarificaciones: number;
  referidos: number;
  ordenes: number;
  oficinas: number;
  farmacias: number;
  especialistas: number;
  perdidas: number;
  anotadas: number;
  total_escrito: number | null;
  ausencia: string;
  duda: string;
}

export const CALL_COLOR_LEGEND = [
  {
    code: "NP",
    colorLabel: "Morado",
    swatchColor: "#7e22ce",
    textColor: "#7e22ce",
  },
  {
    code: "NC",
    colorLabel: "Naranja",
    swatchColor: "#ea580c",
    textColor: "#ea580c",
  },
  {
    code: "EP",
    colorLabel: "Negro",
    swatchColor: "#15262b",
    textColor: "#15262b",
  },
  {
    code: "MED",
    colorLabel: "Azul",
    swatchColor: "#1d4ed8",
    textColor: "#1d4ed8",
  },
  {
    code: "CP",
    colorLabel: "Rojo",
    swatchColor: "#b42318",
    textColor: "#b42318",
  },
  {
    code: "AP",
    colorLabel: "Verde (no suma)",
    swatchColor: "#15803d",
    textColor: "#15803d",
  },
] as const;
