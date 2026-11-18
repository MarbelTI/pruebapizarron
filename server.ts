import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GENERIC_READ_ERROR =
  "No se pudo leer la foto. Intenta en un rato o carga los números a mano";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

type SpecialFormat = "ninguno" | "doctora" | "oficinas" | "cruz" | "dos";
const VALID_FORMATS: SpecialFormat[] = [
  "ninguno",
  "doctora",
  "oficinas",
  "cruz",
  "dos",
];

function getDefaultSpecialsConfig(): Record<number, SpecialFormat> {
  const cfg: Record<number, SpecialFormat> = {};
  for (let i = 1; i <= 22; i++) {
    if (i === 1) cfg[i] = "oficinas";
    else if (i === 6) cfg[i] = "doctora";
    else if (i === 8) cfg[i] = "dos";
    else if (i === 15) cfg[i] = "cruz";
    else cfg[i] = "ninguno";
  }
  return cfg;
}

function normalizeSpecialsConfig(raw: unknown): Record<number, SpecialFormat> {
  const cfg = getDefaultSpecialsConfig();
  if (!raw || typeof raw !== "object") return cfg;
  const record = raw as Record<string, unknown>;
  for (let i = 1; i <= 22; i++) {
    const val = record[String(i)];
    if (typeof val === "string" && VALID_FORMATS.includes(val as SpecialFormat)) {
      cfg[i] = val as SpecialFormat;
    }
  }
  return cfg;
}

function formatRuleForOperator(numero: number, format: SpecialFormat): string {
  switch (format) {
    case "doctora":
      return `- Operador ${numero}: formato Doctora (3 números, escrito "X / Y-Z") -> X (arriba de la diagonal) = clarificaciones; Y (abajo izquierda, antes del guion) = referidos; Z (abajo derecha, después del guion) = ordenes. Los demás campos especiales en 0.`;
    case "oficinas":
      return `- Operador ${numero}: formato Oficinas (3 números, escrito "# / #-#") -> arriba de la diagonal = oficinas (Llamadas a oficinas); abajo izquierda (antes del guion) = farmacias (Farmacias, DI y labs); abajo derecha (después del guion) = anotadas (Llamadas anotadas). Los demás campos especiales en 0.`;
    case "cruz":
      return `- Operador ${numero}: formato Cruz (4 números en mini cuadrícula en cruz) -> arriba izquierda = oficinas (Llamadas a oficinas); arriba derecha = farmacias (Farmacias, DI y labs); abajo izquierda = perdidas (Llamadas perdidas); abajo derecha = anotadas (Llamadas anotadas). Los demás campos especiales en 0.`;
    case "dos":
      return `- Operador ${numero}: formato Dos números (escrito "A | B") -> A = farmacias (Farmacias, DI y labs); B = especialistas. Los demás campos especiales en 0.`;
    case "ninguno":
      return `- Operador ${numero}: Ninguno (sin especiales configurados; todos los campos especiales en 0 salvo que detectes una notación especial escrita en su casilla).`;
  }
}

