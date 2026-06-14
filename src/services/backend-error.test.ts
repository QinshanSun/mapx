import { describe, expect, it } from "vitest";

import { getBackendErrorMessage } from "@/services/backend-error";

describe("backend error mapping", () => {
  it("maps validation errors to Chinese UI copy", () => {
    expect(getBackendErrorMessage({ code: "VALIDATION_ERROR", message: "名称不能为空。" })).toBe(
      "输入内容不符合要求，请检查后再试。",
    );
  });

  it("maps database errors without showing raw backend details", () => {
    expect(getBackendErrorMessage({ code: "DB_ERROR", message: "RowNotFound" })).toBe(
      "本地数据库操作失败，请稍后重试。",
    );
  });

  it("maps project not found errors", () => {
    expect(getBackendErrorMessage({ code: "PROJECT_NOT_FOUND" })).toBe("项目不存在或已被删除。");
  });

  it("falls back for unknown errors", () => {
    expect(getBackendErrorMessage({ code: "SOMETHING_ELSE", message: "raw" })).toBe("操作失败，请稍后重试。");
    expect(getBackendErrorMessage(new Error("raw"))).toBe("操作失败，请稍后重试。");
  });
});
