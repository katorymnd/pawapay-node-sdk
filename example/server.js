// D:\pawapay\node-sdk\example\server.js
// http://localhost:4000/pawapay/create-session - deposit via webpage
//
// UPDATED FEATURES:
// 1. "Hot Reload" for logic modules: Edits to backend files reflect immediately.
// 2. "No Cache" for browser: Headers force browser to ask server for fresh data.
// 3. "Direct Read" for JSON: Reads config files from disk on every request.

const express = require("express");
const path = require("path");
const fs = require("fs");
const net = require("net");
const ejs = require("ejs");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ROOT = __dirname;
const PROJECT = path.resolve(ROOT, ".."); // D:\pawapay\pawapay-node-sdk
const DATA_DIR = path.join(PROJECT, "data"); // D:\pawapay\pawapay-node-sdk\data
const DEFAULT_PORT = process.env.PORT || 4000;

// Function to check if port is available
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false); // Other errors also mean port is not available
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

// Function to find available port starting from preferred port
const findAvailablePort = async (preferredPort, maxAttempts = 10) => {
  let port = preferredPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const available = await isPortAvailable(port);

    if (available) {
      return port;
    }

    console.log(`Port ${port} is in use, trying ${port + 1}...`);
    port++;
    attempts++;
  }

  throw new Error(
    `Could not find available port after ${maxAttempts} attempts`
  );
};

// Vite middleware for development
let vite;
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer } = await import("vite");
      vite = await createServer({
        server: {
          middlewareMode: true,
          hmr: {
            server: undefined // Let Express handle HMR server
          }
        },
        appType: "custom",
        root: ROOT,
        publicDir: path.join(ROOT, "public")
      });

      // Use Vite's connect instance as middleware
      app.use(vite.middlewares);
      console.log("Vite dev server integrated");
    } catch (error) {
      console.warn(
        "Vite not available, running without hot reload:",
        error.message
      );
    }
  }
}

// 1. livereload (DEV ONLY) - Only if Vite is not available
if (process.env.NODE_ENV !== "production") {
  const setupLiveReload = () => {
    const livereload = require("livereload");
    const connectLivereload = require("connect-livereload");

    const liveReloadServer = livereload.createServer({ port: 35740 });
    liveReloadServer.watch(path.join(ROOT, "public"));
    app.use(connectLivereload());
    liveReloadServer.server.once("connection", () =>
      setTimeout(() => liveReloadServer.refresh("/"), 100)
    );
    console.log("LiveReload enabled (fallback)");
  };

  // Only setup livereload if Vite fails
  setupViteMiddleware().catch(setupLiveReload);
}

// 2. Static files (fallback when not in development with Vite)
if (process.env.NODE_ENV === "production" || !vite) {
  app.use("/public", express.static(path.join(ROOT, "public")));
}

// 3. EJS view engine
app.set("views", path.join(ROOT, "views"));
app.set("view engine", "ejs");

