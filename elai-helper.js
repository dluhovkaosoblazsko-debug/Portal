const LEGAL_ENDPOINT = "/api/legal-query";
const OCR_ENDPOINT = "/api/ocr-payslip";
const CALCULATION_ENDPOINT = "/api/calculate";
const WHITELIST_CONFIG_URL = "data/whitelist-merged.json";

const DEFAULT_WHITELIST_FALLBACK = {
  source_sets: {
    always_on_source_ids: [
      "CZ-IZ-182-2006",
      "CZ-OSR-99-1963",
      "CZ-ER-120-2001",
      "CZ-NV-595-2006"
    ]
  },
  sources: [
    { id: "CZ-IZ-182-2006", nazev: "Insolvencni zakon", sbirka: "182/2006 Sb.", tier: "T1" },
    { id: "CZ-OSR-99-1963", nazev: "Obcansky soudni rad", sbirka: "99/1963 Sb.", tier: "T1" },
    { id: "CZ-ER-120-2001", nazev: "Exekucni rad", sbirka: "120/2001 Sb.", tier: "T1" },
    { id: "CZ-NV-595-2006", nazev: "Narizeni o nezabavitelnych castkach", sbirka: "595/2006 Sb.", tier: "T1" },
    { id: "CZ-OZ-89-2012", nazev: "Obcansky zakonik", sbirka: "89/2012 Sb.", tier: "T2" }
  ]
};

const state = {
  payslips: [],
  whitelistConfig: null,
  whitelistSources: []
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadWhitelistConfig();
  renderLegalSources();
  initLegalModule();
  initOcrModule();
  initCalculationModule();
  renderPayslipTable();
  updateCalculationMetrics();
});

function initLegalModule() {
  const legalForm = document.getElementById("legalForm");
  const legalResetBtn = document.getElementById("legalResetBtn");

  if (!legalForm || !legalResetBtn) return;

  legalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLegalSubmit();
  });

  legalResetBtn.addEventListener("click", () => {
    legalForm.reset();
    setStatus("legalStatus", "Formular byl vycisten.");
    setResult("legalResult", "Zde se po validaci zobrazi odpoved.");
  });
}

function initOcrModule() {
  const ocrForm = document.getElementById("ocrForm");
  if (!ocrForm) return;

  ocrForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleOcrSubmit();
  });
}

function initCalculationModule() {
  const calcForm = document.getElementById("calcForm");
  if (!calcForm) return;

  calcForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateCalculationMetrics();
  });
}

