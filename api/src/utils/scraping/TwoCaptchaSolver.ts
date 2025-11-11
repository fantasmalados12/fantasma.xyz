import { Solver } from '2captcha-ts';
import { Page } from 'puppeteer';

export interface CaptchaSolution {
  success: boolean;
  token?: string;
  error?: string;
  type?: 'turnstile' | 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'geetest' | 'datadome';
}

export interface CaptchaDetectionResult {
  detected: boolean;
  type: 'turnstile' | 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | 'geetest' | 'datadome' | null;
  siteKey: string | null;
  action?: string; // For reCAPTCHA v3
  gt?: string; // For GeeTest
  challenge?: string; // For GeeTest
  captchaUrl?: string; // For DataDome
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

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

    // Check for DataDome first (press & hold type)
    const datadomeData = await this.extractDataDomeInfo(page, html);
    if (datadomeData.captchaUrl) {
      console.log('[2CAPTCHA] 🔍 Detected: DataDome (Press & Hold)');
      return { detected: true, type: 'datadome', siteKey: null, captchaUrl: datadomeData.captchaUrl };
    }

    // Check for GeeTest (another press & hold type)
    const geetestData = await this.extractGeeTestInfo(page, html);
    if (geetestData.gt) {
      console.log('[2CAPTCHA] 🔍 Detected: GeeTest');
      return {
        detected: true,
        type: 'geetest',
        siteKey: geetestData.gt,
        gt: geetestData.gt,
        challenge: geetestData.challenge || undefined
      };
    }

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

    if (!detection.detected) {
      return { success: false, error: 'No captcha detected' };
    }

    // Validate required parameters based on captcha type
    if (detection.type === 'datadome' && !detection.captchaUrl) {
      return { success: false, error: 'DataDome captcha URL required' };
    }

    if (detection.type === 'geetest' && (!detection.gt || !detection.challenge)) {
      return { success: false, error: 'GeeTest parameters (gt/challenge) required' };
    }

    if (['turnstile', 'recaptcha-v2', 'recaptcha-v3', 'hcaptcha'].includes(detection.type || '') && !detection.siteKey) {
      return { success: false, error: 'Site key required' };
    }

    console.log(`[2CAPTCHA] 🔄 Solving ${detection.type}...`);
    console.log(`[2CAPTCHA]    URL: ${url}`);
    console.log(`[2CAPTCHA]    Site Key: ${detection.siteKey}`);

    try {
      let result: any;
      const proxyConfig = this.buildProxyConfig();

      switch (detection.type) {
        case 'datadome':
          // DataDome requires the captcha URL and user agent
          if (!detection.captchaUrl) {
            return { success: false, error: 'DataDome captcha URL not found' };
          }
          console.log(detection.captchaUrl, proxyConfig)
          result = await this.solver.dataDome({
            pageurl: url,
            captcha_url: detection.captchaUrl,
            userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            ...proxyConfig
          });
          break;

        case 'geetest':
          // GeeTest requires gt and challenge parameters
          if (!detection.gt || !detection.challenge) {
            return { success: false, error: 'GeeTest parameters (gt/challenge) not found' };
          }
          result = await this.solver.geetest({
            pageurl: url,
            gt: detection.gt,
            challenge: detection.challenge,
            ...proxyConfig
          });
          break;

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
        case 'datadome':
          // DataDome typically auto-validates, just wait for redirect or reload
          console.log('[2CAPTCHA] 💉 DataDome solution received, waiting for auto-validation...');
          await page.evaluate((token: string) => {
            // Set the cookie if needed
            const win = window as any;
            if (win.dataDomeOptions) {
              win.dataDomeOptions.responsePageUrl = token;
            }
          }, solution.token);
          break;

        case 'geetest':
          await page.evaluate((token: string) => {
            // GeeTest response is typically handled via callback
            const win = window as any;
            if (win.geetest_challenge) {
              win.geetest_challenge.verify(token);
            }
          }, solution.token);
          break;

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

  private async extractDataDomeInfo(page: Page, html: string): Promise<{ captchaUrl: string | null }> {
    // Check for DataDome patterns
    const hasDataDomeText = html.includes('Press & Hold') ||
                           html.includes('press and hold') ||
                           html.includes('datadome') ||
                           html.includes('DataDome');

    if (!hasDataDomeText) {
      return { captchaUrl: null };
    }

    // Try to get the captcha URL from the page
    const captchaUrl = await page.evaluate(() => {
      // Check for DataDome-specific elements
      const datadomeElement = document.querySelector('[data-datadome], #datadome, .datadome');
      if (datadomeElement) {
        return window.location.href;
      }

      // Check for the "Press & Hold" text
      const bodyText = document.body.innerText;
      if (bodyText.includes('Press & Hold') || bodyText.includes('press and hold')) {
        return window.location.href;
      }

      return null;
    }).catch(() => null);

    return { captchaUrl };
  }

  private async extractGeeTestInfo(page: Page, html: string): Promise<{ gt: string | null; challenge: string | null }> {
    // Check for GeeTest patterns
    const hasGeeTest = html.includes('geetest') || html.includes('GeeTest');

    if (!hasGeeTest) {
      return { gt: null, challenge: null };
    }

    // Try to extract GeeTest parameters
    const geetestData = await page.evaluate(() => {
      // Check window object for GeeTest config
      const win = window as any;
      if (win.gt_custom_ajax) {
        return {
          gt: win.gt_custom_ajax.gt || null,
          challenge: win.gt_custom_ajax.challenge || null
        };
      }

      // Try to find it in script tags
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || '';
        const gtMatch = content.match(/gt['":\s]+['"]([a-f0-9]{32})['"]/i);
        const challengeMatch = content.match(/challenge['":\s]+['"]([a-f0-9]{32})['"]/i);

        if (gtMatch && challengeMatch) {
          return {
            gt: gtMatch[1],
            challenge: challengeMatch[1]
          };
        }
      }

      return { gt: null, challenge: null };
    }).catch(() => ({ gt: null, challenge: null }));

    return geetestData;
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