// ─── 4. “Catalog” data lives server-side ─────────────────────────
const countryCatalog = {
  Benin: {
    currency: "XOF",
    operators: [
      {
        name: "MTN Benin",
        apiCode: "MTN_MOMO_BEN",
        code: "+229",
        flag: "bj.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Moov Benin",
        apiCode: "MOOV_BEN",
        code: "+229",
        flag: "bj.png",
        available: false,
        img: "moov.png"
      }
    ]
  },
  "Burkina Faso": {
    currency: "XOF",
    operators: [
      {
        name: "Orange Burkina Faso",
        apiCode: "ORANGE_BFA",
        code: "+226",
        flag: "bf.png",
        available: true,
        img: "orange-money-logo.jpg"
      },
      {
        name: "Moov Burkina Faso",
        apiCode: "MOOV_BFA",
        code: "+226",
        flag: "bf.png",
        available: true,
        img: "moov.png"
      }
    ]
  },
  Cameroon: {
    currency: "XAF",
    operators: [
      {
        name: "MTN Cameroon",
        apiCode: "MTN_MOMO_CMR",
        code: "+237",
        flag: "cm.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Orange Cameroon",
        apiCode: "ORANGE_CMR",
        code: "+237",
        flag: "cm.png",
        available: true,
        img: "orange-money-logo.jpg"
      }
    ]
  },
  Congo: {
    currency: "XAF",
    operators: [
      {
        name: "Airtel Congo",
        apiCode: "AIRTEL_COG",
        code: "+242",
        flag: "cg.png",
        available: false,
        img: "airtel.png"
      }
    ]
  },
  "Congo (DRC)": {
    currency: "CDF",
    operators: [
      {
        name: "Vodacom DRC",
        apiCode: "VODACOM_MPESA_COD",
        code: "+243",
        flag: "cd.png",
        available: true,
        img: "vodacom.jpg"
      },
      {
        name: "Airtel DRC",
        apiCode: "AIRTEL_COD",
        code: "+243",
        flag: "cd.png",
        available: true,
        img: "airtel.png"
      },
      {
        name: "Orange DRC",
        apiCode: "ORANGE_COD",
        code: "+243",
        flag: "cd.png",
        available: false,
        img: "orange-money-logo.jpg"
      }
    ]
  },
  "Cote D'Ivoire": {
    currency: "XOF",
    operators: [
      {
        name: "MTN Cote d'Ivoire",
        apiCode: "MTN_MOMO_CIV",
        code: "+225",
        flag: "ci.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Orange Cote d'Ivoire",
        apiCode: "ORANGE_CIV",
        code: "+225",
        flag: "ci.png",
        available: true,
        img: "orange-money-logo.jpg"
      },
      {
        name: "Moov Cote d'Ivoire",
        apiCode: "MOOV_CIV",
        code: "+225",
        flag: "ci.png",
        available: true,
        img: "moov.png"
      },
      {
        name: "Wave Cote d'Ivoire",
        apiCode: "WAVE_CIV",
        code: "+225",
        flag: "ci.png",
        available: true,
        img: "wave-logo.png"
      }
    ]
  },
  Gabon: {
    currency: "XAF",
    operators: [
      {
        name: "Airtel Gabon",
        apiCode: "AIRTEL_GAB",
        code: "+241",
        flag: "ga.png",
        available: true,
        img: "airtel.png"
      },
      {
        name: "Moov Gabon",
        apiCode: "MOOV_GAB",
        code: "+241",
        flag: "ga.png",
        available: true,
        img: "moov.png"
      }
    ]
  },
  Ghana: {
    currency: "GHS",
    operators: [
      {
        name: "MTN Ghana",
        apiCode: "MTN_MOMO_GHA",
        code: "+233",
        flag: "gh.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "AirtelTigo Ghana",
        apiCode: "AIRTELTIGO_GHA",
        code: "+233",
        flag: "gh.png",
        available: true,
        img: "airtel-tigo.png"
      },
      {
        name: "Vodafone Ghana",
        apiCode: "VODAFONE_GHA",
        code: "+233",
        flag: "gh.png",
        available: true,
        img: "vodacom.jpg"
      }
    ]
  },
  Kenya: {
    currency: "KES",
    operators: [
      {
        name: "Safaricom Kenya",
        apiCode: "MPESA_KEN",
        code: "+254",
        flag: "ke.png",
        available: true,
        img: "safaricom-logo.png"
      },
      {
        name: "Airtel Kenya",
        apiCode: "AIRTEL_KEN",
        code: "+254",
        flag: "ke.png",
        available: true,
        img: "airtel.png"
      }
    ]
  },
  Malawi: {
    currency: "MWK",
    operators: [
      {
        name: "Airtel Malawi",
        apiCode: "AIRTEL_MWI",
        code: "+265",
        flag: "mw.png",
        available: true,
        img: "airtel.png"
      },
      {
        name: "TNM Malawi",
        apiCode: "TNM_MWI",
        code: "+265",
        flag: "mw.png",
        available: true,
        img: "mw-tnm-logo.png"
      }
    ]
  },
  Mozambique: {
    currency: "MZN",
    operators: [
      {
        name: "Vodacom Mozambique",
        apiCode: "VODACOM_MOZ",
        code: "+258",
        flag: "mz.png",
        available: true,
        img: "vodacom.jpg"
      },
      {
        name: "Movitel Mozambique",
        apiCode: "MOVITEL_MOZ",
        code: "+258",
        flag: "mz.png",
        available: true,
        img: "movitel.png"
      }
    ]
  },
  Nigeria: {
    currency: "NGN",
    operators: [
      {
        name: "MTN Nigeria",
        apiCode: "MTN_MOMO_NGA",
        code: "+234",
        flag: "ng.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Airtel Nigeria",
        apiCode: "AIRTEL_NGA",
        code: "+234",
        flag: "ng.png",
        available: true,
        img: "airtel.png"
      }
    ]
  },
  Rwanda: {
    currency: "RWF",
    operators: [
      {
        name: "MTN Rwanda",
        apiCode: "MTN_MOMO_RWA",
        code: "+250",
        flag: "rw.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Airtel Rwanda",
        apiCode: "AIRTEL_RWA",
        code: "+250",
        flag: "rw.png",
        available: true,
        img: "airtel.png"
      }
    ]
  },
  Senegal: {
    currency: "XOF",
    operators: [
      {
        name: "Orange Senegal",
        apiCode: "ORANGE_SEN",
        code: "+221",
        flag: "sn.png",
        available: true,
        img: "orange-money-logo.jpg"
      },
      {
        name: "Free Senegal",
        apiCode: "FREE_SEN",
        code: "+221",
        flag: "sn.png",
        available: true,
        img: "free.png"
      }
    ]
  },
  "Sierra Leone": {
    currency: "SLE",
    operators: [
      {
        name: "Orange Sierra Leone",
        apiCode: "ORANGE_SLE",
        code: "+232",
        flag: "sl.png",
        available: true,
        img: "orange-money-logo.jpg"
      },
      {
        name: "Africell Sierra Leone",
        apiCode: "AFRICELL_SLE",
        code: "+232",
        flag: "sl.png",
        available: true,
        img: "africell.png"
      }
    ]
  },
  Tanzania: {
    currency: "TZS",
    operators: [
      {
        name: "Vodacom Tanzania",
        apiCode: "VODACOM_TZA",
        code: "+255",
        flag: "tz.png",
        available: true,
        img: "vodacom.jpg"
      },
      {
        name: "Airtel Tanzania",
        apiCode: "AIRTEL_TZA",
        code: "+255",
        flag: "tz.png",
        available: true,
        img: "airtel.png"
      },
      {
        name: "Tigo Tanzania",
        apiCode: "TIGO_TZA",
        code: "+255",
        flag: "tz.png",
        available: true,
        img: "tigo-pesa-tanzania.png"
      },
      {
        name: "Halotel Tanzania",
        apiCode: "HALOTEL_TZA",
        code: "+255",
        flag: "tz.png",
        available: true,
        img: "halotel-tz.png"
      }
    ]
  },
  Uganda: {
    currency: "UGX",
    operators: [
      {
        name: "MTN Uganda",
        apiCode: "MTN_MOMO_UGA",
        code: "+256",
        flag: "ug.png",
        available: false,
        img: "mtn.png"
      },
      {
        name: "Airtel Uganda",
        apiCode: "AIRTEL_OAPI_UGA",
        code: "+256",
        flag: "ug.png",
        available: true,
        img: "airtel.png"
      }
    ]
  },
  Zambia: {
    currency: "ZMW",
    operators: [
      {
        name: "MTN Zambia",
        apiCode: "MTN_MOMO_ZMB",
        code: "+260",
        flag: "zm.png",
        available: true,
        img: "mtn.png"
      },
      {
        name: "Airtel Zambia",
        apiCode: "AIRTEL_OAPI_ZMB",
        code: "+260",
        flag: "zm.png",
        available: true,
        img: "airtel.png"
      },
      {
        name: "Zamtel Zambia",
        apiCode: "ZAMTEL_ZMB",
        code: "+260",
        flag: "zm.png",
        available: false,
        img: "zamtel-za.png"
      }
    ]
  }
};