function buildSystemInstruction(
  especialesConfig: Record<number, SpecialFormat>
): string {
  const perOperatorLines: string[] = [];
  for (let i = 1; i <= 22; i++) {
    perOperatorLines.push(formatRuleForOperator(i, especialesConfig[i]));
  }

  return `Eres un lector experto de pizarrones semanales de un call center.
Tu trabajo es transcribir con total fidelidad lo que está escrito en la foto del pizarrón a JSON estructurado.

Estructura del pizarrón:
- Filas: cada fila pertenece a un operador identificado ÚNICAMENTE por un número del 1 al 22 escrito en la columna izquierda (no todos los números aparecen).
- Columnas: 5 días de la semana: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes".
- Subcolumnas dentro de cada día (de izquierda a derecha): NP, NC, EP, MED, CP, AP, OUT.

Código de colores y subcolumnas:
- Morado = NP
- Naranja = NC
- Negro = EP
- Azul = MED
- Rojo = CP
- Verde = AP (Nota: AP NO suma al total del día).
- Columna OUT (salida, al extremo derecho de cada día, después de AP): IGNÓRALA POR COMPLETO. Los números en OUT NO se cargan en ningún campo, NO se suman y NO son total_escrito.

Dónde encontrar el "total_escrito" de cada día (MUY IMPORTANTE):
El total escrito de cada día NO siempre está dentro de la casilla; puede aparecer en cualquiera de estas ubicaciones:
1. Una franja en la parte INFERIOR debajo de la cuadrícula principal, donde cada operador aparece con su número seguido de los totales de Lunes a Viernes (ej. "3. 97 98 81 82" o "4. 8 13 4 5 1"). Ten cuidado: si un operador no trabajó un día (ej. jueves vacío), pueden haber menos de 5 números en esa lista; alinea los totales con los días que sí tienen actividad. Si un total aparece tachado o con dos opciones como "100/101", pon el número más probable y anótalo en "duda".
2. Una columna a la DERECHA de la cuadrícula titulada "L M M I J V" (o "L M X J V") donde cada fila de operador tiene sus cinco totales diarios.
3. Encerrado en un recuadro o círculo dentro de la propia casilla si no existe franja inferior ni columna derecha.
REGLA CRÍTICA sobre total_escrito: Si un día NO tiene total escrito en ninguno de esos lugares, devuelve total_escrito: null. NUNCA calcules ni deduzcas tú el total_escrito.

Notación especial (ESP) configurada para esta semana (operador por operador):
OJO: "Doctora" ("X / Y-Z") y "Oficinas" ("# / #-#") se escriben igual, pero significan cosas distintas según el operador configurado abajo. Además de sus números especiales, los operadores con especiales también tienen sus números normales de colores NP, NC, EP, MED, CP, AP.
${perOperatorLines.join("\n")}

REGLA IMPORTANTE sobre operadores en "Ninguno" con notación especial:
Si ves una notación especial escrita en la casilla de un operador que está configurado en "Ninguno" arriba, NO la ignores ni la descartes: léela usando el formato que más se parezca (por ejemplo: si tiene "X / Y-Z", usa clarificaciones/referidos/ordenes o oficinas/farmacias/anotadas; si tiene "A | B", usa farmacias/especialistas; si tiene cruz de 4 números, usa oficinas/farmacias/perdidas/anotadas) y explícalo en el campo "duda" de esa casilla (ej. "El operador 9 tiene una notación X / Y-Z y no tenía especiales configurados").

Ausencias:
- Si en una casilla dice "permiso", "vacaciones", "libre", "faltó" (o abreviaturas como "perm", "vac", "lib", "f"), pon ese día como ausencia usando exactamente uno de: "Permiso", "Faltó", "Vacaciones", "Libre". En ausencias todos los números deben ser 0 y total_escrito debe ser null.

Reglas estrictas:
1. Devuelve UNA entrada en "filas" por cada casilla (operador × día) de la cuadrícula principal que tenga algo escrito. Las casillas completamente vacías NO se devuelven.
2. NO inventes ni asumas números. No completes totales faltantes ni modifiques un dígito para que cuadre.
3. Si no estás seguro de un número, un dígito o un color (por ejemplo morado vs negro, rojo vs naranja, verde vs azul, o letra borrosa), pon tu mejor lectura igual y explica qué parte es dudosa en "duda".
4. Si una casilla tiene algo escrito pero no se logra leer, devuélvela igual con los valores en 0 y explica en "duda" que no se lee.`;
}

const boardResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    filas: {
      type: Type.ARRAY,
      description:
        "Lista de casillas (operador por día) que tienen algo escrito en el pizarrón.",
      items: {
        type: Type.OBJECT,
        properties: {
          numero: {
            type: Type.INTEGER,
            description:
              "Número del operador (del 1 al 22) escrito a la izquierda.",
          },
          dia: {
            type: Type.STRING,
            enum: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
            description: "Día de la semana correspondiente a la columna.",
          },
          NP: {
            type: Type.INTEGER,
            description: "Llamadas NP (marcador morado / columna NP). 0 si no hay.",
          },
          NC: {
            type: Type.INTEGER,
            description: "Llamadas NC (marcador naranja / columna NC). 0 si no hay.",
          },
          EP: {
            type: Type.INTEGER,
            description: "Llamadas EP (marcador negro / columna EP). 0 si no hay.",
          },
          MED: {
            type: Type.INTEGER,
            description: "Llamadas MED (marcador azul / columna MED). 0 si no hay.",
          },
          CP: {
            type: Type.INTEGER,
            description: "Llamadas CP (marcador rojo / columna CP). 0 si no hay.",
          },
          AP: {
            type: Type.INTEGER,
            description: "Llamadas AP (marcador verde / columna AP). 0 si no hay.",
          },
          clarificaciones: {
            type: Type.INTEGER,
            description:
              "En formato Doctora: valor X arriba de la diagonal en 'X / Y-Z'. 0 si no aplica o no hay.",
          },
          referidos: {
            type: Type.INTEGER,
            description:
              "En formato Doctora: valor Y abajo izquierda en 'X / Y-Z'. 0 si no aplica o no hay.",
          },
          ordenes: {
            type: Type.INTEGER,
            description:
              "En formato Doctora: valor Z abajo derecha en 'X / Y-Z'. 0 si no aplica o no hay.",
          },
          oficinas: {
            type: Type.INTEGER,
            description:
              "En formato Oficinas: número arriba de la diagonal en '# / #-#'. En formato Cruz: número arriba izquierda de la mini cuadrícula en cruz. 0 si no aplica o no hay.",
          },
          farmacias: {
            type: Type.INTEGER,
            description:
              "En formato Oficinas: número abajo izquierda en '# / #-#'. En formato Dos números: valor A en 'A | B'. En formato Cruz: número arriba derecha de la mini cuadrícula. 0 si no aplica o no hay.",
          },
          especialistas: {
            type: Type.INTEGER,
            description:
              "En formato Dos números: valor B en 'A | B'. 0 si no aplica o no hay.",
          },
          perdidas: {
            type: Type.INTEGER,
            description:
              "En formato Cruz: número abajo izquierda de la mini cuadrícula en cruz. 0 si no aplica o no hay.",
          },
          anotadas: {
            type: Type.INTEGER,
            description:
              "En formato Oficinas: número abajo derecha en '# / #-#'. En formato Cruz: número abajo derecha de la mini cuadrícula en cruz. 0 si no aplica o no hay.",
          },
          total_escrito: {
            type: Type.INTEGER,
            nullable: true,
            description:
              "Total escrito del día tomado de la franja inferior (ej. '3. 97 98 81 82'), de la columna derecha 'L M M I J V', o de un recuadro/círculo en la casilla. null si ese día no tiene total escrito o es ausencia. NUNCA lo calcules tú.",
          },
          ausencia: {
            type: Type.STRING,
            description:
              "Si la casilla indica ausencia ('permiso', 'vacaciones', 'libre', 'faltó' o abreviatura), devolver exactamente 'Permiso', 'Faltó', 'Vacaciones' o 'Libre'. Cadena vacía '' si no es ausencia.",
          },
          duda: {
            type: Type.STRING,
            description:
              "Cadena vacía '' si todo se lee con claridad. Si algún dígito, color o texto es dudoso, o si un operador configurado en Ninguno tiene notación especial, explicarlo brevemente en español.",
          },
        },
        required: [
          "numero",
          "dia",
          "NP",
          "NC",
          "EP",
          "MED",
          "CP",
          "AP",
          "clarificaciones",
          "referidos",
          "ordenes",
          "oficinas",
          "farmacias",
          "especialistas",
          "perdidas",
          "anotadas",
          "total_escrito",
          "ausencia",
          "duda",
        ],
      },
    },
  },
  required: ["filas"],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.post("/api/leer-pizarron", async (req, res) => {
    try {
      const { imageBase64, mimeType, especialesConfig } = req.body ?? {};

      if (
        typeof imageBase64 !== "string" ||
        imageBase64.trim().length === 0 ||
        typeof mimeType !== "string" ||
        !mimeType.startsWith("image/")
      ) {
        return res.status(400).json({ error: GENERIC_READ_ERROR });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: GENERIC_READ_ERROR });
      }

      const normalizedConfig = normalizeSpecialsConfig(especialesConfig);
      const dynamicSystemInstruction = buildSystemInstruction(normalizedConfig);

      const configuredSummary = Object.entries(normalizedConfig)
        .filter(([, fmt]) => fmt !== "ninguno")
        .map(([num, fmt]) => `Op.${num}=${fmt}`)
        .join(", ");

      const requestParams = {
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `Lee todas las casillas con contenido del pizarrón (operadores 1 a 22, columnas Lunes a Viernes) respetando los colores, la configuración de especiales de esta semana (${configuredSummary || "ninguno"}), ausencias y totales escritos. Si un operador en Ninguno tiene notación especial, léela con el formato que más se parezca y anótalo en "duda". Devuelve el JSON estricto.`,
            },
          ],
        },
        config: {
          systemInstruction: dynamicSystemInstruction,
          responseMimeType: "application/json",
          responseSchema: boardResponseSchema,
        },
      };

      const callModelWithRetry = async (
        model: string,
        retries = 1,
        extraConfig?: Record<string, unknown>
      ) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await ai.models.generateContent({
              model,
              contents: requestParams.contents,
              config: {
                ...requestParams.config,
                ...extraConfig,
              },
            });
          } catch (err: unknown) {
            const status =
              typeof err === "object" && err !== null && "status" in err
                ? (err as { status?: number }).status
                : undefined;
            if ((status === 503 || status === 500) && attempt < retries) {
              await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
        throw new Error("Max retries reached");
      };

      let response;
      try {
        response = await callModelWithRetry("gemini-3.8-flash", 0);
      } catch (primaryErr: unknown) {
        const status =
          typeof primaryErr === "object" &&
          primaryErr !== null &&
          "status" in primaryErr
            ? (primaryErr as { status?: number }).status
            : undefined;
        if (status === 404 || status === 503 || status === 500) {
          response = await callModelWithRetry("gemini-4-hydrogen", 1, {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          });
        } else {
          throw primaryErr;
        }
      }

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({ error: GENERIC_READ_ERROR });
      }

      const parsed = JSON.parse(rawText);
      if (!parsed || !Array.isArray(parsed.filas)) {
        return res.status(502).json({ error: GENERIC_READ_ERROR });
      }

      return res.json({ filas: parsed.filas });
    } catch (error: unknown) {
      console.error("Error leyendo pizarron con Gemini:", error);
      return res.status(500).json({ error: GENERIC_READ_ERROR });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
