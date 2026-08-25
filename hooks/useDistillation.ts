import { useState, useEffect } from "react";
import { API_BASE } from "../constants";

export function useDistillation() {
  const [distillStatus, setDistillStatus] = useState({
    step: "idle",
    progress: 0,
    current_task: "",
  });
  const [showDistillUI, setShowDistillUI] = useState(false);
  const [preSelectedDataset, setPreSelectedDataset] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (
      distillStatus.step !== "idle" &&
      distillStatus.step !== "complete" &&
      distillStatus.step !== "error"
    ) {
      interval = setInterval(async () => {
        try {
          const resp = await fetch(`${API_BASE}/distill/status`);
          const status = await resp.json();
          setDistillStatus(status);
          if (status.step !== "idle") setShowDistillUI(true);

          if (status.step === "complete") {
            const filename =
              status.current_task.split("Dataset ready: ")[1] ||
              status.current_task
                .split("Mission Accomplished! Published to: ")[1]
                ?.split("/")
                .pop() + ".jsonl";

            if (filename) {
              setPreSelectedDataset(filename);
            }
          }
        } catch (e) {
          console.error("Global status poll failed", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [distillStatus.step]);

  return {
    distillStatus,
    setDistillStatus,
    showDistillUI,
    setShowDistillUI,
    preSelectedDataset,
    setPreSelectedDataset,
  };
}
