const Config = require("../../src/config/Config");

describe("Config", () => {
  describe("Static properties and methods", () => {
    it("should have settings for sandbox and production", () => {
      expect(Config.settings).toHaveProperty("sandbox");
      expect(Config.settings.sandbox).toHaveProperty("api_url", "https://api.sandbox.pawapay.io");
      expect(Config.settings).toHaveProperty("production");
      expect(Config.settings.production).toHaveProperty("api_url", "https://api.pawapay.io");
    });

    it("should get settings for sandbox", () => {
      const settings = Config.getSettings("sandbox");
      expect(settings).toEqual({ api_url: "https://api.sandbox.pawapay.io" });
    });

    it("should get settings for production", () => {
      const settings = Config.getSettings("production");
      expect(settings).toEqual({ api_url: "https://api.pawapay.io" });
    });

    it("should throw error for invalid environment in getSettings", () => {
      expect(() => Config.getSettings("invalid")).toThrow("Invalid environment specified: invalid");
    });

    it("should get normalized API URL for sandbox", () => {
      const url = Config.getApiUrl("sandbox");
      expect(url).toBe("https://api.sandbox.pawapay.io");
    });

    it("should get normalized API URL for production", () => {
      const url = Config.getApiUrl("production");
      expect(url).toBe("https://api.pawapay.io");
    });

    it("should throw error for invalid environment in getApiUrl", () => {
      expect(() => Config.getApiUrl("invalid")).toThrow("Invalid environment specified: invalid");
    });

    it("should validate valid environments", () => {
      expect(Config.isValidEnvironment("sandbox")).toBe(true);
      expect(Config.isValidEnvironment("production")).toBe(true);
    });

    it("should invalidate invalid environment", () => {
      expect(Config.isValidEnvironment("invalid")).toBe(false);
    });

    it("should get available environments", () => {
      const environments = Config.getAvailableEnvironments();
      expect(environments).toEqual(["sandbox", "production"]);
    });
  });

  describe("Instance methods", () => {
    it("should default to sandbox environment", () => {
      const config = new Config({ apiKey: "test-key" });
      expect(config.environment).toBe("sandbox");
      expect(config._rawBaseURL).toBe("https://api.sandbox.pawapay.io");
      expect(config.baseURL).toBe("https://api.sandbox.pawapay.io");
      expect(config.apiKey).toBe("test-key");
      expect(config.timeout).toBe(30000);
    });

    it("should set production environment", () => {
      const config = new Config({ apiKey: "test-key", environment: "production" });
      expect(config.environment).toBe("production");
      expect(config._rawBaseURL).toBe("https://api.pawapay.io");
      expect(config.baseURL).toBe("https://api.pawapay.io");
    });

    it("should override timeout", () => {
      const config = new Config({ apiKey: "test-key", timeout: 5000 });
      expect(config.timeout).toBe(5000);
    });

    it("should throw error for invalid environment in constructor", () => {
      expect(() => new Config({ environment: "invalid" })).toThrow("Invalid environment specified: invalid");
    });

    it("should normalize base URL by removing trailing slash", () => {
      const config = new Config({ environment: "sandbox" });
      // Temporarily override _rawBaseURL to test normalization
      config._rawBaseURL = "https://api.sandbox.pawapay.io/";
      config.baseURL = config._normalizeBaseURL(config._rawBaseURL);
      expect(config.baseURL).toBe("https://api.sandbox.pawapay.io");
    });

    it("should normalize base URL by removing /v1", () => {
      const config = new Config({ environment: "sandbox" });
      config._rawBaseURL = "https://api.sandbox.pawapay.io/v1";
      config.baseURL = config._normalizeBaseURL(config._rawBaseURL);
      expect(config.baseURL).toBe("https://api.sandbox.pawapay.io");
    });

    it("should normalize base URL by removing /v2 (case insensitive)", () => {
      const config = new Config({ environment: "sandbox" });
      config._rawBaseURL = "https://api.sandbox.pawapay.io/V2";
      config.baseURL = config._normalizeBaseURL(config._rawBaseURL);
      expect(config.baseURL).toBe("https://api.sandbox.pawapay.io");
    });

    it("should normalize base URL with trailing spaces and slashes", () => {
      const config = new Config({ environment: "sandbox" });
      config._rawBaseURL = " https://api.sandbox.pawapay.io/ ";
      config.baseURL = config._normalizeBaseURL(config._rawBaseURL);
      expect(config.baseURL).toBe("https://api.sandbox.pawapay.io");
    });

    it("should get base URL", () => {
      const config = new Config({ environment: "sandbox" });
      expect(config.getBaseURL()).toBe("https://api.sandbox.pawapay.io");
    });

    it("should get full config", () => {
      const config = new Config({ apiKey: "test-key", environment: "sandbox", timeout: 5000 });
      const fullConfig = config.getConfig();
      expect(fullConfig).toEqual({
        apiKey: "test-key",
        environment: "sandbox",
        baseURL: "https://api.sandbox.pawapay.io",
        timeout: 5000,
        rawBaseURL: "https://api.sandbox.pawapay.io",
        api_url: "https://api.sandbox.pawapay.io"
      });
    });
  });
});