(function () {
  "use strict";

  const pricing = window.WM_PRICING;
  const engine = window.WMQuoteEngine;

  if (!pricing || !engine) {
    document.body.textContent = "The quote tool could not load its pricing data.";
    return;
  }

  const STORAGE_KEY = "wm-quote-saved-v2";
  const LEGACY_STORAGE_KEY = "wm-quote-recents";
  const DEFAULT_STATE = Object.freeze({
    squareFeet: "",
    program: "Ess",
    applications: 6,
    area: "Entire Lot",
    payment: "autopay_visit",
    draftDay: 15,
    promotion: "NONE",
    squareFeetTouched: false,
  });

  const state = { ...DEFAULT_STATE };
  let savedQuotes = readSavedQuotes();
  let currentQuote = null;
  let toastTimer = null;
  let serviceWorkerRegistration = null;
  let refreshingForUpdate = false;

  const elements = {
    pricingVersionText: document.querySelector("#pricing-version-text"),
    pricingWarning: document.querySelector("#pricing-warning"),
    updateBanner: document.querySelector("#update-banner"),
    refreshButton: document.querySelector("#refresh-button"),
    resetButton: document.querySelector("#reset-button"),
    squareFeet: document.querySelector("#square-feet"),
    squareFeetError: document.querySelector("#square-feet-error"),
    applicationsDown: document.querySelector("#applications-down"),
    applicationsUp: document.querySelector("#applications-up"),
    applicationsOutput: document.querySelector("#applications-output"),
    programList: document.querySelector("#program-list"),
    paymentOptions: document.querySelector("#payment-options"),
    prepayOptionHint: document.querySelector("#prepay-option-hint"),
    draftDayPanel: document.querySelector("#draft-day-panel"),
    draftDayDown: document.querySelector("#draft-day-down"),
    draftDayUp: document.querySelector("#draft-day-up"),
    draftDayOutput: document.querySelector("#draft-day-output"),
    areaOptions: document.querySelector("#area-options"),
    promotionFieldset: document.querySelector("#promotion-fieldset"),
    promotionOptions: document.querySelector("#promotion-options"),
    prepayPromotionNote: document.querySelector("#prepay-promotion-note"),
    summaryHeading: document.querySelector("#summary-heading"),
    summaryArea: document.querySelector("#summary-area"),
    summaryTier: document.querySelector("#summary-tier"),
    summaryTotal: document.querySelector("#summary-total"),
    summaryRegular: document.querySelector("#summary-regular"),
    summaryVisits: document.querySelector("#summary-visits"),
    summaryError: document.querySelector("#summary-error"),
    breakdownPanel: document.querySelector("#breakdown-panel"),
    breakdownList: document.querySelector("#breakdown-list"),
    breakdownTotal: document.querySelector("#breakdown-total"),
    paymentSummary: document.querySelector("#payment-summary"),
    paymentSummaryText: document.querySelector("#payment-summary-text"),
    paymentScheduleList: document.querySelector("#payment-schedule-list"),
    notesPanel: document.querySelector("#notes-panel"),
    quoteNote: document.querySelector("#quote-note"),
    copyCustomerButton: document.querySelector("#copy-customer-button"),
    copyNotesButton: document.querySelector("#copy-notes-button"),
    saveQuoteButton: document.querySelector("#save-quote-button"),
    savedSearch: document.querySelector("#saved-search"),
    savedList: document.querySelector("#saved-list"),
    savedEmpty: document.querySelector("#saved-empty"),
    clearSavedButton: document.querySelector("#clear-saved-button"),
    saveDialog: document.querySelector("#save-dialog"),
    saveForm: document.querySelector("#save-form"),
    customerId: document.querySelector("#customer-id"),
    dialogQuoteNote: document.querySelector("#dialog-quote-note"),
    dialogQuoteTotal: document.querySelector("#dialog-quote-total"),
    closeDialogButton: document.querySelector("#close-dialog-button"),
    cancelSaveButton: document.querySelector("#cancel-save-button"),
    toast: document.querySelector("#toast"),
  };

  function readSavedQuotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) {
        return saved;
      }

      const legacy = JSON.parse(
        localStorage.getItem(LEGACY_STORAGE_KEY) || "[]",
      );
      if (!Array.isArray(legacy)) {
        return [];
      }

      return legacy.map((entry) => ({
        id: String(entry.id || `${Date.now()}-${Math.random()}`),
        cid: String(entry.cid || ""),
        savedAt: new Date(Number(entry.id) || Date.now()).toISOString(),
        pricingRelease: "legacy",
        note: String(entry.note || ""),
        totalCents: parseLegacyMoney(entry.total),
        state: {
          squareFeet: String(entry.sqft || ""),
          program: entry.program || "Ess",
          applications: Number(entry.apps) || 6,
          area: entry.area || "Entire Lot",
          payment: entry.payment || "autopay_visit",
          draftDay: Number(entry.day) || 15,
          promotion: entry.promo || "NONE",
        },
      }));
    } catch (error) {
      return [];
    }
  }

  function parseLegacyMoney(value) {
    const number = Number(String(value || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }

  function writeSavedQuotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQuotes));
      return true;
    } catch (error) {
      showToast("This browser could not save the quote.");
      return false;
    }
  }

  function quoteOptions(program) {
    return {
      squareFeet: state.squareFeet,
      program: program || state.program,
      applications: state.applications,
      area: state.area,
      payment: state.payment,
      draftDay: state.draftDay,
      promotion: state.promotion,
      date: new Date(),
    };
  }

  function setState(changes) {
    Object.assign(state, changes);
    render();
  }

  function render() {
    currentQuote = engine.calculateQuote(quoteOptions());
    const currentProgram = engine.getProgram(state.program);
    const validSquareFeet = Boolean(
      engine.parseSquareFeet(state.squareFeet),
    );
    const showFieldError =
      !validSquareFeet &&
      (state.squareFeetTouched || state.squareFeet.length > 0);

    elements.squareFeet.value = state.squareFeet;
    elements.squareFeet.setAttribute(
      "aria-invalid",
      String(showFieldError),
    );
    elements.squareFeetError.hidden = !showFieldError;

    elements.applicationsOutput.innerHTML =
      `<strong>${state.applications}</strong>` +
      `<span>${state.applications === 1 ? "application" : "applications"}</span>`;
    elements.applicationsDown.disabled = state.applications <= 1;
    elements.applicationsUp.disabled = state.applications >= 7;

    elements.draftDayOutput.innerHTML =
      `<strong>${engine.ordinal(state.draftDay)}</strong>` +
      "<span>of each month</span>";
    elements.draftDayDown.disabled = state.draftDay <= 1;
    elements.draftDayUp.disabled = state.draftDay >= 28;
    elements.draftDayPanel.hidden =
      state.payment !== "monthly_installment";

    const earlyPrepay = engine.isEarlyPrepay(new Date());
    elements.prepayOptionHint.textContent = earlyPrepay
      ? `${pricing.discounts.prepayPercent}% discount through January 31`
      : "Includes Free Lime Prepay Bonus";

    setPressedButtons(
      elements.paymentOptions,
      "[data-payment]",
      "payment",
      state.payment,
    );
    setPressedButtons(
      elements.areaOptions,
      "[data-area]",
      "area",
      state.area,
    );
    setPressedButtons(
      elements.promotionOptions,
      "[data-promotion]",
      "promotion",
      state.promotion,
    );

    const prepaySelected = state.payment === "prepay";
    elements.promotionFieldset.hidden = prepaySelected;
    elements.prepayPromotionNote.hidden = !prepaySelected;

    renderPrograms();

    elements.summaryHeading.textContent = currentProgram.name;
    elements.summaryArea.textContent = sentenceCase(state.area);
    elements.summaryError.hidden = Boolean(currentQuote);
    elements.breakdownPanel.hidden = !currentQuote;
    elements.notesPanel.hidden = !currentQuote;
    elements.summaryTotal.classList.toggle("is-empty", !currentQuote);
    elements.copyCustomerButton.disabled = !currentQuote;
    elements.copyNotesButton.disabled = !currentQuote;
    elements.saveQuoteButton.disabled = !currentQuote;

    if (!currentQuote) {
      elements.summaryTier.textContent = "Enter square footage";
      elements.summaryTotal.textContent = "Not priced";
      elements.summaryRegular.textContent = "Not priced";
      elements.summaryVisits.textContent = "Not priced";
      elements.paymentSummary.hidden = true;
      return;
    }

    elements.summaryTier.textContent = currentQuote.rates.tier;
    elements.summaryTotal.textContent = engine.formatMoney(
      currentQuote.totalCents,
    );
    elements.summaryRegular.textContent = engine.formatMoney(
      currentQuote.rates.regularCents,
    );
    elements.summaryVisits.textContent = String(currentQuote.visits);
    elements.breakdownTotal.textContent = engine.formatMoney(
      currentQuote.totalCents,
    );
    renderBreakdown(currentQuote);
    renderPaymentSchedule(currentQuote);
    elements.quoteNote.textContent = engine.createInternalNote(
      currentQuote,
      state.draftDay,
    );
  }

  function setPressedButtons(container, selector, dataName, selectedValue) {
    container.querySelectorAll(selector).forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset[dataName] === selectedValue),
      );
    });
  }

  function renderPrograms() {
    const fragment = document.createDocumentFragment();

    pricing.programs.forEach((program) => {
      const quote = engine.calculateQuote(quoteOptions(program.key));
      const selected = state.program === program.key;
      const row = document.createElement("tr");
      if (selected) {
        row.className = "selected";
      }

      const programCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "program-select";
      button.dataset.program = program.key;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `Select ${program.name} program`);

      const dot = document.createElement("span");
      dot.className = "selection-dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      const name = document.createElement("span");
      name.className = "program-name";
      name.textContent = program.name;
      const extra = document.createElement("span");
      extra.className = "program-extra";
      extra.textContent = program.extra;
      label.append(name, extra);
      button.append(dot, label);
      programCell.append(button);

      const regularCell = document.createElement("td");
      regularCell.className = "program-price";
      regularCell.textContent = quote
        ? engine.formatMoney(quote.rates.regularCents)
        : "Not priced";

      const totalCell = document.createElement("td");
      totalCell.className = "program-price";
      totalCell.textContent = quote
        ? engine.formatMoney(quote.totalCents)
        : "Not priced";

      row.append(programCell, regularCell, totalCell);
      fragment.append(row);
    });

    elements.programList.replaceChildren(fragment);
  }

  function renderBreakdown(quote) {
    const fragment = document.createDocumentFragment();
    quote.lines.forEach((line) => {
      const item = document.createElement("li");
      if (line.kind === "discount") {
        item.className = "discount-line";
      }
      const label = document.createElement("span");
      label.textContent = line.label;
      const amount = document.createElement("strong");
      amount.textContent =
        line.kind === "discount"
          ? `−${engine.formatMoney(Math.abs(line.amountCents))}`
          : engine.formatMoney(line.amountCents);
      item.append(label, amount);
      fragment.append(item);
    });
    elements.breakdownList.replaceChildren(fragment);
  }

  function renderPaymentSchedule(quote) {
    const isMonthly = quote.payment === "monthly_installment";
    elements.paymentSummary.hidden = !isMonthly;
    if (!isMonthly) {
      elements.paymentScheduleList.replaceChildren();
      return;
    }

    const schedule = engine.createMonthlySchedule(
      quote.totalCents,
      state.draftDay,
      quote.date,
    );
    elements.paymentSummaryText.textContent = schedule.summary;
    const fragment = document.createDocumentFragment();
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });

    schedule.installments.forEach((installment) => {
      const item = document.createElement("li");
      const date = document.createElement("span");
      date.textContent = formatter.format(installment.date);
      const amount = document.createElement("strong");
      amount.textContent = engine.formatMoney(installment.amountCents);
      item.append(date, amount);
      fragment.append(item);
    });

    elements.paymentScheduleList.replaceChildren(fragment);
  }

  function renderSavedQuotes() {
    const query = elements.savedSearch.value.trim().toLowerCase();
    const filtered = savedQuotes.filter((entry) =>
      String(entry.cid || "").toLowerCase().includes(query),
    );

    elements.savedEmpty.hidden = filtered.length > 0;
    elements.savedEmpty.textContent =
      savedQuotes.length === 0
        ? "No saved quotes yet."
        : "No saved quote matches that CID.";
    elements.clearSavedButton.hidden = savedQuotes.length === 0;

    const fragment = document.createDocumentFragment();
    filtered.forEach((entry) => {
      const savedState = entry.state || {};
      const item = document.createElement("li");
      item.className = "saved-item";

      const main = document.createElement("div");
      main.className = "saved-item-main";
      const cid = document.createElement("div");
      cid.className = "saved-cid";
      cid.textContent = `CID ${entry.cid}`;
      const note = document.createElement("div");
      note.className = "saved-note";
      note.textContent = entry.note || "Saved quote";
      const meta = document.createElement("div");
      meta.className = "saved-meta";
      const squareFeet = engine.parseSquareFeet(savedState.squareFeet);
      const savedDate = new Date(entry.savedAt);
      const dateLabel = Number.isNaN(savedDate.valueOf())
        ? "Saved locally"
        : new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(savedDate);
      meta.textContent = `${engine.formatNumber(squareFeet || 0)} sq ft • ${dateLabel}`;
      main.append(cid, note, meta);

      const side = document.createElement("div");
      side.className = "saved-item-side";
      const total = document.createElement("span");
      total.className = "saved-total";
      total.textContent = engine.formatMoney(entry.totalCents || 0);
      const load = document.createElement("button");
      load.type = "button";
      load.className = "saved-load";
      load.dataset.loadSaved = entry.id;
      load.textContent = "Load";
      load.setAttribute("aria-label", `Load quote for CID ${entry.cid}`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "saved-delete";
      remove.dataset.deleteSaved = entry.id;
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete quote for CID ${entry.cid}`);
      side.append(total, load, remove);

      item.append(main, side);
      fragment.append(item);
    });

    elements.savedList.replaceChildren(fragment);
  }

  function sentenceCase(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
  }

  function cleanSquareFeetInput(value) {
    return String(value || "").replace(/[^\d]/g, "").slice(0, 9);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2400);
  }

  async function copyText(text, successMessage) {
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
          throw new Error("Clipboard unavailable");
        }
      }
      showToast(successMessage);
    } catch (error) {
      showToast("Copying is unavailable in this browser.");
    }
  }

  function openSaveDialog() {
    if (!currentQuote) return;
    elements.customerId.value = "";
    elements.dialogQuoteNote.textContent = engine.createInternalNote(
      currentQuote,
      state.draftDay,
    );
    elements.dialogQuoteTotal.textContent = engine.formatMoney(
      currentQuote.totalCents,
    );
    if (typeof elements.saveDialog.showModal === "function") {
      elements.saveDialog.showModal();
    } else {
      elements.saveDialog.setAttribute("open", "");
    }
    window.setTimeout(() => elements.customerId.focus(), 0);
  }

  function closeSaveDialog() {
    if (typeof elements.saveDialog.close === "function") {
      elements.saveDialog.close();
    } else {
      elements.saveDialog.removeAttribute("open");
    }
  }

  function saveCurrentQuote(event) {
    event.preventDefault();
    if (!currentQuote) return;

    const cid = elements.customerId.value
      .trim()
      .replace(/[^\w-]/g, "")
      .slice(0, 24);
    if (!cid) {
      elements.customerId.setCustomValidity("Enter a CID to save this quote.");
      elements.customerId.reportValidity();
      return;
    }
    elements.customerId.setCustomValidity("");

    const id =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry = {
      id,
      cid,
      savedAt: new Date().toISOString(),
      pricingRelease: pricing.release,
      note: engine.createInternalNote(currentQuote, state.draftDay),
      totalCents: currentQuote.totalCents,
      state: {
        squareFeet: state.squareFeet,
        program: state.program,
        applications: state.applications,
        area: state.area,
        payment: state.payment,
        draftDay: state.draftDay,
        promotion: state.promotion,
      },
    };

    savedQuotes = [entry, ...savedQuotes];
    if (writeSavedQuotes()) {
      closeSaveDialog();
      elements.savedSearch.value = "";
      renderSavedQuotes();
      showToast(`Quote saved for CID ${cid}.`);
    }
  }

  function loadSavedQuote(id) {
    const entry = savedQuotes.find((item) => String(item.id) === String(id));
    if (!entry) return;

    const saved = entry.state || {};
    Object.assign(state, DEFAULT_STATE, {
      squareFeet: cleanSquareFeetInput(saved.squareFeet),
      program: pricing.programs.some(
        (program) => program.key === saved.program,
      )
        ? saved.program
        : "Ess",
      applications: Math.min(
        7,
        Math.max(1, Number(saved.applications) || 6),
      ),
      area: ["Entire Lot", "Front and Sides", "Backyard Only"].includes(
        saved.area,
      )
        ? saved.area
        : "Entire Lot",
      payment: Object.prototype.hasOwnProperty.call(
        engine.PAYMENT_LABELS,
        saved.payment,
      )
        ? saved.payment
        : "autopay_visit",
      draftDay: Math.min(28, Math.max(1, Number(saved.draftDay) || 15)),
      promotion: Object.prototype.hasOwnProperty.call(
        engine.PROMOTION_LABELS,
        saved.promotion,
      )
        ? saved.promotion
        : "NONE",
      squareFeetTouched: true,
    });

    if (state.payment === "prepay") {
      state.promotion = "NONE";
    }

    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`Loaded quote for CID ${entry.cid}.`);
  }

  function deleteSavedQuote(id) {
    savedQuotes = savedQuotes.filter(
      (entry) => String(entry.id) !== String(id),
    );
    writeSavedQuotes();
    renderSavedQuotes();
    showToast("Saved quote deleted.");
  }

  function clearSavedQuotes() {
    if (!savedQuotes.length) return;
    const confirmed = window.confirm(
      "Delete all quotes saved in this browser?",
    );
    if (!confirmed) return;
    savedQuotes = [];
    writeSavedQuotes();
    renderSavedQuotes();
    showToast("All saved quotes were deleted.");
  }

  function resetQuote() {
    Object.assign(state, DEFAULT_STATE);
    render();
    elements.squareFeet.focus();
    showToast("Quote reset.");
  }

  function updatePricingStatus() {
    elements.pricingVersionText.textContent =
      `${pricing.version} • Updated ${pricing.updated}`;
    if (new Date().getFullYear() > pricing.year) {
      elements.pricingWarning.textContent =
        `Pricing is marked for ${pricing.year}. Confirm the current price list before quoting.`;
      elements.pricingWarning.hidden = false;
    } else {
      elements.pricingWarning.hidden = true;
    }
  }

  function showUpdateBanner() {
    elements.updateBanner.hidden = false;
  }

  async function checkRemoteVersion() {
    try {
      const response = await fetch(
        `./version.json?check=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const remote = await response.json();
      if (remote.release && remote.release !== pricing.release) {
        showUpdateBanner();
      }
    } catch (error) {
      // Offline use is expected and should not interrupt quoting.
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      serviceWorkerRegistration =
        await navigator.serviceWorker.register("./sw.js");

      if (
        serviceWorkerRegistration.waiting &&
        navigator.serviceWorker.controller
      ) {
        showUpdateBanner();
      }

      serviceWorkerRegistration.addEventListener("updatefound", () => {
        const worker = serviceWorkerRegistration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateBanner();
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshingForUpdate) {
          window.location.reload();
        }
      });
    } catch (error) {
      // The app still works online when service workers are unavailable.
    }
  }

  async function refreshForUpdate() {
    refreshingForUpdate = true;
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = "Refreshing";

    try {
      if (serviceWorkerRegistration) {
        await serviceWorkerRegistration.update();
        if (serviceWorkerRegistration.waiting) {
          serviceWorkerRegistration.waiting.postMessage({
            type: "SKIP_WAITING",
          });
          window.setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }
    } catch (error) {
      // Reload below still retrieves the current network version.
    }

    window.location.reload();
  }

  elements.squareFeet.addEventListener("input", (event) => {
    setState({
      squareFeet: cleanSquareFeetInput(event.target.value),
      squareFeetTouched: true,
    });
  });
  elements.squareFeet.addEventListener("blur", () => {
    if (!state.squareFeetTouched) {
      setState({ squareFeetTouched: true });
    }
  });

  elements.applicationsDown.addEventListener("click", () => {
    setState({ applications: Math.max(1, state.applications - 1) });
  });
  elements.applicationsUp.addEventListener("click", () => {
    setState({ applications: Math.min(7, state.applications + 1) });
  });
  elements.draftDayDown.addEventListener("click", () => {
    setState({ draftDay: Math.max(1, state.draftDay - 1) });
  });
  elements.draftDayUp.addEventListener("click", () => {
    setState({ draftDay: Math.min(28, state.draftDay + 1) });
  });

  elements.programList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-program]");
    if (button) {
      setState({ program: button.dataset.program });
    }
  });

  elements.paymentOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payment]");
    if (!button) return;
    const payment = button.dataset.payment;
    setState({
      payment,
      promotion: payment === "prepay" ? "NONE" : state.promotion,
    });
  });

  elements.areaOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-area]");
    if (button) {
      setState({ area: button.dataset.area });
    }
  });

  elements.promotionOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-promotion]");
    if (button && state.payment !== "prepay") {
      setState({ promotion: button.dataset.promotion });
    }
  });

  elements.copyCustomerButton.addEventListener("click", () => {
    copyText(
      engine.createCustomerText(currentQuote, state.draftDay),
      "Customer quote copied.",
    );
  });
  elements.copyNotesButton.addEventListener("click", () => {
    copyText(
      engine.createInternalNote(currentQuote, state.draftDay),
      "Quote notes copied.",
    );
  });
  elements.saveQuoteButton.addEventListener("click", openSaveDialog);
  elements.resetButton.addEventListener("click", resetQuote);

  elements.saveForm.addEventListener("submit", saveCurrentQuote);
  elements.closeDialogButton.addEventListener("click", closeSaveDialog);
  elements.cancelSaveButton.addEventListener("click", closeSaveDialog);
  elements.saveDialog.addEventListener("click", (event) => {
    if (event.target === elements.saveDialog) {
      closeSaveDialog();
    }
  });
  elements.customerId.addEventListener("input", () => {
    elements.customerId.setCustomValidity("");
  });

  elements.savedSearch.addEventListener("input", renderSavedQuotes);
  elements.savedList.addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-saved]");
    if (loadButton) {
      loadSavedQuote(loadButton.dataset.loadSaved);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-saved]");
    if (deleteButton) {
      deleteSavedQuote(deleteButton.dataset.deleteSaved);
    }
  });
  elements.clearSavedButton.addEventListener("click", clearSavedQuotes);
  elements.refreshButton.addEventListener("click", refreshForUpdate);

  updatePricingStatus();
  render();
  renderSavedQuotes();
  registerServiceWorker();
  checkRemoteVersion();
  window.setInterval(checkRemoteVersion, 15 * 60 * 1000);
})();
