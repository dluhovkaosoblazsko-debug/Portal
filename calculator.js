const CALCULATION_RULES = {
  lifeMinimum: 4860,
  housingNormative: 9430,
  energyAllowance: 2300,
  protectedAmountRatio: 0.85,
  dependentRatio: 0.25,
  spouseRatio: 0.25,
  fullAttachableLimit: 31521,
  minimumInstallment: 2200,
  adminFeeSingle: 1089,
  adminFeeJoint: 1633.5
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calculatorForm");
  if (!form) return;

  const spouseToggle = document.getElementById("spouseProtected");
  const spouseEligibility = document.getElementById("spouseEligibility");
  const arrearsTotalInput = document.getElementById("arrearsAlimonyTotal");
  const arrearsMonthlyInput = document.getElementById("arrearsAlimonyMonthly");
  const warningsBox = document.getElementById("calculatorWarnings");

  const output = {
    monthlyInstallment: document.getElementById("monthlyInstallment"),
    salaryLeft: document.getElementById("salaryLeft"),
    creditorMonthly: document.getElementById("creditorMonthly"),
    totalProtected: document.getElementById("totalProtected"),
    adminFee: document.getElementById("adminFee"),
    regularAlimonyInfo: document.getElementById("regularAlimonyInfo"),
    arrearsAlimonyInfo: document.getElementById("arrearsAlimonyInfo"),
    otherPriorityInfo: document.getElementById("otherPriorityInfo"),
    insolvencyTotal36: document.getElementById("insolvencyTotal36"),
    creditorTotal36: document.getElementById("creditorTotal36"),
    basicProtected: document.getElementById("basicProtected"),
    totalProtectedRaw: document.getElementById("totalProtectedRaw"),
    remainingAfterProtected: document.getElementById("remainingAfterProtected"),
    remainderUpToLimit: document.getElementById("remainderUpToLimit"),
    remainderAboveLimit: document.getElementById("remainderAboveLimit"),
    thirdsPortion: document.getElementById("thirdsPortion"),
    priorityPortion: document.getElementById("priorityPortion"),
    thirdsLimit: document.getElementById("thirdsLimit"),
    debtCoverage: document.getElementById("debtCoverage")
  };

  function getNumberValue(id) {
    const input = document.getElementById(id);
    return Math.max(Number(input?.value || 0), 0);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function formatPercent(value) {
    return `${new Intl.NumberFormat("cs-CZ", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value)} %`;
  }

  function syncSpouseEligibility() {
    const enabled = Boolean(spouseToggle.checked);
    spouseEligibility.disabled = !enabled;
    if (!enabled) spouseEligibility.value = "none";
  }

  function syncArrearsEstimate() {
    const total = getNumberValue("arrearsAlimonyTotal");
    const current = Number(arrearsMonthlyInput.value || 0);
    const autoValue = total > 0 ? total / 36 : 0;

    if (document.activeElement !== arrearsMonthlyInput || current === 0) {
      arrearsMonthlyInput.value = autoValue ? autoValue.toFixed(2) : "0";
    }
  }

  function getState() {
    const debtorMode = document.getElementById("debtorMode")?.value === "joint" ? "joint" : "single";
    const includeSpouse = Boolean(spouseToggle.checked) && spouseEligibility.value !== "none";

    return {
      totalDebt: getNumberValue("totalDebt"),
      netIncome: getNumberValue("netIncome"),
      dependents: Math.floor(getNumberValue("dependents")),
      debtorMode,
      includeSpouse,
      spouseEligibility: spouseEligibility.value,
      regularAlimony: getNumberValue("regularAlimony"),
      arrearsAlimonyTotal: getNumberValue("arrearsAlimonyTotal"),
      arrearsAlimonyMonthly: getNumberValue("arrearsAlimonyMonthly"),
      otherPriority: getNumberValue("otherPriority")
    };
  }

  function calculateScenario(state) {
    const baseSum =
      CALCULATION_RULES.lifeMinimum +
      CALCULATION_RULES.housingNormative +
      CALCULATION_RULES.energyAllowance;

    const basicProtected = baseSum * CALCULATION_RULES.protectedAmountRatio;
    const spouseComponent = state.includeSpouse ? basicProtected * CALCULATION_RULES.spouseRatio : 0;
    const dependentsComponent = basicProtected * CALCULATION_RULES.dependentRatio * state.dependents;
    const totalProtectedRaw = basicProtected + spouseComponent + dependentsComponent;
    const totalProtected = Math.ceil(totalProtectedRaw);

    const remainder = state.netIncome - totalProtected;
    const safeRemainder = Math.max(remainder, 0);
    const remainderUpToLimit = Math.min(safeRemainder, CALCULATION_RULES.fullAttachableLimit);
    const remainderAboveLimit = Math.max(safeRemainder - CALCULATION_RULES.fullAttachableLimit, 0);
    const thirdsPortion = Math.floor(remainderUpToLimit / 3) * 3;
    const priorityPortion = (2 / 3) * thirdsPortion;
    const monthlyInstallment = remainder > 0 ? priorityPortion + remainderAboveLimit : 0;
    const salaryLeft = remainder > 0 ? state.netIncome - monthlyInstallment : state.netIncome;

    const adminFee =
      state.debtorMode === "joint"
        ? CALCULATION_RULES.adminFeeJoint
        : CALCULATION_RULES.adminFeeSingle;

    const creditorMonthly = Math.max(
      monthlyInstallment - adminFee - state.regularAlimony - state.arrearsAlimonyMonthly - state.otherPriority,
      0
    );

    const insolvencyTotal36 = monthlyInstallment * 36;
    const creditorTotal36 = creditorMonthly * 36;
    const debtCoverage = state.totalDebt > 0 ? (creditorTotal36 / state.totalDebt) * 100 : 0;

    return {
      basicProtected,
      spouseComponent,
      dependentsComponent,
      totalProtectedRaw,
      totalProtected,
      remainder: safeRemainder,
      remainderUpToLimit,
      remainderAboveLimit,
      thirdsPortion,
      priorityPortion,
      monthlyInstallment,
      salaryLeft,
      adminFee,
      creditorMonthly,
      insolvencyTotal36,
      creditorTotal36,
      debtCoverage
    };
  }

  function renderWarnings(state, result) {
    const warnings = [];

    if (spouseToggle.checked && state.spouseEligibility === "none") {
      warnings.push("Pro započtení manžela nebo partnera je potřeba vybrat zákonný důvod.");
    }

    if (
      state.regularAlimony + state.arrearsAlimonyMonthly + state.otherPriority >
      result.monthlyInstallment
    ) {
      warnings.push("Prioritní platby jsou vyšší než měsíční splátka. Částka pro nezajištěné věřitele může být nulová.");
    }

    if (result.monthlyInstallment > 0 && result.monthlyInstallment < CALCULATION_RULES.minimumInstallment) {
      warnings.push("Měsíční splátka do oddlužení je nižší než orientační minimální splátka 2 200 Kč.");
    }

    if (state.arrearsAlimonyTotal > 0) {
      warnings.push("Měsíční úhrada dlužného výživného je jen orientační odhad a můžete ji ručně upravit.");
    }

    if (!warnings.length) {
      warningsBox.classList.add("hidden");
      warningsBox.innerHTML = "";
      return;
    }

    warningsBox.classList.remove("hidden");
    warningsBox.innerHTML = warnings
      .map((warning) => `<p class="calculator-warning-item">${warning}</p>`)
      .join("");
  }

  function render() {
    const state = getState();
    const result = calculateScenario(state);

    output.monthlyInstallment.textContent = formatCurrency(result.monthlyInstallment);
    output.salaryLeft.textContent = formatCurrency(result.salaryLeft);
    output.creditorMonthly.textContent = formatCurrency(result.creditorMonthly);
    output.totalProtected.textContent = formatCurrency(result.totalProtected);
    output.adminFee.textContent = formatCurrency(result.adminFee);
    output.regularAlimonyInfo.textContent = formatCurrency(state.regularAlimony);
    output.arrearsAlimonyInfo.textContent = formatCurrency(state.arrearsAlimonyMonthly);
    output.otherPriorityInfo.textContent = formatCurrency(state.otherPriority);
    output.insolvencyTotal36.textContent = formatCurrency(result.insolvencyTotal36);
    output.creditorTotal36.textContent = formatCurrency(result.creditorTotal36);
    output.basicProtected.textContent = formatCurrency(result.basicProtected);
    output.totalProtectedRaw.textContent = formatCurrency(result.totalProtectedRaw);
    output.remainingAfterProtected.textContent = formatCurrency(result.remainder);
    output.remainderUpToLimit.textContent = formatCurrency(result.remainderUpToLimit);
    output.remainderAboveLimit.textContent = formatCurrency(result.remainderAboveLimit);
    output.thirdsPortion.textContent = formatCurrency(result.thirdsPortion);
    output.priorityPortion.textContent = formatCurrency(result.priorityPortion);
    output.thirdsLimit.textContent = formatCurrency(CALCULATION_RULES.fullAttachableLimit);
    output.debtCoverage.textContent = formatPercent(result.debtCoverage);

    renderWarnings(state, result);
  }

  spouseToggle.addEventListener("change", () => {
    syncSpouseEligibility();
    render();
  });

  spouseEligibility.addEventListener("change", render);

  arrearsTotalInput.addEventListener("input", () => {
    syncArrearsEstimate();
    render();
  });

  form.addEventListener("input", render);
  form.addEventListener("change", render);

  syncSpouseEligibility();
  syncArrearsEstimate();
  render();
});
