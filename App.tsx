import React, { useEffect, useState } from "react";
import ManageSkillsPanel from "./components/ManageSkillsPanel";
import { KnowledgeLibrary } from "./components/KnowledgeLibrary";
import { ThinkingView } from "./components/ThinkingView";
import { ChatView } from "./components/ChatView";
import { CreativeStudio } from "./components/CreativeStudio";
import { AppHeader } from "./components/AppHeader";
import { WorkflowView } from "./components/WorkflowView";
import { StudioView } from "./components/StudioView";
import { useNotebook } from "./hooks/useNotebook";
import { useSkillsAndConnectors } from "./hooks/useSkillsAndConnectors";
import { useDistillation } from "./hooks/useDistillation";
import { useWorkflows } from "./hooks/useWorkflows";
import { fetchSystemSpecs } from "./utils/apiUtils";

export default function App() {
  const [activeView, setActiveView] = useState<
    "studio" | "chat" | "workflow" | "knowledge" | "creative"
  >("chat");
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
  } = useNotebook(connectorSettings);

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
    isWorkflowExecuting,
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
    handleStartSFT,
    handleStartQuantization,
    handleStartOnnx,
    handleStartGeneration,
  } = useWorkflows({
    setCells,
    setActiveView,
    setThinking,
    setThinkingHistory,
    mode: "agent",
  });

  useEffect(() => {
    fetchSystemSpecs().then((info) => {
      if (info) setSystemInfo(info);
    });
  }, []);

  const handleOpenArena = (modelId?: string) => {
    if (modelId) setChatSelectedModel(modelId);
    setActiveView("chat");
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
        setActiveView={setActiveView}
        isAutoRunning={isAutoRunning}
        onStopAutoPilot={handleStop}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {activeView === "chat" ? (
          <ChatView
            selectedModel={chatSelectedModel}
            onModelChange={setChatSelectedModel}
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
        ) : activeView === "workflow" ? (
          <WorkflowView
            workflowMode={workflowMode}
            setWorkflowMode={setWorkflowMode}
            isWorkflowExecuting={isWorkflowExecuting}
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
            setHardware={setSftHardware}
            sftMaxSteps={sftMaxSteps}
            setMaxSteps={setSftMaxSteps}
            sftRank={sftRank}
            setRank={setSftRank}
            onStartSFT={handleStartSFT}
            onStartQuantization={handleStartQuantization}
            onStartOnnx={handleStartOnnx}
            onNavigateToChat={handleOpenArena}
            onNavigateToCreative={() => setActiveView("creative")}
          />
        ) : (
          <StudioView
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
            onOpenArena={handleOpenArena}
            onDismissClarification={() => setClarification(null)}
          />
        )}
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
