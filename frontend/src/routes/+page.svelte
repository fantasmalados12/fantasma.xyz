<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { getRecentVocabSets } from "../utils/LibrarySets";
    import { authStore } from "../utils/authStore.svelte";

    let recentSets: any = [];
    let loading = true;

    onMount(async() => {
        // Wait for auth to initialize
        while (authStore.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get user ID from auth store
        const userId = authStore.user?.id;

        if (userId) {
            const sets = await getRecentVocabSets(userId);
            console.log(sets);
            recentSets = sets.recentVocabSets;
        }

        loading = false;
    });

  const stats = [
    { 
      label: 'Hours Studied', 
      value: '3', 
      change: '+12.5%', 
      changeType: 'increase',
      icon: 'chart'
    },
    { 
      label: 'Terms Extracted', 
      value: '458', 
      change: '+8.3%', 
      changeType: 'increase',
      icon: 'document'
    },
    { 
      label: 'Terms Studied', 
      value: '98.5%', 
      change: '+2.1%', 
      changeType: 'increase',
      icon: 'check'
    },
    { 
      label: 'Active Sets', 
      value: '3', 
      change: '-3.2%', 
      changeType: 'decrease',
      icon: 'folder'
    }
  ];
  
  const recentActivity = [
    { 
      id: 1, 
      title: 'Spanish Vocabulary Chapter 6', 
      terms: 150, 
      time: '2 mins ago',
      status: 'success'
    },
    { 
      id: 2, 
      title: 'Spanish Vocabulary Chapter 7', 
      terms: 87, 
      time: '15 mins ago',
      status: 'success'
    },
    { 
      id: 3, 
      title: 'Spanish Vocabulary Chapter 8', 
      terms: 203, 
      time: '1 hour ago',
      status: 'success'
    },
    { 
      id: 4, 
      title: 'Spanish Vocabulary Chapter 9', 
      terms: 45, 
      time: '2 hours ago',
      status: 'success'
    },
    { 
      id: 5, 
      title: 'Spanish Vocabulary Chapter 10', 
      terms: 118, 
      time: '3 hours ago',
      status: 'success'
    }
  ];
  
  const quickActions = [
    { name: 'New Vocabulary', icon: 'plus', color: 'purple', path: '/scrape' },
    { name: 'View Statistics', icon: 'clock', color: 'indigo', path: '/statistics' },
    { name: 'Export Data', icon: 'download', color: 'blue', path: '/export' },
  ];

  const handleNav = (path: string) => { goto(path) }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
    <p class="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening with your scrapes.</p>
  </div>
  
  <!-- Stats Grid
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {#each stats as stat}
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            {#if stat.icon === 'chart'}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            {:else if stat.icon === 'document'}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            {:else if stat.icon === 'check'}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            {:else if stat.icon === 'folder'}
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            {/if}
          </div>
          <span 
            class="text-sm font-medium px-2 py-1 rounded"
            class:text-green-700={stat.changeType === 'increase'}
            class:bg-green-50={stat.changeType === 'increase'}
            class:dark:bg-green-900={stat.changeType === 'increase'}
            class:dark:text-green-300={stat.changeType === 'increase'}
            class:text-red-700={stat.changeType === 'decrease'}
            class:bg-red-50={stat.changeType === 'decrease'}
            class:dark:bg-red-900={stat.changeType === 'decrease'}
            class:dark:text-red-300={stat.changeType === 'decrease'}
          >
            {stat.change}
          </span>
        </div>
        <p class="text-gray-600 dark:text-gray-400 text-sm mb-1">{stat.label}</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
      </div>
    {/each}
  </div> -->
  
  <!-- Quick Actions -->
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {#each quickActions as action}
        <button on:click={() => { handleNav(action.path) }} class="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group">
          {#if action.icon === 'plus'}
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          {:else if action.icon === 'clock'}
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {:else if action.icon === 'download'}
            <svg class="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          {/if}
          <span class="font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">{action.name}</span>
        </button>
      {/each}
    </div>
  </div>
  
  <!-- Recent Activity -->
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">Recent Activity</h2>
      <button class="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
        View All
      </button>
    </div>
    <div class="space-y-4">
      {#each recentSets as activity}
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div class="flex items-center gap-4">
            <!-- <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
              {activity.terms}
            </div> -->
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{activity.title}</p>
              <!-- <p class="text-sm text-gray-500 dark:text-gray-400">{activity.terms} terms extracted</p> -->
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-500 dark:text-gray-400">{activity.days_since_update} days ago</span>
            <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>