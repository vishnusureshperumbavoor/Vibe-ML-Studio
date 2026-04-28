import React from "react";
import { ConnectorConfig, SkillInfo, PluginDefinition } from "../types";

interface ConnectorPanelProps {
  connectors: ConnectorConfig[];
  onToggleConnector: (id: string) => void;
  onUpdateConnectorUrl: (id: string, url: string) => void;
  onTestConnector: (id: string) => Promise<void>;
  skills: SkillInfo[];
  onToggleSkill: (name: string) => void;
  onViewSkillInstructions: (name: string) => void;
  plugins: PluginDefinition[];
  pluginStates: Record<string, boolean>;
  onTogglePlugin: (pluginId: string) => void;
}

const statusText: Record<string, string> = {
  idle: "Idle",
  testing: "Checking…",
  healthy: "Connected",
  error: "Error",
};

const statusClasses: Record<string, string> = {
  idle: "bg-white/10 text-white",
  testing: "bg-purple-500/20 text-purple-200",
  healthy: "bg-emerald-500/20 text-emerald-200",
  error: "bg-red-500/20 text-red-200",
};

export const ConnectorPanel: React.FC<ConnectorPanelProps> = ({
  connectors,
  onToggleConnector,
  onUpdateConnectorUrl,
  onTestConnector,
  skills,
  onToggleSkill,
  onViewSkillInstructions,
  plugins,
  pluginStates,
  onTogglePlugin,
}) => {
  return (
    <div className="flex flex-col gap-6 p-4 text-sm text-white">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">Connectors</p>
            <p className="text-xs text-slate-400">
              Toggle which MCP bridges are exposed to the agent.
            </p>
          </div>
        </div>

        {connectors.map((conn) => {
          const currentStatus = conn.status || "idle";
          return (
            <div
              key={conn.id}
              className="rounded-2xl border border-white/5 bg-[#0F0B16]/80 p-3 shadow-lg shadow-black/30"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{conn.label}</p>
                  <p className="text-xs text-slate-400">{conn.description}</p>
                </div>
                <button
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                    conn.enabled
                      ? "border-emerald-500/50 text-emerald-300"
                      : "border-white/20 text-white/70"
                  }`}
                  onClick={() => onToggleConnector(conn.id)}
                >
                  {conn.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[
                    currentStatus
                  ]}`}
                >
                  {statusText[currentStatus] || currentStatus}
                </span>
                {conn.statusMessage && (
                  <span className="text-[11px] text-slate-400">
                    {conn.statusMessage}
                  </span>
                )}
                {conn.lastChecked && (
                  <span className="ml-auto text-[10px] text-slate-500">
                    {conn.lastChecked}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500">
                  MCP URL
                </label>
                <input
                  className="rounded-lg border border-white/10 bg-[#11051C] px-2 py-1 text-xs text-white focus:border-purple-400 focus:outline-none"
                  value={conn.url}
                  onChange={(event) =>
                    onUpdateConnectorUrl(conn.id, event.target.value)
                  }
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-lg border border-white/20 px-3 py-1 text-[11px] font-semibold text-white transition hover:border-purple-500/70 hover:text-purple-300"
                  onClick={() => onTestConnector(conn.id)}
                >
                  Test connection
                </button>
                <p className="text-[11px] text-slate-400">
                  {conn.tokenHint || "Tokens are configured in the backend (.env)"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">Skills</p>
            <p className="text-xs text-slate-400">
              Skills that can be auto-activated based on intent.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="rounded-2xl border border-white/5 bg-[#0F0B16]/80 p-3 shadow-lg shadow-black/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{skill.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {skill.summary || "Instructions available in SKILLS.md"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase transition ${
                      skill.autoActivate
                        ? "border-emerald-400 text-emerald-300"
                        : "border-white/20 text-white/70"
                    }`}
                    onClick={() => onToggleSkill(skill.name)}
                  >
                    Auto {skill.autoActivate ? "On" : "Off"}
                  </button>
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase text-white/90 transition hover:border-purple-400 hover:text-purple-200"
                    onClick={() => onViewSkillInstructions(skill.name)}
                  >
                    {skill.showInstructions ? "Hide" : "View"}
                  </button>
                </div>
              </div>
              {skill.showInstructions && (
                <div className="mt-3 rounded-xl border border-purple-500/50 bg-purple-500/5 p-2 text-[11px] text-slate-100">
                  {skill.loadingInstructions ? (
                    <p>Loading instructions…</p>
                  ) : (
                    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">
                      {skill.instructions}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">Plugins</p>
            <p className="text-xs text-slate-400">
              Group connectors and skills into reusable bundles.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="rounded-2xl border border-dashed border-white/10 bg-[#0F0B16]/80 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{plugin.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {plugin.description}
                  </p>
                </div>
                <button
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase transition ${
                    pluginStates[plugin.id]
                      ? "border-emerald-400 text-emerald-300"
                      : "border-white/20 text-white/70"
                  }`}
                  onClick={() => onTogglePlugin(plugin.id)}
                >
                  {pluginStates[plugin.id] ? "Active" : "Disabled"}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Connectors: {plugin.connectors.join(", ")} · Skills:{" "}
                {plugin.skills.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectorPanel;
