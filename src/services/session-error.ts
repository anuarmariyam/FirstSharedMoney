export class SessionServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SessionServiceError";
  }
}
export function sessionError(error: unknown): SessionServiceError {
  return error instanceof SessionServiceError
    ? error
    : new SessionServiceError(
        "NETWORK_ERROR",
        "The session request could not be completed. Check your connection and try again.",
      );
}
