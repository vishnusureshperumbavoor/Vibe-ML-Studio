import { useState, useEffect } from "react";
import { ConnectorConfig, SkillInfo, PluginDefinition } from "../types";
import { API_BASE, INITIAL_CONNECTORS, CONNECTOR_PLUGINS } from "../constants";

export function useSkillsAndConnectors() {
  const [connectorSettings, setConnectorSettings] = useState<ConnectorConfig[]>(
    () => INITIAL_CONNECTORS
  );
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, boolean>>(() =>
    CONNECTOR_PLUGINS.reduce((acc, plugin) => {
      acc[plugin.id] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [showManageSkills, setShowManageSkills] = useState(false);
  const [manageTab, setManageTab] = useState<"skills" | "connectors">("skills");

  useEffect(() => {
    let cancelled = false;
    const loadSkills = async () => {
      try {
        const response = await fetch(`${API_BASE}/list_skills`);
        if (!response.ok) throw new Error("Failed to fetch skills");
        const data = await response.json();
        const names = Array.isArray(data.skills) ? data.skills : [];
        if (!cancelled) {
          setSkills(
            names.map((name) => ({
              name,
              summary: "",
              autoActivate: true,
              instructions: "",
              showInstructions: false,
              loadingInstructions: false,
            }))
          );
        }
      } catch (error) {
        console.error("Unable to load skills list", error);
      }
    };
    loadSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSkillName && skills.length > 0) {
      setSelectedSkillName(skills[0].name);
    }
  }, [skills, selectedSkillName]);

  const handleToggleConnector = (id: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, enabled: !connector.enabled }
          : connector
      )
    );
  };

  const handleUpdateConnectorUrl = (id: string, url: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, url, status: "idle", statusMessage: "" }
          : connector
      )
    );
  };

  const handleTestConnector = async (id: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, status: "testing", statusMessage: "Checking…" }
          : connector
      )
    );
    const target = connectorSettings.find((connector) => connector.id === id);
    if (!target) return;
    if (!target.url) {
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "error",
                statusMessage: "URL is not set",
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector
        )
      );
      return;
    }

    try {
      const cleanUrl = target.url.replace(/\/+$/, "");
      const resp = await fetch(`${cleanUrl}/mcp/list`);
      if (!resp.ok) {
        throw new Error(`Status ${resp.status}`);
      }
      const data = await resp.json();
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "healthy",
                statusMessage: `${data.tools?.length ?? 0} tools`,
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector
        )
      );
    } catch (error: any) {
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "error",
                statusMessage: error?.message ?? "Connection failed",
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector
        )
      );
    }
  };

  const handleToggleSkillAutoActivate = (name: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.name === name
          ? { ...skill, autoActivate: !skill.autoActivate }
          : skill
      )
    );
  };

  const handleViewSkillInstructions = async (name: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.name === name
          ? { ...skill, showInstructions: !skill.showInstructions }
          : skill
      )
    );

    const skill = skills.find((item) => item.name === name);
    if (!skill || skill.instructions || skill.loadingInstructions) return;

    setSkills((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, loadingInstructions: true } : item
      )
    );

    try {
      const resp = await fetch(`${API_BASE}/read_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `skills/${name}/SKILLS.md` }),
      });
      const data = await resp.json();
      const instructions = data.content || "";
      const summaryLine = instructions.split("\n")[0]?.trim() || "";
      setSkills((prev) =>
        prev.map((item) =>
          item.name === name
            ? {
                ...item,
                instructions,
                summary: item.summary || summaryLine,
                loadingInstructions: false,
              }
            : item
        )
      );
    } catch (error: any) {
      setSkills((prev) =>
        prev.map((item) =>
          item.name === name
            ? {
                ...item,
                instructions: `Unable to load instructions: ${
                  error?.message ?? "Unknown error"
                }`,
                loadingInstructions: false,
              }
            : item
        )
      );
    }
  };

  const handleSelectSkill = (name: string) => {
    setSelectedSkillName(name);
  };

  const handleTogglePlugin = (pluginId: string) => {
    const plugin = CONNECTOR_PLUGINS.find((p) => p.id === pluginId);
    if (!plugin) return;
    setPluginStates((prev) => {
      const nextState = !prev[pluginId];
      setConnectorSettings((prevConnectors) =>
        prevConnectors.map((connector) =>
          plugin.connectors.includes(connector.id)
            ? { ...connector, enabled: nextState }
            : connector
        )
      );
      setSkills((prevSkills) =>
        prevSkills.map((skill) =>
          plugin.skills.includes(skill.name)
            ? { ...skill, autoActivate: nextState }
            : skill
        )
      );
      return { ...prev, [pluginId]: nextState };
    });
  };

  const openManagePanel = (tab: "skills" | "connectors" = "skills") => {
    setManageTab(tab);
    setShowManageSkills(true);
    if (tab === "skills" && skills.length && !selectedSkillName) {
      setSelectedSkillName(skills[0].name);
    }
  };

  return {
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
    openManagePanel,
    pluginDefinitions: CONNECTOR_PLUGINS,
  };
}
