import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { TwoCaptchaSolver } from './TwoCaptchaSolver';
import { ProgressEmitter } from './ProgressEmitter';

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
  progressEmitter?: ProgressEmitter;
}

interface ScraperState {
  browser: Browser | null;
  page: Page | null;
  captchaSolver: TwoCaptchaSolver;
  screenshotsDir: string;
  takeScreenshots: boolean;
  url: string;
  progressEmitter?: ProgressEmitter;
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
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-site-isolation-trials',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--mute-audio',
  '--disable-default-apps',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-component-extensions-with-background-pages',
];

const TIMEOUTS = {
  navigation: 12000, // Faster navigation
  captchaSolve: 90000,
  termExpansion: 6000, // Much faster
  pageLoad: 6000, // Faster page load
  contentReady: 3000, // Faster content ready
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

async function initBrowser(useProxy: boolean, progressEmitter?: ProgressEmitter): Promise<Browser> {
  console.log('[BROWSER] 🚀 Launching...');
  progressEmitter?.browserLaunch();

  const args = [...BROWSER_ARGS];
  if (useProxy) {
    args.push(`--proxy-server=http://${PROXY_CONFIG.dns}:${PROXY_CONFIG.port}`);
    console.log(`[BROWSER] 🌐 Using proxy: ${PROXY_CONFIG.dns}:${PROXY_CONFIG.port}`);
  }

  const browser = await puppeteer.launch({
    headless: 'shell', // Use new headless mode - more stealthy and faster
    args,
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Allow custom Chrome path
  });

  console.log('[BROWSER] ✅ Launched successfully');
  progressEmitter?.browserReady();
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

  // Advanced stealth scripts
  await page.evaluateOnNewDocument(() => {
    // Override navigator properties
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
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

    // Better hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // Mock chrome runtime
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);

    // Remove automation indicators
    delete (window.navigator as any).__proto__.webdriver;

    // Mock real browser properties
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 0,
    });

    // Canvas fingerprint randomization (basic)
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        // Add minimal noise
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = imageData.data[i] + Math.random() * 0.1;
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.apply(this, [type]);
    };
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
    // Faster, more realistic mouse movement
    const x = Math.floor(Math.random() * 1920);
    const y = Math.floor(Math.random() * 500) + 100; // Stay in viewport
    await page.mouse.move(x, y, { steps: 2 });

    // Minimal scroll with randomized timing
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 150) + 50);
    });

    await randomDelay(50, 150); // Much faster

    console.log('[HUMAN] ✅ Behavior simulation complete');
  } catch (error) {
    console.warn('[HUMAN] ⚠️  Simulation failed (non-critical)');
  }
}

// ============================================================================
// CAPTCHA HANDLING
// ============================================================================

