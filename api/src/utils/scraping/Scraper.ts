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
    // Random "thinking" pause (like reading the page)
    await randomDelay(300, 800);

    // Natural mouse movement with curve
    const x1 = Math.floor(Math.random() * 500) + 100;
    const y1 = Math.floor(Math.random() * 300) + 100;
    await page.mouse.move(x1, y1, { steps: 5 });
    await randomDelay(100, 300);

    const x2 = Math.floor(Math.random() * 1200) + 300;
    const y2 = Math.floor(Math.random() * 400) + 200;
    await page.mouse.move(x2, y2, { steps: 8 });

    // Human-like scroll - gradual, not instant
    await page.evaluate(() => {
      const scrollAmount = Math.floor(Math.random() * 200) + 100;
      const scrollSteps = 5 + Math.floor(Math.random() * 5);
      const scrollPerStep = scrollAmount / scrollSteps;

      let scrolled = 0;
      const interval = setInterval(() => {
        if (scrolled >= scrollAmount) {
          clearInterval(interval);
          return;
        }
        window.scrollBy(0, scrollPerStep);
        scrolled += scrollPerStep;
      }, 30 + Math.random() * 20);
    });

    await randomDelay(400, 900);

    console.log('[HUMAN] ✅ Behavior simulation complete');
  } catch (error) {
    console.warn('[HUMAN] ⚠️  Simulation failed (non-critical)');
  }
}

// ============================================================================
// CAPTCHA HANDLING
// ============================================================================

