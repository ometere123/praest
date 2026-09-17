import {describe, expect, it} from "vitest";
import {MCP_INSTRUCTIONS, MCP_NAME} from "./config.js";

describe("PRAEST MCP", () => {
  it("advertises direct-contract finality rules", () => {
    expect(MCP_NAME).toBe("praest-direct");
    expect(MCP_INSTRUCTIONS).toContain("FINALIZED");
    expect(MCP_INSTRUCTIONS).toContain("FINISHED_WITH_RETURN");
  });
});
