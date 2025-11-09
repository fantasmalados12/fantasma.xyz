
<script lang="ts">
    import { getCognateScore } from "../../utils/extras/Cognates";
    import { getVerbConjugations, scrapeURL } from "../../utils/Scraper";


    let url: string;
    let vocabResults: any;
    let vocabularySet: any;
    let loading: boolean = false;
    let showConjugations: boolean = false; 
    let conjugations: any = {};

    async function extractQuizlet() {

        // Scrape with the API
        const results: any = await scrapeURL(url);

        console.log(results);

        vocabResults = results.vocabStats;
        vocabularySet = results.vocabStats.terms;

        // stop animation
        loading = false;

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

        // Example: number of items per page
    let itemsPerPage = 30;
    let currentPage = 1;

    // POS filter: '' = all, 'noun', 'verb', 'adjective'
    let posFilter: '' | 'noun' | 'verb' | 'adjective' = '';

    // Reactive filtered terms based on POS
    $: filteredTerms = posFilter
        ? vocabularySet?.filter((term: any) => term.pos === posFilter) || []
        : vocabularySet || [];

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

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Import Set</h1>
    <p class="text-gray-600 dark:text-gray-400">Lets get you started importing more vocabulary!</p>
  </div>

  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Quizlet Extractor</h2>

    <div class="flex gap-3">
      <input
        type="url"
        bind:value={url}
        placeholder="Enter Quizlet link..."
        class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
         bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 
         dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50
         focus:border-transparent"
      />
        <button 
            class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
            on:click={async () => {
                loading = true;
                try {
                await extractQuizlet();
                } finally {
                loading = false;
                }
            }}
        >
            {#if loading}
            <!-- Spinner -->
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

    </div>

    {#if vocabularySet && !loading}

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Vocab Statistics</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Total Terms:</p>
                <p class="font-medium text-purple-500">{vocabResults.totalTerms}</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Single Words:</p>
                <p class="font-medium text-purple-500">{vocabResults.singleWordTerms} ({Math.round((vocabResults.singleWordTerms / vocabResults.totalTerms) * 100)}%)</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Multiple Words:</p>
                <p class="font-medium text-purple-500">{vocabResults.multiWordTerms} ({Math.round((vocabResults.multiWordTerms / vocabResults.totalTerms) * 100)}%)</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Average Cognates:</p>
                <p class="font-medium text-purple-500">{ vocabResults.averageCognateScore }%</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">High Cognates:</p>
                <p class="font-medium text-purple-500">{ vocabResults.highCognates }</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Low Cognates:</p>
                <p class="font-medium text-purple-500">{ vocabResults.lowCognates }</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Verbs:</p>
                <p class="font-medium text-purple-500">{ vocabResults.verbs }</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Nouns:</p>
                <p class="font-medium text-purple-500">{ vocabResults.nouns }</p>
            </div>

            <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                <p class="font-medium text-gray-900 dark:text-white">Adjectives:</p>
                <p class="font-medium text-purple-500">{ vocabResults.adjectives }</p>
            </div>
        </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-6 w-full">
    <h2 class="text-xl font-bold text-gray-900 dark:text-white">
        Extracted Terms ({vocabularySet.length} terms)
    </h2>

    <div class="flex items-center gap-4">
        <!-- Filter -->
        <div class="flex items-center gap-2">
            <p class="font-medium text-gray-700 dark:text-gray-300">Filter by Category:</p>
            <select bind:value={posFilter} class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                <option value="">All</option>
                <option value="noun">Nouns</option>
                <option value="verb">Verbs</option>
                <option value="adjective">Adjectives</option>
            </select>
        </div>

        <!-- Add to Library -->
        <button class="flex items-center gap-3 p-2 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Add to Library
            </span>
        </button>
    </div>
</div>


        <!-- Paginated list -->
        {#each paginatedItems as term}
            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-2">
                <div class="flex justify-between items-center w-full">
                    <!-- Left: Term info -->
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                            <span>{ term.cognateScore }</span>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900 dark:text-white">{ term.term }</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">{ term.definition }</p>
                        </div>
                    </div>

                    <!-- Right: POS and Estimated Iterations -->
                    <div class="flex items-center gap-6">
                        <div class="flex items-center text-right gap-2">
                            <p class="text-sm text-gray-500 dark:text-gray-400">Category:</p>
                            <p class="font-medium text-purple-500">{ term.pos }</p>
                        </div>

                        <div class="flex items-center text-right gap-2">
                            <p class="text-sm text-gray-500 dark:text-gray-400">Estimated Iterations:</p>
                            <p class="font-medium text-purple-500">{ term.estimatedIterations }</p>
                        </div>

                        { #if term.pos === 'verb' }
                            <button 
                                on:click={() => togglePopup(term.term)}
                                class="flex items-center gap-3 p-2 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                            >
                                <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                    Conjugations
                                </span>
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}

        <!-- Pagination controls -->
        <div class="flex justify-center gap-2 mt-4">
            <button on:click={() => goToPage(currentPage - 1)} disabled={currentPage === 1} class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Prev</button>

            {#each Array(totalPages) as _, index}
                <button
                    on:click={() => goToPage(index + 1)}
                    class="px-3 py-1 rounded font-medium text-white {currentPage === index + 1 ? 'bg-purple-500' : 'bg-gray-500 dark:text-white'}"
                >
                    {index + 1}
                </button>
            {/each}

            <button on:click={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} class="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600 disabled:opacity-50">Next</button>
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
                    on:click={() => showConjugations = false}
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
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations.yo }</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">tú</td>
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations["tú"] }</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">él/ella/usted</td>
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations["él/ella/usted"] }</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">nosotros</td>
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations['nosotros/nosotras'] }</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">vosotros</td>
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations['vosotros/vosotras'] }</td>
                    </tr>
                    <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-4 py-2  text-gray-500 dark:text-gray-200">ellos/ellas/ustedes</td>
                    <td class="px-4 py-2 text-purple-500">{ conjugation.conjugations["ellos/ellas/ustedes"] }</td>
                    </tr>
                </tbody>
                </table>
            </div>
            {/each}
        </div>
    </div>
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
