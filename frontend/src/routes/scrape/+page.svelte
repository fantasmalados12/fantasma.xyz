
<script lang="ts">
    import { getCognateScore } from "../../utils/extras/Cognates";
    import { addLibrarySet, getIrregularVerbs, getStemChangingVerbs } from "../../utils/LibrarySets";
    import { getVerbConjugations, scrapeURL } from "../../utils/Scraper";
    import { scrapeURLStream, type ProgressEvent } from "../../utils/ScraperStream";
    import { authStore } from "../../utils/authStore.svelte";
    import { onMount } from "svelte";
    import { importCSV } from "../../utils/CSVImporter";
    import { goto } from "$app/navigation";
    import WordInfoModal from "../../components/WordInfoModal.svelte";

    // Import method selection
    let importMethod: 'scrape' | 'csv' = 'csv';  // Default to CSV
    let csvEnabled: boolean = true;
    let scrapeEnabled: boolean = true;

    let url: string;
    let csvText: string = '';
    let csvTitle: string = '';
    let vocabResults: any;
    let vocabularySet: any;
    let setTitle: string = '';
    let loading: boolean = false;
    let showConjugations: boolean = false;
    let conjugations: any = {};
    let showAddLibraryConfirmation: boolean = false;
    let irregularVerbs: Map<string, boolean> = new Map();
    let stemChangingVerbs: Map<string, boolean> = new Map();
    let showWordInfo = false;
    let selectedWord = '';

    // Fetch import capabilities on mount
    onMount(async () => {
        try {
            const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://fantasma.xyz/api';
            const response = await fetch(`${apiUrl}/config/import`);
            const capabilities = await response.json();

            csvEnabled = capabilities.csvEnabled;
            scrapeEnabled = capabilities.scrapeEnabled;

            // Set default import method based on what's enabled
            if (!csvEnabled && scrapeEnabled) {
                importMethod = 'scrape';
            } else {
                importMethod = 'csv';
            }
        } catch (error) {
            console.error('Failed to fetch import capabilities:', error);
            // Default to both enabled on error
        }
    });

    // Progress tracking
    let progressMessage: string = '';
    let progressPercent: number = 0;
    let currentPhase: string = '';
    let showProgress: boolean = false;
    let abortScrape: (() => void) | null = null;

    // Error modal
    let showErrorModal: boolean = false;
    let errorMessage: string = '';
    let errorDetails: string = '';

    async function checkIrregularVerbs() {
        // Get all verb terms from the vocabulary set
        const verbs = vocabularySet.filter((term: any) => term.pos === 'verb');

        // Check each verb if it's irregular
        for (const verb of verbs) {
            try {
                const response = await getIrregularVerbs(verb.term);
                irregularVerbs.set(response.verb, response.irregular);
            } catch (error) {
                console.error(`Error checking if ${verb.term} is irregular:`, error);
            }
        }

        // Trigger reactivity
        irregularVerbs = irregularVerbs;
    }

    async function checkStemChangingVerbs() {
        // Get all verb terms from the vocabulary set
        const verbs = vocabularySet.filter((term: any) => term.pos === 'verb');

        // Check each verb if it has stem changes
        for (const verb of verbs) {
            try {
                const response = await getStemChangingVerbs(verb.term);
                stemChangingVerbs.set(response.verb, response.stemChanging);
            } catch (error) {
                console.error(`Error checking if ${verb.term} is stem-changing:`, error);
            }
        }

        // Trigger reactivity
        stemChangingVerbs = stemChangingVerbs;
    }

    async function handleCSVImport() {
        loading = true;

        try {
            const results: any = await importCSV(csvText, csvTitle || undefined);
            vocabResults = results.vocabStats;
            vocabularySet = results.vocabStats.terms;
            setTitle = results.title || csvTitle || 'Imported Set';

            // Check irregular and stem-changing verbs
            await checkIrregularVerbs();
            await checkStemChangingVerbs();
        } catch (error: any) {
            console.error('CSV import failed:', error);
            errorMessage = 'CSV Import Failed';
            errorDetails = error.message || 'An unknown error occurred';
            showErrorModal = true;
        } finally {
            loading = false;
        }
    }

    async function extractQuizlet() {
        loading = true;
        showProgress = true;
        progressMessage = 'Initializing scraper...';
        progressPercent = 0;
        currentPhase = 'Starting';

        try {
            // Try streaming first
            abortScrape = await scrapeURLStream(url, {
                onProgress: (event: ProgressEvent) => {
                    console.log('[Progress]', event);
                    progressMessage = event.message;
                    progressPercent = event.progress;

                    // Set phase based on event type
                    switch (event.type) {
                        case 'browser_launch':
                        case 'browser_ready':
                            currentPhase = 'Browser Setup';
                            break;
                        case 'navigation_start':
                        case 'navigation_success':
                        case 'navigation_timeout':
                            currentPhase = 'Loading Page';
                            break;
                        case 'captcha_check':
                        case 'captcha_detected':
                        case 'captcha_solving':
                        case 'captcha_solved':
                        case 'captcha_retry':
                            currentPhase = 'Captcha Handling';
                            break;
                        case 'terms_loading':
                        case 'terms_expanding':
                        case 'terms_expanded':
                            currentPhase = 'Expanding Terms';
                            break;
                        case 'extraction_start':
                        case 'extraction_complete':
                            currentPhase = 'Extracting Data';
                            break;
                        case 'complete':
                            currentPhase = 'Complete';
                            break;
                        case 'attempt_start':
                        case 'attempt_failed':
                            currentPhase = 'Retry';
                            break;
                    }
                },
                onSuccess: async (data: any) => {
                    console.log('Scraping completed:', data);
                    vocabResults = data.vocabStats;
                    vocabularySet = data.vocabStats.terms;
                    setTitle = data.title || 'Untitled Set';
                    progressMessage = 'Success!';
                    progressPercent = 100;

                    // Check irregular and stem-changing verbs
                    await checkIrregularVerbs();
                    await checkStemChangingVerbs();
                },
                onError: (error: string) => {
                    console.error('Scraping error:', error);
                    errorMessage = 'Scraping Failed';
                    errorDetails = error;
                    showErrorModal = true;
                },
                onComplete: () => {
                    loading = false;
                    setTimeout(() => {
                        showProgress = false;
                    }, 1000);
                }
            });
        } catch (error: any) {
            console.error('Failed to start streaming, falling back to regular scrape:', error);

            // Fallback to regular scraping
            progressMessage = 'Loading...';
            try {
                const results: any = await scrapeURL(url);
                vocabResults = results.vocabStats;
                vocabularySet = results.vocabStats.terms;
                setTitle = results.title || 'Untitled Set';
                progressMessage = 'Success!';
                progressPercent = 100;

                // Check irregular and stem-changing verbs
                await checkIrregularVerbs();
                await checkStemChangingVerbs();
            } catch (fallbackError: any) {
                console.error('Regular scrape also failed:', fallbackError);
                errorMessage = 'Scraping Failed';
                errorDetails = fallbackError.message || 'An unknown error occurred';
                showErrorModal = true;
            } finally {
                loading = false;
                setTimeout(() => {
                    showProgress = false;
                }, 1000);
            }
        }
    }

    function retryExtraction() {
        showErrorModal = false;
        extractQuizlet();
    }

    function cancelExtraction() {
        showErrorModal = false;
        loading = false;
        showProgress = false;
    }

    async function togglePopup(verb: string) {

        // get all conjugations
        const returnedConjugations = await getVerbConjugations(verb);

        let showableConjugations = [];
        console.log(typeof returnedConjugations);
        for (let i: number = 0; i < Object.keys(returnedConjugations).length; i++) {

            const tense: string = Object.keys(returnedConjugations)[i];
            const conjugations = returnedConjugations[tense];

            showableConjugations.push({
                tense,
                conjugations
            })


        }

        conjugations = showableConjugations

        showConjugations = !showConjugations;
    }

    function addToLibrary() {
        showAddLibraryConfirmation = true;
    }

    async function confirmAddLibrary() {
        const userId = authStore.user?.id;

        if (userId) {
            await addLibrarySet(setTitle, vocabularySet, userId);
            showAddLibraryConfirmation = false;
            // Navigate to vocab-sets page
            goto('/vocab-sets');
        }
    }

    function cancelAddLibrary() {
        showAddLibraryConfirmation = false;
    }

    function showWordInfoModal(word: string) {
        selectedWord = word;
        showWordInfo = true;
    }

    function closeWordInfoModal() {
        showWordInfo = false;
        selectedWord = '';
    }

        // Example: number of items per page
    let itemsPerPage = 30;
    let currentPage = 1;

    // POS filter: '' = all, 'noun', 'verb', 'adjective'
    let posFilter: '' | 'noun' | 'verb' | 'adjective' = '';

    // Reactive filtered terms based on POS
    $: filteredTerms = (() => {
        let terms = posFilter
            ? vocabularySet?.filter((term: any) => term.pos === posFilter) || []
            : vocabularySet || [];

        // Sort to frontload irregular and stem-changing verbs when showing verbs
        if (posFilter === 'verb' || posFilter === '') {
            terms = [...terms].sort((a: any, b: any) => {
                const aIsVerb = a.pos === 'verb';
                const bIsVerb = b.pos === 'verb';
                const aIsIrregular = aIsVerb && irregularVerbs.get(a.term);
                const bIsIrregular = bIsVerb && irregularVerbs.get(b.term);
                const aIsStemChanging = aIsVerb && stemChangingVerbs.get(a.term);
                const bIsStemChanging = bIsVerb && stemChangingVerbs.get(b.term);

                // Irregular verbs first, then stem-changing
                if (aIsIrregular && !bIsIrregular) return -1;
                if (!aIsIrregular && bIsIrregular) return 1;
                if (aIsStemChanging && !bIsStemChanging) return -1;
                if (!aIsStemChanging && bIsStemChanging) return 1;
                return 0;
            });
        }

        return terms;
    })();

    // Update total pages based on filtered terms
    $: totalPages = filteredTerms.length
        ? Math.ceil(filteredTerms.length / itemsPerPage)
        : 1;

    // Slice filtered terms for current page
    $: paginatedItems = filteredTerms.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Ensure current page is within bounds
    $: if (currentPage > totalPages) currentPage = totalPages || 1;


    function goToPage(page: number) {
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;
    }

