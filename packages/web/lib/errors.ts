export class LimitReachedError extends Error {
  readonly code = 'LIMIT_REACHED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'LimitReachedError';
  }
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMIT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class DuplicateSubmissionError extends Error {
  readonly code = 'DUPLICATE_SUBMISSION' as const;
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateSubmissionError';
  }
}