async function handleCaptcha(state: ScraperState, currentAttempt: number, maxRetries: number): Promise<boolean> {
  console.log('[CAPTCHA] 🔍 Smart captcha check...');
  state.progressEmitter?.captchaCheck();

  if (!state.page) return false;

  // Human-like pause before checking
  await randomDelay(800, 1400);

  // SMART CHECK: If page looks good, skip expensive captcha detection
  const quickCheck = await state.page.evaluate(() => {
    const title = document.title.toLowerCase();
    const bodyText = document.body?.innerText?.toLowerCase() || '';

    // Check if we have Quizlet content (not a captcha/block page)
    const hasQuizletContent = title.includes('quizlet') &&
                              !title.includes('challenge') &&
                              !title.includes('verify') &&
                              !title.includes('captcha');

    const hasTerms = document.querySelectorAll('[class*="TermText"], [class*="SetPageTerm"]').length > 0;

    const isCaptchaPage = bodyText.includes('verify you are human') ||
                          bodyText.includes('checking your browser') ||
                          bodyText.includes('captcha') ||
                          bodyText.includes('challenge') ||
                          title.includes('attention required');

    return {
      looksGood: hasQuizletContent && !isCaptchaPage,
      hasTerms,
      isCaptchaPage
    };
  });

  // If page looks good with terms, skip captcha check entirely
  if (quickCheck.looksGood && quickCheck.hasTerms) {
    console.log('[CAPTCHA] ✅ Page has valid content, skipping captcha check');
    return true;
  }

  // If clearly a captcha page, handle it
  if (quickCheck.isCaptchaPage) {
    console.log(`[CAPTCHA] ⚠️  Captcha page detected`);
    await saveScreenshot(state, `captcha-${currentAttempt}`);

    // Retry with fresh browser on first 2 attempts
    if (currentAttempt < maxRetries) {
      console.log(`[CAPTCHA] 🔄 Retry ${currentAttempt}/${maxRetries} with fresh session`);
      state.progressEmitter?.captchaDetected('page-check', false);
      return false;
    }

    // Last attempt - try to solve
    console.log(`[CAPTCHA] 🧩 Solving (attempt ${currentAttempt})...`);
    state.progressEmitter?.captchaDetected('page-check', true);
    state.progressEmitter?.captchaSolving();

    const detection = await state.captchaSolver.detectCaptcha(state.page, state.url);
    if (!detection.detected) {
      console.log('[CAPTCHA] ⚠️  Could not detect captcha type, but page appears blocked');
      return false;
    }

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

    await randomDelay(1500, 2000);
    await Promise.race([
      state.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
      randomDelay(2500, 3000)
    ]);

    await saveScreenshot(state, 'captcha-solved');
    console.log('[CAPTCHA] ✅ Bypassed');
    state.progressEmitter?.captchaSolved();
    return true;
  }

  // Ambiguous - do full captcha detection
  console.log('[CAPTCHA] 🤔 Ambiguous page, doing full check...');
  const detection = await state.captchaSolver.detectCaptcha(state.page, state.url);

  if (!detection.detected) {
    console.log('[CAPTCHA] ✅ No captcha detected');
    return true;
  }

  // Found captcha - retry with fresh browser
  console.log(`[CAPTCHA] ⚠️  Detected: ${detection.type}`);
  if (currentAttempt < maxRetries) {
    console.log(`[CAPTCHA] 🔄 Retry ${currentAttempt}/${maxRetries} with fresh session`);
    state.progressEmitter?.captchaDetected(detection.type || 'unknown', false);
    return false;
  }

  console.log('[CAPTCHA] ✅ No captcha');
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
  let httpStatus = 0;

  try {
    // Use domcontentloaded instead of networkidle2 to avoid waiting for ads
    response = await state.page.goto(state.url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.navigation,
    });

    if (response) {
      httpStatus = response.status();
      console.log(`[NAV] 📡 Response status: ${httpStatus}`);

      if (httpStatus === 403) {
        console.warn('[NAV] ⚠️  Got 403 - likely bot detection, will retry with fresh browser');
        throw new Error('HTTP 403 - Bot detection');
      }

      if (httpStatus >= 400) {
        throw new Error(`HTTP ${httpStatus}`);
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

  // Human-like delay for SPA initialization (variable timing)
  await randomDelay(800, 1400);

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

async function extractAllTermsFromDOM(page: Page): Promise<Array<{ term: string; definition: string }>> {
  return await page.evaluate(() => {
    const results: Array<{ term: string; definition: string }> = [];

    // Use aria-label="Term" to get actual term containers
    const termContainers = document.querySelectorAll('[aria-label="Term"]');

    termContainers.forEach(container => {
      // Inside each term container, find TermText elements
      const termTexts = container.querySelectorAll('[class*="TermText"]');

      if (termTexts.length >= 2) {
        const term = termTexts[0]?.textContent?.trim() || '';
        const definition = termTexts[1]?.textContent?.trim() || '';

        if (term && definition) {
          results.push({ term, definition });
        }
      }
    });

    return results;
  });
}

export async function expandAndExtractTerms(
  page: Page,
  progressEmitter?: { termsLoading: () => void }
): Promise<Map<string, { term: string; definition: string }>> {
  console.log('[TERMS] 🔄 Starting term extraction...');
  progressEmitter?.termsLoading();

  const allTerms = new Map<string, { term: string; definition: string }>>();

  try {
    // Step 1: Get expected term count (for metrics)
    const expectedCount = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/Terms in this set[^\d]*\((\d+)\)/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    if (expectedCount) console.log(`[TERMS] 🎯 Expected: ${expectedCount} terms`);

    // Step 2: Click "See more" until all terms load
    let lastCount = 0;
    let stableRounds = 0;
    const maxStableRounds = 3;

    while (true) {
      // Close modals
      await page.evaluate(() => {
        const closeSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label="Dismiss"]',
          '.ReactModal__Overlay button[aria-label*="close" i]',
          '.ReactModal__Content button',
          '[class*="Modal"] button[aria-label="Close"]'
        ];
        for (const sel of closeSelectors) {
          const btn = document.querySelector(sel) as HTMLElement;
          if (btn && btn.offsetHeight > 0) btn.click();
        }
      });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(400, 700);

      const button = await page.$('button[aria-label="See more"]');
      if (!button) {
        console.log('[TERMS] ✅ No "See more" button found — checking for infinite scroll...');
        break;
      }

      console.log('[TERMS] 🔘 Clicking "See more"');
      await button.click();

      // Wait safely for new terms or timeout
      try {
        await page.waitForFunction(
          (prev: number) => document.querySelectorAll('[aria-label="Term"]').length > prev,
          { polling: 500, timeout: 6000 },
          lastCount
        );
      } catch {
        // ignore timeout
      }

      await randomDelay(700, 1000);

      const termCountAfter = await page.evaluate(() =>
        document.querySelectorAll('[aria-label="Term"]').length
      );

      console.log(`[TERMS] 📈 Term count: ${termCountAfter}`);

      if (termCountAfter === lastCount) {
        stableRounds++;
        console.log(`[TERMS] ⚠️ No new terms detected (${stableRounds}/${maxStableRounds})`);
      } else {
        stableRounds = 0;
        lastCount = termCountAfter;
      }

      if (stableRounds >= maxStableRounds) {
        console.log('[TERMS] 🧭 Stopping: no more new terms detected.');
        break;
      }
    }

    // Step 3: Infinite scroll fallback
    console.log('[TERMS] 🔄 Scrolling to load any remaining virtualized terms...');
    await page.evaluate(async () => {
      let prevCount = 0;
      let stable = 0;
      while (stable < 3) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 800));
        const curr = document.querySelectorAll('[aria-label="Term"]').length;
        if (curr === prevCount) stable++;
        else stable = 0;
        prevCount = curr;
      }
    });

    // Step 4: Extract terms
    console.log('[TERMS] 📦 Extracting all terms from DOM...');
    const terms = await extractAllTermsFromDOM(page);
    for (const t of terms) {
      allTerms.set(`${t.term}::${t.definition}`, t);
    }

    console.log(`[TERMS] ✅ Extraction complete: ${allTerms.size} terms extracted (expected ~${expectedCount})`);
  } catch (err: any) {
    console.warn(`[TERMS] ⚠️ Extraction error: ${err.message}`);
  }

  return allTerms;
}

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
  console.log('[TERMS] 📈 Expanding all terms...');
  progressEmitter?.termsLoading();

  try {
    // Step 1: Get the expected term count from "Terms in this set (X)"
    const expectedCount = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/Terms in this set[^\d]*\((\d+)\)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return 0;
    });

    if (expectedCount > 0) {
      console.log(`[TERMS] 🎯 Target: ${expectedCount} terms expected`);
    } else {
      console.log('[TERMS] ⚠️  Could not find expected term count');
    }

    // Step 2: Keep clicking "See more" button until there are no more buttons
    // Quizlet loads terms in batches of ~100, so we need to click multiple times
    let clickCount = 0;
    const maxClicks = 100; // Much higher safety limit for large sets
    let noButtonFoundCount = 0;

    while (clickCount < maxClicks) {
      // Scroll to bottom to make sure "See more" button is visible
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await randomDelay(400, 600);

      const buttonFound = await page.evaluate(() => {
        const button = document.querySelector('button[aria-label="See more"]') as HTMLElement;
        if (!button) return false;

        const text = button.textContent?.trim() || '';
        if (text === 'See more' && button.offsetHeight > 0) {
          button.click();
          return true;
        }
        return false;
      });

      if (!buttonFound) {
        noButtonFoundCount++;
        // Only exit if we haven't found a button 5 times in a row (very patient)
        if (noButtonFoundCount >= 5) {
          console.log('[TERMS] ✅ No more "See more" buttons found after 5 checks');
          break;
        }
        await randomDelay(700, 1000); // Wait longer and try again
        continue;
      }

      noButtonFoundCount = 0; // Reset counter if we found a button
      clickCount++;
      console.log(`[TERMS] ✅ Clicked "See more" button (${clickCount})`);

      // Wait longer for the new batch to load
      await randomDelay(1200, 1800);

      // Check current count
      const currentCount = await page.evaluate(() => {
        return Math.floor(document.querySelectorAll('[class*="TermText"]').length / 2);
      });

      console.log(`[TERMS] 📊 After click ${clickCount}: ${currentCount} terms loaded`);

      // DON'T stop clicking even if we reach expected count - keep going until no more buttons
      // This ensures we get absolutely everything
      if (expectedCount > 0 && currentCount >= expectedCount) {
        console.log(`[TERMS] ℹ️  Reached target ${currentCount}/${expectedCount}, but continuing to check for more...`);
      }
    }

    if (clickCount === 0) {
      console.log('[TERMS] ℹ️  No "See more" button found - all terms may already be visible');
    } else {
      console.log(`[TERMS] ✅ Clicked "See more" ${clickCount} times total`);
    }

  } catch (error: any) {
    console.warn(`[TERMS] ⚠️  Expansion error: ${error.message}`);
  }
}

