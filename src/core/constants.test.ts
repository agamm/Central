import { describe, it, expect } from "vitest";
import { DB_NAME, SPACING_BASE, ANIMATION } from "./constants";

describe("constants", () => {
  it("defines the database name", () => {
    expect(DB_NAME).toBe("sqlite:central.db");
  });

  it("uses 4px base spacing", () => {
    expect(SPACING_BASE).toBe(4);
  });

  it("defines animation durations within 100-200ms range", () => {
    expect(ANIMATION.fast).toBeGreaterThanOrEqual(100);
    expect(ANIMATION.slow).toBeLessThanOrEqual(200);
  });
});
