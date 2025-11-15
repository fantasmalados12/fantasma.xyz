<script lang="ts">
    import { fetchWordData, fetchRealExamples, type WordData, type ExampleSentence } from '../utils/ExampleSentences';
    import { onMount } from 'svelte';

    // Props
    export let word: string = '';
    export let onClose: () => void;

    // State
    let loading = true;
    let wordData: WordData | null = null;
    let examples: ExampleSentence[] = [];
    let error: string = '';

    onMount(async () => {
        await loadWordInfo();
    });

    async function loadWordInfo() {
        loading = true;
        error = '';

        try {
            // Clean the word by removing parenthetical information (e.g., "estudiar (stem_change)" -> "estudiar")
            const cleanWord = word.replace(/\s*\([^)]*\)\s*/g, '').trim();

            // Fetch word data and examples in parallel
            const [data, exampleSentences] = await Promise.all([
                fetchWordData(cleanWord),
                fetchRealExamples(cleanWord)
            ]);

            wordData = data;
            examples = exampleSentences;

            if (!wordData && examples.length === 0) {
                error = `No information found for "${word}"`;
            }
        } catch (err) {
            console.error('Error loading word info:', err);
            error = 'Failed to load word information';
        } finally {
            loading = false;
        }
    }

    // Extract all synonyms from word data
    function getAllSynonyms(data: WordData): string[] {
        const synonyms = new Set<string>();

        for (const meaning of data.meanings) {
            for (const definition of meaning.definitions) {
                if (definition.synonyms) {
                    definition.synonyms.forEach(syn => synonyms.add(syn));
                }
            }
        }

        return Array.from(synonyms);
    }

    // Extract all antonyms from word data
    function getAllAntonyms(data: WordData): string[] {
        const antonyms = new Set<string>();

        for (const meaning of data.meanings) {
            for (const definition of meaning.definitions) {
                if (definition.antonyms) {
                    definition.antonyms.forEach(ant => antonyms.add(ant));
                }
            }
        }

        return Array.from(antonyms);
    }

    $: synonyms = wordData ? getAllSynonyms(wordData) : [];
    $: antonyms = wordData ? getAllAntonyms(wordData) : [];
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300" onclick={onClose}>
    <!-- Modal -->
    <div
        class="bg-white dark:bg-gray-800 w-11/12 sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-1/2 max-h-[85vh] p-6 rounded-lg shadow-lg overflow-auto transform transition-all duration-300 scale-95 opacity-0 animate-modal-in relative"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Close button -->
        <button
            class="absolute top-4 right-4 text-gray-700 dark:text-gray-300 font-bold text-lg hover:text-purple-500 transition-colors"
            onclick={onClose}
        >
            ✕
        </button>

        <!-- Header -->
        <div class="mb-6">
            <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {word}
            </h2>
            {#if wordData?.phonetic}
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    {wordData.phonetic}
                </p>
            {/if}
        </div>

        {#if loading}
            <!-- Loading State -->
            <div class="flex items-center justify-center py-12">
                <svg class="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="ml-3 text-gray-600 dark:text-gray-400">Loading word information...</span>
            </div>
        {:else if error}
            <!-- Error State -->
            <div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-6 text-center">
                <p class="text-red-600 dark:text-red-400 font-medium">{error}</p>
                <p class="text-sm text-red-500 dark:text-red-500 mt-2">
                    This word may not be in our dictionary database.
                </p>
            </div>
        {:else}
            <!-- Content -->
            <div class="space-y-6">
                <!-- Example Sentences -->
                {#if examples.length > 0}
                    <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-700">
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span>💡</span> Example Sentences
                        </h3>
                        <div class="space-y-3">
                            {#each examples.slice(0, 5) as example}
                                <div class="bg-white dark:bg-gray-800 rounded-md p-3 border border-purple-200 dark:border-purple-600">
                                    <p class="text-gray-700 dark:text-gray-300 font-medium mb-1.5">
                                        <span class="text-purple-600 dark:text-purple-400">🇪🇸</span> "{example.spanish}"
                                    </p>
                                    <p class="text-gray-600 dark:text-gray-400 text-sm ml-5">
                                        <span class="text-blue-600 dark:text-blue-400">🇺🇸</span> {example.english}
                                    </p>
                                </div>
                            {/each}
                        </div>
                        {#if examples.length > 5}
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Showing 5 of {examples.length} examples
                            </p>
                        {/if}
                    </div>
                {/if}

                <!-- Definitions (if available) -->
                {#if wordData}
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span>📖</span> Definitions
                        </h3>
                        <div class="space-y-3">
                            {#each wordData.meanings as meaning}
                                <div>
                                    <p class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                        {meaning.partOfSpeech}
                                    </p>
                                    <ul class="list-disc list-inside space-y-1">
                                        {#each meaning.definitions.slice(0, 3) as def}
                                            <li class="text-gray-700 dark:text-gray-300 text-sm">
                                                {def.definition}
                                                {#if def.example}
                                                    <span class="text-gray-500 dark:text-gray-400 italic block ml-5 text-xs mt-0.5">
                                                        "{def.example}"
                                                    </span>
                                                {/if}
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Origin -->
                {#if wordData?.origin}
                    <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-2 border-amber-200 dark:border-amber-700">
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <span>🌍</span> Origin
                        </h3>
                        <p class="text-gray-700 dark:text-gray-300 text-sm">
                            {wordData.origin}
                        </p>
                    </div>
                {/if}

                <!-- Synonyms and Antonyms -->
                {#if synonyms.length > 0 || antonyms.length > 0}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Synonyms -->
                        {#if synonyms.length > 0}
                            <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-200 dark:border-green-700">
                                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <span>✅</span> Synonyms
                                </h3>
                                <div class="flex flex-wrap gap-2">
                                    {#each synonyms.slice(0, 10) as synonym}
                                        <span class="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded-md text-sm">
                                            {synonym}
                                        </span>
                                    {/each}
                                </div>
                                {#if synonyms.length > 10}
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        +{synonyms.length - 10} more
                                    </p>
                                {/if}
                            </div>
                        {/if}

                        <!-- Antonyms -->
                        {#if antonyms.length > 0}
                            <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-700">
                                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                    <span>❌</span> Antonyms
                                </h3>
                                <div class="flex flex-wrap gap-2">
                                    {#each antonyms.slice(0, 10) as antonym}
                                        <span class="px-2 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
                                            {antonym}
                                        </span>
                                    {/each}
                                </div>
                                {#if antonyms.length > 10}
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        +{antonyms.length - 10} more
                                    </p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- No data available message -->
                {#if !wordData && examples.length === 0}
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                        <p class="text-gray-600 dark:text-gray-400">
                            No additional information available for this word.
                        </p>
                    </div>
                {/if}

                <!-- Source attribution -->
                {#if wordData}
                    <div class="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
                        Source: {wordData.source === 'free-dictionary' ? 'Free Dictionary API' : wordData.source === 'merriam-webster' ? 'Merriam-Webster' : 'Cached'}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    @keyframes modal-in {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
    }
    .animate-modal-in {
        animation: modal-in 0.2s forwards;
    }
</style>
