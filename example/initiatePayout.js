/**
 * Process Payouts - Batch payout logic (Disbursements)
 *
 * This handler:
 * 1. Accepts a list of recipients
 * 2. Auto-routes between v1 and v2 logic per recipient
 * 3. Maps fields (provider <-> correspondent) surgically
 * 4. Checks status after initiation
 * 5. Returns a summary report
 */

const path = require("path");
const winston = require("winston");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ApiClient = require("../src/api/ApiClient");
const Helpers = require("../src/utils/helpers");

// ========== LOGGING SETUP (Matches initiateDeposit.js) ==========
const logsDir = path.resolve(__dirname, "../logs");

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "payment_success.log"),
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "payment_failed.log"),
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}
// ========== END LOGGING SETUP ==========

// ========== COUNTRY MAPPING ==========
const COUNTRY_TO_ISO3 = {
  "Algeria": "DZA", "Angola": "AGO", "Benin": "BEN", "Botswana": "BWA",
  "Burkina Faso": "BFA", "Burundi": "BDI", "Cabo Verde": "CPV", "Cameroon": "CMR",
  "Central African Republic": "CAF", "Chad": "TCD", "Comoros": "COM", "Congo": "COG",
  "Congo (DRC)": "COD", "Cote D'Ivoire": "CIV", "Djibouti": "DJI", "Egypt": "EGY",
  "Equatorial Guinea": "GNQ", "Eritrea": "ERI", "Eswatini": "SWZ", "Ethiopia": "ETH",
  "Gabon": "GAB", "Gambia": "GMB", "Ghana": "GHA", "Guinea": "GIN",
  "Guinea-Bissau": "GNB", "Kenya": "KEN", "Lesotho": "LSO", "Liberia": "LBR",
  "Libya": "LBY", "Madagascar": "MDG", "Malawi": "MWI", "Mali": "MLI",
  "Mauritania": "MRT", "Mauritius": "MUS", "Morocco": "MAR", "Mozambique": "MOZ",
  "Namibia": "NAM", "Niger": "NER", "Nigeria": "NGA", "Rwanda": "RWA",
  "Sao Tome and Principe": "STP", "Senegal": "SEN", "Seychelles": "SYC",
  "Sierra Leone": "SLE", "Somalia": "SOM", "South Africa": "ZAF", "South Sudan": "SSD",
  "Sudan": "SDN", "Tanzania": "TZA", "Togo": "TGO", "Tunisia": "TUN",
  "Uganda": "UGA", "Zambia": "ZMB", "Zimbabwe": "ZWE"
};

const getCountryIso3 = (name) => {
  if (!name) return null;
  const cleaned = name.trim();
  return COUNTRY_TO_ISO3[cleaned] || cleaned.toUpperCase();
};

/**
 * Main Payout Processor
 * * @param {Object} data - The raw request body (containing recipients array)
 * @returns {Promise<Object>} Summary object
 */
