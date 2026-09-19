// Clue overrides -- see src/tools/clue-curation-spec.md (Lever 1).
// Checked first in buildClueMaps() before falling back to the weekday clue
// arrays. Obscure-proper-noun answers were removed from the pool entirely
// via the DENYLIST in generate-chains.mjs (Lever 3) instead. This file is
// reserved for answers that stayed in the pool but whose clue was explicitly
// requested to change -- it does not re-curate clue text for every kept
// answer, since a kept answer's existing clue was judged fine as-is.

export interface ClueOverride {
  clueNumber: number;
  clue: string;
}

export const clueOverrides: Record<string, ClueOverride> = {
  MARIO: { clueNumber: 14, clue: "Video game lover of Princess Peach" },
};
