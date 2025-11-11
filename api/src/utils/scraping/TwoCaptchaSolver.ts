import { Solver } from '2captcha-ts';

export interface TurnstileSolution {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Solves Cloudflare Turnstile challenges using 2Captcha service
 */
export class TwoCaptchaSolver {
  private solver: Solver;
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.TWOCAPTCHA_API_KEY;

    if (!apiKey) {
      console.log('⚠️  2Captcha API key not found. Set TWOCAPTCHA_API_KEY environment variable to enable.');
      this.enabled = false;
      this.solver = new Solver('dummy'); // Dummy key for initialization
    } else {
      console.log('✅ 2Captcha integration enabled');
      this.enabled = true;
      this.solver = new Solver(apiKey);
    }
  }

  /**
   * Check if 2Captcha is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Solve a Cloudflare Turnstile challenge
   * @param siteUrl The URL of the page with the challenge
   * @param siteKey The Turnstile site key (found in the challenge iframe)
   * @returns Promise with solution token or error
   */
  async solveTurnstile(siteUrl: string, siteKey: string): Promise<TurnstileSolution> {
    if (!this.enabled) {
      return {
        success: false,
        error: '2Captcha is not enabled. Set TWOCAPTCHA_API_KEY environment variable.'
      };
    }

    try {
      console.log('🔄 Sending Turnstile challenge to 2Captcha...');
      console.log(`   Site URL: ${siteUrl}`);
      console.log(`   Site Key: ${siteKey}`);

      // 2Captcha Turnstile solving
      const result = await this.solver.cloudflareTurnstile({
        pageurl: siteUrl,
        sitekey: siteKey,
        // Optional: add proxy if you're using one
        ...(process.env.PROXY_SERVER && {
          proxy: `${process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD
            ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@`
            : ''}${process.env.PROXY_SERVER}`,
          proxytype: 'HTTP'
        })
      });

      console.log('✅ 2Captcha solved the challenge!');
      console.log(`   Token: ${result.data.substring(0, 50)}...`);

      return {
        success: true,
        token: result.data
      };

    } catch (error: any) {
      console.error('❌ 2Captcha solving failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract Turnstile site key from page
   * @param pageContent HTML content of the page
   * @returns Site key if found, null otherwise
   */
  extractSiteKey(pageContent: string): string | null {
    // Common patterns for Turnstile site keys
    const patterns = [
      /sitekey["']?\s*[:=]\s*["']([^"']+)["']/i,
      /data-sitekey=["']([^"']+)["']/i,
      /cf-turnstile[^>]+data-sitekey=["']([^"']+)["']/i,
      /<div[^>]+data-sitekey=["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = pageContent.match(pattern);
      if (match && match[1]) {
        console.log(`✅ Found Turnstile site key: ${match[1]}`);
        return match[1];
      }
    }

    console.log('⚠️  Could not extract Turnstile site key from page');
    return null;
  }

  /**
   * Get account balance from 2Captcha
   */
  async getBalance(): Promise<number | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const balance = await this.solver.balance();
      console.log(`💰 2Captcha balance: $${balance}`);
      return balance;
    } catch (error: any) {
      console.error('❌ Could not fetch 2Captcha balance:', error.message);
      return null;
    }
  }
}
