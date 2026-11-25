import { describe, expect, it } from "vitest";
import { carryForwardPay, DEFAULT_PAY } from "../carryForward";

const month = { hourlyRate: 24, taxPercent: 20 };

describe("carryForwardPay", () => {
  it("carries the extra deduction into a new month, like tax", () => {
    const next = carryForwardPay({ ...month, extraDeduction: 42.5 });
    expect(next).toMatchObject({ taxPercent: 20, extraDeduction: 42.5 });
  });

  it("fills in what older months never saved", () => {
    expect(carryForwardPay(month)).toEqual({ ...DEFAULT_PAY, ...month });
  });

  it("keeps amounts in range", () => {
    expect(
      carryForwardPay({ hourlyRate: -1, taxPercent: 120, extraDeduction: -5 }),
    ).toMatchObject({ hourlyRate: 0, taxPercent: 100, extraDeduction: 0 });
  });

  it("skips a month without pay settings", () => {
    expect(carryForwardPay({ extraDeduction: 10 })).toBeNull();
  });
});
