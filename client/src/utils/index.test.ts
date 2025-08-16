import { describe, expect, it } from "vitest";
import { EMAIL_REGEX, formatDate, getInitials } from "@/utils/index";

describe("Utils", () => {
  describe("formatDate", () => {
    it("formats valid date string", () => {
      const result = formatDate("2024-01-15");
      expect(result).toBe("January 15, 2024");
    });

    it('returns "Not available" for undefined', () => {
      expect(formatDate(undefined)).toBe("Not available");
    });

    it('returns "Invalid date" for invalid date', () => {
      expect(formatDate("invalid-date")).toBe("Invalid Date");
    });
  });

  describe("getInitials", () => {
    it("returns initials from full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("returns first two letters for single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("handles multiple names", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });
  });

  describe("EMAIL_REGEX", () => {
    it("validates correct email", () => {
      expect(EMAIL_REGEX.test("test@example.com")).toBe(true);
    });

    it("rejects invalid email", () => {
      expect(EMAIL_REGEX.test("invalid-email")).toBe(false);
    });
  });
});
