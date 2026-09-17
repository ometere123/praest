import {describe, expect, it} from "vitest";
import {LIFECYCLE_STEPS} from "./lifecycle";

describe("PRAEST lifecycle", () => {
  it("keeps the reviewer-facing lifecycle ordered", () => {
    expect(LIFECYCLE_STEPS).toEqual(["Propose", "Accept", "Evidence", "Dispute", "GenLayer", "Finalize"]);
  });
});
