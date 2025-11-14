
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from '$app/stores';
    import { getLibrarySets, getImagesFromSet } from "../../../utils/LibrarySets";
    import { goto } from "$app/navigation";
    import { generateSmartExample } from "../../../utils/ExampleSentences";
    import { authStore } from "../../../utils/authStore.svelte";
    import { getAPIUrlBasedOffEnviornment } from "../../../utils/API";
    import { userSettings } from "../../../utils/settings.svelte";

    const API_BASE = getAPIUrlBasedOffEnviornment();

    // Helper to get account ID safely
    function getAccountId(): string | null {
        return authStore.user?.id || null;
    }

    let vocabSet: any = null;
    let imagesAddedToTerms: any = [];
    let imagesEnabled = userSettings.learn.showImages; // Use setting
    $: setId = $page.params.id;
    $: vocabularySet = vocabSet ? (
        (() => {
            try {
                const parsed = JSON.parse(vocabSet.terms);
                console.log('Parsed vocabulary set:', parsed);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.error('Error parsing vocabulary terms:', e);
                return [];
            }
        })()
    ) : [];

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

    async function reloadImages() {
        try {
            const addedImages = await getImagesFromSet(Number(setId));
            imagesAddedToTerms = addedImages?.images || [];
            console.log('📸 Images reloaded:', imagesAddedToTerms.length);
        } catch (error) {
            console.error('Error reloading images:', error);
            imagesAddedToTerms = [];
        }
    }

    // Watch for changes to imagesEnabled and reload if turning back on
    $: if (imagesEnabled && vocabSet) {
        reloadImages();
    }

    function getImageFromTerm(term: string) {
        // If images are disabled for this set, return null
        if (!imagesEnabled) {
            return null;
        }

        if (!imagesAddedToTerms || !Array.isArray(imagesAddedToTerms) || imagesAddedToTerms.length === 0) {
            return null;
        }
        const foundTerms = imagesAddedToTerms.filter((item: any) => item.associated_term === `icono-de-${term}`);
        if (foundTerms.length > 0) {
            return foundTerms[0].image_url;
        } else {
            return null;
        }
    }

    // Filtered vocabulary set based on POS selection
    $: filteredVocabularySet = (() => {
        if (selectedPOS.has('all') || selectedPOS.size === 0) {
            return vocabularySet;
        }
        return vocabularySet.filter((term: any) => selectedPOS.has(term.pos));
    })();

    // Shuffle the terms for learning
    let shuffledTerms: any[] = [];
    let currentIndex = 0;
    let userAnswer = '';
    let showFeedback = false;
    let isCorrect = false;
    let answeredTerms: Set<number> = new Set();
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let incorrectTerms: any[] = [];
    let struggledTerms: Map<number, number> = new Map(); // Track how many times each term was wrong
    let hasInitialized = false;

    // Study mode: 'term-to-definition' or 'definition-to-term'
    let studyMode: 'term-to-definition' | 'definition-to-term' = userSettings.learn.defaultStudyMode === 'both' ? 'term-to-definition' : userSettings.learn.defaultStudyMode;

    // Question type: 'written' or 'multiple-choice'
    let questionType: 'written' | 'multiple-choice' = 'multiple-choice';
    let questionTypePreference: 'mixed' | 'multiple-choice' | 'written' = userSettings.learn.defaultQuestionType;
    let multipleChoiceOptions: any[] = [];
    let multipleChoiceCorrectAnswer: string = ''; // Store what the correct answer should be
    let selectedOption: number | null = null;

    // Retry logic for wrong answers
    let isRetrying = false;
    let retryAttempt = 0; // 0 = first attempt, 1 = first retry (MC), 2 = second retry (written), etc.

    // POS (Part of Speech) filter
    let selectedPOS: Set<string> = new Set(['all']); // 'all', 'noun', 'verb', 'adjective', etc.
    let availablePOS: string[] = [];

    // Progress save/load
    let showContinueModal = false;
    let savedProgress: any = null;
    let autoSaveInterval: any = null;

    // Session tracking
    let sessionStartTime: number = 0;
    let questionTypesUsed: Set<string> = new Set();

    // Example sentence
    let exampleSentence: string = '';

    // Confidence tracking for spaced repetition
    let termConfidence: Map<number, number> = new Map(); // 0 = not learned, 1-3 = confidence levels
    let termQueue: any[] = []; // Queue for spaced repetition

    // Reactive: Extract available POS tags from vocabulary set
    $: if (vocabularySet.length > 0) {
        const posSet = new Set<string>();
        vocabularySet.forEach((term: any) => {
            if (term.pos) {
                posSet.add(term.pos);
            }
        });
        availablePOS = Array.from(posSet).sort();
        console.log('Available POS tags:', availablePOS);
    }

    // Track previous filtered set length to detect filter changes
    let previousFilteredLength = 0;

    // Reactive: Initialize shuffled terms when vocabulary set is loaded
    $: if (filteredVocabularySet.length > 0 && !hasInitialized) {
        console.log('Initializing with', filteredVocabularySet.length, 'terms');
        shuffleTerms();
        hasInitialized = true;
        previousFilteredLength = filteredVocabularySet.length;
    }

    // Reactive: Re-shuffle when POS filter changes (detected by length change)
    $: if (hasInitialized && filteredVocabularySet.length > 0 && filteredVocabularySet.length !== previousFilteredLength) {
        console.log('🔍 POS filter changed, re-shuffling with', filteredVocabularySet.length, 'terms');
        previousFilteredLength = filteredVocabularySet.length;
        shuffleTerms();
    }

    // Reactive: Regenerate question when currentIndex changes
    $: if (currentTerm && hasInitialized) {
        console.log('📍 Current index changed to:', currentIndex);
        generateQuestionType();
    }

    // Reactive: Regenerate question when study mode changes (but not during feedback)
    $: if (studyMode && currentTerm && hasInitialized && !showFeedback) {
        console.log('🔄 Study mode changed to:', studyMode);
        generateQuestionType();
    }

    // Reactive: Save session results and delete progress when session is complete
    $: if (isComplete && hasInitialized) {
        saveSessionResults();
        deleteProgress();
    }

    // Load saved progress
    async function loadProgress() {
        const accountId = getAccountId();
        if (!accountId) {
            console.error('No account ID available for loading progress');
            return null;
        }

        try {
            console.log('🔍 Loading progress for vocab set:', setId);
            const response = await fetch(`${API_BASE}/api/learnprogress/${accountId}/${setId}`);
            console.log('📡 Load progress response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Progress loaded successfully:', data.progress);
                return data.progress;
            }
            console.log('ℹ️ No progress found (404 expected if new session)');
            return null;
        } catch (error) {
            console.error('❌ Error loading progress:', error);
            return null;
        }
    }

    // Save progress
    async function saveProgress() {
        const accountId = getAccountId();
        if (!accountId) {
            console.error('No account ID available for saving progress');
            return;
        }

        try {
            const progress = {
                shuffled_terms: shuffledTerms,
                current_index: currentIndex,
                answered_terms: Array.from(answeredTerms),
                correct_answers: correctAnswers,
                incorrect_answers: incorrectAnswers,
                incorrect_terms: incorrectTerms,
                term_confidence: Object.fromEntries(termConfidence),
                study_mode: studyMode,
                question_type_preference: questionTypePreference,
                selected_pos: Array.from(selectedPOS),
                is_retrying: isRetrying,
                retry_attempt: retryAttempt,
            };

            console.log('💾 Saving progress...', { accountId, currentIndex, answered: answeredTerms.size });

            const response = await fetch(`${API_BASE}/api/learnprogress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: accountId,
                    vocab_set_id: parseInt(setId!),
                    progress,
                }),
            });

            if (response.ok) {
                console.log('✅ Progress saved successfully');
            } else {
                console.error('❌ Failed to save progress:', response.status);
            }
        } catch (error) {
            console.error('❌ Error saving progress:', error);
        }
    }

    // Delete progress (restart)
    async function deleteProgress() {
        const accountId = getAccountId();
        if (!accountId) {
            console.error('No account ID available for deleting progress');
            return;
        }

        try {
            await fetch(`${API_BASE}/api/learnprogress/${accountId}/${setId}`, {
                method: 'DELETE',
            });
            console.log('✅ Progress deleted successfully');
        } catch (error) {
            console.error('Error deleting progress:', error);
        }
    }

    // Save session results
    async function saveSessionResults() {
        const accountId = getAccountId();
        if (!accountId) {
            console.error('No account ID available for saving session results');
            return;
        }

        try {
            const sessionDuration = sessionStartTime > 0
                ? Math.floor((Date.now() - sessionStartTime) / 1000) // in seconds
                : 0;

            const accuracy = filteredVocabularySet.length > 0
                ? (correctAnswers / filteredVocabularySet.length) * 100
                : 0;

            // Find mastered terms (answered correctly with high confidence)
            const masteredTerms = shuffledTerms.filter((term, idx) =>
                answeredTerms.has(idx) && (termConfidence.get(idx) || 0) >= userSettings.learn.confidenceThreshold
            );

            const sessionResult = {
                total_questions: filteredVocabularySet.length,
                correct_answers: correctAnswers,
                incorrect_answers: incorrectAnswers,
                accuracy: Math.round(accuracy * 100) / 100,
                session_duration: sessionDuration,
                study_mode: studyMode,
                question_types_used: Array.from(questionTypesUsed).join(','),
                struggled_terms: incorrectTerms,
                mastered_terms: masteredTerms,
            };

            console.log('💾 Saving session results:', sessionResult, 'for account:', accountId);

            const response = await fetch(`${API_BASE}/api/sessionstats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: accountId,
                    vocab_set_id: parseInt(setId!),
                    session_result: sessionResult,
                }),
            });

            if (response.ok) {
                console.log('✅ Session results saved successfully');
            } else {
                console.error('❌ Failed to save session results:', response.status);
            }
        } catch (error) {
            console.error('❌ Error saving session results:', error);
        }
    }

    // Restore progress from saved state
    function restoreProgress(progress: any) {
        console.log('🔄 Restoring progress from saved state:', progress);

        // Parse and restore all state
        const parsedShuffledTerms = JSON.parse(progress.shuffled_terms);
        const parsedAnsweredTerms = new Set<number>(JSON.parse(progress.answered_terms));
        let parsedCurrentIndex = progress.current_index;

        shuffledTerms = parsedShuffledTerms;
        answeredTerms = parsedAnsweredTerms;
        correctAnswers = progress.correct_answers;
        incorrectAnswers = progress.incorrect_answers;
        incorrectTerms = JSON.parse(progress.incorrect_terms);

        // Restore term confidence map
        const confidenceObj = JSON.parse(progress.term_confidence);
        termConfidence = new Map(Object.entries(confidenceObj).map(([k, v]) => [parseInt(k), v as number]));

        studyMode = progress.study_mode;
        questionTypePreference = progress.question_type_preference;
        selectedPOS = new Set(JSON.parse(progress.selected_pos));
        isRetrying = progress.is_retrying;
        retryAttempt = progress.retry_attempt;

        // Initialize term queue from shuffled terms
        termQueue = parsedShuffledTerms.map((term: any, idx: number) => ({
            term,
            originalIndex: idx,
            repetitions: 0,
            lastCorrect: false
        }));

        // Find the correct next unanswered question
        // If current index was already answered, find the next unanswered one
        if (parsedAnsweredTerms.has(parsedCurrentIndex)) {
            console.log('⚠️ Current saved index was already answered, finding next unanswered...');

            // Find next unanswered term starting from saved index
            let nextIndex = parsedCurrentIndex + 1;
            while (nextIndex < parsedShuffledTerms.length && parsedAnsweredTerms.has(nextIndex)) {
                nextIndex++;
            }

            // If we reached the end, wrap around to find first unanswered
            if (nextIndex >= parsedShuffledTerms.length) {
                nextIndex = 0;
                while (nextIndex < parsedShuffledTerms.length && parsedAnsweredTerms.has(nextIndex)) {
                    nextIndex++;
                }
            }

            parsedCurrentIndex = nextIndex;
            console.log('📌 Adjusted to next unanswered question at index:', parsedCurrentIndex);
        }

        // Prevent reactive statements from re-shuffling
        previousFilteredLength = filteredVocabularySet.length;

        // Mark as initialized first
        hasInitialized = true;
        showContinueModal = false;

        console.log('✅ Progress restored:', {
            savedIndex: progress.current_index,
            adjustedIndex: parsedCurrentIndex,
            totalTerms: parsedShuffledTerms.length,
            answeredCount: answeredTerms.size,
            answeredIndices: Array.from(parsedAnsweredTerms),
            currentTerm: parsedShuffledTerms[parsedCurrentIndex],
            wasAdjusted: progress.current_index !== parsedCurrentIndex
        });

        // Set currentIndex last to trigger reactive statements
        currentIndex = parsedCurrentIndex;
    }

    // Handle continue from saved progress
    function handleContinue() {
        if (savedProgress) {
            restoreProgress(savedProgress);
        }
    }

    // Handle restart (delete progress and start fresh)
    async function handleRestart() {
        await deleteProgress();
        showContinueModal = false;
        hasInitialized = false;
        // This will trigger the reactive statement to shuffle terms
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
        console.log('All vocab sets:', vocabs);

        const foundSet = vocabs.vocabSets.find((set: any) => set.id == setId);
        console.log('Found set:', foundSet);

        if (foundSet) {
            vocabSet = foundSet;

            // Load image display preference
            loadImagesEnabledState();

            // Load images for this vocab set
            try {
                const addedImages = await getImagesFromSet(foundSet.id);
                imagesAddedToTerms = addedImages?.images || [];
                console.log('📸 Images loaded:', imagesAddedToTerms.length);
            } catch (error) {
                console.error('Error loading images:', error);
                imagesAddedToTerms = [];
            }

            // Check for saved progress
            const progress = await loadProgress();
            if (progress) {
                savedProgress = progress;
                showContinueModal = true;
            }
            // shuffleTerms() will be called automatically by the reactive statement if no modal
        } else {
            goto('/vocab-sets');
        }

        // Auto-save based on user settings
        const autoSaveMs = userSettings.learn.autoSaveInterval * 1000;
        autoSaveInterval = setInterval(() => {
            if (hasInitialized && !isComplete) {
                saveProgress();
            }
        }, autoSaveMs);
    });

    // Separate lifecycle for keyboard listener to avoid async/cleanup conflict
    onMount(() => {
        // Add global keyboard listener
        window.addEventListener('keydown', handleGlobalKeyPress);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyPress);
        };
    });

    // Cleanup on unmount
    onDestroy(() => {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
        }
        // Save one final time before leaving
        if (hasInitialized && !isComplete) {
            saveProgress();
        }
    });

    function shuffleTerms() {
        // Shuffle only if user setting is enabled
        if (userSettings.learn.shuffleQuestions) {
            shuffledTerms = [...filteredVocabularySet].sort(() => Math.random() - 0.5);
        } else {
            shuffledTerms = [...filteredVocabularySet];
        }

        // Initialize term queue for spaced repetition
        termQueue = shuffledTerms.map((term, idx) => ({
            term,
            originalIndex: idx,
            repetitions: 0,
            lastCorrect: false
        }));

        currentIndex = 0;
        answeredTerms.clear();
        answeredTerms = answeredTerms; // Trigger Svelte reactivity
        correctAnswers = 0;
        incorrectAnswers = 0;
        incorrectTerms = [];
        termConfidence.clear();
        isRetrying = false;
        retryAttempt = 0;

        // Initialize session tracking
        sessionStartTime = Date.now();
        questionTypesUsed.clear();

        generateQuestionType();
    }

    function generateQuestionType() {
        // When retrying a wrong answer, force question type progression
        if (isRetrying) {
            // First retry: multiple choice
            // Second+ retry: written
            if (retryAttempt === 0) {
                questionType = 'multiple-choice';
            } else {
                questionType = 'written';
            }
        } else {
            // Choose question type based on user preference
            if (questionTypePreference === 'mixed') {
                // Randomly choose between multiple choice and written
                // 60% multiple choice, 40% written for better Quizlet-like experience
                questionType = Math.random() < 0.6 ? 'multiple-choice' : 'written';
            } else {
                questionType = questionTypePreference;
            }
        }

        if (questionType === 'multiple-choice') {
            generateMultipleChoiceOptions();
        }

        // Track which question types are used
        questionTypesUsed.add(questionType);

        selectedOption = null;
        userAnswer = '';
    }

    function generateMultipleChoiceOptions() {
        if (!currentTerm || !filteredVocabularySet.length) return;

        const correctAnswer = studyMode === 'term-to-definition'
            ? currentTerm.definition
            : currentTerm.term;

        console.log('=== Generating Multiple Choice ===');
        console.log('Current term:', currentTerm);
        console.log('Study mode:', studyMode);
        console.log('Correct answer should be:', correctAnswer);

        // Get wrong answers based on user setting for number of options
        const numWrongOptions = userSettings.learn.multipleChoiceCount - 1; // Subtract 1 for correct answer
        const wrongOptions = filteredVocabularySet
            .filter((t: any) => {
                // Filter out the current term completely
                if (t.term === currentTerm.term && t.definition === currentTerm.definition) {
                    return false;
                }
                return true;
            })
            .sort(() => Math.random() - 0.5)
            .slice(0, numWrongOptions)
            .map((t: any) => studyMode === 'term-to-definition' ? t.definition : t.term);

        console.log('Wrong options:', wrongOptions);

        // Combine correct answer with wrong options
        const allOptions = [correctAnswer, ...wrongOptions];
        console.log('All options before shuffle:', allOptions);

        // Shuffle the options
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
        console.log('Shuffled options:', shuffledOptions);

        // Store the correct answer at generation time
        multipleChoiceCorrectAnswer = correctAnswer;
        multipleChoiceOptions = shuffledOptions;

        console.log('✅ Stored correct answer:', multipleChoiceCorrectAnswer);
        console.log('✅ Final options:', multipleChoiceOptions);
    }

    function fuzzyMatch(answer: string, correct: string): boolean {
        // Normalize strings: lowercase, remove accents, trim
        const normalize = (str: string) => str
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics

        const normalizedAnswer = normalize(answer);
        const normalizedCorrect = normalize(correct);

        // Exact match after normalization
        if (normalizedAnswer === normalizedCorrect) return true;

        // Calculate Levenshtein distance for fuzzy matching
        const distance = levenshteinDistance(normalizedAnswer, normalizedCorrect);
        const maxLength = Math.max(normalizedAnswer.length, normalizedCorrect.length);

        // Get tolerance from settings: lenient (30%), normal (20%), strict (10%)
        const toleranceMap = {
            'lenient': 0.3,
            'normal': 0.2,
            'strict': 0.1
        };
        const tolerance = toleranceMap[userSettings.learn.fuzzyMatchingTolerance];

        return distance / maxLength <= tolerance;
    }

    function levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    $: currentTerm = shuffledTerms[currentIndex];
    $: progress = filteredVocabularySet.length > 0
        ? Math.round((answeredTerms.size / filteredVocabularySet.length) * 100)
        : 0;
    $: isComplete = answeredTerms.size === filteredVocabularySet.length && filteredVocabularySet.length > 0;

    function checkAnswer() {
        // For multiple choice, use the stored correct answer from generation time
        // For written, calculate it fresh (in case study mode was changed)
        const correctAnswer = questionType === 'multiple-choice'
            ? multipleChoiceCorrectAnswer
            : (studyMode === 'term-to-definition' ? currentTerm.definition : currentTerm.term);

        console.log('--- Checking Answer ---');
        console.log('Current term when checking:', currentTerm);
        console.log('Study mode:', studyMode);
        console.log('Question type:', questionType);
        console.log('Correct answer:', correctAnswer);

        // Verify correct answer is in options
        if (questionType === 'multiple-choice') {
            if (!multipleChoiceOptions.includes(correctAnswer)) {
                console.error('❌ BUG: Correct answer is NOT in the options!');
                console.error('Correct answer:', correctAnswer);
                console.error('Options:', multipleChoiceOptions);
                console.error('This should never happen! The question/answer is mismatched.');
            }
        }

        if (questionType === 'multiple-choice') {
            if (selectedOption === null) return;
            const selectedAnswer = multipleChoiceOptions[selectedOption];
            console.log('Selected option index:', selectedOption);
            console.log('Selected answer:', selectedAnswer);
            console.log('Selected answer (trimmed):', selectedAnswer?.trim());
            console.log('Correct answer (trimmed):', correctAnswer?.trim());
            console.log('All options:', multipleChoiceOptions);
            // Trim both for comparison in case of whitespace issues
            isCorrect = selectedAnswer?.trim() === correctAnswer?.trim();
            console.log('Is correct?', isCorrect);
        } else {
            // Written answer with fuzzy matching
            if (!userAnswer.trim()) return;
            console.log('User typed answer:', userAnswer);
            isCorrect = fuzzyMatch(userAnswer, correctAnswer);
            console.log('Is correct?', isCorrect);
        }

        // Handle correct vs incorrect answers
        if (isCorrect) {
            // Correct answer - proceed normally
            correctAnswers++;

            // Update confidence tracking
            const currentConfidence = termConfidence.get(currentIndex) || 0;
            const maxConfidence = userSettings.learn.confidenceThreshold;
            termConfidence.set(currentIndex, Math.min(maxConfidence, currentConfidence + 1));

            // Update term queue for spaced repetition
            const queueItem = termQueue[currentIndex];
            if (queueItem) {
                queueItem.lastCorrect = true;
                queueItem.repetitions++;
            }

            // Mark as answered and reset retry state
            answeredTerms.add(currentIndex);
            answeredTerms = answeredTerms; // Trigger Svelte reactivity
            isRetrying = false;
            retryAttempt = 0;
        } else {
            // Incorrect answer - set up retry
            incorrectAnswers++;

            // Add to incorrect terms list if not already there
            if (!incorrectTerms.some(t => t.term === currentTerm.term)) {
                incorrectTerms.push(currentTerm);
            }

            // Update confidence to 0
            termConfidence.set(currentIndex, 0);

            // Set retry state
            isRetrying = true;
            // Don't mark as answered - they need to try again
        }

        showFeedback = true;
    }

    function selectMultipleChoiceOption(index: number) {
        if (showFeedback) return;
        selectedOption = index;
    }

    function nextCard() {
        showFeedback = false;
        userAnswer = '';
        selectedOption = null;

        // If we're retrying a wrong answer, regenerate question with next question type
        if (isRetrying) {
            retryAttempt++;
            generateQuestionType();
            return;
        }

        // Find next unanswered term
        let nextIndex = currentIndex + 1;
        while (nextIndex < shuffledTerms.length && answeredTerms.has(nextIndex)) {
            nextIndex++;
        }

        if (nextIndex >= shuffledTerms.length) {
            // Wrap around to find first unanswered
            nextIndex = 0;
            while (nextIndex < shuffledTerms.length && answeredTerms.has(nextIndex)) {
                nextIndex++;
            }
        }

        console.log('➡️ Moving to next card:', {
            from: currentIndex,
            to: nextIndex,
            answeredTerms: Array.from(answeredTerms)
        });

        currentIndex = nextIndex;

        // Save progress immediately after moving to next card
        saveProgress();

        // Question will be generated automatically by reactive statement
    }

    function skipCard() {
        nextCard();
    }

    function togglePOS(pos: string) {
        if (pos === 'all') {
            selectedPOS = new Set(['all']);
        } else {
            // Remove 'all' if it's selected
            selectedPOS.delete('all');

            // Toggle the clicked POS
            if (selectedPOS.has(pos)) {
                selectedPOS.delete(pos);
            } else {
                selectedPOS.add(pos);
            }

            // If nothing selected, default back to 'all'
            if (selectedPOS.size === 0) {
                selectedPOS = new Set(['all']);
            }
        }
        selectedPOS = selectedPOS; // Trigger Svelte reactivity
    }

    async function restartSession() {
        await deleteProgress();
        hasInitialized = false;
        userAnswer = '';
        showFeedback = false;
        answeredTerms.clear();
        answeredTerms = answeredTerms; // Trigger Svelte reactivity
        isRetrying = false;
        retryAttempt = 0;
        // shuffleTerms() will be called automatically by the reactive statement
    }

    function studyIncorrect() {
        shuffledTerms = [...incorrectTerms].sort(() => Math.random() - 0.5);
        currentIndex = 0;
        answeredTerms.clear();
        answeredTerms = answeredTerms; // Trigger Svelte reactivity
        correctAnswers = 0;
        incorrectAnswers = 0;
        incorrectTerms = [];
        userAnswer = '';
        showFeedback = false;
        isRetrying = false;
        retryAttempt = 0;
        generateQuestionType();
    }

    function handleKeyPress(event: KeyboardEvent) {
        if (event.key === 'Enter' && !showFeedback) {
            if (questionType === 'written' && userAnswer.trim()) {
                checkAnswer();
            } else if (questionType === 'multiple-choice' && selectedOption !== null) {
                checkAnswer();
            }
        } else if (event.key === 'Enter' && showFeedback) {
            nextCard();
        } else if (!showFeedback && questionType === 'multiple-choice') {
            // Number keys for multiple choice selection
            const num = parseInt(event.key);
            if (!isNaN(num) && num >= 1 && num <= multipleChoiceOptions.length) {
                selectMultipleChoiceOption(num - 1);
            }
        }
    }

    // Add global keyboard listener for multiple choice
    function handleGlobalKeyPress(event: KeyboardEvent) {
        if (questionType === 'multiple-choice' && !showFeedback) {
            const num = parseInt(event.key);
            if (!isNaN(num) && num >= 1 && num <= multipleChoiceOptions.length) {
                selectMultipleChoiceOption(num - 1);
            }
        }
        if (event.key === 'Enter' && showFeedback) {
            nextCard();
        }
    }
