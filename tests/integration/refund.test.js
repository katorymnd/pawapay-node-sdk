/**
 * Integration Test: Refund Flow
 * Mirrors: RefundTest.php
 */

// =======================
// 1. Setup mocks FIRST
// =======================

const mockGenerateUniqueId = jest.fn();

// Mock ApiClient instance methods
const mockApiClientInstance = {
  initiateRefund: jest.fn(),
  initiateRefundAuto: jest.fn(),
  checkTransactionStatus: jest.fn(),
  checkTransactionStatusAuto: jest.fn(),
};

// Mock Helpers
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
    warn: jest.fn(),
    add: jest.fn()
  }),
  transports: { File: jest.fn(), Console: jest.fn() },
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  }
}));

// Mock dotenv
jest.mock("dotenv", () => ({ config: jest.fn() }));

// =======================
// 2. Import SUT
// =======================

const processRefund = require("../../example/processRefund");
const { generateUniqueId } = require("../../src/utils/helpers");

// =======================
// 3. Test Suite
// =======================

describe("RefundTest (Node.js Integration)", () => {

  let SAMPLE_REFUND_ID;
  let SAMPLE_DEPOSIT_ID;

  beforeAll(() => {
    process.env.PAWAPAY_SANDBOX_API_TOKEN = "TEST_SANDBOX_TOKEN";
    process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY = "TEST_LICENSE_KEY";

    jest.spyOn(global, "setTimeout").mockImplementation(cb => cb());
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockGenerateUniqueId
      .mockReturnValueOnce("REFUND-GEN-ID-001")
      .mockReturnValueOnce("DEPOSIT-GEN-ID-002");

    SAMPLE_REFUND_ID = generateUniqueId();
    SAMPLE_DEPOSIT_ID = generateUniqueId();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  /**
   * V1 refund initiation
   */
  test("testRefundInitiationMocked (V1)", async () => {
    mockApiClientInstance.initiateRefundAuto.mockResolvedValue({
      status: 200,
      response: { refundId: SAMPLE_REFUND_ID }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "COMPLETED"
      }
    });

    const result = await processRefund({
      depositId: SAMPLE_DEPOSIT_ID,
      amount: "50.00",
      apiVersion: "v1"
    });

    expect(result.success).toBe(true);
    expect(result.initiationData.refundId).toBe(SAMPLE_REFUND_ID);
    expect(result.refundStatus.refundId).toBe(SAMPLE_REFUND_ID);
    expect(result.refundStatus.status).toBe("COMPLETED");
  });

  /**
   * Missing fields
   */
  test("testRefundMissingFields", async () => {
    const result = await processRefund({
      depositId: null,
      amount: "50.00",
      apiVersion: "v1"
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Deposit ID and Amount are required.");

    expect(mockApiClientInstance.initiateRefundAuto).not.toHaveBeenCalled();
  });

  /**
   * V1 refund status check
   */
  test("testRefundStatusCheckV1", async () => {
    mockApiClientInstance.initiateRefundAuto.mockResolvedValue({
      status: 200,
      response: { refundId: SAMPLE_REFUND_ID }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "COMPLETED"
      }
    });

    const result = await processRefund({
      depositId: SAMPLE_DEPOSIT_ID,
      amount: "50.00",
      apiVersion: "v1"
    });

    expect(result.success).toBe(true);
    expect(result.refundStatus.status).toBe("COMPLETED");
  });

  /**
   * V2 refund initiation
   */
  test("testRefundInitiationV2Mocked", async () => {
    mockApiClientInstance.initiateRefundAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "ACCEPTED"
      }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "COMPLETED"
      }
    });

    const result = await processRefund({
      depositId: SAMPLE_DEPOSIT_ID,
      amount: "50",
      currency: "UGX",
      apiVersion: "v2",
      metadata: [{ orderId: "ORD-123456789" }]
    });

    expect(result.success).toBe(true);
    expect(result.initiationData.refundId).toBe(SAMPLE_REFUND_ID);
    expect(result.initiationData.status).toBe("ACCEPTED");
    expect(result.refundStatus.status).toBe("COMPLETED");
  });

  /**
   * V2 refund initiation + status
   */
  test("testRefundInitiationV2ThenStatusMocked", async () => {
    mockApiClientInstance.initiateRefundAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "ACCEPTED"
      }
    });

    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        refundId: SAMPLE_REFUND_ID,
        status: "COMPLETED"
      }
    });

    const result = await processRefund({
      depositId: SAMPLE_DEPOSIT_ID,
      amount: "50",
      currency: "UGX",
      apiVersion: "v2"
    });

    expect(result.success).toBe(true);
    expect(result.refundStatus.status).toBe("COMPLETED");
  });
});
