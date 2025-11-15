<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../../utils/authStore.svelte';
  import { goto } from '$app/navigation';
  import type {
    AnalyticsOverview,
    VelocityData,
    WeakArea,
    StudyPattern,
    POSPerformance,
    CEFREstimate,
    ComparisonData,
    SessionTrend
  } from '../../types/analytics';
  import MetricCard from '../../components/analytics/MetricCard.svelte';
  import VelocityLineChart from '../../components/analytics/VelocityLineChart.svelte';
  import WeakAreasBarChart from '../../components/analytics/WeakAreasBarChart.svelte';
  import POSPieChart from '../../components/analytics/POSPieChart.svelte';
  import CEFRLevelBadge from '../../components/analytics/CEFRLevelBadge.svelte';
  import SessionTimelineChart from '../../components/analytics/SessionTimelineChart.svelte';
  import StudyTimeHeatmap from '../../components/analytics/StudyTimeHeatmap.svelte';
  import { formatTime } from '../../utils/chartConfig';
  import axios from 'axios';
    import { getAPIUrlBasedOffEnviornment } from '../../utils/API';

  let activeTab = $state<'overview' | 'performance' | 'patterns' | 'comparison'>('overview');
  let loading = $state(true);
  let error = $state<string | null>(null);
  let dateRange = $state(30); // days

  // Analytics data
  let overview = $state<AnalyticsOverview | null>(null);
  let velocity = $state<VelocityData[]>([]);
  let weakAreas = $state<WeakArea[]>([]);
  let studyPatterns = $state<StudyPattern[]>([]);
  let posPerformance = $state<POSPerformance[]>([]);
  let cefrEstimate = $state<CEFREstimate | null>(null);
  let comparison = $state<ComparisonData | null>(null);
  let sessionTrends = $state<SessionTrend[]>([]);

  const API_BASE = getAPIUrlBasedOffEnviornment();

  onMount(() => {
    if (!authStore.user) {
      goto('/auth');
      return;
    }
    fetchAnalytics();
  });

  async function fetchAnalytics() {
    if (!authStore.user?.id) return;

    loading = true;
    error = null;

    try {
      const accountId = authStore.user.id;

      const [
        overviewRes,
        velocityRes,
        weakAreasRes,
        patternsRes,
        posRes,
        cefrRes,
        comparisonRes,
        trendsRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/api/analytics/overview/${accountId}`),
        axios.get(`${API_BASE}/api/analytics/velocity/${accountId}?days=${dateRange}`),
        axios.get(`${API_BASE}/api/analytics/weak-areas/${accountId}?limit=10`),
        axios.get(`${API_BASE}/api/analytics/study-patterns/${accountId}`),
        axios.get(`${API_BASE}/api/analytics/pos-performance/${accountId}`),
        axios.get(`${API_BASE}/api/analytics/cefr-estimate/${accountId}`),
        axios.get(`${API_BASE}/api/analytics/comparison/${accountId}`),
        axios.get(`${API_BASE}/api/analytics/session-trends/${accountId}?limit=30`)
      ]);

      overview = overviewRes.data;
      velocity = velocityRes.data;
      weakAreas = weakAreasRes.data;
      studyPatterns = patternsRes.data;
      posPerformance = posRes.data;
      cefrEstimate = cefrRes.data;
      comparison = comparisonRes.data;
      sessionTrends = trendsRes.data;

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      error = err.response?.data?.error || 'Failed to load analytics data';
    } finally {
      loading = false;
    }
  }

  function handleDateRangeChange(days: number) {
    dateRange = days;
    fetchAnalytics();
  }
</script>

<div class="space-y-6 pb-12">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
      <p class="text-gray-400">Deep insights into your Spanish learning journey</p>
    </div>

    <div class="flex gap-2">
      <button
        class="px-4 py-2 rounded-lg transition {dateRange === 7 ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
        onclick={() => handleDateRangeChange(7)}
      >
        7 Days
      </button>
      <button
        class="px-4 py-2 rounded-lg transition {dateRange === 30 ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
        onclick={() => handleDateRangeChange(30)}
      >
        30 Days
      </button>
      <button
        class="px-4 py-2 rounded-lg transition {dateRange === 90 ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
        onclick={() => handleDateRangeChange(90)}
      >
        90 Days
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p class="text-gray-400">Loading analytics...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
      <p class="text-red-400 font-semibold mb-2">Error Loading Analytics</p>
      <p class="text-gray-400 text-sm">{error}</p>
      <button
        class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
        onclick={() => fetchAnalytics()}
      >
        Retry
      </button>
    </div>
  {:else if overview}
    <!-- Tabs -->
    <div class="flex gap-2 border-b border-gray-700/50 pb-2">
      <button
        class="tab-button {activeTab === 'overview' ? 'active' : ''}"
        onclick={() => activeTab = 'overview'}
      >
        Overview
      </button>
      <button
        class="tab-button {activeTab === 'performance' ? 'active' : ''}"
        onclick={() => activeTab = 'performance'}
      >
        Performance
      </button>
      <button
        class="tab-button {activeTab === 'patterns' ? 'active' : ''}"
        onclick={() => activeTab = 'patterns'}
      >
        Patterns
      </button>
      <button
        class="tab-button {activeTab === 'comparison' ? 'active' : ''}"
        onclick={() => activeTab = 'comparison'}
      >
        Comparison
      </button>
    </div>

    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
      <div class="space-y-6">
        <!-- Key Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Words Learned This Week"
            value={overview.wordsLearnedThisWeek}
            icon="📚"
            color="purple"
            subtitle="Keep it up!"
          />
          <MetricCard
            title="Average Accuracy"
            value="{overview.avgAccuracy.toFixed(1)}%"
            icon="🎯"
            color="cyan"
            subtitle="Across all sessions"
          />
          <MetricCard
            title="Total Sessions"
            value={overview.totalSessions}
            icon="💪"
            color="green"
            subtitle="Study sessions completed"
          />
          <MetricCard
            title="Study Time"
            value={formatTime(overview.totalStudyTime)}
            icon="⏱️"
            color="amber"
            subtitle="Total time invested"
          />
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2">
            <VelocityLineChart data={velocity} />
          </div>
          <div>
            {#if cefrEstimate}
              <CEFRLevelBadge data={cefrEstimate} />
            {/if}
          </div>
        </div>

        <!-- Session Timeline -->
        <SessionTimelineChart data={sessionTrends} />
      </div>
    {/if}

    <!-- Performance Tab -->
    {#if activeTab === 'performance'}
      <div class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeakAreasBarChart data={weakAreas} />
          <POSPieChart data={posPerformance} />
        </div>

        <!-- Performance Summary -->
        {#if posPerformance.length > 0}
          <div class="bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Performance Summary</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              {#each posPerformance as pos}
                <div class="bg-gray-800/50 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-400 capitalize">{pos.pos}s</span>
                    <span class="text-lg font-bold text-white">{pos.avgAccuracy.toFixed(1)}%</span>
                  </div>
                  <div class="flex justify-between text-xs text-gray-500">
                    <span>✓ {pos.correctCount}</span>
                    <span>✗ {pos.incorrectCount}</span>
                    <span>Total: {pos.totalTerms}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Patterns Tab -->
    {#if activeTab === 'patterns'}
      <div class="space-y-6">
        <StudyTimeHeatmap data={studyPatterns} />

        {#if studyPatterns.length > 0}
          {@const bestPattern = studyPatterns.reduce((max, p) => p.avgAccuracy > max.avgAccuracy ? p : max)}
          {@const totalSessions = studyPatterns.reduce((sum, p) => sum + p.sessionCount, 0)}
          {@const mostActive = studyPatterns.reduce((max, p) => p.sessionCount > max.sessionCount ? p : max)}

          <div class="bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Study Insights</h3>
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div>
                  <p class="text-sm text-gray-400">Your Peak Performance Time</p>
                  <p class="text-xl font-bold text-purple-400">
                    {bestPattern.hour === 0 ? '12 AM' : bestPattern.hour < 12 ? `${bestPattern.hour} AM` : bestPattern.hour === 12 ? '12 PM' : `${bestPattern.hour - 12} PM`}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-400">Accuracy</p>
                  <p class="text-xl font-bold text-white">{bestPattern.avgAccuracy.toFixed(1)}%</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-gray-800/50 rounded-lg">
                  <p class="text-xs text-gray-400 mb-1">Most Active Hour</p>
                  <p class="text-lg font-semibold text-white">
                    {mostActive.hour === 0 ? '12 AM' : mostActive.hour < 12 ? `${mostActive.hour} AM` : mostActive.hour === 12 ? '12 PM' : `${mostActive.hour - 12} PM`}
                  </p>
                  <p class="text-xs text-gray-500">{mostActive.sessionCount} sessions</p>
                </div>
                <div class="p-3 bg-gray-800/50 rounded-lg">
                  <p class="text-xs text-gray-400 mb-1">Total Sessions</p>
                  <p class="text-lg font-semibold text-white">{totalSessions}</p>
                  <p class="text-xs text-gray-500">Across all times</p>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Comparison Tab -->
    {#if activeTab === 'comparison' && comparison}
      <div class="space-y-6">
        <!-- Percentile Card -->
        <div class="bg-gradient-to-br from-purple-500/20 to-pink-500/10 backdrop-blur-md border border-purple-500/30 rounded-xl p-8 text-center">
          <h3 class="text-2xl font-bold text-white mb-2">You're in the Top {100 - comparison.userPercentile}%</h3>
          <p class="text-gray-400 mb-6">Based on overall performance metrics</p>
          <div class="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
            <div
              class="h-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-1000"
              style="width: {comparison.userPercentile}%"
            ></div>
          </div>
          <p class="text-sm text-gray-400 mt-2">{comparison.userPercentile}th percentile</p>
        </div>

        <!-- Comparison Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Your Stats -->
          <div class="bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span class="text-purple-400">👤</span> Your Stats
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Avg Accuracy</span>
                <span class="text-white font-semibold">{comparison.userStats.avgAccuracy.toFixed(1)}%</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Sessions</span>
                <span class="text-white font-semibold">{comparison.userStats.totalSessions}</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Study Time</span>
                <span class="text-white font-semibold">{formatTime(comparison.userStats.totalStudyTime)}</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Vocabulary</span>
                <span class="text-white font-semibold">{comparison.userStats.vocabSize} words</span>
              </div>
            </div>
          </div>

          <!-- Average Stats -->
          <div class="bg-gray-900/50 backdrop-blur-md border border-gray-700/50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span class="text-cyan-400">👥</span> Average Learner
            </h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Avg Accuracy</span>
                <span class="text-white font-semibold">{comparison.avgStats.avgAccuracy.toFixed(1)}%</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Sessions</span>
                <span class="text-white font-semibold">{comparison.avgStats.totalSessions}</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Study Time</span>
                <span class="text-white font-semibold">{formatTime(comparison.avgStats.totalStudyTime)}</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                <span class="text-gray-400">Vocabulary</span>
                <span class="text-white font-semibold">{comparison.avgStats.vocabSize} words</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="text-center py-20">
      <p class="text-gray-400 text-lg mb-4">No analytics data available yet</p>
      <p class="text-gray-500 text-sm">Complete some learning sessions to see your analytics!</p>
    </div>
  {/if}
</div>

<style>
  .tab-button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    transition: all 0.2s ease;
    color: #9ca3af;
    background: transparent;
  }

  .tab-button:hover {
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
  }

  .tab-button.active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1));
    color: #a78bfa;
    border-bottom: 2px solid #8b5cf6;
  }
</style>
