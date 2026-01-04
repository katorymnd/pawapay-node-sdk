/**
 * Process Refund (V1 or V2)
 */

const path = require("path");
const winston = require("winston");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ApiClient = require("../src/api/ApiClient");
const Helpers = require("../src/utils/helpers");

// ========== LOGGING SETUP ==========
const logsDir = path.resolve(__dirname, "../logs");

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "refund_success.log"),
      level: "info"
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "refund_failed.log"),
      level: "error"
    })
  ]
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}
// ========== END LOGGING SETUP ==========

/**
 * Main Refund Processor
 */
async function processRefund(params) {
  const {
    depositId,
    amount,
    currency,
    apiVersion = "v2",
    environment = "sandbox",
    metadata = []
  } = params;

  // Validate required fields
  if (!depositId || !amount) {
    logger.error("Validation failed - Missing depositId or amount");
    return { success: false, errorMessage: "Deposit ID and Amount are required." };
  }

  // Find Token
  const apiTokenKey = `PAWAPAY_${environment.toUpperCase()}_API_TOKEN`;
  const apiToken = process.env[apiTokenKey];
  const licenseKey = process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY;

  if (!apiToken) {
    logger.error("Missing API Token");
    return { success: false, errorMessage: "Server configuration error (Token)." };
  }

  // Prepare refund
  const sslVerify = environment === "production";
  const refundId = Helpers.generateUniqueId();

  // Metadata limit check
  if (metadata.length > 10) {
    return {
      success: false,
      errorMessage: "You cannot add more than 10 metadata fields."
    };
  }

  // V2 requires currency
  let refundCurrency = currency;
  if (apiVersion === "v2" && !refundCurrency) {
    refundCurrency = "UGX";
    logger.warn("V2 refund has no currency provided, defaulted to UGX");
  }

  // Build refund payload
  const refundParams = {
    refundId: refundId,
    depositId: depositId,
    amount: String(amount),
    metadata: metadata || []
  };

  if (apiVersion === "v2") {
    refundParams.currency = refundCurrency;
  }

  logger.info("Initiating refund request", { refundId, ...refundParams });

  try {
    const client = new ApiClient({
      apiToken,
      environment,
      sslVerify,
      apiVersion,
      licenseKey: licenseKey || "dev-license"
    });

    // 1. Initiate refund
    const initResponse = await client.initiateRefundAuto(refundParams);

    if (initResponse.status !== 200) {
      logger.error("Refund initiation failed", {
        status: initResponse.status,
        response: initResponse.response
      });

      return {
        success: false,
        refundId,
        errorMessage:
                    initResponse.response?.message ||
                    initResponse.response?.failureReason?.failureMessage ||
                    "Refund initiation failed.",
        raw: initResponse.response
      };
    }

    logger.info("Refund initiated successfully", {
      refundId,
      initResponse: initResponse.response
    });

    // 2. Fetch refund status
    let statusResponse = await client.checkTransactionStatusAuto(refundId, "refund");

    // Improvement: Handle V1 empty-body issue
    if (apiVersion === "v1" && statusResponse.status === 200) {
      const body = statusResponse.response;
      const empty =
                !body ||
                (Array.isArray(body) && body.length === 0) ||
                (typeof body === "object" && Object.keys(body).length === 0);

      if (empty) {
        logger.warn("V1 status returned empty body. Attempting explicit V1 call.");
        try {
          const explicitV1 = await client.checkTransactionStatus(refundId, "refund");
          if (explicitV1.response && Object.keys(explicitV1.response).length > 0) {
            statusResponse = explicitV1;
          }
        } catch (err) {
          // fallback silently
        }
      }
    }

    if (statusResponse.status === 200) {
      logger.info("Refund status retrieved successfully", {
        refundId,
        status: statusResponse.response
      });

      // === SURGICAL EDIT START ===
      const finalPayload = {
        success: true,
        refundId,
        version: apiVersion,
        // The empty array you saw in logs comes from here:
        refundStatus: statusResponse.response,
        // We ADD this so the frontend can see the 'ALREADY_REFUNDED' error:
        initiationData: initResponse.response
      };

      // Print exactly what we are sending back to the frontend/browser
      console.log("------- REFUND RESPONSE PAYLOAD -------");
      console.dir(finalPayload, { depth: null, colors: true });
      console.log("---------------------------------------");

      return finalPayload;
      // === SURGICAL EDIT END ===
    }

    logger.error("Failed to retrieve refund status", {
      refundId,
      status: statusResponse.status,
      response: statusResponse.response
    });

    return {
      success: true,
      refundId,
      version: apiVersion,
      message: "Refund initiated but status could not be retrieved.",
      statusResponse
    };
  } catch (error) {
    logger.error("Refund processing exception", {
      refundId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      refundId,
      errorMessage: error.message
    };
  }
}

module.exports = processRefund;