import type { ChartOptions, TooltipItem } from 'chart.js';
import 'chartjs-adapter-date-fns';

/**
 * Default chart colors matching the app's theme
 */
export const chartColors = {
  primary: '#8b5cf6',      // Purple
  secondary: '#06b6d4',    // Cyan
  success: '#10b981',      // Green
  warning: '#f59e0b',      // Amber
  danger: '#ef4444',       // Red
  info: '#3b82f6',         // Blue
  gray: '#6b7280',         // Gray
  verbs: '#8b5cf6',        // Purple for verbs
  nouns: '#06b6d4',        // Cyan for nouns
  adjectives: '#10b981',   // Green for adjectives
};

/**
 * Chart.js gradient utility
 */
export function createGradient(
  ctx: CanvasRenderingContext2D,
  color1: string,
  color2: string,
  vertical: boolean = true
): CanvasGradient {
  const gradient = vertical
    ? ctx.createLinearGradient(0, 0, 0, 400)
    : ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

/**
 * Default chart options with glassmorphism style
 */
export const defaultChartOptions: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#e5e7eb',
        font: {
          family: 'Inter, system-ui, sans-serif',
          size: 12,
        },
        padding: 15,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleColor: '#f9fafb',
      bodyColor: '#e5e7eb',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: {
        size: 14,
        weight: 'bold',
      },
      bodyFont: {
        size: 13,
      },
      displayColors: true,
      callbacks: {
        label: function(context: TooltipItem<any>) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(0);
          }
          return label;
        }
      }
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(107, 114, 128, 0.1)',
        display: true,
      },
      ticks: {
        color: '#9ca3af',
        font: {
          size: 11,
        },
      },
      border: {
        color: 'rgba(107, 114, 128, 0.2)',
      },
    },
    y: {
      grid: {
        color: 'rgba(107, 114, 128, 0.1)',
        display: true,
      },
      ticks: {
        color: '#9ca3af',
        font: {
          size: 11,
        },
      },
      border: {
        color: 'rgba(107, 114, 128, 0.2)',
      },
      beginAtZero: true,
    },
  },
};

/**
 * Line chart specific options
 */
export const lineChartOptions: ChartOptions<'line'> = {
  ...defaultChartOptions,
  elements: {
    line: {
      tension: 0.4, // Smooth curves
      borderWidth: 2,
    },
    point: {
      radius: 4,
      hoverRadius: 6,
      borderWidth: 2,
      backgroundColor: '#1f2937',
    },
  },
};

/**
 * Bar chart specific options
 */
export const barChartOptions: ChartOptions<'bar'> = {
  ...defaultChartOptions,
  elements: {
    bar: {
      borderRadius: 6,
      borderWidth: 0,
    },
  },
};

/**
 * Pie/Doughnut chart specific options
 */
export const pieChartOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right',
      labels: {
        color: '#e5e7eb',
        font: {
          family: 'Inter, system-ui, sans-serif',
          size: 12,
        },
        padding: 15,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleColor: '#f9fafb',
      bodyColor: '#e5e7eb',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      callbacks: {
        label: function(context: TooltipItem<any>) {
          const label = context.label || '';
          const value = context.parsed || 0;
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${label}: ${value} (${percentage}%)`;
        }
      }
    },
  },
};

/**
 * Format number for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Format time in seconds to readable string
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format date for chart labels
 */
export function formatDate(dateStr: string, short: boolean = false): string {
  const date = new Date(dateStr);
  if (short) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Get color for accuracy percentage
 */
export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 90) return chartColors.success;
  if (accuracy >= 75) return chartColors.primary;
  if (accuracy >= 60) return chartColors.warning;
  return chartColors.danger;
}

/**
 * Get CEFR level color
 */
export function getCEFRColor(level: string): string {
  const colors: Record<string, string> = {
    'A1': '#ef4444',
    'A2': '#f59e0b',
    'B1': '#10b981',
    'B2': '#06b6d4',
    'C1': '#8b5cf6',
    'C2': '#ec4899',
  };
  return colors[level] || chartColors.gray;
}
