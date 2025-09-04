import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface FetchRetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
  retryOn?: (response: Response | null, error: Error | null) => boolean;
}

const defaultRetryOn = (response: Response | null, error: Error | null): boolean => {
  // Retry on network errors
  if (error) return true;
  
  // Retry on server errors (5xx) and rate limiting (429)
  if (response) {
    return response.status >= 500 || response.status === 429;
  }
  
  return false;
};

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: FetchRetryOptions
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 16000,
    timeout = 10000,
    retryOn = defaultRetryOn
  } = retryOptions || {};
  
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const fetchOptions: RequestInit = {
        ...options,
        signal: controller.signal
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      // Check if we should retry
      if (!response.ok && retryOn(response, null) && attempt < maxRetries) {
        lastResponse = response;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        
        // Longer delay for rate limiting
        const actualDelay = response.status === 429 ? delay * 2 : delay;
        
        console.warn(
          `Request failed with status ${response.status}, retrying in ${actualDelay}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        
        await new Promise(resolve => setTimeout(resolve, actualDelay));
        continue;
      }
      
      return response;
      
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`Request timed out after ${timeout}ms (attempt ${attempt + 1}/${maxRetries})`);
      } else {
        console.warn(
          `Request failed with error: ${error instanceof Error ? error.message : 'Unknown error'} (attempt ${attempt + 1}/${maxRetries})`
        );
      }
      
      // Check if we should retry
      if (retryOn(null, error as Error) && attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we've exhausted retries, throw the error
      throw error;
    }
  }
  
  // If we've exhausted retries with a response, return it
  if (lastResponse) {
    return lastResponse;
  }
  
  // If we've exhausted retries with an error, throw it
  throw lastError || new Error('Failed after maximum retry attempts');
}


