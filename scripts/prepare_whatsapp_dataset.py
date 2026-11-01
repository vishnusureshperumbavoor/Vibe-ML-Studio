#!/usr/bin/env python3
"""
WhatsApp Chat to Persona SFT Dataset Converter
=============================================
Parses raw WhatsApp chat export text files into a clean, formatted multi-turn
instruction dataset (ChatML / ShareGPT / OpenAI messages format) for fine-tuning
lightweight conversational LLMs (such as Qwen2.5-0.5B-Instruct).

Features:
- Handles multiline WhatsApp messages and varying timestamp conventions.
- Merges rapid consecutive chat bubbles from the same speaker.
- Splits conversation sessions across time gaps (> 2 hours of inactivity).
- Redacts sensitive personal information (phone numbers, emails, OTPs).
- Ensures dialogues start on 'user' and end on 'assistant' responses.
- Generates JSONL ready for SFTTrainer / TRL / Hugging Face.
"""

import argparse
import glob
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

HEADER_RE = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)[\s\u202f\xa0]*([a-zA-Z]{2})?\s*-\s*([^:]+):\s*(.*)$"
)

SYSTEM_IGNORE_RE = re.compile(
    r"^(<Media omitted>|This message was deleted|You deleted this message|Missed (?:voice|video) call(?:\sat\s.+)?|null)$",
    re.IGNORECASE,
)

PHONE_RE = re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\b\d{10}\b")
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
OTP_RE = re.compile(r"\b(?:otp|code|pin|verification)\s*(?:is|:)?\s*(\d{4,8})\b", re.IGNORECASE)

DEFAULT_SYSTEM_PROMPT = (
    "You are Vishnu Suresh Perumbavoor. Respond naturally in your authentic conversational style, tone, and vocabulary."
)