// 4a. Merge JSON availability + ownerName into a fresh catalog
// Automatically detects and uses the best available version (v2 > v1 > default)
function getMergedCatalog() {
  let availabilityData = [];
  let activeConfData = { countries: [] };
  let detectedVersion = null;

  // Priority: v2 (latest) → v1 → default
  const versionPriority = ["v2", "v1", "default"];

  const tryLoadVersion = (version) => {
    const suffix = version === "default" ? "" : `_${version}`;
    const availFile = `mno_availability${suffix}.json`;
    const confFile = `active_conf${suffix}.json`;

    const availPath = path.join(DATA_DIR, availFile);
    const confPath = path.join(DATA_DIR, confFile);

    // Check if both files exist
    if (fs.existsSync(availPath) && fs.existsSync(confPath)) {
      return {
        availabilityData: JSON.parse(fs.readFileSync(availPath, "utf-8")),
        activeConfData: JSON.parse(fs.readFileSync(confPath, "utf-8")),
        version: version
      };
    }
    return null;
  };

  // Try versions in priority order
  for (const version of versionPriority) {
    const result = tryLoadVersion(version);
    if (result) {
      availabilityData = result.availabilityData;
      activeConfData = result.activeConfData;
      detectedVersion = result.version;
      console.log(`✓ Using ${version === "default" ? "default" : version} API data files`);
      break;
    }
  }

  if (!detectedVersion) {
    console.error("❌ No availability data files found!");
    return JSON.parse(JSON.stringify(countryCatalog));
  }

  // Build lookup maps - handle both v1/default and v2 structures
  const availabilityMap = {};

  if (detectedVersion === "v2") {
    // v2 structure: uses 'providers' and operationTypes as object
    availabilityData.forEach((ctry) => {
      (ctry.providers || []).forEach((prov) => {
        // In v2, operationTypes is an object like { DEPOSIT: "OPERATIONAL", PAYOUT: "OPERATIONAL" }
        const allOperational = Object.values(prov.operationTypes || {})
          .every(status => status === "OPERATIONAL");
        availabilityMap[prov.provider] = allOperational;
      });
    });
  } else {
    // v1/default structure: uses 'correspondents' and operationTypes as array
    availabilityData.forEach((ctry) => {
      (ctry.correspondents || []).forEach((cor) => {
        const allOperational = (cor.operationTypes || [])
          .every(op => op.status === "OPERATIONAL");
        availabilityMap[cor.correspondent] = allOperational;
      });
    });
  }

  const ownerMap = {};

  if (detectedVersion === "v2") {
    // v2 structure: uses 'providers' array
    (activeConfData.countries || []).forEach((ctry) => {
      (ctry.providers || []).forEach((prov) => {
        ownerMap[prov.provider] = prov.nameDisplayedToCustomer || prov.displayName || "N/A";
      });
    });
  } else {
    // v1/default structure: uses 'correspondents' array
    (activeConfData.countries || []).forEach((ctry) => {
      (ctry.correspondents || []).forEach((cor) => {
        ownerMap[cor.correspondent] = cor.ownerName || "N/A";
      });
    });
  }

  // deep clone and merge
  const merged = JSON.parse(JSON.stringify(countryCatalog));
  Object.values(merged).forEach((countryData) => {
    countryData.operators.forEach((op) => {
      if (Object.prototype.hasOwnProperty.call(availabilityMap, op.apiCode)) {
        op.available = availabilityMap[op.apiCode];
      }
      if (Object.prototype.hasOwnProperty.call(ownerMap, op.apiCode)) {
        op.ownerName = ownerMap[op.apiCode];
      }
    });
  });

  return merged;
}

// Enhanced render function that works with Vite
async function renderWithVite(res, page, data = {}) {
  const templatePath = path.join(ROOT, "views", "layout.ejs");
  const pageFile = path.join(ROOT, "views", `${page}.ejs`);

  console.log(`\n[renderWithVite] page: ${page}`);
  console.log(`[renderWithVite] layout: ${templatePath}`);
  console.log(`[renderWithVite] pageFile: ${pageFile}`);

  // Sanity checks - log whether key files exist
  const checkFiles = [
    templatePath,
    pageFile,
    path.join(ROOT, "views", "partials", "header.ejs"),
    path.join(ROOT, "views", "partials", "nav.ejs"),
    path.join(ROOT, "views", "partials", "footer.ejs")
  ];
  checkFiles.forEach((p) => {
    console.log(
      `[renderWithVite] exists? ${fs.existsSync(p) ? "YES" : "NO "} -> ${p}`
    );
  });

  // Read layout template
  let layoutRaw;
  try {
    layoutRaw = fs.readFileSync(templatePath, "utf-8");
  } catch (err) {
    console.error("[renderWithVite] ERROR reading layout.ejs:", err.message);
    return res.status(500).send("Server error: layout.ejs missing");
  }

  // Render EJS first, with filename so includes resolve relative to layout file
  try {
    const ejsOptions = {
      filename: templatePath,
      root: path.join(ROOT, "views")
    };

    const renderedHtml = ejs.render(
      layoutRaw,
      {
        ...data,
        page: data.page || page
      },
      ejsOptions
    );

    // Now that we have plain HTML, let Vite transform it if available
    let finalHtml = renderedHtml;
    if (vite && typeof vite.transformIndexHtml === "function") {
      try {
        finalHtml = await vite.transformIndexHtml(
          data.page || `/${page}`,
          renderedHtml
        );
      } catch (vtErr) {
        console.warn(
          "[renderWithVite] vite.transformIndexHtml failed (continuing with untransformed HTML):",
          vtErr && vtErr.message ? vtErr.message : vtErr
        );
      }
    }

    res.setHeader("Content-Type", "text/html");
    return res.send(finalHtml);
  } catch (err) {
    // Detailed error logging to help debug includes and invisible characters
    console.error(
      "[renderWithVite] EJS render failed:",
      err && err.stack ? err.stack : err
    );

    // Show a small preview of layout lines around first "<%- include"
    try {
      const lines = layoutRaw.split(/\r?\n/);
      let includeLine = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("<%- include")) {
          includeLine = i + 1;
          break;
        }
      }
      const start = Math.max(0, (includeLine || 1) - 5);
      const end = Math.min(lines.length, (includeLine || 1) + 5);
      console.error("[renderWithVite] layout snippet around include:");
      for (let i = start; i < end; i++) {
        console.error(`${String(i + 1).padStart(3)} | ${lines[i]}`);
      }
    } catch (previewErr) {
      console.error(
        "[renderWithVite] Failed to print layout preview:",
        previewErr
      );
    }

    // Attempt fallback to express view render (this will use app.set('views') context)
    try {
      return res.render("layout", { ...data, page: data.page || page });
    } catch (finalErr) {
      console.error(
        "[renderWithVite] Fallback res.render failed:",
        finalErr && finalErr.stack ? finalErr.stack : finalErr
      );
      return res.status(500).send("Server error rendering template");
    }
  }
}

