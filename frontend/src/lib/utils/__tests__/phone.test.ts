import { formatGhanaPhone, isValidGhanaPhone, toNationalDigits } from "@/lib/utils/phone";

describe("Ghanaian phone numbers", () => {
  it.each([
    ["0241234567", "241234567"],
    ["024 123 4567", "241234567"],
    ["(024) 123-4567", "241234567"],
    ["+233 24 123 4567", "241234567"],
    ["233241234567", "241234567"],
    ["+233241234567", "241234567"],
  ])("reduces %s to its national digits", (input, expected) => {
    expect(toNationalDigits(input)).toBe(expected);
  });

  it.each([
    // The case the old character-class check let through: punctuation only.
    ["+++ ((( ---"],
    [""],
    ["   "],
    ["024 12"],
    ["abcdefghij"],
    // One digit too many, which is a typo rather than a longer number.
    ["02412345678"],
  ])("rejects %s", (input) => {
    expect(isValidGhanaPhone(input)).toBe(false);
  });

  it("stores every accepted spelling in one shape", () => {
    const spellings = [
      "0241234567",
      "+233 24 123 4567",
      "(024) 123-4567",
      "233241234567",
    ];

    // Staff reading a delivery run should not meet the same number written
    // four ways.
    expect(new Set(spellings.map(formatGhanaPhone)).size).toBe(1);
    expect(formatGhanaPhone("0241234567")).toBe("024 123 4567");
  });

  it("hands back unrecognised input untouched rather than mangling it", () => {
    // The validator rejects these; formatting must not invent a number.
    expect(formatGhanaPhone("not a phone")).toBe("not a phone");
  });
});
