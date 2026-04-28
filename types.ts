export type ExecutionMode = 'agent' | 'plan';

export type CellType = 'code' | 'markdown' | 'query';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'fixing' | 'recovering';

export interface CellData {
  id: string;
  type: CellType;
  content: string;
  output?: string;
  status: ExecutionStatus;
  executionCount?: number;
  lastRun?: number; // Timestamp
  plots?: any[];
  metadata?: Record<string, any>;
}

export interface NotebookResponse {
  cells: CellData[];
  error?: string;
  clarification?: string;
}

export interface GeminiResponse {
  text: string;
  error?: string;
}

export type ConnectorHealthStatus = 'idle' | 'testing' | 'healthy' | 'error';

export interface ConnectorConfig {
  id: string;
  label: string;
  description: string;
  url: string;
  enabled: boolean;
  status?: ConnectorHealthStatus;
  statusMessage?: string;
  tokenHint?: string;
}

export interface SkillInfo {
  name: string;
  summary?: string;
  autoActivate: boolean;
  instructions?: string;
  showInstructions?: boolean;
  loadingInstructions?: boolean;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  connectors: string[];
  skills: string[];
}