async function handleLegalSubmit() {
  const question = getValue("legalQuestion");
  const context = getValue("legalContext");
  const outputType = getValue("legalOutputType");
  const depth = getValue("legalDepth");
  const selectedSources = getSelectedSourceIds();
  const selectedSourceDetails = state.whitelistSources.filter((item) =>
    selectedSources.includes(item.id)
  );

  if (!question) {
    setStatus("legalStatus", "Vypln dotaz, bez nej nelze sestavit presny prompt.");
    return;
  }

  if (!selectedSources.length) {
    setStatus("legalStatus", "Vyber aspon jeden povoleny zdroj.");
    return;
  }

  const payload = {
    question,
    context,
    outputType,
    depth,
    sources: selectedSources,
    sourceDetails: selectedSourceDetails,
    promptBlueprint: buildPromptBlueprint({
      question,
      context,
      outputType,
      depth,
      sources: selectedSources,
      sourceDetails: selectedSourceDetails
    })
  };

  setStatus("legalStatus", "Odesilam dotaz a cekam na validovanou odpoved...");

  try {
    const response = await fetch(LEGAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMessage = result?.error || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const validation = validateLegalResponse(result);
    if (!validation.ok) {
      setStatus("legalStatus", `Odpoved zamitnuta validaci: ${validation.reason}`);
      setResult(
        "legalResult",
        "AI odpoved nebyla prijata, protoze neobsahovala povinnou strukturu nebo citace."
      );
      return;
    }

    setStatus("legalStatus", "Odpoved prosla validaci.");
    setResult("legalResult", formatLegalResult(result));
  } catch (error) {
    setStatus("legalStatus", `Dotaz se nepodarilo dokoncit: ${error.message}`);
    setResult(
      "legalResult",
      "Backend vratil chybu nebo nebyl dostupny. Zkontroluj server a konfiguraci Gemini."
    );
    console.error(error);
  }
}

async function handleOcrSubmit() {
  const fileInput = document.getElementById("payslipFile");
  const ocrMode = getValue("ocrMode");
  const file = fileInput?.files?.[0];

  if (!file) {
    setStatus("ocrStatus", "Vyber soubor vyplatnice.");
    return;
  }

  setStatus("ocrStatus", "Nahravam soubor a cekam na OCR extrakci...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", ocrMode);

  try {
    const response = await fetch(OCR_ENDPOINT, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMessage = result?.error || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const normalizedItems = normalizePayslipResponse(result);
    state.payslips.push(...normalizedItems);
    renderPayslipTable();
    updateCalculationMetrics();
    setStatus("ocrStatus", `OCR data byla pridana do tabulky (${normalizedItems.length}).`);
  } catch (error) {
    state.payslips.push({
      period: "Neznamy mesic",
      employer: "OCR fallback",
      employeeName: "Neznamy zamestnanec",
      employeeId: "",
      payrollLabel: "",
      healthInsurer: "",
      fundDays: 0,
      fundHours: 0,
      workedDays: 0,
      workedHours: 0,
      grossWage: 0,
      netIncome: 0,
      taxBase: 0,
      healthInsuranceEmployee: 0,
      socialInsuranceEmployee: 0,
      healthInsuranceEmployer: 0,
      vacationRemainingDays: 0,
      bankAccount: "",
      bonuses: [],
      deductions: [],
      confidence: "0.00",
      notes: []
    });
    renderPayslipTable();
    updateCalculationMetrics();
    setStatus(
      "ocrStatus",
      "OCR endpoint zatim neni dostupny. Byla pridana testovaci polozka, kterou muzes rucne upravit."
    );
    console.error(error);
  }
}

function buildPromptBlueprint(input) {
  return {
    modelInstruction: [
      "Jsi pravni asistent pro insolvencni agendu.",
      "Pouzij jen poskytnute zdroje a cituj kazde klicove tvrzeni.",
      "Pokud ve zdroji neni opora, vrat explicitne: ve zdrojich nenalezeno."
    ],
    outputSchema: {
      odpoved: "string",
      pravniOpora: [{ zakon: "string", paragraf: "string", citace: "string" }],
      miraJistoty: "number(0-1)",
      chybejiciVstupy: ["string"]
    },
    userTask: {
      question: input.question,
      context: input.context,
      outputType: input.outputType,
      depth: input.depth,
      sources: input.sources
    },
    sourceCatalog: {
      selectedSources: input.sourceDetails.map((item) => ({
        id: item.id,
        nazev: item.nazev,
        sbirka: item.sbirka || null,
        tier: item.tier || null,
        source_url: item.source_url || null
      }))
    }
  };
}

function validateLegalResponse(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "odpoved neni validni JSON objekt" };
  }

  if (typeof payload.odpoved !== "string" || !payload.odpoved.trim()) {
    return { ok: false, reason: "chybi pole odpoved" };
  }

  if (!Array.isArray(payload.pravniOpora) || payload.pravniOpora.length === 0) {
    return { ok: false, reason: "chybi povinne citace pravni opory" };
  }

  if (typeof payload.miraJistoty !== "number") {
    return { ok: false, reason: "chybi mira jistoty" };
  }

  return { ok: true };
}

