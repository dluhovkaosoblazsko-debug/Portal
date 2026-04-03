const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const WHITELIST_PATH = path.join(DATA_DIR, "whitelist-merged.json");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || "";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".webp": "image/webp"
};

let whitelistCache = null;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function parseBasicAuthHeader(headerValue) {
  if (!headerValue || !headerValue.startsWith("Basic ")) return null;

  try {
    const encoded = headerValue.slice("Basic ".length).trim();
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch (_error) {
    return null;
  }
}

function isBasicAuthEnabled() {
  return Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASSWORD);
}

function isAuthorized(request) {
  if (!isBasicAuthEnabled()) return true;

  const credentials = parseBasicAuthHeader(request.headers.authorization || "");
  if (!credentials) return false;

  return (
    credentials.username === BASIC_AUTH_USER &&
    credentials.password === BASIC_AUTH_PASSWORD
  );
}

function requestBasicAuth(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Portal tymu", charset="UTF-8"',
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("Přístup jen pro autorizované uživatele.");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on("data", (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total > 12 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function toSafeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function loadWhitelist() {
  if (whitelistCache) return whitelistCache;

  const raw = fs.readFileSync(WHITELIST_PATH, "utf8");
  const config = JSON.parse(raw);

  const sourceMap = new Map();
  for (const source of config.sources || []) {
    if (source?.id) sourceMap.set(source.id, source);
  }

  const alwaysOn = new Set(config?.source_sets?.always_on_source_ids || []);
  whitelistCache = { config, sourceMap, alwaysOn };
  return whitelistCache;
}

function extractMultipartBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return match ? match[1] || match[2] : "";
}

function trimMultipartPart(buffer) {
  let part = buffer;

  if (part.slice(0, 2).toString() === "\r\n") {
    part = part.slice(2);
  }

  if (part.slice(-2).toString() === "\r\n") {
    part = part.slice(0, -2);
  }

  if (part.slice(-2).toString() === "--") {
    part = part.slice(0, -2);
  }

  return part;
}

function parseMultipartFormData(bodyBuffer, contentType) {
  const boundary = extractMultipartBoundary(contentType);
  if (!boundary) {
    throw new Error("Nepodarilo se precist multipart boundary.");
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = bodyBuffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    const next = bodyBuffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (next === -1) break;

    const partBuffer = bodyBuffer.slice(start + boundaryBuffer.length, next);
    start = next;

    if (partBuffer.length < 4) continue;
    const cleanPart = trimMultipartPart(partBuffer);
    if (!cleanPart.length) continue;
    parts.push(cleanPart);
  }

  const fields = {};
  const files = [];

  for (const part of parts) {
    const separator = Buffer.from("\r\n\r\n");
    const headerEnd = part.indexOf(separator);
    if (headerEnd === -1) continue;

    const headersText = part.slice(0, headerEnd).toString("utf8");
    const content = part.slice(headerEnd + separator.length);

    const dispositionLine = headersText
      .split("\r\n")
      .find((line) => /^content-disposition:/i.test(line));
    if (!dispositionLine) continue;

    const nameMatch = /name="([^"]+)"/i.exec(dispositionLine);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1];
    const filenameMatch = /filename="([^"]*)"/i.exec(dispositionLine);
    const contentTypeMatch = /content-type:\s*([^\r\n]+)/i.exec(headersText);

    if (filenameMatch && filenameMatch[1]) {
      files.push({
        fieldName,
        filename: filenameMatch[1],
        mimeType: contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream",
        buffer: content
      });
    } else {
      fields[fieldName] = content.toString("utf8").trim();
    }
  }

  return { fields, files };
}

