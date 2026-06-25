import { describe, expect, it } from "vitest";

import { formatUpdateProgress, getUpdateErrorMessage } from "@/services/update-service";

describe("update service pure helpers", () => {
  it("maps signature failures to a blocking user message", () => {
    expect(getUpdateErrorMessage(new Error("signature verification failed"))).toBe("更新签名校验失败，已停止安装。");
  });

  it("maps missing downloaded updates to a retryable user message", () => {
    expect(getUpdateErrorMessage(new Error("NO_DOWNLOADED_UPDATE"))).toBe("更新尚未下载完成，请先下载更新。");
  });

  it("formats update download progress with a percentage when content length is known", () => {
    expect(formatUpdateProgress({ downloadedBytes: 512, contentLength: 1024 })).toBe("50% · 512 B / 1.0 KB");
  });
});
