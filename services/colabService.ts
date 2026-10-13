import { API_BASE } from "../constants";

export interface ColabStatusResponse {
  connected: boolean;
  colabAvailable?: boolean;
  status?: string;
  message?: string;
  tools?: string[];
  recent_logs?: string[];
}

export const colabService = {
  /**
   * Check if Colab GPU daemon is active and connected to notebook session.
   */
  checkStatus: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/colab/status`);
      if (res.ok) {
        const data: ColabStatusResponse = await res.json();
        return Boolean(data.connected || data.colabAvailable || data.status === "connected");
      }
    } catch {
      // Network error or daemon unreachable
    }
    return false;
  },

  /**
   * Trigger pairing / connection handshake with Colab GPU tab.
   */
  connect: async (): Promise<{ status: string; connected: boolean; message?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/colab/connect`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status || "unknown",
          connected: data.status === "already_connected" || data.status === "connected",
          message: data.message,
        };
      }
    } catch (err) {
      console.error("❌ Failed to initiate Colab connection:", err);
    }
    return { status: "failed", connected: false };
  },

  /**
   * Execute Python code in Google Colab session.
   */
  execute: async (code: string, keepCell: boolean = true): Promise<any> => {
    const res = await fetch(`${API_BASE}/colab/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, keep_cell: keepCell }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Colab execution failed" }));
      throw new Error(err.detail || "Colab execution failed");
    }
    return await res.json();
  },
};
