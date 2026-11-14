import { TOOLS, type ToolDef } from "./tools";

export interface SearchResult {
  results: ToolDef[];
  /** true when nothing matched strictly and we fell back to closest matches */
  close: boolean;
}

/**
 * The FreeSeak search engine — client-side, instant, synonym-aware.
 * People search in verbs and problems ("make an image smaller"), not
 * tool names, so every tool carries a keyword map in the catalogue.
 */
export function searchTools(query: string): SearchResult {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { results: [], close: false };

  const strict = TOOLS.map((tool) => {
    const hay = (tool.name + " " + tool.short + " " + tool.keywords).toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (hay.includes(tok)) score += 1;
      else return { tool, score: -1 };
    }
    if (tool.name.toLowerCase().startsWith(tokens[0])) score += 0.5;
    return { tool, score };
  })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (strict.length > 0) {
    return { results: strict.slice(0, 6).map((x) => x.tool), close: false };
  }

  const loose = TOOLS.filter((tool) => {
    const hay = (tool.name + " " + tool.keywords).toLowerCase();
    return tokens.some((tok) => hay.includes(tok));
  }).slice(0, 5);

  return { results: loose, close: true };
}
