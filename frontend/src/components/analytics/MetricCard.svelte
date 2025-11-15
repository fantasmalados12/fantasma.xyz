<script lang="ts">
  interface Props {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: 'purple' | 'cyan' | 'green' | 'amber' | 'red' | 'blue';
  }

  let {
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    color = 'purple'
  }: Props = $props();

  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  };

  const iconColorClasses = {
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  const trendColorClasses = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };
</script>

<div class="metric-card bg-gradient-to-br {colorClasses[color]} backdrop-blur-md border rounded-xl p-6 shadow-lg">
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <p class="text-sm font-medium text-gray-400 mb-1">{title}</p>
      <div class="flex items-baseline gap-2">
        <h3 class="text-3xl font-bold text-white">{value}</h3>
        {#if trend && trendValue}
          <span class="text-sm font-medium {trendColorClasses[trend]} flex items-center gap-1">
            <span>{trendIcons[trend]}</span>
            <span>{trendValue}</span>
          </span>
        {/if}
      </div>
      {#if subtitle}
        <p class="text-xs text-gray-400 mt-2">{subtitle}</p>
      {/if}
    </div>
    {#if icon}
      <div class="text-4xl {iconColorClasses[color]} opacity-60">
        {icon}
      </div>
    {/if}
  </div>
</div>

<style>
  .metric-card {
    transition: all 0.3s ease;
  }

  .metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  }
</style>
