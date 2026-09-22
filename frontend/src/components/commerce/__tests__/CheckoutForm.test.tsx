import { validateCheckout } from "@/components/commerce/CheckoutForm";

const valid = {
  email: "customer@example.com",
  fullName: "Ama Mensah",
  phone: "0241234567",
  addressLine: "12 Oxford Street",
  city: "Accra",
  notes: "",
  deliveryZone: "accra-central",
};

describe("checkout validation", () => {
  it("accepts a complete address", () => {
    expect(validateCheckout(valid)).toEqual({});
  });

  it.each([["not-an-email"], [""], ["missing@domain"]])(
    "rejects the email %s",
    (email) => {
      expect(validateCheckout({ ...valid, email }).email).toBeDefined();
    },
  );

  it.each([["0241234567"], ["+233 24 123 4567"], ["(024) 123-4567"]])(
    "accepts the Ghanaian number %s",
    (phone) => {
      expect(validateCheckout({ ...valid, phone }).phone).toBeUndefined();
    },
  );

  it.each([["12345"], ["abcdefghij"], [""]])("rejects the phone %s", (phone) => {
    expect(validateCheckout({ ...valid, phone }).phone).toBeDefined();
  });

  it("requires a name, address and city", () => {
    expect(validateCheckout({ ...valid, fullName: "  " }).fullName).toBeDefined();
    expect(validateCheckout({ ...valid, addressLine: "" }).addressLine).toBeDefined();
    expect(validateCheckout({ ...valid, city: "" }).city).toBeDefined();
  });

  it("treats notes as optional", () => {
    expect(validateCheckout({ ...valid, notes: "" })).toEqual({});
  });

  it("requires a delivery area, because it is what prices the order", () => {
    expect(validateCheckout({ ...valid, deliveryZone: "" }).deliveryZone).toBeDefined();
  });

  it("reports every problem at once rather than one at a time", () => {
    const errors = validateCheckout({
      email: "",
      fullName: "",
      phone: "",
      addressLine: "",
      city: "",
      notes: "",
      deliveryZone: "",
    });

    expect(Object.keys(errors)).toHaveLength(6);
  });
});
