"use strict";

const STORAGE_KEY = "ideverkstan-ideas-v1";
const CHECKLIST = [
  "Jag har kontrollerat leverantör och produktinformation",
  "Jag har kontrollerat kostnader och kalkyl",
  "Jag har granskat produktens kvalitet och provexemplar",
  "Jag har granskat och godkänt produktsidetexten"
];

const form = document.querySelector("#idea-form");
const ideaList = document.querySelector("#idea-list");
const emptyState = document.querySelector("#empty-state");
const ideaCount = document.querySelector("#idea-count");
const formMessage = document.querySelector("#form-message");
const storageMessage = document.querySelector("#storage-message");
const promptPanel = document.querySelector("#prompt-panel");
const promptText = document.querySelector("#prompt-text");
const promptMessage = document.querySelector("#prompt-message");
let ideas = [];
let storageReady = true;

function readIdeas() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some((idea) =>
      !idea || typeof idea.name !== "string" ||
      ![idea.purchaseCost, idea.shippingCost, idea.salePrice, idea.feeRate].every(Number.isFinite) ||
      !Array.isArray(idea.checks) || idea.checks.length !== CHECKLIST.length
    )) {
      throw new Error("Sparade data har fel format.");
    }
    return parsed;
  } catch (error) {
    storageReady = false;
    storageMessage.textContent = "Kunde inte läsa sparade idéer. Dina ändringar sparas inte i webbläsaren.";
    console.error("Kunde inte läsa idéer från lokal lagring:", error);
    return [];
  }
}

function persistIdeas() {
  if (!storageReady) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
    storageMessage.textContent = "";
  } catch (error) {
    storageReady = false;
    storageMessage.textContent = "Kunde inte spara lokalt. Dina idéer finns kvar tills du stänger sidan.";
    console.error("Kunde inte spara idéer lokalt:", error);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 2
  }).format(value);
}

