
<script lang="ts">
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { getLibrarySets, deleteLibrarySet, getRecentVocabSets, getImagesFromSet, addImageToTerm, getIrregularVerbs } from "../../../utils/LibrarySets";
    import { goto } from "$app/navigation";
    import { getVerbConjugations } from "../../../utils/Scraper";
    import { authStore } from "../../../utils/authStore.svelte";
    import { getAPIUrlBasedOffEnviornment } from "../../../utils/API";

    const API_BASE = getAPIUrlBasedOffEnviornment();

    // Helper to get account ID safely
    function getAccountId(): string | null {
        return authStore.user?.id || null;
    }

    let imagesAddedToTerms: any = [];
    let vocabSet: any = null;
    $: setId = $page.params.id;
    $: vocabularySet = vocabSet ? JSON.parse(vocabSet.terms) : [];
    let conjugations: any = [];
    let showConjugations = false;
    let showDeleteConfirmation = false;
    let showAddImagesConfirmation = false;
    let stats: any = null;
    let loadingStats = true;
    let learningStatsCollapsed = false;
    let vocabStatsCollapsed = false;
    let irregularVerbs: Map<string, boolean> = new Map();

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

    onMount(async() => {
        // Wait for auth to initialize
        while (authStore.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const accountId = getAccountId();
        if (!accountId) {
            console.error('No user ID available');
            goto('/auth');
            return;
        }

        console.log('🔐 Authenticated user ID:', accountId);
        const vocabs = await getLibrarySets(accountId);

        const foundSet = vocabs.vocabSets.find((set: any) => {
            return set.id == setId; // or ===, depending on type
        });

        if (!foundSet) {
            goto('/vocab-sets');
            return;
        }

        vocabSet = foundSet;

        const addedImages = await getImagesFromSet(foundSet.id);
        imagesAddedToTerms = addedImages.images;

        // Load stats
        try {
            const response = await fetch(`${API_BASE}/api/sessionstats/${accountId}/${setId}`);
            if (response.ok) {
                const data = await response.json();
                stats = data.stats;
                console.log('📊 Stats loaded:', stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            loadingStats = false;
        }

        // Check which verbs are irregular
        if (vocabSet) {
            await checkIrregularVerbs();
        }

    });

    function getImageFromTerm(term: string) {

        // console.log(imagesAddedToTerms);
        const foundTerms = imagesAddedToTerms.filter((item: any) => item.associated_term === `icono-de-${term}`);
        // console.log(term, foundTerms);
        if (foundTerms.length > 0) {
            // @ts-ignore
            return foundTerms[0].image_url;
        } else {
            return null;
        }

    }

    async function togglePopup(verb: string) {

        // get all conjugations
        const returnedConjugations = await getVerbConjugations(verb);

        let showableConjugations = [];
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
        // TODO: Implement add to library functionality
        console.log('Adding vocab set to library');
    }

    let itemsPerPage = 30;
    let currentPage = 1;

    // POS filter: '' = all, 'noun', 'verb', 'adjective'
    let posFilter: '' | 'noun' | 'verb' | 'adjective' = '';

    // Reactive filtered terms based on POS
    $: filteredTerms = (() => {
        let terms = posFilter
            ? vocabularySet?.filter((term: any) => term.pos === posFilter) || []
            : vocabularySet || [];

        // Sort to frontload irregular verbs when showing verbs
        if (posFilter === 'verb' || posFilter === '') {
            terms = [...terms].sort((a: any, b: any) => {
                const aIsVerb = a.pos === 'verb';
                const bIsVerb = b.pos === 'verb';
                const aIsIrregular = aIsVerb && irregularVerbs.get(a.term);
                const bIsIrregular = bIsVerb && irregularVerbs.get(b.term);

                // Irregular verbs first
                if (aIsIrregular && !bIsIrregular) return -1;
                if (!aIsIrregular && bIsIrregular) return 1;
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

    function showDeletePopup() {
        showDeleteConfirmation = true;
    }

    async function confirmDelete() {
        const success = await deleteLibrarySet(setId);

        if (success) {
            // Redirect to vocab sets list or home page after successful deletion
            goto('/vocab-sets');
        } else {
            // Handle error (you could add error message display here)
            console.error('Failed to delete vocab set');
        }

        showDeleteConfirmation = false;
    }

    function cancelDelete() {
        showDeleteConfirmation = false;
    }

    function cancelAddImages() {
        showAddImagesConfirmation = false;
    }

    function addImages() {

        showAddImagesConfirmation = true;

    }

    async function confirmAddImages() {
        showAddImagesConfirmation = false;

        // console.log(vocabularySet);
        for (let i: number = 0; i < vocabularySet.length; i++) { // vocabularySet.splice(0, 10).length
            const term = vocabularySet[i];

            // Call API to add images for term 
            await addImageToTerm(setId, `icono-de-${term.term}`);

        }
    };

    function updateVocabSet() {
        // TODO: Implement update functionality
        console.log('Updating vocab set:', setId);
    }

    // Calculate statistics from vocabularySet
    $: vocabStats = vocabularySet ? {
        totalTerms: vocabularySet.length,
        singleWordTerms: vocabularySet.filter((term: any) => !term.term.includes(' ')).length,
        multiWordTerms: vocabularySet.filter((term: any) => term.term.includes(' ')).length,
        averageCognateScore: vocabularySet.length > 0
            ? Math.round(vocabularySet.reduce((sum: number, term: any) => sum + (term.cognateScore || 0), 0) / vocabularySet.length)
            : 0,
        highCognates: vocabularySet.filter((term: any) => (term.cognateScore || 0) >= 70).length,
        lowCognates: vocabularySet.filter((term: any) => (term.cognateScore || 0) < 70).length,
        verbs: vocabularySet.filter((term: any) => term.pos === 'verb').length,
        nouns: vocabularySet.filter((term: any) => term.pos === 'noun').length,
        adjectives: vocabularySet.filter((term: any) => term.pos === 'adjective').length,
    } : null;

</script>

<div class="space-y-6">
    {#if vocabSet}
        <!-- Header with title, term count, and action buttons -->
        <div class="flex items-start justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{vocabSet.title}</h1>
                <p class="text-gray-600 dark:text-gray-400">Terms: {JSON.parse(vocabSet.terms).length}</p>
            </div>
            <div class="flex items-center gap-3">
                <button
                    on:click={() => goto(`/learn/${setId}`)}
                    class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-purple-500 bg-purple-500 hover:bg-purple-600 hover:border-purple-600 transition-all"
                >
                    <span class="font-medium text-white">
                        Learn
                    </span>
                </button>
                <button
                    on:click={updateVocabSet}
                    class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        Update
                    </span>
                </button>
                <button
                    on:click={showDeletePopup}
                    class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-300 dark:border-red-600 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group"
                >
                    <span class="font-medium text-red-700 dark:text-red-300 group-hover:text-red-600 dark:group-hover:text-red-400">
                        Delete
                    </span>
                </button>
            </div>
        </div>

        <!-- Learning Stats Section -->
        {#if !loadingStats && stats}
        <div class="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg p-6 border-2 border-purple-200 dark:border-purple-700">
            <button
                on:click={() => learningStatsCollapsed = !learningStatsCollapsed}
                class="w-full flex items-center justify-between mb-6 hover:opacity-80 transition-opacity"
            >
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>📊</span> Learning Statistics
                </h2>
                <span class="text-2xl text-gray-600 dark:text-gray-400 transform transition-transform duration-200" style="transform: rotate({learningStatsCollapsed ? -90 : 0}deg)">
                    ▼
                </span>
            </button>

            {#if !learningStatsCollapsed}
            <!-- Key Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-purple-200 dark:border-purple-700">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Sessions</p>
                    <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.total_sessions}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-700">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Accuracy</p>
                    <p class="text-3xl font-bold text-green-600 dark:text-green-400">{stats.average_accuracy}%</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-blue-200 dark:border-blue-700">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Score</p>
                    <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.best_accuracy}%</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-amber-200 dark:border-amber-700">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Study Time</p>
                    <p class="text-3xl font-bold text-amber-600 dark:text-amber-400">{Math.floor(stats.total_study_time / 60)}m</p>
                </div>
            </div>

            <!-- Detailed Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Performance Breakdown -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span>🎯</span> Performance Breakdown
                    </h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <span class="text-gray-700 dark:text-gray-300">Total Correct</span>
                            <span class="font-bold text-green-600 dark:text-green-400">{stats.total_correct}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <span class="text-gray-700 dark:text-gray-300">Total Incorrect</span>
                            <span class="font-bold text-red-600 dark:text-red-400">{stats.total_incorrect}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <span class="text-gray-700 dark:text-gray-300">Total Questions</span>
                            <span class="font-bold text-purple-600 dark:text-purple-400">{stats.total_questions_answered}</span>
                        </div>
                    </div>
                </div>

                <!-- Study Modes -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span>📚</span> Study Mode Usage
                    </h3>
                    <div class="space-y-3">
                        {#each Object.entries(stats.study_mode_breakdown) as [mode, count]}
                        <div class="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <span class="text-gray-700 dark:text-gray-300 capitalize">{mode.replace('-', ' → ')}</span>
                            <span class="font-bold text-indigo-600 dark:text-indigo-400">{count} sessions</span>
                        </div>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Most Struggled & Mastered Terms -->
            {#if stats.most_struggled_terms.length > 0 || stats.most_mastered_terms.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <!-- Most Struggled -->
                {#if stats.most_struggled_terms.length > 0}
                <div class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span>⚠️</span> Need More Practice
                    </h3>
                    <div class="space-y-2">
                        {#each stats.most_struggled_terms as term}
                        <div class="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <span class="text-gray-700 dark:text-gray-300 truncate flex-1">{term.term}</span>
                            <span class="text-sm font-medium text-red-600 dark:text-red-400 ml-2">{term.count}x</span>
                        </div>
                        {/each}
                    </div>
                </div>
                {/if}

                <!-- Most Mastered -->
                {#if stats.most_mastered_terms.length > 0}
                <div class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span>⭐</span> Mastered Terms
                    </h3>
                    <div class="space-y-2">
                        {#each stats.most_mastered_terms as term}
                        <div class="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <span class="text-gray-700 dark:text-gray-300 truncate flex-1">{term.term}</span>
                            <span class="text-sm font-medium text-green-600 dark:text-green-400 ml-2">{term.count}x</span>
                        </div>
                        {/each}
                    </div>
                </div>
                {/if}
            </div>
            {/if}

            <!-- Recent Sessions -->
            {#if stats.recent_sessions.length > 0}
            <div class="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm mt-6">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span>📅</span> Recent Sessions
                </h3>
                <div class="space-y-2">
                    {#each stats.recent_sessions as session}
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div class="flex items-center gap-4 flex-1">
                            <span class="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(session.date).toLocaleDateString()}
                            </span>
                            <div class="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                <div class="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all" style="width: {session.accuracy}%"></div>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {session.correct}/{session.total}
                            </span>
                            <span class="text-sm font-bold {session.accuracy >= 80 ? 'text-green-600 dark:text-green-400' : session.accuracy >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}">
                                {session.accuracy}%
                            </span>
                        </div>
                    </div>
                    {/each}
                </div>
            </div>
            {/if}
            {/if}
        </div>
        {:else if !loadingStats}
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-8 text-center border-2 border-dashed border-purple-300 dark:border-purple-700">
            <p class="text-lg text-gray-600 dark:text-gray-400">
                📊 No learning stats yet. Complete your first session to see your progress!
            </p>
        </div>
        {/if}

        {#if vocabStats}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <button
                on:click={() => vocabStatsCollapsed = !vocabStatsCollapsed}
                class="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">Vocab Statistics</h2>
                <span class="text-2xl text-gray-600 dark:text-gray-400 transform transition-transform duration-200" style="transform: rotate({vocabStatsCollapsed ? -90 : 0}deg)">
                    ▼
                </span>
            </button>

            {#if !vocabStatsCollapsed}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Total Terms:</p>
                    <p class="font-medium text-purple-500">{vocabStats.totalTerms}</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Single Words:</p>
                    <p class="font-medium text-purple-500">{vocabStats.singleWordTerms} ({Math.round((vocabStats.singleWordTerms / vocabStats.totalTerms) * 100)}%)</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Multiple Words:</p>
                    <p class="font-medium text-purple-500">{vocabStats.multiWordTerms} ({Math.round((vocabStats.multiWordTerms / vocabStats.totalTerms) * 100)}%)</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Average Cognates:</p>
                    <p class="font-medium text-purple-500">{vocabStats.averageCognateScore}%</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">High Cognates:</p>
                    <p class="font-medium text-purple-500">{vocabStats.highCognates}</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Low Cognates:</p>
                    <p class="font-medium text-purple-500">{vocabStats.lowCognates}</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Verbs:</p>
                    <p class="font-medium text-purple-500">{vocabStats.verbs}</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Nouns:</p>
                    <p class="font-medium text-purple-500">{vocabStats.nouns}</p>
                </div>

                <div class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="font-medium text-gray-900 dark:text-white">Adjectives:</p>
                    <p class="font-medium text-purple-500">{vocabStats.adjectives}</p>
                </div>
            </div>
            {/if}
        </div>
        {/if}

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
        <button 
            on:click={addImages}
        class="flex items-center gap-3 p-2 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Add Images
            </span>
        </button>
    </div>
</div>


        <!-- Paginated list -->
        {#each paginatedItems as term}
            <div class="flex items-center justify-between p-4 rounded-lg transition-colors mb-2 {term.pos === 'verb' && irregularVerbs.get(term.term) ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                <div class="flex justify-between items-center w-full">
                    <!-- Left: Term info -->
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                            {#if imagesAddedToTerms.length > 0}
                                {#if getImageFromTerm(term.term)}
                                    <img src="{getImageFromTerm(term.term)}" alt="{term.term}" class="w-12 h-12 object-cover rounded-lg" />
                                {/if}
                                    <!-- {:else}
                                <span>{ term.cognateScore }</span> -->
                            {/if}
                        </div>
                        <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                            <span>{ term.cognateScore }</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <div>
                                <div class="flex items-center gap-2">
                                    <p class="font-medium text-gray-900 dark:text-white">{ term.term }</p>
                                    {#if term.pos === 'verb' && irregularVerbs.get(term.term)}
                                        <span class="px-2 py-1 text-xs font-bold rounded-full bg-amber-500 text-white shadow-sm">
                                            IRREGULAR
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-sm text-gray-500 dark:text-gray-400">{ term.definition }</p>
                            </div>
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

    <!-- Delete Confirmation Popup -->
    {#if showDeleteConfirmation}
    <div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300">
        <div class="bg-white dark:bg-gray-800 w-96 p-6 rounded-lg shadow-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Confirm Deletion</h2>
            <p class="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete "{vocabSet?.title}"? This action cannot be undone.
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    on:click={cancelDelete}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
                </button>
                <button
                    on:click={confirmDelete}
                    class="px-4 py-2 rounded-lg border-2 border-red-500 bg-red-500 hover:bg-red-600 hover:border-red-600 transition-all"
                >
                    <span class="font-medium text-white">Delete</span>
                </button>
            </div>
        </div>
    </div>
    {/if}

    {#if showAddImagesConfirmation}
    <div class="fixed inset-0 bg-black/50 z-50 flex justify-center items-center transition-opacity duration-300">
        <div class="bg-white dark:bg-gray-800 w-96 p-6 rounded-lg shadow-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Confirm Images Added</h2>
            <p class="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to add images to "{vocabSet?.title}"?
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    on:click={cancelAddImages}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
                </button>
                <button
                    on:click={confirmAddImages}
                    class="px-4 py-2 rounded-lg border-2 border-red-500 bg-red-500 hover:bg-red-600 hover:border-red-600 transition-all"
                >
                    <span class="font-medium text-white">Add Images</span>
                </button>
            </div>
        </div>
    </div>
    {/if}

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

    {:else}
        <p class="text-gray-600 dark:text-gray-400 mt-1">Loading...</p>
    {/if}
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