import { Solver } from '2captcha-ts';
import { Page } from 'puppeteer';

export interface CaptchaSolution {
  success: boolean;
  token?: string;
  error?: string;
  type?: 'turnstile' | 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha';
}

export interface CaptchaDetectionResult {
  detected: boolean;
  type: 'turnstile' | 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | null;
  siteKey: string | null;
  action?: string; // For reCAPTCHA v3
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Universal CAPTCHA solver supporting Turnstile, reCAPTCHA, and hCaptcha
 */
export class TwoCaptchaSolver {
  private solver: Solver;
  private enabled: boolean;
  private proxyConfig?: ProxyConfig;

  constructor(apiKey?: string, proxyConfig?: ProxyConfig) {
    const key = apiKey || "acc08ee48fc307ec51ab7d52dfb966e5";

    if (!key) {
      console.log('[2CAPTCHA] ⚠️  API key not found. Captcha solving disabled.');
      this.enabled = false;
      this.solver = new Solver('dummy');
    } else {
      console.log('[2CAPTCHA] ✅ Service enabled');
      this.enabled = true;
      this.solver = new Solver(key);
      this.proxyConfig = proxyConfig;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Detect what type of captcha is present on the page
   */
  async detectCaptcha(page: Page): Promise<CaptchaDetectionResult> {
    const html = await page.content();

    // Check for Turnstile
    const turnstileKey = this.extractTurnstileSiteKey(html);
    if (turnstileKey) {
      console.log('[2CAPTCHA] 🔍 Detected: Cloudflare Turnstile');
      return { detected: true, type: 'turnstile', siteKey: turnstileKey };
    }

    // Check for reCAPTCHA v2
    const recaptchaV2Key = await this.extractRecaptchaV2SiteKey(page, html);
    if (recaptchaV2Key) {
      console.log('[2CAPTCHA] 🔍 Detected: reCAPTCHA v2');
      return { detected: true, type: 'recaptcha-v2', siteKey: recaptchaV2Key };
    }

    // Check for reCAPTCHA v3
    const recaptchaV3Data = this.extractRecaptchaV3SiteKey(html);
    if (recaptchaV3Data.siteKey) {
      console.log('[2CAPTCHA] 🔍 Detected: reCAPTCHA v3');
      return { detected: true, type: 'recaptcha-v3', siteKey: recaptchaV3Data.siteKey, action: recaptchaV3Data.action };
    }

    // Check for hCaptcha
    const hcaptchaKey = await this.extractHCaptchaSiteKey(page, html);
    if (hcaptchaKey) {
      console.log('[2CAPTCHA] 🔍 Detected: hCaptcha');
      return { detected: true, type: 'hcaptcha', siteKey: hcaptchaKey };
    }

    console.log('[2CAPTCHA] ℹ️  No captcha detected');
    return { detected: false, type: null, siteKey: null };
  }

  /**
   * Solve any detected captcha
   */
  async solveCaptcha(url: string, detection: CaptchaDetectionResult): Promise<CaptchaSolution> {
    if (!this.enabled) {
      return { success: false, error: '2Captcha service not enabled' };
    }

    if (!detection.detected || !detection.siteKey) {
      return { success: false, error: 'No captcha detected' };
    }

    console.log(`[2CAPTCHA] 🔄 Solving ${detection.type}...`);
    console.log(`[2CAPTCHA]    URL: ${url}`);
    console.log(`[2CAPTCHA]    Site Key: ${detection.siteKey}`);

    try {
      let result: any;
      const proxyConfig = this.buildProxyConfig();

      switch (detection.type) {
        case 'turnstile':
          result = await this.solver.cloudflareTurnstile({
            pageurl: url,
            sitekey: detection.siteKey,
            ...proxyConfig
          });
          break;

        case 'recaptcha-v2':
          result = await this.solver.recaptcha({
            pageurl: url,
            googlekey: detection.siteKey,
            ...proxyConfig
          });
          break;

        case 'recaptcha-v3':
          result = await this.solver.recaptcha({
            pageurl: url,
            googlekey: detection.siteKey,
            version: 'v3',
            action: detection.action || 'verify',
            min_score: 0.3,
            ...proxyConfig
          });
          break;

        case 'hcaptcha':
          result = await this.solver.hcaptcha({
            pageurl: url,
            sitekey: detection.siteKey,
            ...proxyConfig
          });
          break;

        default:
          return { success: false, error: `Unsupported captcha type: ${detection.type}` };
      }

      const token = result.data;
      console.log('[2CAPTCHA] ✅ Solved successfully!');
      console.log(`[2CAPTCHA]    Token: ${token.substring(0, 50)}...`);

      return { success: true, token, type: detection.type };

    } catch (error: any) {
      console.error(`[2CAPTCHA] ❌ Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inject captcha solution into the page
   */
  async injectSolution(page: Page, solution: CaptchaSolution): Promise<boolean> {
    if (!solution.success || !solution.token) {
      return false;
    }

    console.log(`[2CAPTCHA] 💉 Injecting ${solution.type} token...`);

    try {
      switch (solution.type) {
        case 'turnstile':
          await page.evaluate((token: string) => {
            const inputs = document.querySelectorAll<HTMLInputElement>(
              'input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]'
            );
            inputs.forEach(input => {
              input.value = token;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            });
          }, solution.token);
          break;

        case 'recaptcha-v2':
        case 'recaptcha-v3':
          await page.evaluate((token: string) => {
            const inputs = document.querySelectorAll<HTMLTextAreaElement>(
              'textarea[name="g-recaptcha-response"], textarea#g-recaptcha-response'
            );
            inputs.forEach(input => {
              input.value = token;
              input.style.display = '';
            });

            // Trigger callback if it exists
            if ((window as any).___grecaptcha_cfg?.clients) {
              Object.values((window as any).___grecaptcha_cfg.clients).forEach((client: any) => {
                if (client?.callback) client.callback(token);
              });
            }
          }, solution.token);
          break;

        case 'hcaptcha':
          await page.evaluate((token: string) => {
            const inputs = document.querySelectorAll<HTMLTextAreaElement>(
              'textarea[name="h-captcha-response"], textarea#h-captcha-response'
            );
            inputs.forEach(input => {
              input.value = token;
            });

            // Trigger hCaptcha callback
            if ((window as any).hcaptcha) {
              const widgets = document.querySelectorAll('[data-hcaptcha-widget-id]');
              widgets.forEach((widget: any) => {
                const widgetId = widget.getAttribute('data-hcaptcha-widget-id');
                if (widgetId && (window as any).hcaptcha.callback) {
                  (window as any).hcaptcha.callback(token);
                }
              });
            }
          }, solution.token);
          break;
      }

      // Try to click submit button if present
      await page.evaluate(() => {
        const submitButton = document.querySelector<HTMLButtonElement>(
          'button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Verify")'
        );
        if (submitButton && !submitButton.disabled) {
          submitButton.click();
        }
      });

      console.log('[2CAPTCHA] ✅ Token injected successfully');
      return true;

    } catch (error: any) {
      console.error(`[2CAPTCHA] ❌ Injection failed: ${error.message}`);
      return false;
    }
  }

  private buildProxyConfig(): any {
    if (!this.proxyConfig) return {};

    const { server, username, password } = this.proxyConfig;
    return {
      proxy: username && password ? `${username}:${password}@${server}` : server,
      proxytype: 'HTTP'
    };
  }

  private extractTurnstileSiteKey(html: string): string | null {
    const patterns = [
      /data-sitekey=["']([0-9a-zA-Z_-]+)["']/i,
      /sitekey["']?\s*[:=]\s*["']([0-9a-zA-Z_-]+)["']/i,
      /cf-turnstile[^>]+data-sitekey=["']([0-9a-zA-Z_-]+)["']/i,
      /turnstile\.render\([^,]*,\s*\{[^}]*sitekey\s*[:=]\s*["']([0-9a-zA-Z_-]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }

    // Check iframe src
    const iframeMatch = html.match(/iframe[^>]+src=["']([^"']*challenges\.cloudflare\.com[^"']*)["']/i);
    if (iframeMatch?.[1]) {
      try {
        const url = new URL(iframeMatch[1]);
        return url.searchParams.get('k') || url.searchParams.get('sitekey');
      } catch {}
    }

    return null;
  }

  private async extractRecaptchaV2SiteKey(page: Page, html: string): Promise<string | null> {
    // Check for explicit v2 checkbox or invisible badge
    const domKey = await page.evaluate(() => {
      const container = document.querySelector('.g-recaptcha, [data-sitekey]');
      return container?.getAttribute('data-sitekey') || null;
    }).catch(() => null);

    if (domKey) return domKey;

    // Check HTML patterns
    const patterns = [
      /data-sitekey=["']([0-9a-zA-Z_-]+)["']/i,
      /grecaptcha\.render\([^,]*,\s*\{[^}]*sitekey\s*[:=]\s*["']([0-9a-zA-Z_-]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1] && !html.includes('v3')) return match[1];
    }

    return null;
  }

  private extractRecaptchaV3SiteKey(html: string): { siteKey: string | null; action?: string } {
    const patterns = [
      /grecaptcha\.execute\(["']([0-9a-zA-Z_-]+)["'],\s*\{\s*action:\s*["']([^"']+)["']/i,
      /grecaptcha\.ready.*execute\(["']([0-9a-zA-Z_-]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return { siteKey: match[1], action: match[2] || 'verify' };
      }
    }

    return { siteKey: null };
  }

  private async extractHCaptchaSiteKey(page: Page, html: string): Promise<string | null> {
    const domKey = await page.evaluate(() => {
      const container = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
      return container?.getAttribute('data-sitekey') || container?.getAttribute('data-hcaptcha-sitekey') || null;
    }).catch(() => null);

    if (domKey) return domKey;

    const patterns = [
      /data-sitekey=["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/i,
      /hcaptcha\.render\([^,]*,\s*\{[^}]*sitekey\s*[:=]\s*["']([0-9a-f-]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  }

  async getBalance(): Promise<number | null> {
    if (!this.enabled) return null;

    try {
      const balance = await this.solver.balance();
      console.log(`[2CAPTCHA] 💰 Balance: $${balance}`);
      return balance;
    } catch (error: any) {
      console.error(`[2CAPTCHA] ❌ Balance check failed: ${error.message}`);
      return null;
    }
  }
}
