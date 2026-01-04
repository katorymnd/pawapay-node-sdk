/**
 * Integration Test: Deposit Flow
 * 
 *
 * This test executes the actual `example/initiateDeposit.js` script (the controller),
 * but mocks the internal `ApiClient` to avoid real network calls.
 * 
 */

// 1. Setup mocks BEFORE importing the handler
const mockGenerateUniqueId = jest.fn();

// The Mock Object (Equivalent to $this->apiClientMock in PHP)
const mockApiClientInstance = {
  initiateDeposit: jest.fn(),
  initiateDepositV2: jest.fn(),
  checkTransactionStatusAuto: jest.fn(),
};

// Mock the Helper to control UUID generation (so assertions match)
jest.mock("../../src/utils/helpers", () => ({
  // We use requireActual so we can generate a REAL valid UUID for the const below
  // but allow the test to control the function execution
  generateUniqueId: mockGenerateUniqueId
}));

// Mock the ApiClient class
// When initiateDeposit.js calls `new ApiClient()`, it gets our mock instance
jest.mock("../../src/api/ApiClient", () => {
  return jest.fn().mockImplementation(() => mockApiClientInstance);
});

// Mock Winston (Logging) to keep test output clean
jest.mock("winston", () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    add: jest.fn(),
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

// Mock FailureCodeHelper
jest.mock("../../src/utils/FailureCodeHelper", () => ({
  getFailureMessage: jest.fn((code) => `Failure message for ${code}`)
}));

// We mock dotenv so it doesn't crash if file is missing,
// but we manually set the env vars needed for the test below.
jest.mock("dotenv", () => ({ config: jest.fn() }));

// 2. Import the System Under Test (The "Controller")
const initiateDeposit = require("../../example/initiateDeposit");

// 3. Test Data Setup
// Get a real UUID for our expected value 
const { generateUniqueId } = jest.requireActual("../../src/utils/helpers");
const SAMPLE_UUID = generateUniqueId();

describe("InitialDepositTest (Node.js Integration)", () => {

  beforeAll(() => {
    // Simulate the .env loading that happens in initiateDeposit.js
    // We set these here so the handler's validation passes.
    process.env.PAWAPAY_SANDBOX_API_TOKEN = "TEST_TOKEN_SANDBOX";
    process.env.KATORYMND_PAWAPAY_SDK_LICENSE_KEY = "TEST_LICENSE";
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Force the handler to use our specific UUID
    mockGenerateUniqueId.mockReturnValue(SAMPLE_UUID);
  });

  /**
   * V1 / legacy: deposit initiation
   * 
   */
  test("testDepositInitiationV1Mocked", async () => {
    // A. Setup Expectation (The Mock Response)   
    const mockResponse = {
      status: 200,
      response: { depositId: SAMPLE_UUID }
    };
    mockApiClientInstance.initiateDeposit.mockResolvedValue(mockResponse);

    // Also mock status check (Node handler does this extra step)
    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: [{ depositId: SAMPLE_UUID, status: "COMPLETED" }]
    });

    // B. The Input Data
    const args = {
      amount: "100.00",
      mno: "MTN_MOMO_UGA",
      payerMsisdn: "256783456789",
      description: "Payment for order",
      currency: "UGX",
      environment: "sandbox",
      apiVersion: "v1"
    };

    // C. Execute the "Controller"
    const result = await initiateDeposit(args);

    // D. Assertions
    
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe(SAMPLE_UUID);

    // Verify the Mock was called correctly
    expect(mockApiClientInstance.initiateDeposit).toHaveBeenCalledWith(
      SAMPLE_UUID,
      args.amount,
      args.currency,
      args.mno,
      args.payerMsisdn,
      args.description,
      expect.any(Array)
    );
  });

  /**
   * V2: deposit initiation
   * Matches PHP: testDepositInitiationV2Mocked
   */
  test("testDepositInitiationV2Mocked", async () => {
    // A. Setup Expectation
    // Matches PHP: ->willReturn($mockResponseV2)
    const mockResponseV2 = {
      status: 200,
      response: {
        depositId: SAMPLE_UUID,
        status: "ACCEPTED"
      }
    };
    mockApiClientInstance.initiateDepositV2.mockResolvedValue(mockResponseV2);

    // Mock status check
    mockApiClientInstance.checkTransactionStatusAuto.mockResolvedValue({
      status: 200,
      response: {
        status: "FOUND",
        data: { depositId: SAMPLE_UUID, status: "COMPLETED" }
      }
    });

    // B. The Input Data
    const argsV2 = {
      amount: "1000",
      currency: "UGX",
      payerMsisdn: "256783456789",
      mno: "MTN_MOMO_UGA", // provider
      description: "Payment for order", // customerMessage
      environment: "sandbox",
      apiVersion: "v2",
      metadata: [
        { key: "orderId", value: "ORD-123456789" }
      ]
    };

    // C. Execute
    const result = await initiateDeposit(argsV2);

    // D. Assertions
    expect(result.success).toBe(true);
    expect(result.transactionId).toBe(SAMPLE_UUID);

    // Verify V2 Mock was called
    expect(mockApiClientInstance.initiateDepositV2).toHaveBeenCalledWith(
      SAMPLE_UUID,
      argsV2.amount,
      argsV2.currency,
      argsV2.payerMsisdn,
      argsV2.mno,
      argsV2.description,
      null, // clientReferenceId
      null, // preAuthorisationCode
      argsV2.metadata
    );
  });

});