async function handleCaptcha(state: ScraperState, currentAttempt: number, maxRetries: number): Promise<boolean> {
  console.log('[CAPTCHA] 🔍 Quick captcha check...');
  state.progressEmitter?.captchaCheck();

  if (!state.page) return false;

  // Minimal wait - faster detection
  await randomDelay(500, 700);

  // Detect captcha
  const detection = await state.captchaSolver.detectCaptcha(state.page, state.url);

  if (!detection.detected) {
    console.log('[CAPTCHA] ✅ No captcha');
    return true;
  }

  console.log(`[CAPTCHA] ⚠️  Detected: ${detection.type}`);
  await saveScreenshot(state, `captcha-${currentAttempt}`);

  // Retry with fresh browser on first 2 attempts (avoid captcha completely)
  const willSolve = currentAttempt >= maxRetries;
  state.progressEmitter?.captchaDetected(detection.type || 'unknown', willSolve);

  if (currentAttempt < maxRetries) {
    console.log(`[CAPTCHA] 🔄 Retry ${currentAttempt}/${maxRetries} with fresh session`);
    return false;
  }

  // Last attempt - solve it
  console.log(`[CAPTCHA] 🧩 Solving (attempt ${currentAttempt})...`);
  state.progressEmitter?.captchaSolving();

  const solution = await state.captchaSolver.solveCaptcha(state.url, detection);

  if (!solution.success) {
    console.error(`[CAPTCHA] ❌ Solve failed: ${solution.error}`);
    return false;
  }

  const injected = await state.captchaSolver.injectSolution(state.page, solution);
  if (!injected) {
    console.error('[CAPTCHA] ❌ Inject failed');
    return false;
  }

  // Fast wait for response
  await randomDelay(1000, 1500);
  await Promise.race([
    state.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
    randomDelay(2500, 3000)
  ]);

  await saveScreenshot(state, 'captcha-solved');

  // Quick verify
  const recheck = await state.captchaSolver.detectCaptcha(state.page, state.url);
  if (recheck.detected) {
    console.warn('[CAPTCHA] ⚠️  Still present');
    return false;
  }

  console.log('[CAPTCHA] ✅ Bypassed');
  state.progressEmitter?.captchaSolved();
  return true;
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

async function navigateToUrl(state: ScraperState): Promise<boolean> {
  if (!state.page) return false;

  console.log(`[NAV] 🔗 Navigating to: ${state.url}`);
  state.progressEmitter?.navigationStart(state.url);

  let navigationSucceeded = true;
  let response = null;

  try {
    // Use domcontentloaded instead of networkidle2 to avoid waiting for ads
    response = await state.page.goto(state.url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });

    if (response) {
      const status = response.status();
      console.log(`[NAV] 📡 Response status: ${status}`);

      if (status >= 400) {
        throw new Error(`HTTP ${status}`);
      }
    }
  } catch (error: any) {
    // Navigation timeout is OK if page content is loaded
    if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
      console.log('[NAV] ⚠️  Navigation timeout, checking if page loaded anyway...');
      state.progressEmitter?.navigationTimeout();
      navigationSucceeded = false;
    } else {
      throw error;
    }
  }

  // Wait for the page to be interactive (shorter timeout)
  await state.page.waitForFunction(
    () => document.readyState === 'interactive' || document.readyState === 'complete',
    { timeout: 3000 }
  ).catch(() => {});

  // Quick delay for SPA initialization
  await randomDelay(600, 900);

  try {
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
      isError: pageCheck.isErrorPage,
      navTimedOut: !navigationSucceeded
    });

    // If we have good content, accept the page even if navigation timed out
    if (!navigationSucceeded && pageCheck.bodyHTMLLength > 100000 && pageCheck.title.includes('Quizlet')) {
      console.log('[NAV] ✅ Page loaded successfully despite navigation timeout');
      state.progressEmitter?.navigationSuccess();
      await saveScreenshot(state, 'initial-load');
      return true;
    }

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

    // Wait for Quizlet's main content with shorter timeout
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
        { timeout: 8000 }
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
    state.progressEmitter?.navigationSuccess();
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

        // Check if the page is actually loaded despite the error
        if (debugInfo.bodyLength > 100000 && debugInfo.title.includes('Quizlet')) {
          console.log('[NAV] ✅ Page appears to be loaded, continuing anyway...');
          return true;
        }
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
      '[class*="StudiableCard"]',
      '[data-testid*="term"]',
    ];

    // Try selectors in parallel for speed
    const elementPromise = Promise.race(
      termSelectors.map(selector =>
        page.waitForSelector(selector, { timeout: 3000 })
          .then(() => selector)
          .catch(() => null)
      )
    );

    const foundSelector = await elementPromise;
    if (foundSelector) {
      console.log(`[TERMS] ✅ Found terms using selector: ${foundSelector}`);
    } else {
      console.log('[TERMS] ⚠️  No term elements found, but continuing...');
    }

    // Quick stabilization check - only 2 iterations
    let lastCount = 0;
    for (let i = 0; i < 2; i++) {
      await randomDelay(300, 500);

      const count = await page.evaluate(() => {
        return document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"], [class*="StudiableCard"]').length;
      });

      if (count === lastCount && count > 0) {
        console.log(`[TERMS] ✅ Terms stable at ${count} elements`);
        break;
      }
      lastCount = count;
    }

    return true;

  } catch (error) {
    console.warn('[TERMS] ⚠️  Terms may not have loaded properly, but continuing...');
    return true;
  }
}

