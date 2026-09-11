import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { InvoiceImageError } from "../extraction/image.js";

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
  const imageError = error instanceof InvoiceImageError;
  const code = imageError ? error.code : payloadTooLarge ? "INPUT_TOO_LARGE" : "INTERNAL_ERROR";
  const status = imageError ? error.status : payloadTooLarge ? 413 : 500;
  const message = imageError
    ? error.message
    : payloadTooLarge
      ? "Invoice image exceeds the configured byte limit"
      : "The request could not be completed";
  console.error(JSON.stringify({ requestId: id, stage: "http", code }));
  response.status(status).json({
    code,
    message,
    requestId: id,
    retryable: false
  });
  void error;
  void next;
}
