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

  * [Initializing the SDK](#initializing-the-sdk)
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
