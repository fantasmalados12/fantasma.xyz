// Settings store for user preferences using Svelte 5 runes

export interface GeneralSettings {
	theme: 'light' | 'dark' | 'auto';
	language: 'en' | 'es';
	soundEnabled: boolean;
	notificationsEnabled: boolean;
	dailyGoal: number; // terms per day
	studyReminders: boolean;
	fontSize: 'small' | 'medium' | 'large';
	animations: boolean;
}

export interface LearnSettings {
	// Quiz settings
	defaultStudyMode: 'term-to-definition' | 'definition-to-term' | 'both';
	defaultQuestionType: 'mixed' | 'multiple-choice' | 'written';
	multipleChoiceCount: 3 | 4 | 5 | 6;

	// Difficulty
	fuzzyMatchingTolerance: 'lenient' | 'normal' | 'strict'; // 30%, 20%, 10%
	confidenceThreshold: 2 | 3; // mastery level

	// Features
	showImages: boolean;
	autoPlayAudio: boolean;
	cardFlipAnimation: boolean;
	keyboardShortcuts: boolean;
	showDefinitionImmediately: boolean;

	// Session
	autoSaveInterval: number; // seconds
	sessionDurationTarget: number; // minutes, 0 = no target
	shuffleQuestions: boolean;

	// Spaced repetition
	retryAttempts: number; // 1-3
	showProgressBar: boolean;
}

export interface GrammarSettings {
	// Strictness
	requireAccents: boolean;
	caseSensitive: boolean;

	// Features
	showHints: boolean;
	hintDelay: number; // seconds before hint appears
	showConjugationTable: boolean;
	autoPlayPronunciation: boolean;

	// Practice preferences
	includeGenderVariants: boolean; // nosotras/vosotras
	focusMode: 'all' | 'regular-only' | 'irregular-only';
	defaultTenses: string[]; // array of tense IDs

	// Display
	highlightCommonMistakes: boolean;
	showProgressiveHints: boolean; // show stem, then ending
}

export interface UserSettings {
	general: GeneralSettings;
	learn: LearnSettings;
	grammar: GrammarSettings;
}

// Default settings
const defaultSettings: UserSettings = {
	general: {
		theme: 'dark',
		language: 'en',
		soundEnabled: true,
		notificationsEnabled: true,
		dailyGoal: 50,
		studyReminders: true,
		fontSize: 'medium',
		animations: true
	},
	learn: {
		defaultStudyMode: 'both',
		defaultQuestionType: 'mixed',
		multipleChoiceCount: 4,
		fuzzyMatchingTolerance: 'normal',
		confidenceThreshold: 2,
		showImages: true,
		autoPlayAudio: false,
		cardFlipAnimation: true,
		keyboardShortcuts: true,
		showDefinitionImmediately: false,
		autoSaveInterval: 10,
		sessionDurationTarget: 0,
		shuffleQuestions: true,
		retryAttempts: 2,
		showProgressBar: true
	},
	grammar: {
		requireAccents: false,
		caseSensitive: false,
		showHints: true,
		hintDelay: 5,
		showConjugationTable: false,
		autoPlayPronunciation: false,
		includeGenderVariants: true,
		focusMode: 'all',
		defaultTenses: ['present', 'preterite', 'imperfect'],
		highlightCommonMistakes: true,
		showProgressiveHints: false
	}
};

// Load settings from localStorage
function loadSettings(): UserSettings {
	if (typeof window === 'undefined') return defaultSettings;

	try {
		const stored = localStorage.getItem('user_settings');
		if (stored) {
			const parsed = JSON.parse(stored);
			// Merge with defaults to ensure all keys exist
			return {
				general: { ...defaultSettings.general, ...parsed.general },
				learn: { ...defaultSettings.learn, ...parsed.learn },
				grammar: { ...defaultSettings.grammar, ...parsed.grammar }
			};
		}
	} catch (e) {
		console.error('Failed to load settings:', e);
	}

	return defaultSettings;
}

// Save settings to localStorage
function saveSettings(settings: UserSettings) {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem('user_settings', JSON.stringify(settings));
	} catch (e) {
		console.error('Failed to save settings:', e);
	}
}

// Create reactive settings state
function createSettingsStore() {
	let settings = $state<UserSettings>(loadSettings());

	return {
		get general() { return settings.general; },
		get learn() { return settings.learn; },
		get grammar() { return settings.grammar; },

		updateGeneral(updates: Partial<GeneralSettings>) {
			settings.general = { ...settings.general, ...updates };
			saveSettings(settings);
		},

		updateLearn(updates: Partial<LearnSettings>) {
			settings.learn = { ...settings.learn, ...updates };
			saveSettings(settings);
		},

		updateGrammar(updates: Partial<GrammarSettings>) {
			settings.grammar = { ...settings.grammar, ...updates };
			saveSettings(settings);
		},

		reset() {
			settings = { ...defaultSettings };
			saveSettings(settings);
		},

		export() {
			return JSON.stringify(settings, null, 2);
		},

		import(json: string) {
			try {
				const imported = JSON.parse(json);
				settings = {
					general: { ...defaultSettings.general, ...imported.general },
					learn: { ...defaultSettings.learn, ...imported.learn },
					grammar: { ...defaultSettings.grammar, ...imported.grammar }
				};
				saveSettings(settings);
				return true;
			} catch (e) {
				console.error('Failed to import settings:', e);
				return false;
			}
		}
	};
}

export const userSettings = createSettingsStore();
