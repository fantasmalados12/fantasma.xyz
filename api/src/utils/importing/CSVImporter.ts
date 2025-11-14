import Papa from 'papaparse';
import { QuizletData, QuizletTerm } from '../scraping/Scraper';

export interface CSVImportOptions {
  title?: string;
  maxTerms?: number;
}

export interface CSVImportResult {
  success: boolean;
  data?: QuizletData;
  error?: string;
}

/**
 * Parse CSV text and return QuizletData format
 *
 * Expected CSV format:
 * term,definition
 * palabra,word
 * casa,house
 *
 * OR (with headers):
 * term,definition
 * palabra,word
 * casa,house
 */
export function parseCSV(csvText: string, options: CSVImportOptions = {}): CSVImportResult {
  try {
    // Validate input
    if (!csvText || csvText.trim().length === 0) {
      return {
        success: false,
        error: 'CSV text is empty'
      };
    }

    // Parse CSV using papaparse
    const parseResult: any = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      delimiter: ','
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.map((e: any) => e.message).join(', ');
      return {
        success: false,
        error: `CSV parsing error: ${errorMessages}`
      };
    }

    const rows: string[][] = parseResult.data;

    if (rows.length === 0) {
      return {
        success: false,
        error: 'No data found in CSV'
      };
    }

    // Check if first row is a header (contains "term" and "definition")
    let startIndex = 0;
    const firstRow = rows[0];
    if (firstRow.length >= 2) {
      const firstCell = firstRow[0].toLowerCase().trim();
      const secondCell = firstRow[1].toLowerCase().trim();

      if (firstCell === 'term' || firstCell === 'front' || firstCell === 'word') {
        if (secondCell === 'definition' || secondCell === 'back' || secondCell === 'meaning') {
          startIndex = 1; // Skip header row
        }
      }
    }

    // Extract terms
    const terms: QuizletTerm[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 2) {
        continue; // Skip rows that don't have at least 2 columns
      }

      const term = row[0]?.trim();
      const definition = row[1]?.trim();

      if (!term || !definition) {
        continue; // Skip rows with empty term or definition
      }

      terms.push({ term, definition });

      // Check max terms limit
      if (options.maxTerms && terms.length >= options.maxTerms) {
        break;
      }
    }

    if (terms.length === 0) {
      return {
        success: false,
        error: 'No valid term/definition pairs found in CSV. Make sure your CSV has at least 2 columns: term,definition'
      };
    }

    // Create title
    const title = options.title || `Imported Set (${terms.length} terms)`;

    return {
      success: true,
      data: {
        title,
        terms
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing CSV'
    };
  }
}

/**
 * Validate CSV size before parsing
 */
export function validateCSVSize(csvText: string, maxSize: number): { valid: boolean; error?: string } {
  if (csvText.length > maxSize) {
    return {
      valid: false,
      error: `CSV text is too large. Maximum size is ${maxSize} characters, received ${csvText.length}`
    };
  }

  return { valid: true };
}
