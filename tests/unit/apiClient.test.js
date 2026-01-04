require("dotenv").config();
const ApiClient = require("../../src/api/ApiClient");
const axios = require("axios");

// Keep the axios mock exactly as you had it
jest.mock("axios", () => {
  return {
    create: jest.fn(() => ({
      request: jest.fn()
    }))
  };
});

describe("ApiClient Unit Tests", () => {
  let apiClient;
  let httpClientMock;
  let licenseSpy; // Reference to the spy to manage lifecycle

  beforeEach(async () => {
    jest.clearAllMocks();

    // === SURGICAL LICENSE MOCK (CORRECTED) ===
    // We must mock the prototype BEFORE "new ApiClient()" is called.
    // This catches the call made inside the constructor.
    licenseSpy = jest
      .spyOn(ApiClient.prototype, "_initializeLicense")
      .mockImplementation(async function () {
        // use 'function' syntax to access 'this' context if needed
        this._activated = true; // mimic license successfully activated
        return Promise.resolve();
      });

    // Create ApiClient - this will now trigger the MOCK, not the real network call
    apiClient = new ApiClient({
      apiToken: "test_api_token",
      environment: "sandbox",
      sslVerify: false,
      apiVersion: "v1",
      licenseKey: process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY || "TEST-KEY"
    });

    // Grab the mocked axios instance
    httpClientMock = axios.create();

    // Inject mocked client explicitly
    apiClient.setHttpClient(httpClientMock);

    // You likely don't need to await `_initializeLicense` anymore because
    // the constructor called our mock, which resolves instantly.
  });

  afterEach(() => {
    // Clean up the spy on the prototype so it doesn't leak to other test files
    if (licenseSpy) {
      licenseSpy.mockRestore();
    }
  });

  /**
   * Initiate Deposit (V1)
   */
  test("initiateDeposit returns expected depositId", async () => {
    httpClientMock.request.mockResolvedValue({
      status: 200,
      data: { depositId: "12345" }
    });

    const response = await apiClient.initiateDeposit(
      "12345",
      100,
      "UGX",
      "MTN_MOMO_UGA",
      "256783456789"
    );

    expect(response.status).toBe(200);
    expect(response.response.depositId).toBe("12345");
    expect(httpClientMock.request).toHaveBeenCalledTimes(1);
  });

  /**
   * Initiate Payout (V1)
   */
  test("initiatePayout returns expected payoutId", async () => {
    httpClientMock.request.mockResolvedValue({
      status: 200,
      data: { payoutId: "67890" }
    });

    const response = await apiClient.initiatePayout(
      "67890",
      200,
      "USD",
      "MTN_MOMO",
      "256700123456"
    );

    expect(response.status).toBe(200);
    expect(response.response.payoutId).toBe("67890");
    expect(httpClientMock.request).toHaveBeenCalledTimes(1);
  });

  /**
   * Initiate Refund (V1)
   */
  test("initiateRefund returns expected refundId", async () => {
    httpClientMock.request.mockResolvedValue({
      status: 200,
      data: { refundId: "54321" }
    });

    const response = await apiClient.initiateRefund(
      "54321",
      "12345",
      50,
      []
    );

    expect(response.status).toBe(200);
    expect(response.response.refundId).toBe("54321");
    expect(httpClientMock.request).toHaveBeenCalledTimes(1);
  });

  /**
   * Check Transaction Status (Deposit)
   */
  test("checkTransactionStatus returns expected transactionId", async () => {
    httpClientMock.request.mockResolvedValue({
      status: 200,
      data: { transactionId: "abc123" }
    });

    const response = await apiClient.checkTransactionStatus(
      "abc123",
      "deposit"
    );

    expect(response.status).toBe(200);
    expect(response.response.transactionId).toBe("abc123");
    expect(httpClientMock.request).toHaveBeenCalledTimes(1);
  });

  /**
   * SSL Verification Flag Behavior
   */
  test("sslVerify is enabled in production and disabled in sandbox", () => {
    // Note: Since we are mocking the prototype in beforeEach, 
    // these new instances will ALSO skip license checks, which is exactly what we want.

    const prodClient = new ApiClient({
      apiToken: "token",
      environment: "production",
      sslVerify: true,
      apiVersion: "v1",
      licenseKey: "TEST"
    });

    const sandboxClient = new ApiClient({
      apiToken: "token",
      environment: "sandbox",
      sslVerify: false,
      apiVersion: "v1",
      licenseKey: "TEST"
    });

    expect(prodClient.sslVerify).toBe(true);
    expect(sandboxClient.sslVerify).toBe(false);
  });
});