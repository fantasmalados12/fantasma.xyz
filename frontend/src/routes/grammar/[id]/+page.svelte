
<script lang="ts">
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { getLibrarySets } from "../../../utils/LibrarySets";
    import { goto } from "$app/navigation";
    import { authStore } from "../../../utils/authStore.svelte";
    import { getAPIUrlBasedOffEnviornment } from "../../../utils/API";
    import { userSettings } from "../../../utils/settings.svelte";

    const API_BASE = getAPIUrlBasedOffEnviornment();

    // Helper to get account ID safely
    function getAccountId(): string | null {
        return authStore.user?.id || null;
    }

    let vocabSet: any = null;
    $: setId = $page.params.id;
    $: vocabularySet = vocabSet ? (
        (() => {
            try {
                const parsed = JSON.parse(vocabSet.terms);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('Error parsing vocabulary terms:', e);
                return [];
            }
        })()
    ) : [];

    // Filter to only verbs
    $: verbs = vocabularySet.filter((term: any) => term.pos === 'verb');

    // Available tenses
    const availableTenses = [
        { key: 'INDICATIVE_PRESENT', label: 'Present (Indicative)' },
        { key: 'INDICATIVE_IMPERFECT', label: 'Imperfect' },
        { key: 'INDICATIVE_PRETERITE', label: 'Preterite' },
        { key: 'INDICATIVE_FUTURE', label: 'Future' },
        { key: 'INDICATIVE_PERFECT', label: 'Present Perfect' },
        { key: 'INDICATIVE_PLUPERFECT', label: 'Pluperfect' },
        { key: 'SUBJUNCTIVE_PRESENT', label: 'Present (Subjunctive)' },
        { key: 'SUBJUNCTIVE_IMPERFECT_RA', label: 'Imperfect -ra (Subjunctive)' },
        { key: 'SUBJUNCTIVE_IMPERFECT_SE', label: 'Imperfect -se (Subjunctive)' },
        { key: 'CONDITIONAL_PRESENT', label: 'Conditional' },
    ];

    // Pronouns
    const pronouns = [
        'yo',
        'tú',
        'él/ella/usted',
        'nosotros/nosotras',
        'vosotros/vosotras',
        'ellos/ellas/ustedes'
    ];

    // Quiz state - Initialize from user settings
    let selectedTenses: Set<string> = new Set(userSettings.grammar.defaultTenses.map(t => {
        // Map simple tense names to full keys
        const tenseMap: Record<string, string> = {
            'present': 'INDICATIVE_PRESENT',
            'preterite': 'INDICATIVE_PRETERITE',
            'imperfect': 'INDICATIVE_IMPERFECT',
            'future': 'INDICATIVE_FUTURE',
            'conditional': 'CONDITIONAL_PRESENT',
            'subjunctive': 'SUBJUNCTIVE_PRESENT'
        };
        return tenseMap[t] || 'INDICATIVE_PRESENT';
    }));
    let currentQuestion: any = null;
    let userAnswer = '';
    let showFeedback = false;
    let isCorrect = false;
    let answeredCount = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let hasStarted = false;
    let isLoading = false;
    let loadedVerbsCount = 0;
    let failedVerbsCount = 0;

    // Load conjugations for all verbs
    let verbConjugations: Map<string, any> = new Map();

    async function loadConjugations() {
        isLoading = true;
        let successCount = 0;
        let failCount = 0;

        for (const verb of verbs) {
            try {
                const response = await fetch(`${API_BASE}/api/spanish/conjugations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ verb: verb.term })
                });

                if (response.ok) {
                    const conjugations = await response.json();
                    console.log(`Loaded conjugations for ${verb.term}:`, conjugations);

                    // Validate that we have conjugations
                    if (conjugations && typeof conjugations === 'object') {
                        verbConjugations.set(verb.term, conjugations);
                        successCount++;
                    } else {
                        console.error(`Invalid conjugation data for ${verb.term}:`, conjugations);
                        failCount++;
                    }
                } else {
                    console.error(`HTTP error ${response.status} for ${verb.term}`);
                    failCount++;
                }
            } catch (error) {
                console.error(`Error loading conjugations for ${verb.term}:`, error);
                failCount++;
            }
        }

        console.log(`✅ Loaded ${successCount} verbs, ❌ Failed ${failCount} verbs`);
        loadedVerbsCount = successCount;
        failedVerbsCount = failCount;
        isLoading = false;
        verbConjugations = verbConjugations; // Trigger reactivity
    }

    function toggleTense(tenseKey: string) {
        if (selectedTenses.has(tenseKey)) {
            selectedTenses.delete(tenseKey);
        } else {
            selectedTenses.add(tenseKey);
        }
        selectedTenses = selectedTenses; // Trigger reactivity
    }

    function generateQuestion() {
        if (verbs.length === 0 || selectedTenses.size === 0 || verbConjugations.size === 0) {
            console.error('Cannot generate question: missing data', {
                verbsCount: verbs.length,
                selectedTensesCount: selectedTenses.size,
                loadedConjugationsCount: verbConjugations.size
            });
            return;
        }

        // Only pick from verbs that have loaded conjugations
        const availableVerbs = verbs.filter(v => verbConjugations.has(v.term));
        if (availableVerbs.length === 0) {
            console.error('No verbs with loaded conjugations available');
            return;
        }

        // Pick a random verb from available ones
        const randomVerb = availableVerbs[Math.floor(Math.random() * availableVerbs.length)];

        // Pick a random tense from selected tenses
        const tenseKeys = Array.from(selectedTenses);
        const randomTense = tenseKeys[Math.floor(Math.random() * tenseKeys.length)];

        // Pick a random pronoun
        const randomPronounIndex = Math.floor(Math.random() * pronouns.length);
        const randomPronoun = pronouns[randomPronounIndex];

        // Get the correct conjugation
        const conjugations = verbConjugations.get(randomVerb.term);
        if (!conjugations || !conjugations[randomTense]) {
            console.error('No conjugations found for', randomVerb.term, randomTense, 'Available tenses:', conjugations ? Object.keys(conjugations) : 'none');
            // Try again with a different verb
            generateQuestion();
            return;
        }

        const correctAnswer = conjugations[randomTense][randomPronoun];

        if (!correctAnswer) {
            console.error('No conjugation for pronoun', randomPronoun, 'in', randomTense, 'for', randomVerb.term);
            // Try again
            generateQuestion();
            return;
        }

        currentQuestion = {
            verb: randomVerb.term,
            tense: randomTense,
            tenseLabel: availableTenses.find(t => t.key === randomTense)?.label || randomTense,
            pronoun: randomPronoun,
            correctAnswer: correctAnswer,
        };

        userAnswer = '';
        showFeedback = false;
    }

    function normalizeAnswer(answer: string, stripAccents: boolean = false): string {
        // Strip HTML tags (like <strong>)
        answer = answer.replace(/<[^>]*>/g, '');

        // Normalize case based on settings
        if (!userSettings.grammar.caseSensitive) {
            answer = answer.toLowerCase();
        }

        // Strip accents if not required by settings
        if (stripAccents && !userSettings.grammar.requireAccents) {
            answer = answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        // Trim and remove extra spaces
        return answer.trim().replace(/\s+/g, ' ');
    }

    function checkAnswer() {
        if (!userAnswer.trim()) return;

        const stripAccents = !userSettings.grammar.requireAccents;
        const normalizedUser = normalizeAnswer(userAnswer, stripAccents);
        const normalizedCorrect = normalizeAnswer(currentQuestion.correctAnswer, stripAccents);

        isCorrect = normalizedUser === normalizedCorrect;

        if (isCorrect) {
            correctAnswers++;
        } else {
            incorrectAnswers++;
        }

        answeredCount++;
        showFeedback = true;
    }

    function nextQuestion() {
        generateQuestion();
    }

    async function startQuiz() {
        if (selectedTenses.size === 0) {
            alert('Please select at least one tense to quiz on!');
            return;
        }
        hasStarted = true;

        // Only load conjugations if not already loaded
        if (verbConjugations.size === 0) {
            await loadConjugations();
        }

        // Check if we have any conjugations loaded
        if (verbConjugations.size === 0) {
            alert('Failed to load conjugations. Please try again.');
            hasStarted = false;
            return;
        }

        generateQuestion();
    }

    function restartQuiz() {
        hasStarted = false;
        answeredCount = 0;
        correctAnswers = 0;
        incorrectAnswers = 0;
        currentQuestion = null;
        userAnswer = '';
        showFeedback = false;
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter' && !showFeedback) {
            checkAnswer();
        } else if (event.key === 'Enter' && showFeedback) {
            nextQuestion();
        }
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

        const vocabs = await getLibrarySets(accountId);
        const foundSet = vocabs.vocabSets.find((set: any) => set.id == setId);

        if (foundSet) {
            vocabSet = foundSet;
        } else {
            goto('/vocab-sets');
        }
    });

    $: accuracy = answeredCount > 0 ? Math.round((correctAnswers / answeredCount) * 100) : 0;
</script>

<div class="space-y-6">
    {#if vocabSet && verbs.length === 0}
        <!-- No Verbs Message -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div class="max-w-2xl mx-auto space-y-6">
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white">No Verbs Found</h2>
                <p class="text-xl text-gray-600 dark:text-gray-400">
                    This vocab set "{vocabSet.title}" doesn't have any verbs to conjugate.
                </p>
                <p class="text-gray-500 dark:text-gray-400">
                    Grammar quizzes require verbs to practice conjugations!
                </p>
                <button
                    onclick={() => goto(`/vocab-sets/${setId}`)}
                    class="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
                >
                    <span class="font-medium text-white">Back to Set</span>
                </button>
            </div>
        </div>
    {:else if vocabSet && !hasStarted}
        <!-- Setup Screen -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700">
            <div class="max-w-4xl mx-auto space-y-8">
                <!-- Header -->
                <div class="text-center space-y-4">
                    <h1 class="text-4xl font-bold text-gray-900 dark:text-white">Grammar Quiz: {vocabSet.title}</h1>
                    <p class="text-xl text-gray-600 dark:text-gray-400">
                        Practice conjugating {verbs.length} verb{verbs.length !== 1 ? 's' : ''} across different tenses
                    </p>
                </div>

                <!-- Tense Selection -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Select Tenses to Practice</h2>
                    <p class="text-gray-600 dark:text-gray-400">
                        Choose one or more tenses you'd like to practice. You'll be quizzed on random conjugations for the selected tenses.
                    </p>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {#each availableTenses as tense}
                            <button
                                onclick={() => toggleTense(tense.key)}
                                class="px-6 py-4 rounded-lg border-2 text-left transition-all transform hover:scale-[0.99]
                                    {selectedTenses.has(tense.key)
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'}"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center
                                        {selectedTenses.has(tense.key)
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-gray-300 dark:border-gray-600'}">
                                        {#if selectedTenses.has(tense.key)}
                                            <span class="text-white text-sm font-bold">✓</span>
                                        {/if}
                                    </div>
                                    <span class="font-medium text-gray-900 dark:text-white">{tense.label}</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Quick Select Buttons -->
                <div class="flex flex-wrap gap-3 justify-center">
                    <button
                        onclick={() => {
                            selectedTenses = new Set(['INDICATIVE_PRESENT', 'INDICATIVE_PRETERITE', 'INDICATIVE_IMPERFECT']);
                        }}
                        class="px-4 py-2 rounded-lg border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">Common Tenses</span>
                    </button>
                    <button
                        onclick={() => {
                            selectedTenses = new Set(availableTenses.map(t => t.key));
                        }}
                        class="px-4 py-2 rounded-lg border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">All Tenses</span>
                    </button>
                    <button
                        onclick={() => {
                            selectedTenses.clear();
                            selectedTenses = selectedTenses;
                        }}
                        class="px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">Clear All</span>
                    </button>
                </div>

                <!-- Start Button -->
                <div class="flex justify-center gap-4">
                    <button
                        onclick={() => goto(`/vocab-sets/${setId}`)}
                        class="px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">Back to Set</span>
                    </button>
                    <button
                        onclick={startQuiz}
                        disabled={selectedTenses.size === 0}
                        class="px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span class="font-bold text-white text-lg">Start Quiz</span>
                    </button>
                </div>

                <!-- Warning for failed conjugations (only show during/after loading) -->
                {#if isLoading}
                <div class="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 text-center">
                    <p class="text-blue-700 dark:text-blue-300">
                        <span class="font-medium">Loading conjugations...</span> This may take a moment.
                    </p>
                </div>
                {/if}

                {#if !isLoading && loadedVerbsCount > 0 && failedVerbsCount > 0}
                <div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4 text-center">
                    <p class="text-amber-700 dark:text-amber-300">
                        <span class="font-medium">⚠️ Note:</span> Successfully loaded {loadedVerbsCount} out of {verbs.length} verbs.
                        {failedVerbsCount} verb{failedVerbsCount !== 1 ? 's' : ''} failed to load conjugations.
                    </p>
                </div>
                {/if}

                {#if !isLoading && loadedVerbsCount === verbs.length && verbs.length > 0}
                <div class="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4 text-center">
                    <p class="text-green-700 dark:text-green-300">
                        <span class="font-medium">✅ Ready!</span> All {loadedVerbsCount} verbs loaded successfully.
                    </p>
                </div>
                {/if}
            </div>
        </div>

    {:else if hasStarted && currentQuestion}
        <!-- Quiz Screen -->
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Grammar Quiz: {vocabSet.title}</h1>
                    <p class="text-gray-600 dark:text-gray-400">Practice verb conjugations</p>
                </div>
                <button
                    onclick={restartQuiz}
                    class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Change Tenses</span>
                </button>
            </div>

            <!-- Stats -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div class="grid grid-cols-3 gap-4">
                    <div class="text-center">
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Questions Answered</p>
                        <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{answeredCount}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Accuracy</p>
                        <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{accuracy}%</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">Score</p>
                        <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{correctAnswers}/{answeredCount}</p>
                    </div>
                </div>
            </div>

            <!-- Question Card -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
                <div class="space-y-6">
                    <!-- Tense Badge -->
                    <div class="flex justify-center">
                        <span class="px-4 py-2 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                            {currentQuestion.tenseLabel}
                        </span>
                    </div>

                    <!-- Question -->
                    <div class="text-center space-y-4">
                        <p class="text-lg text-gray-600 dark:text-gray-400">Conjugate the verb:</p>
                        <h2 class="text-4xl font-bold text-gray-900 dark:text-white">{currentQuestion.verb}</h2>
                        <p class="text-2xl text-gray-700 dark:text-gray-300">for <span class="font-bold text-emerald-600 dark:text-emerald-400">{currentQuestion.pronoun}</span></p>
                    </div>

                    <!-- Answer Input -->
                    <div class="max-w-xl mx-auto">
                        <input
                            type="text"
                            bind:value={userAnswer}
                            onkeypress={handleKeyPress}
                            placeholder="Type the conjugated form..."
                            disabled={showFeedback}
                            class="w-full px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xl text-center
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                            autofocus
                        />
                    </div>

                    <!-- Feedback -->
                    {#if showFeedback}
                    <div class="max-w-xl mx-auto">
                        <div class="p-6 rounded-lg {isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'}">
                            <p class="font-bold text-center text-2xl mb-4 {isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">
                                {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                            </p>

                            <div class="space-y-2">
                                <p class="text-gray-700 dark:text-gray-300">
                                    <span class="font-medium">Correct answer:</span>
                                    <span class="ml-2 text-lg">{@html currentQuestion.correctAnswer}</span>
                                </p>

                                {#if !isCorrect}
                                <p class="text-gray-600 dark:text-gray-400">
                                    <span class="font-medium">Your answer:</span>
                                    <span class="ml-2 text-lg">{userAnswer}</span>
                                </p>
                                {/if}
                            </div>
                        </div>
                    </div>
                    {/if}

                    <!-- Actions -->
                    <div class="flex justify-center gap-4">
                        {#if !showFeedback}
                        <button
                            onclick={checkAnswer}
                            disabled={!userAnswer.trim()}
                            class="px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span class="font-medium text-white text-lg">Check Answer</span>
                        </button>
                        {:else}
                        <button
                            onclick={nextQuestion}
                            class="px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-all"
                        >
                            <span class="font-medium text-white text-lg">Next Question</span>
                        </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

    {:else if hasStarted && isLoading}
        <!-- Loading Screen -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div class="max-w-2xl mx-auto space-y-6">
                <div class="flex justify-center">
                    <svg class="animate-spin h-16 w-16 text-emerald-600 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Loading Conjugations...</h2>
                <p class="text-gray-600 dark:text-gray-400">Preparing your quiz questions</p>
            </div>
        </div>

    {:else}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    {/if}
</div>