async function expandAllTerms(page: Page, progressEmitter?: ProgressEmitter): Promise<void> {
  console.log('[TERMS] 📈 Attempting to expand all terms...');
  progressEmitter?.termsLoading();

  try {
    // Fast initial scroll to trigger lazy loading
    console.log('[TERMS] 📜 Fast scroll to load content...');
    await page.evaluate(async () => {
      // Instant scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 800));
      // Back to top
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 300));
    });

    // Keep clicking "See more" until there are no more buttons
    let totalClicks = 0;
    let lastCount = 0;
    let noButtonCount = 0;
    const maxClicks = 100;

    while (totalClicks < maxClicks) {
      // Minimal wait
      await randomDelay(400, 600);

      // Fast button detection and click
      const clickResult = await page.evaluate(() => {
        const isVisible = (el: HTMLElement): boolean => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' &&
                 style.opacity !== '0' && rect.height > 0 && !el.hasAttribute('disabled');
        };

        // Try aria-label first (fastest)
        const byAria = document.querySelector('button[aria-label="See more"]') as HTMLElement;
        if (byAria && isVisible(byAria)) {
          byAria.click();
          return { clicked: true };
        }

        // Try text match
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        for (const btn of allButtons) {
          const el = btn as HTMLElement;
          const text = el.textContent?.toLowerCase() || '';
          if ((text.includes('see') || text.includes('show')) && text.includes('more') && isVisible(el)) {
            el.click();
            return { clicked: true };
          }
        }

        return { clicked: false };
      });

      if (!clickResult.clicked) {
        noButtonCount++;
        if (noButtonCount >= 2) {
          console.log('[TERMS] ✅ No more buttons, expansion complete');
          break;
        }
        await randomDelay(500, 700);
        continue;
      }

      noButtonCount = 0;
      totalClicks++;
      console.log(`[TERMS] 🖱️  Clicked #${totalClicks}`);

      // Quick scroll after click
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(800, 1200); // Wait for content to load

      // Check count
      const currentCount = await page.evaluate(() =>
        document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length
      );

      console.log(`[TERMS] 📊 ${currentCount} elements (was ${lastCount})`);
      progressEmitter?.termsExpanding(totalClicks, currentCount);

      // If no increase after 2 clicks, we're done
      if (currentCount === lastCount && totalClicks > 1) {
        console.log('[TERMS] ✅ No new terms, done');
        break;
      }

      lastCount = currentCount;

      // Quick scroll back to top for next button
      await page.evaluate(() => window.scrollTo(0, 0));
      await randomDelay(200, 400);
    }

    // Final quick scroll
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, 0);
    });

    const finalCount = await page.evaluate(() =>
      document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length
    );

    console.log(`[TERMS] ✅ Done. ${totalClicks} clicks, ${finalCount} elements`);
    progressEmitter?.termsExpanded(finalCount);

  } catch (error: any) {
    console.warn(`[TERMS] ⚠️  Expansion error: ${error.message}`);
  }
}

