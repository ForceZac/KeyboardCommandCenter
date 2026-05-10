export class LimitReachedError extends Error {
  readonly code = 'LIMIT_REACHED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'LimitReachedError';
  }
}
