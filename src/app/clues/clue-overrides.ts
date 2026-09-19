// Clue overrides -- see src/tools/clue-curation-spec.md (Lever 1).
// Checked first in buildClueMaps() before falling back to the weekday clue
// arrays. Most obscure-proper-noun answers were removed from the pool
// entirely via the DENYLIST in generate-chains.mjs (Lever 3) instead -- this
// file now only covers the small set of answers that stayed in the pool
// (common/recognizable names, or words with an unrelated everyday meaning)
// but whose first-occurrence clue still leans on name recall unnecessarily.

export interface ClueOverride {
  clueNumber: number;
  clue: string;
}

export const clueOverrides: Record<string, ClueOverride> = {
  ELLIE: { clueNumber: 23, clue: "Common nickname for Eleanor" },
  MARIO: { clueNumber: 14, clue: "Video game lover of Princess Peach" },
  MISSY: { clueNumber: 55, clue: "Term of address for a young lady" },
  PAIGE: { clueNumber: 61, clue: "Common feminine given name, also a term for a knight's young attendant" },
  PEELE: { clueNumber: 42, clue: "\"Get Out\" director" },
  SERIF: { clueNumber: 103, clue: "Font flourish" },
  SISSY: { clueNumber: 30, clue: "Wimp, informally" },
  SUSIE: { clueNumber: 12, clue: "Common nickname for Susan" },
};