// 5. Home route - render EJS template
app.get("/", async (_req, res) => {
  await renderWithVite(res, "home", {
    title: "PawaPay Node SDK",
    description: "Integrate mobile-money payments quickly and securely"
  });
});


// 6. GET /deposit → render template with embedded JSON data
// UPDATED: Direct read with No-Cache headers (prevents browser caching)
app.get("/deposit", async (_req, res) => {
  // 1. Force browser/client to not cache this response
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // 2. Regenerate catalog fresh
  const catalog = getMergedCatalog();

  // 3. Direct Read Logic: Find highest priority files and read immediately from disk
  const versionPriority = ["v2", "v1", "default"];
  let availabilityData = {};
  let activeConfData = {};
  let detectedVersion = "default";

  // Iterate to find the best available files
  for (const version of versionPriority) {
    const suffix = version === "default" ? "" : `_${version}`;
    const availPath = path.join(DATA_DIR, `mno_availability${suffix}.json`);
    const confPath = path.join(DATA_DIR, `active_conf${suffix}.json`);

    if (fs.existsSync(availPath) && fs.existsSync(confPath)) {
      try {
        // DIRECT SYNC READ (Server Side No-Cache)
        const availRaw = fs.readFileSync(availPath, "utf-8");
        const confRaw = fs.readFileSync(confPath, "utf-8");

        availabilityData = JSON.parse(availRaw);
        activeConfData = JSON.parse(confRaw);
        detectedVersion = version;

        console.log(`[GET /deposit] Direct read loaded version: ${version}`);
        break; // Stop once we find the highest priority
      } catch (err) {
        console.error(`[GET /deposit] Error reading ${version} files:`, err.message);
      }
    }
  }

  await renderWithVite(res, "initiate", {
    title: "Deposit - PawaPay SDK",
    description: "Initiate secure mobile money deposits across 15+ African countries using PawaPay's Node SDK.",
    bodyClass: "deposit",
    catalog,
    availabilityData,
    activeConfData,
    dataVersion: detectedVersion // Passed to view for debugging if needed
  });
});

// 7. Add withdraw route
app.get("/withdraw", async (_req, res) => {
  await renderWithVite(res, "withdraw", {
    title: "Withdraw - PawaPay SDK",
    description: "Initiate secure payouts to mobile money wallets across multiple African markets with PawaPay's Node SDK.",
    catalog: getMergedCatalog()
  });
});

