import axios from 'axios';
import { getAPIUrlBasedOffEnviornment } from './API';

// Progress event types from backend
export type ProgressEventType =
  | 'connected'
  | 'browser_launch'
  | 'browser_ready'
  | 'navigation_start'
  | 'navigation_success'
  | 'navigation_timeout'
  | 'captcha_check'
  | 'captcha_detected'
  | 'captcha_solving'
  | 'captcha_solved'
  | 'captcha_retry'
  | 'terms_loading'
  | 'terms_expanding'
  | 'terms_expanded'
  | 'extraction_start'
  | 'extraction_complete'
  | 'complete'
  | 'error'
  | 'attempt_start'
  | 'attempt_failed'
  | 'success';

export interface ProgressEvent {
  type: ProgressEventType;
  message: string;
  progress: number;
  phase?: string;
  metadata?: Record<string, any>;
  timestamp: number;
  data?: any; // For final success event
  error?: any; // For error events
}

export interface ScraperStreamCallbacks {
  onProgress?: (event: ProgressEvent) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

/**
 * Stream scraping progress using Server-Sent Events (SSE)
 *
 * @param url - The Quizlet URL to scrape
 * @param callbacks - Callbacks for progress, success, error, and completion
 * @returns A function to abort the stream
 */
export async function scrapeURLStream(
  url: string,
  callbacks: ScraperStreamCallbacks
): Promise<() => void> {
  const { onProgress, onSuccess, onError, onComplete } = callbacks;

  // For SSE with POST, we need to use fetch API
  // EventSource only supports GET requests
  const apiUrl = getAPIUrlBasedOffEnviornment();

  try {
    const response = await fetch(`${apiUrl}/api/scrape-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError?.(`HTTP ${response.status}: ${errorText}`);
      onComplete?.();
      return () => {}; // No-op abort function
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      onError?.('Failed to get response stream reader');
      onComplete?.();
      return () => {}; // No-op abort function
    }

    let buffer = '';
    let isAborted = false;

    // Function to abort the stream
    const abort = () => {
      isAborted = true;
      reader.cancel();
    };

    // Process the stream
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done || isAborted) {
            onComplete?.();
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete messages in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
                const event = eventData as ProgressEvent;

                // Call progress callback
                onProgress?.(event);

                // Handle special event types
                if (event.type === 'success') {
                  onSuccess?.(event.data);
                } else if (event.type === 'error') {
                  onError?.(event.message);
                }
              } catch (parseError) {
                console.error('[ScraperStream] Failed to parse event:', line, parseError);
              }
            }
          }
        }
      } catch (error: any) {
        if (!isAborted) {
          console.error('[ScraperStream] Stream error:', error);
          onError?.(error.message || 'Stream connection error');
          onComplete?.();
        }
      }
    })();

    return abort;
  } catch (error: any) {
    console.error('[ScraperStream] Connection error:', error);
    onError?.(error.message || 'Failed to connect to server');
    onComplete?.();
    return () => {}; // No-op abort function
  }
}

/**
 * Fallback to regular scraping (non-streaming) if SSE fails
 */
export async function scrapeURL(url: string): Promise<any> {
  const data = await axios.post(`${getAPIUrlBasedOffEnviornment()}/api/scrape`, {
    url: url,
  });
  return data.data;
}
