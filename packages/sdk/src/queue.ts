/** An event that is already serialized, so it is stringified once and its size is known. */
export interface QueuedEvent {
  body: string;
  bytes: number;
}

/** A FIFO buffer that never grows past `maxSize`: when full, the oldest items are dropped. */
export class BoundedQueue<T> {
  private items: T[] = [];
  private droppedCount = 0;

  constructor(private readonly maxSize: number) {}

  get size(): number {
    return this.items.length;
  }

  /** How many items were dropped because the queue was full. */
  get dropped(): number {
    return this.droppedCount;
  }

  push(item: T): void {
    this.items.push(item);
    this.trim();
  }

  /** Removes items from the front while `accept` allows it. Always takes one if the queue is not empty. */
  take(accept: (next: T, taken: readonly T[]) => boolean): T[] {
    const taken: T[] = [];
    while (this.items.length > 0) {
      const next = this.items[0] as T;
      if (taken.length > 0 && !accept(next, taken)) break;
      taken.push(next);
      this.items.shift();
    }
    return taken;
  }

  /** Puts items back at the front (a failed send). If that overflows, the oldest are dropped. */
  requeueFront(items: readonly T[]): void {
    this.items.unshift(...items);
    this.trim();
  }

  clear(): void {
    this.items = [];
  }

  private trim(): void {
    const excess = this.items.length - this.maxSize;
    if (excess > 0) {
      this.items.splice(0, excess);
      this.droppedCount += excess;
    }
  }
}
