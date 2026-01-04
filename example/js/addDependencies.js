/* example/js/addDependencies.js */
/* eslint-env browser */

/**
 * addDependencies.js - Vite / ESM version
 */

// Import dependencies using import maps
import * as bootstrap from "bootstrap";
import * as libphonenumber from "libphonenumber-js";

// Make both available globally for wizard.js
window.bootstrap = bootstrap;
window.libphonenumber = libphonenumber;

// Dynamic import must reference the module in the Vite-served tree (not /public folder)
// Use dynamic import with parentheses, which returns a Promise
import("./wizard.js")
  .then((module) => {
    if (module && typeof module.init === "function") {
      module.init();
    }
    console.log("wizard module loaded by addDependencies.js");
  })
  .catch((err) => {
    console.error("Failed to load ./wizard.js:", err);
  });

document.addEventListener("DOMContentLoaded", () => {
  console.log("Deposit page: DOM ready (Vite ESM path).");

  // Read embedded JSON from server-rendered template if present
  try {
    const catalogEl = document.getElementById("country-catalog-data");
    if (catalogEl) {
      window.CATALOG = JSON.parse(catalogEl.textContent || "{}");
    }
  } catch (err) {
    console.warn("Failed parsing embedded catalog JSON:", err);
  }

  // Any deposit-specific boot logic here
});