
<script lang="ts">
    import { onMount } from "svelte";
    import { getLibrarySets } from "../../utils/LibrarySets";
    import { goto } from "$app/navigation";
    import { authStore } from "../../utils/authStore.svelte";

    let vocabSets: any = [];
    let loading = true;

    const gradients = [
        'from-purple-500 to-indigo-600',
        'from-pink-500 to-rose-600',
        'from-blue-500 to-cyan-600',
        'from-emerald-500 to-teal-600',
        'from-orange-500 to-red-600',
        'from-violet-500 to-purple-600',
        'from-fuchsia-500 to-pink-600',
        'from-sky-500 to-blue-600',
    ];

    function getGradient(index: number) {
        return gradients[index % gradients.length];
    }

    function getTermCount(set: any) {
        try {
            return JSON.parse(set.terms).length;
        } catch {
            return 0;
        }
    }

    onMount(async() => {
        // Wait for auth to initialize
        while (authStore.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const userId = authStore.user?.id;

        if (userId) {
            const vocabs = await getLibrarySets(userId);
            vocabSets = vocabs.vocabSets;
        }

        loading = false;
    });

</script>

<div class="space-y-8">
    <!-- Header Section -->
    <div class="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-2xl">
        <div class="relative z-10">
            <h1 class="text-4xl md:text-5xl font-black mb-3 tracking-tight">Vocabulary Sets</h1>
            <p class="text-purple-100 text-lg">Master your vocabulary, one set at a time</p>
            <div class="mt-6 flex items-center gap-4">
                <div class="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
                    <span class="text-2xl font-bold">{vocabSets.length}</span>
                    <span class="text-purple-100 ml-2">Total Sets</span>
                </div>
            </div>
        </div>
        <!-- Decorative circles -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
    </div>

    {#if loading}
        <!-- Loading State -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each Array(6) as _}
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
                    <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4 mb-4"></div>
                    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6"></div>
                    <div class="flex gap-2">
                        <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-full"></div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if vocabSets.length === 0}
        <!-- Empty State -->
        <div class="text-center py-20">
            <div class="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl shadow-xl mb-6 transform rotate-12">
                <span class="text-5xl transform -rotate-12">📚</span>
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">No Vocabulary Sets Yet</h2>
            <p class="text-gray-600 dark:text-gray-400 text-lg mb-8">Create your first vocab set to start learning!</p>
            <button
                on:click={() => goto('/scrape')}
                class="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
                Create Your First Set
            </button>
        </div>
    {:else}
        <!-- Vocab Sets Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each vocabSets as set, index}
                <div
                    on:click={() => goto(`/vocab-sets/${set.id}`)}
                    class="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:-translate-y-2 cursor-pointer"
                >
                    <!-- Gradient Header -->
                    <div class="h-32 bg-gradient-to-br {getGradient(index)} relative overflow-hidden">
                        <div class="absolute inset-0 bg-black/10"></div>
                        <div class="absolute top-4 right-4 bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/50">
                            <span class="text-white font-bold text-sm">{getTermCount(set)} terms</span>
                        </div>
                        <!-- Decorative pattern -->
                        <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/20 to-transparent"></div>
                    </div>

                    <!-- Content -->
                    <div class="p-6">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {set.title}
                        </h2>

                        <!-- Stats Bar -->
                        <div class="flex items-center gap-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
                            <div class="flex items-center gap-1">
                                <span class="text-lg">📖</span>
                                <span>{getTermCount(set)} words</span>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-2">
                            <button
                                on:click={(e) => { e.stopPropagation(); goto(`/learn/${set.id}`); }}
                                class="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <span class="text-lg">🎯</span>
                                <span>Learn</span>
                            </button>
                            <button
                                on:click={(e) => { e.stopPropagation(); goto(`/vocab-sets/${set.id}`); }}
                                class="px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all duration-200 hover:shadow-md"
                            >
                                <span class="text-lg">👁️</span>
                            </button>
                        </div>
                    </div>

                    <!-- Hover Glow Effect -->
                    <div class="absolute inset-0 bg-gradient-to-br {getGradient(index)} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"></div>
                </div>
            {/each}
        </div>

        <!-- Create New Set FAB -->
        <button
            on:click={() => goto('/scrape')}
            class="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full shadow-2xl hover:shadow-purple-500/50 transform hover:scale-110 transition-all duration-200 flex items-center justify-center text-3xl z-50"
            title="Create New Set"
        >
            <span>+</span>
        </button>
    {/if}
</div>