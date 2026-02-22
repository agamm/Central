interface AsyncQueue<T> {
  push: (item: T) => void;
  close: () => void;
  iterator: () => AsyncIterableIterator<T>;
}

function createAsyncQueue<T>(): AsyncQueue<T> {
  const buffer: T[] = [];
  const waiters: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;

  return {
    push(item: T): void {
      if (closed) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: item, done: false });
      } else {
        buffer.push(item);
      }
    },
    close(): void {
      closed = true;
      for (const waiter of waiters) {
        waiter({ value: undefined as unknown as T, done: true });
      }
      waiters.length = 0;
    },
    iterator(): AsyncIterableIterator<T> {
      const iter: AsyncIterableIterator<T> = {
        next(): Promise<IteratorResult<T>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift()!, done: false });
          }
          if (closed) {
            return Promise.resolve({ value: undefined as unknown as T, done: true });
          }
          return new Promise((resolve) => waiters.push(resolve));
        },
        [Symbol.asyncIterator]() { return iter; },
      };
      return iter;
    },
  };
}

export { createAsyncQueue };
export type { AsyncQueue };
