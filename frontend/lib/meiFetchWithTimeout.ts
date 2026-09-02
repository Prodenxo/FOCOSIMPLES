export const MEI_PERIODS_FETCH_TIMEOUT_MS = 28_000

export async function withMeiFetchTimeout<T> (
  promise: Promise<T>,
  timeoutMs = MEI_PERIODS_FETCH_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('MEI_FETCH_TIMEOUT'))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
