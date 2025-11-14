<script lang="ts">
  import { authStore } from '../../utils/authStore.svelte';
  import { featureFlagsStore } from '../../utils/featureFlags.svelte';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';

  const DEVELOPER_EMAIL = 'brendansides12@gmail.com';
  const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://fantasma.xyz/api';

  // Redirect if not developer
  $effect(() => {
    if (authStore.user && authStore.user.email !== DEVELOPER_EMAIL) {
      goto('/');
    }
  });

  interface LogEntry {
    timestamp: string;
    type: 'errors' | 'service' | 'actions' | 'connections';
    message: string;
  }

  interface ServiceStatus {
    server: {
      status: string;
      uptime: number;
      memory: any;
      pid: number;
      nodeVersion: string;
    };
    postgresql: {
      status: string;
      totalConnections: number;
      idleConnections: number;
      waitingConnections: number;
    };
    redis: {
      status: string;
      connected: boolean;
    };
    supabase: {
      status: string;
      url: string;
    };
  }

  interface FeatureFlags {
    scraping: boolean;
    learning: boolean;
    image_upload: boolean;
    csv_import: boolean;
    registration: boolean;
    api_access: boolean;
  }

  interface BlockedIP {
    ip: string;
    reason: string;
    blockedAt: string;
  }

  interface RateLimitStat {
    ip: string;
    requests: number;
    expiresIn: number;
  }

  // State
  let logs = $state<LogEntry[]>([]);
  let serviceStatus = $state<ServiceStatus | null>(null);
  let databaseStats = $state<any>(null);
  let selectedLogType = $state<string>('all');
  let autoRefresh = $state(true);
  let refreshInterval: number | null = null;
  let loading = $state(false);
  let showShutdownConfirm = $state(false);
  let shutdownService = $state<string>('');

  // Feature flags state
  let features = $state<FeatureFlags | null>(null);

  // IP security state
  let blockedIPs = $state<BlockedIP[]>([]);
  let rateLimitStats = $state<RateLimitStat[]>([]);
  let newBlockIP = $state<string>('');
  let newBlockReason = $state<string>('');
  let showBlockIPModal = $state(false);

  // Active tab
  let activeTab = $state<'overview' | 'features' | 'security' | 'logs'>('overview');

  // Auto-refresh interval (5 seconds)
  const REFRESH_INTERVAL = 5000;

  onMount(() => {
    fetchLogs();
    fetchServiceStatus();
    fetchDatabaseStats();
    fetchFeatures();
    fetchBlockedIPs();
    fetchRateLimitStats();

    if (autoRefresh) {
      startAutoRefresh();
    }
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = window.setInterval(() => {
      fetchLogs();
      fetchServiceStatus();
    }, REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  $effect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  async function fetchLogs() {
    try {
      const token = authStore.getAccessToken();
      const url = selectedLogType === 'all'
        ? `${apiUrl}/developer/logs?limit=100`
        : `${apiUrl}/developer/logs?type=${selectedLogType}&limit=100`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        logs = data.logs;
      } else {
        console.error('Failed to fetch logs:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }

  async function fetchServiceStatus() {
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        serviceStatus = data.status;
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
    }
  }

  async function fetchDatabaseStats() {
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/database/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        databaseStats = data.stats;
      }
    } catch (error) {
      console.error('Error fetching database stats:', error);
    }
  }

  async function fetchFeatures() {
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/features`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        features = data.features;
      }
    } catch (error) {
      console.error('Error fetching features:', error);
    }
  }

  async function toggleFeature(featureName: string, enabled: boolean) {
    loading = true;
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/features/${featureName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        await fetchFeatures();
        // Refresh the global feature flags store so UI updates everywhere
        await featureFlagsStore.refresh();
        alert(`Feature '${featureName}' ${enabled ? 'enabled' : 'disabled'} successfully`);
      } else {
        alert('Failed to update feature');
      }
    } catch (error) {
      console.error('Error toggling feature:', error);
      alert('Error updating feature');
    } finally {
      loading = false;
    }
  }

  async function fetchBlockedIPs() {
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/security/blocked-ips`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        blockedIPs = data.blockedIPs;
      }
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
    }
  }

  async function fetchRateLimitStats() {
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/security/rate-limit-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        rateLimitStats = data.stats;
      }
    } catch (error) {
      console.error('Error fetching rate limit stats:', error);
    }
  }

  async function blockIP() {
    if (!newBlockIP) {
      alert('Please enter an IP address');
      return;
    }

    loading = true;
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/security/block-ip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: newBlockIP,
          reason: newBlockReason || 'Manually blocked'
        })
      });

      if (response.ok) {
        newBlockIP = '';
        newBlockReason = '';
        showBlockIPModal = false;
        await fetchBlockedIPs();
        alert('IP blocked successfully');
      } else {
        alert('Failed to block IP');
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
      alert('Error blocking IP');
    } finally {
      loading = false;
    }
  }

  async function unblockIP(ip: string) {
    if (!confirm(`Are you sure you want to unblock ${ip}?`)) return;

    loading = true;
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/security/unblock-ip/${ip}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchBlockedIPs();
        alert('IP unblocked successfully');
      } else {
        alert('Failed to unblock IP');
      }
    } catch (error) {
      console.error('Error unblocking IP:', error);
      alert('Error unblocking IP');
    } finally {
      loading = false;
    }
  }

  async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs?')) return;

    loading = true;
    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/logs`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        logs = [];
        alert('Logs cleared successfully');
      } else {
        alert('Failed to clear logs');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Error clearing logs');
    } finally {
      loading = false;
    }
  }

  function initiateShutdown(service: string) {
    shutdownService = service;
    showShutdownConfirm = true;
  }

  async function confirmShutdown() {
    showShutdownConfirm = false;
    loading = true;

    try {
      const token = authStore.getAccessToken();
      const response = await fetch(`${apiUrl}/developer/shutdown/${shutdownService}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        if (shutdownService === 'server') {
          // Server is shutting down, stop refreshing
          stopAutoRefresh();
        }
      } else {
        alert(`Error: ${data.message || 'Failed to shutdown service'}`);
      }
    } catch (error) {
      console.error('Error shutting down service:', error);
      alert('Error communicating with server');
    } finally {
      loading = false;
    }
  }

  function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  }

  function formatMemory(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function getLogTypeColor(type: string): string {
    switch (type) {
      case 'errors': return 'text-red-600 dark:text-red-400';
      case 'service': return 'text-green-600 dark:text-green-400';
      case 'actions': return 'text-purple-600 dark:text-purple-400';
      case 'connections': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'running':
      case 'connected':
      case 'ready':
        return 'text-green-600 dark:text-green-400';
      case 'error':
      case 'disconnected':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Developer Console</h1>
    <p class="text-gray-600 dark:text-gray-400">System monitoring and service management</p>
  </div>

  <!-- Tab Navigation -->
  <div class="border-b border-gray-200 dark:border-gray-700">
    <nav class="flex space-x-4">
      <button
        onclick={() => activeTab = 'overview'}
        class="px-4 py-2 border-b-2 font-medium text-sm transition-colors"
        class:border-purple-600={activeTab === 'overview'}
        class:text-purple-600={activeTab === 'overview'}
        class:dark:text-purple-400={activeTab === 'overview'}
        class:border-transparent={activeTab !== 'overview'}
        class:text-gray-600={activeTab !== 'overview'}
        class:dark:text-gray-400={activeTab !== 'overview'}
      >
        Overview
      </button>
      <button
        onclick={() => activeTab = 'features'}
        class="px-4 py-2 border-b-2 font-medium text-sm transition-colors"
        class:border-purple-600={activeTab === 'features'}
        class:text-purple-600={activeTab === 'features'}
        class:dark:text-purple-400={activeTab === 'features'}
        class:border-transparent={activeTab !== 'features'}
        class:text-gray-600={activeTab !== 'features'}
        class:dark:text-gray-400={activeTab !== 'features'}
      >
        Features
      </button>
      <button
        onclick={() => activeTab = 'security'}
        class="px-4 py-2 border-b-2 font-medium text-sm transition-colors"
        class:border-purple-600={activeTab === 'security'}
        class:text-purple-600={activeTab === 'security'}
        class:dark:text-purple-400={activeTab === 'security'}
        class:border-transparent={activeTab !== 'security'}
        class:text-gray-600={activeTab !== 'security'}
        class:dark:text-gray-400={activeTab !== 'security'}
      >
        Security
      </button>
      <button
        onclick={() => activeTab = 'logs'}
        class="px-4 py-2 border-b-2 font-medium text-sm transition-colors"
        class:border-purple-600={activeTab === 'logs'}
        class:text-purple-600={activeTab === 'logs'}
        class:dark:text-purple-400={activeTab === 'logs'}
        class:border-transparent={activeTab !== 'logs'}
        class:text-gray-600={activeTab !== 'logs'}
        class:dark:text-gray-400={activeTab !== 'logs'}
      >
        Logs
      </button>
    </nav>
  </div>

  <!-- Overview Tab -->
  {#if activeTab === 'overview'}
  <!-- Service Status -->
  {#if serviceStatus}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Service Status</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Server Status -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Server</h3>
          <p class={`text-sm font-semibold mb-1 ${getStatusColor(serviceStatus.server.status)}`}>
            {serviceStatus.server.status.toUpperCase()}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Uptime: {formatUptime(serviceStatus.server.uptime)}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Memory: {formatMemory(serviceStatus.server.memory.heapUsed)} / {formatMemory(serviceStatus.server.memory.heapTotal)}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">PID: {serviceStatus.server.pid}</p>
          <button
            onclick={() => initiateShutdown('server')}
            class="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 w-full"
          >
            Shutdown Server
          </button>
        </div>

        <!-- PostgreSQL Status -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">PostgreSQL</h3>
          <p class={`text-sm font-semibold mb-1 ${getStatusColor(serviceStatus.postgresql.status)}`}>
            {serviceStatus.postgresql.status.toUpperCase()}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Total: {serviceStatus.postgresql.totalConnections}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Idle: {serviceStatus.postgresql.idleConnections}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Waiting: {serviceStatus.postgresql.waitingConnections}</p>
        </div>

        <!-- Redis Status -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Redis</h3>
          <p class={`text-sm font-semibold mb-1 ${getStatusColor(serviceStatus.redis.status)}`}>
            {serviceStatus.redis.status.toUpperCase()}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-400">
            {serviceStatus.redis.connected ? 'Connected' : 'Disconnected'}
          </p>
          <button
            onclick={() => initiateShutdown('redis')}
            class="mt-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 w-full"
          >
            Disconnect Redis
          </button>
        </div>

        <!-- Supabase Status -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Supabase</h3>
          <p class={`text-sm font-semibold mb-1 ${getStatusColor(serviceStatus.supabase.status)}`}>
            {serviceStatus.supabase.status.toUpperCase()}
          </p>
          <p class="text-xs text-gray-600 dark:text-gray-400">Authentication service</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Database Stats -->
  {#if databaseStats}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Database Statistics</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- PostgreSQL Stats -->
        {#if databaseStats.postgresql && !databaseStats.postgresql.error}
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">PostgreSQL</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Database Size: {databaseStats.postgresql.databaseSize}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Top Tables:</p>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              {#each databaseStats.postgresql.topTables || [] as table}
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {table.tablename}: {table.size} ({table.row_count} rows)
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Redis Stats -->
        {#if databaseStats.redis && !databaseStats.redis.error}
          <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-medium text-gray-900 dark:text-white mb-2">Redis</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Total Keys: {databaseStats.redis.keys}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Status: {databaseStats.redis.status}
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {/if}

  <!-- Features Tab -->
  {#if activeTab === 'features'}
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Feature Toggles</h2>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
      Enable or disable website features to prevent issues or restrict access.
    </p>

    {#if features}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Scraping Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">Web Scraping</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Quizlet scraping functionality</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.scraping}
              onchange={(e: any) => toggleFeature('scraping', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <!-- Learning Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">Learning System</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Flashcard learning features</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.learning}
              onchange={(e: any) => toggleFeature('learning', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <!-- Image Upload Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">Image Upload</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Image searching and uploading</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.image_upload}
              onchange={(e: any) => toggleFeature('image_upload', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <!-- CSV Import Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">CSV Import</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">CSV file importing</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.csv_import}
              onchange={(e: any) => toggleFeature('csv_import', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <!-- Registration Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">User Registration</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">New user sign-ups</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.registration}
              onchange={(e: any) => toggleFeature('registration', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <!-- API Access Feature -->
      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium text-gray-900 dark:text-white">API Access</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Public API endpoints</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={features.api_access}
              onchange={(e: any) => toggleFeature('api_access', e.target.checked)}
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>
    </div>
    {:else}
    <p class="text-gray-600 dark:text-gray-400">Loading features...</p>
    {/if}
  </div>
  {/if}

  <!-- Security Tab -->
  {#if activeTab === 'security'}
  <div class="space-y-6">
    <!-- Blocked IPs -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Blocked IP Addresses</h2>
        <button
          onclick={() => showBlockIPModal = true}
          class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
        >
          Block New IP
        </button>
      </div>

      {#if blockedIPs.length === 0}
        <p class="text-gray-600 dark:text-gray-400">No IPs are currently blocked</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">IP Address</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Reason</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Blocked At</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each blockedIPs as blockedIP}
                <tr class="border-t border-gray-200 dark:border-gray-700">
                  <td class="px-4 py-2 text-gray-900 dark:text-white font-mono">{blockedIP.ip}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{blockedIP.reason}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(blockedIP.blockedAt).toLocaleString()}</td>
                  <td class="px-4 py-2">
                    <button
                      onclick={() => unblockIP(blockedIP.ip)}
                      class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <!-- Rate Limit Stats -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Rate Limit Statistics</h2>
        <button
          onclick={() => fetchRateLimitStats()}
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {#if rateLimitStats.length === 0}
        <p class="text-gray-600 dark:text-gray-400">No rate limit data available</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">IP Address</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Requests</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Expires In (s)</th>
                <th class="px-4 py-2 text-left text-gray-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each rateLimitStats as stat}
                <tr class="border-t border-gray-200 dark:border-gray-700">
                  <td class="px-4 py-2 text-gray-900 dark:text-white font-mono">{stat.ip}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{stat.requests}</td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{stat.expiresIn}s</td>
                  <td class="px-4 py-2">
                    <button
                      onclick={() => {
                        newBlockIP = stat.ip;
                        newBlockReason = `High rate limit: ${stat.requests} requests`;
                        showBlockIPModal = true;
                      }}
                      class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      Block
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
  {/if}

  <!-- Log Viewer Tab -->
  {#if activeTab === 'logs'}
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">System Logs</h2>

      <div class="flex gap-2 items-center">
        <!-- Auto-refresh toggle -->
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            bind:checked={autoRefresh}
            class="rounded"
          />
          Auto-refresh
        </label>

        <!-- Log type filter -->
        <select
          bind:value={selectedLogType}
          onchange={() => fetchLogs()}
          class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Logs</option>
          <option value="errors">Errors</option>
          <option value="service">Service</option>
          <option value="actions">Actions</option>
          <option value="connections">Connections</option>
        </select>

        <button
          onclick={() => fetchLogs()}
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>

        <button
          onclick={() => clearLogs()}
          class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          disabled={loading}
        >
          Clear Logs
        </button>
      </div>
    </div>

    <!-- Log entries -->
    <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs">
      {#if logs.length === 0}
        <p class="text-gray-500 dark:text-gray-400">No logs available</p>
      {:else}
        {#each logs as log}
          <div class="mb-1 flex gap-2">
            <span class="text-gray-500 dark:text-gray-500">
              {formatTimestamp(log.timestamp)}
            </span>
            <span class={`font-semibold ${getLogTypeColor(log.type)}`}>
              [{log.type.toUpperCase()}]
            </span>
            <span class="text-gray-700 dark:text-gray-300">
              {log.message}
            </span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  {/if}
</div>

<!-- Block IP Modal -->
{#if showBlockIPModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Block IP Address
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            IP Address
          </label>
          <input
            type="text"
            bind:value={newBlockIP}
            placeholder="192.168.1.1"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason (optional)
          </label>
          <input
            type="text"
            bind:value={newBlockReason}
            placeholder="Suspicious activity"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button
          onclick={() => {
            showBlockIPModal = false;
            newBlockIP = '';
            newBlockReason = '';
          }}
          class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          onclick={() => blockIP()}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          disabled={loading}
        >
          Block IP
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Shutdown Confirmation Modal -->
{#if showShutdownConfirm}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Confirm Shutdown
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        Are you sure you want to shutdown the {shutdownService} service? This action cannot be undone.
        {#if shutdownService === 'server'}
          <span class="block mt-2 text-red-600 dark:text-red-400 font-semibold">
            Warning: This will shut down the entire server!
          </span>
        {/if}
      </p>
      <div class="flex justify-end gap-3">
        <button
          onclick={() => showShutdownConfirm = false}
          class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          onclick={() => confirmShutdown()}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Shutdown
        </button>
      </div>
    </div>
  </div>
{/if}
