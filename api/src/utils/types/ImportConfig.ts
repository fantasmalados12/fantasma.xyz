/**
 * Configuration types for import functionality
 */

export type ImportMethod = "csv" | "scrape" | "both";

export interface ImportConfig {
  method: ImportMethod;
  csv: {
    max_size: number;
    max_terms: number;
  };
  scrape: {
    enabled: boolean;
  };
}

export interface ImportCapabilities {
  csvEnabled: boolean;
  scrapeEnabled: boolean;
}

/**
 * Helper function to get import capabilities from config
 */
export function getImportCapabilities(config: any): ImportCapabilities {
  const importConfig = config.import as ImportConfig;

  return {
    csvEnabled: importConfig.method === "csv" || importConfig.method === "both",
    scrapeEnabled: (importConfig.method === "scrape" || importConfig.method === "both") && importConfig.scrape.enabled
  };
}
