import {describe, expect, it} from "vitest";
import {STUDIO_DEV, applicationSuccess} from "./index.js";

describe("PRAEST direct SDK", () => {
  it("locks to Studio-dev", () => {
    expect(STUDIO_DEV.chainId).toBe(61997);
    expect(STUDIO_DEV.rpc).toBe("https://studio-dev.genlayer.com/api");
  });

  it("requires final successful execution for application success", () => {
    expect(applicationSuccess({txExecutionResultName: "FINISHED_WITH_RETURN", statusName: "FINALIZED"} as never)).toBe(true);
    expect(applicationSuccess({txExecutionResultName: "FINISHED_WITH_ERROR", statusName: "FINALIZED"} as never)).toBe(false);
  });
});
