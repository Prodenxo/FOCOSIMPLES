export async function withRetry(fn, { maxAttempts = 3, delayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isTransient =
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.cause?.code === 'ECONNRESET' ||
        error?.cause?.code === 'ETIMEDOUT' ||
        (typeof error?.message === 'string' && error.message.includes('fetch failed'));
      if (!isTransient || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
