import { CellData } from "../types";

export interface QueryHistoryEntry {
  cell: CellData;
  index: number;
}

/**
 * Formats the current notebook cells and reasoning log into a clean Markdown report.
 */
export function formatNotebookContext(
  cells: CellData[],
  thinkingHistory: string[] = []
): string {
  let context = "# VML STUDIO WORKFLOW REPORT\n\n";

  if (thinkingHistory.length > 0) {
    context += "## AGENT REASONING LOG\n";
    thinkingHistory.forEach((t, i) => {
      context += `${i + 1}. ${t}\n`;
    });
    context += "\n---\n\n";
  }

  cells.forEach((cell, index) => {
    context += `## CELL ${index + 1} (${cell.type.toUpperCase()})\n`;
    context += `**Status**: ${cell.status}\n\n`;
    context += `### CONTENT\n\`\`\`${
      cell.type === "code" ? "python" : "markdown"
    }\n${cell.content}\n\`\`\`\n\n`;
    if (cell.output) {
      context += `### OUTPUT\n\`\`\`text\n${cell.output}\n\`\`\`\n\n`;
    }
    context += "---\n\n";
  });

  return context;
}

/**
 * Syncs query cell indices with latest cells state.
 */
export function syncQueryIndexes(
  queryHistory: QueryHistoryEntry[],
  cells: CellData[]
): QueryHistoryEntry[] {
  const updated = queryHistory
    .map((entry) => {
      const newIndex = cells.findIndex((cell) => cell.id === entry.cell.id);
      if (newIndex === -1) return null;
      return { ...entry, index: newIndex };
    })
    .filter((entry): entry is QueryHistoryEntry => entry !== null);

  const seen = new Set<string>();
  return updated.filter((entry) => {
    if (seen.has(entry.cell.id)) return false;
    seen.add(entry.cell.id);
    return true;
  });
}

/**
 * Reconciles query cells from history into candidate cells from agent processing.
 */
export function reconcileQueryCells(
  queryHistory: QueryHistoryEntry[],
  candidateCells: CellData[]
): { reconciledCells: CellData[]; updatedHistory: QueryHistoryEntry[] } {
  const merged = [...candidateCells];
  const missingHistory = queryHistory.filter(
    (entry) => !merged.some((cell) => cell.id === entry.cell.id)
  );

  missingHistory.forEach((entry) => {
    const insertIndex = Math.max(0, Math.min(entry.index, merged.length));
    merged.splice(insertIndex, 0, entry.cell);
  });

  const deduped: CellData[] = [];
  const seen = new Set<string>();
  merged.forEach((cell) => {
    if (seen.has(cell.id)) return;
    seen.add(cell.id);
    deduped.push(cell);
  });

  const updatedHistory = syncQueryIndexes(queryHistory, deduped);
  return { reconciledCells: deduped, updatedHistory };
}
