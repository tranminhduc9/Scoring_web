export interface IndustryLevel {
  code: string;
  name: string;
  level: number;
  fullName: string;
  apiCode: string; // Format: level1+levelLast (e.g., A1110)
}

/**
 * Detect level from industry code: level = number of dashes - 1
 * Examples: A -> level 0, A-1 -> level 1, A-1-11 -> level 2
 */
export function detectLevel(code: string): number {
  const dashCount = (code.match(/-/g) || []).length;
  return dashCount;
}

/**
 * Convert industry code to API format: level1+levelLast
 * Examples: A-1-11-111-1110 -> A1110, A-1-11-112 -> A112, A -> A
 */
export function convertToApiCode(code: string): string {
  const parts = code.split('-');
  
  // Level 1 case: just "A", "B", etc. - return as-is
  if (parts.length === 1) return code;
  
  // Multi-level case: combine first + last
  const level1 = parts[0]; // First part (e.g., "A")
  const levelLast = parts[parts.length - 1]; // Last part (e.g., "1110")
  
  return `${level1}${levelLast}`;
}

/**
 * Parse single industry line: "CODE-Tên ngành: NAME"
 */
export function parseIndustryLine(line: string): IndustryLevel | null {
  const parts = line.split('Tên ngành:');
  if (parts.length !== 2) return null;
  
  const code = parts[0].replace(/-$/, '').trim(); // Remove trailing dash
  const name = parts[1].trim();
  
  if (!code || !name) return null;
  
  const level = detectLevel(code);
  const apiCode = convertToApiCode(code);
  
  return {
    code,
    name,
    level,
    fullName: `${code}: ${name}`,
    apiCode
  };
}

/**
 * All industry data - copied directly from name.txt
 */
// Import raw text file using Vite's ?raw suffix
import industryDataRaw from '../../../name.txt?raw';

export const INDUSTRY_DATA = industryDataRaw
  .split('\n')
  .filter((line: string) => line.trim() !== '')
  .map((line: string) => line.trim());

/**
 * Get all parsed industries
 */
export function getAllIndustries(): IndustryLevel[] {
  const industries: IndustryLevel[] = [];
  
  for (const line of INDUSTRY_DATA) {
    const industry = parseIndustryLine(line);
    if (industry) {
      industries.push(industry);
    }
  }
  
  // Sort by level first, then by code
  return industries.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return a.code.localeCompare(b.code);
  });
}

/**
 * Filter industries by search term
 */
export function filterIndustries(industries: IndustryLevel[], searchTerm: string): IndustryLevel[] {
  if (!searchTerm.trim()) {
    return industries;
  }

  const term = searchTerm.toLowerCase();
  return industries.filter(industry => 
    industry.code.toLowerCase().includes(term) ||
    industry.name.toLowerCase().includes(term) ||
    industry.fullName.toLowerCase().includes(term)
  );
}

/**
 * Get industries grouped by level
 */
export function getIndustriesByLevel(industries: IndustryLevel[]): Record<number, IndustryLevel[]> {
  const grouped: Record<number, IndustryLevel[]> = {};
  
  for (const industry of industries) {
    if (!grouped[industry.level]) {
      grouped[industry.level] = [];
    }
    grouped[industry.level].push(industry);
  }
  
  return grouped;
}
