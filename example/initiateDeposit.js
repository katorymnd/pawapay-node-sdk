/**
 * Process Deposit -  deposit logic for wizard UI
 *
 * This handler:
 * 1. Validates incoming payment data
 * 2. Initiates deposit via PawaPay API (version-aware)
 * 3. Checks transaction status
 * 4. Returns appropriate response based on status
 */

const path = require("path");
const winston = require("winston");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ApiClient = require("../src/api/ApiClient");
const FailureCodeHelper = require("../src/utils/FailureCodeHelper");
const Helpers = require("../src/utils/helpers");

// ========== LOGGING SETUP ==========
const logsDir = path.resolve(__dirname, "../logs");

// Create winston logger with two transports (success and error)
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Success log - Info level
    new winston.transports.File({
      filename: path.join(logsDir, "payment_success.log"),
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Error log - Error level
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

// Also log to console in development
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

/**
 * Validate and process deposit payment
 *
 * @param {Object} params - Payment parameters
 * @param {string} params.amount - Payment amount
 * @param {string} params.mno - Mobile network operator (correspondent/provider)
 * @param {string} params.payerMsisdn - Payer's phone number (digits only)
 * @param {string} params.description - Statement description
 * @param {string} params.currency - Currency code
 * @param {string} params.environment - 'sandbox' or 'production'
 * @param {string} params.apiVersion - 'v1' or 'v2'
 * @param {Array} params.metadata - Optional metadata array
 *
 * @returns {Promise<Object>} Response object with success status and details
 */
async function initiateDeposit(params) {
  // Extract parameters with defaults
  const {
    amount,
    mno,
    payerMsisdn,
    description,
    currency,
    environment = "sandbox", //change `production/sandbox`
    apiVersion = "v1",// change V1/V2
    metadata = []
  } = params;

  // Validate required fields
  if (!amount || !mno || !payerMsisdn || !description || !currency) {
    logger.error("Validation failed - Missing required fields", {
      missingFields: {
        amount: !amount,
        mno: !mno,
        payerMsisdn: !payerMsisdn,
        description: !description,
        currency: !currency
      }
    });

    return {
      success: false,
      errorMessage: "Missing required fields.",
      missingFields: {
        amount: !amount,
        mno: !mno,
        payerMsisdn: !payerMsisdn,
        description: !description,
        currency: !currency
      }
    };
  }

  // Validate amount format (positive number with max 2 decimals)
  const amountRegex = /^\d+(\.\d{1,2})?$/;
  if (!amountRegex.test(amount) || parseFloat(amount) <= 0) {
    logger.error("Validation failed - Invalid amount format", {
      amount,
      currency
    });

    return {
      success: false,
      errorMessage:
        "Invalid amount. Must be a positive number with max 2 decimal places."
    };
  }

  // Validate description (letters, numbers, spaces only, max 22 chars)
  const descriptionRegex = /^[A-Za-z0-9 ]{1,22}$/;
  if (!descriptionRegex.test(description)) {
    logger.error("Validation failed - Invalid description format", {
      description
    });

    return {
      success: false,
      errorMessage:
        "Invalid description. Only letters, numbers and spaces allowed (max 22 characters)."
    };
  }

  // Get API token from environment
  const apiTokenKey = `PAWAPAY_${environment.toUpperCase()}_API_TOKEN`;
  const apiToken = process.env[apiTokenKey];

  if (!apiToken) {
    logger.error("API token not found", {
      apiTokenKey,
      environment
    });

    return {
      success: false,
      errorMessage: `API token not found for ${environment} environment.`
    };
  }

  // Get license key
  const licenseKey = process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY;
  if (!licenseKey) {
    logger.error("License key not found in environment");

    return {
      success: false,
      errorMessage: "SDK license key not configured."
    };
  }

  // SSL verification (production only)
  const sslVerify = environment === "production";

  // Generate unique deposit ID
  const depositId = Helpers.generateUniqueId();

  logger.info("Initiating deposit", {
    depositId,
    amount,
    currency,
    mno,
    environment,
    apiVersion
  });

  try {
    // With global safe mode enabled at SDK level, we don't need to flip protection here.
    // Initialize API client
    const client = new ApiClient({
      apiToken,
      environment,
      sslVerify,
      apiVersion,
      licenseKey
    });

    // Initiate deposit (version-aware)
    let initiateResponse;

    if (apiVersion === "v2") {
      // V2: uses provider + MMO structure, description → customerMessage
      initiateResponse = await client.initiateDepositV2(
        depositId,
        amount,
        currency,
        payerMsisdn,
        mno, // provider
        description, // customerMessage
        null, // clientReferenceId (optional)
        null, // preAuthorisationCode (optional)
        metadata
      );
    } else {
      // V1: uses correspondent + MSISDN structure, description → statementDescription
      initiateResponse = await client.initiateDeposit(
        depositId,
        amount,
        currency,
        mno, // correspondent
        payerMsisdn,
        description, // statementDescription
        metadata
      );
    }

    // Check if initiation was rejected
    if (initiateResponse.status !== 200) {
      let errorMessage = "Payment initiation failed.";

      // Try to extract rejection reason
      if (initiateResponse.response?.rejectionReason?.rejectionMessage) {
        errorMessage = `Payment initiation failed: ${initiateResponse.response.rejectionReason.rejectionMessage}`;
      } else if (initiateResponse.response?.failureReason?.failureCode) {
        const failureCode = initiateResponse.response.failureReason.failureCode;
        const failureMessage = FailureCodeHelper.getFailureMessage(failureCode);
        errorMessage = `Payment initiation failed: ${failureMessage}`;
      }

      logger.error("Deposit initiation failed", {
        depositId,
        status: initiateResponse.status,
        response: initiateResponse.response,
        errorMessage
      });

      return {
        success: false,
        errorMessage,
        depositId,
        version: apiVersion,
        statusCode: initiateResponse.status
      };
    }

    logger.info("Deposit initiated successfully, checking status", {
      depositId,
      status: initiateResponse.status
    });

    // Check transaction status (version-aware)
    const statusResponse = await client.checkTransactionStatusAuto(
      depositId,
      "deposit"
    );

    if (statusResponse.status !== 200) {
      logger.error("Failed to retrieve deposit status", {
        depositId,
        status: statusResponse.status,
        response: statusResponse.response
      });

      return {
        success: false,
        errorMessage: "Unable to retrieve deposit status.",
        depositId,
        version: apiVersion,
        statusCode: statusResponse.status
      };
    }

    // Normalize v1/v2 response structures
    let depositInfo;
    let depositStatus;

    if (apiVersion === "v2") {
      // V2 structure: { status: "FOUND"|"NOT_FOUND", data: {...} }
      if (statusResponse.response?.status !== "FOUND") {
        logger.info("Deposit not yet found (v2) - processing", {
          depositId,
          response: statusResponse.response
        });

        return {
          success: false,
          errorMessage:
            "Payment is processing. Please wait and check your account.",
          depositId,
          status: "PROCESSING",
          version: apiVersion
        };
      }

      depositInfo = statusResponse.response.data;
      depositStatus = depositInfo?.status || "PROCESSING";
    } else {
      // V1 structure: array with one deposit object
      depositInfo = statusResponse.response?.[0] || {};
      depositStatus = depositInfo?.status || "PROCESSING";
    }

    // Handle final status
    if (depositStatus === "COMPLETED") {
      logger.info("Deposit completed successfully", {
        depositId,
        amount,
        currency,
        mno,
        response: depositInfo
      });

      return {
        success: true,
        transactionId: depositId,
        message: "Payment processed successfully.",
        version: apiVersion,
        depositInfo
      };
    }

    if (depositStatus === "FAILED") {
      const failureCode =
        depositInfo?.failureReason?.failureCode || "OTHER_ERROR";
      const failureMessage = FailureCodeHelper.getFailureMessage(failureCode);

      logger.error("Deposit failed", {
        depositId,
        amount,
        currency,
        mno,
        failureCode,
        failureMessage,
        response: depositInfo
      });

      return {
        success: false,
        errorMessage: `Payment failed: ${failureMessage}`,
        depositId,
        status: depositStatus,
        failureCode,
        version: apiVersion
      };
    }

    // Any other intermediate state (SUBMITTED, ACCEPTED, etc.)
    logger.info(`Deposit in state: ${depositStatus}`, {
      depositId,
      status: depositStatus,
      response: depositInfo
    });

    return {
      success: false,
      errorMessage:
        "Payment is processing. Please wait and check your account.",
      depositId,
      status: depositStatus,
      version: apiVersion,
      depositInfo
    };
  } catch (error) {
    logger.error("Payment processing error", {
      depositId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      errorMessage: `Processing Error: ${error.message}`,
      depositId,
      version: apiVersion
    };
  }
}

module.exports = initiateDeposit;
