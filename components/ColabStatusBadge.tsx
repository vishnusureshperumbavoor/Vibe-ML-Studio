import React, { useState, useEffect } from "react";
import { GOOGLE_COLAB_LOGO_URL } from "../constants/logos";
import { colabService } from "../services/colabService";

export const ColabStatusBadge: React.FC = () => {
  const [isColabConnected, setIsColabConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const checkColabStatus = async () => {
    const connected = await colabService.checkStatus();
    setIsColabConnected(connected);
  };

  useEffect(() => {
    void checkColabStatus();
    const interval = setInterval(checkColabStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectClick = async () => {
    if (isColabConnected) {
      alert("🟢 Google Colab GPU is ALREADY paired and connected!");
      return;
    }
    setIsConnecting(true);
    try {
      const res = await colabService.connect();
      if (res.connected) {
        setIsColabConnected(true);
      } else {
        await checkColabStatus();
      }
    } catch (err) {
      console.error("❌ Failed to initiate Colab connection:", err);
      setIsColabConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      type="button"
      className={`colab-topbar-connect-btn ${isColabConnected ? "connected" : ""}`}
      onClick={handleConnectClick}
      title={
        isConnecting
          ? "⚡ Connecting to Google Colab GPU..."
          : isColabConnected
          ? "🟢 Google Colab GPU Connected & Active"
          : "⚡ Click to Pair / Connect Google Colab GPU notebook"
      }
      aria-label={isColabConnected ? "Google Colab GPU Connected" : "Pair Google Colab GPU"}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        padding: "0",
        borderRadius: "6px",
        background: isColabConnected ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
        border: isColabConnected ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(245, 158, 11, 0.4)",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <img
        src={GOOGLE_COLAB_LOGO_URL}
        alt="Google Colab"
        style={{
          width: "18px",
          height: "18px",
          objectFit: "contain",
          filter: isColabConnected ? "none" : "grayscale(0.4) opacity(0.8)",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "-2px",
          right: "-2px",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: isColabConnected ? "#10b981" : isConnecting ? "#f59e0b" : "#ef4444",
          border: "1px solid #111827",
          boxShadow: isColabConnected
            ? "0 0 6px #10b981"
            : isConnecting
            ? "0 0 6px #f59e0b"
            : "0 0 4px #ef4444",
        }}
      />
    </button>
  );
};
