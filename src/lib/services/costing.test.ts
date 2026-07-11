import { describe, expect, it } from "vitest";
import { nextAverageCost, signedQuantity } from "./costing";

describe("signedQuantity", () => {
  it("makes receipts and returns-from-site positive", () => {
    expect(signedQuantity("RECEIPT", "100")).toBe(100);
    expect(signedQuantity("TRANSFER_IN", "50")).toBe(50);
    expect(signedQuantity("RETURN_FROM_SITE", "5")).toBe(5);
  });

  it("makes issues, transfers-out and returns-to-supplier negative", () => {
    expect(signedQuantity("ISSUE", "30")).toBe(-30);
    expect(signedQuantity("TRANSFER_OUT", "10")).toBe(-10);
    expect(signedQuantity("RETURN_TO_SUPPLIER", "4")).toBe(-4);
  });

  // A counter sale takes goods OFF the shelf. If SALE were ever treated as
  // inbound, every POS transaction would silently increase stock.
  it("makes a counter sale negative", () => {
    expect(signedQuantity("SALE", "6")).toBe(-6);
  });

  it("preserves the sign of an adjustment", () => {
    expect(signedQuantity("ADJUSTMENT", "-7")).toBe(-7);
    expect(signedQuantity("ADJUSTMENT", "12")).toBe(12);
  });
});

describe("moving-average cost", () => {
  it("adopts the incoming cost when starting from empty", () => {
    expect(nextAverageCost("0", "0", "480", "300.00")).toBe("300.00");
  });

  it("blends two receipts at different prices", () => {
    // 480 @ 300 then 500 @ 380 -> (144000 + 190000) / 980 = 340.816... -> 340.82
    expect(nextAverageCost("480", "300.00", "500", "380.00")).toBe("340.82");
  });

  it("does not move the average on a degenerate (empty) result", () => {
    expect(nextAverageCost("0", "300.00", "0", "999.00")).toBe("300.00");
  });

  it("is stable when incoming cost equals the running average", () => {
    expect(nextAverageCost("100", "50.00", "100", "50.00")).toBe("50.00");
  });
});
