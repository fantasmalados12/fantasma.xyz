<script lang="ts">
  import '../../app.css';
  import { authStore } from '../../utils/authStore.svelte';
  import { goto } from '$app/navigation';

  // Redirect to home if already authenticated
  $effect(() => {
    if (!authStore.loading && authStore.isAuthenticated()) {
      goto('/');
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 animate-gradient">
  <slot />
</div>

<style>
  @keyframes gradient {
    0%, 100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 8s ease infinite;
  }
</style>