function formatLegalResult(result) {
  const lines = [];
  lines.push("ODPOVED:");
  lines.push(result.odpoved || "");
  lines.push("");
  lines.push("PRAVNI OPORA:");

  for (const item of result.pravniOpora || []) {
    lines.push(
      `- ${item.zakon || "Neuveden zakon"} | ${item.paragraf || "Neuveden paragraf"} | ${
        item.citace || "Bez citace"
      }`
    );
  }

  lines.push("");
  lines.push(`MIRA JISTOTY: ${result.miraJistoty}`);
  lines.push("");
  lines.push("CHYBEJICI VSTUPY:");

  for (const item of result.chybejiciVstupy || []) {
    lines.push(`- ${item}`);
  }

  return lines.join("\n");
}

function normalizePayslipResponse(payload) {
  const items = Array.isArray(payload?.payslips) ? payload.payslips : [payload];
  return items.map(normalizePayslipResult);
}

function normalizePayslipResult(payload) {
  return {
    period: payload?.period || "Neznamy mesic",
    employer: payload?.employer || "Neznamy zamestnavatel",
    employeeName: payload?.employeeName || "Neznamy zamestnanec",
    employeeId: payload?.employeeId || "",
    payrollLabel: payload?.payrollLabel || "",
    healthInsurer: payload?.healthInsurer || "",
    fundDays: toPositiveNumber(payload?.fundDays),
    fundHours: toPositiveNumber(payload?.fundHours),
    workedDays: toPositiveNumber(payload?.workedDays),
    workedHours: toPositiveNumber(payload?.workedHours),
    grossWage: toPositiveNumber(payload?.grossWage),
    netIncome: toPositiveNumber(payload?.netIncome),
    taxBase: toPositiveNumber(payload?.taxBase),
    healthInsuranceEmployee: toPositiveNumber(payload?.healthInsuranceEmployee),
    socialInsuranceEmployee: toPositiveNumber(payload?.socialInsuranceEmployee),
    healthInsuranceEmployer: toPositiveNumber(payload?.healthInsuranceEmployer),
    vacationRemainingDays: toPositiveNumber(payload?.vacationRemainingDays),
    bankAccount: payload?.bankAccount || "",
    bonuses: Array.isArray(payload?.bonuses) ? payload.bonuses.map(String) : [],
    deductions: Array.isArray(payload?.deductions) ? payload.deductions.map(String) : [],
    confidence: payload?.confidence ? String(payload.confidence) : "0.00"
  };
}

function renderPayslipTable() {
  const tbody = document.querySelector("#payslipTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!state.payslips.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="8" class="helper-empty-cell">Zatim nejsou k dispozici zadna OCR data.</td>`;
    tbody.appendChild(row);
    return;
  }

  state.payslips.forEach((item, index) => {
    const insuranceText = `${formatInteger(item.healthInsuranceEmployee)} / ${formatInteger(item.socialInsuranceEmployee)}`;
    const workedText = `${formatDecimal(item.workedDays)} d / ${formatDecimal(item.workedHours)} h`;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.period)}</td>
      <td>${escapeHtml(item.employeeName)}</td>
      <td>${formatCurrency(item.grossWage)}</td>
      <td>
        <input
          type="number"
          class="helper-table-input"
          min="0"
          step="100"
          value="${item.netIncome}"
          data-index="${index}"
        />
      </td>
      <td>${escapeHtml(workedText)}</td>
      <td>${escapeHtml(insuranceText)}</td>
      <td>${formatCurrency(item.taxBase)}</td>
      <td>${escapeHtml(item.confidence)}</td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll(".helper-table-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target.dataset.index);
      if (Number.isNaN(index)) return;
      state.payslips[index].netIncome = toPositiveNumber(target.value);
      updateCalculationMetrics();
    });
  });
}

