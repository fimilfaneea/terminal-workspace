export class TerminalApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TerminalApiError';
    if (code !== undefined) this.code = code;
  }
}
