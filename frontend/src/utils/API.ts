import { authStore } from './authStore.svelte';

export const getAPIUrlBasedOffEnviornment = (): string => {

    let url: string = import.meta.env.DEV ? `http://localhost:3001` : `https://fantasma.io`;

    return url;

}

/**
 * Get authorization headers with the current user's access token
 * Use this for authenticated API requests
 */
export const getAuthHeaders = (): Record<string, string> => {
    const token = authStore.getAccessToken();
    if (token) {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
    return {
        'Content-Type': 'application/json'
    };
}