function calculate(idea) {
  const fee = idea.salePrice * idea.feeRate / 100;
  const margin = idea.salePrice - idea.purchaseCost - idea.shippingCost - fee;
  const marginRate = idea.salePrice > 0 ? margin / idea.salePrice * 100 : null;
  return { fee, margin, marginRate };
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderIdea(idea, index) {
  const card = makeElement("article", "idea-card");
  card.tabIndex = -1;
  const top = makeElement("div", "card-top");
  const titleGroup = makeElement("div", "card-title");
  const title = makeElement("h3", "", idea.name);
  if (idea.approved) {
    title.append(makeElement("span", "approved-badge", "Godkänd"));
  }
  titleGroup.append(title);
  if (idea.supplierUrl) {
    const link = makeElement("a", "card-link", idea.supplierUrl);
    link.href = idea.supplierUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Öppna leverantörslänk för ${idea.name} i en ny flik`);
    titleGroup.append(link);
  }
  const removeButton = makeElement("button", "icon-button", "×");
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", `Ta bort ${idea.name}`);
  removeButton.addEventListener("click", () => {
    ideas.splice(index, 1);
    persistIdeas();
    render();
    const remainingCards = ideaList.querySelectorAll(".idea-card");
    (remainingCards[index] || remainingCards[index - 1] || form.elements.name).focus();
  });
  top.append(titleGroup, removeButton);

  const { fee, margin, marginRate } = calculate(idea);
  const metrics = makeElement("div", "metric-grid");
  const metricData = [
    ["Försäljningspris", formatCurrency(idea.salePrice), ""],
    ["Kostnad inkl. avgift", formatCurrency(idea.purchaseCost + idea.shippingCost + fee), ""],
    ["Uppskattad marginal", formatCurrency(margin), margin >= 0 ? "metric-highlight" : "metric-negative"],
    ["Marginalandel", `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(marginRate)}%`, margin >= 0 ? "metric-highlight" : "metric-negative"]
  ];
  for (const [label, value, extraClass] of metricData) {
    const metric = makeElement("div", `metric ${extraClass}`);
    metric.append(makeElement("span", "", label), makeElement("strong", "", value));
    metrics.append(metric);
  }
  const detail = makeElement("p", "calc-detail",
    `${formatCurrency(idea.purchaseCost)} inköp + ${formatCurrency(idea.shippingCost)} frakt + ${formatCurrency(fee)} avgift (${idea.feeRate}%)`);

  card.append(top, metrics, detail);
  if (idea.notes) card.append(makeElement("p", "card-notes", idea.notes));

  const checklist = makeElement("section", "checklist");
  checklist.setAttribute("aria-label", `Checklista för ${idea.name}`);
  const checkedCount = idea.checks.filter(Boolean).length;
  const checklistHeading = makeElement("div", "checklist-heading");
  checklistHeading.append(
    makeElement("strong", "", "Din checklista"),
    makeElement("span", "", `${checkedCount} av ${CHECKLIST.length} klara`)
  );
  checklist.append(checklistHeading);

  CHECKLIST.forEach((label, checkIndex) => {
    const row = makeElement("label", "check-row");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(idea.checks[checkIndex]);
    checkbox.addEventListener("change", () => {
      idea.checks[checkIndex] = checkbox.checked;
      if (idea.checks.some((checked) => !checked)) idea.approved = false;
      persistIdeas();
      render();
      ideaList.querySelectorAll(".idea-card")[index]?.querySelectorAll(".check-row input")[checkIndex]?.focus();
    });
    row.append(checkbox, makeElement("span", "", label));
    checklist.append(row);
  });

  const approvalLabel = makeElement("label", "check-row approval-row");
  const approvalInput = document.createElement("input");
  approvalInput.type = "checkbox";
  approvalInput.checked = Boolean(idea.approved);
  approvalInput.disabled = checkedCount !== CHECKLIST.length;
  approvalInput.setAttribute("aria-label", "Godkänn idén för nästa steg");
  approvalInput.addEventListener("change", () => {
    idea.approved = approvalInput.checked;
    persistIdeas();
    render();
    ideaList.querySelectorAll(".idea-card")[index]?.querySelector(".approval-row input")?.focus();
  });
  const approvalText = document.createElement("span");
  approvalText.append(
    document.createTextNode("Jag godkänner idén för nästa steg"),
    makeElement("span", "approval-caption", "Detta publicerar, beställer eller säljer ingenting.")
  );
  approvalLabel.append(approvalInput, approvalText);
  checklist.append(approvalLabel);
  card.append(checklist);

  const actions = makeElement("div", "card-actions");
  const reviewButton = makeElement("button", "button button-secondary button-small", "Skapa granskningsprompt");
  reviewButton.type = "button";
  reviewButton.addEventListener("click", () => showPrompt(idea, "review"));
  const copyButton = makeElement("button", "button button-secondary button-small", "Skapa textprompt");
  copyButton.type = "button";
  copyButton.addEventListener("click", () => showPrompt(idea, "copy"));
  actions.append(reviewButton, copyButton);
  card.append(actions);
  return card;
}

function render() {
  ideaList.replaceChildren(...ideas.map(renderIdea));
  emptyState.hidden = ideas.length > 0;
  ideaCount.textContent = `${ideas.length} ${ideas.length === 1 ? "idé" : "idéer"}`;
}

function showPrompt(idea, type) {
  const result = calculate(idea);
  const context = [
    `Produktidé: ${idea.name}`,
    `Leverantörslänk: ${idea.supplierUrl || "Inte angiven"}`,
    `Inköpspris: ${formatCurrency(idea.purchaseCost)}`,
    `Frakt per produkt: ${formatCurrency(idea.shippingCost)}`,
    `Tänkt försäljningspris: ${formatCurrency(idea.salePrice)}`,
    `Avgift: ${idea.feeRate}% (${formatCurrency(result.fee)})`,
    `Uppskattad marginal före övriga kostnader: ${formatCurrency(result.margin)} (${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(result.marginRate)}%)`,
    `Anteckningar: ${idea.notes || "Inga"}`
  ].join("\n");

  promptText.value = type === "review"
    ? `Hjälp mig att kritiskt granska den här produktidén utifrån informationen nedan.\n\n${context}\n\nGe mig:\n1. Vilka antaganden jag bör verifiera innan jag går vidare.\n2. Relevanta risker, inklusive leverantör, kvalitet, frakt och dolda kostnader.\n3. Några konkreta frågor att undersöka hos potentiella kunder.\n4. En kort bedömning av vilka uppgifter som saknas.\n\nHitta inte på fakta och säg tydligt när information saknas. Kalkylen är en grov uppskattning; verifiera inga leverantörer eller priser åt mig.`
    : `Skriv ett tydligt, ärligt första utkast till en produktsida för den här produktidén.\n\n${context}\n\nFöreslå en rubrik, en kort beskrivning och 3 möjliga produktegenskaper. Använd inga påståenden om kvalitet, hållbarhet, hälsa eller resultat om de inte stöds av uppgifterna ovan. Markera vilka produktfakta jag behöver verifiera och hitta inte på egenskaper.`;

  promptPanel.hidden = false;
  promptMessage.textContent = "";
  promptPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const name = String(data.get("name")).trim();
  if (!name) {
    form.elements.name.setCustomValidity("Ange ett namn för produktidén.");
    form.reportValidity();
    form.elements.name.setCustomValidity("");
    return;
  }
  const salePrice = Number(data.get("salePrice"));
  const feeRate = Number(data.get("feeRate"));
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    form.elements.salePrice.setCustomValidity("Ange ett försäljningspris som är större än 0.");
    form.reportValidity();
    form.elements.salePrice.setCustomValidity("");
    return;
  }
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 100) {
    form.elements.feeRate.setCustomValidity("Avgiften måste vara mellan 0 och 100 procent.");
    form.reportValidity();
    form.elements.feeRate.setCustomValidity("");
    return;
  }

  const supplierUrl = String(data.get("supplierUrl")).trim();
  if (supplierUrl) {
    try {
      const url = new URL(supplierUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Ogiltigt protokoll");
    } catch {
      formMessage.textContent = "Ange en giltig länk som börjar med https:// eller http://.";
      form.elements.supplierUrl.focus();
      return;
    }
  }

  ideas.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    supplierUrl,
    purchaseCost: Number(data.get("purchaseCost")),
    shippingCost: Number(data.get("shippingCost")),
    salePrice,
    feeRate,
    notes: String(data.get("notes")).trim(),
    checks: CHECKLIST.map(() => false),
    approved: false
  });
  persistIdeas();
  render();
  form.reset();
  form.elements.purchaseCost.value = "0";
  form.elements.shippingCost.value = "0";
  form.elements.feeRate.value = "0";
  ideaList.querySelector(".idea-card")?.focus();
});

document.querySelector("#close-prompt").addEventListener("click", () => {
  promptPanel.hidden = true;
});

document.querySelector("#copy-prompt").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(promptText.value);
    promptMessage.textContent = "Prompten är kopierad.";
  } catch {
    promptText.focus();
    promptText.select();
    promptMessage.textContent = "Markera och kopiera prompten manuellt.";
  }
});

ideas = readIdeas();
render();