</script>

<!-- Continue/Restart Modal -->
{#if showContinueModal}
<div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-purple-500 max-w-md w-full">
        <div class="text-center space-y-6">
            <div class="text-5xl mb-4">📚</div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Continue Learning?</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400">
                We found your previous progress. Would you like to continue where you left off or start fresh?
            </p>

            <div class="space-y-3">
                <button
                    onclick={handleContinue}
                    class="w-full px-6 py-4 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all transform hover:scale-[1.02]"
                >
                    <span class="font-bold text-white text-lg">Continue Learning</span>
                </button>
                <button
                    onclick={handleRestart}
                    class="w-full px-6 py-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                >
                    <span class="font-medium text-gray-700 dark:text-gray-300">Start Fresh</span>
                </button>
            </div>
        </div>
    </div>
</div>
{/if}

<div class="space-y-6">
    {#if vocabSet && vocabularySet.length === 0}
        <!-- No Terms Message -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div class="max-w-2xl mx-auto space-y-6">
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white">No Terms Found</h2>
                <p class="text-xl text-gray-600 dark:text-gray-400">
                    This vocab set "{vocabSet.title}" doesn't have any terms yet.
                </p>
                <p class="text-gray-500 dark:text-gray-400">
                    Add some terms to this set before you can start learning!
                </p>
                <button
                    onclick={() => goto(`/vocab-sets/${setId}`)}
                    class="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
                >
                    <span class="font-medium text-white">Back to Set</span>
                </button>
            </div>
        </div>
    {:else if vocabSet && filteredVocabularySet.length === 0 && vocabularySet.length > 0}
        <!-- No Terms Match Filter -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div class="max-w-2xl mx-auto space-y-6">
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white">No Terms Match Filter</h2>
                <p class="text-xl text-gray-600 dark:text-gray-400">
                    No terms match your current POS filter.
                </p>
                <p class="text-gray-500 dark:text-gray-400">
                    Try selecting different parts of speech or click "All" to see all terms.
                </p>
                <button
                    onclick={() => togglePOS('all')}
                    class="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
                >
                    <span class="font-medium text-white">Show All Terms</span>
                </button>
            </div>
        </div>
    {:else if vocabSet && !isComplete}
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Learn: {vocabSet.title}</h1>
                <p class="text-gray-600 dark:text-gray-400">Master your vocabulary through active recall</p>
            </div>
            <button
                onclick={() => goto(`/vocab-sets/${setId}`)}
                class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
            >
                <span class="font-medium text-gray-700 dark:text-gray-300">Back to Set</span>
            </button>
        </div>

        <!-- Progress Bar -->
        {#if userSettings.learn.showProgressBar}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Progress (Question #{currentIndex + 1})</span>
                <span class="text-sm font-medium text-purple-500">{answeredTerms.size} / {filteredVocabularySet.length}</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div class="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all duration-300" style="width: {progress}%"></div>
            </div>
            <div class="flex items-center justify-between mt-4">
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span class="text-sm text-gray-600 dark:text-gray-400">Correct: {correctAnswers}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span class="text-sm text-gray-600 dark:text-gray-400">Incorrect: {incorrectAnswers}</span>
                </div>
            </div>
        </div>
        {/if}

        <!-- Study Mode Toggle -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700 space-y-4">
            <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Study Mode:</span>
                <div class="flex gap-2">
                    <button
                        onclick={() => studyMode = 'term-to-definition'}
                        class="px-4 py-2 rounded-lg transition-all {studyMode === 'term-to-definition' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        Term → Definition
                    </button>
                    <button
                        onclick={() => studyMode = 'definition-to-term'}
                        class="px-4 py-2 rounded-lg transition-all {studyMode === 'definition-to-term' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        Definition → Term
                    </button>
                </div>
            </div>

            <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Question Type:</span>
                <div class="flex gap-2">
                    <button
                        onclick={() => { questionTypePreference = 'mixed'; if (!showFeedback) generateQuestionType(); }}
                        class="px-4 py-2 rounded-lg transition-all {questionTypePreference === 'mixed' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        Mixed
                    </button>
                    <button
                        onclick={() => { questionTypePreference = 'multiple-choice'; if (!showFeedback) generateQuestionType(); }}
                        class="px-4 py-2 rounded-lg transition-all {questionTypePreference === 'multiple-choice' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        Multiple Choice
                    </button>
                    <button
                        onclick={() => { questionTypePreference = 'written'; if (!showFeedback) generateQuestionType(); }}
                        class="px-4 py-2 rounded-lg transition-all {questionTypePreference === 'written' ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        Written
                    </button>
                </div>
            </div>

            {#if availablePOS.length > 0}
            <div class="flex items-start gap-4">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">Filter by POS:</span>
                <div class="flex flex-wrap gap-2">
                    <button
                        onclick={() => togglePOS('all')}
                        class="px-4 py-2 rounded-lg transition-all {selectedPOS.has('all') ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        All ({vocabularySet.length})
                    </button>
                    {#each availablePOS as pos}
                    <button
                        onclick={() => togglePOS(pos)}
                        class="px-4 py-2 rounded-lg transition-all {selectedPOS.has(pos) ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    >
                        {pos} ({vocabularySet.filter((t) => t.pos === pos).length})
                    </button>
                    {/each}
                </div>
            </div>
            {/if}
        </div>

        <!-- Flashcard -->
        {#if currentTerm}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 transition-all">
            <div class="space-y-6">
                <!-- Question Type Badge -->
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="px-3 py-1 rounded-full text-xs font-medium
                        {questionType === 'multiple-choice'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}">
                        {questionType === 'multiple-choice' ? '📝 Multiple Choice' : '✍️ Written Answer'}
                    </span>
                </div>

                <!-- Question -->
                <div class="text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {studyMode === 'term-to-definition' ? 'Define this term:' : 'What term matches this definition?'}
                    </p>

                    <!-- Display image if available and showing the term -->
                    {#if getImageFromTerm(currentTerm.term)}
                        <div class="flex justify-center mb-4">
                            <div class="w-32 h-32 sm:w-48 sm:h-48 rounded-xl shadow-lg overflow-hidden border-4 border-purple-200 dark:border-purple-700">
                                <img
                                    src="{getImageFromTerm(currentTerm.term)}"
                                    alt="{currentTerm.term}"
                                    class="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    {/if}

                    <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
                        {#if studyMode === 'term-to-definition'}
                            {currentTerm.term}
                        {:else}
                            {currentTerm.definition}
                        {/if}
                    </h2>
                </div>

                <!-- Answer Input -->
                <div class="max-w-2xl mx-auto">
                    {#if questionType === 'written'}
                        <input
                            type="text"
                            bind:value={userAnswer}
                            onkeypress={handleKeyPress}
                            placeholder="Type your answer..."
                            disabled={showFeedback}
                            class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg
                                 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                            autofocus
                        />
                    {:else}
                        <!-- Multiple Choice Options -->
                        <div class="space-y-3">
                            <p class="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
                                Press 1-{multipleChoiceOptions.length} or click to select
                            </p>
                            {#each multipleChoiceOptions as option, index}
                                <button
                                    onclick={() => selectMultipleChoiceOption(index)}
                                    disabled={showFeedback}
                                    class="w-full px-6 py-4 rounded-lg border-2 text-left transition-all transform
                                        {selectedOption === index
                                            ? (showFeedback
                                                ? (isCorrect
                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 scale-[0.98]'
                                                    : 'border-red-500 bg-red-50 dark:bg-red-900/20 scale-[0.98]')
                                                : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-[0.98]')
                                            : (showFeedback && option === (studyMode === 'term-to-definition' ? currentTerm.definition : currentTerm.term)
                                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-400')}
                                        disabled:cursor-not-allowed
                                        {!showFeedback ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:scale-[0.99]' : ''}"
                                >
                                    <div class="flex items-center gap-4">
                                        <div class="flex-shrink-0 w-8 h-8 rounded-full border-2
                                            {selectedOption === index
                                                ? 'border-purple-500 bg-purple-500 text-white'
                                                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}
                                            flex items-center justify-center font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <span class="text-gray-900 dark:text-white font-medium flex-1">{option}</span>
                                        {#if showFeedback}
                                            {#if selectedOption === index && isCorrect}
                                                <span class="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
                                            {:else if selectedOption === index && !isCorrect}
                                                <span class="text-red-600 dark:text-red-400 font-bold text-xl">✗</span>
                                            {:else if option === (studyMode === 'term-to-definition' ? currentTerm.definition : currentTerm.term)}
                                                <span class="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
                                            {/if}
                                        {/if}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Feedback -->
                {#if showFeedback}
                <div class="max-w-2xl mx-auto">
                    <div class="p-4 rounded-lg {isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'}">
                        <div class="flex items-center justify-between mb-2">
                            <p class="font-bold {isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}">
                                {isCorrect ? '✓ Correct!' : '✗ Incorrect - Try again!'}
                            </p>
                            <div class="flex items-center gap-1">
                                <span class="text-sm text-gray-600 dark:text-gray-400">Confidence:</span>
                                {#each Array(userSettings.learn.confidenceThreshold) as _, i}
                                    <div class="w-3 h-3 rounded-full {(termConfidence.get(currentIndex) || 0) > i ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                                {/each}
                            </div>
                        </div>

                        <!-- Always show the correct answer -->
                        <p class="text-gray-700 dark:text-gray-300">
                            <span class="font-medium">Correct answer:</span>
                            {questionType === 'multiple-choice' ? multipleChoiceCorrectAnswer : (studyMode === 'term-to-definition' ? currentTerm.definition : currentTerm.term)}
                        </p>

                        {#if !isCorrect && questionType === 'written'}
                        <p class="text-gray-600 dark:text-gray-400 mt-1">
                            <span class="font-medium">Your answer:</span> {userAnswer}
                        </p>
                        {/if}

                        {#if !isCorrect && isRetrying}
                        <p class="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                            {retryAttempt === 0
                                ? 'Next: Try multiple choice'
                                : 'Next: Type your answer'}
                        </p>
                        {/if}
                    </div>
                </div>
                {/if}

                <!-- Actions -->
                <div class="flex justify-center gap-4">
                    {#if !showFeedback}
                    <button
                        onclick={skipCard}
                        class="px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">Skip</span>
                    </button>
                    <button
                        onclick={checkAnswer}
                        disabled={questionType === 'multiple-choice' ? selectedOption === null : !userAnswer.trim()}
                        class="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span class="font-medium text-white">Check Answer</span>
                    </button>
                    {:else}
                    <button
                        onclick={nextCard}
                        class="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
                    >
                        <span class="font-medium text-white">{isRetrying ? 'Try Again' : 'Continue'}</span>
                    </button>
                    {/if}
                </div>
            </div>
        </div>
        {/if}

    {:else if isComplete}
        <!-- Completion Screen -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <div class="max-w-2xl mx-auto space-y-6">
                <h2 class="text-4xl font-bold text-gray-900 dark:text-white">🎉 Session Complete!</h2>
                <p class="text-xl text-gray-600 dark:text-gray-400">Great job studying {vocabSet?.title}</p>

                <div class="grid grid-cols-2 gap-4 my-8">
                    <div class="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-500">
                        <p class="text-3xl font-bold text-green-700 dark:text-green-400">{correctAnswers}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Correct</p>
                    </div>
                    <div class="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-500">
                        <p class="text-3xl font-bold text-red-700 dark:text-red-400">{incorrectAnswers}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Incorrect</p>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
                    {#if incorrectTerms.length > 0}
                    <button
                        onclick={studyIncorrect}
                        class="w-full px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
                    >
                        <span class="font-medium text-white">Study Incorrect Terms ({incorrectTerms.length})</span>
                    </button>
                    {/if}
                    <button
                        onclick={restartSession}
                        class="w-full px-6 py-3 rounded-lg border-2 border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                    >
                        <span class="font-medium">Restart Session</span>
                    </button>
                    <button
                        onclick={() => goto(`/vocab-sets/${setId}`)}
                        class="w-full px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <span class="font-medium text-gray-700 dark:text-gray-300">Back to Set</span>
                    </button>
                </div>
            </div>
        </div>

    {:else}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    {/if}
</div>
