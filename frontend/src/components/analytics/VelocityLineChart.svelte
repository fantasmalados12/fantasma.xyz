<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { VelocityData } from '../../types/analytics';
  import { lineChartOptions, chartColors, formatDate } from '../../utils/chartConfig';

  interface Props {
    data: VelocityData[];
    title?: string;
  }

  let { data, title = 'Learning Velocity' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

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
      type: 'line',
      data: {
        labels: data.map(d => formatDate(d.date, true)),
        datasets: [{
          label: 'Words Learned',
          data: data.map(d => d.wordsLearned),
          borderColor: chartColors.primary,
          backgroundColor: chartColors.primary + '20',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        ...lineChartOptions,
        plugins: {
          ...lineChartOptions.plugins,
          title: {
            display: false,
          },
          tooltip: {
            ...lineChartOptions.plugins?.tooltip,
            callbacks: {
              label: function(context) {
                return `Words: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          ...lineChartOptions.scales,
          y: {
            ...lineChartOptions.scales?.y,
            title: {
              display: true,
              text: 'Words Learned',
              color: '#9ca3af',
            }
          },
          x: {
            ...lineChartOptions.scales?.x,
            title: {
              display: true,
              text: 'Date',
              color: '#9ca3af',
            }
          }
        }
      }
    });
  }

  function updateChart() {
    if (!chart) return;

    chart.data.labels = data.map(d => formatDate(d.date, true));
    chart.data.datasets[0].data = data.map(d => d.wordsLearned);
    chart.update();
  }
</script>

<div class="chart-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-4">{title}</h3>
  <div class="chart-wrapper relative h-[300px]">
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
