import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { TwoCaptchaSolver } from './TwoCaptchaSolver';

puppeteer.use(StealthPlugin());

// ============================================================================
// TYPES
// ============================================================================

export interface QuizletTerm {
  term: string;
  definition: string;
}

export interface QuizletData {
  title: string;
  terms: QuizletTerm[];
}

export interface ScrapeOptions {
  takeScreenshots?: boolean;
  maxRetries?: number;
  useProxy?: boolean;
}

interface ScraperState {
  browser: Browser | null;
  page: Page | null;
  captchaSolver: TwoCaptchaSolver;
  screenshotsDir: string;
  takeScreenshots: boolean;
  url: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

const PROXY_CONFIG = {
  username: 'u613ad942568805c2-zone-custom',
  password: 'u613ad942568805c2',
  dns: '170.106.118.114',
  port: 2334
};

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--window-size=1920,1080',
  '--disable-infobars',
  '--disable-notifications',
];

const TIMEOUTS = {
  navigation: 30000, // Reduced since we're not waiting for networkidle
  captchaSolve: 120000,
  termExpansion: 20000,
  pageLoad: 15000,
  contentReady: 10000, // Time to wait for main content
};

// ============================================================================
// UTILITIES
// ============================================================================

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function saveScreenshot(state: ScraperState, name: string): Promise<string | null> {
  if (!state.takeScreenshots || !state.page) return null;

  try {
    if (!fs.existsSync(state.screenshotsDir)) {
      fs.mkdirSync(state.screenshotsDir, { recursive: true });
    }

    const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
    const filename = `${safeName}-${Date.now()}.png`;
    const fullPath = path.join(state.screenshotsDir, filename);

    await state.page.screenshot({
      path: fullPath as `${string}.png`,
      fullPage: true
    });

    console.log(`[SCREENSHOT] 📸 Saved: ${filename}`);
    return fullPath;
  } catch (error: any) {
    console.warn(`[SCREENSHOT] ⚠️  Failed: ${error.message}`);
    return null;
  }
}

// ============================================================================
// BROWSER INITIALIZATION
// ============================================================================

