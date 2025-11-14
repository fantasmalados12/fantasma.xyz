
<script lang="ts">
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { getLibrarySets, deleteLibrarySet, getRecentVocabSets, getImagesFromSet, addImageToTerm, getIrregularVerbs, getStemChangingVerbs } from "../../../utils/LibrarySets";
    import { goto } from "$app/navigation";
    import { getVerbConjugations } from "../../../utils/Scraper";
    import { authStore } from "../../../utils/authStore.svelte";
    import { featureFlagsStore } from "../../../utils/featureFlags.svelte";
    import { getAPIUrlBasedOffEnviornment } from "../../../utils/API";

    const API_BASE = getAPIUrlBasedOffEnviornment();

    // Helper to get account ID safely
    function getAccountId(): string | null {
        return authStore.user?.id || null;
    }

    // Helpers for persisting image loading state
    function saveImageLoadingState() {
        localStorage.setItem(`image_loading_${setId}`, JSON.stringify({
            isLoading: isAddingImages,
            termsProcessed: Array.from(termsBeingProcessed)
        }));
    }

    function loadImageLoadingState() {
        const saved = localStorage.getItem(`image_loading_${setId}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                isAddingImages = state.isLoading;
                termsBeingProcessed = new Set(state.termsProcessed);
                return state.isLoading;
            } catch (e) {
                console.error('Error loading image state:', e);
            }
        }
        return false;
    }

    function clearImageLoadingState() {
        localStorage.removeItem(`image_loading_${setId}`);
        isAddingImages = false;
        termsBeingProcessed = new Set();
    }

    // Helpers for persisting image display preference
    function saveImagesEnabledState() {
        localStorage.setItem(`images_enabled_${setId}`, JSON.stringify(imagesEnabled));
    }

    function loadImagesEnabledState() {
        const saved = localStorage.getItem(`images_enabled_${setId}`);
        if (saved !== null) {
            try {
                imagesEnabled = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading images enabled state:', e);
                imagesEnabled = true;
            }
        }
    }

    async function toggleImages() {
        imagesEnabled = !imagesEnabled;
        saveImagesEnabledState();

        // Reload images if turning them back on
        if (imagesEnabled) {
            try {
                const addedImages = await getImagesFromSet(Number(setId));
                imagesAddedToTerms = addedImages.images;
                console.log('📸 Images reloaded:', imagesAddedToTerms.length);
            } catch (error) {
                console.error('Error reloading images:', error);
            }
        }
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
    let stemChangingVerbs: Map<string, boolean> = new Map();
    let isAddingImages = false;
    let termsBeingProcessed: Set<string> = new Set();
    let imagesEnabled = true; // Default to showing images
    let activeTab: 'set' | 'stats' = 'set'; // Tab state
    let isPlayingGlossary = false;
    let glossaryProgress = 0;

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

        // Load image display preference
        loadImagesEnabledState();

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

        // Check which verbs are irregular and stem-changing
        if (vocabSet) {
            await checkIrregularVerbs();
            await checkStemChangingVerbs();
        }

        // Check if we were in the middle of adding images and resume if needed
        const wasAddingImages = loadImageLoadingState();
        if (wasAddingImages) {
            console.log('⚠️ Resuming image addition process...');
            await resumeAddingImages();
        }

    });

    function getImageFromTerm(term: string) {
        // If images are disabled for this set, return null
        if (!imagesEnabled) {
            return null;
        }

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
        await processImageAddition();
    };

    async function processImageAddition() {
        isAddingImages = true;
        saveImageLoadingState();

        for (let i: number = 0; i < vocabularySet.length; i++) {
            const term = vocabularySet[i];
            const termName = term.term;

            // Skip if already has an image
            if (getImageFromTerm(termName)) {
                console.log(`⏭️ Skipping ${termName} (already has image)`);
                continue;
            }

            // Mark term as being processed
            termsBeingProcessed.add(termName);
            termsBeingProcessed = termsBeingProcessed; // Trigger reactivity
            saveImageLoadingState();

            try {
                // Call API to add images for term
                const result = await addImageToTerm(setId, `icono-de-${termName}`);
                console.log(`✅ Added image for: ${termName}`);

                // Immediately refresh images to show the newly added image
                const addedImages = await getImagesFromSet(Number(setId));
                imagesAddedToTerms = addedImages.images;
            } catch (error) {
                console.error(`❌ Error adding image for ${termName}:`, error);
            }

            // Remove from processing set after completion
            termsBeingProcessed.delete(termName);
            termsBeingProcessed = termsBeingProcessed; // Trigger reactivity
            saveImageLoadingState();
        }

        // All done, clear state
        clearImageLoadingState();

        console.log('🎉 All images added successfully!');
    }

    async function resumeAddingImages() {
        console.log('🔄 Resuming image addition...');
        await processImageAddition();
    }

    async function playGlossary() {
        if (isPlayingGlossary) {
            // Stop playing
            window.speechSynthesis.cancel();
            isPlayingGlossary = false;
            glossaryProgress = 0;
            return;
        }

        if (!vocabularySet || vocabularySet.length === 0) {
            console.log('No terms to play');
            return;
        }

        isPlayingGlossary = true;
        glossaryProgress = 0;

        // Wait for voices to load
        const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
            return new Promise((resolve) => {
                let voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    resolve(voices);
                    return;
                }
                window.speechSynthesis.onvoiceschanged = () => {
                    voices = window.speechSynthesis.getVoices();
                    resolve(voices);
                };
            });
        };

        const voices = await getVoices();

        // Log all available Spanish voices for debugging
        const allSpanishVoices = voices.filter(v => v.lang.startsWith('es'));
        console.log('🎙️ Available Spanish voices:', allSpanishVoices.map(v => `${v.name} (${v.lang})`));

        // Prioritize high-quality Spanish voices
        // Look for premium voices like Google, Microsoft, or Enhanced/Premium voices
        const spanishVoice =
            // Try to find Google or Microsoft Spanish voices (usually highest quality)
            voices.find(v => (v.lang === 'es-MX' || v.lang === 'es-ES') && (v.name.includes('Google') || v.name.includes('Microsoft'))) ||
            // Try to find "Enhanced" or "Premium" Spanish voices
            voices.find(v => (v.lang === 'es-MX' || v.lang === 'es-ES') && (v.name.includes('Enhanced') || v.name.includes('Premium'))) ||
            // Look for specific high-quality voice names
            voices.find(v => v.name.includes('Monica')) || // Microsoft Monica (Spain Spanish)
            voices.find(v => v.name.includes('Paulina')) || // Microsoft Paulina (Mexican Spanish)
            voices.find(v => v.name.includes('Jorge')) || // Common high-quality male voice
            voices.find(v => v.name.includes('Juan')) || // Common high-quality male voice
            // Prefer Mexican Spanish over Spain Spanish
            voices.find(v => v.lang === 'es-MX' && !v.name.includes('compact')) ||
            voices.find(v => v.lang === 'es-ES' && !v.name.includes('compact')) ||
            // Fall back to any Spanish voice (avoiding compact/low-quality ones)
            voices.find(v => v.lang.startsWith('es') && !v.name.includes('compact'));

        // Find the best English voice (prefer premium voices)
        const englishVoice =
            voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Microsoft'))) ||
            voices.find(v => v.lang === 'en-US' && (v.name.includes('Enhanced') || v.name.includes('Premium'))) ||
            voices.find(v => v.lang === 'en-US' && !v.name.includes('compact')) ||
            voices.find(v => v.lang.startsWith('en'));

        console.log('🎙️ Selected Spanish voice:', spanishVoice?.name || 'default', `(${spanishVoice?.lang})`);
        console.log('🎙️ Selected English voice:', englishVoice?.name || 'default', `(${englishVoice?.lang})`);

        // Helper function to speak text with better quality
        const speak = (text: string, lang: string, voice?: SpeechSynthesisVoice): Promise<void> => {
            return new Promise((resolve) => {
                // Cancel any ongoing speech and wait a moment
                window.speechSynthesis.cancel();

                // Small delay to ensure cancellation is processed
                setTimeout(() => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = lang;
                    utterance.rate = 0.75; // Even slower for maximum clarity
                    utterance.pitch = 1.0; // Normal pitch
                    utterance.volume = 1.0; // Full volume

                    if (voice) {
                        utterance.voice = voice;
                    }

                    utterance.onend = () => resolve();
                    utterance.onerror = (error) => {
                        console.error('Speech error:', error);
                        resolve(); // Continue even if there's an error
                    };

                    window.speechSynthesis.speak(utterance);
                }, 50); // 50ms delay to ensure proper voice initialization
            });
        };

        try {
            for (let i = 0; i < vocabularySet.length; i++) {
                if (!isPlayingGlossary) break; // Allow stopping

                const term = vocabularySet[i];
                glossaryProgress = i + 1;

                // Speak Spanish term with Spanish voice
                await speak(term.term, 'es-ES', spanishVoice);

                // Pause between Spanish and English
                await new Promise(resolve => setTimeout(resolve, 700));

                // Speak English definition with English voice
                await speak(term.definition, 'en-US', englishVoice);

                // Pause before next term
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        } catch (error) {
            console.error('Error playing glossary:', error);
        } finally {
            isPlayingGlossary = false;
            glossaryProgress = 0;
        }
    }

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

<div class="space-y-4 sm:space-y-6">
    {#if vocabSet}
        <!-- Header with title and term count -->
        <div class="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl p-6 sm:p-8 border-2 border-purple-200 dark:border-purple-700 shadow-lg">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 truncate">{vocabSet.title}</h1>
                    <div class="flex items-center gap-4">
                        <p class="text-base sm:text-lg text-gray-700 dark:text-gray-300 font-medium">{JSON.parse(vocabSet.terms).length} Terms</p>
                    </div>
                </div>
                <!-- Update & Delete buttons (smaller, secondary) -->
                <div class="flex flex-wrap gap-2">
                    <button
                        onclick={playGlossary}
                        class="px-3 py-2 text-sm rounded-lg border-2 transition-all {isPlayingGlossary ? 'border-purple-500 bg-purple-500 hover:bg-purple-600' : 'border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'}"
                        title={isPlayingGlossary ? 'Stop playing glossary' : 'Play audio glossary'}
                    >
                        <span class="{isPlayingGlossary ? 'text-white' : 'text-purple-600 dark:text-purple-400'}">
                            {#if isPlayingGlossary}
                                ⏸️ Stop Glossary ({glossaryProgress}/{vocabularySet.length})
                            {:else}
                                🔊 Play Glossary
                            {/if}
                        </span>
                    </button>
                    <button
                        onclick={updateVocabSet}
                        class="px-3 py-2 text-sm rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-white dark:hover:bg-gray-800 transition-all"
                        title="Update set"
                    >
                        <span class="text-gray-700 dark:text-gray-300">✏️ Update</span>
                    </button>
                    <button
                        onclick={showDeletePopup}
                        class="px-3 py-2 text-sm rounded-lg border-2 border-red-300 dark:border-red-600 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        title="Delete set"
                    >
                        <span class="text-red-600 dark:text-red-400">🗑️ Delete</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Action Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <!-- Learn Card -->
            <button
                onclick={() => goto(`/learn/${setId}`)}
                class="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300"
            >
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                <div class="relative z-10">
                    <div class="text-5xl sm:text-6xl mb-4">🎓</div>
                    <h3 class="text-2xl sm:text-3xl font-bold text-white mb-2">Learn</h3>
                    <p class="text-purple-100 text-sm sm:text-base">Master vocabulary through active recall</p>
                </div>
            </button>

            <!-- Grammar Card -->
            <button
                onclick={() => goto(`/grammar/${setId}`)}
                class="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300"
            >
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                <div class="relative z-10">
                    <div class="text-5xl sm:text-6xl mb-4">📚</div>
                    <h3 class="text-2xl sm:text-3xl font-bold text-white mb-2">Grammar</h3>
                    <p class="text-emerald-100 text-sm sm:text-base">Practice verb conjugations</p>
                </div>
            </button>

            <!-- Flash Cards Card -->
            <button
                class="group relative overflow-hidden bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-6 sm:p-8 shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 opacity-60 cursor-not-allowed"
                disabled
            >
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                <div class="relative z-10">
                    <div class="text-5xl sm:text-6xl mb-4">🎴</div>
                    <h3 class="text-2xl sm:text-3xl font-bold text-white mb-2">Flash Cards</h3>
                    <p class="text-rose-100 text-sm sm:text-base">Coming soon...</p>
                </div>
            </button>
        </div>

        <!-- Tab Navigation -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div class="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onclick={() => activeTab = 'set'}
                    class="flex-1 px-6 py-4 text-base font-semibold transition-all
                        {activeTab === 'set'
                            ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                            : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
                >
                    Set
                </button>
                <button
                    onclick={() => activeTab = 'stats'}
                    class="flex-1 px-6 py-4 text-base font-semibold transition-all
                        {activeTab === 'stats'
                            ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                            : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
                >
                    Stats
                </button>
            </div>
        </div>

        <!-- Stats Tab Content -->
        {#if activeTab === 'stats'}
        <!-- Learning Stats Section -->
        {#if !loadingStats && stats}
        <div class="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg p-4 sm:p-6 border-2 border-purple-200 dark:border-purple-700">
            <button
                onclick={() => learningStatsCollapsed = !learningStatsCollapsed}
                class="w-full flex items-center justify-between mb-4 sm:mb-6 hover:opacity-80 transition-opacity"
            >
                <h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>📊</span> Learning Statistics
                </h2>
                <span class="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 transform transition-transform duration-200" style="transform: rotate({learningStatsCollapsed ? -90 : 0}deg)">
                    ▼
                </span>
            </button>

            {#if !learningStatsCollapsed}
            <!-- Key Stats Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-purple-200 dark:border-purple-700">
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Sessions</p>
                    <p class="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.total_sessions}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-green-200 dark:border-green-700">
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Accuracy</p>
                    <p class="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats.average_accuracy}%</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-blue-200 dark:border-blue-700">
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Best Score</p>
                    <p class="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.best_accuracy}%</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-amber-200 dark:border-amber-700">
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Study Time</p>
                    <p class="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{Math.floor(stats.total_study_time / 60)}m</p>
                </div>
            </div>

            <!-- Detailed Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <!-- Performance Breakdown -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-5 shadow-sm">
                    <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                        <span>🎯</span> Performance Breakdown
                    </h3>
                    <div class="space-y-2 sm:space-y-3">
                        <div class="flex justify-between items-center p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <span class="text-sm sm:text-base text-gray-700 dark:text-gray-300">Total Correct</span>
                            <span class="text-sm sm:text-base font-bold text-green-600 dark:text-green-400">{stats.total_correct}</span>
                        </div>
                        <div class="flex justify-between items-center p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <span class="text-sm sm:text-base text-gray-700 dark:text-gray-300">Total Incorrect</span>
                            <span class="text-sm sm:text-base font-bold text-red-600 dark:text-red-400">{stats.total_incorrect}</span>
                        </div>
                        <div class="flex justify-between items-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <span class="text-sm sm:text-base text-gray-700 dark:text-gray-300">Total Questions</span>
                            <span class="text-sm sm:text-base font-bold text-purple-600 dark:text-purple-400">{stats.total_questions_answered}</span>
                        </div>
                    </div>
                </div>

                <!-- Study Modes -->
                <div class="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-5 shadow-sm">
                    <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                        <span>📚</span> Study Mode Usage
                    </h3>
                    <div class="space-y-2 sm:space-y-3">
                        {#each Object.entries(stats.study_mode_breakdown) as [mode, count]}
                        <div class="flex justify-between items-center p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <span class="text-sm sm:text-base text-gray-700 dark:text-gray-300 capitalize">{mode.replace('-', ' → ')}</span>
                            <span class="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400">{count} sessions</span>
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
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <button
                onclick={() => vocabStatsCollapsed = !vocabStatsCollapsed}
                class="w-full flex items-center justify-between mb-3 sm:mb-4 hover:opacity-80 transition-opacity"
            >
                <h2 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Vocab Statistics</h2>
                <span class="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 transform transition-transform duration-200" style="transform: rotate({vocabStatsCollapsed ? -90 : 0}deg)">
                    ▼
                </span>
            </button>

            {#if !vocabStatsCollapsed}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Total Terms:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.totalTerms}</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Single Words:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.singleWordTerms} ({Math.round((vocabStats.singleWordTerms / vocabStats.totalTerms) * 100)}%)</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Multiple Words:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.multiWordTerms} ({Math.round((vocabStats.multiWordTerms / vocabStats.totalTerms) * 100)}%)</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Avg Cognates:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.averageCognateScore}%</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">High Cognates:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.highCognates}</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Low Cognates:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.lowCognates}</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Verbs:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.verbs}</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Nouns:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.nouns}</p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
                    <p class="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Adjectives:</p>
                    <p class="text-sm sm:text-base font-medium text-purple-500">{vocabStats.adjectives}</p>
                </div>
            </div>
            {/if}
        </div>
        {/if}
        {/if}

        <!-- Set Tab Content -->
        {#if activeTab === 'set'}
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

        <!-- Add Images (only shown if feature is enabled) -->
        {#if featureFlagsStore.isEnabled('image_upload')}
        <button
            onclick={addImages}
            disabled={isAddingImages}
            class="flex items-center justify-center gap-2 sm:gap-3 px-3 py-1.5 sm:p-2 text-sm sm:text-base rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-transparent dark:disabled:hover:border-gray-600 dark:disabled:hover:bg-transparent">
            {#if isAddingImages}
                <svg class="animate-spin h-4 w-4 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            {/if}
            <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                {isAddingImages ? 'Adding Images...' : 'Add Images'}
            </span>
        </button>

        <!-- Toggle Images button (only shown if there are images) -->
        {#if imagesAddedToTerms.length > 0}
        <button
            onclick={toggleImages}
            class="flex items-center justify-center gap-2 sm:gap-3 px-3 py-1.5 sm:p-2 text-sm sm:text-base rounded-md border-2 transition-all group
                {imagesEnabled
                    ? 'border-purple-500 bg-purple-500 hover:bg-purple-600 hover:border-purple-600'
                    : 'border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'}">
            <span class="font-medium {imagesEnabled ? 'text-white' : 'text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400'}">
                {imagesEnabled ? '🖼️ Images On' : '🚫 Images Off'}
            </span>
        </button>
        {/if}
        {/if}
    </div>
</div>


        <!-- Paginated list -->
        {#each paginatedItems as term}
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg transition-colors mb-2 {term.pos === 'verb' && irregularVerbs.get(term.term) ? 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700' : term.pos === 'verb' && stemChangingVerbs.get(term.term) ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                <!-- Left: Term info -->
                <div class="flex items-start sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    {#if imagesAddedToTerms.length > 0 && getImageFromTerm(term.term)}
                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex-shrink-0">
                            <img src="{getImageFromTerm(term.term)}" alt="{term.term}" class="w-full h-full object-cover rounded-lg shadow-lg" />
                        </div>
                    {/if}
                    <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                        <span class="text-sm sm:text-base">{ term.cognateScore }</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-1 sm:gap-2">
                            <p class="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{ term.term }</p>
                            {#if termsBeingProcessed.has(term.term)}
                                <svg class="animate-spin h-4 w-4 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            {/if}
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
                    onclick={cancelDelete}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
                </button>
                <button
                    onclick={confirmDelete}
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
                    onclick={cancelAddImages}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
                </button>
                <button
                    onclick={confirmAddImages}
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