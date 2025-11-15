<script lang="ts">
  import type { StudyPattern } from '../../types/analytics';
  import { getAccuracyColor } from '../../utils/chartConfig';

  interface Props {
    data: StudyPattern[];
    title?: string;
  }

  let { data, title = 'Best Study Times' }: Props = $props();

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const patternMap = $derived(
    data.reduce((acc, pattern) => {
      acc[pattern.hour] = pattern;
      return acc;
    }, {} as Record<number, StudyPattern>)
  );

  function formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  }

  function getIntensity(accuracy: number): number {
    return Math.max(0.2, accuracy / 100);
  }

  function getBestTime(): string {
    if (data.length === 0) return 'No data yet';
    const best = data.reduce((max, p) => p.avgAccuracy > max.avgAccuracy ? p : max);
    return formatHour(best.hour);
  }

  const bestTime = $derived(getBestTime());
  const avgAccuracy = $derived(
    data.length > 0
      ? (data.reduce((sum, p) => sum + p.avgAccuracy, 0) / data.length).toFixed(1)
      : '0'
  );
</script>

<div class="heatmap-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-4">{title}</h3>

  {#if data.length > 0}
    <div class="mb-6 grid grid-cols-2 gap-4">
      <div class="stat-card bg-gray-800/50 rounded-lg p-3">
        <div class="text-xs text-gray-400 mb-1">Best Time</div>
        <div class="text-lg font-semibold text-purple-400">{bestTime}</div>
      </div>
      <div class="stat-card bg-gray-800/50 rounded-lg p-3">
        <div class="text-xs text-gray-400 mb-1">Avg Accuracy</div>
        <div class="text-lg font-semibold text-cyan-400">{avgAccuracy}%</div>
      </div>
    </div>

    <div class="heatmap-grid">
      {#each hours as hour}
        {@const pattern = patternMap[hour]}
        {@const hasData = pattern && pattern.sessionCount > 0}
        <div
          class="heatmap-cell"
          style="
            background-color: {hasData
              ? `${getAccuracyColor(pattern.avgAccuracy)}${Math.round(getIntensity(pattern.avgAccuracy) * 255).toString(16).padStart(2, '0')}`
              : 'rgba(107, 114, 128, 0.1)'
            };
          "
          title={hasData
            ? `${formatHour(hour)}: ${pattern.avgAccuracy.toFixed(1)}% accuracy (${pattern.sessionCount} sessions)`
            : `${formatHour(hour)}: No data`
          }
        >
          <div class="hour-label">{hour}</div>
          {#if hasData}
            <div class="accuracy-label">{pattern.avgAccuracy.toFixed(0)}%</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="legend mt-6 flex items-center justify-between text-xs text-gray-400">
      <span>Lower Performance</span>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" style="background-color: #ef444450"></div>
        <div class="w-4 h-4 rounded" style="background-color: #f59e0b80"></div>
        <div class="w-4 h-4 rounded" style="background-color: #8b5cf6b0"></div>
        <div class="w-4 h-4 rounded" style="background-color: #10b981ff"></div>
      </div>
      <span>Higher Performance</span>
    </div>
  {:else}
    <div class="text-center py-12 text-gray-400">
      <p>Complete more sessions to see your study time patterns</p>
    </div>
  {/if}
</div>

<style>
  .heatmap-container {
    transition: all 0.3s ease;
  }

  .heatmap-container:hover {
    border-color: rgba(139, 92, 246, 0.5);
  }

  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  .heatmap-cell {
    aspect-ratio: 1;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: help;
    border: 1px solid rgba(107, 114, 128, 0.2);
  }

  .heatmap-cell:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .hour-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .accuracy-label {
    font-size: 0.625rem;
    color: white;
    margin-top: 0.125rem;
    opacity: 0.9;
  }
</style>
