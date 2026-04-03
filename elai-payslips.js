const OCR_ENDPOINT = "/api/ocr-payslip";

const state = {
  payslips: []
};

document.addEventListener("DOMContentLoaded", () => {
  initOcrModule();
  initExportActions();
  initManualRows();
  renderPayslipTable();
  updateCalculationMetrics();
});

function initOcrModule() {
  const ocrForm = document.getElementById("ocrForm");
  if (!ocrForm) return;

  ocrForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleOcrSubmit();
  });
}

function initExportActions() {
  const excelButton = document.getElementById("exportExcelButton");
  const wordButton = document.getElementById("exportWordButton");

  excelButton?.addEventListener("click", () => exportPayslipsToExcel());
  wordButton?.addEventListener("click", () => exportPayslipsToWord());
}

function initManualRows() {
  const addManualRowButton = document.getElementById("addManualRowButton");
  if (!addManualRowButton) return;

  addManualRowButton.addEventListener("click", () => {
    state.payslips.push(createManualPayslipRow());
    renderPayslipTable();
    updateCalculationMetrics();
    setStatus("ocrStatus", "Byl přidán ruční řádek pro doplnění nečitelné výplatnice.");
  });
}

async function handleOcrSubmit() {
  const fileInput = document.getElementById("payslipFile");
  const file = fileInput?.files?.[0];

  if (!file) {
    setStatus("ocrStatus", "Vyberte soubor výplatnice.");
    return;
  }

  setStatus("ocrStatus", "Nahrávám soubor a čekám na OCR extrakci...");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", "strict");

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
    setStatus("ocrStatus", `OCR data byla přidána do tabulky (${normalizedItems.length}).`);
  } catch (error) {
    state.payslips.push({
      period: "Neznámý měsíc",
      employeeName: "Neznámý zaměstnanec",
      employer: "",
      fundDays: 0,
      fundHours: 0,
      workedDays: 0,
      workedHours: 0,
      grossWage: 0,
      netIncome: 0,
      taxBase: 0,
      healthInsuranceEmployee: 0,
      socialInsuranceEmployee: 0,
      confidence: "0.00",
      included: false,
      isManual: true
    });
    renderPayslipTable();
    updateCalculationMetrics();
    setStatus(
      "ocrStatus",
      "OCR endpoint zatím není dostupný. Byla přidána testovací položka, kterou můžete ručně upravit a zahrnout."
    );
    console.error(error);
  } finally {
    if (fileInput) {
      fileInput.value = "";
    }
  }
}

function normalizePayslipResponse(payload) {
  const items = Array.isArray(payload?.payslips) ? payload.payslips : [payload];
  return items.map(normalizePayslipResult);
}

function normalizePayslipResult(payload) {
  return {
    period: payload?.period || "Neznámý měsíc",
    employer: "",
    employeeName: payload?.employeeName || "Neznámý zaměstnanec",
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
    confidence: payload?.confidence ? String(payload.confidence) : "0.00",
    included: false,
    isManual: false
  };
}

