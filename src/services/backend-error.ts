import type { BackendError, BackendErrorCode } from "@/types/backend-error";

const BACKEND_ERROR_MESSAGES: Record<BackendErrorCode, string> = {
  VALIDATION_ERROR: "输入内容不符合要求，请检查后再试。",
  DB_ERROR: "本地数据库操作失败，请稍后重试。",
  PROJECT_NOT_FOUND: "项目不存在或已被删除。",
};

export function getBackendErrorMessage(error: BackendError | unknown) {
  if (!isBackendError(error)) {
    return "操作失败，请稍后重试。";
  }

  if (isKnownBackendErrorCode(error.code)) {
    return BACKEND_ERROR_MESSAGES[error.code];
  }

  return "操作失败，请稍后重试。";
}

function isBackendError(error: unknown): error is BackendError {
  return !!error && typeof error === "object" && "code" in error && typeof error.code === "string";
}

function isKnownBackendErrorCode(code: string): code is BackendErrorCode {
  return code in BACKEND_ERROR_MESSAGES;
}
