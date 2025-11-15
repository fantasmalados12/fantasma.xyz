<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { POSPerformance } from '../../types/analytics';
  import { pieChartOptions, chartColors } from '../../utils/chartConfig';

  interface Props {
    data: POSPerformance[];
    title?: string;
  }

  let { data, title = 'Performance by Part of Speech' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  const posColors: Record<string, string> = {
    verb: chartColors.verbs,
    noun: chartColors.nouns,
    adjective: chartColors.adjectives,
    unknown: chartColors.gray,
  };

  onMount(() => {
    createChart();
    return () => {
      if (chart) {
        chart.destroy();
      }
    };
  });

  $effect(() => {
    if (data && chart) {
      updateChart();
    }
  });

  function createChart() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.pos.charAt(0).toUpperCase() + d.pos.slice(1) + 's'),
        datasets: [{
          label: 'Terms',
          data: data.map(d => d.totalTerms),
          backgroundColor: data.map(d => posColors[d.pos] || chartColors.gray),
          borderWidth: 0,
        }]
      },
      options: {
        ...pieChartOptions,
        plugins: {
          ...pieChartOptions.plugins,
          tooltip: {
            ...pieChartOptions.plugins?.tooltip,
            callbacks: {
              label: function(context) {
                const item = data[context.dataIndex];
                const total = data.reduce((sum, d) => sum + d.totalTerms, 0);
                const percentage = ((item.totalTerms / total) * 100).toFixed(1);
                return [
                  `${context.label}: ${item.totalTerms} (${percentage}%)`,
                  `Accuracy: ${item.avgAccuracy.toFixed(1)}%`,
                  `Correct: ${item.correctCount}`,
                  `Incorrect: ${item.incorrectCount}`
                ];
              }
            }
          }
        }
      }
    });
  }

  function updateChart() {
    if (!chart) return;

    chart.data.labels = data.map(d => d.pos.charAt(0).toUpperCase() + d.pos.slice(1) + 's');
    chart.data.datasets[0].data = data.map(d => d.totalTerms);
    chart.data.datasets[0].backgroundColor = data.map(d => posColors[d.pos] || chartColors.gray);
    chart.update();
  }
</script>

<div class="chart-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-4">{title}</h3>
  <div class="chart-wrapper relative h-[350px]">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .chart-container {
    transition: all 0.3s ease;
  }

  .chart-container:hover {
    border-color: rgba(139, 92, 246, 0.5);
  }
</style>
