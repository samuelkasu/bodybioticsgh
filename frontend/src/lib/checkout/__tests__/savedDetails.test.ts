import {
  clearSavedDetails,
  loadSavedDetails,
  saveDetails,
} from "@/lib/checkout/savedDetails";

const details = {
  email: "ama@example.com",
  fullName: "Ama Mensah",
  phone: "024 123 4567",
  addressLine: "12 Oxford Street",
  city: "Accra",
  deliveryZone: "accra-central",
};

describe("saved delivery details", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns nothing on a device that has never checked out", () => {
    expect(loadSavedDetails()).toBeNull();
  });

  it("round-trips a full address", () => {
    saveDetails(details);
    expect(loadSavedDetails()).toEqual(details);
  });

  it("keeps the usable fields when one is corrupt", () => {
    // A partial write, or an older version of the shape. Throwing away a whole
    // address because one key is wrong costs the customer the retyping this
    // exists to prevent.
    window.localStorage.setItem(
      "bodybiotics:delivery-details",
      JSON.stringify({ ...details, city: 42, phone: null }),
    );

    const loaded = loadSavedDetails();

    expect(loaded?.addressLine).toBe("12 Oxford Street");
    expect(loaded?.city).toBeUndefined();
    expect(loaded?.phone).toBeUndefined();
  });

  it("survives junk under its key", () => {
    window.localStorage.setItem("bodybiotics:delivery-details", "{not json");
    expect(loadSavedDetails()).toBeNull();
  });

  it("treats blank fields as absent rather than prefilling empties", () => {
    saveDetails({ ...details, addressLine: "   " });
    expect(loadSavedDetails()?.addressLine).toBeUndefined();
  });

  it("clears", () => {
    saveDetails(details);
    clearSavedDetails();
    expect(loadSavedDetails()).toBeNull();
  });

  it("never lets a storage failure escape", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    // Private browsing and a full quota both land here, and neither is a
    // reason a customer cannot place an order.
    expect(() => saveDetails(details)).not.toThrow();

    setItem.mockRestore();
  });
});
