import { Response } from 'express';

export function parseJsonField<T>(value: unknown): T {
  if (value === null || value === undefined) {
    return {} as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return {} as T;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return {} as T;
}

export function sendSuccess(res: Response, data: unknown = {}, message = 'Success', status = 200): void {
  res.status(status).json({ success: true, data, message });
}

export function sendError(
  res: Response,
  message: string,
  status = 500,
  error: unknown = {}
): void {
  res.status(status).json({
    success: false,
    message,
    error: error instanceof Error ? { name: error.name, detail: error.message } : error,
  });
}
