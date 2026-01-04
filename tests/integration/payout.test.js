/**
 * Integration Test: Payout Flow
 * 
 */

// 1. Setup mocks BEFORE importing the handler
const mockGenerateUniqueId = jest.fn();

// The Mock Object
const mockApiClientInstance = {
  initiatePayoutAuto: jest.fn(),
  checkTransactionStatusAuto: jest.fn(),
};

// Mock Helper to control UUID generation
jest.mock("../../src/utils/helpers", () => ({
  generateUniqueId: mockGenerateUniqueId
}));

// Mock ApiClient constructor
jest.mock("../../src/api/ApiClient", () => {
  return jest.fn().mockImplementation(() => mockApiClientInstance);
});

// Mock Winston
jest.mock("winston", () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    add: jest.fn()
  }),
  transports: { File: jest.fn(), Console: jest.fn() },
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  }
}));

// Mock dotenv
jest.mock("dotenv", () => ({ config: jest.fn() }));

// 2. Import the System Under Test
const initiatePayout = require("../../example/initiatePayout");

// 3. Test Data Setup
const { generateUniqueId } = jest.requireActual("../../src/utils/helpers");
const SAMPLE_PAYOUT_ID = generateUniqueId();

describe("PayoutTest (Node.js Integration)", () => {

  beforeAll(() => {
    process.env.PAWAPAY_SANDBOX_API_TOKEN = "TEST_TOKEN_SANDBOX";
    process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY = "TEST_LICENSE";

    // Skip real delay
    jest.spyOn(global, "setTimeout").mockImplementation(cb => cb());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClientInstance.initiatePayoutAuto.mockReset();
    mockApiClientInstance.checkTransactionStatusAuto.mockReset();
    mockGenerateUniqueId.mockReturnValue(SAMPLE_PAYOUT_ID);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  /**
   * V1 payout initiation
   */
  test("testPayoutInitiationMocked (V1)", async () => {
    mockApiClientInstance.initiatePayoutAuto.mockResolvedValue({
      status: 200,
      response: { payoutId: SAMPLE_PAYOUT_ID, status: "ACCEPTED" }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: [
        { payoutId: SAMPLE_PAYOUT_ID, status: "COMPLETED", amount: "200.00", currency: "UGX" }
      ]
    });

    const inputData = {
      apiVersion: "v1",
      recipients: [
        {
          amount: "100.00",
          currency: "UGX",
          recipientMsisdn: "256783456789",
          correspondent: "MTN_MOMO_UGA",
          statementDescription: "Service payout"
        }
      ]
    };

    const result = await initiatePayout(inputData);

    if (!result.success) {
      console.error("V1 TEST FAILED. Result:", JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.responses[0].payoutId).toBe(SAMPLE_PAYOUT_ID);
    expect(result.responses[0].status).toBe("COMPLETED");

    expect(mockApiClientInstance.initiatePayoutAuto).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: SAMPLE_PAYOUT_ID,
        amount: "100.00",
        correspondent: "MTN_MOMO_UGA",
        statementDescription: "Service payout"
      })
    );
  });

  /**
   * V2 payout initiation
   */
  test("testPayoutInitiationV2ThenStatusMocked", async () => {
    mockApiClientInstance.initiatePayoutAuto.mockResolvedValue({
      status: 200,
      response: { payoutId: SAMPLE_PAYOUT_ID, status: "ACCEPTED" }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        status: "FOUND",
        data: {
          payoutId: SAMPLE_PAYOUT_ID,
          status: "COMPLETED",
          amount: "100",
          currency: "UGX"
        }
      }
    });

    const inputData = {
      apiVersion: "v2",
      recipients: [
        {
          amount: "100",
          currency: "UGX",
          recipientMsisdn: "256783456789",
          provider: "MTN_MOMO_UGA",
          customerMessage: "Service payout",
          metadata: [
            { fieldName: "orderId", fieldValue: "ORD98765" }
          ]
        }
      ]
    };

    const result = await initiatePayout(inputData);

    if (!result.success) {
      console.error("V2 TEST FAILED. Result:", JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.responses[0].payoutId).toBe(SAMPLE_PAYOUT_ID);
    expect(result.responses[0].status).toBe("COMPLETED");

    expect(mockApiClientInstance.initiatePayoutAuto).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: SAMPLE_PAYOUT_ID,
        provider: "MTN_MOMO_UGA",
        customerMessage: "Service payout"
      })
    );
  });

  /**
   * Missing fields
   */
  test("testPayoutMissingFields", async () => {
    const inputData = {
      apiVersion: "v1",
      recipients: [
        { amount: "200.00", correspondent: "MTN_MOMO_UGA", recipientMsisdn: "256783456789" }
      ]
    };

    const result = await initiatePayout(inputData);

    expect(result.success).toBe(false);
    expect(mockApiClientInstance.initiatePayoutAuto).not.toHaveBeenCalled();
  });
});
