<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { WeakArea } from '../../types/analytics';
  import { barChartOptions, getAccuracyColor } from '../../utils/chartConfig';

  interface Props {
    data: WeakArea[];
    title?: string;
  }

  let { data, title = 'Weak Areas' }: Props = $props();

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
      type: 'bar',
      data: {
        labels: data.map(d => d.term),
        datasets: [{
          label: 'Accuracy %',
          data: data.map(d => d.accuracy),
          backgroundColor: data.map(d => getAccuracyColor(d.accuracy)),
          borderRadius: 6,
        }]
      },
      options: {
        ...barChartOptions,
        indexAxis: 'y', // Horizontal bars
        plugins: {
          ...barChartOptions.plugins,
          legend: {
            display: false,
          },
          tooltip: {
            ...barChartOptions.plugins?.tooltip,
            callbacks: {
              label: function(context) {
                const item = data[context.dataIndex];
                return [
                  `Accuracy: ${item.accuracy.toFixed(1)}%`,
                  `Attempts: ${item.attempts}`,
                  `Definition: ${item.definition.substring(0, 40)}...`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            ...barChartOptions.scales?.x,
            title: {
              display: true,
              text: 'Accuracy (%)',
              color: '#9ca3af',
            },
            max: 100,
          },
          y: {
            ...barChartOptions.scales?.y,
            grid: {
              display: false,
            }
          }
        }
      }
    });
  }

  function updateChart() {
    if (!chart) return;

    chart.data.labels = data.map(d => d.term);
    chart.data.datasets[0].data = data.map(d => d.accuracy);
    chart.data.datasets[0].backgroundColor = data.map(d => getAccuracyColor(d.accuracy));
    chart.update();
  }
</script>

<div class="chart-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-4">{title}</h3>
  <div class="chart-wrapper relative h-[400px]">
    <canvas bind:this={canvas}></canvas>
  </div>
  <p class="text-xs text-gray-400 mt-4">Terms you struggle with the most</p>
</div>

<style>
  .chart-container {
    transition: all 0.3s ease;
  }

  .chart-container:hover {
    border-color: rgba(139, 92, 246, 0.5);
  }
</style>
