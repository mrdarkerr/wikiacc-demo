import type { ApiErrorResponse } from "../types/api";

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorResponse;

  constructor(status: number, message: string, payload?: ApiErrorResponse) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}