async function initBrowser(useProxy: boolean): Promise<Browser> {
  console.log('[BROWSER] 🚀 Launching...');

  const args = [...BROWSER_ARGS];
  if (useProxy) {
    args.push(`--proxy-server=http://${PROXY_CONFIG.dns}:${PROXY_CONFIG.port}`);
    console.log(`[BROWSER] 🌐 Using proxy: ${PROXY_CONFIG.dns}:${PROXY_CONFIG.port}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args,
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
  });

  console.log('[BROWSER] ✅ Launched successfully');
  return browser;
}

async function initPage(browser: Browser, useProxy: boolean): Promise<Page> {
  console.log('[PAGE] 📄 Creating new page...');

  const page = await browser.newPage();

  // Block unnecessary resources to speed up loading
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    const url = request.url();

    // Block ads, analytics, and other non-essential resources
    const blockedDomains = [
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'google-analytics.com',
      'googletagmanager.com',
      'facebook.com/tr',
      'connect.facebook.net',
      'analytics.',
      'ads.',
      'adservice.',
      'advertising.',
      'cdn.taboola.com',
      'outbrain.com'
    ];

    const shouldBlock =
      blockedDomains.some(domain => url.includes(domain)) ||
      resourceType === 'font' || // Block fonts to speed up
      (resourceType === 'image' && !url.includes('quizlet')); // Block external images but keep Quizlet's

    if (shouldBlock) {
      request.abort();
    } else {
      request.continue();
    }
  });

  console.log('[PAGE] 🚫 Resource blocking enabled');

  // Authenticate proxy if enabled
  if (useProxy) {
    await page.authenticate({
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password,
    });
    console.log('[PAGE] 🔐 Proxy authenticated');
  }

  // Set user agent
  const userAgent = getRandomUserAgent();
  await page.setUserAgent(userAgent);
  console.log(`[PAGE] 🎭 User agent set`);

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Inject stealth scripts
  await page.evaluateOnNewDocument(() => {
    // Override navigator properties
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // Mock chrome runtime
    (window as any).chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);
  });

  console.log('[PAGE] ✅ Initialized with stealth scripts');
  return page;
}

// ============================================================================
// HUMAN BEHAVIOR SIMULATION
// ============================================================================

async function simulateHumanBehavior(page: Page): Promise<void> {
  console.log('[HUMAN] 🤖 Simulating human behavior...');

  try {
    // Shorter, more realistic mouse movements
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 1920);
      const y = Math.floor(Math.random() * 1080);
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
      await randomDelay(50, 150);
    }

    // Random scroll
    await page.evaluate(async () => {
      const scrolls = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < scrolls; i++) {
        window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
        await new Promise(r => setTimeout(r, Math.random() * 300 + 100));
      }
    });

    console.log('[HUMAN] ✅ Behavior simulation complete');
  } catch (error) {
    console.warn('[HUMAN] ⚠️  Simulation failed (non-critical)');
  }
}

// ============================================================================
// CAPTCHA HANDLING
// ============================================================================

async function handleCaptcha(state: ScraperState): Promise<boolean> {
  console.log('[CAPTCHA] 🔍 Checking for captcha...');

  if (!state.page) return false;

  // Wait a bit for captcha to potentially appear
  await randomDelay(1500, 2000);

  // Detect captcha
  const detection = await state.captchaSolver.detectCaptcha(state.page);

  if (!detection.detected) {
    console.log('[CAPTCHA] ✅ No captcha detected');
    return true;
  }

  console.log(`[CAPTCHA] ⚠️  Detected: ${detection.type}`);
  await saveScreenshot(state, `captcha-detected-${detection.type}`);

  // Solve captcha
  const solution = await state.captchaSolver.solveCaptcha(state.url, detection);

  if (!solution.success) {
    console.error(`[CAPTCHA] ❌ Failed to solve: ${solution.error}`);
    await saveScreenshot(state, 'captcha-failed');
    return false;
  }

  // Inject solution
  const injected = await state.captchaSolver.injectSolution(state.page, solution);

  if (!injected) {
    console.error('[CAPTCHA] ❌ Failed to inject solution');
    return false;
  }

  // Wait for page to respond to captcha solution
  console.log('[CAPTCHA] ⏳ Waiting for page to process solution...');
  await randomDelay(2000, 3000);

  // Wait for navigation or content to change (use domcontentloaded to avoid waiting for ads)
  await Promise.race([
    state.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {}),
    randomDelay(4000, 5000)
  ]);

  // Give the page a moment to settle
  await randomDelay(1000, 1500);

  await saveScreenshot(state, 'captcha-solved');

  // Verify captcha is gone
  await randomDelay(1000, 1500);
  const recheck = await state.captchaSolver.detectCaptcha(state.page);

  if (recheck.detected) {
    console.warn('[CAPTCHA] ⚠️  Captcha still present after solving, may need retry');
    return false;
  }

  console.log('[CAPTCHA] ✅ Successfully bypassed');
  return true;
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

async function navigateToUrl(state: ScraperState): Promise<boolean> {
  if (!state.page) return false;

  console.log(`[NAV] 🔗 Navigating to: ${state.url}`);

  try {
    // Use domcontentloaded instead of networkidle2 to avoid waiting for ads
    const response = await state.page.goto(state.url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });

    if (!response) {
      throw new Error('No response received');
    }

    const status = response.status();
    console.log(`[NAV] 📡 Response status: ${status}`);

    if (status >= 400) {
      throw new Error(`HTTP ${status}`);
    }

    // Wait for the page to be interactive
    await state.page.waitForFunction(
      () => document.readyState === 'interactive' || document.readyState === 'complete',
      { timeout: 5000 }
    ).catch(() => {});

    // Give React/SPA more time to initialize and render
    await randomDelay(2000, 3000);

    // Check if page has actual content (not a white screen or error page)
    const pageCheck = await state.page.evaluate(() => {
      const body = document.body;
      const bodyText = body?.innerText || '';
      const bodyHTML = body?.innerHTML || '';

      return {
        hasBody: !!body,
        bodyTextLength: bodyText.length,
        bodyHTMLLength: bodyHTML.length,
        title: document.title,
        isErrorPage: bodyText.includes('Access denied') ||
                    bodyText.includes('403') ||
                    bodyText.includes('blocked') ||
                    bodyText.includes('Checking your browser'),
        hasMainContent: !!(
          document.querySelector('[class*="SetPage"]') ||
          document.querySelector('[class*="StudiableContainer"]') ||
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.querySelector('#root > div') ||
          document.querySelector('body > div')
        )
      };
    });

    console.log('[NAV] 📄 Page check:', {
      title: pageCheck.title,
      textLength: pageCheck.bodyTextLength,
      htmlLength: pageCheck.bodyHTMLLength,
      hasContent: pageCheck.hasMainContent,
      isError: pageCheck.isErrorPage
    });

    // Check for white screen or no content
    if (pageCheck.bodyTextLength < 100 && pageCheck.bodyHTMLLength < 500) {
      await saveScreenshot(state, 'white-screen');
      throw new Error('Page appears to be blank (white screen)');
    }

    // Check for error pages
    if (pageCheck.isErrorPage) {
      await saveScreenshot(state, 'error-page');
      throw new Error('Detected error page or access denied');
    }

    // Wait for Quizlet's main content with more lenient timeout
    if (!pageCheck.hasMainContent) {
      console.log('[NAV] ⏳ Waiting for main content to appear...');

      await state.page.waitForFunction(
        () => {
          // Very lenient check - just make sure there's SOMETHING
          return !!(
            document.querySelector('[class*="SetPage"]') ||
            document.querySelector('[class*="StudiableContainer"]') ||
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.querySelector('#root > div') ||
            document.querySelector('body > div > div') ||
            (document.body && document.body.children.length > 0)
          );
        },
        { timeout: 15000 }
      ).catch(() => {
        console.warn('[NAV] ⚠️  Timeout waiting for content, but continuing...');
      });
    }

    // Final check after waiting
    const finalCheck = await state.page.evaluate(() => {
      return {
        bodyText: document.body?.innerText?.substring(0, 200) || '',
        hasElements: document.body?.children?.length || 0
      };
    });

    console.log('[NAV] 📋 Final check:', {
      elements: finalCheck.hasElements,
      preview: finalCheck.bodyText.substring(0, 100)
    });

    await saveScreenshot(state, 'initial-load');
    console.log('[NAV] ✅ Navigation successful');
    return true;

  } catch (error: any) {
    console.error(`[NAV] ❌ Navigation failed: ${error.message}`);

    // Try to get page info for debugging
    if (state.page) {
      try {
        const debugInfo = await state.page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          bodyLength: document.body?.innerHTML?.length || 0,
          readyState: document.readyState
        }));
        console.error('[NAV] 🔍 Debug info:', debugInfo);
      } catch {}
    }

    await saveScreenshot(state, 'navigation-error');
    return false;
  }
}

// ============================================================================
// TERM EXTRACTION
// ============================================================================

async function waitForTerms(page: Page): Promise<boolean> {
  console.log('[TERMS] ⏳ Waiting for terms to load...');

  try {
    // Wait for any term-related elements to appear with multiple selectors
    const termSelectors = [
      '[class*="TermText"]',
      '[class*="SetPageTerm"]',
      '.SetPageTerm-term',
      '.SetPageTerm-definition',
      '[data-testid*="term"]',
      '[class*="term-container"]'
    ];

    // Try each selector
    let found = false;
    for (const selector of termSelectors) {
      const element = await page.waitForSelector(selector, { timeout: 3000 }).catch(() => null);
      if (element) {
        console.log(`[TERMS] ✅ Found terms using selector: ${selector}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn('[TERMS] ⚠️  No term elements found with known selectors');
      return false;
    }

    // Wait for terms to stabilize (no new terms appearing)
    let lastCount = 0;
    let stableCount = 0;

    for (let i = 0; i < 10; i++) {
      await randomDelay(300, 500);

      const count = await page.evaluate(() => {
        return document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length;
      });

      if (count === lastCount && count > 0) {
        stableCount++;
        if (stableCount >= 2) {
          console.log(`[TERMS] ✅ Terms stable at ${count} elements`);
          break;
        }
      } else {
        stableCount = 0;
        lastCount = count;
      }
    }

    return true;

  } catch (error) {
    console.warn('[TERMS] ⚠️  Terms may not have loaded properly');
    return false;
  }
}

