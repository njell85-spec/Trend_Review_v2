export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const attempts = retryOptions.attempts ?? 3;
  const baseDelayMs = retryOptions.baseDelayMs ?? 750;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await safeReadText(response);
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