// 10. POST /payouts → ACTUAL payout processing
app.post("/payouts", async (req, res) => {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./initiatePayout");
    delete require.cache[modulePath];
    const initiatePayout = require("./initiatePayout");
    // ---------------------------------

    console.log("Payout initiation request received:", {
      recipients: req.body.recipients,
      timestamp: new Date().toISOString()
    });

    // Extract parameters from request body
    const payoutParams = {
      recipients: req.body.recipients,
      environment: req.body.environment,
      apiVersion: req.body.apiVersion
    };

    // Process the payout
    const result = await initiatePayout(payoutParams);

    // Log result
    if (result.success) {
      console.log("✅ Payout processed successfully:", result.transactionIds);
    } else {
      console.warn("❌ Payout processing failed:", result.errorMessage);
    }

    // Return appropriate HTTP status
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);

  } catch (error) {
    console.error("Unexpected error in /payouts:", error);
    return res.status(500).json({
      success: false,
      errorMessage: "Internal server error. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});


// 8. POST /deposit/initiate → ACTUAL payment processing
app.post("/deposit/initiate", async (req, res) => {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./initiateDeposit");
    delete require.cache[modulePath];
    const initiateDeposit = require("./initiateDeposit");
    // ---------------------------------

    console.log("Payment initiation request received:", {
      amount: req.body.amount,
      currency: req.body.currency,
      mno: req.body.mno,
      timestamp: new Date().toISOString()
    });

    // Extract parameters from request body
    const paymentParams = {
      amount: req.body.amount,
      mno: req.body.mno,
      payerMsisdn: req.body.payerMsisdn,
      description: req.body.description,
      currency: req.body.currency,
      environment: req.body.environment,
      apiVersion: req.body.apiVersion,
      metadata: req.body.metadata
    };

    // Process the payment
    const result = await initiateDeposit(paymentParams);

    // Log result
    if (result.success) {
      console.log("✅ Payment processed successfully:", result.transactionId);
    } else {
      console.warn("❌ Payment processing failed:", result.errorMessage);
    }

    // Return appropriate HTTP status
    const httpStatus = result.success ? 200 : 400;
    return res.status(httpStatus).json(result);

  } catch (error) {
    console.error("Unexpected error in /deposit/initiate:", error);
    return res.status(500).json({
      success: false,
      errorMessage: "Internal server error. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

// ========== ADD NEW API ROUTE -fetchPawaPayConfig ==========

/**
 * GET /pawapay/config
 * (detailed comment preserved from prior file)
 */
app.get("/pawapay/config", async (req, res) => {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/fetchPawapayConf");
    delete require.cache[modulePath];
    const fetchPawaPayConfig = require("./direct/fetchPawapayConf");
    // ---------------------------------

    // Map query parameters to module parameters (with proper naming)
    const options = {
      environment: req.query.env,
      apiVersion: req.query.apiVersion,
      endpointType: req.query.endpoint,
      country: req.query.country,
      operationType: req.query.operationType
    };

    // Remove undefined values so module defaults work properly
    Object.keys(options).forEach((key) => {
      if (options[key] === undefined) {
        delete options[key];
      }
    });

    const data = await fetchPawaPayConfig(options);

    res.json({
      success: true,
      source: "pawapay",
      data
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      message: err.message || "Failed to fetch PawaPay configuration",
      error: err.responseData || null
    });
  }
});

// ========== END NEW API ROUTE -fetchPawaPayConfig ==========


/**
 * defaultMetadata - shared between GET and POST handlers
 */
const defaultMetadata = [
  {
    fieldName: "orderId",
    fieldValue: "ORD-123456789"
  },
  {
    fieldName: "customerId",
    fieldValue: "customer@email.com",
    isPII: true
  }
];

/**
 * latestSessions - in-memory circular buffer to store latest created sessions
 * Purpose: lightweight dev-only "latest" endpoint to inspect recent session results.
 * Keep small to avoid memory blowup. Not persisted to disk.
 */
const latestSessions = [];
const LATEST_SESSIONS_MAX = 10;

/**
 * pushLatestSession - add a session result into the in-memory buffer
 */
function pushLatestSession(record) {
  try {
    latestSessions.unshift(record);
    if (latestSessions.length > LATEST_SESSIONS_MAX) {
      latestSessions.pop();
    }
  } catch (e) {
    // ignore errors, this is best-effort only
    console.warn("pushLatestSession failed:", e && e.message ? e.message : e);
  }
}

/**
 * createSessionHandler
 *
 * Single handler for both GET and POST on the same path. It prefers
 * request body values (POST) when present, falls back to query string
 * (GET), and finally to sensible defaults. This keeps a single processing
 * flow and removes duplication.
 */
async function createSessionHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/depositViaWebpage");
    delete require.cache[modulePath];
    const createPaymentSession = require("./direct/depositViaWebpage");
    // ---------------------------------

    // prefer body over query; allow both styles to be used together
    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      amount: src.amount || "1000",
      currency: src.currency || "UGX",
      msisdn: src.msisdn || src.phone || "256783456789",
      country: src.country || "UGA",
      customerMessage:
        src.customerMessage || src.statementDescription || "OrderPayment123",
      returnUrl:
        src.returnUrl ||
        src.return_url ||
        "https://example.com/paymentProcessed",
      reason: src.reason || "Payment for order",
      language: src.language || "EN",
      metadata: src.metadata || defaultMetadata
    };

    // Basic server-side validation (createPaymentSession will also validate)
    if (!options.returnUrl) {
      return res.status(400).json({
        success: false,
        message: "returnUrl is required"
      });
    }
    if (!options.amount) {
      return res.status(400).json({
        success: false,
        message: "amount is required"
      });
    }

    const result = await createPaymentSession(options);

    // push to in-memory latestSessions for dev inspection
    pushLatestSession({
      timestamp: new Date().toISOString(),
      request: {
        path: req.path,
        method: req.method,
        options
      },
      result
    });

    return res.json({
      success: true,
      source: "pawapay-payment-session",
      environment: options.environment,
      apiVersion: options.apiVersion,
      depositId: result.depositId || result.deposit_id || null,
      redirectUrl: result.redirectUrl || result.redirect_url || null,
      data: result
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to create payment session",
      error: err.responseData || null
    });
  }
}

// Register the single handler for both GET and POST
app.get("/pawapay/create-session", createSessionHandler);
app.post("/pawapay/create-session", createSessionHandler);

// New lightweight endpoint to inspect latest created sessions (dev-only)
app.get("/pawapay/create-session/latest", (_req, res) => {
  if (latestSessions.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No recent sessions found"
    });
  }
  return res.json({
    success: true,
    count: latestSessions.length,
    latest: latestSessions
  });
});


// ============================================================
// [NEW] HANDLER FOR API CLIENT (HOSTED PAGE)
// Route: /pawapay/hosted-session
// ============================================================
async function hostedSessionHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./depositViaPaymentPage");
    delete require.cache[modulePath];
    const initiateHostedSession = require("./depositViaPaymentPage");
    // ---------------------------------

    // Merge query and body
    const src = Object.assign({}, req.query || {}, req.body || {});

    // Ensure we have a valid description. PHP forces 4-22 chars.
    // If input is missing, default to "Payment123" to satisfy API requirements
    let desc = src.description || src.statementDescription || "Payment123";
    if (desc.length < 4) desc = desc.padEnd(4, "0");
    if (desc.length > 22) desc = desc.substring(0, 22);

    const options = {
      environment: src.environment || src.env,
      apiVersion: src.apiVersion,
      amount: src.amount || "5000",
      currency: src.currency || "UGX",
      country: src.country || "UGA",
      // Map multiple phone key variations to payerMsisdn
      payerMsisdn: src.msisdn || src.payerMsisdn || src.phone || "256783456789",
      description: desc,
      reason: src.reason || "Payment",
      returnUrl: src.returnUrl,
      language: src.language || "EN",
      // Handle metadata: empty array by default
      metadata: src.metadata || []
    };

    const result = await initiateHostedSession(options);

    // If it failed, send 400 or 500 based on result
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }

    return res.json(result);

  } catch (err) {
    console.error("Hosted Session Error:", err);
    return res.status(500).json({
      success: false,
      errorMessage: err.message || "Failed to create hosted session"
    });
  }
}