function validateLegalPayload(payload, whitelist) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload musi byt JSON objekt." };
  }

  const question = String(payload.question || "").trim();
  if (!question) {
    return { ok: false, error: "Pole question je povinne." };
  }

  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  if (!sources.length) {
    return { ok: false, error: "Musis vybrat alespon jeden zdroj." };
  }

  for (const sourceId of sources) {
    if (!whitelist.sourceMap.has(sourceId)) {
      return { ok: false, error: `Zdroj ${sourceId} neni na whitelistu.` };
    }
  }

  for (const requiredId of whitelist.alwaysOn) {
    if (!sources.includes(requiredId)) {
      return {
        ok: false,
        error: `Chybi povinny zdroj ${requiredId} z always_on_source_ids.`
      };
    }
  }

  if (!payload.promptBlueprint || typeof payload.promptBlueprint !== "object") {
    return { ok: false, error: "Chybi promptBlueprint." };
  }

  if (!Array.isArray(payload.promptBlueprint.modelInstruction)) {
    return { ok: false, error: "promptBlueprint.modelInstruction musi byt pole." };
  }

  return { ok: true };
}

function buildSystemInstruction(selectedSources) {
  const sourceLines = selectedSources
    .map((source) => {
      const lawCode = source.sbirka ? ` (${source.sbirka})` : "";
      const sourceUrl = source.source_url ? ` | ${source.source_url}` : "";
      return `- ${source.id}: ${source.nazev}${lawCode}${sourceUrl}`;
    })
    .join("\n");

  return [
    "Jsi pravni AI asistent pro dluhove poradenstvi v CR.",
    "Pouzij pouze whitelist zdroje uvedene nize.",
    "Pokud opora ve zdrojich chybi, uved: ve zdrojich nenalezeno.",
    "Nevymyslej paragrafy ani pravni zaver bez opory.",
    "Vrat pouze validni JSON bez markdownu.",
    "Schema:",
    "{",
    '  "odpoved": "string",',
    '  "pravniOpora": [{"zakon":"string","paragraf":"string","citace":"string"}],',
    '  "miraJistoty": 0.0,',
    '  "chybejiciVstupy": ["string"]',
    "}",
    "Whitelist zdroje:",
    sourceLines
  ].join("\n");
}

function buildUserPrompt(payload) {
  return [
    `Dotaz: ${payload.question}`,
    `Kontext: ${payload.context || "neuveden"}`,
    `Typ vystupu: ${payload.outputType || "structured_answer"}`,
    `Hloubka: ${payload.depth || "balanced"}`
  ].join("\n");
}

function validateGeminiLegalResult(result, selectedSources) {
  if (!result || typeof result !== "object") {
    return { ok: false, error: "Gemini nevratil JSON objekt." };
  }

  if (typeof result.odpoved !== "string" || !result.odpoved.trim()) {
    return { ok: false, error: "V odpovedi chybi pole odpoved." };
  }

  if (!Array.isArray(result.pravniOpora) || result.pravniOpora.length === 0) {
    return { ok: false, error: "V odpovedi chybi pole pravniOpora." };
  }

  if (typeof result.miraJistoty !== "number" || Number.isNaN(result.miraJistoty)) {
    return { ok: false, error: "V odpovedi chybi validni miraJistoty." };
  }

  if (!Array.isArray(result.chybejiciVstupy)) {
    return { ok: false, error: "Pole chybejiciVstupy musi byt pole." };
  }

  const allowedNames = selectedSources.map((source) => normalizeText(source.nazev));
  const allowedIds = selectedSources.map((source) => normalizeText(source.id));
  let hasWhitelistedCitation = false;

  for (const item of result.pravniOpora) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Polozka pravniOpora musi byt objekt." };
    }

    if (!String(item.zakon || "").trim()) {
      return { ok: false, error: "V citaci chybi zakon." };
    }

    if (!String(item.paragraf || "").trim()) {
      return { ok: false, error: "V citaci chybi paragraf." };
    }

    if (!String(item.citace || "").trim()) {
      return { ok: false, error: "V citaci chybi text citace." };
    }

    const normalizedLaw = normalizeText(item.zakon);
    const isWhitelisted =
      allowedNames.some((name) => normalizedLaw.includes(name)) ||
      allowedIds.some((id) => normalizedLaw.includes(id));

    if (isWhitelisted) hasWhitelistedCitation = true;
  }

  if (!hasWhitelistedCitation) {
    return { ok: false, error: "Citace neodpovidaji vybranym whitelist zdrojum." };
  }

  return { ok: true };
}

