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

/**
 * Robustly extracts the latest step, total steps, and loss from streaming terminal output.
 * Scans globally to guarantee the most recent metrics at the end of the buffer are captured.
 */
export function extractLatestTrainingMetrics(text: string): {
  step?: number;
  totalSteps?: number;
  loss?: number;
} {
  if (!text) return {};

  let latestStep: number | undefined;
  let latestTotalSteps: number | undefined;
  let latestLoss: number | undefined;

  let m: RegExpExecArray | null;

  // 1. Tqdm / HuggingFace progress bar: e.g. "  7/50 [00:12<01:15, ..."
  const progressRegex = /(\d+)\s*\/\s*(\d+)\s*\[/g;
  while ((m = progressRegex.exec(text)) !== null) {
    const s = parseInt(m[1], 10);
    const t = parseInt(m[2], 10);
    if (!isNaN(s) && !isNaN(t) && t > 0) {
      latestStep = s;
      latestTotalSteps = t;
    }
  }

  // 2. Explicit "Step X / Y" or "Step X of Y" or multi-line "Step\nX / Y"
  const stepSlashRegex = /Step\s*[:\n\r\s]+(\d+)\s*(?:\/|\sof\s)\s*(\d+)/gi;
  while ((m = stepSlashRegex.exec(text)) !== null) {
    const s = parseInt(m[1], 10);
    const t = parseInt(m[2], 10);
    if (!isNaN(s) && !isNaN(t) && t > 0) {
      latestStep = s;
      latestTotalSteps = t;
    }
  }

  // 3. JSON / Dict output from HuggingFace Trainer callbacks:
  // e.g. {'loss': 1.45, 'learning_rate': ..., 'step': 7}
  const jsonStepRegex = /['"]?(?:vml_step|step|global_step)['"]?\s*[:=]\s*(\d+)/gi;
  while ((m = jsonStepRegex.exec(text)) !== null) {
    const s = parseInt(m[1], 10);
    if (!isNaN(s)) {
      latestStep = s;
    }
  }

  const jsonTotalRegex = /['"]?(?:vml_total_steps|max_steps|total_steps)['"]?\s*[:=]\s*(\d+)/gi;
  while ((m = jsonTotalRegex.exec(text)) !== null) {
    const t = parseInt(m[1], 10);
    if (!isNaN(t) && t > 0) {
      latestTotalSteps = t;
    }
  }

  // 4. Loss matching:
  const lossRegex = /['"]?(?:loss|train_loss)['"]?\s*[:=]\s*([\d.]+)/gi;
  while ((m = lossRegex.exec(text)) !== null) {
    const l = parseFloat(m[1]);
    if (!isNaN(l)) {
      latestLoss = parseFloat(l.toFixed(4));
    }
  }

  return {
    step: latestStep,
    totalSteps: latestTotalSteps,
    loss: latestLoss,
  };
}
