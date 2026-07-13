export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = "Authentication is required") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Access is denied") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (code, message) => new AppError(404, code, message);

export const conflict = (code, message, details) =>
  new AppError(409, code, message, details);

export const tooManyRequests = (code, message, details) =>
  new AppError(429, code, message, details);

export const paymentRequired = (code, message, details) =>
  new AppError(402, code, message, details);

export const badGateway = (code, message, details) =>
  new AppError(502, code, message, details);

export const serviceUnavailable = (code, message, details) =>
  new AppError(503, code, message, details);
