import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const field = firstIssue?.path.join('.') || 'input';
    res.status(400).json({
      error: firstIssue ? `${field}: ${firstIssue.message}` : 'Validation failed.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof Error && err.message.includes('File too large')) {
    res.status(413).json({ error: 'Uploaded image exceeds the 5 MB limit.' });
    return;
  }

  if (err instanceof Error && err.message.includes('Only image files')) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error('[CampusBite API Error]', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
}
