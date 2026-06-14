import { describe, expect, it } from "vitest";

import { resolveDirtyGuardChoice } from "@/services/dirty-guard";

describe("dirty guard choices", () => {
  it("continues after saving", () => {
    expect(resolveDirtyGuardChoice("save")).toBe("saveAndContinue");
  });

  it("continues after discarding", () => {
    expect(resolveDirtyGuardChoice("discard")).toBe("discardAndContinue");
  });

  it("stays on the current edit when canceled", () => {
    expect(resolveDirtyGuardChoice("cancel")).toBe("stay");
  });
});
