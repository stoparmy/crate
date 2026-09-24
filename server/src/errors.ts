import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message = code, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function route(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch((error) => next(error));
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  // A failed pipeline may already have closed the response. Never append JSON
  // to a partially sent file (or try to replace its headers).
  if (res.destroyed) return;
  if (res.headersSent) return _next(error);
  res.removeHeader("Content-Length");
  res.removeHeader("Content-Disposition");
  res.removeHeader("Content-Type");
  if (error instanceof HttpError) {
    console.error("crate_http_error", {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return res.status(error.status).json({ error: error.code });
  }

  console.error(error);
  return res.status(500).json({ error: "internal_error" });
}
