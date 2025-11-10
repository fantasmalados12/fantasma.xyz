import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

class AuthStore {
    user = $state<User | null>(null);
    session = $state<Session | null>(null);
    loading = $state(true);
    initialized = $state(false);

    constructor() {
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Get initial session
            const { data: { session } } = await supabase.auth.getSession();
            this.session = session;
            this.user = session?.user ?? null;

            // Listen for auth changes
            supabase.auth.onAuthStateChange((_event, session) => {
                this.session = session;
                this.user = session?.user ?? null;
            });

            this.initialized = true;
        } catch (error) {
            console.error('Error initializing auth:', error);
        } finally {
            this.loading = false;
        }
    }

    async signUp(email: string, password: string, metadata?: Record<string, any>) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata || {}
            }
        });

        if (error) throw error;
        return data;
    }

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    async resetPassword(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }

    async updatePassword(password: string) {
        const { error } = await supabase.auth.updateUser({
            password
        });
        if (error) throw error;
    }

    getAccessToken(): string | null {
        return this.session?.access_token ?? null;
    }

    isAuthenticated(): boolean {
        return !!this.user;
    }
}

export const authStore = new AuthStore();
