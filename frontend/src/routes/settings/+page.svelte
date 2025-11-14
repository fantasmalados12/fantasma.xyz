<script lang="ts">
  import { userSettings } from '../../utils/settings.svelte';
  import { onMount } from 'svelte';

  let activeTab = $state<'general' | 'learn' | 'grammar'>('general');
  let showResetModal = $state(false);
  let showExportModal = $state(false);
  let exportedSettings = $state('');
  let importText = $state('');
  let importError = $state('');

  // Available tenses for grammar settings
  const availableTenses = [
    { id: 'present', label: 'Present' },
    { id: 'preterite', label: 'Preterite' },
    { id: 'imperfect', label: 'Imperfect' },
    { id: 'future', label: 'Future' },
    { id: 'conditional', label: 'Conditional' },
    { id: 'subjunctive', label: 'Subjunctive' },
  ];

  function handleExport() {
    exportedSettings = userSettings.export();
    showExportModal = true;
  }

  function handleImport() {
    importError = '';
    if (!importText.trim()) {
      importError = 'Please paste settings JSON to import';
      return;
    }

    const success = userSettings.import(importText);
    if (success) {
      importText = '';
      importError = '';
      alert('Settings imported successfully!');
    } else {
      importError = 'Invalid settings format. Please check your JSON.';
    }
  }

  function handleReset() {
    userSettings.reset();
    showResetModal = false;
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(exportedSettings);
    alert('Settings copied to clipboard!');
  }

  function toggleTense(tenseId: string) {
    const current = userSettings.grammar.defaultTenses;
    const newTenses = current.includes(tenseId)
      ? current.filter(t => t !== tenseId)
      : [...current, tenseId];
    userSettings.updateGrammar({ defaultTenses: newTenses });
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
      <p class="text-gray-600 dark:text-gray-400">Customize your learning experience</p>
    </div>
    <div class="flex gap-3">
      <button
        onclick={handleExport}
        class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
      >
        <span class="font-medium text-gray-700 dark:text-gray-300">Export Settings</span>
      </button>
      <button
        onclick={() => showResetModal = true}
        class="px-4 py-2 rounded-lg border-2 border-red-300 dark:border-red-600 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
      >
        <span class="font-medium text-red-600 dark:text-red-400">Reset to Defaults</span>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="flex border-b border-gray-200 dark:border-gray-700">
      <button
        onclick={() => activeTab = 'general'}
        class="flex-1 px-6 py-4 font-medium transition-all border-b-2 {activeTab === 'general'
          ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}"
      >
        General
      </button>
      <button
        onclick={() => activeTab = 'learn'}
        class="flex-1 px-6 py-4 font-medium transition-all border-b-2 {activeTab === 'learn'
          ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}"
      >
        Learn
      </button>
      <button
        onclick={() => activeTab = 'grammar'}
        class="flex-1 px-6 py-4 font-medium transition-all border-b-2 {activeTab === 'grammar'
          ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}"
      >
        Grammar
      </button>
    </div>

    <!-- Tab Content -->
    <div class="p-8">
      {#if activeTab === 'general'}
        <!-- General Settings -->
        <div class="space-y-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">General Settings</h2>
          </div>

          <!-- Appearance -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h3>

            <div class="grid md:grid-cols-2 gap-6">
              <!-- Theme -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  bind:value={userSettings.general.theme}
                  onchange={(e) => userSettings.updateGeneral({ theme: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </div>

              <!-- Font Size -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Font Size
                </label>
                <select
                  bind:value={userSettings.general.fontSize}
                  onchange={(e) => userSettings.updateGeneral({ fontSize: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <!-- Language -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interface Language
                </label>
                <select
                  bind:value={userSettings.general.language}
                  onchange={(e) => userSettings.updateGeneral({ language: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>

            <!-- Animations Toggle -->
            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Enable Animations</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Show smooth transitions and animations</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.general.animations}
                onchange={(e) => userSettings.updateGeneral({ animations: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Learning Goals -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Learning Goals</h3>

            <!-- Daily Goal -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Daily Goal (terms per day): {userSettings.general.dailyGoal}
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                bind:value={userSettings.general.dailyGoal}
                onchange={(e) => userSettings.updateGeneral({ dailyGoal: parseInt(e.currentTarget.value) })}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>10</span>
                <span>50</span>
                <span>100</span>
                <span>150</span>
                <span>200</span>
              </div>
            </div>
          </div>

          <!-- Notifications -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Enable Notifications</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Receive notifications about your progress</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.general.notificationsEnabled}
                onchange={(e) => userSettings.updateGeneral({ notificationsEnabled: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Study Reminders</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Get reminded to practice daily</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.general.studyReminders}
                onchange={(e) => userSettings.updateGeneral({ studyReminders: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Sound -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Sound</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Sound Effects</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Play sounds for correct/incorrect answers</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.general.soundEnabled}
                onchange={(e) => userSettings.updateGeneral({ soundEnabled: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>
        </div>

      {:else if activeTab === 'learn'}
        <!-- Learn Settings -->
        <div class="space-y-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Learn Settings</h2>
          </div>

          <!-- Quiz Defaults -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Quiz Defaults</h3>

            <div class="grid md:grid-cols-2 gap-6">
              <!-- Study Mode -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Study Mode
                </label>
                <select
                  bind:value={userSettings.learn.defaultStudyMode}
                  onchange={(e) => userSettings.updateLearn({ defaultStudyMode: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="term-to-definition">Term → Definition</option>
                  <option value="definition-to-term">Definition → Term</option>
                  <option value="both">Both (Mixed)</option>
                </select>
              </div>

              <!-- Question Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Question Type
                </label>
                <select
                  bind:value={userSettings.learn.defaultQuestionType}
                  onchange={(e) => userSettings.updateLearn({ defaultQuestionType: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="mixed">Mixed</option>
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="written">Written</option>
                </select>
              </div>

              <!-- Multiple Choice Options -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Multiple Choice Options
                </label>
                <select
                  bind:value={userSettings.learn.multipleChoiceCount}
                  onchange={(e) => userSettings.updateLearn({ multipleChoiceCount: parseInt(e.currentTarget.value) as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="3">3 options</option>
                  <option value="4">4 options</option>
                  <option value="5">5 options</option>
                  <option value="6">6 options</option>
                </select>
              </div>

              <!-- Fuzzy Matching -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Answer Matching Tolerance
                </label>
                <select
                  bind:value={userSettings.learn.fuzzyMatchingTolerance}
                  onchange={(e) => userSettings.updateLearn({ fuzzyMatchingTolerance: e.currentTarget.value as any })}
                  class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="lenient">Lenient (30% tolerance)</option>
                  <option value="normal">Normal (20% tolerance)</option>
                  <option value="strict">Strict (10% tolerance)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Learning Features -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Learning Features</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Images</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Display images for vocabulary terms when available</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.showImages}
                onchange={(e) => userSettings.updateLearn({ showImages: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Auto-play Audio</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Automatically play pronunciation audio</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.autoPlayAudio}
                onchange={(e) => userSettings.updateLearn({ autoPlayAudio: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Card Flip Animation</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Animate card transitions</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.cardFlipAnimation}
                onchange={(e) => userSettings.updateLearn({ cardFlipAnimation: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Keyboard Shortcuts</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Enable keyboard shortcuts for faster navigation</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.keyboardShortcuts}
                onchange={(e) => userSettings.updateLearn({ keyboardShortcuts: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Definition Immediately</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Display definition before answering (flashcard mode)</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.showDefinitionImmediately}
                onchange={(e) => userSettings.updateLearn({ showDefinitionImmediately: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Session Settings -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Session Settings</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Shuffle Questions</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Randomize question order each session</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.shuffleQuestions}
                onchange={(e) => userSettings.updateLearn({ shuffleQuestions: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Progress Bar</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Display progress indicator during sessions</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.learn.showProgressBar}
                onchange={(e) => userSettings.updateLearn({ showProgressBar: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <!-- Auto-save Interval -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auto-save Interval: {userSettings.learn.autoSaveInterval} seconds
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                bind:value={userSettings.learn.autoSaveInterval}
                onchange={(e) => userSettings.updateLearn({ autoSaveInterval: parseInt(e.currentTarget.value) })}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>5s</span>
                <span>30s</span>
                <span>60s</span>
              </div>
            </div>

            <!-- Session Duration Target -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Duration Target: {userSettings.learn.sessionDurationTarget === 0 ? 'No limit' : `${userSettings.learn.sessionDurationTarget} minutes`}
              </label>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                bind:value={userSettings.learn.sessionDurationTarget}
                onchange={(e) => userSettings.updateLearn({ sessionDurationTarget: parseInt(e.currentTarget.value) })}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>No limit</span>
                <span>15 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>
          </div>

          <!-- Spaced Repetition -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Spaced Repetition</h3>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confidence Threshold for Mastery
              </label>
              <select
                bind:value={userSettings.learn.confidenceThreshold}
                onchange={(e) => userSettings.updateLearn({ confidenceThreshold: parseInt(e.currentTarget.value) as any })}
                class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="2">2 correct answers</option>
                <option value="3">3 correct answers</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Retry Attempts for Wrong Answers: {userSettings.learn.retryAttempts}
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="1"
                bind:value={userSettings.learn.retryAttempts}
                onchange={(e) => userSettings.updateLearn({ retryAttempts: parseInt(e.currentTarget.value) })}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
            </div>
          </div>
        </div>

      {:else if activeTab === 'grammar'}
        <!-- Grammar Settings -->
        <div class="space-y-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Grammar Settings</h2>
          </div>

          <!-- Answer Strictness -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Answer Strictness</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Require Accents</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Answers must include proper accent marks (á, é, í, ó, ú, ñ)</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.requireAccents}
                onchange={(e) => userSettings.updateGrammar({ requireAccents: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Case Sensitive</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Answers must match exact capitalization</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.caseSensitive}
                onchange={(e) => userSettings.updateGrammar({ caseSensitive: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Help Features -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Help Features</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Hints</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Display helpful hints during practice</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.showHints}
                onchange={(e) => userSettings.updateGrammar({ showHints: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Progressive Hints</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Show hints gradually (stem first, then ending)</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.showProgressiveHints}
                onchange={(e) => userSettings.updateGrammar({ showProgressiveHints: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hint Delay: {userSettings.grammar.hintDelay} seconds
              </label>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                bind:value={userSettings.grammar.hintDelay}
                onchange={(e) => userSettings.updateGrammar({ hintDelay: parseInt(e.currentTarget.value) })}
                class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Instant</span>
                <span>5s</span>
                <span>10s</span>
                <span>15s</span>
              </div>
            </div>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Highlight Common Mistakes</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Show commonly confused patterns</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.highlightCommonMistakes}
                onchange={(e) => userSettings.updateGrammar({ highlightCommonMistakes: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Display Options -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Display Options</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Conjugation Table</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Display full conjugation reference</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.showConjugationTable}
                onchange={(e) => userSettings.updateGrammar({ showConjugationTable: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Auto-play Pronunciation</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Automatically play audio for conjugations</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.autoPlayPronunciation}
                onchange={(e) => userSettings.updateGrammar({ autoPlayPronunciation: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>

          <!-- Practice Preferences -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Practice Preferences</h3>

            <label class="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Include Gender Variants</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Practice nosotras/vosotras in addition to nosotros/vosotros</div>
              </div>
              <input
                type="checkbox"
                bind:checked={userSettings.grammar.includeGenderVariants}
                onchange={(e) => userSettings.updateGrammar({ includeGenderVariants: e.currentTarget.checked })}
                class="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Focus Mode
              </label>
              <select
                bind:value={userSettings.grammar.focusMode}
                onchange={(e) => userSettings.updateGrammar({ focusMode: e.currentTarget.value as any })}
                class="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="all">All verbs</option>
                <option value="regular-only">Regular verbs only</option>
                <option value="irregular-only">Irregular verbs only</option>
              </select>
            </div>

            <!-- Default Tenses -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Default Tenses for Practice
              </label>
              <div class="grid grid-cols-2 gap-3">
                {#each availableTenses as tense}
                  <label class="flex items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer {userSettings.grammar.defaultTenses.includes(tense.id)
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700'}">
                    <input
                      type="checkbox"
                      checked={userSettings.grammar.defaultTenses.includes(tense.id)}
                      onchange={() => toggleTense(tense.id)}
                      class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span class="text-sm font-medium text-gray-900 dark:text-white">{tense.label}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Import Settings -->
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Settings</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
      Paste exported settings JSON to restore your configuration
    </p>
    <textarea
      bind:value={importText}
      placeholder='Paste settings JSON here...'
      class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono text-sm"
      rows="4"
    ></textarea>
    {#if importError}
      <p class="text-red-600 dark:text-red-400 text-sm mt-2">{importError}</p>
    {/if}
    <button
      onclick={handleImport}
      class="mt-3 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
    >
      <span class="font-medium text-white">Import Settings</span>
    </button>
  </div>
</div>

<!-- Export Modal -->
{#if showExportModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-purple-500 max-w-2xl w-full">
      <div class="space-y-4">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Export Settings</h2>
        <p class="text-gray-600 dark:text-gray-400">
          Copy this JSON to back up your settings or transfer them to another device
        </p>
        <textarea
          readonly
          value={exportedSettings}
          class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
          rows="12"
        ></textarea>
        <div class="flex gap-3 justify-end">
          <button
            onclick={() => showExportModal = false}
            class="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <span class="font-medium text-gray-700 dark:text-gray-300">Close</span>
          </button>
          <button
            onclick={copyToClipboard}
            class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 transition-all"
          >
            <span class="font-medium text-white">Copy to Clipboard</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Reset Confirmation Modal -->
{#if showResetModal}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-red-500 max-w-md w-full">
      <div class="space-y-6">
        <div class="text-center">
          <div class="text-5xl mb-4">⚠️</div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Reset to Defaults?</h2>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            This will reset all your settings to their default values. This action cannot be undone.
          </p>
        </div>
        <div class="flex gap-3">
          <button
            onclick={() => showResetModal = false}
            class="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <span class="font-medium text-gray-700 dark:text-gray-300">Cancel</span>
          </button>
          <button
            onclick={handleReset}
            class="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 transition-all"
          >
            <span class="font-medium text-white">Reset Settings</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