async function expandAllTerms(page: Page): Promise<void> {
  console.log('[TERMS] 📈 Attempting to expand all terms...');

  try {
    // First, scroll to bottom to trigger lazy loading
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, 0);
    });

    await randomDelay(500, 800);

    // Keep clicking "See more" until there are no more buttons or terms stop increasing
    let totalClicks = 0;
    let lastCount = 0;
    const maxClicks = 50; // Safety limit to prevent infinite loops

    while (totalClicks < maxClicks) {
      // Debug: Log all buttons found on the page, specifically looking for "See more"
      const debugInfo = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"], a[href="#"], div[onclick]'));

        // Find buttons with "See more" or similar text/aria-label
        const seeMoreButtons = allButtons.filter(b => {
          const text = b.textContent?.toLowerCase().trim() || '';
          const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
          return text.includes('see') || text.includes('more') || text.includes('load') ||
                 ariaLabel.includes('see') || ariaLabel.includes('more') || ariaLabel.includes('load');
        }).map(b => ({
          text: b.textContent?.trim() || '',
          ariaLabel: b.getAttribute('aria-label') || '',
          className: b.className,
          tagName: b.tagName,
          visible: (() => {
            const style = window.getComputedStyle(b as HTMLElement);
            const rect = b.getBoundingClientRect();
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0' &&
                   rect.width > 0 &&
                   rect.height > 0;
          })(),
          disabled: b.hasAttribute('disabled')
        }));

        return {
          totalButtons: allButtons.length,
          seeMoreButtons: seeMoreButtons
        };
      });

      console.log('[TERMS] 🔍 Debug - Total buttons:', debugInfo.totalButtons);
      console.log('[TERMS] 🔍 Debug - "See more" related buttons:', JSON.stringify(debugInfo.seeMoreButtons, null, 2));

      // Wait a moment for the button to potentially appear
      await randomDelay(1000, 1500);

      // Try to find and click "See more" button
      const clickResult = await page.evaluate(() => {
        // Helper function to check if button is visible
        const isButtonVisible = (el: HTMLElement): boolean => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0' &&
                 rect.width > 0 &&
                 rect.height > 0 &&
                 !el.hasAttribute('disabled');
        };

        // Look for button with BOTH aria-label="See more" AND text="See more"
        const seeMoreButtons = document.querySelectorAll('button[aria-label="See more"]');
        console.log(`[DEBUG] Found ${seeMoreButtons.length} buttons with aria-label="See more"`);

        for (const button of Array.from(seeMoreButtons)) {
          const el = button as HTMLElement;
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';

          console.log(`[DEBUG] Checking button - Text: "${text}", Aria-label: "${ariaLabel}", Visible: ${isButtonVisible(el)}`);

          // Must have BOTH aria-label="See more" AND text content "See more"
          if (ariaLabel === 'See more' && text === 'See more' && isButtonVisible(el)) {
            console.log('[DEBUG] ✅ Found exact "See more" button (both aria-label and text match)');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.click();
            return { clicked: true, buttonText: 'See more', method: 'exact-match' };
          }
        }

        // If exact match not found, just try aria-label="See more"
        for (const button of Array.from(seeMoreButtons)) {
          const el = button as HTMLElement;
          if (isButtonVisible(el)) {
            console.log('[DEBUG] Found button with aria-label="See more" (text may differ)');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.click();
            return { clicked: true, buttonText: el.textContent?.trim() || 'See more', method: 'aria-label-only' };
          }
        }

        return { clicked: false };
      });

      if (!clickResult.clicked) {
        console.log('[TERMS] ℹ️  No more "See more" buttons found');
        break;
      }

      totalClicks++;
      console.log(`[TERMS] 🖱️  Clicked "See more" button #${totalClicks} (${clickResult.buttonText || 'via aria-label'})`);

      // Wait a bit for the click to register
      await randomDelay(500, 700);

      // Scroll to bottom to trigger lazy loading
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait longer for new terms to load (React/SPA needs time)
      await randomDelay(2000, 3000);

      // Check if term count increased
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length;
      });

      console.log(`[TERMS] 📊 Term elements: ${currentCount} (was ${lastCount})`);

      // If count hasn't increased after clicking, try waiting a bit more and check again
      if (currentCount === lastCount) {
        console.log('[TERMS] ⏳ No new terms yet, waiting a bit more...');
        await randomDelay(2000, 3000);

        const recheckedCount = await page.evaluate(() => {
          return document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length;
        });

        console.log(`[TERMS] 📊 Rechecked term elements: ${recheckedCount}`);

        if (recheckedCount === lastCount) {
          console.log('[TERMS] ✅ No new terms loaded, expansion complete');
          break;
        }

        lastCount = recheckedCount;
      } else {
        lastCount = currentCount;
      }

      // Scroll back to top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await randomDelay(300, 500);
    }

    if (totalClicks >= maxClicks) {
      console.warn(`[TERMS] ⚠️  Reached max clicks (${maxClicks}), stopping`);
    }

    // Final count
    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length;
    });

    console.log(`[TERMS] ✅ Expansion complete. Total clicks: ${totalClicks}, Final term elements: ${finalCount}`);

  } catch (error: any) {
    console.warn(`[TERMS] ⚠️  Expansion error (non-critical): ${error.message}`);
  }
}

