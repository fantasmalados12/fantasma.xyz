
import puppeteer, { Browser, Page } from 'puppeteer';

interface QuizletTerm {
  term: string;
  definition: string;
}

export async function scrapeQuizlet(url: string): Promise<QuizletTerm[]> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ],
      executablePath: process.env.CHROME_PATH || undefined
    });

    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Extract all terms from the page
    const terms = await page.evaluate(() => {
      const results: Array<{ term: string; definition: string }> = [];
      const elements = document.querySelectorAll('[class*="TermText"]');
      
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
      
      return results;
    });

    return terms;
    
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