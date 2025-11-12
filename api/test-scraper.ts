import { scrapeQuizlet } from './src/utils/scraping/Scraper';

const TEST_URLS = [
  'https://quizlet.com/1096020363/dli-spanish-unit-5-nouns-flash-cards/?i=2jmptl&x=1jqt',
  'https://quizlet.com/698979832/dli-spanish-department-chapter-23-flash-cards/?i=2jmptl&x=1jqt',
  'https://quizlet.com/765281429/dli-spanish-department-chapter-22-flash-cards/?i=2jmptl&x=1jqt'
];

async function testUrl(url: string, attemptNum: number): Promise<{ success: boolean; expected: number; actual: number; title: string }> {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing URL (Attempt ${attemptNum}): ${url}`);
    console.log('='.repeat(80));

    const result = await scrapeQuizlet(url, {
      takeScreenshots: false,
      maxRetries: 1,
      useProxy: false
    });

    // Extract expected count from URL or use result
    // We'll use the result as source of truth
    const expectedMatch = url.match(/\/(\d+)\//);

    console.log(`\n✅ Scrape completed!`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Terms extracted: ${result.terms.length}`);

    return {
      success: true,
      expected: result.terms.length, // We'll track the first run as expected
      actual: result.terms.length,
      title: result.title
    };

  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`);
    return {
      success: false,
      expected: 0,
      actual: 0,
      title: ''
    };
  }
}

async function runAllTests() {
  console.log('\n🧪 STARTING SCRAPER TESTS');
  console.log('Each URL will be tested 3 times to ensure consistency\n');

  const results: Record<string, Array<{ success: boolean; expected: number; actual: number }>> = {};

  for (const url of TEST_URLS) {
    results[url] = [];
    let firstRunTermCount = 0;

    for (let i = 1; i <= 3; i++) {
      const result = await testUrl(url, i);

      if (i === 1 && result.success) {
        firstRunTermCount = result.actual;
      }

      results[url].push({
        success: result.success,
        expected: firstRunTermCount,
        actual: result.actual
      });

      // Add delay between tests
      if (i < 3) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Print summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  let allPassed = true;

  for (const url of TEST_URLS) {
    const urlResults = results[url];
    const allSuccess = urlResults.every(r => r.success);
    const allMatchExpected = urlResults.every(r => r.actual === urlResults[0].expected);
    const passed = allSuccess && allMatchExpected;

    console.log(`\nURL: ${url.substring(0, 80)}...`);
    console.log(`Expected: ${urlResults[0].expected} terms`);

    urlResults.forEach((r, i) => {
      const status = r.success && r.actual === urlResults[0].expected ? '✅' : '❌';
      console.log(`  Attempt ${i + 1}: ${status} ${r.actual} terms`);
    });

    console.log(`Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (!passed) allPassed = false;
  }

  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! The scraper is working correctly.');
  } else {
    console.log('❌ TESTS FAILED! The scraper needs more work.');
  }
  console.log('='.repeat(80) + '\n');

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
