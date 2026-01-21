# pawaPay Node.js SDK

A professional, commercial Node.js SDK for integrating with the **pawaPay API**.
This SDK enables seamless payment processing with **mobile money deposits, refunds, payouts**, and **real-time transaction verification**, designed for production-grade systems.

> **Commercial Software**
> This SDK is a premium product. A valid license key is required to operate it in production environments.

> **Versioning Note**
> V1 is the default main codebase. V2 has been surgically integrated and can run alongside V1, selectable through configuration without breaking existing implementations.

---

## Folder Structure

```
example/
data/
src/
tests/
logs/
```

* **example**
  Contains live and demo samples for each major workflow, including deposits, refunds, payouts, and configuration fetching. Both frontend and backend usage patterns are demonstrated.

* **data**
  Stores generated and cached configuration files such as `mno_availability` and `active_conf` JSON files for both V1 and V2.
![configuration](https://katorymnd.com/tqc_images/pawapay-node-config.png)
* **src**
  Core SDK source code and internal architecture.

* **logs**
  Cotains logs files for  any  request - failed or successful.

* **tests**
  Automated test suites using Mocha or Jest, covering SDK logic and transaction workflows.

---

## Available Features

The pawaPay Node.js SDK provides a comprehensive, production-ready feature set with real-time validation at every stage.

### Mobile Money Deposit Request

![Mobile Money Deposit](https://katorymnd.com/tqc_images/pawapay-node-deposit.png)

Initiate deposit requests to mobile money accounts with built-in real-time transaction verification. Each deposit is validated immediately, ensuring accurate and current status reporting.

---

### Mobile Money Refund Request

![Mobile Money Refund](https://katorymnd.com/tqc_images/pawapay-node-refund.png)

Process refunds for completed deposits using the original `depositId`. Refund availability depends on your pawaPay merchant configuration, and all refund requests are verified in real time.

---

### Mobile Money Payout Request

![Mobile Money Payout](https://katorymnd.com/tqc_images/pawapay-node-payout.png)

Execute payouts to single or multiple recipients within one request. This feature is optimized for bulk payments and includes real-time payout status tracking.

---

### Real-Time Transaction Verification

All operations, deposits, refunds, and payouts, are verified in real time. This ensures reliable, up-to-date transaction states without polling delays or stale responses.

---

### Country-Specific Payment Configuration

The SDK dynamically fetches supported Mobile Network Operators (MNOs) based on the country associated with your merchant account. This prevents attempts against inactive or unsupported operators.

---

### Mobile Network Operator (MNO) Status Checks

Before initiating a transaction, the SDK verifies MNO availability in real time. This minimizes failed payments caused by inactive networks.

---

### Owner Name Notification

![Owner Name Notification](https://katorymnd.com/tqc_images/pay-request-from.png)

Supports displaying the organization or owner name in payment notifications, helping end users easily identify payment requests.

---

### Deposit via Hosted Payment Page
![Deposit via Hosted Payment Page](https://katorymnd.com/tqc_images/pawapay-node-payPage.png)
Use the hosted payment widget to collect payments through a secure redirect flow.

1. Your application creates a payment session.
2. pawaPay returns a `redirectUrl`.
3. The customer completes payment on the hosted page.
4. Upon success, the customer is redirected back to your application:

```
deposit-page-success?depositId=951e084a-005c-4976-ad4e-205ddedb914e
```

You may then activate services, store customer details, or trigger post-payment workflows as required.

---

### Sandbox and Live Environments

Easily switch between sandbox and production environments using environment variables. No code changes are required.

---

## Table of Contents

* [Overview](#overview)
* [Licensing & Pricing](#licensing--pricing)
* [Installation](#installation)
* [Configuration (.env)](#configuration-env)
* [Usage](#usage)

  * [Initializing the SDK(The brain)](#initializing-the-sdk)
  * [The SDK heart](#the-sdk-heart)
    * [Deposit Senario(MNO)](#deposit-senariomno)
    * [Deposit Senario (Hosted Page)](#deposit-senario-hosted-page)
    * [Payout Senario](#payout-senario)
    * [Refund Senario](#refund-senario)
    * [MNO Configuration & Version Switching](#mno-configuration--version-switching)

* [Support](#support)

---

## Overview

The pawaPay Node.js SDK integrates seamlessly with Node.js frameworks such as **Express**, **NestJS**, and **Fastify**.
It abstracts pawaPay’s payment APIs into a clean, predictable interface focused on correctness, security, and operational clarity.

---

## Licensing & Pricing

This is a **paid commercial SDK**.

* **License Model:** One-time payment
* **Validity:** Lifetime license
* **Scope:** One licensed domain per key

To purchase a license and obtain your credentials:

👉 **[https://katorymnd.com/pawapay-payment-sdk/nodejs](https://katorymnd.com/pawapay-payment-sdk/nodejs)**

You will receive:

* `KATORYMND_PAWAPAY_SDK_LICENSE_KEY`
* `PAWAPAY_SDK_LICENSE_SECRET`

---

## Installation

```bash
npm install @katorymnd/pawapay-node-sdk
# or
yarn add @katorymnd/pawapay-node-sdk
```

---

## Configuration (.env)

Create a `.env` file in your project root and configure both pawaPay API credentials and SDK licensing keys.

```bash
# ===============================
# pawaPay API Tokens
# ===============================

PAWAPAY_SANDBOX_API_TOKEN=your_sandbox_api_token_here
PAWAPAY_PRODUCTION_API_TOKEN=your_production_api_token_here

# ===============================
# Katorymnd pawaPay SDK Licensing
# ===============================

KATORYMND_PAWAPAY_SDK_LICENSE_KEY=your_sdk_license_key_here
PAWAPAY_SDK_LICENSE_DOMAIN=your-licensed-domain.com
PAWAPAY_SDK_LICENSE_SECRET=your_sdk_license_secret_here
```

---

## Usage

### Initializing the SDK

Ensure the licensed domain is present in your `.env` file:

```bash
PAWAPAY_SDK_LICENSE_DOMAIN=your-licensed-domain.com
```

On first initialization, the SDK securely binds:

* Your license key
* Your license secret
* Your domain

This binding is permanent for that license and prevents unauthorized reuse across domains.

---
### The SDK heart

At this stage i assume that the user has arleady purchased the premium packge and also installed the SDK to there work space.

You need to call the sdk (`@katorymnd/pawapay-node-sdk`) to your project so that you can use it for `deposit`,`hosted deposit`,`refund`,`payout`,`MNO Config` and also to confirm transactions.

Create a page `pawapayService.js` for example and add this code

```typescript
//pawapayService.js

const path = require('path');
const winston = require('winston');
require('dotenv').config(); 

// Load the SDK and destructure the public exports directly
// We use 'ApiClient' because that's the class name export
const { ApiClient, Helpers, FailureCodeHelper } = require('@katorymnd/pawapay-node-sdk');

// ========== LOGGING SETUP ==========
const logsDir = path.resolve(__dirname, '../logs');

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'payment_success.log'),
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'payment_failed.log'),
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}
// ========== END LOGGING SETUP ==========

class PawaPayService {
    /**
     * @param {Object} config - Optional configuration
     * @param {string} config.token - Custom API Token to override .env
     */
    constructor(config = {}) {
        // Prioritize ENV
        const activeToken = process.env.PAWAPAY_SANDBOX_API_TOKEN;

        // Debug log to confirm token is being used (masked)
        const maskedToken = activeToken ? `${activeToken.substring(0, 5)}...` : 'NONE';
        console.log(`[PawaPayService] Initializing with token: ${maskedToken}`);

        this.pawapay = new ApiClient({
            apiToken: activeToken,
            environment: 'sandbox', //production/sandbox
            licenseKey: process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY, //required
            sslVerify: false // true -> production
        });
    }
    /**
     * Deposit money to a mobile money account
     * @param {Object} depositData - Deposit details
     * @param {string} apiVersion - 'v1' or 'v2'
     */
    async deposit(depositData, apiVersion = 'v1') {
        // Use the Helper directly from the SDK
        const depositId = Helpers.generateUniqueId();

        try {
            const {
                amount,
                currency,
                mno,
                payerMsisdn,
                description,
                metadata = []
            } = depositData;

            // 1. STRICT VALIDATION
            if (!amount || !mno || !payerMsisdn || !description || !currency) {
                const missingMsg = 'Validation failed - Missing required fields';
                logger.error(missingMsg, depositData);
                return { success: false, error: missingMsg };
            }

            // Validate Amount
            const amountRegex = /^\d+(\.\d{1,2})?$/;
            if (!amountRegex.test(amount) || parseFloat(amount) <= 0) {
                const msg = 'Invalid amount. Must be positive with max 2 decimals.';
                logger.error(msg, { amount });
                return { success: false, error: msg };
            }

            // Validate Description
            const descriptionRegex = /^[A-Za-z0-9 ]{1,22}$/;
            if (!descriptionRegex.test(description)) {
                const msg = 'Invalid description. Max 22 chars, alphanumeric only.';
                logger.error(msg, { description });
                return { success: false, error: msg };
            }

            logger.info('Initiating deposit', {
                depositId,
                amount,
                currency,
                mno,
                apiVersion
            });

            // 2. PROCESS DEPOSIT
            let response;

            if (apiVersion === 'v2') {
                response = await this.pawapay.initiateDepositV2(
                    depositId,
                    amount,
                    currency,
                    payerMsisdn,
                    mno, // provider
                    description, // customerMessage
                    null, // clientReferenceId
                    null, // preAuthorisationCode
                    metadata
                );
            } else {
                response = await this.pawapay.initiateDeposit(
                    depositId,
                    amount,
                    currency,
                    mno, // correspondent
                    payerMsisdn,
                    description, // statementDescription
                    metadata
                );
            }

            // 3. HANDLE RESPONSE
            if (response.status === 200 || response.status === 201) {
                logger.info('Deposit initiated successfully', { depositId, status: response.status });

                const statusCheck = await this.checkTransactionStatus(depositId, apiVersion);

                return {
                    success: true,
                    depositId,
                    transactionId: depositId,
                    reference: depositId,
                    status: statusCheck.status || 'SUBMITTED',
                    message: 'Deposit initiated successfully',
                    rawResponse: response,
                    statusCheck: statusCheck
                };
            } else {
                // 4. HANDLE ERRORS
                let errorMessage = 'Deposit initiation failed';
                let failureCode = 'UNKNOWN';

                if (response.response?.rejectionReason?.rejectionMessage) {
                    errorMessage = response.response.rejectionReason.rejectionMessage;
                } else if (response.response?.failureReason?.failureCode) {
                    failureCode = response.response.failureReason.failureCode;
                    // Use the SDK's built-in error helper
                    errorMessage = FailureCodeHelper.getFailureMessage(failureCode);
                } else if (response.response?.message) {
                    errorMessage = response.response.message;
                }

                logger.error('Deposit initiation failed', {
                    depositId,
                    error: errorMessage,
                    failureCode,
                    response: response.response
                });

                return {
                    success: false,
                    error: errorMessage,
                    depositId,
                    statusCode: response.status,
                    rawResponse: response
                };
            }

        } catch (error) {
            logger.error('System Error during deposit', {
                depositId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message || 'Internal processing error',
                depositId
            };
        }
    }

  /**
     * Check Status of ANY transaction (Deposit, Payout, Refund)
     * @param {string} transactionId - The ID to check
     * @param {string} apiVersion - 'v1' or 'v2'
     * @param {string} type - 'deposit', 'payout', 'refund', 'remittance'
     */
    async checkTransactionStatus(transactionId, apiVersion = 'v1', type = 'deposit') {
        try {
            let response;
            
            // Pass the 'type' to the SDK so it hits the correct endpoint (e.g., /payouts vs /deposits)
            if (apiVersion === 'v2') {
                response = await this.pawapay.checkTransactionStatusV2(transactionId, type);
            } else {
                response = await this.pawapay.checkTransactionStatus(transactionId, type);
            }

            logger.info(`Checking ${type} status`, { transactionId, status: response.status });

            if (response.status === 200) {
                let data;
                let status;

                // Normalize V1 (Array/Object) vs V2 (Object wrapper)
                if (apiVersion === 'v2') {
                    if (response.response?.status !== 'FOUND') {
                        return {
                            success: true,
                            status: 'PROCESSING',
                            transactionId,
                            message: 'Transaction processing'
                        };
                    }
                    data = response.response.data;
                    status = data?.status || 'UNKNOWN';
                } else {
                    // V1 legacy can be array [ { ... } ] or object
                    const raw = response.response;
                    data = Array.isArray(raw) ? raw[0] : raw;
                    status = data?.status || 'UNKNOWN';
                }

                return {
                    success: true,
                    status: status,
                    transactionId: transactionId,
                    data: data,
                    rawResponse: response
                };
            } else {
                return {
                    success: false,
                    error: `Status check failed with code ${response.status}`,
                    statusCode: response.status
                };
            }
        } catch (error) {
            logger.error('Status check error', { error: error.message });
            return {
                success: false,
                error: error.message || 'Status check failed'
            };
        }
    }

    validateToken(token) {
        if (!token || token.trim() === '') return { isValid: false, error: 'Token is required' };
        return { isValid: true, type: 'JWT', message: 'Valid token format' };
    }

    /**
     * Create a Payment Page Session
     * @param {Object} pageData - Payment details
     * @param {string} apiVersion - 'v1' or 'v2'
     */
    async initiatePaymentPage(pageData, apiVersion = 'v1') {
        const depositId = Helpers.generateUniqueId();

        try {
            const {
                amount,
                currency,
                payerMsisdn,
                description,
                returnUrl,
                metadata = [],
                country = 'UGA', // Default to Uganda for testing
                reason = 'Payment'
            } = pageData;

            // 1. STRICT VALIDATION
            if (!amount || !description || !currency || !returnUrl) {
                const missingMsg = 'Validation failed - Missing required fields (returnUrl is mandatory)';
                logger.error(missingMsg, pageData);
                return { success: false, error: missingMsg };
            }

            logger.info('Initiating Payment Page', {
                depositId,
                amount,
                apiVersion
            });

            // 2. PREPARE PAYLOAD & CALL SDK
            let response;

            // Normalize phone (remove +)
            const cleanMsisdn = payerMsisdn ? payerMsisdn.replace(/\D/g, '') : null;

            if (apiVersion === 'v2') {
                // V2 Payload Construction
                const v2Params = {
                    depositId,
                    returnUrl,
                    customerMessage: description,
                    amountDetails: {
                        amount: String(amount),
                        currency: currency
                    },
                    phoneNumber: cleanMsisdn,
                    country,
                    reason,
                    metadata
                };
                response = await this.pawapay.createPaymentPageSessionV2(v2Params);
            } else {
                // V1 Payload Construction
                const v1Params = {
                    depositId,
                    returnUrl,
                    amount: String(amount),
                    currency,
                    msisdn: cleanMsisdn,
                    statementDescription: description,
                    country,
                    reason,
                    metadata
                };
                response = await this.pawapay.createPaymentPageSession(v1Params);
            }

            // 3. HANDLE RESPONSE
            // Note: API returns 200/201 for success
            if (response.status >= 200 && response.status < 300) {
                const redirectUrl = response.response?.redirectUrl || response.response?.url;

                logger.info('Payment Page created', { depositId, redirectUrl });

                return {
                    success: true,
                    depositId,
                    redirectUrl,
                    message: 'Session created successfully',
                    rawResponse: response
                };
            } else {
                // 4. HANDLE ERRORS
                const errorMsg = response.response?.message || 'Failed to create payment session';

                logger.error('Payment Page creation failed', {
                    depositId,
                    error: errorMsg,
                    response: response.response
                });

                return {
                    success: false,
                    error: errorMsg,
                    depositId,
                    statusCode: response.status
                };
            }

        } catch (error) {
            logger.error('System Error during payment page creation', {
                depositId,
                error: error.message,
                stack: error.stack
            });

            return {
                success: false,
                error: error.message || 'Internal processing error',
                depositId
            };
        }
    }


    /**
 * Payout money to a mobile money account (Disbursement)
 * @param {Object} payoutData - Payout details
 * @param {string} apiVersion - 'v1' or 'v2'
 */
    async payout(payoutData, apiVersion = 'v1') {
        const payoutId = Helpers.generateUniqueId();

        try {
            // 1. EXTRACT DATA WITH FALLBACKS
            let {
                amount,
                currency,
                mno,            // Logic might send this
                provider,       // V2 logic might send this
                correspondent,  // V1 logic might send this
                recipientMsisdn,
                description,    // Direct description
                statementDescription, // V1 alternative
                customerMessage, // V2 alternative
                reason,         // Another possible field
                metadata = []
            } = payoutData;

            // 🛠️ FIX: Normalize the operator code
            // If 'mno' is undefined, use 'provider' (V2) or 'correspondent' (V1)
            const resolvedMno = mno || provider || correspondent;

            // ============================================================
            //  Ensure 'description' is never missing
            // PawaPay API requires this field for both V1 and V2.
            // ============================================================
            const resolvedDescription = description
                || statementDescription
                || customerMessage
                || reason
                || 'Transaction Processing'; // Ultimate fallback

            // 2. STRICT VALIDATION & DEBUG LOGGING
            // We check specific fields to give a precise error message
            const missingFields = [];
            if (!amount) missingFields.push('amount');
            if (!resolvedMno) missingFields.push(`mno (looked for: mno, provider, correspondent)`);
            if (!recipientMsisdn) missingFields.push('recipientMsisdn');
            if (!resolvedDescription) missingFields.push('description');
            if (!currency) missingFields.push('currency');

            if (missingFields.length > 0) {
                const missingMsg = `Validation failed - Missing fields: [${missingFields.join(', ')}]`;

                // 🔍 DEBUG: Construct a detailed log entry for the error.log
                const debugPayload = {
                    ERROR_TYPE: 'PAYOUT_VALIDATION_ERROR',
                    PAYOUT_ID: payoutId,
                    API_VERSION: apiVersion,
                    MISSING: missingFields,
                    RESOLVED_MNO: resolvedMno || 'UNDEFINED (This is likely the issue)',
                    RESOLVED_DESCRIPTION: resolvedDescription || 'UNDEFINED',
                    RAW_RECEIVED: JSON.stringify(payoutData, null, 2) // Pretty print the full object
                };

                // Log to your system logger
                logger.error(missingMsg, debugPayload);

                // Return failure with details
                return {
                    success: false,
                    error: missingMsg,
                    debug: debugPayload // Return this so the frontend/controller can see it too
                };
            }

            // Assign the resolved values back to variables used in logic
            mno = resolvedMno;
            description = resolvedDescription; // CRITICAL: Update the description variable

            // Validate Amount Format
            const amountRegex = /^\d+(\.\d{1,2})?$/;
            if (!amountRegex.test(amount) || parseFloat(amount) <= 0) {
                const msg = 'Invalid amount. Must be positive with max 2 decimals.';
                logger.error(msg, { amount, payoutId });
                return { success: false, error: msg };
            }

            logger.info('Initiating payout', {
                payoutId,
                amount,
                currency,
                mno,
                description, // Log the resolved description
                apiVersion
            });

            // 3. PROCESS PAYOUT
            let response;

            if (apiVersion === 'v2') {
                // V2 Payout
                response = await this.pawapay.initiatePayoutV2(
                    payoutId,
                    amount,
                    currency,
                    recipientMsisdn,
                    mno, // provider
                    description, // customerMessage - using the resolved description
                    metadata
                );
            } else {
                // V1 Payout
                response = await this.pawapay.initiatePayout(
                    payoutId,
                    amount,
                    currency,
                    mno, // correspondent
                    recipientMsisdn, // recipient address
                    description, // statementDescription - using the resolved description
                    metadata
                );
            }

            // 4. HANDLE RESPONSE
            if (response.status === 200 || response.status === 201 || response.status === 202) {
                logger.info('Payout initiated successfully', {
                    payoutId,
                    status: response.status,
                    description // Log successful description
                });

                const statusCheck = await this.checkTransactionStatus(payoutId, apiVersion);

                return {
                    success: true,
                    payoutId,
                    transactionId: payoutId,
                    status: statusCheck.status || 'SUBMITTED',
                    message: 'Payout initiated successfully',
                    rawResponse: response,
                    statusCheck: statusCheck
                };
            } else {
                // 5. HANDLE ERRORS
                let errorMessage = 'Payout initiation failed';
                let failureCode = 'UNKNOWN';

                if (response.response?.rejectionReason?.rejectionMessage) {
                    errorMessage = response.response.rejectionReason.rejectionMessage;
                } else if (response.response?.failureReason?.failureCode) {
                    failureCode = response.response.failureReason.failureCode;
                    errorMessage = FailureCodeHelper.getFailureMessage(failureCode);
                } else if (response.response?.message) {
                    errorMessage = response.response.message;
                }

                logger.error('Payout initiation failed', {
                    payoutId,
                    error: errorMessage,
                    failureCode,
                    response: response.response,
                    description // Log description even on failure
                });

                return {
                    success: false,
                    error: errorMessage,
                    payoutId,
                    statusCode: response.status,
                    rawResponse: response
                };
            }

        } catch (error) {
            logger.error('System Error during payout', {
                payoutId,
                error: error.message,
                stack: error.stack,
                inputData: JSON.stringify(payoutData) // Log input on crash too
            });

            return {
                success: false,
                error: error.message || 'Internal processing error',
                payoutId
            };
        }
    }


    /**
   * Initiate a Refund (Partial or Full)
   * @param {Object} refundData - Refund details
   * @param {string} apiVersion - 'v1' or 'v2'
   */
  async refund(refundData, apiVersion = 'v1') {
    const refundId = Helpers.generateUniqueId();

    try {
      const {
        depositId,
        amount,
        currency, // Required for V2
        reason,
        metadata = []
      } = refundData;

      // 1. STRICT VALIDATION
      if (!depositId || !amount) {
        const missingMsg = 'Validation failed - Missing required fields (depositId, amount)';
        logger.error(missingMsg, refundData);
        return { success: false, error: missingMsg };
      }

      // V2 Specific Validation
      if (apiVersion === 'v2' && !currency) {
        const msg = 'Validation failed - V2 Refunds require a currency code';
        logger.error(msg, refundData);
        return { success: false, error: msg };
      }

      // Validate Amount
      const amountRegex = /^\d+(\.\d{1,2})?$/;
      if (!amountRegex.test(amount) || parseFloat(amount) <= 0) {
        const msg = 'Invalid amount. Must be positive with max 2 decimals.';
        logger.error(msg, { amount });
        return { success: false, error: msg };
      }

      logger.info('Initiating refund', {
        refundId,
        depositId,
        amount,
        currency,
        apiVersion
      });

      // 2. PROCESS REFUND
      let response;

      if (apiVersion === 'v2') {
        // V2 Refund
        response = await this.pawapay.initiateRefundV2(
          refundId,
          depositId,
          amount,
          currency,
          metadata
        );
      } else {
        // V1 Refund
        response = await this.pawapay.initiateRefund(
          refundId,
          depositId,
          amount,
          metadata
        );
      }

      // 3. HANDLE RESPONSE
      // Refunds typically return 200/201/202
      if (response.status >= 200 && response.status < 300) {
        logger.info('Refund initiated successfully', { refundId, status: response.status });

        // Check status immediately (passing 'refund' as type is critical)
        const statusCheck = await this.checkTransactionStatus(refundId, apiVersion, 'refund');

        return {
          success: true,
          refundId,
          transactionId: refundId,
          depositId: depositId,
          status: statusCheck.status || 'SUBMITTED',
          message: 'Refund initiated successfully',
          rawResponse: response,
          statusCheck: statusCheck
        };
      } else {
        // 4. HANDLE ERRORS
        let errorMessage = 'Refund initiation failed';
        let failureCode = 'UNKNOWN';

        if (response.response?.rejectionReason?.rejectionMessage) {
          errorMessage = response.response.rejectionReason.rejectionMessage;
        } else if (response.response?.failureReason?.failureCode) {
          failureCode = response.response.failureReason.failureCode;
          errorMessage = FailureCodeHelper.getFailureMessage(failureCode);
        } else if (response.response?.message) {
          errorMessage = response.response.message;
        }

        logger.error('Refund initiation failed', {
          refundId,
          depositId,
          error: errorMessage,
          failureCode,
          response: response.response
        });

        return {
          success: false,
          error: errorMessage,
          refundId,
          statusCode: response.status,
          rawResponse: response
        };
      }

    } catch (error) {
      logger.error('System Error during refund', {
        refundId,
        depositId: refundData.depositId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message || 'Internal processing error',
        refundId
      };
    }
    }
    
}

module.exports = PawaPayService;
```
what our `pawapayService.js` has is all what the SDK needs to make any process possible.

**Lets demostrate how to use the heart with examples**

---
### Deposit Senario(MNO)

```typescript
//test-deposit.js
const path = require('path');
// Ensure strict loading of the root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PawaPayService = require('./pawapayService');

/**
 * Run a full test of the PawaPay SDK integration (Deposits)
 */
async function testSDKConnection() {
    console.log('\n========================================');
    console.log('🧪 PAWAPAY SDK DEPOSIT TEST (With Status Check)');
    console.log('========================================\n');

    const service = new PawaPayService();

    // 1. Validate Token Format
    console.log('🔹 Step 1: Validating API Token...');
    const testToken = process.env.PAWAPAY_SANDBOX_API_TOKEN;
    const validation = service.validateToken(testToken);

    if (!validation.isValid) {
        console.error('❌ Token Validation Failed:', validation);
        return;
    }
    console.log('✅ Token looks valid:', validation.type);

    // Common Test Data (Uganda MTN Sandbox)
    const commonData = {
        amount: '1000',
        currency: 'UGX',
        mno: 'MTN_MOMO_UGA',
        payerMsisdn: '256783456789', // Valid Sandbox Payer
        description: 'SDK Integration Test'
    };

    // --- 2. Test V1 Deposit ---
    console.log('\n🔹 Step 2: Testing V1 Deposit...');
    try {
        const v1Result = await service.deposit({
            ...commonData,
            description: 'V1 Test Payment'
        }, 'v1');

        if (v1Result.success) {
            console.log('✅ V1 Initiation Success:', {
                depositId: v1Result.depositId,
                status: v1Result.status
            });

            // WAIT AND CHECK
            console.log('⏳ Waiting 5 seconds for V1 propagation...');
            await new Promise(r => setTimeout(r, 5000));

            console.log('🔍 Checking V1 Status...');
            const statusCheck = await service.checkTransactionStatus(
                v1Result.depositId,
                'v1',
                'deposit'
            );

            console.log(`📊 Final V1 Status: [ ${statusCheck.status} ]`);
            if (statusCheck.status === 'FAILED') {
                console.warn(`   Reason: ${statusCheck.data?.failureReason?.failureMessage || 'Unknown'}`);
            }

        } else {
            console.error('❌ V1 Failed:', v1Result.error);
        }
    } catch (error) {
        console.error('❌ V1 Exception:', error.message);
    }

    // --- 3. Test V2 Deposit ---
    console.log('\n🔹 Step 3: Testing V2 Deposit...');
    try {
        const v2Result = await service.deposit({
            ...commonData,
            description: 'V2 Test Payment',
            metadata: [
                { orderId: "ORD-SDK-TEST" },
                { customerId: "test-user@example.com", isPII: true }
            ]
        }, 'v2');

        if (v2Result.success) {
            console.log('✅ V2 Initiation Success:', {
                depositId: v2Result.depositId,
                status: v2Result.status
            });

            // WAIT AND CHECK
            console.log('⏳ Waiting 5 seconds for V2 propagation...');
            await new Promise(r => setTimeout(r, 5000));

            console.log('🔍 Checking V2 Status...');
            const statusCheck = await service.checkTransactionStatus(
                v2Result.depositId,
                'v2',
                'deposit'
            );

            console.log(`📊 Final V2 Status: [ ${statusCheck.status} ]`);
            if (statusCheck.status === 'FAILED') {
                // V2 failure messages are nested in 'data' usually
                const msg = statusCheck.data?.failureReason?.failureMessage || 'Unknown';
                console.warn(`   Reason: ${msg}`);
            }

        } else {
            console.error('❌ V2 Failed:', v2Result.error);
        }
    } catch (error) {
        console.error('❌ V2 Exception:', error.message);
    }

    console.log('\n🏁 SDK Testing Complete');
    process.exit(0);
}

// Run test if called directly
if (require.main === module) {
    testSDKConnection().catch(console.error);
}

module.exports = { testSDKConnection };
```
---

### Deposit Senario (Hosted Page)

```typescript

// test-payment-page.js
require('dotenv').config();
const PawaPayService = require('./pawapayService');

/**
 * Run a full test of the PawaPay Payment Page Integration
 */
async function testPaymentPage() {
    console.log('🔗 Starting PawaPay Payment Page Test...\n');

    const service = new PawaPayService();

    // 1. Validate Token Format
    console.log('🔹 Step 1: Validating API Token...');
    const testToken = process.env.PAWAPAY_SANDBOX_API_TOKEN;
    const validation = service.validateToken(testToken);

    if (!validation.isValid) {
        console.error('❌ Token Validation Failed:', validation);
        return;
    }
    console.log('✅ Token looks valid:', validation.type);

    // Common Test Data
    const commonData = {
        amount: '500',
        currency: '51345789',
        payerMsisdn: '22951345789', // Optional for V2, but good for V1
        description: 'Page Test',
        // IMPORTANT: You need a return URL
        returnUrl: 'https://example.com/payment-success',
        country: 'UGA'
    };

    // 2. Test V1 Payment Page
    console.log('\n🔹 Step 2: Testing V1 Payment Page Generation...');
    try {
        const v1Result = await service.initiatePaymentPage({
            ...commonData,
            description: 'V1 Page Test'
        }, 'v1');

        if (v1Result.success) {
            console.log('✅ V1 Success!');
            console.log('   Deposit ID:', v1Result.depositId);
            console.log('   👉 CLICK TO PAY:', v1Result.redirectUrl);
        } else {
            console.error('❌ V1 Failed:', v1Result.error);
        }
    } catch (error) {
        console.error('❌ V1 Exception:', error.message);
    }

    // 3. Test V2 Payment Page
    console.log('\n🔹 Step 3: Testing V2 Payment Page Generation...');
    try {
        const v2Result = await service.initiatePaymentPage({
            ...commonData,
            description: 'V2 Page Test',
            // V2 specific metadata
            metadata: [
                { fieldName: "product_id", fieldValue: "PROD-999" },
                { fieldName: "email", fieldValue: "user@test.com", isPII: true }
            ]
        }, 'v2');

        if (v2Result.success) {
            console.log('✅ V2 Success!');
            console.log('   Deposit ID:', v2Result.depositId);
            console.log('   👉 CLICK TO PAY:', v2Result.redirectUrl);
        } else {
            console.error('❌ V2 Failed:', v2Result.error);
        }
    } catch (error) {
        console.error('❌ V2 Exception:', error.message);
    }

    console.log('\n🏁 Payment Page Testing Complete');
}

// Run test if called directly
if (require.main === module) {
    testPaymentPage().catch(console.error);
}

module.exports = { testPaymentPage };
```
---

### Payout Senario

```typescript

// test-payout.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PawaPayService = require('./pawapayService');

async function runPayoutTest() {
    console.log('\n========================================');
    console.log('🚀 PAWAPAY SDK PAYOUT TEST (With Status Check)');
    console.log('========================================\n');

    const service = new PawaPayService({});

    const testData = {
        amount: "1000",
        currency: "UGX",
        recipientMsisdn: "256783456789",
        mno: "MTN_MOMO_UGA",
        description: "SDK Payout Test",
        metadata: [
            { fieldName: "test_run", fieldValue: "true" }
        ]
    };

    const API_VERSION = 'v1';

    console.log(`Initiating Payout [${API_VERSION}]...`);

    try {
        // --- STEP 1: INITIATE ---
        const result = await service.payout(testData, API_VERSION);

        if (result.success) {
            console.log('\n Payout Submitted Successfully!');
            console.log(` ID: ${result.payoutId}`);

            // --- STEP 2: THE WAIT (Crucial for logical testing) ---
            console.log('\n⏳ Waiting 5 seconds for Sandbox propagation...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // --- STEP 3: CHECK STATUS ---
            console.log('🔍 Checking Payout Status...');

            // We specifically pass 'payout' as the 3rd argument here
            const statusCheck = await service.checkTransactionStatus(
                result.payoutId,
                API_VERSION,
                'payout'
            );

            if (statusCheck.success) {
                const status = statusCheck.status;
                const failureMsg = statusCheck.data?.failureReason?.failureMessage;

                console.log(`\n FINAL STATUS: [ ${status} ]`); 

                if (status === 'COMPLETED') {
                    console.log(' SUCCESS: Money sent.');
                } else if (status === 'FAILED') {
                    console.log(` FAILED: ${failureMsg || 'Unknown reason'}`);
                } else {
                    console.log('  PENDING: Still processing.');
                }

                // console.log('Debug Data:', JSON.stringify(statusCheck.data, null, 2));
            } else {
                console.error(' Could not fetch status:', statusCheck.error);
            }

        } else {
            console.error('\n Payout Initiation Failed');
            console.error(`Error: ${result.error}`);
        }

    } catch (e) {
        console.error(' Script Error:', e);
    } finally {
        process.exit(0);
    }
}

runPayoutTest();

```
---
### Refund Senario

```typescript

// test-refund.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PawaPayService = require('./pawapayService');

async function runRefundTest() {
    console.log('\n========================================');
    console.log('💸 PAWAPAY SDK REFUND TEST');
    console.log('========================================\n');

    const service = new PawaPayService({});

    // DATA FROM YOUR LOGS
    const EXISTING_DEPOSIT_ID = "e6abef2a-7b54-4d5b-9afb-8ccc831a228b";//test deposit id - example

    // We refund a partial amount to be safe/realistic
    const testData = {
        depositId: EXISTING_DEPOSIT_ID,
        amount: "500", // Refund half of the original 1000
        currency: "UGX",
        reason: "Customer requested partial refund",
        metadata: [
            { fieldName: "reason", fieldValue: "sdk_test_script" },
            { fieldName: "original_order", fieldValue: "ORD-SDK-TEST" }
        ]
    };

    // Toggle this to test V1 vs V2
    const API_VERSION = 'v1';

    console.log(`  Initiating Refund [${API_VERSION}] for Deposit: ${EXISTING_DEPOSIT_ID}...`);

    try {
        // --- STEP 1: INITIATE REFUND ---
        const result = await service.refund(testData, API_VERSION);

        if (result.success) {
            console.log('\n Refund Submitted Successfully!');
            console.log(` Refund ID: ${result.refundId}`);
            console.log(` Status: ${result.status}`);

            // --- STEP 2: WAIT ---
            console.log('\n Waiting 5 seconds for processing...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // --- STEP 3: CHECK STATUS ---
            console.log(' Checking Final Refund Status...');

            // Critical: Pass 'refund' as the 3rd argument
            const statusCheck = await service.checkTransactionStatus(
                result.refundId,
                API_VERSION,
                'refund'
            );

            if (statusCheck.success) {
                console.log(`\n FINAL STATUS: [ ${statusCheck.status} ]`);
                console.log('Data:', JSON.stringify(statusCheck.data, null, 2));
            } else {
                console.error(' Could not fetch status:', statusCheck.error);
            }

        } else {
            console.error('\n Refund Initiation Failed');
            console.error(`Error: ${result.error}`);
            if (result.rawResponse) {
                console.error('Raw:', JSON.stringify(result.rawResponse.response || result.rawResponse, null, 2));
            }
        }

    } catch (e) {
        console.error(' Script Error:', e);
    } finally {
        process.exit(0);
    }
}

runRefundTest();

```

---

### MNO Configuration & Version Switching

The SDK ships with default configuration templates. However, you are expected to maintain **up-to-date MNO and active configuration files**.

* Use the example script:

  ```
  example/fetchMnoConf.js
  ```
* This script fetches and generates:

  * `active_conf_v1.json`
  * `mno_availability_v1.json`
  * `active_conf_v2.json`
  * `mno_availability_v2.json`

You may toggle **V1 or V2** behavior through these configuration files.

> **Important**
> You should configure a cron job to periodically refresh these files to ensure MNO availability and configuration data remain current.

Here is a sample code too using the installed SDK

```typescript

/**
 * pawapayFetchConfig.js
 * * AUTOMATED CONFIGURATION UPDATER
 * Uses the PawaPayService to fetch the latest MNO definitions and Active Configurations
 * from the Sandbox environment and updates the static JSON files.
 * 
 */

const fs = require('fs');
const path = require('path');

// 🔒 HARD LOCK THE WORKING DIRECTORY (CRON-PROOF)
process.chdir('path/to/nodejs/dir');

// Load environment variables explicitly
require('dotenv').config({
    path: 'path/to/nodejs/dir/.env'
});

// (Optional debug – safe to remove once satisfied)
// console.log({
//     cwd: process.cwd(),
//     home: process.env.HOME
// });

// Load PawaPay service AFTER cwd + env are stable
const PawaPayService = require('../pawapayService');

// CONFIGURATION
// Use __dirname to ensure data directory is script-relative
const OUTPUT_DIR = path.join(__dirname, '../data');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`[Config] Directory not found, creating: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Initialize Service (Automatically loads ENV tokens and Sandbox mode)
const service = new PawaPayService();

/**
 * Helper to write JSON files surgically
 */
const saveJson = (filename, data) => {
    const filePath = path.join(OUTPUT_DIR, filename);
    try {
        const content = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(` [SUCCESS] Updated: ${filename} (${content.length} bytes)`);
    } catch (err) {
        console.error(` [ERROR] Failed to write ${filename}:`, err.message);
    }
};

/**
 * Main Execution Function
 */
const updateConfigurations = async () => {
    console.log(' [Config] Starting PawaPay Configuration Update (Sandbox)...');
    console.log(`TB: ${OUTPUT_DIR}`);

    try {
        // ==========================================
        // 1. FETCH V1 CONFIGURATIONS
        // ==========================================

        console.log(' [V1] Fetching Active Conf...');
        const activeConfV1 = await service.pawapay.checkActiveConf();
        if (activeConfV1.status === 200) {
            saveJson('active_conf_v1.json', activeConfV1.response);
        } else {
            console.error(` [V1] Active Conf Failed: ${activeConfV1.status}`);
        }

        console.log(' [V1] Fetching MNO Availability...');
        const availabilityV1 = await service.pawapay.checkMNOAvailability();
        if (availabilityV1.status === 200) {
            saveJson('mno_availability_v1.json', availabilityV1.response);
        } else {
            console.error(` [V1] Availability Failed: ${availabilityV1.status}`);
        }

        // ==========================================
        // 2. FETCH V2 CONFIGURATIONS
        // ==========================================

        console.log(' [V2] Fetching Active Conf...');
        const activeConfV2 = await service.pawapay.checkActiveConfV2();
        if (activeConfV2.status === 200) {
            saveJson('active_conf_v2.json', activeConfV2.response);
        } else {
            console.error(` [V2] Active Conf Failed: ${activeConfV2.status}`);
        }

        console.log(' [V2] Fetching MNO Availability...');
        const availabilityV2 = await service.pawapay.checkMNOAvailabilityV2();
        if (availabilityV2.status === 200) {
            saveJson('mno_availability_v2.json', availabilityV2.response);
        } else {
            console.error(` [V2] Availability Failed: ${availabilityV2.status}`);
        }

        console.log(' [DONE] All configurations updated successfully.');
        process.exit(0);

    } catch (error) {
        console.error(' [CRITICAL] Script failed:', error.message);
        process.exit(1);
    }
};

// Run
updateConfigurations();


```

This approach keeps runtime fast, predictable, and independent of unnecessary API calls.

## Support

For any issues, questions, or guidance:

* **Documentation:** Visit the [official documentation](https://katorymnd.com/pawapay-payment-sdk/nodejs)

* **Community Support:** Available with Starter and higher licenses
* **Priority Support:** Included with Professional (6 months) and Agency (1 year) licenses
* **Urgent Assistance:** Available as an add-on for production outages

**Commercial Support:** 
For licensed users experiencing production issues or needing implementation guidance.

**Contact:** [support@katorymnd.com](mailto:support@katorymnd.com)  
_Backup:_ [katorymnd@gmail.com](mailto:katorymnd@gmail.com)


----
