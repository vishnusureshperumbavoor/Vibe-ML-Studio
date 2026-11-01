import json
import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Optional


def _to_wsl_path(path: str) -> Optional[str]:
    path = path.strip()
    if not path or "%" in path:
        return None
    wslpath = shutil.which("wslpath")
    if wslpath:
        try:
            converted = subprocess.check_output(
                [wslpath, "-u", path], stderr=subprocess.DEVNULL, text=True
            ).strip()
            if converted:
                return converted
        except (OSError, subprocess.CalledProcessError):
            pass
    match = re.match(r"^([A-Za-z]):[\\/](.*)$", path)
    if match:
        return f"/mnt/{match.group(1).lower()}/{match.group(2).replace('\\', '/')}"
    return None


def _windows_local_app_data() -> Optional[str]:
    cmd = shutil.which("cmd.exe")
    if not cmd:
        return None
    try:
        value = subprocess.check_output(
            [cmd, "/c", "echo", "%LOCALAPPDATA%"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    return _to_wsl_path(value)


def _local_state_paths() -> List[str]:
    home = os.path.expanduser("~")
    paths = [
        os.path.join(home, ".config", "google-chrome", "Local State"),
        os.path.join(home, ".config", "google-chrome-beta", "Local State"),
        os.path.join(home, ".config", "google-chrome-unstable", "Local State"),
        os.path.join(home, ".config", "chromium", "Local State"),
        os.path.join(home, ".var", "app", "com.google.Chrome", "config", "google-chrome", "Local State"),
        os.path.join(home, ".var", "app", "com.google.Chrome", "config", "google-chrome-beta", "Local State"),
        os.path.join(home, "snap", "chromium", "common", "chromium", "Local State"),
        os.path.join(home, "snap", "google-chrome", "common", ".config", "google-chrome", "Local State"),
        os.path.join(home, "Library", "Application Support", "Google", "Chrome", "Local State"),
    ]

    override = os.environ.get("VSPAGENT_CHROME_USER_DATA_DIR")
    if override:
        paths.insert(0, os.path.join(os.path.expanduser(override), "Local State"))

    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        paths.append(os.path.join(local_app_data, "Google", "Chrome", "User Data", "Local State"))

    windows_local_app_data = _windows_local_app_data()
    if windows_local_app_data:
        paths.append(os.path.join(windows_local_app_data, "Google", "Chrome", "User Data", "Local State"))
        paths.append(os.path.join(windows_local_app_data, "Google", "Chrome Beta", "User Data", "Local State"))
        paths.append(os.path.join(windows_local_app_data, "Chromium", "User Data", "Local State"))

    return paths


def _read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _profile_accounts(user_data: str, profile_dir: str, info: Dict[str, Any]) -> List[Dict[str, Any]]:
    preferences = _read_json(os.path.join(user_data, profile_dir, "Preferences")) or {}
    account_info = preferences.get("account_info")
    accounts: List[Dict[str, Any]] = []

    if isinstance(account_info, list):
        for authuser, entry in enumerate(account_info):
            if not isinstance(entry, dict):
                continue
            email = str(entry.get("email") or "").strip()
            name = str(
                entry.get("full_name")
                or entry.get("given_name")
                or email
                or f"Account {authuser + 1}"
            ).strip()
            accounts.append(
                {
                    "profile_dir": profile_dir,
                    "authuser": authuser,
                    "name": name,
                    "email": email,
                }
            )

    if accounts:
        return accounts

    user_name = str(info.get("user_name") or "").strip()
    email = user_name if "@" in user_name else ""
    name = str(
        info.get("gaia_name")
        or info.get("gaia_given_name")
        or info.get("name")
        or email
        or profile_dir
    ).strip()
    return [
        {
            "profile_dir": profile_dir,
            "authuser": 0,
            "name": name,
            "email": email,
        }
    ]


def discover_chrome_accounts() -> List[Dict[str, Any]]:
    accounts: List[Dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()

    for state_path in _local_state_paths():
        if not os.path.isfile(state_path):
            continue
        state = _read_json(state_path)
        if not state:
            continue

        user_data = os.path.dirname(state_path)
        profile = state.get("profile", {})
        info_cache = profile.get("info_cache", {})
        last_used = profile.get("last_used")

        for profile_dir, info in info_cache.items():
            if not isinstance(info, dict):
                continue
            for account in _profile_accounts(user_data, profile_dir, info):
                key = (account["profile_dir"], account["authuser"])
                if key in seen:
                    continue
                seen.add(key)
                account["is_last_used"] = profile_dir == last_used
                accounts.append(account)

    accounts.sort(key=lambda a: (not a["is_last_used"], a["profile_dir"], a["authuser"]))
    for index, account in enumerate(accounts, start=1):
        account["index"] = index
    return accounts
