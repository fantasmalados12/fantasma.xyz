<script lang="ts">
  import type { CEFREstimate } from '../../types/analytics';
  import { getCEFRColor } from '../../utils/chartConfig';

  interface Props {
    data: CEFREstimate;
  }

  let { data }: Props = $props();

  const levelDescriptions: Record<string, string> = {
    'A1': 'Beginner',
    'A2': 'Elementary',
    'B1': 'Intermediate',
    'B2': 'Upper Intermediate',
    'C1': 'Advanced',
    'C2': 'Mastery',
  };

  const levelColor = $derived(getCEFRColor(data.level));
  const progressPercent = $derived(
    data.nextLevel
      ? Math.min((data.confidence * 100), 100)
      : 100
  );
</script>

<div class="cefr-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-6">Your CEFR Level</h3>

  <div class="flex items-center justify-center mb-6">
    <div class="level-badge relative">
      <div
        class="w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all"
        style="border-color: {levelColor}; background: linear-gradient(135deg, {levelColor}20, {levelColor}10);"
      >
        <div class="text-center">
          <div class="text-4xl font-bold" style="color: {levelColor}">
            {data.level}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {levelDescriptions[data.level] || 'Unknown'}
          </div>
        </div>
      </div>

      <!-- Confidence ring -->
      <svg class="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r="62"
          fill="none"
          stroke="rgba(107, 114, 128, 0.2)"
          stroke-width="4"
        />
        <circle
          cx="50%"
          cy="50%"
          r="62"
          fill="none"
          stroke="{levelColor}"
          stroke-width="4"
          stroke-dasharray="{2 * Math.PI * 62}"
          stroke-dashoffset="{2 * Math.PI * 62 * (1 - data.confidence)}"
          stroke-linecap="round"
          class="transition-all duration-1000"
        />
      </svg>
    </div>
  </div>

  <div class="space-y-4">
    <div class="stat-row">
      <span class="text-sm text-gray-400">Vocabulary Size</span>
      <span class="text-white font-semibold">{data.vocabSize} words</span>
    </div>

    <div class="stat-row">
      <span class="text-sm text-gray-400">Confidence</span>
      <span class="text-white font-semibold">{(data.confidence * 100).toFixed(0)}%</span>
    </div>

    {#if data.nextLevel}
      <div class="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-400">Next: {data.nextLevel}</span>
          <span class="text-sm font-semibold" style="color: {getCEFRColor(data.nextLevel)}">
            {data.wordsToNextLevel} words to go
          </span>
        </div>
        <div class="w-full bg-gray-700/50 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            style="width: {progressPercent}%; background-color: {levelColor};"
          ></div>
        </div>
      </div>
    {:else}
      <div class="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
        <p class="text-sm text-center text-white font-semibold">
          🎉 You've reached the highest level!
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .cefr-container {
    transition: all 0.3s ease;
  }

  .cefr-container:hover {
    border-color: rgba(139, 92, 246, 0.5);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(107, 114, 128, 0.2);
  }

  .stat-row:last-child {
    border-bottom: none;
  }

  .level-badge {
    position: relative;
    width: 132px;
    height: 132px;
  }
</style>
