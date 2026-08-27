import type { AppOperation, IsoTimestamp, NormalizedError, NormalizedErrorCode } from './contracts';

export class DomainError extends Error {
  constructor(readonly detail: NormalizedError) {
    super(detail.message);
    this.name = 'DomainError';
  }
}

export function domainError(
  code: NormalizedErrorCode,
  operation: AppOperation,
  message: string,
  retryable = false,
  occurredAt: IsoTimestamp = new Date().toISOString(),
) {
  return new DomainError({ code, operation, message, retryable, occurredAt, providerId: null, statusCode: null });
}

/** Unknown exceptions are deliberately reduced to a safe message before persistence. */
export function normalizeError(error: unknown, operation: AppOperation, occurredAt = new Date().toISOString()): NormalizedError {
  if (error instanceof DomainError) return error.detail;
  return {
    code: 'unknown',
    operation,
    message: 'The operation could not be completed.',
    retryable: true,
    occurredAt,
    providerId: null,
    statusCode: null,
  };
}
