// utils/withTimeout.ts

// Ceiling on a promise that may never settle, for example native RNTP calls after a service rebind.
// The work is abandoned, not cancelled. Callers treat a timeout as a failure and retry.
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not settle within ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = async <T>(
  work: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