</script>

<div class="space-y-4 sm:space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">Import Set</h1>
    <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">Lets get you started importing more vocabulary!</p>
  </div>

  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
    <h2 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Import Vocabulary</h2>

    <!-- Tabs -->
    <div class="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
      {#if csvEnabled}
        <button
          class="px-4 py-2 font-medium transition-colors {importMethod === 'csv' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          onclick={() => importMethod = 'csv'}
        >
          Import CSV
        </button>
      {/if}
      {#if scrapeEnabled}
        <button
          class="px-4 py-2 font-medium transition-colors {importMethod === 'scrape' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
          onclick={() => importMethod = 'scrape'}
        >
          Scrape URL
        </button>
      {/if}
    </div>

    <!-- CSV Import -->
    {#if importMethod === 'csv'}
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Set Title (Optional)
          </label>
          <input
            type="text"
            bind:value={csvTitle}
            placeholder="My Vocabulary Set"
            class="w-full px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border border-gray-300 dark:border-gray-600
             bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500
             dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50
             focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Paste CSV Data
          </label>
          <textarea
            bind:value={csvText}
            placeholder="term,definition&#10;casa,house&#10;perro,dog&#10;gato,cat"
            rows="10"
            class="w-full px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border border-gray-300 dark:border-gray-600
             bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500
             dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50
             focus:border-transparent font-mono"
          ></textarea>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Format: term,definition (one per line). First row can be headers.
          </p>
        </div>

        <button
          class="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
          onclick={handleCSVImport}
          disabled={loading || !csvText.trim()}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Importing...
            </span>
          {:else}
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Import CSV
            </span>
          {/if}
        </button>
      </div>
    {/if}

    <!-- URL Scraping -->
    {#if importMethod === 'scrape'}
      <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input
          type="url"
          bind:value={url}
          placeholder="Enter Quizlet link..."
          class="flex-1 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg border border-gray-300 dark:border-gray-600
           bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500
           dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50
           focus:border-transparent"
        />
        <button
          class="flex items-center justify-center gap-2 sm:gap-3 px-4 py-2 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group flex-shrink-0"
          onclick={async () => {
            loading = true;
            try {
              await extractQuizlet();
            } finally {
              loading = false;
            }
          }}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Loading...
            </span>
          {:else}
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
              Extract
            </span>
          {/if}
        </button>
      </div>
    {/if}

  </div>

    <!-- Progress Display -->
    {#if showProgress}
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div class="space-y-4">
            <!-- Phase and Message -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">{currentPhase}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">{progressMessage}</p>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-bold text-purple-500">{Math.round(progressPercent)}%</span>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                    class="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                    style="width: {progressPercent}%"
                ></div>
            </div>

            <!-- Phase Indicators -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div class="text-center p-2 rounded-lg {progressPercent >= 5 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'}">
                    <div class="text-xs font-medium {progressPercent >= 5 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">Browser</div>
                </div>
                <div class="text-center p-2 rounded-lg {progressPercent >= 30 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'}">
                    <div class="text-xs font-medium {progressPercent >= 30 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">Page Load</div>
                </div>
                <div class="text-center p-2 rounded-lg {progressPercent >= 60 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'}">
                    <div class="text-xs font-medium {progressPercent >= 60 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">Terms</div>
                </div>
                <div class="text-center p-2 rounded-lg {progressPercent >= 85 ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'}">
                    <div class="text-xs font-medium {progressPercent >= 85 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}">Extract</div>
                </div>
            </div>
        </div>
    </div>
    {/if}

    {#if vocabularySet && !loading}

    <!-- Display the set title -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-3 sm:mb-4">
            <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{setTitle}</h2>
        </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Vocab Statistics</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Total Terms:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{vocabResults.totalTerms}</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Single Words:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{vocabResults.singleWordTerms} ({Math.round((vocabResults.singleWordTerms / vocabResults.totalTerms) * 100)}%)</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Multiple Words:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{vocabResults.multiWordTerms} ({Math.round((vocabResults.multiWordTerms / vocabResults.totalTerms) * 100)}%)</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Average Cognates:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.averageCognateScore }%</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">High Cognates:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.highCognates }</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Low Cognates:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.lowCognates }</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Verbs:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.verbs }</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Nouns:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.nouns }</p>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Adjectives:</p>
                <p class="text-sm sm:text-base font-medium text-purple-500">{ vocabResults.adjectives }</p>
            </div>
        </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 w-full">
    <h2 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
        Extracted Terms ({vocabularySet.length})
    </h2>

    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
        <!-- Filter -->
        <div class="flex items-center gap-2">
            <p class="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filter:</p>
            <select bind:value={posFilter} class="flex-1 sm:flex-none px-2 py-1.5 sm:px-3 sm:py-2 text-sm sm:text-base rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                <option value="">All</option>
                <option value="noun">Nouns</option>
                <option value="verb">Verbs</option>
                <option value="adjective">Adjectives</option>
            </select>
        </div>

        <!-- Add to Library -->
        <button
            onclick={addToLibrary}
        class="flex items-center justify-center gap-2 sm:gap-3 px-3 py-1.5 sm:p-2 text-sm sm:text-base rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Add to Library
            </span>
        </button>
    </div>
</div>


        <!-- Paginated list -->
        {#each paginatedItems as term}
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg transition-colors mb-2 {term.pos === 'verb' && irregularVerbs.get(term.term) ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700' : term.pos === 'verb' && stemChangingVerbs.get(term.term) ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                <!-- Left: Term info -->
                <div class="flex items-start sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                        <span class="text-sm sm:text-base">{ term.cognateScore }</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-1 sm:gap-2">
                            <p class="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{ term.term }</p>
                            {#if term.pos === 'verb' && irregularVerbs.get(term.term)}
                                <span class="px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-bold rounded-full bg-amber-500 text-white shadow-sm">
                                    IRREGULAR
                                </span>
                            {/if}
                            {#if term.pos === 'verb' && stemChangingVerbs.get(term.term)}
                                <span class="px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-bold rounded-full bg-blue-500 text-white shadow-sm">
                                    STEM-CHANGING
                                </span>
                            {/if}
                        </div>
                        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{ term.definition }</p>
                    </div>
                </div>

                <!-- Right: POS and actions -->
                <div class="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <div class="flex items-center gap-1 sm:gap-2">
                        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cat:</p>
                        <p class="text-xs sm:text-sm font-medium text-purple-500">{ term.pos }</p>
                    </div>

                    <div class="flex items-center gap-1 sm:gap-2">
                        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Est:</p>
                        <p class="text-xs sm:text-sm font-medium text-purple-500">{ term.estimatedIterations }</p>
                    </div>

                    <button
                        onclick={() => showWordInfoModal(term.term)}
                        class="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:p-2 text-xs sm:text-sm rounded-md border-2 border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                        title="View word information"
                    >
                        <span class="font-medium text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            ℹ️ Info
                        </span>
                    </button>

                    { #if term.pos === 'verb' }
                        <button
                            onclick={() => togglePopup(term.term)}
                            class="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:p-2 text-xs sm:text-sm rounded-md border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                        >
                            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                Conjugations
                            </span>
                        </button>
                    {/if}
                </div>
            </div>
        {/each}

        <!-- Pagination controls -->
        <div class="flex flex-wrap justify-center gap-1 sm:gap-2 mt-4">
            <button onclick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} class="px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Prev</button>

            {#each Array(totalPages) as _, index}
                <button
                    onclick={() => goToPage(index + 1)}
                    class="px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded font-medium text-white {currentPage === index + 1 ? 'bg-purple-500' : 'bg-gray-500 dark:text-white'}"
                >
                    {index + 1}
                </button>
            {/each}

            <button onclick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} class="px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Next</button>
        </div>
    </div>
    {/if}

</div>

<!-- Full-screen overlay with smooth transition -->
{#if showConjugations}
    <div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300">
        <div 
            class="bg-white dark:bg-gray-800 w-4/5 h-4/5 p-6 rounded-lg shadow-lg overflow-auto transform transition-all duration-300 scale-95 opacity-0 animate-modal-in relative"
        >
            <!-- Close button -->

                <button 
                    class="absolute top-4 right-4 text-gray-700 dark:text-gray-300 font-bold text-lg hover:text-purple-500"
                    onclick={() => showConjugations = false}
                >
                    X
                </button>

            <div class="modal-header border-b border-gray-300 dark:border-gray-600 mb-4">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                    Conjugations
                </h2>
                
                <p class="text-gray-700 dark:text-gray-300 mb-4">
                    Here are all the verb conjugations for the selected term.
                </p>

            </div>

            {#each conjugations as conjugation}       
            <div class="overflow-x-auto mb-6">
                <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{ conjugation.tense }</h2>
                <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md">
                <thead class="bg-gray-100 dark:bg-gray-700">
                    <tr>
                    <th class="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Pronoun</th>
                    <th class="px-4 py-2 text-left text-gray-700 dark:text-gray-200">Conjugation</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2 text-gray-500 dark:text-gray-200">yo</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations.yo}</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">tú</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations["tú"]}</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">él/ella/usted</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations["él/ella/usted"]}</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">nosotros</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations['nosotros/nosotras']}</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">vosotros</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations['vosotros/vosotras']}</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">ellos/ellas/ustedes</td>
                    <td class="px-4 py-2 text-purple-500">{@html conjugation.conjugations["ellos/ellas/ustedes"]}</td>
                    </tr>
                </tbody>
                </table>
            </div>
            {/each}
        </div>
    </div>
{/if}

<!-- Add Library Confirmation Popup -->
{#if showAddLibraryConfirmation}
    <div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300">
        <div class="bg-white dark:bg-gray-800 w-96 p-6 rounded-lg shadow-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add to Library</h2>
            <p class="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to add "{setTitle}" to your library?
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    onclick={cancelAddLibrary}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
                </button>
                <button
                    onclick={confirmAddLibrary}
                    class="px-4 py-2 rounded-lg border-2 border-purple-500 bg-purple-500 hover:bg-purple-600 hover:border-purple-600 transition-all"
                >
                    <span class="font-medium text-white">Add to Library</span>
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Error Modal -->
{#if showErrorModal}
    <div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300">
        <div
            class="bg-white dark:bg-gray-800 w-11/12 sm:w-3/4 md:w-1/2 lg:w-1/3 p-6 rounded-lg shadow-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in"
        >
            <!-- Header -->
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">{errorMessage}</h2>
                </div>
            </div>

            <!-- Error Details -->
            <div class="mb-6">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    The scraper encountered an error while trying to extract the Quizlet set:
                </p>
                <div class="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <p class="text-sm text-gray-800 dark:text-gray-200 font-mono break-words">
                        {errorDetails}
                    </p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    This could be due to a network issue, captcha, or changes to Quizlet's page structure.
                </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
                <button
                    onclick={retryExtraction}
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Retry
                </button>
                <button
                    onclick={cancelExtraction}
                    class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Word Info Modal -->
{#if showWordInfo}
    <WordInfoModal word={selectedWord} onClose={closeWordInfoModal} />
{/if}

<style>
    @keyframes modal-in {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
    }
    .animate-modal-in {
        animation: modal-in 0.2s forwards;
    }
</style>
