<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { authStore } from '../utils/authStore.svelte';
  import { browser } from '$app/environment';

  let sidebarOpen = $state(false);
  let darkMode = writable(false);
  let showUserMenu = $state(false);

  onMount(() => {
    // Restore sidebar state from localStorage first
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      sidebarOpen = savedSidebarState === 'true';
    } else {
      // Set sidebar open by default on desktop if no saved state
      if (window.innerWidth >= 768) {
        sidebarOpen = true;
        localStorage.setItem('sidebarOpen', 'true');
      }
    }

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      darkMode.set(true);
      document.documentElement.classList.add('dark');
    }
  });

  const toggleDarkMode = () => {
    darkMode.update(v => !v);
    const isDark = !document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen;
    // Save sidebar state to localStorage
    if (browser) {
      localStorage.setItem('sidebarOpen', String(sidebarOpen));
    }
  };

  const closeSidebar = () => {
    sidebarOpen = false;
    if (browser) {
      localStorage.setItem('sidebarOpen', 'false');
    }
  };

  const toggleUserMenu = () => {
    showUserMenu = !showUserMenu;
  };

  const handleLogout = async () => {
    try {
      await authStore.signOut();
      showUserMenu = false;
      goto('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { name: 'Import Set', path: '/scrape', icon: 'BookOpen' },
	{ name: "Vocab Sets", path: "/vocab-sets", icon: "BookOpen" },
    { name: 'Statistics', path: '/statistics', icon: 'History' },
	{ name: "Grammar", path: "/grammar", icon: "BookOpen"},
	{ name: 'Settings', path: '/settings', icon: 'Settings' },
  ];

  const handleNavClick = (path: string) => {
    goto(path);
    if (window.innerWidth < 768 && sidebarOpen) {
      closeSidebar();
    }
  };

  let isDark = false;
  darkMode.subscribe(value => {
    isDark = value;
  });

  // Redirect to auth if not authenticated
  $effect(() => {
    if (!authStore.loading && !authStore.isAuthenticated() && !$page.url.pathname.startsWith('/auth')) {
      goto('/auth');
    }
  });

  // Check if we should show layout (hide on auth pages)
  let isAuthPage = $derived($page.url.pathname.startsWith('/auth'));

  // Close user menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showUserMenu) {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        showUserMenu = false;
      }
    }
  }

  function handleResize() {
    if (window.innerWidth < 768 && sidebarOpen) {
      sidebarOpen = false;
      if (browser) {
        localStorage.setItem('sidebarOpen', 'false');
      }
    }
  }
</script>

<svelte:head>
  <!-- No external CSS needed, we'll use SVG icons directly -->
</svelte:head>

<svelte:window on:resize={handleResize} on:click={handleClickOutside} />

{#if !isAuthPage}
<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
  <!-- Navbar -->
  <nav class="bg-white dark:bg-gray-800 shadow-md fixed top-0 left-0 right-0 z-50 transition-colors duration-300 border-b border-gray-200 dark:border-gray-700">
    <div class="px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2 sm:gap-4">
        <button 
          on:click={toggleSidebar}
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <svg class="w-6 h-6 text-gray-800 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent truncate">
            fantasma.xyz
          </h1>
        </div>
      </div>
      
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Ghost-themed Dark Mode Toggle -->
        <button 
          on:click={toggleDarkMode}
          class="relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          class:bg-gradient-to-r={isDark}
          class:from-indigo-900={isDark}
          class:to-purple-900={isDark}
          class:bg-gray-200={!isDark}
          aria-label="Toggle dark mode"
        >
          <div 
            class="absolute top-1 transition-all duration-300 w-6 h-6 rounded-full flex items-center justify-center shadow-lg bg-white dark:bg-gray-800"
            class:left-1={!isDark}
            class:left-9={isDark}
          >
            {#if isDark}
              <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            {:else}
              <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            {/if}
          </div>
        </button>
        
        <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative" aria-label="Notifications">
          <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></span>
        </button>

        <!-- User menu -->
        {#if authStore.isAuthenticated()}
          <div class="relative user-menu-container">
            <button
              on:click={toggleUserMenu}
              class="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-shadow"
              aria-label="User menu"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {#if showUserMenu}
              <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                <div class="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {authStore.user?.email || 'user'}
                  </p>
                </div>
                <button
                  on:click={handleLogout}
                  class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <button
            on:click={() => goto('/auth')}
            class="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all text-sm font-medium shadow-md hover:shadow-lg"
          >
            Sign In
          </button>
        {/if}
      </div>
    </div>
  </nav>

  <!-- Mobile overlay -->
  {#if sidebarOpen}
    <div 
      class="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
      on:click={closeSidebar}
      on:keydown={(e) => e.key === 'Escape' && closeSidebar()}
      role="button"
      tabindex="0"
      aria-label="Close sidebar"
    ></div>
  {/if}

  <div class="pt-16 flex">
    <!-- Sidebar -->
    <aside 
      class="fixed md:sticky left-0 top-16 bottom-0 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 z-40 w-64 md:h-[calc(100vh-4rem)] border-r border-gray-200 dark:border-gray-700"
      class:-translate-x-full={!sidebarOpen}
      class:translate-x-0={sidebarOpen}
    >
      <div class="h-full overflow-y-auto flex flex-col">
        <nav class="p-4 space-y-2 flex-1">
          {#each navItems as item}
            <button
              on:click={() => handleNavClick(item.path)}
              class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left group relative overflow-hidden"
              class:bg-gradient-to-r={$page.url.pathname === item.path}
              class:from-purple-500={$page.url.pathname === item.path}
              class:to-indigo-600={$page.url.pathname === item.path}
              class:text-white={$page.url.pathname === item.path}
              class:shadow-lg={$page.url.pathname === item.path}
              class:hover:bg-gray-100={$page.url.pathname !== item.path && !isDark}
              class:dark:hover:bg-gray-700={$page.url.pathname !== item.path}
              class:text-gray-700={$page.url.pathname !== item.path && !isDark}
              class:dark:text-gray-300={$page.url.pathname !== item.path}
            >
              {#if item.icon === 'LayoutDashboard'}
                <svg class="w-5 h-5 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              {:else if item.icon === 'BookOpen'}
                <svg class="w-5 h-5 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              {:else if item.icon === 'History'}
                <svg class="w-5 h-5 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              {:else if item.icon === 'Settings'}
                <svg class="w-5 h-5 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              {/if}
              <span class="font-medium">{item.name}</span>
            </button>
          {/each}
        </nav>
        
        <!-- Ghost decorative element -->
        <div class="p-4 text-center border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-center gap-2 opacity-30 dark:opacity-20">
            <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">Powered by Fantasma</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main 
      class="flex-1 p-4 sm:p-6 md:p-8 w-full min-h-[calc(100vh-4rem)]"
    >
      <slot />
    </main>
  </div>
</div>
{:else}
  <!-- Auth pages render without navbar/sidebar -->
  <slot />
{/if}

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
</style>