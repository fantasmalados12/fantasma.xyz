
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { TwoCaptchaSolver } from './TwoCaptchaSolver';

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

// Pool of realistic user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function scrapeQuizlet(url: string): Promise<QuizletData> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  // Initialize 2Captcha solver
  const captchaSolver = new TwoCaptchaSolver();

  // Check balance if enabled
  if (captchaSolver.isEnabled()) {
    await captchaSolver.getBalance();
  }

  try {
    // Build launch args
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-infobars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      // Enhanced fingerprinting resistance
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--lang=en-US,en',
      '--font-render-hinting=none',
      // Allow all third-party iframes and disable blocking
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-for-policy'
    ];

    // Add proxy if configured via environment variables
    if (process.env.PROXY_SERVER) {
      console.log(`🌐 Using proxy: ${process.env.PROXY_SERVER}`);
      launchArgs.push(`--proxy-server=${process.env.PROXY_SERVER}`);
    }

    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
      executablePath: process.env.CHROME_PATH || undefined,
      ignoreDefaultArgs: ['--enable-automation']
    });

    page = await browser.newPage();

    // Authenticate proxy if credentials are provided
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      });
    }

    // Allow all third-party content and disable content blocking
    await page.setBypassCSP(true);

    // Set a randomized user agent for better rotation
    const selectedUserAgent = getRandomUserAgent();
    console.log(`🎭 Using User-Agent: ${selectedUserAgent}`);
    await page.setUserAgent(selectedUserAgent);
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

    // Comprehensive anti-detection measures with enhanced fingerprinting
    await page.evaluateOnNewDocument(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Add mouse movement tracking to appear more human
      let mouseMovements: any[] = [];
      let clickCount = 0;
      let keyPresses = 0;

      // Track mouse movements
      document.addEventListener('mousemove', (e) => {
        mouseMovements.push({ x: e.clientX, y: e.clientY, time: Date.now() });
        if (mouseMovements.length > 100) {
          mouseMovements.shift();
        }
      });

      document.addEventListener('click', () => {
        clickCount++;
      });

      document.addEventListener('keydown', () => {
        keyPresses++;
      });

      // Override automation detection properties
      (window as any).isAutomated = false;
      (navigator as any).automation = undefined;

      // Mock chrome runtime
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Enhanced plugins list to appear more realistic
      Object.defineProperty(navigator, 'plugins', {
        get: () => ({
          length: 5,
          0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          3: { name: 'Chromium PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          4: { name: 'Microsoft Edge PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
        }),
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Add platform info (randomize between common platforms)
      const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
      Object.defineProperty(navigator, 'platform', {
        get: () => platforms[Math.floor(Math.random() * platforms.length)],
      });

      // Add hardware concurrency (randomize to appear more natural)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)],
      });

      // Add device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
      });

      // Mock WebGL vendor and renderer to avoid headless detection
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      // Override WebGL2 as well
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter2.call(this, parameter);
      };

      // Add more realistic battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        })
      });

      // Mock connection API
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 100,
          downlink: 10,
          saveData: false
        })
      });

      // Override headless-specific properties
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0
      });

      // Mock media devices
      Object.defineProperty(navigator, 'mediaDevices', {
        get: () => ({
          enumerateDevices: () => Promise.resolve([
            { deviceId: 'default', kind: 'audioinput', label: 'Default', groupId: 'group1' },
            { deviceId: 'default', kind: 'audiooutput', label: 'Default', groupId: 'group1' },
            { deviceId: 'default', kind: 'videoinput', label: 'Default', groupId: 'group2' }
          ]),
          getUserMedia: () => Promise.resolve({} as MediaStream),
          getSupportedConstraints: () => ({})
        })
      });

      // Add screen properties that look realistic
      Object.defineProperty(window.screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(window.screen, 'availHeight', { get: () => 1080 });
      Object.defineProperty(window.screen, 'width', { get: () => 1920 });
      Object.defineProperty(window.screen, 'height', { get: () => 1080 });
      Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });

      // Mock notification permissions
      Object.defineProperty(Notification, 'permission', {
        get: () => 'default'
      });
    });

    // Navigate to the page
    console.log('Navigating to URL...');
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Take initial screenshot for debugging
    console.log('Taking initial screenshot...');
    const initialScreenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    console.log('\n=== INITIAL PAGE SCREENSHOT (Base64) ===');
    console.log(initialScreenshot);
    console.log('=== END SCREENSHOT ===\n');

    // Simulate extensive mouse movement to build behavior profile
    console.log('Building human behavior profile with mouse movements...');
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 1920;
      const y = Math.random() * 1080;
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    }

    // Add some random clicks to build interaction history
    await page.mouse.click(500 + Math.random() * 100, 300 + Math.random() * 100);
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    await page.mouse.click(700 + Math.random() * 100, 400 + Math.random() * 100);
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));

    // Add keyboard events to simulate real user
    await page.keyboard.press('Tab');
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

    // Simulate scrolling behavior
    await page.evaluate(() => {
      window.scrollBy(0, 100);
    });
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    await page.evaluate(() => {
      window.scrollBy(0, -50);
    });
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));

    // Check if we hit Cloudflare challenge and handle it
    let cloudflareDetected = false;
    let waitAttempts = 0;
    const maxWaitAttempts = 30; // Wait up to ~150 seconds for Cloudflare

    do {
      cloudflareDetected = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();
        const html = document.documentElement.innerHTML.toLowerCase();

        // Check for Cloudflare challenge indicators
        const isChallenge = title.includes('one more step') ||
               title.includes('just a moment') ||
               title.includes('attention required') ||
               bodyText.includes('checking your browser') ||
               bodyText.includes('verify you are human') ||
               bodyText.includes('enable javascript and cookies') ||
               bodyText.includes('unblock') ||
               bodyText.includes('challenges.cloudflare.com') ||
               html.includes('cloudflare') ||
               html.includes('cf-challenge') ||
               html.includes('cf_chl_opt');

        // Log what we found for debugging
        if (isChallenge) {
          console.log('Challenge detection details:');
          console.log('- Title:', title);
          console.log('- Body includes "unblock":', bodyText.includes('unblock'));
          console.log('- Body includes "challenges.cloudflare.com":', bodyText.includes('challenges.cloudflare.com'));
        }

        return isChallenge;
      });

      if (cloudflareDetected) {
        console.log(`\n🛡️  Cloudflare challenge detected (attempt ${waitAttempts + 1}/${maxWaitAttempts})`);

        // Get page content for debugging
        const pageContent = await page.evaluate(() => {
          return {
            title: document.title,
            bodyText: document.body.innerText.substring(0, 500),
            iframeCount: document.querySelectorAll('iframe').length,
            iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(iframe => iframe.src)
          };
        });
        console.log('Page details:', JSON.stringify(pageContent, null, 2));

        // Take screenshot of the challenge
        const challengeScreenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
        console.log('\n=== CLOUDFLARE CHALLENGE SCREENSHOT (Base64) ===');
        console.log(challengeScreenshot);
        console.log('=== END SCREENSHOT ===\n');

        // Look for and click the "I'm not a robot" checkbox
        console.log('Looking for challenge checkbox/button...');
        const clickedChallenge = await page.evaluate(() => {
          // Try to find various Cloudflare challenge elements
          const selectors = [
            'input[type="checkbox"]',
            'iframe[src*="challenges.cloudflare.com"]',
            'iframe[title*="widget"]',
            '#cf-challenge-running',
            '.cf-turnstile',
            '[name="cf-turnstile-response"]',
            'button[type="submit"]',
            'input[value="Verify"]',
            '.challenge-form button'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector) as HTMLElement;
            if (element) {
              console.log(`Found element with selector: ${selector}`);

              // If it's an input checkbox, click it
              if (element.tagName === 'INPUT' && (element as HTMLInputElement).type === 'checkbox') {
                console.log('Clicking checkbox...');
                element.click();
                return true;
              }

              // If it's a button, click it
              if (element.tagName === 'BUTTON') {
                console.log('Clicking button...');
                element.click();
                return true;
              }
            }
          }

          return false;
        });

        // Wait for iframe to appear if needed
        try {
          console.log('Waiting for challenge iframe to load...');
          await page.waitForSelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]', {
            timeout: 10000
          }).catch(() => {
            console.log('No iframe found with waitForSelector, checking existing frames...');
          });
        } catch (e) {
          console.log('Timeout waiting for iframe, continuing anyway...');
        }

        // Try to find and interact with iframe-based challenges (like Turnstile)
        const frames = page.frames();
        console.log(`Found ${frames.length} frames on page`);

        for (const frame of frames) {
          try {
            const frameUrl = frame.url();
            console.log(`Checking frame: ${frameUrl}`);

            if (frameUrl.includes('challenges.cloudflare.com') || frameUrl.includes('turnstile')) {
              console.log('Found Cloudflare challenge iframe, attempting to interact...');

              // Wait longer for the iframe to fully load
              await new Promise(resolve => setTimeout(resolve, 3000));

              // Get the iframe element to find its position
              const iframeElement = await page.$(`iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]`);

              if (iframeElement) {
                // Get the bounding box of the iframe
                const box = await iframeElement.boundingBox();

                if (box) {
                  console.log(`Iframe found at position: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

                  // Click in the center of the iframe with realistic coordinates
                  // Use slightly off-center to appear more human
                  const clickX = box.x + (box.width / 2) + (Math.random() * 10 - 5);
                  const clickY = box.y + (box.height / 2) + (Math.random() * 10 - 5);

                  console.log(`Clicking iframe at coordinates: (${clickX.toFixed(2)}, ${clickY.toFixed(2)})`);

                  // Move mouse to the position naturally with human-like curve
                  const startX = Math.random() * 500;
                  const startY = Math.random() * 500;

                  await page.mouse.move(startX, startY);
                  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

                  // Move in multiple steps to create a curved path
                  const steps = 20;
                  for (let i = 1; i <= steps; i++) {
                    const progress = i / steps;
                    const currentX = startX + (clickX - startX) * progress;
                    const currentY = startY + (clickY - startY) * progress;
                    await page.mouse.move(currentX, currentY);
                    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
                  }

                  // Pause before clicking (human behavior)
                  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

                  // Click with realistic timing
                  await page.mouse.down();
                  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
                  await page.mouse.up();

                  console.log('✅ Clicked on challenge iframe with mouse coordinates');

                  // Wait a moment after click
                  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
                }
              }

              // Also try to click inside the iframe content with detailed debugging
              const iframeContent = await frame.evaluate(() => {
                const html = document.documentElement.innerHTML;
                const bodyText = document.body ? document.body.innerText : '';

                // Log what we see in the iframe
                console.log('Iframe body text:', bodyText.substring(0, 200));
                console.log('Iframe has checkbox:', !!document.querySelector('input[type="checkbox"]'));
                console.log('Iframe has button:', !!document.querySelector('button'));
                console.log('Iframe has clickable div:', !!document.querySelector('[role="button"]'));

                return {
                  bodyText: bodyText.substring(0, 200),
                  hasCheckbox: !!document.querySelector('input[type="checkbox"]'),
                  hasButton: !!document.querySelector('button'),
                  htmlLength: html.length
                };
              }).catch(() => null);

              console.log('Iframe content analysis:', iframeContent);

              // Try multiple clicking strategies
              const clicked = await frame.evaluate(() => {
                const checkbox = document.querySelector('input[type="checkbox"]');
                const button = document.querySelector('button');
                const clickableDiv = document.querySelector('[role="button"]');
                const span = document.querySelector('span');
                const label = document.querySelector('label');

                // Try checkbox
                if (checkbox) {
                  console.log('Found and clicking checkbox in iframe...');
                  (checkbox as HTMLElement).click();
                  setTimeout(() => (checkbox as HTMLElement).click(), 100); // Double click
                  return 'checkbox';
                }

                // Try button
                if (button) {
                  console.log('Found and clicking button in iframe...');
                  (button as HTMLElement).click();
                  setTimeout(() => (button as HTMLElement).click(), 100); // Double click
                  return 'button';
                }

                // Try clickable div
                if (clickableDiv) {
                  console.log('Found and clicking clickable div in iframe...');
                  (clickableDiv as HTMLElement).click();
                  return 'clickable-div';
                }

                // Try label (common for Turnstile)
                if (label) {
                  console.log('Found and clicking label in iframe...');
                  (label as HTMLElement).click();
                  return 'label';
                }

                // Try span
                if (span) {
                  console.log('Found and clicking span in iframe...');
                  (span as HTMLElement).click();
                  return 'span';
                }

                // Last resort: click center of body
                const body = document.body;
                if (body) {
                  console.log('Clicking body center in iframe...');
                  const rect = body.getBoundingClientRect();
                  const x = rect.width / 2;
                  const y = rect.height / 2;

                  const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y
                  });
                  body.dispatchEvent(clickEvent);
                  return 'body-event';
                }

                return null;
              }).catch((e) => {
                console.log('Error clicking in iframe:', e);
                return null;
              });

              if (clicked) {
                console.log(`✅ Successfully clicked challenge element in iframe (type: ${clicked})`);
              } else {
                console.log('⚠️ Could not find clickable element in iframe');
              }

              // Wait longer after clicking to let the challenge process and verify
              console.log('Waiting for challenge to process...');

              // Wait up to 15 seconds, checking status every 3 seconds
              let processingAttempts = 0;
              const maxProcessingAttempts = 5;
              let stillProcessing = true;

              while (processingAttempts < maxProcessingAttempts && stillProcessing) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                processingAttempts++;

                // Check if challenge was solved
                const challengeStatus = await frame.evaluate(() => {
                  const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
                  const hasSpinner = document.querySelector('[class*="spinner"]') ||
                                    document.querySelector('[class*="loading"]') ||
                                    document.querySelector('svg[class*="animate"]');

                  return {
                    bodyText: bodyText.substring(0, 150),
                    hasSuccess: bodyText.includes('success') || bodyText.includes('verified'),
                    hasError: bodyText.includes('error') || bodyText.includes('failed'),
                    hasStuck: bodyText.includes('stuck here'),
                    hasFeedback: bodyText.includes('send feedback'),
                    hasSpinner: !!hasSpinner
                  };
                }).catch(() => ({
                  bodyText: '',
                  hasSuccess: false,
                  hasError: false,
                  hasStuck: false,
                  hasFeedback: false,
                  hasSpinner: false
                }));

                console.log(`Challenge status (attempt ${processingAttempts}/${maxProcessingAttempts}):`, challengeStatus);

                // If we see success, stop waiting
                if (challengeStatus.hasSuccess) {
                  console.log('✅ Challenge solved successfully!');
                  stillProcessing = false;
                  break;
                }

                // If stuck, this likely means bot detection - try 2Captcha if enabled
                if (challengeStatus.hasStuck || challengeStatus.hasFeedback) {
                  console.log('⚠️ Challenge appears stuck - Cloudflare may have detected automation');

                  if (captchaSolver.isEnabled()) {
                    console.log('🔄 Attempting to solve with 2Captcha service...');

                    // Get the page HTML to extract site key
                    const pageHtml = await page.content();
                    const siteKey = captchaSolver.extractSiteKey(pageHtml);

                    if (siteKey) {
                      const solution = await captchaSolver.solveTurnstile(url, siteKey);

                      if (solution.success && solution.token) {
                        console.log('✅ Got solution from 2Captcha, injecting token...');

                        // Inject the solution token into the page
                        const injected = await frame.evaluate((token) => {
                          // Find the Turnstile response input
                          const responseInput = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement;
                          if (responseInput) {
                            responseInput.value = token;
                            console.log('Injected 2Captcha token into response input');

                            // Trigger change event
                            const event = new Event('change', { bubbles: true });
                            responseInput.dispatchEvent(event);

                            // Try to find and click submit button
                            const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
                            if (submitButton) {
                              submitButton.click();
                              console.log('Clicked submit button');
                            }

                            return true;
                          }
                          return false;
                        }, solution.token).catch(() => false);

                        if (injected) {
                          console.log('✅ Token injected successfully, waiting for verification...');
                          await new Promise(resolve => setTimeout(resolve, 3000));
                        } else {
                          console.log('⚠️ Could not inject token - response input not found');
                        }
                      } else {
                        console.log('❌ 2Captcha failed to solve:', solution.error);
                        console.log('💡 Recommendation: Check your 2Captcha balance and API key');
                      }
                    } else {
                      console.log('⚠️ Could not find Turnstile site key in page HTML');
                    }
                  } else {
                    console.log('💡 Recommendation: Use 2Captcha service or a residential proxy');
                    console.log('   Set TWOCAPTCHA_API_KEY environment variable to enable 2Captcha');
                  }

                  stillProcessing = false;
                  break;
                }

                // If no spinner and no stuck message, might have passed
                if (!challengeStatus.hasSpinner && !challengeStatus.hasStuck) {
                  console.log('✅ No spinner detected, challenge may be complete');
                  stillProcessing = false;
                  break;
                }

                console.log('Challenge still processing, waiting...');
              }

              if (stillProcessing) {
                console.log('⏱️ Challenge processing timed out after 15 seconds');
              }
            }
          } catch (e) {
            // Frame might not be accessible, continue
            console.log(`Could not interact with frame: ${e}`);
          }
        }

        if (clickedChallenge) {
          console.log('✅ Clicked challenge element');
        } else {
          console.log('⚠️  No clickable challenge element found');
        }

        // Check if we've actually passed the challenge on the main page
        const mainPagePassed = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          const title = document.title.toLowerCase();

          // Check if we're now on the actual content page
          const hasQuizletContent = bodyText.includes('terms in this set') ||
                                   bodyText.includes('quizlet') ||
                                   document.querySelectorAll('[class*="TermText"]').length > 0;

          const noChallengeText = !bodyText.includes('one more step') &&
                                 !bodyText.includes('checking your browser') &&
                                 !bodyText.includes('unblock');

          return hasQuizletContent || (noChallengeText && !title.includes('just a moment'));
        });

        if (mainPagePassed) {
          console.log('✅ Challenge appears to be passed! Main page shows content.');
          cloudflareDetected = false;
          break;
        }

        // Simulate realistic mouse movement during the wait
        const randomX = 300 + Math.floor(Math.random() * 700);
        const randomY = 200 + Math.floor(Math.random() * 600);
        await page.mouse.move(randomX, randomY);

        // Wait before checking again (reduced since we're checking more frequently)
        await new Promise(resolve => setTimeout(resolve, 3000));
        waitAttempts++;
      }
    } while (cloudflareDetected && waitAttempts < maxWaitAttempts);

    if (cloudflareDetected) {
      console.error('\n❌ Failed to bypass Cloudflare after maximum wait time');

      // Take final screenshot for debugging
      const finalScreenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
      console.log('\n=== FINAL CLOUDFLARE CHALLENGE SCREENSHOT (Base64) ===');
      console.log(finalScreenshot);
      console.log('=== END SCREENSHOT ===\n');

      throw new Error('Failed to bypass Cloudflare challenge');
    }

    console.log('✅ Successfully passed Cloudflare challenge (if any)');

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