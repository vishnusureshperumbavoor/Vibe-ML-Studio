/**
 * Fetches host system specifications via MCP tool call.
 */
export async function fetchSystemSpecs(): Promise<any | null> {
  try {
    const resp = await fetch("http://127.0.0.1:3001/mcp/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "get_system_specs", arguments: {} }),
    });
    const data = await resp.json();
    const text = data[0]?.text || "";
    if (text.includes("[JSON_RESULTS]")) {
      const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch system info:", e);
    return null;
  }
}
