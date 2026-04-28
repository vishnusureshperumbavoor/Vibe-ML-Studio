import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Search, X } from "lucide-react";
import { ConnectorConfig, PluginDefinition, SkillInfo } from "../types";

type ManageTab = "skills" | "connectors";

interface ManageSkillsPanelProps {
  visible: boolean;
  onClose: () => void;
  activeTab: ManageTab;
  onChangeTab: (tab: ManageTab) => void;
  skills: SkillInfo[];
  connectors: ConnectorConfig[];
  pluginDefinitions: PluginDefinition[];
  pluginStates: Record<string, boolean>;
  selectedSkillName: string | null;
  onSelectSkill: (name: string) => void;
  onToggleSkillAutoActivate: (name: string) => void;
  onViewSkillInstructions: (name: string) => void;
  onToggleConnector: (id: string) => void;
  onUpdateConnectorUrl: (id: string, url: string) => void;
  onTestConnector: (id: string) => Promise<void>;
  onTogglePlugin: (pluginId: string) => void;
}

const statusText: Record<string, string> = {
  idle: "Idle",
  testing: "Checking…",
  healthy: "Connected",
  error: "Error",
};

export const ManageSkillsPanel: React.FC<ManageSkillsPanelProps> = ({
  visible,
  onClose,
  activeTab,
  onChangeTab,
  skills,
  connectors,
  pluginDefinitions,
  pluginStates,
  selectedSkillName,
  onSelectSkill,
  onToggleSkillAutoActivate,
  onViewSkillInstructions,
  onToggleConnector,
  onUpdateConnectorUrl,
  onTestConnector,
  onTogglePlugin,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    connectors[0]?.id ?? null,
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      return;
    }
  }, [visible]);

  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

  useEffect(() => {
    if (connectors.length === 0) {
      setSelectedConnectorId(null);
      return;
    }
    if (
      selectedConnectorId &&
      connectors.some((c) => c.id === selectedConnectorId)
    ) {
      return;
    }
    setSelectedConnectorId(connectors[0].id);
  }, [connectors, selectedConnectorId]);

  const filteredSkills = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return skills.filter((skill) => skill.name.toLowerCase().includes(term));
  }, [skills, searchQuery]);

  const filteredConnectors = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return connectors.filter(
      (connector) =>
        connector.label.toLowerCase().includes(term) ||
        connector.description.toLowerCase().includes(term),
    );
  }, [connectors, searchQuery]);

  const selectedSkill = skills.find(
    (skill) => skill.name === selectedSkillName,
  );
  const selectedConnector = connectors.find(
    (connector) => connector.id === selectedConnectorId,
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 h-[90vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-[#0B090F] shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Manage
              </p>
              <h2 className="text-lg font-semibold text-white">
                Skills & Connectors
              </h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-white/30 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <nav className="flex w-36 flex-col gap-1 border-r border-white/10 bg-[#100A18] px-4 py-6 text-sm text-slate-400">
              {["skills", "connectors"].map((tab) => {
                const active = activeTab === tab;
                return (
                <button
                  key={tab}
                  onClick={() => onChangeTab(tab as ManageTab)}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2 text-left font-semibold transition ${
                    active
                      ? "bg-purple-500/20 text-white"
                      : "hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="capitalize">{tab}</span>
                </button>
                );
              })}
            </nav>

            <section className="flex flex-1 flex-col overflow-hidden bg-[#0E0A19] min-h-0">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="rounded-full border border-white/10 bg-white/5 p-1">
                    <Search size={16} />
                  </div>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={
                      activeTab === "skills"
                        ? "Search skills"
                        : "Search connectors"
                    }
                    className="w-full bg-transparent text-sm placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  disabled
                  className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:border-white/5"
                  title="Coming soon"
                >
                  <Plus size={14} />
                  Add skill
                </button>
              </div>

              <div className="flex h-full min-h-0 overflow-hidden">
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                  {activeTab === "skills" &&
                    (filteredSkills.length ? (
                      filteredSkills.map((skill) => (
                        <div
                          key={skill.name}
                          onClick={() => onSelectSkill(skill.name)}
                          className={`cursor-pointer rounded-2xl border px-4 py-3 transition ${
                            selectedSkillName === skill.name
                              ? "border-purple-400 bg-purple-500/10"
                              : "border-white/5 bg-white/0"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {skill.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {skill.summary || "Personal skill"}
                              </p>
                            </div>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleSkillAutoActivate(skill.name);
                              }}
                              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase transition ${
                                skill.autoActivate
                                  ? "border-emerald-400 text-emerald-300"
                                  : "border-white/20 text-white/70"
                              }`}
                            >
                              Auto {skill.autoActivate ? "On" : "Off"}
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onViewSkillInstructions(skill.name);
                              }}
                              className="text-slate-200 underline-offset-4 transition hover:text-white"
                            >
                              {skill.showInstructions
                                ? "Hide instructions"
                                : "View instructions"}
                            </button>
                            <a
                              href={`skills/${skill.name}/SKILLS.md`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-slate-200 transition hover:text-white"
                            >
                              <ExternalLink size={12} />
                              SKILLS.md
                            </a>
                          </div>
                          {skill.showInstructions && (
                            <div className="mt-3 rounded-xl border border-purple-500/40 bg-[#1A1030] p-3 text-[11px] text-slate-200">
                              {skill.loadingInstructions ? (
                                "Loading instructions…"
                              ) : (
                                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                                  {skill.instructions ||
                                    "No instructions available"}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">
                        No skills match “{searchQuery}”.
                      </p>
                    ))}

                  {activeTab === "connectors" &&
                    (filteredConnectors.length ? (
                      filteredConnectors.map((connector) => {
                        const status = connector.status || "idle";
                        return (
                          <div
                            key={connector.id}
                            onClick={() => setSelectedConnectorId(connector.id)}
                            className={`rounded-2xl border px-4 py-3 transition ${
                              selectedConnectorId === connector.id
                                ? "border-purple-400 bg-purple-500/10"
                                : "border-white/5 bg-transparent"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {connector.label}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {connector.description}
                                </p>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleConnector(connector.id);
                                }}
                                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase transition ${
                                  connector.enabled
                                    ? "border-emerald-400 text-emerald-300"
                                    : "border-white/20 text-white/70"
                                }`}
                              >
                                {connector.enabled ? "Enabled" : "Disabled"}
                              </button>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  status === "healthy"
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : status === "error"
                                      ? "bg-red-500/20 text-red-200"
                                      : "bg-white/10 text-white/70"
                                }`}
                              >
                                {statusText[status] || status}
                              </span>
                              <span>{connector.statusMessage}</span>
                            </div>
                            <div className="mt-3 flex flex-col gap-2 text-[11px] text-slate-400">
                              <label className="text-[10px] uppercase tracking-wider text-slate-500">
                                MCP URL
                              </label>
                              <input
                                className="w-full rounded-lg border border-white/10 bg-[#11051C] px-2 py-1 text-xs text-white focus:border-purple-400 focus:outline-none"
                                value={connector.url}
                                onChange={(event) =>
                                  onUpdateConnectorUrl(
                                    connector.id,
                                    event.target.value,
                                  )
                                }
                                onClick={(event) => event.stopPropagation()}
                              />
                            </div>
                            <div className="mt-3 flex items-center gap-3 text-[11px]">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onTestConnector(connector.id);
                                }}
                                className="rounded-lg border border-white/20 px-3 py-1 text-[10px] font-semibold text-white transition hover:border-purple-500 hover:text-purple-200"
                              >
                                Test connection
                              </button>
                              <span className="text-slate-500">
                                {connector.tokenHint ||
                                  "Tokens configured in backend"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400">
                        No connectors match “{searchQuery}”.
                      </p>
                    ))}
                </div>

                <aside className="w-96 flex-shrink-0 border-l border-white/5 bg-[#120817] p-6 text-sm text-slate-200">
                  {activeTab === "skills" ? (
                    <>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Skill details
                      </p>
                      {selectedSkill ? (
                        <>
                          <h3 className="mt-3 text-lg font-semibold text-white">
                            {selectedSkill.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {selectedSkill.summary || "Personal skill metadata"}
                          </p>
                          <p className="mt-3 text-[12px] leading-relaxed text-slate-200">
                            {selectedSkill.instructions ||
                              "Toggle “View instructions” to load the latest SKILLS.md content."}
                          </p>
                          <div className="mt-4 space-y-2 text-[11px]">
                            <p>
                              Auto-activate:{" "}
                              <span
                                className={`font-semibold ${
                                  selectedSkill.autoActivate
                                    ? "text-emerald-300"
                                    : "text-slate-300"
                                }`}
                              >
                                {selectedSkill.autoActivate ? "On" : "Off"}
                              </span>
                            </p>
                            <p>
                              Instructions loaded:{" "}
                              <span className="font-semibold text-slate-200">
                                {selectedSkill.instructions ? "Yes" : "No"}
                              </span>
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-slate-400">
                          Select a skill to review its metadata and
                          instructions.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Connector overview
                      </p>
                      {selectedConnector ? (
                        <>
                          <h3 className="mt-3 text-lg font-semibold text-white">
                            {selectedConnector.label}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {selectedConnector.description}
                          </p>
                          <div className="mt-3 space-y-2 text-[12px] text-slate-200">
                            <p>
                              URL:{" "}
                              <span className="font-mono text-[11px] text-white">
                                {selectedConnector.url || "Not set"}
                              </span>
                            </p>
                            <p>
                              Status:{" "}
                              <span
                                className={`font-semibold ${
                                  selectedConnector.status === "healthy"
                                    ? "text-emerald-300"
                                    : selectedConnector.status === "error"
                                      ? "text-red-300"
                                      : "text-slate-300"
                                }`}
                              >
                                {selectedConnector.status
                                  ? statusText[selectedConnector.status]
                                  : "Idle"}
                              </span>
                            </p>
                            {selectedConnector.lastChecked && (
                              <p className="text-slate-400">
                                Last checked: {selectedConnector.lastChecked}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-slate-400">
                          Choose a connector to see its configuration details.
                        </p>
                      )}
                      <div className="mt-6 space-y-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          Plugins
                        </p>
                        {pluginDefinitions.map((plugin) => (
                          <div
                            key={plugin.id}
                            className="rounded-2xl border border-dashed border-white/10 bg-[#0F0B16]/80 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {plugin.name}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {plugin.description}
                                </p>
                              </div>
                              <button
                                onClick={() => onTogglePlugin(plugin.id)}
                                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase transition ${
                                  pluginStates[plugin.id]
                                    ? "border-emerald-400 text-emerald-300"
                                    : "border-white/20 text-white/70"
                                }`}
                              >
                                {pluginStates[plugin.id]
                                  ? "Active"
                                  : "Disabled"}
                              </button>
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500">
                              Connectors: {plugin.connectors.join(", ")} ·
                              Skills: {plugin.skills.join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </aside>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageSkillsPanel;
