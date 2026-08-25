import os
import time
import json
import threading
import urllib.request
import urllib.parse
from dotenv import load_dotenv

# Load env variables from server/ or root
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

CHAT_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".vml_telegram_chat.json")

class TelegramNotifier:
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip() or self._load_cached_chat_id()
        self.message_id = None
        self.last_update_time = 0
        self.min_update_interval = 2.0  # seconds between message edits
        self.enabled = bool(self.bot_token and self.bot_token != "your_telegram_token_here")
        self.current_training_status = {
            "is_training": False,
            "model_name": "None",
            "dataset_id": "None",
            "step": 0,
            "total_steps": 0,
            "loss": None,
            "epoch": None,
            "status_text": "Studio is idle."
        }
        self._polling_thread = None
        self._stop_polling = False
        self._last_update_id = 0

        if self.enabled:
            self._start_background_listener()

    def _load_cached_chat_id(self):
        try:
            if os.path.exists(CHAT_CACHE_FILE):
                with open(CHAT_CACHE_FILE, "r") as f:
                    data = json.load(f)
                    return str(data.get("chat_id", ""))
        except Exception:
            pass
        return ""

    def _save_cached_chat_id(self, chat_id, user_name=""):
        try:
            self.chat_id = str(chat_id)
            with open(CHAT_CACHE_FILE, "w") as f:
                json.dump({"chat_id": self.chat_id, "user_name": user_name, "updated_at": time.time()}, f)
            print(f"📡 Registered Telegram chat_id: {self.chat_id} ({user_name})")
        except Exception as e:
            print(f"⚠️ Failed to cache chat_id: {e}")

    def _resolve_chat_id(self):
        if self.chat_id:
            return self.chat_id

        if not self.enabled:
            return None

        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates"
            req = urllib.request.Request(url, headers={"User-Agent": "VML-Studio"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))
                if data.get("ok") and data.get("result"):
                    latest = data["result"][-1]
                    message = latest.get("message") or latest.get("channel_post") or latest.get("edited_message")
                    if message and "chat" in message:
                        cid = str(message["chat"]["id"])
                        uname = message.get("from", {}).get("first_name", "User")
                        self._save_cached_chat_id(cid, uname)
                        return self.chat_id
        except Exception as e:
            print(f"⚠️ Telegram chat_id auto-discovery error: {e}")

        return None

    def _make_progress_bar(self, percentage, length=10):
        filled = int(round(length * (percentage / 100)))
        filled = max(0, min(length, filled))
        bar = "█" * filled + "░" * (length - filled)
        return f"[{bar}]"

    def _send_direct_message(self, chat_id, text):
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(f"⚠️ Error sending direct Telegram message: {e}")
            return None

    def _start_background_listener(self):
        """Starts a background thread that polls for Telegram commands like /start, /status, /stop."""
        if self._polling_thread and self._polling_thread.is_alive():
            return

        def poll_loop():
            while not self._stop_polling:
                try:
                    url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates?offset={self._last_update_id + 1}&timeout=10"
                    req = urllib.request.Request(url, headers={"User-Agent": "VML-Studio"})
                    with urllib.request.urlopen(req, timeout=15) as response:
                        data = json.loads(response.read().decode("utf-8"))
                        if data.get("ok") and data.get("result"):
                            for item in data["result"]:
                                self._last_update_id = item["update_id"]
                                msg = item.get("message")
                                if not msg or "text" not in msg:
                                    continue

                                chat_id = str(msg["chat"]["id"])
                                user_name = msg.get("from", {}).get("first_name", "Friend")
                                text = msg["text"].strip()

                                # Auto-register chat_id
                                self._save_cached_chat_id(chat_id, user_name)

                                if text.startswith("/start"):
                                    welcome = (
                                        f"👋 *Hi {user_name}! Connected to VML Studio.*\n\n"
                                        "🤖 I will automatically send you real-time notifications and dynamic progress bars for your local LLM training runs!\n\n"
                                        "📌 *Available Commands:*\n"
                                        "• `/status` - Check current training progress & metrics\n"
                                        "• `/stop` - Halt the active training run\n"
                                        "• `/help` - Show instructions"
                                    )
                                    self._send_direct_message(chat_id, welcome)

                                elif text.startswith("/status") or text.startswith("/progress"):
                                    if self.current_training_status["is_training"]:
                                        s = self.current_training_status
                                        pct = min(100, int(round((s['step'] / s['total_steps']) * 100))) if s['total_steps'] > 0 else 0
                                        bar = self._make_progress_bar(pct)
                                        loss_str = f"{s['loss']:.4f}" if isinstance(s['loss'], (int, float)) else "calculating..."
                                        reply = (
                                            "🚀 *VML Studio — Training in Progress*\n\n"
                                            f"🧠 *Model:* `{s['model_name']}`\n"
                                            f"📊 *Progress:* `{bar}` *{pct}%* ({s['step']}/{s['total_steps']})\n"
                                            f"📉 *Loss:* `{loss_str}`\n"
                                            f"🔄 *Epoch:* `{s['epoch']}`"
                                        )
                                    else:
                                        reply = "💤 *VML Studio is currently idle.*\nNo active fine-tuning or quantization job running."
                                    self._send_direct_message(chat_id, reply)

                                elif text.startswith("/stop"):
                                    if self.current_training_status["is_training"]:
                                        try:
                                            # Trigger local interrupt
                                            req = urllib.request.Request("http://127.0.0.1:2000/interrupt", method="POST")
                                            urllib.request.urlopen(req, timeout=3)
                                            self._send_direct_message(chat_id, "🛑 *Training execution stopped via Telegram command.*")
                                        except Exception:
                                            self._send_direct_message(chat_id, "⚠️ Failed to trigger stop. Ensure VML Studio backend is running.")
                                    else:
                                        self._send_direct_message(chat_id, "ℹ️ No active training process to stop.")

                                elif text.startswith("/help"):
                                    help_text = (
                                        "🛠️ *VML Studio Telegram Bot Help*\n\n"
                                        "• `/status` - View live training step, percentage, and loss\n"
                                        "• `/stop` - Remotely interrupt the running Python kernel\n"
                                        "• Start training in VML Studio on your PC, and live progress bars will stream here automatically!"
                                    )
                                    self._send_direct_message(chat_id, help_text)

                except Exception:
                    time.sleep(3)

                time.sleep(1)

        self._polling_thread = threading.Thread(target=poll_loop, daemon=True)
        self._polling_thread.start()

    def send_start(self, model_id, dataset_id, max_steps, hardware="CPU"):
        """Sends the initial training launch notification."""
        if not self.enabled:
            return

        chat_id = self._resolve_chat_id()
        if not chat_id:
            return

        clean_model = model_id.split("/")[-1]
        clean_dataset = dataset_id.split("/")[-1]

        self.current_training_status.update({
            "is_training": True,
            "model_name": clean_model,
            "dataset_id": clean_dataset,
            "step": 0,
            "total_steps": max_steps,
            "loss": None,
            "epoch": 0,
            "status_text": "Training started"
        })

        text = (
            "🚀 *VML Studio — Training Started*\n\n"
            f"🧠 *Model:* `{clean_model}`\n"
            f"📚 *Dataset:* `{clean_dataset}`\n"
            f"🎯 *Target Steps:* `{max_steps}`\n"
            f"⚡ *Hardware:* `{hardware}`\n\n"
            "⏳ _Initializing environment and weights..._"
        )

        res = self._send_direct_message(chat_id, text)
        if res and res.get("ok"):
            self.message_id = res["result"]["message_id"]

    def update_progress(self, step, total_steps, loss=None, epoch=None, model_name=""):
        """Dynamically edits the existing message with live progress and loss."""
        self.current_training_status.update({
            "is_training": True,
            "step": step,
            "total_steps": total_steps,
            "loss": loss,
            "epoch": epoch,
            "model_name": model_name or self.current_training_status["model_name"]
        })

        if not self.enabled or not self.message_id:
            return

        now = time.time()
        if step < total_steps and (now - self.last_update_time) < self.min_update_interval:
            return

        chat_id = self._resolve_chat_id()
        if not chat_id:
            return

        pct = min(100, int(round((step / total_steps) * 100))) if total_steps > 0 else 0
        bar = self._make_progress_bar(pct)
        loss_str = f"`{loss:.4f}`" if isinstance(loss, (int, float)) else "calculating..."
        epoch_str = f"`{epoch:.2f}`" if isinstance(epoch, (int, float)) else "N/A"

        text = (
            "🚀 *VML Studio — Training in Progress*\n\n"
            f"📊 *Progress:* `{bar}` *{pct}%* ({step}/{total_steps})\n"
            f"📉 *Loss:* {loss_str}\n"
            f"🔄 *Epoch:* {epoch_str}\n"
            f"🧠 *Model:* `{model_name or 'LLM'}`\n\n"
            "⏱️ _Updating live..._"
        )

        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/editMessageText"
            payload = {
                "chat_id": chat_id,
                "message_id": self.message_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                res = json.loads(response.read().decode("utf-8"))
                if res.get("ok"):
                    self.last_update_time = now
        except Exception:
            pass

    def send_completion(self, model_slug, final_loss=None):
        """Updates the status card to training completed."""
        self.current_training_status.update({
            "is_training": False,
            "status_text": "Completed"
        })

        if not self.enabled:
            return

        chat_id = self._resolve_chat_id()
        if not chat_id:
            return

        loss_str = f"`{final_loss:.4f}`" if isinstance(final_loss, (int, float)) else "N/A"

        text = (
            "✅ *VML Studio — Training Completed!*\n\n"
            f"🎉 *Model:* `{model_slug}`\n"
            f"📉 *Final Loss:* {loss_str}\n"
            "💾 *Status:* Adapter weights saved successfully.\n"
            "🚀 _Ready for GGUF quantization & ONNX export!_"
        )

        try:
            if self.message_id:
                url = f"https://api.telegram.org/bot{self.bot_token}/editMessageText"
                payload = {
                    "chat_id": chat_id,
                    "message_id": self.message_id,
                    "text": text,
                    "parse_mode": "Markdown"
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=5)
            else:
                self._send_direct_message(chat_id, text)
        except Exception as e:
            print(f"⚠️ Telegram send_completion error: {e}")

    def send_interrupted(self, step=0, total_steps=0):
        """Updates the status card when execution is stopped by the user."""
        self.current_training_status.update({
            "is_training": False,
            "status_text": "Interrupted"
        })

        if not self.enabled or not self.message_id:
            return

        chat_id = self._resolve_chat_id()
        if not chat_id:
            return

        step_val = step or self.current_training_status.get("step", 0)
        tot_val = total_steps or self.current_training_status.get("total_steps", 0)

        text = (
            "🛑 *VML Studio — Training Stopped*\n\n"
            f"⏹️ *Halted at:* Step `{step_val}/{tot_val}`\n"
            "⚠️ *Status:* Process interrupted by user."
        )

        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/editMessageText"
            payload = {
                "chat_id": chat_id,
                "message_id": self.message_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass

# Singleton instance
telegram_notifier = TelegramNotifier()
