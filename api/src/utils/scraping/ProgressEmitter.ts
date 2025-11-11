// ============================================================================
// PROGRESS EVENT TYPES
// ============================================================================

export type ProgressEventType =
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
  | 'attempt_failed';

export interface ProgressEvent {
  type: ProgressEventType;
  message: string;
  progress: number; // 0-100
  phase?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ============================================================================
// PROGRESS EMITTER
// ============================================================================

export class ProgressEmitter {
  private callback: ProgressCallback | null = null;
  private currentProgress: number = 0;

  constructor(callback?: ProgressCallback) {
    this.callback = callback || null;
  }

  /**
   * Set or update the progress callback
   */
  setCallback(callback: ProgressCallback): void {
    this.callback = callback;
  }

  /**
   * Emit a progress event
   */
  emit(
    type: ProgressEventType,
    message: string,
    progress?: number,
    metadata?: Record<string, any>
  ): void {
    if (progress !== undefined) {
      this.currentProgress = progress;
    }

    const event: ProgressEvent = {
      type,
      message,
      progress: this.currentProgress,
      metadata,
      timestamp: Date.now(),
    };

    if (this.callback) {
      this.callback(event);
    }
  }

  /**
   * Get current progress percentage
   */
  getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Emit browser launch event
   */
  browserLaunch(): void {
    this.emit('browser_launch', 'Launching browser...', 5);
  }

  /**
   * Emit browser ready event
   */
  browserReady(): void {
    this.emit('browser_ready', 'Browser ready', 10);
  }

  /**
   * Emit navigation start event
   */
  navigationStart(url: string): void {
    this.emit('navigation_start', `Navigating to ${url}...`, 15, { url });
  }

  /**
   * Emit navigation success event
   */
  navigationSuccess(): void {
    this.emit('navigation_success', 'Page loaded successfully', 30);
  }

  /**
   * Emit navigation timeout event (but continuing)
   */
  navigationTimeout(): void {
    this.emit('navigation_timeout', 'Navigation timeout, checking content...', 25);
  }

  /**
   * Emit captcha check event
   */
  captchaCheck(): void {
    this.emit('captcha_check', 'Checking for captcha...', 35);
  }

  /**
   * Emit captcha detected event
   */
  captchaDetected(type: string, willSolve: boolean): void {
    if (willSolve) {
      this.emit('captcha_detected', `Captcha detected (${type}), solving...`, 40, { type });
    } else {
      this.emit('captcha_retry', `Captcha detected (${type}), retrying with fresh browser...`, 40, { type });
    }
  }

  /**
   * Emit captcha solving event
   */
  captchaSolving(): void {
    this.emit('captcha_solving', 'Solving captcha, please wait...', 45);
  }

  /**
   * Emit captcha solved event
   */
  captchaSolved(): void {
    this.emit('captcha_solved', 'Captcha bypassed successfully', 50);
  }

  /**
   * Emit terms loading event
   */
  termsLoading(): void {
    this.emit('terms_loading', 'Loading flashcard terms...', 55);
  }

  /**
   * Emit terms expanding event
   */
  termsExpanding(clickCount: number, termCount: number): void {
    this.emit(
      'terms_expanding',
      `Expanding terms... (${clickCount} clicks, ${termCount} terms found)`,
      60 + Math.min(clickCount * 2, 20),
      { clickCount, termCount }
    );
  }

  /**
   * Emit terms expanded event
   */
  termsExpanded(totalTerms: number): void {
    this.emit('terms_expanded', `All terms loaded (${totalTerms} total)`, 80, { totalTerms });
  }

  /**
   * Emit extraction start event
   */
  extractionStart(): void {
    this.emit('extraction_start', 'Extracting flashcard data...', 85);
  }

  /**
   * Emit extraction complete event
   */
  extractionComplete(termCount: number, title: string): void {
    this.emit('extraction_complete', `Extracted ${termCount} terms from "${title}"`, 95, {
      termCount,
      title,
    });
  }

  /**
   * Emit attempt start event
   */
  attemptStart(attempt: number, maxRetries: number): void {
    this.emit('attempt_start', `Attempt ${attempt} of ${maxRetries}...`, this.currentProgress, {
      attempt,
      maxRetries,
    });
  }

  /**
   * Emit attempt failed event
   */
  attemptFailed(attempt: number, error: string): void {
    this.emit('attempt_failed', `Attempt ${attempt} failed: ${error}`, this.currentProgress, {
      attempt,
      error,
    });
  }

  /**
   * Emit complete event
   */
  complete(): void {
    this.emit('complete', 'Scraping completed successfully!', 100);
  }

  /**
   * Emit error event
   */
  error(message: string, details?: any): void {
    this.emit('error', message, this.currentProgress, details);
  }
}