async function extractTerms(state: ScraperState): Promise<QuizletData | null> {
  if (!state.page) return null;

  console.log('[EXTRACT] 📚 Extracting terms and title...');

  try {
    // Wait for terms
    await waitForTerms(state.page);

    // Expand all terms
    await expandAllTerms(state.page);

    await saveScreenshot(state, 'before-extraction');

    // Extract data
    const data = await state.page.evaluate(() => {
      // Extract title
      const titleSelectors = [
        'h1[class*="UIHeading"]',
        'h1[class*="SetPageTitle"]',
        '[data-testid="SetPageTitle"]',
        '.SetPage-title',
        'h1',
      ];

      let title = 'Untitled Set';
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent?.trim()) {
          title = el.textContent.trim();
          break;
        }
      }

      // If still no title, try document.title
      if (title === 'Untitled Set' && document.title) {
        title = document.title.replace(/\s*\|\s*Quizlet$/i, '').trim() || title;
      }

      // Extract terms using multiple strategies
      const results: Array<{ term: string; definition: string }> = [];

      // Strategy 1: Look for TermText class pattern
      const termTextElements = document.querySelectorAll('[class*="TermText"]');
      if (termTextElements.length >= 2) {
        const texts: string[] = [];
        termTextElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) texts.push(text);
        });

        // Pair them up (term, definition, term, definition, ...)
        for (let i = 0; i < texts.length; i += 2) {
          if (texts[i + 1]) {
            results.push({
              term: texts[i],
              definition: texts[i + 1]
            });
          }
        }
      }

      // Strategy 2: Look for SetPageTerm structure
      if (results.length === 0) {
        const termCards = document.querySelectorAll('[class*="SetPageTerm"]');
        termCards.forEach(card => {
          const termEl = card.querySelector('[class*="term"], [class*="Term"]');
          const defEl = card.querySelector('[class*="definition"], [class*="Definition"]');

          const term = termEl?.textContent?.trim();
          const definition = defEl?.textContent?.trim();

          if (term && definition) {
            results.push({ term, definition });
          }
        });
      }

      // Strategy 3: Look for specific class combinations
      if (results.length === 0) {
        const containers = document.querySelectorAll('.SetPageTerm-term, .SetPageTerm-definition');
        const texts: string[] = [];
        containers.forEach(el => {
          const text = el.textContent?.trim();
          if (text) texts.push(text);
        });

        for (let i = 0; i < texts.length; i += 2) {
          if (texts[i + 1]) {
            results.push({
              term: texts[i],
              definition: texts[i + 1]
            });
          }
        }
      }

      // Strategy 4: Look for data attributes
      if (results.length === 0) {
        const termEls = document.querySelectorAll('[data-testid*="term"]');
        termEls.forEach(el => {
          const card = el.closest('[class*="card"], [class*="Card"], [class*="term-container"]');
          if (card) {
            const termText = card.querySelector('[class*="term"]')?.textContent?.trim();
            const defText = card.querySelector('[class*="definition"]')?.textContent?.trim();

            if (termText && defText) {
              results.push({ term: termText, definition: defText });
            }
          }
        });
      }

      return {
        title,
        terms: results
      };
    });

    if (!data.terms || data.terms.length === 0) {
      console.error('[EXTRACT] ❌ No terms found');
      await saveScreenshot(state, 'no-terms-found');
      return null;
    }

    console.log(`[EXTRACT] ✅ Extracted "${data.title}" with ${data.terms.length} terms`);
    await saveScreenshot(state, 'extraction-complete');

    return data;

  } catch (error: any) {
    console.error(`[EXTRACT] ❌ Extraction failed: ${error.message}`);
    await saveScreenshot(state, 'extraction-error');
    return null;
  }
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

