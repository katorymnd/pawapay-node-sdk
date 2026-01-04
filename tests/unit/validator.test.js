const Validator = require("../../src/utils/validator");

describe("Validator", () => {
  describe("validateAlphanumeric", () => {
    it("should return the input if it is alphanumeric with spaces", () => {
      const input = "ValidInput123";
      expect(Validator.validateAlphanumeric(input)).toBe(input);
    });

    it("should throw an error with suggestion for invalid characters", () => {
      expect(() => Validator.validateAlphanumeric("Invalid@Input#")).toThrow(
        "The statement description contains invalid characters. Only alphanumeric characters and spaces are allowed. Suggested correction: 'InvalidInput'"
      );
    });

    it("should throw if input is not a string", () => {
      expect(() => Validator.validateAlphanumeric(123)).toThrow("Input must be a string.");
    });
  });

  describe("validateLength", () => {
    it("should return the input if length is within limit", () => {
      const input = "ShortText";
      expect(Validator.validateLength(input, 20)).toBe(input);
    });

    it("should throw an error with suggestion if length exceeds limit", () => {
      expect(() => Validator.validateLength("This text is too long", 10)).toThrow(
        "The statement description exceeds the allowed length of 10 characters. Suggested correction: 'This text '"
      );
    });

    it("should throw if input is not a string", () => {
      expect(() => Validator.validateLength(123, 5)).toThrow("Input must be a string.");
    });

    it("should throw if maxLength is invalid", () => {
      expect(() => Validator.validateLength("test", -1)).toThrow("maxLength must be a non-negative number.");
    });
  });

  describe("validateStatementDescription", () => {
    it("should return the input if valid", () => {
      const input = "ValidStatement";
      expect(Validator.validateStatementDescription(input, 20)).toBe(input);
    });

    it("should throw for invalid characters", () => {
      expect(() => Validator.validateStatementDescription("Invalid@Description", 20)).toThrow(
        "The statement description contains invalid characters. Only alphanumeric characters and spaces are allowed. Suggested correction: 'InvalidDescription'"
      );
    });

    it("should throw for exceeding length", () => {
      expect(() => Validator.validateStatementDescription("ThisIsWayTooLongForTheLimit", 10)).toThrow(
        "The statement description exceeds the allowed length of 10 characters. Suggested correction: 'ThisIsWayT'"
      );
    });
  });

  describe("joiValidateAmount", () => {
    it("should return valid amounts as strings", () => {
      expect(Validator.joiValidateAmount("5")).toBe("5");
      expect(Validator.joiValidateAmount("5.00")).toBe("5.00");
      expect(Validator.joiValidateAmount("0.5")).toBe("0.5");
      expect(Validator.joiValidateAmount("5555555")).toBe("5555555");
    });

    it("should throw for invalid decimal places", () => {
      expect(() => Validator.joiValidateAmount("5.555")).toThrow(
        "The amount '5.555' is invalid. The amount must be a number with up to 18 digits before the decimal point and up to 2 decimal places."
      );
    });

    it("should throw for exceeding digit limit", () => {
      expect(() => Validator.joiValidateAmount("5555555555555555555")).toThrow(
        "The amount '5555555555555555555' is invalid. The amount must be a number with up to 18 digits before the decimal point and up to 2 decimal places."
      );
    });

    it("should throw for invalid format without leading zero", () => {
      expect(() => Validator.joiValidateAmount(".5")).toThrow(
        "The amount '.5' is invalid. The amount must be a number with up to 18 digits before the decimal point and up to 2 decimal places."
      );
    });

    it("should throw for invalid leading zeros", () => {
      expect(() => Validator.joiValidateAmount("00.5")).toThrow(
        "The amount '00.5' is invalid. The amount must be a number with up to 18 digits before the decimal point and up to 2 decimal places."
      );
    });

    it("should throw for blank input", () => {
      expect(() => Validator.joiValidateAmount("")).toThrow("This value should not be blank.");
    });

    it("should throw for zero", () => {
      expect(() => Validator.joiValidateAmount("0")).toThrow("This value should be positive.");
    });

    it("should throw for negative", () => {
      expect(() => Validator.joiValidateAmount("-1")).toThrow(
        "The amount '-1' is invalid. The amount must be a number with up to 18 digits before the decimal point and up to 2 decimal places."
      );
    });
  });

  describe("validateMetadataItemCount", () => {
    it("should return metadata if count is 10 or less", () => {
      const metadata = Array.from({ length: 2 }, (_, i) => `item${i}`);
      expect(Validator.validateMetadataItemCount(metadata)).toEqual(metadata);
    });

    it("should throw if count exceeds 10", () => {
      const metadata = Array.from({ length: 11 }, (_, i) => `item${i}`);
      expect(() => Validator.validateMetadataItemCount(metadata)).toThrow(
        "Number of metadata items must not be more than 10. You provided 11 items."
      );
    });

    it("should throw if not an array", () => {
      expect(() => Validator.validateMetadataItemCount({})).toThrow("Metadata must be an array.");
    });
  });

  describe("validateMetadataField", () => {
    it("should return validated fieldName and fieldValue", () => {
      const result = Validator.validateMetadataField("fieldName_1", "value-123");
      expect(result).toEqual({ fieldName: "fieldName_1", fieldValue: "value-123" });
    });

    it("should throw for invalid fieldName characters", () => {
      expect(() => Validator.validateMetadataField("Invalid@FieldName", "value-123")).toThrow(
        "Metadata field name can only contain alphanumeric characters, underscores, and spaces."
      );
    });

    it("should throw for invalid fieldValue characters", () => {
      expect(() => Validator.validateMetadataField("validName", "value#123")).toThrow(
        "Metadata field value can only contain alphanumeric characters, underscores, hyphens, periods, commas, and spaces."
      );
    });

    it("should throw for blank fieldName", () => {
      expect(() => Validator.validateMetadataField("", "value")).toThrow(
        "Metadata field name cannot be blank."
      );
    });

    it("should throw for blank fieldValue", () => {
      expect(() => Validator.validateMetadataField("name", "")).toThrow(
        "Metadata field value cannot be blank."
      );
    });

    it("should throw for fieldName exceeding length", () => {
      const longName = "a".repeat(51);
      expect(() => Validator.validateMetadataField(longName, "value")).toThrow(
        "Metadata field name cannot exceed 50 characters."
      );
    });

    it("should throw for fieldValue exceeding length", () => {
      const longValue = "a".repeat(101);
      expect(() => Validator.validateMetadataField("name", longValue)).toThrow(
        "Metadata field value cannot exceed 100 characters."
      );
    });
  });

  describe("joiValidate (internal)", () => {
    it("should validate NotBlank", () => {
      expect(Validator.joiValidate("test", [{ type: "NotBlank" }])).toBe("test");
      expect(() => Validator.joiValidate("", [{ type: "NotBlank" }])).toThrow("This value should not be blank.");
    });

    it("should validate Positive", () => {
      expect(Validator.joiValidate(5, [{ type: "Positive" }])).toBe(5);
      expect(() => Validator.joiValidate(0, [{ type: "Positive" }])).toThrow("This value should be positive.");
      expect(() => Validator.joiValidate(-1, [{ type: "Positive" }])).toThrow("This value should be positive.");
    });

    it("should validate Length", () => {
      expect(Validator.joiValidate("abc", [{ type: "Length", min: 2, max: 5 }])).toBe("abc");
      expect(() => Validator.joiValidate("a", [{ type: "Length", min: 2 }])).toThrow(
        "This value is too short. It should have 2 characters or more."
      );
      expect(() => Validator.joiValidate("abcdef", [{ type: "Length", max: 5 }])).toThrow(
        "This value is too long. It should have 5 characters or less."
      );
    });

    it("should validate Regex", () => {
      expect(Validator.joiValidate("abc", [{ type: "Regex", pattern: /^[a-z]+$/ }])).toBe("abc");
      expect(() => Validator.joiValidate("abc123", [{ type: "Regex", pattern: /^[a-z]+$/ }])).toThrow(
        "This value is not valid."
      );
    });

    it("should skip unknown constraints", () => {
      expect(Validator.joiValidate("test", [{ type: "Unknown" }])).toBe("test");
    });
  });
});