async function extractTerms(state: ScraperState): Promise<QuizletData | null> {
  if (!state.page) return null;

  console.log('[EXTRACT] 📚 Extracting terms and title...');
  state.progressEmitter?.extractionStart();

  try {
    // Wait for initial terms to load
    await waitForTerms(state.page);

    await saveScreenshot(state, 'before-extraction');

    // Verify we have a good page (title present, not captcha)
    const pageValid = await state.page.evaluate(() => {
      const title = document.title.toLowerCase();
      const hasTitle = title.includes('quizlet') &&
                      !title.includes('captcha') &&
                      !title.includes('verify');
      return hasTitle;
    });

    if (!pageValid) {
      console.error('[EXTRACT] ❌ Page title suggests captcha or error page');
      await saveScreenshot(state, 'invalid-page');
      return null;
    }

    console.log('[EXTRACT] ✅ Valid page confirmed, extracting all terms...');

    // NEW APPROACH: Extract incrementally while clicking "See more" buttons
    const allTerms = await expandAndExtractTerms(state.page, state.progressEmitter);

    // Get expected count for verification
    const expectedCount = await state.page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/Terms in this set[^\d]*\((\d+)\)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return 0;
    });

    // Optional: If we're still missing terms, try extracting one more time
    if (expectedCount > 0 && allTerms.size < expectedCount) {
      console.log(`[EXTRACT] ⚠️  Have ${allTerms.size}/${expectedCount} terms, trying one more extraction...`);

      await randomDelay(1000, 1500);

      const finalTerms = await extractAllTermsFromDOM(state.page);
      finalTerms.forEach(t => {
        const key = `${t.term}::${t.definition}`;
        if (!allTerms.has(key)) {
          allTerms.set(key, t);
        }
      });

      console.log(`[EXTRACT] ✅ Final extraction: ${allTerms.size}/${expectedCount} terms`);
    }

    console.log(`[EXTRACT] ✅ Collected ${allTerms.size}/${expectedCount} unique terms total`);

    // Get title separately
    const title = await state.page.evaluate(() => {
      const titleSelectors = [
        'h1[class*="UIHeading"]',
        'h1[class*="SetPageTitle"]',
        '[data-testid="SetPageTitle"]',
        '.SetPage-title',
        'h1',
        '[class*="SetPage"] h1',
        'header h1',
      ];

      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent?.trim()) {
          return el.textContent.trim();
        }
      }

      // If still no title, try document.title
      if (document.title) {
        return document.title.replace(/\s*\|\s*Quizlet$/i, '').trim() || 'Untitled Set';
      }

      return 'Untitled Set';
    });

    const data = {
      title,
      terms: Array.from(allTerms.values())
    };

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