function renderPayslipTable() {
  const tbody = document.querySelector("#payslipTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!state.payslips.length) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="6" class="helper-empty-cell">Zatím nejsou k dispozici žádná OCR data.</td>';
    tbody.appendChild(row);
    return;
  }

  state.payslips.forEach((item, index) => {
    const workedText = `${formatDecimal(item.workedDays)} d / ${formatDecimal(item.workedHours)} h`;
    const row = document.createElement("tr");
    row.className = item.isManual ? "helper-row-manual" : "";
    row.innerHTML = `
      <td>${renderTableCell(item, index, "period", escapeHtml(item.period))}</td>
      <td>${renderEmployeeCell(item, index)}</td>
      <td>
        <label class="helper-table-check">
          <input type="checkbox" data-include-index="${index}" ${item.included ? "checked" : ""} />
          <span>Zahrnout</span>
        </label>
      </td>
      <td>${renderNumberCell(item, index, "grossWage", item.grossWage, formatCurrency(item.grossWage))}</td>
      <td class="helper-table-highlight-col">
        <input
          type="number"
          class="helper-table-input helper-table-input-highlight"
          min="0"
          step="100"
          value="${item.netIncome}"
          data-income-index="${index}"
        />
      </td>
      <td>${renderWorkedCell(item, index, workedText)}</td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll("[data-income-index]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target.dataset.incomeIndex);
      if (Number.isNaN(index)) return;
      state.payslips[index].netIncome = toPositiveNumber(target.value);
      updateCalculationMetrics();
    });
  });

  tbody.querySelectorAll("[data-include-index]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.target;
      const index = Number(target.dataset.includeIndex);
      if (Number.isNaN(index)) return;
      state.payslips[index].included = Boolean(target.checked);
      updateCalculationMetrics();
    });
  });

  tbody.querySelectorAll("[data-field-index]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target.dataset.fieldIndex);
      const field = String(target.dataset.fieldName || "");
      if (Number.isNaN(index) || !field || !state.payslips[index]) return;

      if (
        field === "grossWage" ||
        field === "workedDays" ||
        field === "workedHours" ||
        field === "netIncome"
      ) {
        state.payslips[index][field] = toPositiveNumber(target.value);
      } else {
        state.payslips[index][field] = String(target.value || "").trim();
      }

      updateCalculationMetrics();
    });
  });
}

function updateCalculationMetrics() {
  const selectedPayslips = state.payslips.filter(
    (item) => item.included && toPositiveNumber(item.netIncome) > 0
  );
  const selectedIncomes = selectedPayslips.map((item) => toPositiveNumber(item.netIncome));
  const total = selectedIncomes.reduce((sum, value) => sum + value, 0);
  const average = selectedIncomes.length ? total / selectedIncomes.length : 0;

  setText("metricTotal", formatCurrency(total));
  setText("metricAverage", formatCurrency(average));
  setText("metricCount", String(selectedIncomes.length));
  updateExportButtons();
}

function updateExportButtons() {
  const disabled = state.payslips.length === 0;
  ["exportExcelButton", "exportWordButton"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = disabled;
  });
}

function exportPayslipsToExcel() {
  if (!state.payslips.length) {
    setStatus("ocrStatus", "Nejprve načtěte alespoň jednu výplatnici.");
    return;
  }

  const rows = [
    [
      "Období",
      "Zaměstnanec",
      "Zahrnout mzdu",
      "Hrubá mzda",
      "Čistý příjem",
      "Odpracované dny",
      "Odpracované hodiny"
    ],
    ...state.payslips.map((item) => [
      item.period,
      item.employeeName,
      item.included ? "Ano" : "Ne",
      item.grossWage,
      item.netIncome,
      item.workedDays,
      item.workedHours
    ])
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");

  downloadBlob(`\uFEFF${csv}`, "vyplatnice-nactena-data.csv", "text/csv;charset=utf-8;");
}

function exportPayslipsToWord() {
  if (!state.payslips.length) {
    setStatus("ocrStatus", "Nejprve načtěte alespoň jednu výplatnici.");
    return;
  }

  const createdAt = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());

  const rowsHtml = state.payslips
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.period)}</td>
          <td>${escapeHtml(item.employeeName)}</td>
          <td>${item.included ? "Ano" : "Ne"}</td>
          <td>${formatCurrency(item.grossWage)}</td>
          <td>${formatCurrency(item.netIncome)}</td>
          <td>${formatDecimal(item.workedDays)} / ${formatDecimal(item.workedHours)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
  <html lang="cs">
  <head>
    <meta charset="UTF-8" />
    <title>Export načtených výplatnic</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; }
      h1 { margin-bottom: 6px; }
      p { margin-top: 0; color: #444; }
      table { border-collapse: collapse; width: 100%; margin-top: 18px; }
      th, td { border: 1px solid #bfc7d8; padding: 8px 10px; text-align: left; font-size: 12px; }
      th { background: #eef3ff; }
    </style>
  </head>
  <body>
    <h1>Načtené výplatní lístky</h1>
    <p>Export vytvořen: ${escapeHtml(createdAt)}</p>
    <table>
      <thead>
        <tr>
          <th>Období</th>
          <th>Zaměstnanec</th>
          <th>Zahrnout mzdu</th>
          <th>Hrubá mzda</th>
          <th>Čistý příjem</th>
          <th>Odpracováno</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
  </html>`;

  downloadBlob(html, "vyplatnice-nactena-data.doc", "application/msword");
}

function createManualPayslipRow() {
  return {
    period: "",
    employer: "",
    employeeName: "",
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
    confidence: "",
    included: false,
    isManual: true
  };
}

function renderTableCell(item, index, field, fallback) {
  if (!item.isManual) return fallback;
  return `
    <input
      type="text"
      class="helper-table-input helper-table-input-text"
      value="${escapeAttribute(item[field] ?? "")}"
      data-field-index="${index}"
      data-field-name="${field}"
    />
  `;
}

function renderNumberCell(item, index, field, value, fallback) {
  if (!item.isManual) return fallback;
  return `
    <input
      type="number"
      class="helper-table-input"
      min="0"
      step="100"
      value="${value}"
      data-field-index="${index}"
      data-field-name="${field}"
    />
  `;
}

function renderWorkedCell(item, index, fallback) {
  if (!item.isManual) return escapeHtml(fallback);
  return `
    <div class="helper-inline-pair">
      <input
        type="number"
        class="helper-table-input"
        min="0"
        step="0.5"
        value="${item.workedDays}"
        data-field-index="${index}"
        data-field-name="workedDays"
      />
      <input
        type="number"
        class="helper-table-input"
        min="0"
        step="0.5"
        value="${item.workedHours}"
        data-field-index="${index}"
        data-field-name="workedHours"
      />
    </div>
  `;
}

function renderEmployeeCell(item, index) {
  if (!item.isManual) return escapeHtml(item.employeeName);
  return `
    <input
      type="text"
      class="helper-table-input helper-table-input-text"
      value="${escapeAttribute(item.employeeName || "")}"
      data-field-index="${index}"
      data-field-name="employeeName"
    />
  `;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
    normalized.includes("čekám") ||
    normalized.includes("nahrávám") ||
    normalized.includes("odesílám")
  ) {
    element.classList.add("is-loading");
    return;
  }

  if (
    normalized.includes("prošla") ||
    normalized.includes("přidána") ||
    normalized.includes("načten")
  ) {
    element.classList.add("is-ok");
    return;
  }

  if (
    normalized.includes("zamítnuta") ||
    normalized.includes("chybí") ||
    normalized.includes("nepodařilo") ||
    normalized.includes("chyba")
  ) {
    element.classList.add("is-error");
    return;
  }

  if (
    normalized.includes("zatím") ||
    normalized.includes("fallback") ||
    normalized.includes("doplněn")
  ) {
    element.classList.add("is-warn");
  }
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

function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
