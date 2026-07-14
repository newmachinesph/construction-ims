import { describe, expect, it } from "vitest";
import {
  computeTotals,
  effectiveReorderPoint,
  extractVat,
  fromCentavos,
  isRainySeason,
  isValidTin,
  lineTotal,
  normalizeTin,
  roundMoney,
  toCentavos,
  toKilograms,
} from "./ph";

describe("money", () => {
  it("converts to and from centavos without float drift", () => {
    // 19.99 * 100 is 1998.9999... in IEEE-754; must still round to 1999.
    expect(toCentavos("19.99")).toBe(1999);
    expect(toCentavos(0.1 + 0.2)).toBe(30); // 0.30000000000000004
    expect(fromCentavos(1999)).toBe("19.99");
    expect(fromCentavos(5)).toBe("0.05");
    expect(fromCentavos(100)).toBe("1.00");
  });

  it("handles negatives", () => {
    expect(fromCentavos(-2550)).toBe("-25.50");
  });

  it("rounds half-up at the centavo", () => {
    expect(roundMoney("1234.565")).toBe("1234.57");
    expect(roundMoney("1234.564")).toBe("1234.56");
  });

  it("computes a line total", () => {
    expect(lineTotal({ unitPrice: "300.00", quantity: "480" })).toBe("144000.00");
    expect(lineTotal({ unitPrice: "26.50", quantity: "3" })).toBe("79.50");
  });
});

describe("VAT / EWT totals", () => {
  it("charges 12% VAT on VATABLE lines only", () => {
    const t = computeTotals([{ unitPrice: "1000", quantity: "1", vatClass: "VATABLE" }]);
    expect(t.subtotal).toBe("1000.00");
    expect(t.vatAmount).toBe("120.00");
    expect(t.total).toBe("1120.00");
    expect(t.ewtAmount).toBe("0.00");
    expect(t.netPayable).toBe("1120.00");
  });

  it("does not VAT zero-rated or exempt lines", () => {
    const t = computeTotals([
      { unitPrice: "1000", quantity: "1", vatClass: "VATABLE" },
      { unitPrice: "500", quantity: "1", vatClass: "ZERO_RATED" },
      { unitPrice: "200", quantity: "1", vatClass: "EXEMPT" },
    ]);
    expect(t.vatableSales).toBe("1000.00");
    expect(t.zeroRatedSales).toBe("500.00");
    expect(t.exemptSales).toBe("200.00");
    expect(t.subtotal).toBe("1700.00");
    expect(t.vatAmount).toBe("120.00"); // only the VATABLE 1000
    expect(t.total).toBe("1820.00");
  });

  it("withholds 1% EWT on the VAT-EXCLUSIVE base, not the gross", () => {
    // 1% of 1000 (net) = 10, NOT 1% of 1120.
    const t = computeTotals([{ unitPrice: "1000", quantity: "1", vatClass: "VATABLE" }], {
      withholdEwt: true,
      ewtRate: 0.01,
    });
    expect(t.ewtAmount).toBe("10.00");
    expect(t.total).toBe("1120.00");
    expect(t.netPayable).toBe("1110.00"); // 1120 gross - 10 EWT
  });

  it("withholds 2% EWT for services/contractors", () => {
    const t = computeTotals([{ unitPrice: "50000", quantity: "1", vatClass: "VATABLE" }], {
      withholdEwt: true,
      ewtRate: 0.02,
    });
    expect(t.ewtAmount).toBe("1000.00");
    expect(t.netPayable).toBe("55000.00"); // 56000 gross - 1000
  });

  it("backs VAT out of a VAT-inclusive price", () => {
    expect(extractVat("1120")).toEqual({ net: "1000.00", vat: "120.00" });
  });
});

