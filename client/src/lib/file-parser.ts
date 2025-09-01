import Papa from "papaparse";
import { FileMetadata } from "@shared/schema";

export async function parseFile(file: File): Promise<FileMetadata> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      preview: 20, // Only parse first 20 rows for preview
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error(`Parse error: ${results.errors[0].message}`);
          }

          const data = results.data as Record<string, any>[];
          const columns = Object.keys(data[0] || {});
          
          // Detect numeric columns
          const numericColumns = columns.filter(col => {
            const values = data.slice(0, 10).map(row => row[col]);
            const numericCount = values.filter(val => 
              typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(parseFloat(val)))
            ).length;
            return numericCount / values.length > 0.7; // 70% numeric threshold
          });

          // Detect delimiter (Papa Parse handles this automatically)
          const delimiter = results.meta.delimiter || ',';
          
          const metadata: FileMetadata = {
            name: file.name,
            size: file.size,
            type: file.type,
            delimiter,
            hasHeader: true, // Papa Parse assumes header if header: true
            columnCount: columns.length,
            rowCount: file.size > 1024 * 1024 ? Math.floor(file.size / 100) : data.length, // Estimate for large files
            columns,
            numericColumns,
            preview: data,
          };

          resolve(metadata);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`Failed to parse file: ${error.message}`));
      },
    });
  });
}

export function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const counts = delimiters.map(delimiter => ({
    delimiter,
    count: (sample.match(new RegExp(delimiter, 'g')) || []).length,
  }));
  
  return counts.sort((a, b) => b.count - a.count)[0].delimiter;
}

export function validateIdMapping(
  embeddingsData: Record<string, any>[],
  infoData: Record<string, any>[],
  idColumn: string = 'id'
): { matched: number; total: number; percentage: number } {
  const embeddingIds = new Set(embeddingsData.map(row => row[idColumn]));
  const infoIds = new Set(infoData.map(row => row[idColumn]));
  
  const intersection = new Set(Array.from(embeddingIds).filter(id => infoIds.has(id)));
  const total = Math.max(embeddingIds.size, infoIds.size);
  
  return {
    matched: intersection.size,
    total,
    percentage: (intersection.size / total) * 100,
  };
}