def parse_timestamp(date_part: str, time_part: str, ampm: Optional[str]) -> Optional[datetime]:
    """Parses WhatsApp date and time string into a datetime object."""
    ts_str = f"{date_part} {time_part}"
    if ampm:
        ts_str += f" {ampm.lower()}"

    formats = [
        "%d/%m/%y %I:%M %p",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d/%m/%y %I:%M:%S %p",
        "%d/%m/%Y %I:%M:%S %p",
        "%m/%d/%y %I:%M %p",
        "%m/%d/%Y %I:%M %p",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    return None


def scrub_text(text: str) -> Tuple[str, int, int]:
    """Redacts phone numbers, emails, and OTPs from message text."""
    phone_count = len(PHONE_RE.findall(text))
    text = PHONE_RE.sub("[PHONE]", text)

    email_count = len(EMAIL_RE.findall(text))
    text = EMAIL_RE.sub("[EMAIL]", text)

    text = OTP_RE.sub("[SENSITIVE_CODE]", text)
    return text, phone_count, email_count


def parse_chat_file(filepath: str, scrub: bool = True) -> Tuple[List[Dict[str, Any]], int, int]:
    """Parses a single WhatsApp .txt export into structured raw message dictionaries."""
    raw_msgs: List[Dict[str, Any]] = []
    total_phones = 0
    total_emails = 0

    with open(filepath, "r", encoding="utf-8", errors="ignore") as fp:
        current_msg: Optional[Dict[str, Any]] = None
        for line in fp:
            line_s = line.rstrip()
            if not line_s:
                continue

            m = HEADER_RE.match(line_s)
            if m:
                if current_msg:
                    raw_msgs.append(current_msg)
                date_part, time_part, ampm, sender, text = m.groups()
                dt = parse_timestamp(date_part, time_part, ampm)
                current_msg = {"dt": dt, "sender": sender.strip(), "text": text.strip()}
            elif current_msg:
                current_msg["text"] += "\n" + line_s

        if current_msg:
            raw_msgs.append(current_msg)

    # Filter out empty or WhatsApp system messages
    cleaned_msgs: List[Dict[str, Any]] = []
    for msg in raw_msgs:
        t = msg["text"].strip()
        if not t or SYSTEM_IGNORE_RE.match(t):
            continue

        if scrub:
            t, p_cnt, e_cnt = scrub_text(t)
            total_phones += p_cnt
            total_emails += e_cnt
            msg["text"] = t

        cleaned_msgs.append(msg)

    return cleaned_msgs, total_phones, total_emails


def split_into_sessions(msgs: List[Dict[str, Any]], gap_hours: float = 2.0) -> List[List[Dict[str, Any]]]:
    """Splits sequential messages into distinct sessions based on time gaps."""
    if not msgs:
        return []

    sessions: List[List[Dict[str, Any]]] = []
    current_session: List[Dict[str, Any]] = []
    gap_delta = timedelta(hours=gap_hours)

    for msg in msgs:
        if not current_session:
            current_session.append(msg)
        else:
            prev = current_session[-1]
            if msg["dt"] and prev["dt"] and (msg["dt"] - prev["dt"]) > gap_delta:
                sessions.append(current_session)
                current_session = [msg]
            else:
                current_session.append(msg)

    if current_session:
        sessions.append(current_session)

    return sessions


def merge_consecutive_bubbles(session: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merges consecutive message bubbles sent by the same speaker into one conversational turn."""
    merged: List[Dict[str, Any]] = []
    for msg in session:
        if not merged:
            merged.append({"sender": msg["sender"], "text": msg["text"]})
        elif merged[-1]["sender"] == msg["sender"]:
            merged[-1]["text"] += "\n" + msg["text"]
        else:
            merged.append({"sender": msg["sender"], "text": msg["text"]})
    return merged


def chunk_session_dialogues(turns: List[Dict[str, str]], max_turns: int = 8) -> List[List[Dict[str, str]]]:
    """
    Chunks a multi-turn conversation into blocks of up to `max_turns`.
    Guarantees every block starts with a 'user' turn and ends with an 'assistant' turn.
    """
    chunks: List[List[Dict[str, str]]] = []
    i = 0
    while i < len(turns):
        # Must start on a user turn
        while i < len(turns) and turns[i]["role"] != "user":
            i += 1
        if i >= len(turns):
            break

        end = min(len(turns), i + max_turns)
        # Must end on an assistant turn
        while end > i and turns[end - 1]["role"] != "assistant":
            end -= 1

        if end > i:
            chunk = turns[i:end]
            if any(t["role"] == "user" for t in chunk) and any(t["role"] == "assistant" for t in chunk):
                chunks.append(chunk)
            i = end
        else:
            i += 1

    return chunks


def build_sliding_window_dialogues(turns: List[Dict[str, str]], max_context_turns: int = 6) -> List[List[Dict[str, str]]]:
    """
    Generates a focused training sample for each assistant response with preceding context.
    """
    samples: List[List[Dict[str, str]]] = []
    for idx, turn in enumerate(turns):
        if turn["role"] == "assistant":
            start_idx = max(0, idx - (max_context_turns - 1))
            while start_idx < idx and turns[start_idx]["role"] != "user":
                start_idx += 1
            if start_idx < idx:
                sample = turns[start_idx : idx + 1]
                samples.append(sample)
    return samples


def main():
    parser = argparse.ArgumentParser(description="Convert WhatsApp chat exports into an LLM SFT training dataset.")
    parser.add_argument(
        "--input-dir",
        type=str,
        default="assets/whatsapp_chats",
        help="Directory containing WhatsApp .txt chat exports.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="assets/train_vishnu_persona.jsonl",
        help="Output JSONL dataset path.",
    )
    parser.add_argument(
        "--target-user",
        type=str,
        default="Vishnu Suresh Perumbavoor",
        help="Name of the target person to emulate as 'assistant'.",
    )
    parser.add_argument(
        "--system-prompt",
        type=str,
        default="",
        help="Optional system prompt embedded in each sample. Leave empty for zero-system-prompt training.",
    )
    parser.add_argument(
        "--no-system-prompt",
        action="store_true",
        help="Omit system prompt completely so the model behaves like Vishnu natively without custom prompts.",
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["sessions", "sliding", "both"],
        default="sessions",
        help="Generation mode: 'sessions' (multi-turn dialogues, chunked), 'sliding' (focused window per response), or 'both'.",
    )
    parser.add_argument(
        "--gap-hours",
        type=float,
        default=2.0,
        help="Inactivity gap in hours to separate conversation sessions.",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=8,
        help="Maximum turns per dialogue chunk in sessions mode.",
    )
    parser.add_argument(
        "--no-scrub",
        action="store_true",
        help="Disable redaction of phone numbers and emails.",
    )

    args = parser.parse_args()

    # Find chat files
    pattern = os.path.join(args.input_dir, "**", "*.txt")
    files = [f for f in glob.glob(pattern, recursive=True) if ":Zone.Identifier" not in f]

    if not files:
        print(f"❌ No chat files found in {args.input_dir}")
        return

    print(f"\n📂 Found {len(files)} WhatsApp chat files in '{args.input_dir}'")
    for f in files:
        print(f"   - {os.path.basename(f)}")

    scrub = not args.no_scrub
    all_turns_list: List[List[Dict[str, str]]] = []
    total_raw_msgs = 0
    total_phones_scrubbed = 0
    total_emails_scrubbed = 0

    for filepath in files:
        msgs, phones, emails = parse_chat_file(filepath, scrub=scrub)
        total_raw_msgs += len(msgs)
        total_phones_scrubbed += phones
        total_emails_scrubbed += emails

        sessions = split_into_sessions(msgs, gap_hours=args.gap_hours)
        for s in sessions:
            merged = merge_consecutive_bubbles(s)
            turns: List[Dict[str, str]] = []
            for m in merged:
                role = "assistant" if args.target_user.lower() in m["sender"].lower() else "user"
                turns.append({"role": role, "content": m["text"]})
            all_turns_list.append(turns)

    # Generate dialogue samples based on mode
    dataset: List[Dict[str, Any]] = []
    include_system = bool(args.system_prompt.strip()) and not args.no_system_prompt

    for turns in all_turns_list:
        if args.mode in ("sessions", "both"):
            chunks = chunk_session_dialogues(turns, max_turns=args.max_turns)
            for c in chunks:
                msgs = [{"role": "system", "content": args.system_prompt.strip()}] + c if include_system else c
                dataset.append({"messages": msgs})

        if args.mode in ("sliding", "both"):
            sliding = build_sliding_window_dialogues(turns, max_context_turns=args.max_turns)
            for s in sliding:
                msgs = [{"role": "system", "content": args.system_prompt.strip()}] + s if include_system else s
                dataset.append({"messages": msgs})

    # Deduplicate exact duplicate message series if any
    unique_dataset = []
    seen = set()
    for item in dataset:
        rep = json.dumps(item["messages"], sort_keys=True)
        if rep not in seen:
            seen.add(rep)
            unique_dataset.append(item)

    # Ensure parent output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as out_fp:
        for item in unique_dataset:
            out_fp.write(json.dumps(item, ensure_ascii=False) + "\n")

    # Also make a copy at root 'train_vishnu_persona.jsonl' if writing to assets
    root_copy = os.path.join(os.getcwd(), "train_vishnu_persona.jsonl")
    if os.path.abspath(args.output) != os.path.abspath(root_copy):
        with open(root_copy, "w", encoding="utf-8") as out_fp:
            for item in unique_dataset:
                out_fp.write(json.dumps(item, ensure_ascii=False) + "\n")

    # Compute statistics
    total_samples = len(unique_dataset)
    total_assistant_replies = sum(
        sum(1 for m in item["messages"] if m["role"] == "assistant") for item in unique_dataset
    )
    total_user_queries = sum(
        sum(1 for m in item["messages"] if m["role"] == "user") for item in unique_dataset
    )

    print("\n✅ Dataset generation complete!")
    print(f"📊 Summary Statistics:")
    print(f"   - Input Chat Files Processed:     {len(files)}")
    print(f"   - Cleaned Message Turns:          {total_raw_msgs}")
    print(f"   - Phone Numbers Redacted:         {total_phones_scrubbed}")
    print(f"   - Email Addresses Redacted:       {total_emails_scrubbed}")
    print(f"   - Total Training Dialogues:       {total_samples}")
    print(f"   - Total Assistant (Vishnu) Turns: {total_assistant_replies}")
    print(f"   - Total User Turns:               {total_user_queries}")
    print(f"   - Output Saved To:                {args.output}")
    print(f"   - Root Mirror Path:               {root_copy}\n")

    if unique_dataset:
        print("🔍 First Sample Preview:")
        print(json.dumps(unique_dataset[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