describe("invoice discount (applied before VAT)", () => {
  it("drops VAT with a peso discount", () => {
    const t = computeTotals([{ unitPrice: "1000", quantity: "1", vatClass: "VATABLE" }], {
      withholdEwt: false,
      discount: { type: "AMOUNT", value: "100" },
    });
    expect(t.subtotalBeforeDiscount).toBe("1000.00");
    expect(t.discount).toBe("100.00");
    expect(t.subtotal).toBe("900.00"); // net, after discount
    expect(t.vatableSales).toBe("900.00");
    expect(t.vatAmount).toBe("108.00"); // 12% of the discounted 900, not 1000
    expect(t.total).toBe("1008.00");
  });

  it("treats a percentage the same as the equivalent peso amount", () => {
    const t = computeTotals([{ unitPrice: "1000", quantity: "1", vatClass: "VATABLE" }], {
      withholdEwt: false,
      discount: { type: "PERCENT", value: "10" },
    });
    expect(t.discount).toBe("100.00");
    expect(t.vatAmount).toBe("108.00");
    expect(t.total).toBe("1008.00");
  });

  it("splits the discount across VAT classes so VAT lands on the discounted base", () => {
    // 1000 VATABLE + 1000 EXEMPT, 200 off -> 100 off each half.
    const t = computeTotals(
      [
        { unitPrice: "1000", quantity: "1", vatClass: "VATABLE" },
        { unitPrice: "1000", quantity: "1", vatClass: "EXEMPT" },
      ],
      { withholdEwt: false, discount: { type: "AMOUNT", value: "200" } },
    );
    expect(t.vatableSales).toBe("900.00");
    expect(t.exemptSales).toBe("900.00");
    expect(t.discount).toBe("200.00");
    expect(t.subtotal).toBe("1800.00");
    expect(t.vatAmount).toBe("108.00"); // 12% of 900
    expect(t.total).toBe("1908.00");
  });

  it("clamps a discount larger than the sale", () => {
    const t = computeTotals([{ unitPrice: "1000", quantity: "1", vatClass: "VATABLE" }], {
      withholdEwt: false,
      discount: { type: "AMOUNT", value: "5000" },
    });
    expect(t.discount).toBe("1000.00");
    expect(t.subtotal).toBe("0.00");
    expect(t.vatAmount).toBe("0.00");
    expect(t.total).toBe("0.00");
  });
});

describe("TIN validation", () => {
  it("accepts 9-digit and branch-coded TINs, with or without dashes", () => {
    expect(isValidTin("123-456-789")).toBe(true);
    expect(isValidTin("123456789")).toBe(true);
    expect(isValidTin("123-456-789-000")).toBe(true);
    expect(isValidTin("123-456-789-00000")).toBe(true);
  });

  it("rejects malformed TINs", () => {
    expect(isValidTin("12-456-789")).toBe(false);
    expect(isValidTin("abc-def-ghi")).toBe(false);
    expect(isValidTin("123-456-789-1")).toBe(false); // branch too short
  });

  it("normalizes to dashed form", () => {
    expect(normalizeTin("123456789")).toBe("123-456-789");
    expect(normalizeTin("123456789000")).toBe("123-456-789-000");
    expect(() => normalizeTin("nope")).toThrow();
  });
});

describe("units", () => {
  it("converts stock qty to kilograms when a mass is known", () => {
    // 100 lengths of 12mm rebar @ 5.328 kg each.
    expect(toKilograms("100", "5.328")).toBeCloseTo(532.8, 3);
  });
  it("returns null when the item has no mass", () => {
    expect(toKilograms("100", null)).toBeNull();
  });
});

describe("seasonal buffer", () => {
  it("flags June-November as rainy season", () => {
    expect(isRainySeason(new Date("2026-08-15T00:00:00+08:00"))).toBe(true);
    expect(isRainySeason(new Date("2026-02-15T00:00:00+08:00"))).toBe(false);
  });

  it("inflates the reorder point 30% for weather-sensitive stock in the rains", () => {
    const wet = new Date("2026-08-15T00:00:00+08:00");
    const dry = new Date("2026-02-15T00:00:00+08:00");
    expect(effectiveReorderPoint("200", true, wet)).toBeCloseTo(260, 6);
    expect(effectiveReorderPoint("200", true, dry)).toBe(200);
    expect(effectiveReorderPoint("200", false, wet)).toBe(200);
  });
});
