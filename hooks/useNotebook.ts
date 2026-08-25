import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { CellData, CellType, ExecutionMode, ConnectorConfig } from "../types";
import { executeCode, generateNotebookStructure } from "../services/aiService";
import { VMLAgent } from "../services/vmlAgent";
import {
  QueryHistoryEntry,
  syncQueryIndexes,
  reconcileQueryCells,
} from "../utils/notebookUtils";

export function useNotebook(connectorSettings: ConnectorConfig[]) {
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
      const newCells = [...prev];
      const insertAt = index !== undefined ? index : prev.length;
      newCells.splice(insertAt, 0, newCell);
      return newCells;
    });
    setActiveCellId(newCell.id);
  };

  const updateCellContent = (id: string, content: string) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  const updateCellType = (id: string, type: CellType) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, type, output: undefined, status: "idle" } : c
      )
    );
  };

  const deleteCell = (id: string) => {
    if (activeCellId === id) setActiveCellId(null);
    setCells((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      cellsRef.current = updated;
      queryHistoryRef.current = queryHistoryRef.current.filter(
        (entry) => entry.cell.id !== id
      );
      queryHistoryRef.current = syncQueryIndexes(queryHistoryRef.current, updated);
      return updated;
    });
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
    const index = cells.findIndex((c) => c.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === cells.length - 1) return;

    const newCells = [...cells];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newCells[index], newCells[targetIndex]] = [
      newCells[targetIndex],
      newCells[index],
    ];
    setCells(newCells);
  };

  const executeSingleCell = async (
    id: string
  ): Promise<{ success: boolean; output: string }> => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "running", output: undefined } : c
      )
    );

    const cell = cellsRef.current.find((c) => c.id === id);
    if (!cell) return { success: false, output: "Cell not found" };

    const localResult = await executeCode(
      cell.content,
      (partial) => {
        setCells((prev) =>
          prev.map((c) => (c.id === id ? { ...c, output: partial } : c))
        );
      },
      (plotPoint) => {
        if (!plotPoint.vml_total_steps) {
          const match = cell.content.match(/max_steps=(\d+)/);
          if (match) plotPoint.vml_total_steps = parseInt(match[1]);
        }
        plotPoint.timestamp = Date.now();

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

  const handleStop = () => {
    stopExecutionRef.current = true;
    stopAgentRef.current = true;
    setIsAutoRunning(false);
    setIsGenerating(false);
    setThinking(null);
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
