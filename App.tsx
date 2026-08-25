import { useEffect, useState, useRef } from "react";
import ManageSkillsPanel from "./components/ManageSkillsPanel";
import { KnowledgeLibrary } from "./components/KnowledgeLibrary";
import { ThinkingView } from "./components/ThinkingView";
import { CreativeStudio } from "./components/CreativeStudio";
import { AppHeader, TopLevelView } from "./components/AppHeader";
import { WorkflowView } from "./components/WorkflowView";
import { ModelGallery } from "./components/ModelGallery";
import { QuantizationPanel } from "./components/QuantizationPanel";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { OnnxPanel } from "./components/OnnxPanel";
import { useNotebook } from "./hooks/useNotebook";
import { useSkillsAndConnectors } from "./hooks/useSkillsAndConnectors";
import { useDistillation } from "./hooks/useDistillation";
import { useWorkflows } from "./hooks/useWorkflows";
import { fetchSystemSpecs } from "./utils/apiUtils";
import { interruptExecution } from "./services/aiService";

export default function App() {
  const [activeView, setActiveView] = useState<TopLevelView>("gallery");
  const [chatSelectedModel, setChatSelectedModel] = useState<string>("");
  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Custom Hooks for Modular Architecture
  const {
    skills,
    connectorSettings,
    pluginStates,
    selectedSkillName,
    showManageSkills,
    manageTab,
    setShowManageSkills,
    setManageTab,
    handleToggleConnector,
    handleUpdateConnectorUrl,
    handleTestConnector,
    handleToggleSkillAutoActivate,
    handleViewSkillInstructions,
    handleSelectSkill,
    handleTogglePlugin,
    pluginDefinitions,
  } = useSkillsAndConnectors();

  const trainingProgressRef = useRef<any>(null);

  const {
    cells,
    setCells,
    activeCellId,
    isGenerating,
    isAutoRunning,
    clarification,
    setClarification,
    thinking,
    setThinking,
    thinkingHistory,
    setThinkingHistory,
    handleCellFocus,
    updateCellContent,
    updateCellType,
    deleteCell,
    moveCell,
    handleManualRun,
    handleStop,
  } = useNotebook(connectorSettings, (updater) => trainingProgressRef.current?.(updater));

  const {
    distillStatus,
    setDistillStatus,
    showDistillUI,
    setShowDistillUI,
    preSelectedDataset,
    setPreSelectedDataset,
  } = useDistillation();

  const {
    workflowMode,
    setWorkflowMode,
    isSftExecuting,
    isQuantizing,
    isOnnxExecuting,
    trainingProgress,
    setTrainingProgress,
    deploymentUrl,
    workflowModelFilename,
    lastGeneratedImage,
    activeTrainingSession,
    sftModelId,
    setSftModelId,
    sftDatasetId,
    setSftDatasetId,
    sftHardware,
    setSftHardware,
    sftMaxSteps,
    setSftMaxSteps,
    sftRank,
    setSftRank,
    sftPersona,
    setSftPersona,
    handleStartSFT,
    handleStartQuantization,
    handleStartOnnx,
    handleStartGeneration,
    handleStopWorkflow,
  } = useWorkflows({
    setCells,
    setActiveView,
    setThinking,
    setThinkingHistory,
    mode: "agent",
  });

  trainingProgressRef.current = setTrainingProgress;

  useEffect(() => {
    // Reset any lingering background kernel process on fresh mount
    interruptExecution().catch(() => {});

    fetchSystemSpecs().then((info) => {
      if (info) setSystemInfo(info);
    });

    // Stop and interrupt active Python training immediately on page refresh or browser close
    const handleUnload = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("http://127.0.0.1:2000/interrupt");
        } else {
          fetch("http://127.0.0.1:2000/interrupt", {
            method: "POST",
            keepalive: true,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Unload interrupt failed:", e);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, []);

  const handleOpenChat = (modelId?: string) => {
    if (modelId) setChatSelectedModel(modelId);
    setActiveView("gallery");
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B090F] text-[#E2D8F0] font-sans selection:bg-purple-500/30">
      <ThinkingView
        content={thinking}
        isVisible={!!thinking}
        history={thinkingHistory}
        onClose={() => setThinking(null)}
      />

      <AppHeader
        activeView={activeView}
        setActiveView={(view) => {
          if (view === "gallery") {
            setChatSelectedModel("");
          }
          setActiveView(view);
        }}
        isAutoRunning={isAutoRunning}
        onStopAutoPilot={handleStop}
        trainingProgress={trainingProgress}
        onViewTraining={() => {
          setActiveView("workflow");
          setWorkflowMode("studio");
        }}
        onStopTraining={handleStopWorkflow}
        onOpenChat={handleOpenChat}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {activeView === "gallery" ? (
          <ModelGallery
            initialSelectedModel={chatSelectedModel}
            onNavigateToBuild={() => {
              setActiveView("workflow");
              setWorkflowMode("finetune");
            }}
          />
        ) : activeView === "knowledge" ? (
          <KnowledgeLibrary
            onDistillComplete={(id) => {
              setPreSelectedDataset(id);
              setActiveView("workflow");
            }}
            distillStatus={distillStatus}
            setDistillStatus={setDistillStatus}
            showDistillUI={showDistillUI}
            setShowDistillUI={setShowDistillUI}
          />
        ) : activeView === "creative" ? (
          <CreativeStudio
            onGenerate={handleStartGeneration}
            isGenerating={isGenerating}
            lastGeneratedImage={lastGeneratedImage}
          />
        ) : activeView === "workflow" || activeView === "studio" ? (
          <WorkflowView
            workflowMode={workflowMode}
            setWorkflowMode={setWorkflowMode}
            isWorkflowExecuting={isSftExecuting}
            systemInfo={systemInfo}
            preSelectedDataset={preSelectedDataset}
            onClearSelection={() => setPreSelectedDataset(null)}
            deploymentUrl={deploymentUrl}
            workflowModelFilename={workflowModelFilename}
            sftModelId={sftModelId}
            setSftModelId={setSftModelId}
            sftDatasetId={sftDatasetId}
            setSftDatasetId={setSftDatasetId}
            sftHardware={sftHardware}
            setSftHardware={setSftHardware}
            sftMaxSteps={sftMaxSteps}
            setSftMaxSteps={setSftMaxSteps}
            sftRank={sftRank}
            setSftRank={setSftRank}
            sftPersona={sftPersona}
            setSftPersona={setSftPersona}
            onStartSFT={handleStartSFT}
            onStopWorkflow={handleStopWorkflow}
            onNavigateToChat={handleOpenChat}
            cells={cells}
            activeCellId={activeCellId}
            isAutoRunning={isAutoRunning}
            isGenerating={isGenerating}
            clarification={clarification}
            activeTrainingSession={activeTrainingSession}
            thinkingHistory={thinkingHistory}
            onFocusCell={handleCellFocus}
            onChangeCell={updateCellContent}
            onRunCell={handleManualRun}
            onDeleteCell={deleteCell}
            onMoveUpCell={(id) => moveCell(id, "up")}
            onMoveDownCell={(id) => moveCell(id, "down")}
            onTypeChangeCell={updateCellType}
            onDismissClarification={() => setClarification(null)}
          />
        ) : activeView === "gguf" ? (
          <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-8 items-center space-y-8 w-full">
            <div className="text-center space-y-2 max-w-2xl shrink-0">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                GGUF Model Quantization
              </h2>
              <p className="text-sm text-white/40">Compress LLMs for fast local CPU & Edge execution.</p>
            </div>
            <div className="w-full max-w-3xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group shrink-0">
              <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />
              <QuantizationPanel
                onStart={handleStartQuantization}
                isExecuting={isQuantizing}
                deploymentUrl={deploymentUrl}
                onTestInArena={(filename) => {
                  handleOpenChat(filename || workflowModelFilename || undefined);
                }}
              />
            </div>
          </div>
        ) : activeView === "evaluate" ? (
          <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-8 items-center space-y-8 w-full">
            <div className="text-center space-y-2 max-w-2xl shrink-0">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                Model Evaluation & Benchmark
              </h2>
              <p className="text-sm text-white/40">Benchmark accuracy, perplexity, and reasoning capabilities.</p>
            </div>
            <div className="w-full max-w-4xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group shrink-0">
              <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />
              <BenchmarkPanel systemInfo={systemInfo} />
            </div>
          </div>
        ) : activeView === "onnx" ? (
          <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-8 items-center space-y-8 w-full">
            <div className="text-center space-y-2 max-w-2xl shrink-0">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                ONNX Web & Edge Runtime Export
              </h2>
              <p className="text-sm text-white/40">Export adapters for in-browser ONNX Runtime inference.</p>
            </div>
            <div className="w-full max-w-3xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group shrink-0">
              <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />
              <OnnxPanel
                onStart={handleStartOnnx}
                isExecuting={isOnnxExecuting}
              />
            </div>
          </div>
        ) : null}
      </div>

      <ManageSkillsPanel
        visible={showManageSkills}
        onClose={() => setShowManageSkills(false)}
        activeTab={manageTab}
        onChangeTab={(tab) => setManageTab(tab)}
        skills={skills}
        connectors={connectorSettings}
        pluginDefinitions={pluginDefinitions}
        pluginStates={pluginStates}
        selectedSkillName={selectedSkillName}
        onSelectSkill={handleSelectSkill}
        onToggleSkillAutoActivate={handleToggleSkillAutoActivate}
        onViewSkillInstructions={handleViewSkillInstructions}
        onToggleConnector={handleToggleConnector}
        onUpdateConnectorUrl={handleUpdateConnectorUrl}
        onTestConnector={handleTestConnector}
        onTogglePlugin={handleTogglePlugin}
      />
    </div>
  );
}
