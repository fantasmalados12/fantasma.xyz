<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { SessionTrend } from '../../types/analytics';
  import { lineChartOptions, chartColors, formatDate } from '../../utils/chartConfig';

  interface Props {
    data: SessionTrend[];
    title?: string;
  }

  let { data, title = 'Session History & Trends' }: Props = $props();

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
        datasets: [
          {
            label: 'Accuracy %',
            data: data.map(d => d.accuracy),
            borderColor: chartColors.primary,
            backgroundColor: chartColors.primary + '20',
            yAxisID: 'y',
            tension: 0.4,
          },
          {
            label: 'Duration (min)',
            data: data.map(d => Math.round(d.duration / 60)),
            borderColor: chartColors.secondary,
            backgroundColor: chartColors.secondary + '20',
            yAxisID: 'y1',
            tension: 0.4,
          }
        ]
      },
      options: {
        ...lineChartOptions,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          ...lineChartOptions.plugins,
          tooltip: {
            ...lineChartOptions.plugins?.tooltip,
            callbacks: {
              label: function(context) {
                const item = data[context.dataIndex];
                if (context.datasetIndex === 0) {
                  return `Accuracy: ${item.accuracy.toFixed(1)}%`;
                } else {
                  return `Duration: ${Math.round(item.duration / 60)}min`;
                }
              },
              afterLabel: function(context) {
                if (context.datasetIndex === 0) {
                  const item = data[context.dataIndex];
                  return [
                    `Questions: ${item.questionsAnswered}`,
                    `Mode: ${item.mode}`
                  ];
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            ...lineChartOptions.scales?.x,
            title: {
              display: true,
              text: 'Date',
              color: '#9ca3af',
            }
          },
          y: {
            ...lineChartOptions.scales?.y,
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Accuracy (%)',
              color: chartColors.primary,
            },
            ticks: {
              color: chartColors.primary,
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Duration (min)',
              color: chartColors.secondary,
            },
            ticks: {
              color: chartColors.secondary,
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        }
      }
    });
  }

  function updateChart() {
    if (!chart) return;

    chart.data.labels = data.map(d => formatDate(d.date, true));
    chart.data.datasets[0].data = data.map(d => d.accuracy);
    chart.data.datasets[1].data = data.map(d => Math.round(d.duration / 60));
    chart.update();
  }
</script>

<div class="chart-container bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
  <h3 class="text-lg font-semibold text-white mb-4">{title}</h3>
  <div class="chart-wrapper relative h-[300px]">
    <canvas bind:this={canvas}></canvas>
  </div>
  <p class="text-xs text-gray-400 mt-4">Track your accuracy and study duration over time</p>
</div>

<style>
  .chart-container {
    transition: all 0.3s ease;
  }

  .chart-container:hover {
    border-color: rgba(139, 92, 246, 0.5);
  }
</style>
