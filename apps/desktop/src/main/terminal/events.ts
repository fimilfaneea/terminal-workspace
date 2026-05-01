import { log } from '../logger';

export type Listener<E> = (event: E) => void;

export class Emitter<E> {
  private readonly listeners = new Set<Listener<E>>();

  on(listener: Listener<E>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: E): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (err) {
        log.warn('emitter:listener threw', err);
      }
    }
  }

  size(): number {
    return this.listeners.size;
  }
}
