import { ApiRequestError } from "../api";

export const apiErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  messagesByCode: Record<string, string>
) => {
  if (!(error instanceof ApiRequestError)) {
    return fallbackMessage;
  }

  if (error.code && messagesByCode[error.code]) {
    return messagesByCode[error.code];
  }

  return error.message || fallbackMessage;
};
