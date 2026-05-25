let running = false;

export async function withRunLock<T>(fn: () => Promise<T>): Promise<T> {
  if (running) {
    throw new Error("Another bookmark operation is already running.");
  }
  running = true;
  try {
    return await fn();
  } finally {
    running = false;
  }
}

export function isRunning(): boolean {
  return running;
}