export async function scrapeQuizlet(
  url: string,
  options: ScrapeOptions = {}
): Promise<QuizletData> {
  const {
    takeScreenshots = false,
    maxRetries = 3,
    useProxy = true,
  } = options;

  console.log('\n' + '='.repeat(70));
  console.log('[SCRAPER] 🚀 Starting Quizlet scraper');
  console.log('[SCRAPER] 🔗 URL:', url);
  console.log('[SCRAPER] 📸 Screenshots:', takeScreenshots);
  console.log('[SCRAPER] 🌐 Proxy:', useProxy);
  console.log('[SCRAPER] 🔄 Max retries:', maxRetries);
  console.log('='.repeat(70) + '\n');

  // Initialize state
  const state: ScraperState = {
    browser: null,
    page: null,
    captchaSolver: new TwoCaptchaSolver(
      undefined,
      useProxy ? {
        server: `${PROXY_CONFIG.dns}:${PROXY_CONFIG.port}`,
        username: PROXY_CONFIG.username,
        password: PROXY_CONFIG.password,
      } : undefined
    ),
    screenshotsDir: path.join(process.cwd(), 'screenshots'),
    takeScreenshots,
    url,
  };

  // Check 2Captcha balance
  if (state.captchaSolver.isEnabled()) {
    await state.captchaSolver.getBalance().catch(() => null);
  }

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n[SCRAPER] 🔄 Attempt ${attempt}/${maxRetries}`);

    try {
      // Initialize browser
      state.browser = await initBrowser(useProxy);
      state.page = await initPage(state.browser, useProxy);

      // Navigate to URL
      const navSuccess = await navigateToUrl(state);
      if (!navSuccess) {
        throw new Error('Navigation failed');
      }

      // Quick human behavior simulation
      await simulateHumanBehavior(state.page);

      // Handle captcha (might not be present)
      const captchaHandled = await handleCaptcha(state);
      if (!captchaHandled) {
        throw new Error('Captcha handling failed');
      }

      // Extract terms (no need for extra human behavior, terms should be ready)
      const data = await extractTerms(state);
      if (!data) {
        throw new Error('Term extraction failed');
      }

      // Validate we got reasonable data
      if (data.terms.length < 3) {
        console.warn(`[SCRAPER] ⚠️  Only got ${data.terms.length} terms, might need retry`);
        throw new Error(`Insufficient terms extracted: ${data.terms.length}`);
      }

      // Success!
      console.log('\n' + '='.repeat(70));
      console.log('[SCRAPER] ✅ SUCCESS!');
      console.log(`[SCRAPER] 📚 Title: ${data.title}`);
      console.log(`[SCRAPER] 📝 Terms: ${data.terms.length}`);
      console.log('='.repeat(70) + '\n');

      return data;

    } catch (error: any) {
      lastError = error;
      console.error(`\n[SCRAPER] ❌ Attempt ${attempt} failed: ${error.message}\n`);

      if (attempt < maxRetries) {
        // Shorter delays between retries
        const delay = Math.min(3000 * attempt, 8000);
        console.log(`[SCRAPER] ⏳ Waiting ${delay}ms before retry...\n`);
        await randomDelay(delay, delay + 1000);
      }

    } finally {
      // Cleanup
      if (state.page) {
        await state.page.close().catch(() => {});
        state.page = null;
      }
      if (state.browser) {
        await state.browser.close().catch(() => {});
        state.browser = null;
      }
    }
  }

  // All retries failed
  console.log('\n' + '='.repeat(70));
  console.error('[SCRAPER] ❌ ALL ATTEMPTS FAILED');
  console.error(`[SCRAPER] 💥 Last error: ${lastError?.message}`);
  console.log('='.repeat(70) + '\n');

  throw new Error(
    `Failed to scrape Quizlet after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}
