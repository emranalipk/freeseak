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
 *
 * v0.9.1: split in two — searchAllTools returns every strict match
 * (the homepage index filters the whole catalogue, so "pdf" must show
 * all eleven PDF tools) while searchTools keeps the shortlist the
 * command palette wants.
 */
export function searchTools(query: string): SearchResult {
  const { results, close } = searchAllTools(query);
  return {
    results: close ? results.slice(0, 5) : results.slice(0, 6),
    close,
  };
}

export function searchAllTools(query: string): SearchResult {
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
    return { results: strict.map((x) => x.tool), close: false };
  }

  const loose = TOOLS.filter((tool) => {
    const hay = (tool.name + " " + tool.keywords).toLowerCase();
    return tokens.some((tok) => hay.includes(tok));
  });

  return { results: loose, close: true };
}