function updateCalculationMetrics() {
  const months = Math.max(Math.floor(toPositiveNumber(getValue("calcMonths"))), 1);
  const extraIncome = toPositiveNumber(getValue("calcExtraIncome"));
  const selectedIncomes = state.payslips
    .map((item) => toPositiveNumber(item.netIncome))
    .filter((value) => value > 0)
    .slice(-months);

  const total = selectedIncomes.reduce((sum, value) => sum + value, 0);
  const average = selectedIncomes.length ? total / selectedIncomes.length : 0;
  const adjusted = average + extraIncome;

  setText("metricTotal", formatCurrency(total));
  setText("metricAverage", formatCurrency(average));
  setText("metricAdjusted", formatCurrency(adjusted));
  setText("metricCount", String(selectedIncomes.length));

  sendDeterministicCalculation({
    months,
    extraIncome,
    selectedIncomes,
    note: getValue("calcNote")
  });
}

async function sendDeterministicCalculation(payload) {
  try {
    await fetch(CALCULATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error(error);
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? String(element.value || "").trim() : "";
}

function setStatus(id, message) {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = message;
  element.classList.remove("is-loading", "is-ok", "is-warn", "is-error");

  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("cekam") ||
    normalized.includes("nahravam") ||
    normalized.includes("odesilam")
  ) {
    element.classList.add("is-loading");
    return;
  }

  if (
    normalized.includes("prosla") ||
    normalized.includes("pridana") ||
    normalized.includes("nacten")
  ) {
    element.classList.add("is-ok");
    return;
  }

  if (
    normalized.includes("zamitnuta") ||
    normalized.includes("chybi") ||
    normalized.includes("nepodarilo") ||
    normalized.includes("chyba")
  ) {
    element.classList.add("is-error");
    return;
  }

  if (
    normalized.includes("zatim") ||
    normalized.includes("fallback") ||
    normalized.includes("doplnen")
  ) {
    element.classList.add("is-warn");
  }
}

function setResult(id, content) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = content;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDecimal(value) {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatInteger(value) {
  return new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadWhitelistConfig() {
  try {
    const response = await fetch(WHITELIST_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const config = await response.json();
    state.whitelistConfig = config;
    state.whitelistSources = normalizeWhitelistSources(config.sources || []);
  } catch (error) {
    state.whitelistConfig = DEFAULT_WHITELIST_FALLBACK;
    state.whitelistSources = normalizeWhitelistSources(DEFAULT_WHITELIST_FALLBACK.sources || []);
    console.error(error);
  }
}

function normalizeWhitelistSources(sources) {
  return sources
    .filter((source) => source && source.id && source.nazev)
    .map((source) => ({
      id: String(source.id),
      nazev: String(source.nazev),
      sbirka: source.sbirka ? String(source.sbirka) : "",
      tier: source.tier ? String(source.tier) : "",
      source_url: source.source_url ? String(source.source_url) : ""
    }));
}

function renderLegalSources() {
  const sourcesList = document.getElementById("legalSourcesList");
  const sourcesMeta = document.getElementById("legalSourcesMeta");
  if (!sourcesList || !sourcesMeta) return;

  sourcesList.innerHTML = "";

  if (!state.whitelistSources.length) {
    sourcesMeta.textContent = "Whitelist neni dostupny. Zobrazeno minimalni zalozni jadro.";
    return;
  }

  const defaultSet = new Set(
    (state.whitelistConfig?.source_sets?.always_on_source_ids || []).map((item) => String(item))
  );

  for (const source of state.whitelistSources) {
    const wrapper = document.createElement("label");
    wrapper.className = "helper-source-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "source";
    checkbox.value = source.id;
    checkbox.checked = defaultSet.size ? defaultSet.has(source.id) : source.tier === "T1";

    const text = document.createElement("span");
    const tierLabel = source.tier ? ` [${source.tier}]` : "";
    const lawCode = source.sbirka ? ` (${source.sbirka})` : "";
    text.textContent = `${source.nazev}${lawCode}${tierLabel}`;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    sourcesList.appendChild(wrapper);
  }

  sourcesMeta.textContent = `Whitelist nacten: ${state.whitelistSources.length} zdroju.`;
}

function getSelectedSourceIds() {
  return Array.from(document.querySelectorAll('input[name="source"]:checked')).map(
    (item) => item.value
  );
}
