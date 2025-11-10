<script lang="ts">
    import { authStore } from '../../utils/authStore.svelte';
    import { goto } from '$app/navigation';

    let mode = $state<'login' | 'signup'>('login');
    let email = $state('');
    let password = $state('');
    let confirmPassword = $state('');
    let error = $state('');
    let loading = $state(false);
    let message = $state('');

    async function handleSubmit() {
        error = '';
        message = '';
        loading = true;

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    error = 'Passwords do not match';
                    loading = false;
                    return;
                }

                await authStore.signUp(email, password);
                message = 'Account created successfully!';
                setTimeout(() => {
                    goto('/');
                }, 1000);
            } else {
                await authStore.signIn(email, password);
                message = 'Successfully logged in!';
                setTimeout(() => {
                    goto('/');
                }, 1000);
            }
        } catch (e: any) {
            error = e.message || 'An error occurred';
        } finally {
            loading = false;
        }
    }

    function toggleMode() {
        mode = mode === 'login' ? 'signup' : 'login';
        error = '';
        message = '';
    }

    // Redirect if already logged in
    $effect(() => {
        if (authStore.isAuthenticated() && !authStore.loading) {
            goto('/');
        }
    });
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
    <!-- Animated floating title -->
    <div class="absolute top-20 floating">
        <h1 class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent drop-shadow-2xl">
            fantasma.xyz
        </h1>
    </div>

    <div class="w-full max-w-md z-10 mt-32">
        <div class="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <div class="text-center mb-6">
                <h2 class="text-2xl font-semibold text-white mb-2">
                    {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p class="text-purple-200 text-sm">
                    {mode === 'login' ? 'Sign in to continue' : 'Join us today'}
                </p>
            </div>

            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
                <div>
                    <label for="email" class="block text-sm font-medium text-white mb-2">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        bind:value={email}
                        required
                        autocomplete="email"
                        class="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition text-white placeholder-purple-200"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-white mb-2">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                        autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        class="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition text-white placeholder-purple-200"
                        placeholder="••••••••"
                    />
                </div>

                {#if mode === 'signup'}
                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-white mb-2">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            bind:value={confirmPassword}
                            required
                            autocomplete="new-password"
                            class="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition text-white placeholder-purple-200"
                            placeholder="••••••••"
                        />
                    </div>
                {/if}

                {#if error}
                    <div class="bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-white px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                {/if}

                {#if message}
                    <div class="bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-white px-4 py-3 rounded-xl text-sm">
                        {message}
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={loading}
                    class="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border border-white/30"
                >
                    {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
            </form>

            <div class="mt-6 text-center">
                <button
                    onclick={toggleMode}
                    class="text-purple-200 hover:text-white font-medium text-sm transition-colors"
                >
                    {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    @keyframes float {
        0%, 100% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-20px);
        }
    }

    .floating {
        animation: float 3s ease-in-out infinite;
    }
</style>