async function extractTerms(state: ScraperState): Promise<QuizletData | null> {
  if (!state.page) return null;

  console.log('[EXTRACT] 📚 Extracting terms and title...');
  state.progressEmitter?.extractionStart();

  try {
    // Wait for terms
    await waitForTerms(state.page);

    // Expand all terms
    await expandAllTerms(state.page, state.progressEmitter);

    await saveScreenshot(state, 'before-extraction');

    // Extract data with improved strategies
    const data = await state.page.evaluate(() => {
      // Extract title
      const titleSelectors = [
        'h1[class*="UIHeading"]',
        'h1[class*="SetPageTitle"]',
        '[data-testid="SetPageTitle"]',
        '.SetPage-title',
        'h1',
        '[class*="SetPage"] h1',
        'header h1',
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
      const seenTerms = new Set<string>(); // Prevent duplicates

      // Strategy 1: Look for TermText class pattern (most common)
      const termTextElements = document.querySelectorAll('[class*="TermText"]');
      console.log(`[EXTRACT DEBUG] Strategy 1: Found ${termTextElements.length} TermText elements`);

      if (termTextElements.length >= 2) {
        const texts: string[] = [];
        termTextElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0) texts.push(text);
        });

        console.log(`[EXTRACT DEBUG] Strategy 1: Got ${texts.length} text items`);

        // Pair them up (term, definition, term, definition, ...)
        for (let i = 0; i < texts.length; i += 2) {
          if (texts[i] && texts[i + 1]) {
            const termKey = `${texts[i]}::${texts[i + 1]}`;
            if (!seenTerms.has(termKey)) {
              results.push({
                term: texts[i],
                definition: texts[i + 1]
              });
              seenTerms.add(termKey);
            }
          }
        }

        console.log(`[EXTRACT DEBUG] Strategy 1: Extracted ${results.length} unique terms`);
      }

      // Strategy 2: Look for SetPageTerm structure
      if (results.length === 0) {
        console.log(`[EXTRACT DEBUG] Strategy 2: Trying SetPageTerm structure...`);
        const termCards = document.querySelectorAll('[class*="SetPageTerm"]');
        console.log(`[EXTRACT DEBUG] Strategy 2: Found ${termCards.length} SetPageTerm cards`);

        termCards.forEach(card => {
          const termEl = card.querySelector('[class*="term"], [class*="Term"]');
          const defEl = card.querySelector('[class*="definition"], [class*="Definition"]');

          const term = termEl?.textContent?.trim();
          const definition = defEl?.textContent?.trim();

          if (term && definition && term.length > 0 && definition.length > 0) {
            const termKey = `${term}::${definition}`;
            if (!seenTerms.has(termKey)) {
              results.push({ term, definition });
              seenTerms.add(termKey);
            }
          }
        });

        console.log(`[EXTRACT DEBUG] Strategy 2: Extracted ${results.length} unique terms`);
      }

      // Strategy 3: Look for StudiableCard structure (newer Quizlet design)
      if (results.length === 0) {
        console.log(`[EXTRACT DEBUG] Strategy 3: Trying StudiableCard structure...`);
        const cards = document.querySelectorAll('[class*="StudiableCard"], [class*="studiable"]');
        console.log(`[EXTRACT DEBUG] Strategy 3: Found ${cards.length} StudiableCard elements`);

        cards.forEach(card => {
          // Try to find term and definition within the card
          const allText = Array.from(card.querySelectorAll('[class*="Text"]'))
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 0);

          if (allText.length >= 2) {
            const termKey = `${allText[0]}::${allText[1]}`;
            if (!seenTerms.has(termKey)) {
              results.push({
                term: allText[0] || '',
                definition: allText[1] || ''
              });
              seenTerms.add(termKey);
            }
          }
        });

        console.log(`[EXTRACT DEBUG] Strategy 3: Extracted ${results.length} unique terms`);
      }

      // Strategy 4: Look for any card-like structures
      if (results.length === 0) {
        console.log(`[EXTRACT DEBUG] Strategy 4: Trying generic card structures...`);
        const containers = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="term-container"]');
        console.log(`[EXTRACT DEBUG] Strategy 4: Found ${containers.length} card-like containers`);

        containers.forEach(container => {
          const allText = Array.from(container.querySelectorAll('div, span, p'))
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 0 && t.length < 500); // Reasonable length

          // Try to find pairs of text that could be term/definition
          if (allText.length >= 2) {
            const termKey = `${allText[0]}::${allText[1]}`;
            if (!seenTerms.has(termKey) && allText[0] !== allText[1]) {
              results.push({
                term: allText[0] || '',
                definition: allText[1] || ''
              });
              seenTerms.add(termKey);
            }
          }
        });

        console.log(`[EXTRACT DEBUG] Strategy 4: Extracted ${results.length} unique terms`);
      }

      // Strategy 5: Last resort - look for any repeated pattern in the DOM
      if (results.length === 0) {
        console.log(`[EXTRACT DEBUG] Strategy 5: Last resort - analyzing DOM patterns...`);

        // Find all divs that might contain terms
        const allDivs = document.querySelectorAll('div[class]');
        const textPairs: Array<[string, string]> = [];

        // Group elements by similar structure
        for (let i = 0; i < allDivs.length - 1; i++) {
          const current = allDivs[i];
          const next = allDivs[i + 1];

          const currentText = current.textContent?.trim() || '';
          const nextText = next.textContent?.trim() || '';

          // If both have reasonable text and similar structure, they might be a term pair
          if (currentText.length > 0 && currentText.length < 300 &&
              nextText.length > 0 && nextText.length < 500 &&
              currentText !== nextText &&
              current.className === next.className) {
            textPairs.push([currentText, nextText]);
          }
        }

        // If we found repeated patterns, use them
        if (textPairs.length > 2) {
          textPairs.forEach(([term, definition]) => {
            const termKey = `${term}::${definition}`;
            if (!seenTerms.has(termKey)) {
              results.push({ term, definition });
              seenTerms.add(termKey);
            }
          });
        }

        console.log(`[EXTRACT DEBUG] Strategy 5: Extracted ${results.length} unique terms`);
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
    state.progressEmitter?.extractionComplete(data.terms.length, data.title);
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
    progressEmitter,
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
    progressEmitter,
  };

  // Check 2Captcha balance
  if (state.captchaSolver.isEnabled()) {
    await state.captchaSolver.getBalance().catch(() => null);
  }

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n[SCRAPER] 🔄 Attempt ${attempt}/${maxRetries}`);
    progressEmitter?.attemptStart(attempt, maxRetries);

    try {
      // Initialize browser
      state.browser = await initBrowser(useProxy, progressEmitter);
      state.page = await initPage(state.browser, useProxy);

      // Navigate to URL
      const navSuccess = await navigateToUrl(state);
      if (!navSuccess) {
        throw new Error('Navigation failed');
      }

      // Quick human behavior simulation
      await simulateHumanBehavior(state.page);

      // Handle captcha (might not be present)
      const captchaHandled = await handleCaptcha(state, attempt, maxRetries);
      if (!captchaHandled) {
        throw new Error('Captcha detected - retrying with fresh browser');
      }

      // Extract terms (no need for extra human behavior, terms should be ready)
      const data = await extractTerms(state);
      if (!data) {
        throw new Error('Term extraction failed');
      }

      // Validate we got some data (lowered threshold from 3 to 1)
      if (data.terms.length < 1) {
        console.warn(`[SCRAPER] ⚠️  No terms extracted, will retry`);
        throw new Error(`No terms extracted`);
      }

      console.log(`[SCRAPER] ✅ Successfully extracted ${data.terms.length} terms`);

      // Success!
      console.log('\n' + '='.repeat(70));
      console.log('[SCRAPER] ✅ SUCCESS!');
      console.log(`[SCRAPER] 📚 Title: ${data.title}`);
      console.log(`[SCRAPER] 📝 Terms: ${data.terms.length}`);
      console.log('='.repeat(70) + '\n');

      progressEmitter?.complete();
      return data;

    } catch (error: any) {
      lastError = error;
      console.error(`\n[SCRAPER] ❌ Attempt ${attempt} failed: ${error.message}\n`);
      progressEmitter?.attemptFailed(attempt, error.message);

      if (attempt < maxRetries) {
        // Fast retry with minimal delay
        const delay = 1000 * attempt; // 1s, 2s, 3s
        console.log(`[SCRAPER] ⏳ Retry in ${delay}ms...\n`);
        await randomDelay(delay, delay + 200);
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

  const errorMessage = `Failed to scrape Quizlet after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`;
  progressEmitter?.error(errorMessage, { lastError: lastError?.message });

  throw new Error(errorMessage);
}
