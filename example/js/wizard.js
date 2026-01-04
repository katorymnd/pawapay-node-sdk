/* js/wizard.js */
/**
 * Combined Wizard Logic - Deposit & Payout (Surgical Merge)
 *
 * Features:
 * - Unified initialization for both deposit and payout flows
 * - Preserved deposit logic: Currency persistence via hvCurrency, PIN instructions, language toggle
 * - Preserved payout logic: Multi-recipient support, dynamic metadata, v1/v2 config loading
 * - Shared infrastructure: Config loading, country/operator mapping, validation, alerts
 * - Non-destructive: Each flow operates independently based on page context
 */
/* eslint-env browser */
/* global libphonenumber, bootstrap */

console.log("🚦 Starting combined wizard initialization...");
console.log("📄 Initial document readyState:", document.readyState);

(async () => {
  // ① Detect page context
  const isDepositPage = document.getElementById("country-catalog-data") && !document.getElementById("payout-form");
  const isPayoutPage = document.getElementById("payout-form");
  console.log("🔍 Page detection:", {
    isDepositPage: !!isDepositPage,
    isPayoutPage: !!isPayoutPage
  });

  // Deposit page initialization
  if (isDepositPage) {
    console.log("💰 Initializing deposit wizard...");
    await initDepositWizard();
  }

  // Payout page initialization
  if (isPayoutPage) {
    console.log("💸 Initializing payout form...");
    await initPayoutForm();
  }

  // ========== DEPOSIT WIZARD ==========
  async function initDepositWizard() {
    // Parse embedded JSON data
    const catalog = JSON.parse(document.getElementById("country-catalog-data").textContent);
    const availabilityData = JSON.parse(document.getElementById("availability-data").textContent);
    const activeConfData = JSON.parse(document.getElementById("active-conf-data").textContent);

    // Build lookup maps
    const availabilityMap = {};
    availabilityData.forEach((ctry) => {
      (ctry.correspondents || []).forEach((cor) => {
        availabilityMap[cor.correspondent] = (cor.operationTypes || []).every(
          (op) => op.status === "OPERATIONAL"
        );
      });
    });

    const ownerMap = {};
    const providerDetailsMap = {}; // Store full provider details including logo, displayName, pinPromptInstructions
    (activeConfData.countries || []).forEach((ctry) => {
      const items = ctry.providers || ctry.correspondents || [];
      items.forEach((item) => {
        const key = item.provider || item.correspondent;
        ownerMap[key] = item.nameDisplayedToCustomer || item.ownerName || "N/A";
        providerDetailsMap[key] = {
          displayName: item.displayName || item.name || "",
          logo: item.logo || "",
          nameDisplayedToCustomer: item.nameDisplayedToCustomer || item.ownerName || "",
          currencies: item.currencies || []
        };
      });
    });

    // Merge data into catalog (non-destructive)
    Object.values(catalog).forEach((countryData) => {
      (countryData.operators || []).forEach((op) => {
        if (Object.prototype.hasOwnProperty.call(availabilityMap, op.apiCode)) {
          op.available = availabilityMap[op.apiCode];
        }
        if (Object.prototype.hasOwnProperty.call(ownerMap, op.apiCode)) {
          op.ownerName = ownerMap[op.apiCode];
        }
      });
    });

    // Initialize wizard UI
    function initWizard() {
      let currentLanguage = "en";

      // Helper: Get PIN prompt instructions for a provider + currency
      function getPinInstructions(apiCode, currency) {
        if (!providerDetailsMap[apiCode]) return null;
        const provider = providerDetailsMap[apiCode];
        const currencyData = (provider.currencies || []).find(
          (c) => c.currency === currency
        );
        if (!currencyData) return null;

        const depositOp =
          currencyData.operationTypes?.DEPOSIT ||
          (Array.isArray(currencyData.operationTypes)
            ? currencyData.operationTypes.find((op) => op.type === "DEPOSIT")
            : null);

        if (
          !depositOp ||
          !depositOp.pinPromptRevivable ||
          !depositOp.pinPromptInstructions
        ) {
          return null;
        }

        return {
          pinPromptRevivable: depositOp.pinPromptRevivable,
          instructions: depositOp.pinPromptInstructions,
          displayName: provider.displayName,
          logo: provider.logo,
          nameDisplayedToCustomer: provider.nameDisplayedToCustomer
        };
      }

      // Helper: Render PIN instructions HTML with language support
      function renderPinInstructions(pinData, language) {
        if (!pinData || !pinData.instructions || !pinData.instructions.channels) {
          return "";
        }
        const lang = language.toLowerCase();
        const channels = pinData.instructions.channels;
        let html = '<div class="pin-instructions-container mt-3">';
        channels.forEach((channel, idx) => {
          const displayName =
            channel.displayName?.[lang] ||
            channel.displayName?.en ||
            "Did not get a PIN prompt?";
          const instructions =
            channel.instructions?.[lang] || channel.instructions?.en || [];
          html += `
            <div class="alert alert-warning ${idx > 0 ? "mt-2" : ""}" role="alert">
              <div class="d-flex align-items-center mb-2">
                ${pinData.logo ? `<img src="${pinData.logo}" width="24" height="24" class="me-2" alt="${pinData.displayName}">` : ""}
                <strong>${displayName}</strong>
              </div>
              <ol class="mb-0 ps-3">`;
          instructions.forEach((step) => {
            html += `<li class="small">${step.text || step.template}</li>`;
          });
          html += "</ol>";
          if (channel.quickLink) {
            html += `<div class="mt-2"><small><strong>Quick Link:</strong> <code>${channel.quickLink}</code></small></div>`;
          }
          html += "</div>";
        });
        html += "</div>";
        return html;
      }

      // Preloader
      const pre = document.getElementById("preloader");
      if (pre) setTimeout(() => pre.classList.add("done"), 300);

      // Steps & bullets
      const steps = [...document.querySelectorAll(".step")];
      const bullets = [...document.querySelectorAll("#progressBar li")];
      let current = 0;
      const goToStep = (i) => {
        steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
        bullets.forEach((b, idx) => {
          b.classList.toggle("active", idx === i);
          b.classList.toggle("completed", idx < i);
        });
        current = i;
      };
      const next = () => current < steps.length - 1 && goToStep(current + 1);
      const prev = () => current > 0 && goToStep(current - 1);

      // STEP 1 elements
      const selCountry = document.getElementById("country");
      const dialCode = document.getElementById("dialCode");
      const flagImg = document.getElementById("countryFlag");
      const hvCountry = document.getElementById("hvCountry");

      // Create or reuse hvCurrency hidden field to persist user-selected currency
      let hvCurrency = document.getElementById("hvCurrency");
      if (!hvCurrency) {
        hvCurrency = document.createElement("input");
        hvCurrency.type = "hidden";
        hvCurrency.id = "hvCurrency";
        hvCurrency.name = "selectedCurrency";
        document.getElementById("depositForm").appendChild(hvCurrency);
      }

      const mnoWrap = document.getElementById("mnoContainer");
      const mnoError = document.getElementById("mnoError");

      // STEP 3 elements
      const currencyLabel = document.getElementById("currencyLabel");
      const amountIn = document.getElementById("amount");
      const phoneIn = document.getElementById("payerMsisdn");
      const descIn = document.getElementById("description");
      const hvAmount = document.getElementById("hvAmount");
      const hvPhone = document.getElementById("hvPhone");
      const hvDesc = document.getElementById("hvDesc");

      // STEP 4 elements
      const summaryCountry = document.getElementById("summaryCountry");
      const summaryOperator = document.getElementById("summaryOperator");
      const summaryAmount = document.getElementById("summaryAmount");
      const summaryPhone = document.getElementById("summaryPhone");
      const summaryDesc = document.getElementById("summaryDesc");
      const hvConfirm = document.getElementById("hvConfirm");

      let selectedMno = null;

      // Validation helpers
      const isValidAmount = (v) => /^\d+(\.\d{1,2})?$/.test(v) && +v > 0;
      const isValidDesc = (v) => /^[A-Za-z0-9 ]{1,22}$/.test(v);
      const isValidPhone = (v) => {
        try {
          if (typeof libphonenumber === "undefined" || !libphonenumber) {
            return /^\+\d{7,15}$/.test(v);
          }
          return libphonenumber.parsePhoneNumber(v).isValid();
        } catch {
          return false;
        }
      };

      // — STEP 1: Country selection & operator cards setup
      const step1NextEl = document.getElementById("step1Next");
      if (step1NextEl) {
        step1NextEl.addEventListener("click", () => {
          if (!selCountry || !selCountry.value) {
            if (selCountry) selCountry.classList.add("is-invalid");
            return;
          }
          selCountry.classList.remove("is-invalid");

          // Read the actual selected <option> to get exact data-currency
          const selectedIndex = selCountry.selectedIndex;
          const selectedOption = selCountry.options[selectedIndex];
          const country = selCountry.value;

          // Prefer user's explicit choice (data-currency), fallback to catalog
          const selectedCurrency =
            (selectedOption &&
              (selectedOption.dataset?.currency ||
                selectedOption.getAttribute("data-currency"))) ||
            null;

          const countryData = catalog[country] || { currency: "", operators: [] };
          const currencyFromCatalog = countryData.currency || "";

          // Use chosen currency, persist to hvCurrency
          const chosenCurrency = selectedCurrency || currencyFromCatalog || "";
          hvCurrency.value = chosenCurrency;

          // Update visible currency label immediately
          if (currencyLabel) currencyLabel.textContent = chosenCurrency;

          // Update flag + dial code using catalog operator fallback
          const { operators } = countryData;
          if (operators && operators[0]) {
            if (dialCode) dialCode.textContent = operators[0].code;
            if (flagImg) flagImg.src = `/public/flags/${operators[0].flag}`;
          }

          populateOperators(operators || []);
          if (hvCountry) hvCountry.value = country;
          next();
        });
      }

      // — STEP 2: Operator cards
      function populateOperators(list) {
        if (!mnoWrap) return;
        mnoWrap.innerHTML = "";
        selectedMno = null;
        list.forEach((op) => {
          const providerDetails = providerDetailsMap[op.apiCode];
          const displayLogo =
            providerDetails?.logo || `/public/mno-img/${op.img}`;
          const displayName = providerDetails?.displayName || op.name;
          const card = document.createElement("div");
          card.className = "operator-card";
          card.dataset.id = op.apiCode;
          if (!op.available) card.classList.add("disabled");
          card.innerHTML = `
            <img src="${displayLogo}" width="40" height="40" class="mb-2" 
                 onerror="this.src='/public/mno-img/${op.img}'" alt="${displayName}">
            <div class="fw-medium small">${displayName}</div>
          `;
          if (op.available) {
            card.addEventListener("click", () => {
              [...mnoWrap.children].forEach((c) => c.classList.remove("selected"));
              card.classList.add("selected");
              selectedMno = op;
              if (mnoError) mnoError.classList.add("d-none");
            });
          }
          mnoWrap.appendChild(card);
        });
      }

      const step2Next = document.querySelector("#step-2 [data-next]");
      if (step2Next) {
        step2Next.addEventListener("click", () => {
          if (!selectedMno) {
            if (mnoError) mnoError.classList.remove("d-none");
            return;
          }
          const hvOperator = document.getElementById("hvOperator");
          if (hvOperator) hvOperator.value = selectedMno.name;
          if (mnoError) mnoError.classList.add("d-none");
          next();
        });
      }

      const step2Prev = document.querySelector("#step-2 [data-prev]");
      if (step2Prev)
        step2Prev.addEventListener("click", () => {
          // Restore currency label from persisted hvCurrency when going back
          if (hvCurrency && currencyLabel) {
            currencyLabel.textContent =
              hvCurrency.value || currencyLabel.textContent;
          }
          prev();
        });

      // — STEP 3: Amount, phone & description
      if (amountIn) {
        amountIn.addEventListener("input", () =>
          amountIn.classList.toggle(
            "is-invalid",
            !isValidAmount(amountIn.value.trim())
          )
        );
      }

      if (descIn) {
        descIn.addEventListener("input", () =>
          descIn.classList.toggle("is-invalid", !isValidDesc(descIn.value.trim()))
        );
      }

      const step3Next = document.querySelector("#step-3 [data-next]");
      if (step3Next) {
        step3Next.addEventListener("click", () => {
          const okAmt = amountIn ? isValidAmount(amountIn.value.trim()) : false;
          const fullPh =
            (dialCode ? dialCode.textContent : "") +
            (phoneIn ? phoneIn.value.trim() : "");
          const okPhn = isValidPhone(fullPh);
          const okDes = descIn ? isValidDesc(descIn.value.trim()) : false;

          if (amountIn) amountIn.classList.toggle("is-invalid", !okAmt);
          if (phoneIn) phoneIn.classList.toggle("is-invalid", !okPhn);
          if (descIn) descIn.classList.toggle("is-invalid", !okDes);

          if (okAmt && okPhn && okDes) {
            if (hvAmount) hvAmount.value = amountIn.value.trim();
            if (hvPhone) hvPhone.value = fullPh;
            if (hvDesc) hvDesc.value = descIn.value.trim();
            fillConfirmation();
            next();
          }
        });
      }

      const step3Prev = document.querySelector("#step-3 [data-prev]");
      if (step3Prev)
        step3Prev.addEventListener("click", () => {
          // Restore currency label from persisted hvCurrency when going back
          if (hvCurrency && currencyLabel) {
            currencyLabel.textContent =
              hvCurrency.value || currencyLabel.textContent;
          }
          prev();
        });

      // — STEP 4: Confirmation
      function fillConfirmation() {
        if (summaryCountry)
          summaryCountry.textContent = hvCountry ? hvCountry.value : "";
        if (summaryOperator)
          summaryOperator.textContent = document.getElementById("hvOperator")
            ? document.getElementById("hvOperator").value
            : "";

        // Use persisted hvCurrency so user-chosen USD wins over catalog
        const visibleCurrency = hvCurrency
          ? hvCurrency.value
          : currencyLabel
            ? currencyLabel.textContent
            : "";

        if (summaryAmount)
          summaryAmount.textContent = `${hvAmount ? hvAmount.value : ""} ${visibleCurrency}`;
        if (summaryPhone) summaryPhone.textContent = hvPhone ? hvPhone.value : "";
        if (summaryDesc) summaryDesc.textContent = hvDesc ? hvDesc.value : "";
      }

      const step4Prev = document.querySelector("#step-4 [data-prev]");
      if (step4Prev) step4Prev.addEventListener("click", prev);

      // — Modal & Pay simulation, using persisted hvCurrency
      const modalEl = document.getElementById("paymentModal");
      let modal = null;
      if (
        modalEl &&
        typeof bootstrap !== "undefined" &&
        bootstrap &&
        bootstrap.Modal
      ) {
        modal = new bootstrap.Modal(modalEl);
      }

      const openModalBtn = document.getElementById("openModal");
      const modalDetails = document.getElementById("modalDetails");
      const loadingSpinner = document.getElementById("loadingSpinner");
      const successBox = document.getElementById("successBox");
      const payBtn = document.getElementById("payBtn");
      const errorBox = document.getElementById("errorBox");

      if (openModalBtn) {
        openModalBtn.addEventListener("click", () => {
          if (!selectedMno) return;

          const providerDetails = providerDetailsMap[selectedMno.apiCode];
          const ownerName =
            providerDetails?.nameDisplayedToCustomer ||
            selectedMno.ownerName ||
            "N/A";
          const providerLogo =
            providerDetails?.logo || `/public/mno-img/${selectedMno.img}`;
          const providerDisplayName =
            providerDetails?.displayName || selectedMno.name;

          // Use persisted hvCurrency for display
          const visibleCurrency = hvCurrency
            ? hvCurrency.value
            : currencyLabel
              ? currencyLabel.textContent
              : "";

          // Get PIN instructions if available
          const pinData = getPinInstructions(
            selectedMno.apiCode,
            visibleCurrency
          );

          // Build modal content
          let modalContent = `
            <div class="text-center mb-3">
              <img src="${providerLogo}" width="60" height="60" class="mb-2" alt="${providerDisplayName}">
              <h6 class="mb-0">${providerDisplayName}</h6>
            </div>
            <p class="text-center">
              You are about to pay
              <strong>${hvAmount ? hvAmount.value : ""} ${visibleCurrency}</strong>
              using <strong>${hvPhone ? hvPhone.value : ""}</strong>.<br/>
              Authorize on your phone to complete.
            </p>
            <div class="alert alert-info mt-3" role="alert">
              <strong>Important:</strong>
              You will receive a payment request from 
              <strong>${ownerName}</strong>
              acting on behalf of <strong>Katorymnd Freelancer</strong>.
              Please confirm the payment to proceed with your transaction.
            </div>`;

          // Add PIN instructions if available
          if (pinData && pinData.pinPromptRevivable) {
            modalContent += `
              <div class="d-flex justify-content-end mb-2">
                <div class="btn-group btn-group-sm" role="group">
                  <button type="button" class="btn btn-outline-primary ${currentLanguage === "en" ? "active" : ""}" data-lang="en">EN</button>
                  <button type="button" class="btn btn-outline-primary ${currentLanguage === "fr" ? "active" : ""}" data-lang="fr">FR</button>
                </div>
              </div>`;
            modalContent += renderPinInstructions(pinData, currentLanguage);
          }

          if (modalDetails) {
            modalDetails.innerHTML = modalContent;

            // Add language toggle listeners
            const langButtons = modalDetails.querySelectorAll("[data-lang]");
            langButtons.forEach((btn) => {
              btn.addEventListener("click", (e) => {
                const newLang = e.target.dataset.lang;
                if (newLang !== currentLanguage) {
                  currentLanguage = newLang;
                  langButtons.forEach((b) => b.classList.remove("active"));
                  e.target.classList.add("active");

                  // Re-render PIN instructions
                  const pinContainer = modalDetails.querySelector(".pin-instructions-container");
                  if (pinContainer && pinData) {
                    pinContainer.outerHTML = renderPinInstructions(pinData, currentLanguage);
                  }
                }
              });
            });
          }

          if (successBox) successBox.classList.add("d-none");
          if (payBtn) payBtn.disabled = false;
          if (modal) modal.show();
        });
      }

      if (payBtn) {
        payBtn.addEventListener("click", async () => {
          payBtn.disabled = true;
          if (loadingSpinner) loadingSpinner.classList.remove("d-none");
          if (successBox) successBox.classList.add("d-none");
          if (errorBox) errorBox.classList.add("d-none");

          try {
            const visibleCurrency = hvCurrency
              ? hvCurrency.value
              : currencyLabel
                ? currencyLabel.textContent
                : "";

            const paymentData = {
              amount: hvAmount ? hvAmount.value : "",
              currency: visibleCurrency,
              mno: selectedMno ? selectedMno.apiCode : "",
              payerMsisdn: hvPhone ? hvPhone.value.replace(/\D/g, "") : "",
              description: hvDesc ? hvDesc.value : "",
              meta: []
            };

            console.log("Sending payment request:", paymentData);

            const response = await fetch("/deposit/initiate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(paymentData)
            });

            const result = await response.json();

            if (loadingSpinner) loadingSpinner.classList.add("d-none");

            if (result.success) {
              if (successBox) {
                successBox.textContent = `${result.message} 🎉
Transaction ID: ${result.transactionId}`;
                successBox.classList.remove("d-none");
              }
              if (hvConfirm) hvConfirm.value = "true";
            } else {
              if (errorBox) {
                errorBox.textContent = result.errorMessage || "Payment failed. Please try again.";
                errorBox.classList.remove("d-none");
              }
              payBtn.disabled = false;
            }
          } catch (error) {
            console.error("Payment request failed:", error);
            if (loadingSpinner) loadingSpinner.classList.add("d-none");
            if (errorBox) {
              errorBox.textContent = "Network error. Please check your connection and try again.";
              errorBox.classList.remove("d-none");
            }
            payBtn.disabled = false;
          }
        });
      }
    }

    // Initialize on DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initWizard);
    } else {
      initWizard();
    }
  }

  function showBootstrapAlert(message, type = "warning") {
    const alertPlaceholder = document.getElementById("alert-placeholder");
    if (!alertPlaceholder) return;

    // Save and lock body scroll state so long alerts behave like a modal
    const body = document.body;
    const previousOverflow = body.style.overflow || "";
    const previousPaddingRight = body.style.paddingRight || "";

    // Apply placeholder layout
    alertPlaceholder.style.display = "flex";
    alertPlaceholder.style.justifyContent = "center";
    alertPlaceholder.style.alignItems = "center";
    alertPlaceholder.style.padding = "20px";
    alertPlaceholder.innerHTML = ""; // clear previous

    const wrapper = document.createElement("div");
    wrapper.style.maxWidth = "800px";
    wrapper.style.width = "100%";
    wrapper.style.margin = "0 auto";

    // Structure: Header (Type) + Scrollable Body + Close Button
    wrapper.innerHTML = [
      `<div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">`,
      `  <h5 class="alert-heading text-capitalize"><i class="bi bi-info-circle-fill me-2"></i>${type === "danger" ? "Error" : type}</h5>`,
      "  <hr>",
      // Scrollable container with sensible max-height; user can scroll inside alert
      "  <div class=\"alert-scrollable\" style=\"max-height:300px; overflow-y:auto; padding-right:10px;\">",
      `    ${message}`,
      "  </div>",
      '  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
      "</div>"
    ].join("");

    alertPlaceholder.append(wrapper);

    // Prevent the page behind from jumping while alert is visible
    // (mimics modal behavior so long content is contained)
    body.style.overflow = "hidden";

    // store previous values so cleanup can restore them
    alertPlaceholder.dataset._prevOverflow = previousOverflow;
    alertPlaceholder.dataset._prevPaddingRight = previousPaddingRight;

    // Cleanup function: hide placeholder, restore body styles, remove any stray backdrops
    const cleanup = () => {
    // hide placeholder
      alertPlaceholder.style.display = "none";
      alertPlaceholder.innerHTML = "";

      // restore body styles
      body.style.overflow = alertPlaceholder.dataset._prevOverflow || "";
      body.style.paddingRight = alertPlaceholder.dataset._prevPaddingRight || "";

      // Remove any stray Bootstrap modal backdrops that might be blocking the UI
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach((bd) => bd.parentNode && bd.parentNode.removeChild(bd));

      // Remove modal-open class if present (Bootstrap sometimes toggles this)
      if (body.classList.contains("modal-open")) {
        body.classList.remove("modal-open");
      }

      // Clear stored dataset
      delete alertPlaceholder.dataset._prevOverflow;
      delete alertPlaceholder.dataset._prevPaddingRight;
    };

    // Wire up close button click (in case data-bs-dismiss doesn't trigger closed.bs.alert)
    const closeBtn = wrapper.querySelector(".btn-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
      // let Bootstrap handle the hide animation, then run cleanup after a short delay
      // Bootstrap fires 'closed.bs.alert' we also listen to that below; this is defensive
        setTimeout(cleanup, 150);
      });
    }

    // Listen for Bootstrap's alert closed event to cleanup reliably
    const alertEl = wrapper.querySelector(".alert");
    if (alertEl) {
      alertEl.addEventListener("closed.bs.alert", cleanup, { once: true });
    }

    // Defensive fallback: if for some reason the alert is removed without events,
    // observe the placeholder and run cleanup when it becomes empty
    const obs = new MutationObserver(() => {
      if (!alertPlaceholder.innerHTML || alertPlaceholder.innerHTML.trim() === "") {
        cleanup();
        obs.disconnect();
      }
    });
    obs.observe(alertPlaceholder, { childList: true });

    // return a handle so calling code can programmatically close the alert if needed
    return {
      close: cleanup
    };
  }

  
  // ========== PAYOUT FORM ==========
  async function initPayoutForm() {
    console.log("💸 Initializing payout form (v2-priority, version-matched)...");

    const DATA_ROOT = "/pawapay/config?endpoint=";
    const availabilityMap = new Map();
    const providerDetailsMap = new Map();
    const v2CountryMeta = new Map();
    const v1CountryMeta = new Map();

    
    async function loadConfigs({ mnoCorrespondents, countryNameToCode }) {
      console.log("🔄 Loading configs (v2 priority, version matching)...");

      let availabilityData = null;
      let availabilityVersion = null;
      let activeConfigData = null;
      let activeConfigVersion = null;

      // 1. LOAD AVAILABILITY DATA (v2 first, v1 fallback)
      try {
        console.log("📡 Fetching availability data (v2 first)...");
        const v2AvailabilityResponse = await fetch(`${DATA_ROOT}availability&apiVersion=v2`);

        if (v2AvailabilityResponse.ok) {
          const v2AvailabilityResult = await v2AvailabilityResponse.json();
          if (v2AvailabilityResult.success && v2AvailabilityResult.data) {
            console.log("✅ V2 Availability data loaded successfully");
            availabilityData = v2AvailabilityResult.data;
            availabilityVersion = "v2";
            absorbAvailability({ data: availabilityData, version: "v2" });
          } else {
            throw new Error("V2 availability response not successful");
          }
        } else {
          throw new Error("V2 availability not available");
        }
      } catch (v2Error) {
        console.warn("⚠️ V2 availability failed, trying v1...", v2Error.message);

        // Fallback to V1 availability
        try {
          const v1AvailabilityResponse = await fetch(`${DATA_ROOT}availability&apiVersion=v1`);
          const v1AvailabilityResult = await v1AvailabilityResponse.json();

          if (v1AvailabilityResult.success && v1AvailabilityResult.data) {
            console.log("✅ V1 Availability data loaded successfully (fallback)");
            availabilityData = v1AvailabilityResult.data;
            availabilityVersion = "v1";
            absorbAvailability({ data: availabilityData, version: "v1" });
          } else {
            throw new Error("V1 availability response not successful");
          }
        } catch (v1Error) {
          console.error("❌ Both v2 and v1 availability failed:", v1Error.message);
          showBootstrapAlert("Configuration error: Availability service unavailable. Please contact support.", "danger");
          return;
        }
      }

      // 2. LOAD ACTIVE CONFIG DATA (v2 first, v1 fallback)
      try {
        console.log("📡 Fetching active configuration (v2 first)...");
        const v2ActiveResponse = await fetch(`${DATA_ROOT}active-conf&apiVersion=v2`);

        if (v2ActiveResponse.ok) {
          const v2ActiveResult = await v2ActiveResponse.json();
          if (v2ActiveResult.success && v2ActiveResult.data) {
            console.log("✅ Active config (v2) loaded successfully");
            activeConfigData = v2ActiveResult.data;
            activeConfigVersion = "v2";
            absorbActiveConf(activeConfigData, "v2");
          } else {
            throw new Error("V2 active config response not successful");
          }
        } else {
          throw new Error("V2 active config not available");
        }
      } catch (v2Error) {
        console.warn("⚠️ V2 active config failed, trying v1...", v2Error.message);

        // Fallback to V1 active config
        try {
          const v1ActiveResponse = await fetch(`${DATA_ROOT}active-conf&apiVersion=v1`);
          const v1ActiveResult = await v1ActiveResponse.json();

          if (v1ActiveResult.success && v1ActiveResult.data) {
            console.log("✅ Active config (v1) loaded successfully (fallback)");
            activeConfigData = v1ActiveResult.data;
            activeConfigVersion = "v1";
            absorbActiveConf(activeConfigData, "v1");
          } else {
            throw new Error("V1 active config response not successful");
          }
        } catch (v1Error) {
          console.error("❌ Both v2 and v1 active config failed:", v1Error.message);
          showBootstrapAlert("Configuration error: Active configuration unavailable. Please contact support.", "danger");
          return;
        }
      }

      // 3. VERSION CONSISTENCY CHECK & RESOLUTION
      console.log(`🔍 Version check: availability=${availabilityVersion}, activeConfig=${activeConfigVersion}`);

      if (availabilityVersion !== activeConfigVersion) {
        console.warn("⚠️ Version mismatch detected! Trying to resolve...");

        // Case 1: v2 availability but v1 active config → try to downgrade availability to v1
        if (availabilityVersion === "v2" && activeConfigVersion === "v1") {
          console.log("🔄 Downgrading availability to v1 for version consistency...");
          try {
            const v1AvailabilityResponse = await fetch(`${DATA_ROOT}availability&apiVersion=v1`);
            const v1AvailabilityResult = await v1AvailabilityResponse.json();
            if (v1AvailabilityResult.success && v1AvailabilityResult.data) {
              // Clear previous v2 availability data
              availabilityMap.clear();
              availabilityData = v1AvailabilityResult.data;
              availabilityVersion = "v1";
              absorbAvailability({ data: availabilityData, version: "v1" });
              console.log("✅ Successfully downgraded availability to v1");
            } else {
              throw new Error("V1 availability downgrade failed");
            }
          } catch (downgradeError) {
            console.error("❌ Failed to downgrade availability to v1:", downgradeError.message);
            // Continue with mismatched versions but log warning
          }
        }
        // Case 2: v1 availability but v2 active config → try to upgrade availability to v2  
        else if (availabilityVersion === "v1" && activeConfigVersion === "v2") {
          console.log("🔄 Upgrading availability to v2 for version consistency...");
          try {
            const v2AvailabilityResponse = await fetch(`${DATA_ROOT}availability&apiVersion=v2`);
            if (v2AvailabilityResponse.ok) {
              const v2AvailabilityResult = await v2AvailabilityResponse.json();
              if (v2AvailabilityResult.success && v2AvailabilityResult.data) {
                // Clear previous v1 availability data
                availabilityMap.clear();
                availabilityData = v2AvailabilityResult.data;
                availabilityVersion = "v2";
                absorbAvailability({ data: availabilityData, version: "v2" });
                console.log("✅ Successfully upgraded availability to v2");
              } else {
                throw new Error("V2 availability upgrade failed");
              }
            } else {
              throw new Error("V2 availability not available for upgrade");
            }
          } catch (upgradeError) {
            console.error("❌ Failed to upgrade availability to v2:", upgradeError.message);
            // Continue with mismatched versions but log warning
          }
        }
      } else {
        console.log("✅ Version consistency maintained:", availabilityVersion);
      }

      // 4. MERGE DATA WITH OPERATIONAL STATUS CHECK
      console.log("🔄 Merging config data into operators with operational validation...");

      // DEBUG: Before merging
      console.log("📋 Operators BEFORE merging:", Object.keys(mnoCorrespondents).map(country => ({
        country,
        operators: mnoCorrespondents[country].map(op => ({
          apiCode: op.apiCode,
          name: op.name,
          available: op.available
        }))
      })));

      Object.keys(mnoCorrespondents).forEach((countryName) => {
        const countryIso3 = countryNameToCode[countryName];

        // Get country metadata from appropriate version
        const meta = activeConfigVersion === "v2"
          ? v2CountryMeta.get(countryIso3)
          : v1CountryMeta.get(countryIso3);

        mnoCorrespondents[countryName].forEach((mno) => {
          // Check availability status from availability data
          const availabilityStatus = availabilityMap.get(mno.apiCode);

          // Check if provider exists in active configuration
          const providerDetail = providerDetailsMap.get(mno.apiCode);
          const isInActiveConfig = !!providerDetail;

          // DETERMINE FINAL OPERATIONAL STATUS:
          // Provider is operational ONLY if:
          // 1. Available in availability data (status = true) AND
          // 2. Exists in active configuration AND  
          // 3. Both sources agree (implicit in the above)
          const isOperational = availabilityStatus === true && isInActiveConfig;

          mno.available = isOperational;

          // DEBUG: Log each operator's operational decision
          console.log(`🔍 ${mno.apiCode} operational validation:`, {
            availabilityStatus,
            isInActiveConfig,
            finalOperational: isOperational,
            version: `avail-${availabilityVersion}/config-${activeConfigVersion}`
          });

          // Set provider details from active config (if available)
          if (providerDetail) {
            mno.logo = providerDetail.logo;
            mno.displayName = providerDetail.displayName;
            mno.nameDisplayedToCustomer = providerDetail.nameDisplayedToCustomer;
            mno.currency = providerDetail.currency;
          } else {
            // Provider not in active config - mark details as unavailable
            console.warn(`⚠️ ${mno.apiCode} not found in active configuration`);
          }

          // Set country details from active config meta
          if (meta) {
            if (meta.prefix) {
              mno.countryCode = `+${meta.prefix}`;
            }
            // Use meta for other country-level details if needed
          }
        });
      });

      // DEBUG: After merging
      console.log("📋 Operators AFTER merging:", Object.keys(mnoCorrespondents).map(country => ({
        country,
        operators: mnoCorrespondents[country].map(op => ({
          apiCode: op.apiCode,
          name: op.name,
          available: op.available,
          displayName: op.displayName,
          operational: op.available
        }))
      })));

      console.log("✅ Config merging with operational validation completed");
      console.log(`📊 Final versions: availability=${availabilityVersion}, activeConfig=${activeConfigVersion}`);
    }

    function absorbAvailability({ data, version }) {
      console.log(`📊 Absorbing ${version} availability data`);

      if (!data) {
        console.warn(`⚠️ No ${version} availability data to absorb`);
        return;
      }

      let count = 0;
      let operationalCount = 0;

      if (version === "v2") {
        // V2 structure: [{ country, providers: [{ provider, operationTypes: { PAYOUT, DEPOSIT, REFUND } }] }]
        data.forEach((country) => {
          console.log(`🌍 Processing v2 country: ${country.country}`);
          (country.providers || []).forEach((provider) => {
            const payoutStatus = provider.operationTypes?.PAYOUT;
            const isOperational = payoutStatus === "OPERATIONAL";

            availabilityMap.set(provider.provider, isOperational);
            count++;

            if (isOperational) {
              operationalCount++;
              console.log(`    ✅ ${provider.provider} is OPERATIONAL (v2)`);
            } else {
              console.log(`    ❌ ${provider.provider} is NOT operational (v2, status: ${payoutStatus})`);
            }
          });
        });
      } else {
        // V1 structure: [{ country, correspondents: [{ correspondent, operationTypes: [{ operationType, status }] }] }]
        data.forEach((country) => {
          console.log(`🌍 Processing v1 country: ${country.country}`);
          (country.correspondents || []).forEach((correspondent) => {
            const payoutOp = (correspondent.operationTypes || []).find(
              op => String(op.operationType).toUpperCase() === "PAYOUT"
            );

            const status = payoutOp ? String(payoutOp.status || "") : "NO_PAYOUT_FOUND";
            const isOperational = payoutOp && status.toUpperCase() === "OPERATIONAL";

            availabilityMap.set(correspondent.correspondent, isOperational);
            count++;

            if (isOperational) {
              operationalCount++;
              console.log(`    ✅ ${correspondent.correspondent} is OPERATIONAL (v1)`);
            } else {
              console.log(`    ❌ ${correspondent.correspondent} is NOT operational (v1, status: ${status})`);
            }
          });
        });
      }

      console.log(`📈 ${version} availability summary: ${operationalCount}/${count} operational providers`);
      console.log("📋 availabilityMap entries:", Array.from(availabilityMap.entries()));
    }

    function absorbActiveConf(active, version) {
      console.log(`📊 Absorbing ${version} active config`);

      if (!active) {
        console.warn(`⚠️ No ${version} active config data to absorb`);
        return;
      }

      let countryCount = 0;
      let providerCount = 0;

      if (version === "v2") {
        // V2 structure: { countries: [{ country, prefix, flag, displayName, providers: [...] }] }
        if (Array.isArray(active.countries)) {
          active.countries.forEach((country) => {
            if (country.country) {
              v2CountryMeta.set(country.country, {
                prefix: country.prefix ? String(country.prefix) : "",
                flagUrl: country.flag || "",
                displayName: (country.displayName && (country.displayName.en || country.displayName.fr)) || country.country,
              });
              countryCount++;
              console.log(`    ✅ Added v2 country meta: ${country.country}`);
            }

            (country.providers || []).forEach((provider) => {
              if (provider.provider) {
                const currencies = provider.currencies || [];
                const primaryCurrency = currencies.length > 0 ? currencies[0].currency : "";

                providerDetailsMap.set(provider.provider, {
                  logo: provider.logo || "",
                  displayName: provider.displayName || provider.provider,
                  nameDisplayedToCustomer: provider.nameDisplayedToCustomer || provider.provider,
                  currency: primaryCurrency,
                  currencies: currencies
                });
                providerCount++;
                console.log(`    ✅ Added v2 provider: ${provider.provider}`);
              }
            });
          });
        }
      } else {
        // V1 structure: { countries: [{ country, correspondents: [...] }] }
        if (Array.isArray(active.countries)) {
          active.countries.forEach((country) => {
            if (country.country) {
              v1CountryMeta.set(country.country, {
                prefix: "", // V1 doesn't have prefix in the same structure
                flagUrl: "", // V1 doesn't have flag URLs  
                displayName: country.country,
              });
              countryCount++;
              console.log(`    ✅ Added v1 country meta: ${country.country}`);
            }

            (country.correspondents || []).forEach((correspondent) => {
              if (correspondent.correspondent) {
                providerDetailsMap.set(correspondent.correspondent, {
                  logo: "", // V1 doesn't have logos
                  displayName: correspondent.correspondent, // V1 uses correspondent as display name
                  nameDisplayedToCustomer: correspondent.ownerName || correspondent.correspondent,
                  currency: correspondent.currency || "",
                  currencies: [] // V1 doesn't have detailed currency array
                });
                providerCount++;
                console.log(`    ✅ Added v1 provider: ${correspondent.correspondent}`);
              }
            });
          });
        }
      }

      console.log(`📈 Processed ${countryCount} countries and ${providerCount} providers (${version})`);
      console.log("📋 providerDetailsMap entries:", Array.from(providerDetailsMap.entries()));
    }

    function extractResponseData(r) {
      if (!r) return {};
      if (Array.isArray(r)) return r[0] || {};
      if (r.data && typeof r.data === "object") return r.data;
      return r;
    }

    // Initialize payout form
    function initPayoutWizard() {
      console.log("🎯 initPayoutWizard() started");

      function hideLoader() {
        console.log("🔄 hideLoader() called");
        document.body.style.opacity = "1";
        console.log("✅ Body opacity set to 1");
        const loader = document.getElementById("loader");
        console.log("🔍 Loader element:", loader);
        if (loader) {
          console.log("👁️ Loader state before hiding:", {
            classList: loader.classList.toString(),
            display: loader.style.display,
            opacity: loader.style.opacity
          });
          loader.classList.add("hidden");
          console.log('✅ "hidden" class added to loader');
          setTimeout(() => {
            console.log("🕒 Checking loader state after timeout:");
            console.log(" - Loader display:", loader.style.display);
            console.log(" - Loader classes:", loader.classList.toString());
            loader.style.display = "none";
            console.log('✅ Loader display set to "none"');
          }, 500);
        } else {
          console.warn("⚠️ Loader element not found!");
        }
      }

      let loaderHidden = false;
      console.log("📝 Initial loaderHidden state:", loaderHidden);

      function safeHideLoader(reason = "unknown") {
        console.log(`🚀 safeHideLoader() called from: ${reason}`);
        console.log(`📊 Current loaderHidden state: ${loaderHidden}`);
        if (!loaderHidden) {
          loaderHidden = true;
          console.log("✅ Setting loaderHidden to true");
          hideLoader();
        } else {
          console.log("⏭️ Loader already hidden, skipping");
        }
      }

      console.log("📄 Current document readyState:", document.readyState);
      if (document.readyState === "loading") {
        console.log("⏳ DOM still loading, adding DOMContentLoaded listener");
        document.addEventListener("DOMContentLoaded", () => {
          console.log("🎉 DOMContentLoaded event fired");
          safeHideLoader("DOMContentLoaded");
        });
      } else {
        console.log("✅ DOM already ready, calling safeHideLoader immediately");
        safeHideLoader("DOM already ready");
      }

      window.addEventListener("load", () => {
        console.log("🎊 window.load event fired");
        console.log("📄 Document readyState at load:", document.readyState);
        safeHideLoader("window.load");
      });

      setTimeout(() => {
        console.log("⏰ 3-second timeout fired");
        console.log("📄 Document readyState at timeout:", document.readyState);
        safeHideLoader("3-second timeout");
      }, 3000);

      setTimeout(() => {
        const criticalElements = [
          "loader",
          "payout-form",
          "recipients",
          "add-recipient",
          "alert-placeholder"
        ];
        console.log("🔍 Checking critical elements availability:");
        criticalElements.forEach(id => {
          const element = document.getElementById(id);
          console.log(` - ${id}:`, element ? "✅ Found" : "❌ Missing");
        });
      }, 100);

      let recipientIndex = 1;
      let maxRecipients = 5;
      let maxMetadata = 5;

      console.log("📋 Loading catalog data...");
      const catalogElement = document.getElementById("country-catalog-data");
      if (!catalogElement) {
        console.warn("⚠️ Country catalog element not found!");
        return;
      }
      const catalog = JSON.parse(catalogElement.textContent);

      // Convert server catalog format to payout format
      const mnoCorrespondents = {};
      Object.keys(catalog).forEach(countryName => {
        const countryData = catalog[countryName];
        mnoCorrespondents[countryName] = countryData.operators.map(op => ({
          name: op.name,
          apiCode: op.apiCode,
          countryCode: op.code,
          flag: op.flag,
          available: op.available,
          img: op.img,
          ownerName: op.ownerName
        }));
      });

      console.log("📦 Processed mnoCorrespondents for countries:", Object.keys(mnoCorrespondents));

      // Country names to ISO3 — must match active_conf_v2.json country codes
      const countryNameToCode = {
        Benin: "BEN",
        "Burkina Faso": "BFA",
        Cameroon: "CMR",
        Congo: "COG",
        "Congo (DRC)": "COD",
        "Cote D'Ivoire": "CIV",
        Gabon: "GAB",
        Ghana: "GHA",
        Kenya: "KEN",
        Malawi: "MWI",
        Mozambique: "MOZ",
        Nigeria: "NGA",
        Rwanda: "RWA",
        Senegal: "SEN",
        "Sierra Leone": "SLE",
        Tanzania: "TZA",
        Uganda: "UGA",
        Zambia: "ZMB",
      };

      console.log("🔄 Calling loadConfigs...");
      loadConfigs({ mnoCorrespondents, countryNameToCode }).then(() => {
        console.log("✅ loadConfigs completed successfully");
      }).catch((err) => {
        console.error("❌ Config load error:", err);
      });

      

      function showSuccessAlert(message) {
        console.log("✅ Showing success alert:", message);
        const alertPlaceholder = document.getElementById("alert-placeholder");
        if (!alertPlaceholder) return;

        // Save and lock body scroll state so long alerts behave like a modal
        const body = document.body;
        const previousOverflow = body.style.overflow || "";
        const previousPaddingRight = body.style.paddingRight || "";

        alertPlaceholder.style.display = "flex";
        alertPlaceholder.style.justifyContent = "center";
        alertPlaceholder.style.alignItems = "center";
        alertPlaceholder.style.padding = "20px";
        alertPlaceholder.innerHTML = ""; // clear previous

        const wrapper = document.createElement("div");
        wrapper.style.maxWidth = "600px"; // Slightly wider for tables/lists
        wrapper.style.width = "100%";
        wrapper.style.margin = "0 auto";
        wrapper.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.15)";
        wrapper.style.borderRadius = "12px";

        // Structure: Header with Success Icon + Divider + Scrollable Content + Close
        wrapper.innerHTML = [
          "<div class=\"alert alert-success alert-dismissible fade show\" role=\"alert\" style=\"border: none; background-color: #d1e7dd; color: #0f5132;\">",
          "  <div class=\"d-flex align-items-center mb-2\">",
          "    <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"currentColor\" class=\"bi bi-check-circle-fill me-2\" viewBox=\"0 0 16 16\">",
          "      <path d=\"M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z\"/>",
          "    </svg>",
          "    <h4 class=\"alert-heading mb-0\">Payouts Processed!</h4>",
          "  </div>",
          "  <hr style=\"border-top-color: #badbcc;\">",
          "  <div class=\"scrollbar-custom\" style=\"max-height: 400px; overflow-y: auto; padding-right: 5px;\">", // SCROLLABLE CONTAINER
          `    ${message}`,
          "  </div>",
          '  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
          "</div>"
        ].join("");

        alertPlaceholder.append(wrapper);

        // Prevent the page behind from jumping while alert is visible
        // (mimics modal behavior so long content is contained)
        body.style.overflow = "hidden";

        // store previous values so cleanup can restore them
        alertPlaceholder.dataset._prevOverflow = previousOverflow;
        alertPlaceholder.dataset._prevPaddingRight = previousPaddingRight;

        // Cleanup function: hide placeholder, restore body styles, remove any stray backdrops
        const cleanup = () => {
          // hide placeholder
          alertPlaceholder.style.display = "none";
          alertPlaceholder.innerHTML = "";

          // restore body styles
          body.style.overflow = alertPlaceholder.dataset._prevOverflow || "";
          body.style.paddingRight = alertPlaceholder.dataset._prevPaddingRight || "";

          // Remove any stray Bootstrap modal backdrops that might be blocking the UI
          const backdrops = document.querySelectorAll(".modal-backdrop");
          backdrops.forEach((bd) => bd.parentNode && bd.parentNode.removeChild(bd));

          // Remove modal-open class if present (Bootstrap sometimes toggles this)
          if (body.classList.contains("modal-open")) {
            body.classList.remove("modal-open");
          }

          // Clear stored dataset
          delete alertPlaceholder.dataset._prevOverflow;
          delete alertPlaceholder.dataset._prevPaddingRight;
        };

        // Wire up close button click (in case data-bs-dismiss doesn't trigger closed.bs.alert)
        const closeBtn = wrapper.querySelector(".btn-close");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => {
            // let Bootstrap handle the hide animation, then run cleanup after a short delay
            // Bootstrap fires 'closed.bs.alert' we also listen to that below; this is defensive
            setTimeout(cleanup, 150);
          });
        }

        // Listen for Bootstrap's alert closed event to cleanup reliably
        const alertEl = wrapper.querySelector(".alert");
        if (alertEl) {
          alertEl.addEventListener("closed.bs.alert", cleanup, { once: true });
        }

        // Defensive fallback: if for some reason the alert is removed without events,
        // observe the placeholder and run cleanup when it becomes empty
        const obs = new MutationObserver(() => {
          if (!alertPlaceholder.innerHTML || alertPlaceholder.innerHTML.trim() === "") {
            cleanup();
            obs.disconnect();
          }
        });
        obs.observe(alertPlaceholder, { childList: true });

        // return a handle so calling code can programmatically close the alert if needed
        return {
          close: cleanup
        };
      }


      console.log("🎯 Setting up event listeners...");

      // Add recipient button
      const addRecipientBtn = document.getElementById("add-recipient");
      if (addRecipientBtn) {
        addRecipientBtn.addEventListener("click", function () {
          console.log("👆 Add recipient button clicked, current index:", recipientIndex);
          if (recipientIndex >= maxRecipients) {
            showBootstrapAlert(
              "You can only add up to 5 recipients.",
              "danger"
            );
            return;
          }
          recipientIndex++;
          const recipientsDiv = document.getElementById("recipients");
          const recipientDiv = document.createElement("div");
          recipientDiv.classList.add("recipient", "card", "mb-4", "p-3");

          // Dynamically generate country options using v2 config
          
          const countryOptions = Object.keys(mnoCorrespondents).map(country => {
            const countryIso3 = countryNameToCode[country];
            
            // Fix: Get currency from the catalog data directly
            // The catalog object is { "CountryName": { currency: "XOF", operators: [...] } }
            const countryData = catalog[country];
            const currency = countryData ? countryData.currency : "N/A";

            return {
              name: country,
              currency: currency,
              iso3: countryIso3
            };
          });

          const countrySelectOptions = countryOptions.map(c => `
          <option value="${c.name}" data-currency="${c.currency}">${c.name}</option>
        `).join("");

          recipientDiv.innerHTML = `
      <div class="card-body">
          <h4 class="card-title">Recipient ${recipientIndex}</h4>
          <!-- Country Selection -->
          <div class="mb-3">
              <label for="country-${recipientIndex}" class="form-label">Country:</label>
              <select id="country-${recipientIndex}" name="recipients[${recipientIndex - 1
  }][country]" class="form-select country-select">
                  <option value="" disabled selected>Choose Country</option>
                  ${countrySelectOptions}
              </select>
          </div>
          <!-- MNO Selection -->
          <div class="mb-3">
              <label class="form-label mb-3">Operator</label>
              <div id="mno-cards-container-${recipientIndex}" class="operator-container"></div>
              <input type="hidden" id="selectedMno-${recipientIndex}" name="recipients[${recipientIndex - 1
  }][correspondent]" class="selected-mno-input" />
          </div>
          <!-- Amount with Currency Prefix -->
          <div class="mb-3">
              <label for="amount-${recipientIndex}" class="form-label">Amount:</label>
              <div class="input-group has-validation">
                  <span class="input-group-text" id="currency-symbol-${recipientIndex}"></span>
                  <input type="text" class="form-control amount-input" id="amount-${recipientIndex}" name="recipients[${recipientIndex - 1
  }][amount]" placeholder="Amount" aria-label="Amount" />
              </div>
          </div>
          <!-- Recipient's Phone Number -->
          <div class="mb-3">
              <label for="recipientMsisdn-${recipientIndex}" class="form-label">Recipient's Phone Number</label>
              <div class="input-group">
                  <span class="input-group-text">
                      <img id="countryFlag-${recipientIndex}" src="" alt="Flag" width="24" height="16" class="me-2" />
                      <span id="countryCode-${recipientIndex}">+</span>
                  </span>
                  <input type="tel" class="form-control" id="recipientMsisdn-${recipientIndex}" name="recipients[${recipientIndex - 1
  }][recipientMsisdn]" >
              </div>
          </div>
          <!-- Statement Description -->
          <div class="mb-3">
              <label for="statementDescription-${recipientIndex}" class="form-label">Statement Description</label>
              <input type="text" class="form-control" id="statementDescription-${recipientIndex}" name="recipients[${recipientIndex - 1
  }][statementDescription]">
          </div>
          <!-- Metadata (Optional) -->
          <div class="mb-3">
              <label class="form-label">Metadata (Optional)</label>
              <div id="metadata-${recipientIndex}">
                  <div class="row mb-2 metadata-item">
                      <div class="col-md-5">
                          <input type="text" class="form-control" name="recipients[${recipientIndex - 1
  }][metadata][0][fieldName]" placeholder="Field Name">
                      </div>
                      <div class="col-md-5">
                          <input type="text" class="form-control" name="recipients[${recipientIndex - 1
  }][metadata][0][fieldValue]" placeholder="Field Value">
                      </div>
                      <div class="col-md-2 d-flex align-items-end">
                          <button type="button" style="padding: 5px 0px;" class="btn btn-outline-danger remove-metadata w-100">Remove</button>
                      </div>
                  </div>
              </div>
              <button type="button" class="btn btn-outline-secondary add-metadata" data-recipient-index="${recipientIndex}">Add Metadata</button>
          </div>
          <button type="button" class="btn btn-outline-danger remove-recipient">Remove Recipient</button>
      </div>
    `;
          recipientsDiv.appendChild(recipientDiv);
          console.log(`✅ Added recipient ${recipientIndex}`);
        });
        console.log("✅ Add recipient listener attached");
      } else {
        console.warn("⚠️ Add recipient button not found!");
      }

      // Remove recipient
      document
        .getElementById("recipients")
        .addEventListener("click", function (event) {
          if (
            event.target &&
            event.target.classList.contains("remove-recipient")
          ) {
            const recipientCard = event.target.closest(".recipient");
            recipientCard.parentNode.removeChild(recipientCard);
          }
        });

      // Add metadata
      document
        .getElementById("recipients")
        .addEventListener("click", function (event) {
          if (
            event.target &&
            event.target.classList.contains("add-metadata")
          ) {
            const recipientIndex = event.target.getAttribute(
              "data-recipient-index"
            );
            const container = document.getElementById(
              "metadata-" + recipientIndex
            );
            const items = container.querySelectorAll(".metadata-item");
            if (items.length >= maxMetadata) {
              showBootstrapAlert(
                "You can only add up to 5 metadata entries per recipient.",
                "danger"
              );
              return;
            }
            const idx = items.length;
            const row = document.createElement("div");
            row.classList.add("row", "mb-2", "metadata-item");
            row.innerHTML = `
        <div class="col-md-5">
          <input type="text" class="form-control" name="recipients[${recipientIndex - 1
  }][metadata][${idx}][fieldName]" placeholder="Field Name">
        </div>
        <div class="col-md-5">
          <input type="text" class="form-control" name="recipients[${recipientIndex - 1
  }][metadata][${idx}][fieldValue]" placeholder="Field Value">
        </div>
        <div class="col-md-2 d-flex align-items-end">
          <button type="button" style="padding: 5px 0px;" class="btn btn-outline-danger remove-metadata w-100">Remove</button>
        </div>`;
            container.appendChild(row);
          }
        });

      // Remove metadata
      document
        .getElementById("recipients")
        .addEventListener("click", function (event) {
          if (
            event.target &&
            event.target.classList.contains("remove-metadata")
          ) {
            const item = event.target.closest(".metadata-item");
            item.parentNode.removeChild(item);
          }
        });

      // Country change
      document
        .getElementById("recipients")
        .addEventListener("change", function (event) {
          if (
            event.target &&
            event.target.classList.contains("country-select")
          ) {
            const recipientCard = event.target.closest(".recipient");
            const recipientIndex = getRecipientIndex(recipientCard);
            const selectedCountry = event.target.value;
            const selectedOption = event.target.options[event.target.selectedIndex];
            const currency = selectedOption.getAttribute("data-currency");

            // Currency prefix
            const currencySymbolSpan = recipientCard.querySelector("#currency-symbol-" + recipientIndex);
            currencySymbolSpan.textContent = currency;

            // Country details + cards
            updateCountryDetails(recipientIndex, selectedCountry);
            displayMnoCards(recipientIndex, selectedCountry);
          }
        });

      function getRecipientIndex(recipientCard) {
        const title = recipientCard.querySelector(".card-title").textContent;
        const match = title.match(/Recipient (\d+)/);
        return match ? parseInt(match[1]) : 1;
      }

      // Prefer v2 meta (prefix/flag), fallback to v1 data
      function updateCountryDetails(recipientIndex, country) {
        const countryIso3 = countryNameToCode[country];
        const meta = v2CountryMeta.get(countryIso3);
        if (meta) {
          document.getElementById("countryCode-" + recipientIndex).textContent = "+" + (meta.prefix || "");
          const flagEl = document.getElementById("countryFlag-" + recipientIndex);
          flagEl.src = meta.flagUrl || "";
          flagEl.alt = (meta.displayName || country) + " flag";
          return;
        }
        const correspondents = mnoCorrespondents[country];
        if (correspondents && correspondents.length > 0) {
          const cc = correspondents[0].countryCode || "+";
          const flag = correspondents[0].flag || "";
          document.getElementById("countryCode-" + recipientIndex).textContent = cc;
          const flagEl = document.getElementById("countryFlag-" + recipientIndex);
          flagEl.src = flag ? "public/flags/" + flag : "";
          flagEl.alt = country + " flag";
        } else {
          document.getElementById("countryCode-" + recipientIndex).textContent = "+";
          const flagEl = document.getElementById("countryFlag-" + recipientIndex);
          flagEl.src = "";
          flagEl.alt = "";
        }
      }

      function displayMnoCards(recipientIndex, country) {
        const container = document.getElementById("mno-cards-container-" + recipientIndex);
        if (!container) {
          console.error(`Container #mno-cards-container-${recipientIndex} not found!`);
          return;
        }

        console.log(`🔍 DEBUG displayMnoCards for ${country}:`, {
          recipientIndex,
          country,
          hasMnoCorrespondents: !!mnoCorrespondents[country],
          correspondentsCount: mnoCorrespondents[country]?.length
        });

        container.innerHTML = "";
        const correspondents = mnoCorrespondents[country];

        if (!correspondents || correspondents.length === 0) {
          container.textContent = "No MNO available for this country";
          console.warn(`❌ No correspondents found for country: ${country}`);
          return;
        }

        // DEBUG: Log all operators and their availability status
        console.log(`📋 Operators for ${country}:`, correspondents.map(mno => ({
          apiCode: mno.apiCode,
          name: mno.name,
          available: mno.available,
          displayName: mno.displayName,
          logo: mno.logo
        })));

        correspondents.forEach((mno) => {
          const card = document.createElement("div");
          card.className = "operator-card";

          const isAvailable = !!mno.available;
          const logoSrc = mno.logo || (mno.img && /^(https?:)?\/\//i.test(mno.img) ? mno.img : `public/mno-img/${mno.img || "default.png"}`);
          const displayName = mno.displayName || mno.name;
          const apiCode = mno.apiCode;

          console.log(`🎯 Processing operator ${apiCode}:`, {
            isAvailable,
            displayName,
            hasLogo: !!mno.logo
          });

          // Visual disabled state
          if (!isAvailable) {
            card.classList.add("disabled");
            card.style.opacity = "0.5";
            card.style.cursor = "not-allowed";
            console.log(`❌ ${apiCode} is NOT available`);
          } else {
            card.style.cursor = "pointer";
            console.log(`✅ ${apiCode} is available`);
          }

          card.innerHTML = `
      <img src="${logoSrc}"
           onerror="this.onerror=null; this.src='public/mno-img/${mno.img || "default.png"}'"
           alt="${displayName}" width="40" height="40" class="mb-2">
      <p class="fw-medium">${displayName}</p>
      ${!isAvailable ? '<span class="unavailable-text">Not available</span>' : ""}
    `;

          if (isAvailable) {
            card.addEventListener("click", function () {
              console.log(`👆 Clicked on available operator: ${apiCode}`);
              container.querySelectorAll(".operator-card").forEach(c => c.classList.remove("selected"));
              card.classList.add("selected");

              document.getElementById("selectedMno-" + recipientIndex).value = apiCode;
              updateCountryDetails(recipientIndex, country);
            });
          }

          container.appendChild(card);
        });
      }

      // Submit handler
      document
        .getElementById("payout-form")
        .addEventListener("submit", function (event) {
          event.preventDefault();
          const loader = document.getElementById("loader");
          loader.style.display = "flex";
          loader.classList.remove("hidden");
          loader.classList.add("visible");
          const validationErrors = validateForm();
          if (validationErrors.length > 0) {
            const errorMessage = createDynamicErrorMessage(validationErrors);
            showBootstrapAlert(errorMessage, "warning");
            loader.style.display = "none";
            loader.classList.add("hidden");
            return;
          }

          const formData = new FormData(this);
          const formJSON = {};
          formData.forEach((value, key) => {
            const keys = key.match(/[^[\]]+/g);
            let ref = formJSON;
            keys.forEach((k, i) => {
              if (i < keys.length - 1) {
                if (!ref[k]) {
                  ref[k] = isNaN(keys[i + 1]) ? {} : [];
                }
                ref = ref[k];
              } else {
                if (k === "recipientMsisdn") {
                  const rIdx = parseInt(keys[1]) + 1;
                  const countryCodeSpan = document.getElementById(`countryCode-${rIdx}`);
                  let cleaned = value.replace(/\D/g, "");
                  if (countryCodeSpan) {
                    let countryCode = countryCodeSpan.textContent.trim().replace("+", "");
                    ref[k] = countryCode + cleaned;
                  } else {
                    ref[k] = cleaned;
                  }
                } else if (k === "amount") {
                  const rIdx = parseInt(keys[1]) + 1;
                  const currencySpan = document.getElementById(`currency-symbol-${rIdx}`);
                  if (currencySpan) {
                    const currency = currencySpan.textContent.trim();
                    ref["currency"] = currency;
                  }
                  ref[k] = value;
                } else {
                  ref[k] = value;
                }
              }
            });
          });
          // ✅ ALWAYS send apiVersion=v2 — matches what the backend expects
          formJSON.apiVersion = "v2";

          fetch("/payouts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formJSON),
          })
            .then((response) => response.json())
            .then((data) => {
              loader.style.display = "none";
              loader.classList.add("hidden");
              console.log(data);
              let successMessages = "";
              let failureMessages = "";
              if (
                data.successful_payouts &&
                Array.isArray(data.successful_payouts) &&
                data.successful_payouts.length > 0
              ) {
                successMessages += "<h5>Successful Payouts:</h5><ul>";
                data.successful_payouts.forEach((payout) => {
                  successMessages += `
              <li>
                <strong>Recipient:</strong> ${payout.recipientMsisdn}<br>
                <strong>Amount:</strong> ${payout.amount} ${payout.currency}<br>
                <strong>Payout ID:</strong> ${payout.payoutId}<br>
                <strong>Details:</strong> ${payout.details}
              </li>`;
                });
                successMessages += "</ul>";
              }
              if (
                data.failed_payouts &&
                Array.isArray(data.failed_payouts) &&
                data.failed_payouts.length > 0
              ) {
                failureMessages += "<h5>Failed Payouts:</h5><ul>";
                data.failed_payouts.forEach((payout) => {
                  failureMessages += `
              <li>
                <strong>Recipient:</strong> ${payout.recipientMsisdn}<br>
                <strong>Amount:</strong> ${payout.amount} ${payout.currency}<br>
                <strong>Payout ID:</strong> ${payout.payoutId || "N/A"}<br>
                <strong>Reason:</strong> ${payout.error}<br>
                <strong>Details:</strong> ${payout.details}
              </li>`;
                });
                failureMessages += "</ul>";
              }
              if (
                (!data.successful_payouts || data.successful_payouts.length === 0) &&
                data.responses &&
                Array.isArray(data.responses) &&
                data.responses.length > 0
              ) {
                data.responses.forEach((payout) => {
                  if (payout.success) {
                    const responseData = extractResponseData(payout.response);
                    successMessages += `
                <h5>Successful Payout:</h5>
                <ul>
                  <li>
                    <strong>Recipient:</strong> ${payout.recipientMsisdn}<br>
                    <strong>Amount:</strong> ${responseData.amount || "N/A"} ${responseData.currency || ""}<br>
                    <strong>Payout ID:</strong> ${responseData.payoutId || "N/A"}<br>
                    <strong>Details:</strong> ${payout.details}
                  </li>
                </ul>`;
                  } else {
                    const responseData = payout.response && payout.response.length > 0 ? payout.response[0] : {};
                    failureMessages += `
                <h5>Failed Payout:</h5>
                <ul>
                  <li>
                    <strong>Recipient:</strong> ${payout.recipientMsisdn}<br>
                    <strong>Amount:</strong> ${payout.amount || "N/A"} ${payout.currency || ""}<br>
                    <strong>Payout ID:</strong> ${responseData.payoutId || "N/A"}<br>
                    <strong>Reason:</strong> ${payout.error || "N/A"}<br>
                    <strong>Details:</strong> ${payout.details}
                  </li>
                </ul>`;
                  }
                });
              }
              let combinedMessage = "";
              if (successMessages) combinedMessage += successMessages;
              if (failureMessages) combinedMessage += failureMessages;
              if (combinedMessage) {
                if (data.success) {
                  showSuccessAlert(combinedMessage);
                } else {
                  showBootstrapAlert(combinedMessage);
                }
              } else {
                showBootstrapAlert("No payouts were processed. Please check your input.", "warning");
              }
            })
            .catch((error) => {
              loader.style.display = "none";
              loader.classList.add("hidden");
              console.error("Error:", error);
              showBootstrapAlert("There was an error sending the request.", "danger");
            });
        });



      function validateForm() {

        const recipients = document.querySelectorAll(".recipient");
        const errors = [];
        recipients.forEach((recipient, index) => {
          const countrySelect = recipient.querySelector(".country-select");
          const selectedMnoInput = recipient.querySelector(".selected-mno-input");
          const amountInput = recipient.querySelector(".amount-input");
          const phoneNumberInput = recipient.querySelector("[name^='recipients'][name$='[recipientMsisdn]']");
          const statementDescriptionInput = recipient.querySelector("[name^='recipients'][name$='[statementDescription]']");
          const metadataItems = recipient.querySelectorAll(".metadata-item");
          const recErrs = [];

          if (!countrySelect.value) {
            recErrs.push("Country");
            countrySelect.classList.add("is-invalid");
          } else {
            countrySelect.classList.remove("is-invalid");
          }

          if (!selectedMnoInput.value) {
            recErrs.push("Operator");
            recipient.querySelector(".operator-container").classList.add("border-danger");
          } else {
            recipient.querySelector(".operator-container").classList.remove("border-danger");
          }

          if (!amountInput.value || isNaN(amountInput.value) || parseFloat(amountInput.value) <= 0) {
            recErrs.push("Amount");
            amountInput.classList.add("is-invalid");
          } else {
            amountInput.classList.remove("is-invalid");
          }

          const countryCodeSpan = recipient.querySelector(`#countryCode-${index + 1}`);
          let fullPhoneNumber = phoneNumberInput.value.trim();
          let countryCode = "";
          if (countryCodeSpan) {
            countryCode = countryCodeSpan.textContent.trim().replace("+", "");
            fullPhoneNumber = countryCode + fullPhoneNumber;
          }
          const cleanedPhoneNumber = fullPhoneNumber.replace(/\D/g, "");
          if (!cleanedPhoneNumber || !/^\d+$/.test(cleanedPhoneNumber)) {
            recErrs.push("Invalid Phone Number (should contain only numbers)");
            phoneNumberInput.classList.add("is-invalid");
          } else {
            const phoneNumber = libphonenumber.parsePhoneNumberFromString(`+${cleanedPhoneNumber}`);
            if (!phoneNumber || !phoneNumber.isValid()) {
              recErrs.push("Invalid Phone Number");
              phoneNumberInput.classList.add("is-invalid");
            } else {
              phoneNumberInput.classList.remove("is-invalid");
            }
          }

          const descVal = (statementDescriptionInput.value || "").trim();
          if (descVal) {
            if (descVal.length > 22) {
              recErrs.push("Statement Description must be 22 characters or less");
              statementDescriptionInput.classList.add("is-invalid");
            } else if (!/^[a-zA-Z0-9\s]+$/.test(descVal)) {
              recErrs.push("Statement Description must not contain special characters");
              statementDescriptionInput.classList.add("is-invalid");
            } else {
              statementDescriptionInput.classList.remove("is-invalid");
            }
          } else {
            statementDescriptionInput.classList.remove("is-invalid");
          }

          metadataItems.forEach((metadataItem, metadataIndex) => {
            const fieldNameInput = metadataItem.querySelector("[name^='recipients'][name$='[fieldName]']");
            const fieldValueInput = metadataItem.querySelector("[name^='recipients'][name$='[fieldValue]']");
            if (!fieldNameInput.value.trim()) {
              recErrs.push(`Metadata Field Name ${metadataIndex + 1}`);
              fieldNameInput.classList.add("is-invalid");
            } else {
              fieldNameInput.classList.remove("is-invalid");
            }
            if (!fieldValueInput.value.trim()) {
              recErrs.push(`Metadata Field Value ${metadataIndex + 1}`);
              fieldValueInput.classList.add("is-invalid");
            } else {
              fieldValueInput.classList.remove("is-invalid");
            }
          });

          if (recErrs.length > 0) {
            errors.push({ recipientIndex: index + 1, fields: recErrs });
          }
        });
        return errors;
      }

      function createDynamicErrorMessage(errors) {
        const loader = document.getElementById("loader");
        loader.style.display = "none";
        loader.classList.add("hidden");
        let errorMessage = `
    <p><strong>Please address the following issues before proceeding:</strong></p>
    <ul>`;
        errors.forEach((error) => {
          const recipientNumber = error.recipientIndex;
          const invalidFields = error.fields.map((field) => `<li>${field}</li>`).join("");
          errorMessage += `
      <li>
        <strong>Recipient ${recipientNumber}:</strong>
        <ul>${invalidFields}</ul>
      </li>`;
        });
        errorMessage += "</ul>";
        return errorMessage;
      }

      // Final initialization check
      setTimeout(() => {
        console.log("🏁 Final initialization check:");
        console.log(" - Document readyState:", document.readyState);
        console.log(" - loaderHidden state:", loaderHidden);
        console.log(" - Body opacity:", document.body.style.opacity);
        const loader = document.getElementById("loader");
        if (loader) {
          console.log(" - Loader state:", {
            display: loader.style.display,
            classes: loader.classList.toString(),
            computedDisplay: window.getComputedStyle(loader).display,
            computedOpacity: window.getComputedStyle(loader).opacity
          });
        }
        const form = document.getElementById("payout-form");
        console.log(" - Form ready:", !!form);
        console.log(" - Recipients container ready:", !!document.getElementById("recipients"));
      }, 4000);

      console.log("🔧 initPayoutWizard() completed setup");
    }

    // Initialize payout form on DOM ready
    console.log("🎯 Setting up payout wizard initialization...");
    if (document.readyState === "loading") {
      console.log("⏳ Document loading, waiting for DOMContentLoaded...");
      document.addEventListener("DOMContentLoaded", () => {
        console.log("🎉 DOMContentLoaded - calling initPayoutWizard()");
        initPayoutWizard();
      });
    } else {
      console.log("✅ Document ready, calling initPayoutWizard() immediately");
      initPayoutWizard();
    }
  }

  // Global error handling
  window.addEventListener("error", (e) => {
    console.error("💥 Global error caught:", e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("💥 Unhandled promise rejection:", e.reason);
  });

})();