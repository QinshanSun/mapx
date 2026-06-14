export type BackendErrorCode = "VALIDATION_ERROR" | "DB_ERROR" | "PROJECT_NOT_FOUND";

export interface BackendError {
  code: BackendErrorCode | string;
  message?: string;
}

