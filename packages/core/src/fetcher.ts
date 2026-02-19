import axios, { AxiosError } from 'axios';
import { NotFoundError, FetchError } from './errors.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatusCode(error: unknown): number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status;
  }
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.code === 'ECONNABORTED' || error.message.includes('timeout');
  }
  if (error instanceof Error) {
    return error.message.includes('timeout') || 
      ((error as any).code === 'ECONNABORTED');
  }
  return false;
}

export async function fetchHtml(url: string, options?: {
  maxRetries?: number;
  timeout?: number;
}): Promise<string> {
  const maxRetries = options?.maxRetries ?? 3;
  const timeout = options?.timeout ?? 30000;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];
    
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': userAgent,
        },
      });
      
      if (typeof response.data === 'string' && response.data.includes('<html')) {
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      const status = getStatusCode(error);
      
      if (status === 404) {
        throw new NotFoundError(url);
      }
      
      if (status && status >= 400 && status < 500) {
        const axiosErr = error instanceof AxiosError ? error : undefined;
        throw new FetchError(`Request failed with status ${status}`, axiosErr);
      }
      
      if (isTimeoutError(error)) {
        const axiosErr = error instanceof AxiosError ? error : 
          (error instanceof Error ? error : undefined);
        lastError = new FetchError(`Request timed out after ${timeout}ms`, axiosErr);
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error));
      }
    }
    
    if (attempt < maxRetries) {
      const delay = 100 * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw new FetchError(
    `Failed to fetch ${url} after ${maxRetries + 1} attempts`,
    lastError
  );
}
