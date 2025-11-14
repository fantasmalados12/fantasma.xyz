/**
 * Feature flags store
 * Fetches and manages feature flags from the API
 */

interface FeatureFlags {
  scraping: boolean;
  learning: boolean;
  image_upload: boolean;
  csv_import: boolean;
  registration: boolean;
  api_access: boolean;
}

class FeatureFlagsStore {
  flags = $state<FeatureFlags>({
    scraping: true,
    learning: true,
    image_upload: true,
    csv_import: true,
    registration: true,
    api_access: true
  });

  loading = $state(true);
  initialized = $state(false);

  async initialize() {
    if (this.initialized) return;

    try {
      const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://fantasma.xyz/api';
      const response = await fetch(`${apiUrl}/config/features`);

      if (response.ok) {
        const data = await response.json();

        // Update all flags from the API
        this.flags.scraping = data.scraping ?? true;
        this.flags.learning = data.learning ?? true;
        this.flags.image_upload = data.image_upload ?? true;
        this.flags.csv_import = data.csv_import ?? true;
        this.flags.registration = data.registration ?? true;
        this.flags.api_access = data.api_access ?? true;
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing feature flags:', error);
      // On error, default to all enabled
    } finally {
      this.loading = false;
    }
  }

  async refresh() {
    this.initialized = false;
    await this.initialize();
  }

  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }
}

export const featureFlagsStore = new FeatureFlagsStore();
