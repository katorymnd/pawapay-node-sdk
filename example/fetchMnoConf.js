/**
 * File: fetchMnoConf.js
 * Purpose:
 * - Connect to PawaPay API
 * - Fetch MNO Availability and Active Configuration
 * - Save raw JSON responses to disk (replicating PHP behavior)
 * - Normalize V1/V2 data into a unified structure for the View
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ApiClient = require("../src/api/ApiClient");

// Ensure Data Directory Exists
const ensureDataDir = () => {
  const dir = path.join(__dirname, "../data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Deduplicates Pin Prompt Instructions (Logic ported from PHP)
 */
const dedupePinPromptInstructions = (instr) => {
  if (!instr || !instr.channels || !Array.isArray(instr.channels)) return instr;
  const seen = new Set();
  const unique = [];

  instr.channels.forEach(ch => {
    // Create a signature to detect duplicates
    const signature = JSON.stringify({
      t: ch.type,
      d: ch.displayName,
      q: ch.quickLink,
      v: ch.variables,
      s: ch.instructions?.en?.map(i => i.text) || []
    });
    if (!seen.has(signature)) {
      seen.add(signature);
      unique.push(ch);
    }
  });
  instr.channels = unique;
  return instr;
};

/**
 * Normalizes Availability Data (V1 & V2)
 */
const normalizeAvailability = (apiVersion, mnoData) => {
  if (!mnoData || !Array.isArray(mnoData)) return [];

  return mnoData.map(countryItem => {
    const country = countryItem.country || "N/A";
    // V1 uses 'correspondents', V2 uses 'providers'
    const list = countryItem.correspondents || countryItem.providers || [];

    const providers = list.map(prov => {
      const code = prov.correspondent || prov.provider || "N/A";
      let ops = [];

      const rawOps = prov.operationTypes;

      // V1 (Array of Objects)
      if (Array.isArray(rawOps) && rawOps.length > 0 && rawOps[0].operationType) {
        ops = rawOps.map(op => ({
          operationType: op.operationType || "UNKNOWN",
          status: op.status || "UNKNOWN"
        }));
      }
      // V2 (Map or mixed object)
      else if (rawOps && typeof rawOps === "object") {
        for (const [opType, statusVal] of Object.entries(rawOps)) {
          if (typeof statusVal === "string") {
            ops.push({ operationType: opType, status: statusVal });
          } else if (typeof statusVal === "object" && statusVal !== null) {
            ops.push({
              operationType: statusVal.operationType || opType,
              status: statusVal.status
            });
          }
        }
      }

      return { code, operations: ops };
    });

    return { country, providers };
  });
};

/**
 * Normalizes Active Configuration (V1 & V2)
 */
const normalizeActiveConf = (apiVersion, activeConfData) => {
  const lookup = { _merchantName: null, _companyName: null, countries: {} };
  if (!activeConfData) return lookup;

  lookup._merchantName = activeConfData.merchantName || null;
  lookup._companyName = activeConfData.companyName || null;
  const countries = activeConfData.countries || [];

  countries.forEach(country => {
    const countryCode = country.country || "N/A";
    const list = country.correspondents || country.providers || [];

    if (!lookup.countries[countryCode]) lookup.countries[countryCode] = {};

    list.forEach(prov => {
      const code = prov.correspondent || prov.provider || "N/A";
      const displayName = prov.displayName || null;
      const ownerName = prov.ownerName || prov.nameDisplayedToCustomer || null;
      const logo = prov.logo || null;

      let currencies = [];
      const operations = {};

      // Helper to process operation details
      const processDetails = (opType, details) => {
        if (!details) return;
        let ppi = dedupePinPromptInstructions(details.pinPromptInstructions);

        operations[opType] = {
          min: details.minAmount || details.minTransactionLimit || null,
          max: details.maxAmount || details.maxTransactionLimit || null,
          authType: details.authType || null,
          pinPrompt: details.pinPrompt || null,
          pinPromptRevivable: (details.pinPromptRevivable !== undefined) ? !!details.pinPromptRevivable : null,
          pinPromptInstructions: ppi,
          decimals: details.decimalsInAmount || details.decimals || null
        };
      };

      // V1 Logic
      if (country.correspondents) {
        if (prov.currency) currencies.push(prov.currency);
        (prov.operationTypes || []).forEach(op => {
          if (op.operationType) processDetails(op.operationType, op);
          else { for (const [k, v] of Object.entries(op)) if (typeof v === "object") processDetails(k, v); }
        });
      } 
      // V2 Logic
      else {
        (prov.currencies || []).forEach(c => {
          if (c.currency) currencies.push(c.currency);
          const opBlock = c.operationTypes || [];
          if (Array.isArray(opBlock)) {
            opBlock.forEach(entry => {
              if (entry.operationType) processDetails(entry.operationType, entry);
              else { for (const [k, v] of Object.entries(entry)) processDetails(k, v); }
            });
          } else {
            for (const [k, v] of Object.entries(opBlock)) processDetails(k, v);
          }
        });
      }

      lookup.countries[countryCode][code] = {
        displayName,
        ownerName,
        currencies: [...new Set(currencies)],
        logo,
        operations
      };
    });
  });
  return lookup;
};

/**
 * MAIN EXECUTION FUNCTION
 * This is what server.js will call.
 */
async function fetchAndProcessMnoConf() {
  const environment = process.env.ENVIRONMENT || "sandbox";
  const sslVerify = environment === "production";
  const apiVersion = process.env.PAWAPAY_API_VERSION || "v2";
  const apiToken = process.env[`PAWAPAY_${environment.toUpperCase()}_API_TOKEN`];
  // Retrieve License Key
  const licenseKey = process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY;

  if (!apiToken) {
    throw new Error("API token not found for the selected environment");
  }
  
  if (!licenseKey) {
    throw new Error("SDK License key not found in environment variables");
  }

  // 1. Init Client (CORRECTED: using object syntax)
  const pawaPayClient = new ApiClient({
    apiToken: apiToken,
    environment: environment,
    sslVerify: sslVerify,
    apiVersion: apiVersion,
    licenseKey: licenseKey
  });

  // 2. API Calls
  console.log(`[fetchMnoConf] Fetching data using ${apiVersion}...`);
  const [mnoResponse, activeConfResponse] = await Promise.all([
    pawaPayClient.checkMNOAvailabilityAuto(),
    pawaPayClient.checkActiveConfAuto()
  ]);

  // 3. Save JSON Files (Mirroring PHP)
  const dataDir = ensureDataDir();

  if (mnoResponse.status === 200) {
    fs.writeFileSync(
      path.join(dataDir, `mno_availability_${apiVersion}.json`),
      JSON.stringify(mnoResponse.response, null, 2)
    );
    console.log(`[fetchMnoConf] Saved mno_availability_${apiVersion}.json`);
  }

  if (activeConfResponse.status === 200) {
    fs.writeFileSync(
      path.join(dataDir, `active_conf_${apiVersion}.json`),
      JSON.stringify(activeConfResponse.response, null, 2)
    );
    console.log(`[fetchMnoConf] Saved active_conf_${apiVersion}.json`);
  }

  // 4. Prepare Data for View
  const mnoData = (mnoResponse.status === 200) ? mnoResponse.response : null;
  const activeConfRaw = (activeConfResponse.status === 200) ? activeConfResponse.response : null;

  return {
    environment,
    apiVersion,
    availability: normalizeAvailability(apiVersion, mnoData),
    activeConfLookup: normalizeActiveConf(apiVersion, activeConfRaw)
  };
}

module.exports = fetchAndProcessMnoConf;