// Register the NEW route
app.get("/pawapay/hosted-session", hostedSessionHandler);
app.post("/pawapay/hosted-session", hostedSessionHandler);

// ============================================================
//  VIEW ROUTE GET /deposit-payment-page -> Render the new Hosted Page Demo
// ============================================================
app.get("/deposit-payment-page", async (_req, res) => {
  await renderWithVite(res, "depositViaPaymentPage", {
    title: "Hosted Checkout - PawaPay SDK",
    description: "Secure hosted payment page demo using ApiClient."
  });
});

// Success landing page
app.get("/deposit-page-success", async (_req, res) => {
  res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: green;">Payment Success!</h1>
            <p>You have returned from the PawaPay Payment Page.</p>
            <a href="/deposit-payment-page">Back to Demo</a>
        </div>
    `);
});


// deposit test
async function depositHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/testDeposit");
    delete require.cache[modulePath];
    const testDeposit = require("./direct/testDeposit");
    // ---------------------------------

    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      amount: src.amount || "1000",
      currency: src.currency || "UGX",
      msisdn: src.msisdn || src.phone || "256783456789",
      customerMessage:
        src.customerMessage || src.statementDescription || "Payment for order",
      clientReferenceId: src.clientReferenceId || "INV-123456",
      metadata: src.metadata || [
        { orderId: "ORD-123456789" },
        { customerId: "customer@email.com", isPII: true }
      ]
    };

    if (!options.amount)
      return res
        .status(400)
        .json({ success: false, message: "amount is required" });
    if (!options.msisdn)
      return res
        .status(400)
        .json({ success: false, message: "msisdn is required" });

    const result = await testDeposit(options);

    return res.json({
      success: true,
      source: "pawapay-deposit",
      environment: options.environment,
      apiVersion: options.apiVersion,
      depositId: result.depositId,
      response: result.response,
      statusCode: result.statusCode
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to initiate deposit",
      error: err.responseData || null,
      depositId: err.depositId || null
    });
  }
}

app.get("/pawapay/deposit", depositHandler);
app.post("/pawapay/deposit", depositHandler);

//check depositId logic
// ========== ADD NEW API ROUTE - /pawapay/check-depositId ==========


/**
 * Unified GET/POST handler for /pawapay/check-depositId
 * Mimics PHP behavior exactly:
 * - GET: ?environment=sandbox&apiVersion=v1&depositId=...&outputRawJson=true
 * - POST: JSON body with same fields
 * - On 200 + outputRawJson=true → returns raw API JSON
 * - Otherwise returns normalized wrapper
 */
async function checkDepositHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/transactionIdCheckTest");
    delete require.cache[modulePath];
    const transactionIdCheckTest = require("./direct/transactionIdCheckTest");
    // ---------------------------------

    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      depositId: src.depositId || src.id || src.deposit_id,
      outputRawJson:
        src.outputRawJson === "true" ||
        src.output_raw_json === "true" ||
        src.outputRawJson === true
    };

    // Validate required field
    if (!options.depositId) {
      return res.status(400).json({
        error: "missing_deposit_id",
        message: "depositId is required"
      });
    }

    const result = await transactionIdCheckTest(options);

    // If it's an error object (non-200), return it as JSON
    if (result.error) {
      return res.status(result.httpStatus || 500).json(result);
    }

    // Success case: return normalized or raw
    return res.json(result);
  } catch (err) {
    // Handle unexpected errors (network, invalid UUID, etc.)
    if (err.error) {
      return res.status(err.httpStatus || 500).json(err);
    }

    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Unknown server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// Register both GET and POST
app.get("/pawapay/check-depositId", checkDepositHandler);
app.post("/pawapay/check-depositId", checkDepositHandler);

// ========== END NEW API ROUTE - /pawapay/check-depositId ==========

// ========== ADD NEW API ROUTE - /pawapay/payout ==========


/**
 * Unified GET/POST handler for /pawapay/payout
 *
 * - GET: ?environment=sandbox&apiVersion=v1&outputRawJson=true
 * - POST: JSON body with same fields
 * - On 200/201 + outputRawJson=true → returns raw API JSON
 * - Otherwise returns normalized wrapper
 */
async function payoutHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/testPayouts");
    delete require.cache[modulePath];
    const testPayouts = require("./direct/testPayouts");
    // ---------------------------------

    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      outputRawJson:
        src.outputRawJson === "true" ||
        src.output_raw_json === "true" ||
        src.outputRawJson === true
    };

    const result = await testPayouts(options);

    // Return raw JSON if requested and successful
    if (result.rawResponse && result.success && result.outputRawJson) {
      return res.json(result.rawResponse);
    }

    // Return normalized response
    if (result.error) {
      return res.status(result.httpStatus || 500).json(result);
    }

    return res.json(result);
  } catch (err) {
    if (err.error) {
      return res.status(err.httpStatus || 500).json(err);
    }

    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Unknown server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// Register both GET and POST
app.get("/pawapay/payout", payoutHandler);
app.post("/pawapay/payout", payoutHandler);

// ========== END NEW API ROUTE - /pawapay/payout ==========

// ========== ADD NEW API ROUTE - /pawapay/refund ==========


/**
 * Unified GET/POST handler for /pawapay/refund
 *
 * - GET: ?environment=sandbox&apiVersion=v1&depositId=...&amount=1000&outputRawJson=true
 * - POST: JSON body with same fields
 * - On 200 + outputRawJson=true → returns raw API JSON
 * - Otherwise returns normalized wrapper
 */
async function refundHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/testRefund");
    delete require.cache[modulePath];
    const testRefund = require("./direct/testRefund");
    // ---------------------------------

    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      depositId: src.depositId || src.deposit_id || src.id,
      amount: src.amount || "1000",
      currency: src.currency || "UGX",
      outputRawJson:
        src.outputRawJson === "true" ||
        src.output_raw_json === "true" ||
        src.outputRawJson === true
    };

    // Validate required field
    if (!options.depositId) {
      return res.status(400).json({
        error: "missing_deposit_id",
        message: "depositId is required"
      });
    }

    const result = await testRefund(options);

    // If raw JSON requested and success → return raw
    if (result.rawResponse && result.success && result.outputRawJson) {
      return res.json(result.rawResponse);
    }

    // Return normalized response
    if (result.error) {
      return res.status(result.httpStatus || 500).json(result);
    }

    return res.json(result);
  } catch (err) {
    if (err.error) {
      return res.status(err.httpStatus || 500).json(err);
    }

    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Unknown server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// Register both GET and POST
app.get("/pawapay/refund", refundHandler);
app.post("/pawapay/refund", refundHandler);

// ========== END NEW API ROUTE - /pawapay/refund ==========

// ========== ADD NEW API ROUTE - /pawapay/refund-id-check ==========


/**
 * Unified GET/POST handler for /pawapay/refund-id-check
 *
 * - GET: ?environment=sandbox&apiVersion=v1&refundId=...&outputRawJson=true
 * - POST: JSON body with same fields
 * - On 200 + outputRawJson=true → returns raw API JSON
 * - Otherwise returns normalized wrapper
 */
async function refundIdCheckHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/testRefundIDCheck");
    delete require.cache[modulePath];
    const testRefundIDCheck = require("./direct/testRefundIDCheck");
    // ---------------------------------

    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      refundId: src.refundId || src.id || src.refund_id,
      outputRawJson:
        src.outputRawJson === "true" ||
        src.output_raw_json === "true" ||
        src.outputRawJson === true
    };

    // Validate required field
    if (!options.refundId) {
      return res.status(400).json({
        error: "missing_refund_id",
        message: "refundId is required"
      });
    }

    const result = await testRefundIDCheck(options);

    // If raw JSON requested and success → return raw
    if (result.rawResponse && result.success && result.outputRawJson) {
      return res.json(result.rawResponse);
    }

    // Return normalized response
    if (result.error) {
      return res.status(result.httpStatus || 500).json(result);
    }

    return res.json(result);
  } catch (err) {
    if (err.error) {
      return res.status(err.httpStatus || 500).json(err);
    }

    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Unknown server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// Register both GET and POST
app.get("/pawapay/refund-id-check", refundIdCheckHandler);
app.post("/pawapay/refund-id-check", refundIdCheckHandler);

// ========== END NEW API ROUTE - /pawapay/refund-id-check ==========

// ========== ADD NEW API ROUTE - /pawapay/payout-id-check ==========


/**
 * Unified GET/POST handler for /pawapay/payout-id-check
 *
 * - GET: ?environment=sandbox&apiVersion=v1&payoutId=...&outputRawJson=true
 * - POST: JSON body with same fields
 * - On 200 + outputRawJson=true → returns raw API JSON
 * - Otherwise returns normalized wrapper
 */
async function payoutIdCheckHandler(req, res) {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./direct/testPayoutsIDCheck");
    delete require.cache[modulePath];
    const testPayoutsIDCheck = require("./direct/testPayoutsIDCheck");
    // ---------------------------------

    // Merge query params and body to allow flexibility
    const src = Object.assign({}, req.query || {}, req.body || {});

    const options = {
      environment: src.environment || src.env || "sandbox",
      apiVersion: src.apiVersion || "v1",
      // Map common variations of the ID key
      payoutId: src.payoutId || src.id || src.payout_id,
      outputRawJson:
        src.outputRawJson === "true" ||
        src.output_raw_json === "true" ||
        src.outputRawJson === true
    };

    // Validate required field
    if (!options.payoutId) {
      return res.status(400).json({
        error: "missing_payout_id",
        message: "payoutId is required"
      });
    }

    // Call the controller
    const result = await testPayoutsIDCheck(options);

    // Logic: If raw JSON requested and success → return raw response body directly
    if (result.rawResponse && result.success && options.outputRawJson) {
      return res.json(result.rawResponse);
    }

    // Logic: Handle functional errors returned by the controller
    if (result.error) {
      return res.status(result.httpStatus || 500).json(result);
    }

    // Default: Return the normalized wrapper object
    return res.json(result);

  } catch (err) {
    // Handle unexpected throws (transport errors, etc.)
    if (err.error) {
      return res.status(err.httpStatus || 500).json(err);
    }

    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Unknown server error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// Register both GET and POST
app.get("/pawapay/payout-id-check", payoutIdCheckHandler);
app.post("/pawapay/payout-id-check", payoutIdCheckHandler);

// ========== END NEW API ROUTE - /pawapay/payout-id-check ==========


// ============================================================
// 8. [NEW] Refund Page Route (UI)
// ============================================================

app.get("/refund", async (_req, res) => {
  await renderWithVite(res, "refund", {
    title: "Initiate Refund - PawaPay SDK",
    description: "Refund a transaction using PawaPay Node SDK.",
    catalog: getMergedCatalog()
  });
});

/**
 * Helper to parse Metadata from x-www-form-urlencoded (Form Data)
 * Ensures single values are converted to arrays for consistent processing
 */
function parseFormMetadata(body) {
  if (!body) return [];

  // Ensure we have arrays even if only one field is sent
  // (Express body-parser treats single inputs as strings, multiple as arrays)
  const names = [].concat(body["metadataFieldName[]"] || []);
  const values = [].concat(body["metadataFieldValue[]"] || []);
  const piiFlags = [].concat(body["metadataIsPII[]"] || []);

  const metadata = [];

  names.forEach((name, index) => {
    if (!name || !values[index]) return;

    // Note: Handling PII via FormData checkboxes is tricky because unchecked
    // boxes aren't sent. For this demo, we assume PII is false unless
    // strictly handled, or you can implement specific mapping logic here.
    // For now, we construct the basic object:
    const item = {
      fieldName: name,
      fieldValue: values[index]
    };

    if (piiFlags.length > 0) {
      // Simple check: if this specific field looks like PII (optional logic)
    }

    metadata.push(item);
  });

  return metadata;
}

// 8b. [NEW] Handle the POST from the Refund UI
// Matches the EJS call: fetch("/process-refund", { method: "POST" ... })
// Import the new Refund Processor
app.post("/process-refund", async (req, res) => {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./processRefund");
    delete require.cache[modulePath];
    const processRefund = require("./processRefund");
    // ---------------------------------

    // 1. Construct parameters for the new processRefund module
    const params = {
      depositId: req.body.depositId,
      amount: req.body.amount,
      environment: req.body.environment,
      apiVersion: req.body.apiVersion,
      // Parse the separate array fields into the object structure processRefund expects
      metadata: parseFormMetadata(req.body)
    };

    // 2. Call your new processor
    const result = await processRefund(params);

    // 3. Return JSON response to the frontend
    res.json(result);

  } catch (err) {
    console.error("Refund UI Error:", err);
    res.status(500).json({
      success: false,
      errorMessage: err.message || "Internal Server Error processing refund."
    });
  }
});


// ============================================================
// [NEW] MNO Configuration Report
// Logic: fetchMnoConf.js | View: views/mno_report.ejs
// path: http://localhost:4000/save-config
// ============================================================

app.get("/save-config", async (req, res) => {
  try {
    // --- MAGICAL FIX: FRESH RELOAD ---
    const modulePath = require.resolve("./fetchMnoConf");
    delete require.cache[modulePath];
    const fetchAndProcessMnoConf = require("./fetchMnoConf");
    // ---------------------------------

    console.log("[MNO Report] Generating report...");

    // 1. Call the logic engine (fetch, save JSON, normalize)
    const data = await fetchAndProcessMnoConf();

    // 2. Render the standalone template
    // Note: We use standard res.render here because mno_report.ejs is a
    // full HTML document with its own CSS/Head, not a partial.
    res.render("mno_report", {
      environment: data.environment,
      apiVersion: data.apiVersion,
      availability: data.availability,
      activeConfLookup: data.activeConfLookup,
      companyName: data.activeConfLookup._companyName,
      merchantName: data.activeConfLookup._merchantName
    });

  } catch (err) {
    console.error("MNO Report Error:", err);
    res.status(500).send(`
      <div style="font-family:sans-serif; padding:20px; color:#721c24; background:#f8d7da;">
        <h2>Error Generating MNO Report</h2>
        <pre>${err.message}</pre>
        <p>Check server console for details.</p>
      </div>
    `);
  }
});



// =============================================================================
// 📋 AVAILABLE ROUTES & ENDPOINTS SUMMARY
// =============================================================================
//
// 🏠 PAGES (EJS Templates):
// -------------------------
// GET  /                 → Homepage with SDK overview
// GET  /deposit          → Deposit initiation page with operator catalog
// GET  /withdraw         → Withdrawal page with operator catalog
//
// 🔄 MOCK PAYMENT FLOW:
// ---------------------
// POST /deposit/initiate → Mock payment initiation (returns transaction ID)
//
// 🔧 PAWAPAY CONFIGURATION API:
// -----------------------------
// GET  /pawapay/config   → Fetch PawaPay configuration with query params:
//     ?env= sandbox|production    (environment)
//     ?apiVersion= v1|v2          (API version)
//     ?endpoint= active-conf|availability (endpoint type)
//     ?country= UGA|KEN|GHA etc.  (country code)
//     ?operationType= deposit|withdraw
//
// 💳 PAYMENT SESSION API (Unified GET/POST):
// ------------------------------------------
// GET  /pawapay/create-session  → Create payment session via query params
// POST /pawapay/create-session  → Create payment session via JSON body
//     Parameters (body or query):
//     - environment: sandbox|production
//     - apiVersion: v1 (default) v1|v2
//     - amount: transaction amount (string)
//     - currency: UGX|KES|GHS etc.
//     - msisdn: customer phone number
//     - country: 3-letter country code
//     - customerMessage: statement description
//     - returnUrl: callback URL after payment
//     - reason: payment reason
//     - language: EN (default)
//     - metadata: custom metadata array
//
// 📊 DEVELOPMENT & DEBUG ENDPOINTS:
// ---------------------------------
// GET  /pawapay/create-session/latest → Get last 10 created sessions (in-memory cache)
//
// 📁 STATIC ASSETS:
// -----------------
// GET  /public/* → Static files (CSS, JS, images) - production only
//     Vite dev server handles assets in development with hot reload
//
// 🔧 SERVER FEATURES:
// -------------------
// - Port conflict handling (auto-finds available port starting from 4000)
// - Vite integration for development with HMR
// - LiveReload fallback when Vite unavailable
// - EJS templating with partials (header, nav, footer)
// - Dynamic operator catalog merged from JSON files
// - In-memory session cache for development debugging
// =============================================================================


// debug - print registered GET routes
console.log("Registered routes:");
app._router.stack.forEach((layer) => {
  if (layer.route && layer.route.path) {
    const methods = Object.keys(layer.route.methods).join(",");
    console.log(`${methods.toUpperCase().padEnd(6)} ${layer.route.path}`);
  }
});

// 9. Start server with port conflict handling and Vite integration
const startServer = async () => {
  try {
    // Setup Vite middleware first
    await setupViteMiddleware();

    const availablePort = await findAvailablePort(DEFAULT_PORT);

    app.listen(availablePort, () => {
      console.log(`🚀 Server running on http://localhost:${availablePort}`);
      console.log(
        `Preferred port was ${DEFAULT_PORT}, using port ${availablePort}`
      );
      if (vite) {
        console.log(" Vite dev server integrated with hot reload");
      } else {
        console.log(
          "ℹ️  Running without Vite (production mode or Vite not available)"
        );
      }

      // Log the new API endpoint
      console.log(
        `📡 API endpoint available at: http://localhost:${availablePort}/pawapay/config`
      );
      console.log(
        `📡 Latest sessions endpoint: http://localhost:${availablePort}/pawapay/create-session/latest`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();