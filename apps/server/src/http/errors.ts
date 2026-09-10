import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

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
  console.error(JSON.stringify({ requestId: id, stage: "http", code: "INTERNAL_ERROR" }));
  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "The request could not be completed",
    requestId: id,
    retryable: false
  });
  void error;
  void next;
}
