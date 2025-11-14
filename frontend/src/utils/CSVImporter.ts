/**
 * Frontend CSV Importer
 * Sends CSV text to the backend for processing
 */

export async function importCSV(csvText: string, title?: string): Promise<any> {
  const apiUrl = import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://fantasma.xyz/api';

  const response = await fetch(`${apiUrl}/import/csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      csvText,
      title
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to import CSV');
  }

  return await response.json();
}
