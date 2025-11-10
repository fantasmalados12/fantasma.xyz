
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

interface QuizletTerm {
  term: string;
  definition: string;
}

interface QuizletData {
  title: string;
  terms: QuizletTerm[];
}

export async function scrapeQuizlet(url: string): Promise<QuizletData> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true, // Use standard headless for Chromium compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-sync',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-gpu',
        '--single-process', // Important for Docker environments
        '--no-zygote'
      ],
      executablePath: process.env.CHROME_PATH || undefined,
      ignoreDefaultArgs: ['--enable-automation']
    });

    page = await browser.newPage();

    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });

    // Set extra headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"'
    });

    // Comprehensive anti-detection measures
    await page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock chrome runtime
      (window as any).chrome = {
        runtime: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Override plugins length
      Object.defineProperty(navigator, 'plugins', {
        get: () => ({
          length: 3,
          0: { name: 'Chrome PDF Plugin' },
          1: { name: 'Chrome PDF Viewer' },
          2: { name: 'Native Client' }
        }),
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Add platform info
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });

      // Add hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Add device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
    });

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 90000
    });

    // Simulate mouse movement to appear more human-like
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);

    // Check if we hit Cloudflare challenge and wait it out
    let cloudflareDetected = false;
    let waitAttempts = 0;
    const maxWaitAttempts = 24; // Wait up to ~120 seconds for Cloudflare

    do {
      cloudflareDetected = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();

        // Check for Cloudflare challenge indicators
        return title.includes('one more step') ||
               title.includes('just a moment') ||
               title.includes('attention required') ||
               bodyText.includes('checking your browser') ||
               (bodyText.includes('cloudflare') && bodyText.includes('checking'));
      });

      if (cloudflareDetected) {
        console.log(`Cloudflare challenge detected, waiting... (attempt ${waitAttempts + 1}/${maxWaitAttempts})`);

        // Simulate some mouse movement during the wait
        await page.mouse.move(
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 800)
        );

        await new Promise(resolve => setTimeout(resolve, 5000));
        waitAttempts++;
      }
    } while (cloudflareDetected && waitAttempts < maxWaitAttempts);

    if (cloudflareDetected) {
      console.error('Failed to bypass Cloudflare after maximum wait time');

      // Take a screenshot for debugging if possible
      try {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.log('Screenshot taken (base64 length):', screenshot.length);
      } catch (e) {
        console.log('Could not take screenshot');
      }
    }

    // Additional wait for content to load with a more human-like delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    // Scroll down slowly to simulate human behavior
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Click "See more" button repeatedly to load all terms
    let clickedButton = true;
    let clickCount = 0;

    while (clickedButton && clickCount < 50) {
      clickedButton = await page.evaluate(() => {
        const button = document.querySelector('button[aria-label="see more"]') ||
                      document.querySelector('button[title="See more"]');

        if (button) {
          (button as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });

          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              if (button && (button as HTMLElement).offsetParent !== null) {
                (button as HTMLElement).click();
                resolve(true);
              } else {
                resolve(false);
              }
            }, 500);
          });
        }

        return false;
      });

      if (clickedButton) {
        clickCount++;
        // Random delay between 1-2.5 seconds to appear more human
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
      }
    }
    
    // Extract title and all terms from the page
    const quizletData = await page.evaluate(() => {
      const results: Array<{ term: string; definition: string }> = [];
      const elements = document.querySelectorAll('[class*="TermText"]');

      // Extract the title from the page with extensive debugging
      let title = 'Untitled Set';

      // Try multiple selectors and log what we find
      const selectors = [
        'h1[class*="UIHeading"]',
        'h1',
        '[class*="SetTitle"]',
        '[class*="UITitle"]',
        'span[class*="UIHeading"]',
        'div[class*="SetPage-title"]',
        '[data-testid="SetPageTitle"]'
      ];

      let foundTitle = false;
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim()) {
          console.log(`Found title with selector "${selector}": "${element.textContent.trim()}"`);
          if (!foundTitle) {
            title = element.textContent.trim();
            foundTitle = true;
          }
        }
      }

      console.log(`Final title selected: "${title}"`);

      if (elements.length > 0) {
        const textArray: string[] = [];

        elements.forEach((el) => {
          const text = el.textContent?.trim();
          if (text) {
            textArray.push(text);
          }
        });

        // Pair them up - terms and definitions alternate
        for (let i = 0; i < textArray.length - 1; i += 2) {
          if (textArray[i] && textArray[i + 1]) {
            results.push({
              term: textArray[i],
              definition: textArray[i + 1]
            });
          }
        }
      }

      return { title, terms: results };
    });

    console.log(`Scraped title from Quizlet: "${quizletData.title}"`);
    console.log(`Scraped ${quizletData.terms.length} terms`);

    return quizletData;
    
  } catch (error) {
    throw error;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}