async function callGeminiJson(systemText, userParts) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY neni nastaven.");
  }

  const apiUrl = `${GEMINI_API_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const requestBody = {
    systemInstruction: {
      role: "system",
      parts: [{ text: systemText }]
    },
    contents: [
      {
        role: "user",
        parts: userParts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API HTTP ${response.status}: ${rawText}`);
  }

  const envelope = parseJsonSafely(rawText);
  if (!envelope) {
    throw new Error("Gemini vratil neplatny JSON envelope.");
  }

  const modelText = envelope?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!modelText) {
    throw new Error("Gemini nevratil text odpovedi.");
  }

  const modelJson = parseJsonSafely(modelText);
  if (!modelJson) {
    throw new Error("Gemini nevratil validni JSON.");
  }

  return modelJson;
}

async function callGeminiForLegalQuery(payload, selectedSources) {
  return callGeminiJson(buildSystemInstruction(selectedSources), [
    { text: buildUserPrompt(payload) }
  ]);
}

async function callGeminiForPayslipOcr(file) {
  const systemText = [
    "Jsi asistent pro OCR z ceskych vyplatnich pasek.",
    "Z dokumentu vytahni pouze skutecne nalezena pole.",
    "Nevymyslej hodnoty. Pokud pole chybi, vrat null, 0 nebo prazdny retezec podle typu.",
    "Pokud PDF obsahuje vice vyplatnich pasek, vrat vsechny v poli payslips.",
    "Vrat pouze validni JSON bez markdownu.",
    "Schema:",
    "{",
    '  "payslips": [',
    "    {",
    '      "period": "string",',
    '      "employer": "string",',
    '      "employeeName": "string",',
    '      "employeeId": "string",',
    '      "payrollLabel": "string",',
    '      "healthInsurer": "string",',
    '      "fundDays": number,',
    '      "fundHours": number,',
    '      "workedDays": number,',
    '      "workedHours": number,',
    '      "grossWage": number,',
    '      "netIncome": number,',
    '      "taxBase": number,',
    '      "healthInsuranceEmployee": number,',
    '      "socialInsuranceEmployee": number,',
    '      "healthInsuranceEmployer": number,',
    '      "vacationRemainingDays": number,',
    '      "bankAccount": "string",',
    '      "bonuses": ["string"],',
    '      "deductions": ["string"],',
    '      "confidence": number,',
    '      "notes": ["string"]',
    "    }",
    "  ]",
    "}"
  ].join("\n");

  return callGeminiJson(systemText, [
    { text: "Precti prilozene vyplatni pasky a vrat JSON podle zadaneho schema." },
    {
      inlineData: {
        mimeType: file.mimeType,
        data: file.buffer.toString("base64")
      }
    }
  ]);
}

function normalizePayslipRecord(record) {
  return {
    period: String(record?.period || "Nezname obdobi"),
    employer: String(record?.employer || ""),
    employeeName: String(record?.employeeName || ""),
    employeeId: String(record?.employeeId || ""),
    payrollLabel: String(record?.payrollLabel || ""),
    healthInsurer: String(record?.healthInsurer || ""),
    fundDays: toSafeNumber(record?.fundDays),
    fundHours: toSafeNumber(record?.fundHours),
    workedDays: toSafeNumber(record?.workedDays),
    workedHours: toSafeNumber(record?.workedHours),
    grossWage: toSafeNumber(record?.grossWage),
    netIncome: toSafeNumber(record?.netIncome),
    taxBase: toSafeNumber(record?.taxBase),
    healthInsuranceEmployee: toSafeNumber(record?.healthInsuranceEmployee),
    socialInsuranceEmployee: toSafeNumber(record?.socialInsuranceEmployee),
    healthInsuranceEmployer: toSafeNumber(record?.healthInsuranceEmployer),
    vacationRemainingDays: toSafeNumber(record?.vacationRemainingDays),
    bankAccount: String(record?.bankAccount || ""),
    bonuses: Array.isArray(record?.bonuses) ? record.bonuses.map(String) : [],
    deductions: Array.isArray(record?.deductions) ? record.deductions.map(String) : [],
    confidence: toSafeNumber(record?.confidence),
    notes: Array.isArray(record?.notes) ? record.notes.map(String) : []
  };
}

