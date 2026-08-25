import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { CellData, CellType, ExecutionMode, ConnectorConfig } from "../types";
import { executeCode, generateNotebookStructure, interruptExecution } from "../services/aiService";
import { VMLAgent } from "../services/vmlAgent";
import {
  QueryHistoryEntry,
  syncQueryIndexes,
  reconcileQueryCells,
  extractLatestTrainingMetrics,
} from "../utils/notebookUtils";

export function useNotebook(
  connectorSettings: ConnectorConfig[],
  onTrainingProgress?: (updater: (prev: any) => any) => void
) {
  const [cells, setCells] = useState<CellData[]>([]);
  const cellsRef = useRef<CellData[]>([]);
  const queryHistoryRef = useRef<QueryHistoryEntry[]>([]);

  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [thinkingHistory, setThinkingHistory] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const stopExecutionRef = useRef(false);
  const stopAgentRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  const handleCellFocus = (id: string) => {
    setActiveCellId(id);
  };

  const addCell = (type: CellType, index?: number) => {
    const newCell: CellData = {
      id: uuidv4(),
      type,
      content: "",
      status: "idle",
    };

    setCells((prev) => {
      const updated = [...prev];
      if (typeof index === "number" && index >= 0) {
        updated.splice(index, 0, newCell);
      } else {
        updated.push(newCell);
      }
      return updated;
    });
    setActiveCellId(newCell.id);
  };

  const updateCellContent = (id: string, content: string) => {
    setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, content } : cell))
    );
  };

  const updateCellType = (id: string, type: CellType) => {
    setCells((prev) =>
      prev.map((cell) => (cell.id === id ? { ...cell, type } : cell))
    );
  };

  const deleteCell = (id: string) => {
    setCells((prev) => prev.filter((cell) => cell.id !== id));
    if (activeCellId === id) setActiveCellId(null);
  };

  const clearAll = () => {
    setCells([]);
    setHistory([]);
    setClarification(null);
    setThinking(null);
    stopExecutionRef.current = true;
    setIsAutoRunning(false);
    queryHistoryRef.current = [];
  };

  const moveCell = (id: string, direction: "up" | "down") => {
    setCells((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newCells = [...prev];
      const [moved] = newCells.splice(index, 1);
      newCells.splice(targetIndex, 0, moved);
      return newCells;
    });
  };

  const executeSingleCell = async (
    id: string
  ): Promise<{ success: boolean; output: string }> => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "running", output: "" } : c
      )
    );

    const cell = cellsRef.current.find((c) => c.id === id);
    if (!cell) return { success: false, output: "Cell not found" };

    const localResult = await executeCode(
      cell.content,
      (partial) => {
        // Extract latest step and loss from terminal output stream
        const match = cell.content.match(/max_steps\s*=\s*(\d+)/i);
        const cellMaxSteps = match ? parseInt(match[1], 10) : undefined;
        const metrics = extractLatestTrainingMetrics(partial);

        if (onTrainingProgress && (metrics.step !== undefined || metrics.loss !== undefined)) {
          onTrainingProgress((prev: any) => {
            const total = cellMaxSteps || metrics.totalSteps || prev?.totalSteps || 50;
            const step = metrics.step !== undefined ? metrics.step : (prev?.currentStep || 0);
            const loss = metrics.loss !== undefined ? metrics.loss : prev?.loss;
            const pct = Math.min(100, Math.round((step / total) * 100));
            return {
              currentStep: step,
              totalSteps: total,
              loss: loss !== undefined ? loss : prev?.loss,
              percentage: pct,
              modelName: prev?.modelName || "Training Model",
              isCompleted: false,
            };
          });
        }

        setCells((prev) =>
          prev.map((c) => (c.id === id ? { ...c, output: partial } : c))
        );
      },
      (plotPoint) => {
        const match = cell.content.match(/max_steps\s*=\s*(\d+)/i);
        const cellMaxSteps = match ? parseInt(match[1], 10) : undefined;
        if (!plotPoint.vml_total_steps && cellMaxSteps) {
          plotPoint.vml_total_steps = cellMaxSteps;
        }
        plotPoint.timestamp = Date.now();

        const total = cellMaxSteps || plotPoint.vml_total_steps || plotPoint.max_steps || plotPoint.total_steps || 50;
        const step = plotPoint.vml_step ?? plotPoint.step ?? plotPoint.global_step ?? 0;
        const pct = Math.min(100, Math.round((step / total) * 100));
        const lossVal = typeof plotPoint.loss === "number"
          ? Number(plotPoint.loss.toFixed(4))
          : typeof plotPoint.train_loss === "number"
          ? Number(plotPoint.train_loss.toFixed(4))
          : undefined;

        if (onTrainingProgress && step > 0) {
          onTrainingProgress((prev: any) => ({
            currentStep: step,
            totalSteps: total,
            loss: lossVal !== undefined ? lossVal : prev?.loss,
            percentage: pct,
            modelName: prev?.modelName || "Training Model",
            isCompleted: step >= total && total > 0,
          }));
        }

        setCells((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, plots: [...(c.plots || []), plotPoint] } : c
          )
        );
      }
    );

    setCells((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: localResult.error ? "error" : "success",
              output: localResult.error || localResult.text,
              executionCount: (c.executionCount || 0) + 1,
              lastRun: Date.now(),
            }
          : c
      )
    );

    return {
      success: !localResult.error,
      output: localResult.error || localResult.text,
    };
  };

  const handleManualRun = async (id: string) => {
    await executeSingleCell(id);
  };

  const handleStop = async () => {
    stopExecutionRef.current = true;
    stopAgentRef.current = true;
    setIsAutoRunning(false);
    setIsGenerating(false);
    setThinking(null);
    await interruptExecution();
    setCells((prev) =>
      prev.map((c) =>
        c.status === "running"
          ? {
              ...c,
              status: "error",
              output: (c.output || "") + "\n\n[🛑 EXECUTION STOPPED BY USER]",
            }
          : c
      )
    );
  };

  const submitPrompt = async (
    userPrompt: string,
    mode: ExecutionMode
  ) => {
    if (isGenerating) {
      handleStop();
      return;
    }
    if (!userPrompt.trim()) return;
    setIsGenerating(true);
    setThinking("Analysing your request and preparing a plan...");
    setClarification(null);
    stopAgentRef.current = false;

    const queryCell: CellData = {
      id: uuidv4(),
      type: "query",
      content: userPrompt,
      status: "success",
    };

    setCells((prev) => {
      const updated = [...prev, queryCell];
      cellsRef.current = updated;
      queryHistoryRef.current = queryHistoryRef.current.filter(
        (entry) => entry.cell.id !== queryCell.id
      );
      queryHistoryRef.current.push({ cell: queryCell, index: updated.length - 1 });
      queryHistoryRef.current = syncQueryIndexes(queryHistoryRef.current, updated);
      return updated;
    });

    if (mode === "agent") {
      setThinkingHistory([]);
      const agent = new VMLAgent(
        cellsRef.current,
        (text) => {
          setThinking(text);
          setThinkingHistory((prev) => [...prev, text]);
        },
        (updatedCells) => {
          const { reconciledCells, updatedHistory } = reconcileQueryCells(
            queryHistoryRef.current,
            updatedCells
          );
          queryHistoryRef.current = updatedHistory;
          setCells(reconciledCells);
          cellsRef.current = reconciledCells;
        },
        connectorSettings,
        () => stopAgentRef.current
      );

      if (history.length > 0) {
        agent.setHistory(history);
      }

      try {
        await agent.init();
        await agent.process(userPrompt);
        setHistory(agent.getHistory());
      } catch (error: any) {
        setCells((prev) => [
          ...prev,
          {
            id: uuidv4(),
            type: "markdown",
            content: `**Agent Error:** ${error.message}`,
            status: "error",
          },
        ]);
      } finally {
        setIsGenerating(false);
        setIsAutoRunning(false);
      }
      return;
    }

    // Default 'plan' mode
    const result = await generateNotebookStructure(userPrompt, mode);

    if (result.clarification) {
      setClarification(result.clarification);
      setIsGenerating(false);
      return;
    }

    if (result.cells && result.cells.length > 0) {
      const newCells: CellData[] = result.cells.map((c) => ({
        id: uuidv4(),
        type: c.type,
        content: c.content,
        status: "idle",
      }));

      setCells((prev) => {
        const updated = [...prev, ...newCells];
        cellsRef.current = updated;
        queryHistoryRef.current = syncQueryIndexes(queryHistoryRef.current, updated);
        return updated;
      });
    } else if (result.error) {
      setCells((prev) => [
        ...prev,
        {
          id: uuidv4(),
          type: "markdown",
          content: `**Error generating plan:** ${result.error}`,
          status: "error",
        },
      ]);
    }
    setIsGenerating(false);
  };

  return {
    cells,
    setCells,
    cellsRef,
    activeCellId,
    setActiveCellId,
    isGenerating,
    setIsGenerating,
    isAutoRunning,
    setIsAutoRunning,
    clarification,
    setClarification,
    thinking,
    setThinking,
    thinkingHistory,
    setThinkingHistory,
    history,
    setHistory,
    handleCellFocus,
    addCell,
    updateCellContent,
    updateCellType,
    deleteCell,
    clearAll,
    moveCell,
    executeSingleCell,
    handleManualRun,
    handleStop,
    submitPrompt,
  };
}