async function initiatePayout(data) {
  if (!data) {
    return { success: false, message: "No data received." };
  }

  // 1. Config & Environment
  const environment = process.env.ENVIRONMENT || "sandbox";
  const apiTokenKey = `PAWAPAY_${environment.toUpperCase()}_API_TOKEN`;
  const apiToken = process.env[apiTokenKey];
  const licenseKey = process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY;

  if (!apiToken) throw new Error(`API token not found for ${environment}`);
  if (!licenseKey) throw new Error("SDK License key not found");

  const sslVerify = environment === "production";
  const defaultApiVersion = (process.env.PAWAPAY_API_VERSION || "v1").toLowerCase();

  // Root level override
  const requestApiVersion = (data.apiVersion || defaultApiVersion).toLowerCase();

  const recipientsData = data.recipients || [];
  const responses = [];
  
  logger.info(`Starting batch payout for ${recipientsData.length} recipients`, { environment, defaultApiVersion });

  // 2. Iterate Recipients
  for (const recipientData of recipientsData) {
    const responseItem = {
      recipientMsisdn: recipientData.recipientMsisdn || null,
      success: false,
      details: "",
      error: null
    };

    try {
      // Determine effective version for this specific recipient
      let effectiveVersion = (recipientData.apiVersion || requestApiVersion).toLowerCase();
      if (!["v1", "v2"].includes(effectiveVersion)) effectiveVersion = "v1";

      // Initialize Client (We do this inside loop because ApiClient routes based on config.apiVersion)
      const client = new ApiClient({
        apiToken,
        environment,
        sslVerify,
        apiVersion: effectiveVersion,
        licenseKey
      });

      // --- 3. Build Recipient Object (Surgical Adaptation) ---

      const recipient = {
        payoutId: Helpers.generateUniqueId(),
        amount: recipientData.amount,
        currency: recipientData.currency,
        recipientMsisdn: recipientData.recipientMsisdn,
        countryIso3: recipientData.country ? getCountryIso3(recipientData.country) : null,
        // Fields to be mapped:
        provider: null,
        correspondent: null,
        customerMessage: null,
        statementDescription: null
      };

      // Validation Regex
      const amountRegex = /^\d+(\.\d{1,2})?$/;
      const descRegex = /^[A-Za-z0-9 ]{1,22}$/;

      // Validate basics
      if (!recipient.amount || !recipient.currency || !recipient.recipientMsisdn) {
        throw new Error("Missing required fields: amount, currency or recipientMsisdn");
      }
      if (!amountRegex.test(recipient.amount)) {
        throw new Error("Invalid amount format");
      }

      // --- Shape Adaptation Logic ---
      if (effectiveVersion === "v2") {
        // v2 requires 'provider' and 'customerMessage'
        recipient.provider = recipientData.provider
                    || recipientData.correspondent; // map v1 -> v2

        recipient.customerMessage = recipientData.customerMessage
                    || recipientData.statementDescription; // map v1 -> v2

        if (!recipient.provider) throw new Error("Missing required field for v2: provider");

        // Validate description if present
        if (recipient.customerMessage && !descRegex.test(recipient.customerMessage)) {
          throw new Error("Invalid customerMessage format");
        }
      } else {
        // v1 requires 'correspondent' and 'statementDescription'
        recipient.correspondent = recipientData.correspondent
                    || recipientData.provider; // map v2 -> v1

        recipient.statementDescription = recipientData.statementDescription
                    || recipientData.customerMessage
                    || "Payout to customer";

        if (!recipient.correspondent || !recipient.statementDescription) {
          throw new Error("Missing required fields for v1: correspondent/statementDescription");
        }
        if (!descRegex.test(recipient.statementDescription)) {
          throw new Error("Invalid statementDescription format");
        }
      }

      // Metadata normalization
      const metadata = recipientData.metadata || [];

      // Build arguments for ApiClient
      const args = {
        payoutId: recipient.payoutId,
        amount: recipient.amount,
        currency: recipient.currency,
        recipientMsisdn: recipient.recipientMsisdn,
        metadata: metadata
      };

      if (effectiveVersion === "v2") {
        args.provider = recipient.provider;
        if (recipient.customerMessage) args.customerMessage = recipient.customerMessage;
      } else {
        args.correspondent = recipient.correspondent;
        args.statementDescription = recipient.statementDescription;
      }

      // --- 4. Initiate Payout ---
      // client.initiatePayoutAuto uses 'this.apiVersion' which we set in constructor above
      const initiateResponse = await client.initiatePayoutAuto(args);

      if (initiateResponse.status !== 200) {
        // Handle immediate rejection
        const failMsg = initiateResponse.response?.failureReason?.failureMessage || "Initiation failed";
        throw new Error(failMsg);
      }

      // Short delay (Sleep 2s) to allow system propagation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // --- 5. Check Status ---
      const statusResponse = await client.checkTransactionStatusAuto(recipient.payoutId, "payout");

      // --- 6. Normalize Response (Surgical) ---
      // Flattens v1 array vs v2 data object vs legacy shapes
      const body = statusResponse.response || {};
      let status = null;
      let failureReason = null;
      let flatData = {};

      if (body.data && typeof body.data === "object") {
        // v2 shape: { status: "FOUND", data: { status: "COMPLETED", ... } }
        flatData = body.data;
        status = flatData.status;
        failureReason = flatData.failureReason?.failureMessage
                    || body.failureReason?.failureMessage;
      } else if (Array.isArray(body) && body[0]) {
        // legacy v1 array
        flatData = body[0];
        status = flatData.status;
        failureReason = flatData.failureReason?.failureMessage;
      } else if (body.status) {
        // standard v1 object
        flatData = body;
        status = body.status;
        failureReason = body.failureReason?.failureMessage;
      }

      // Construct Result
      if (statusResponse.status === 200 && status === "COMPLETED") {
        responseItem.success = true;
        responseItem.status = status;
        responseItem.payoutId = flatData.payoutId || recipient.payoutId;
        responseItem.amount = flatData.amount || recipient.amount;
        responseItem.currency = flatData.currency || recipient.currency;
        responseItem.details = `Payout of ${recipient.amount} ${recipient.currency} to ${recipient.recipientMsisdn} completed successfully. ID: ${recipient.payoutId}`; // to add the current version ->[v=${effectiveVersion}]
        responseItem.response = body;

        logger.info("Payout completed successfully", {
          version: effectiveVersion,
          payoutId: recipient.payoutId
        });
      } else {
        failureReason = failureReason || "Unknown error or Pending";
        responseItem.success = false;
        responseItem.status = status;
        responseItem.payoutId = flatData.payoutId || recipient.payoutId;
        responseItem.amount = flatData.amount || recipient.amount;
        responseItem.currency = flatData.currency || recipient.currency;
        responseItem.details = `Payout failed or pending. ID: ${recipient.payoutId}. Reason: ${failureReason} [v=${effectiveVersion}]`;
        responseItem.error = failureReason;
        responseItem.response = body;

        logger.error("Payout failed or not completed", {
          version: effectiveVersion,
          payoutId: recipient.payoutId,
          error: failureReason
        });
      }

    } catch (e) {
      // Catch-all for this specific recipient so the loop continues
      responseItem.success = false;
      responseItem.details = `Payout processing error: ${e.message}`;
      responseItem.error = e.message;

      logger.error("Payout processing error", {
        recipientMsisdn: recipientData.recipientMsisdn,
        error: e.message
      });
    }

    responses.push(responseItem);
  }

  // Calculate summary
  const successfulCount = responses.filter(r => r.success).length;
  const failedCount = responses.length - successfulCount;

  return {
    success: failedCount === 0,
    message: `Payout processing completed. ${successfulCount} successful and ${failedCount} failed.`,
    responses: responses,
    total_recipients: recipientsData.length
  };
}

module.exports = initiatePayout;