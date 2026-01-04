/**
 * Process Deposit via Payment Page
 */
const path = require("path");
const winston = require("winston");

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const ApiClient = require("../src/api/ApiClient");
const Helpers = require("../src/utils/helpers");

// ========== LOGGING SETUP ==========
const logsDir = path.resolve(__dirname, "../logs");
// [Keep your existing logger setup here]
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, "payment_page_success.log"), level: "info" }),
    new winston.transports.File({ filename: path.join(logsDir, "payment_page_failed.log"), level: "error" })
  ]
});
if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}
// ========== END LOGGING SETUP ==========

async function depositViaPaymentPage(params) {
  // Extract parameters with defaults
  const {
    amount,
    payerMsisdn,
    description,
    currency,
    country,
    returnUrl,
    reason,
    language = "EN",
    environment = "sandbox", // update  to production /sandbox
    apiVersion = "v1", // v1/v2
    metadata = []
  } = params;

  // 1. Validate required fields
  if (!amount || !payerMsisdn || !description || !currency || !returnUrl) {
    logger.error("Validation failed - Missing required fields");
    return { success: false, errorMessage: "Missing required fields." };
  }

  // 2. Get Keys
  const apiTokenKey = `PAWAPAY_${environment.toUpperCase()}_API_TOKEN`;
  const apiToken = process.env[apiTokenKey];
  const licenseKey = process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY;

  if (!apiToken) {
    logger.error("Missing API Token");
    return { success: false, errorMessage: "Server configuration error (Token)." };
  }

  // 3. Setup Client
  const sslVerify = environment === "production";
  const depositId = Helpers.generateUniqueId();
  const cleanMsisdn = payerMsisdn.toString().replace(/\D/g, "");

  try {
    const client = new ApiClient({
      apiToken,
      environment,
      sslVerify,
      apiVersion,
      licenseKey: licenseKey || "dev-license"
    });

    // 4. Construct Params - Identical to PHP structure
    const paymentPageParams = {
      depositId: depositId,
      returnUrl: returnUrl,
      
      // Common fields
      amount: String(amount),
      currency: currency,
      msisdn: cleanMsisdn, // Used by V1
      country: country,
      language: language,
      reason: reason || "Payment",
      
      // Metadata - will be cleaned by ApiClient if empty
      metadata: metadata,

      // Description mapping
      statementDescription: description, // Used by V1
      customerMessage: description // Used by V2
    };

    logger.info("Initiating Payment Page Session", { depositId, ...paymentPageParams });

    // 5. Call API
    const response = await client.createPaymentPageSessionAuto(paymentPageParams);

    // 6. Handle Response
    if (response.status === 200 || response.status === 201) {
      const redirectUrl = response.response?.redirectUrl || response.response?.url;

      if (redirectUrl) {
        logger.info("Payment Page session created successfully", { depositId, redirectUrl });
        return {
          success: true,
          depositId: depositId,
          redirectUrl: redirectUrl,
          version: apiVersion
        };
      }
    }

    // 7. Handle API Rejection (4xx/5xx returned as valid response object from our modified ApiClient)
    logger.error("Payment Page API Rejection", { 
      status: response.status, 
      response: response.response 
    });

    return {
      success: false,
      errorMessage: response.response?.message || "Failed to create payment session.",
      status: response.status,
      raw: response.response
    };

  } catch (error) {
    // 8. Handle Network/Code Errors
    logger.error("Payment Page processing exception", { error: error.message, stack: error.stack });
    return {
      success: false,
      errorMessage: error.message,
      depositId
    };
  }
}

module.exports = depositViaPaymentPage;