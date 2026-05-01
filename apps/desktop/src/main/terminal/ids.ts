import { randomUUID } from 'node:crypto';

export function newSessionId(): string {
  return randomUUID();
}