function validatePayslipOcrResult(result) {
  if (!result || typeof result !== "object") {
    return { ok: false, error: "OCR vysledek neni JSON objekt." };
  }

  if (!Array.isArray(result.payslips) || !result.payslips.length) {
    return { ok: false, error: "OCR vysledek neobsahuje payslips." };
  }

  return { ok: true };
}

async function handleLegalQuery(request, response) {
  const whitelist = loadWhitelist();
  const raw = await readBody(request);
  const payload = parseJsonSafely(raw.toString("utf8"));

  if (!payload) {
    sendJson(response, 400, { error: "Neplatny JSON body." });
    return;
  }

  const validation = validateLegalPayload(payload, whitelist);
  if (!validation.ok) {
    sendJson(response, 422, { error: validation.error });
    return;
  }

  const selectedSources = payload.sources.map((id) => whitelist.sourceMap.get(id)).filter(Boolean);

  try {
    const result = await callGeminiForLegalQuery(payload, selectedSources);
    const resultValidation = validateGeminiLegalResult(result, selectedSources);
    if (!resultValidation.ok) {
      sendJson(response, 502, { error: resultValidation.error });
      return;
    }
    sendJson(response, 200, result);
  } catch (error) {
    console.error(error);
    const statusCode = String(error.message || "").includes("GEMINI_API_KEY neni nastaven")
      ? 503
      : 502;
    sendJson(response, statusCode, { error: `Legal query selhalo: ${error.message}` });
  }
}

async function handleOcrPayslip(request, response) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendJson(response, 415, { error: "OCR endpoint ocekava multipart/form-data." });
    return;
  }

  try {
    const raw = await readBody(request);
    const multipart = parseMultipartFormData(raw, contentType);
    const file = multipart.files.find((item) => item.fieldName === "file") || multipart.files[0];

    if (!file) {
      sendJson(response, 400, { error: "V requestu chybi soubor." });
      return;
    }

    const result = await callGeminiForPayslipOcr(file);
    const validation = validatePayslipOcrResult(result);
    if (!validation.ok) {
      sendJson(response, 502, { error: validation.error });
      return;
    }

    sendJson(response, 200, {
      payslips: result.payslips.map(normalizePayslipRecord)
    });
  } catch (error) {
    console.error(error);
    sendJson(response, 502, { error: `OCR selhalo: ${error.message}` });
  }
}

async function handleCalculate(request, response) {
  const raw = await readBody(request);
  const payload = parseJsonSafely(raw.toString("utf8"));

  if (!payload || !Array.isArray(payload.selectedIncomes)) {
    sendJson(response, 400, { error: "Neplatny payload pro vypocet." });
    return;
  }

  const values = payload.selectedIncomes
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length ? total / values.length : 0;
  const extraIncome = Number(payload.extraIncome) > 0 ? Number(payload.extraIncome) : 0;

  sendJson(response, 200, {
    total,
    average,
    adjusted: average + extraIncome,
    count: values.length
  });
}

function serveFile(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(path.join(ROOT_DIR, normalizedPath));

  if (!safePath.startsWith(ROOT_DIR)) {
    sendJson(response, 403, { error: "Forbidden path." });
    return;
  }

  fs.readFile(safePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not found." });
        return;
      }
      sendJson(response, 500, { error: "File read error." });
      return;
    }

    const extension = path.extname(safePath).toLowerCase();
    const mimeType = MIME_TYPES[extension] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": mimeType });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (!isAuthorized(request)) {
      requestBasicAuth(response);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/legal-query") {
      await handleLegalQuery(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ocr-payslip") {
      await handleOcrPayslip(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/calculate") {
      await handleCalculate(request, response);
      return;
    }

    if (request.method === "GET") {
      serveFile(url.pathname, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
