import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { InvoiceImageError } from "../extraction/image.js";

export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function requestId(request: Request): string {
  const header = request.header("x-request-id");
  return header && header.length <= 128 ? header : randomUUID();
}

export function notFound(request: Request, response: Response): void {
  response.status(404).json({
    code: "NOT_FOUND",
    message: "The requested resource does not exist",
    requestId: requestId(request),
    retryable: false
  });
}

export function errorHandler(error: unknown, request: Request, response: Response, next: NextFunction): void {
  const id = requestId(request);
  const payloadTooLarge = error instanceof Error && "type" in error && error.type === "entity.too.large";
  const multipartError = error instanceof Error && error.name === "MulterError";
  const imageError = error instanceof InvoiceImageError;
  const httpError = error instanceof HttpError;
  const validationError = error instanceof ZodError;
  const code = httpError ? error.code : imageError ? error.code : validationError ? "INVALID_REQUEST" : payloadTooLarge || multipartError ? "INPUT_TOO_LARGE" : "INTERNAL_ERROR";
  const status = httpError ? error.status : imageError ? error.status : validationError ? 400 : payloadTooLarge || multipartError ? 413 : 500;
  const message = httpError
    ? error.message
    : imageError
    ? error.message
    : validationError
      ? "Request fields are invalid"
    : payloadTooLarge || multipartError
      ? "Invoice image exceeds the configured byte limit"
      : "The request could not be completed";
  console.error(JSON.stringify({ requestId: id, stage: "http", code }));
  response.status(status).json({
    code,
    message,
    requestId: id,
    retryable: httpError ? error.retryable : false
  });
  void error;
  void next;
}
