#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

from chrome_profiles import _to_wsl_path


def _windows_chrome_candidates():
    cmd = shutil.which("cmd.exe")
    if not cmd:
        return []

    paths = []
    try:
        output = subprocess.check_output(
            [cmd, "/c", "where", "chrome.exe"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        for line in output.splitlines():
            converted = _to_wsl_path(line)
            if converted and converted not in paths:
                paths.append(converted)
    except (OSError, subprocess.CalledProcessError):
        pass

    for variable in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        try:
            value = subprocess.check_output(
                [cmd, "/c", "echo", f"%{variable}%"],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            continue
        root = _to_wsl_path(value)
        if not root:
            continue
        candidate = os.path.join(root, "Google", "Chrome", "Application", "chrome.exe")
        if candidate not in paths:
            paths.append(candidate)

    return paths


def _chrome_candidates():
    candidates = []
    override = os.environ.get("VSPAGENT_CHROME_PATH")
    if override:
        candidates.append([override])

    if sys.platform == "darwin":
        candidates.append(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"])
    elif sys.platform.startswith("win"):
        for root in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
            if root:
                candidates.append([os.path.join(root, "Google", "Chrome", "Application", "chrome.exe")])
    else:
        for name in (
            "google-chrome",
            "google-chrome-stable",
            "google-chrome-beta",
            "chromium",
            "chromium-browser",
        ):
            path = shutil.which(name)
            if path:
                candidates.append([path])
        flatpak = shutil.which("flatpak")
        if flatpak:
            candidates.append([flatpak, "run", "com.google.Chrome"])
        for path in _windows_chrome_candidates():
            candidates.append([path])

    unique = []
    for candidate in candidates:
        if candidate not in unique:
            unique.append(candidate)
    return unique


def _with_authuser(url, authuser):
    if authuser is None or authuser == "":
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["authuser"] = str(authuser)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _with_account_email(url, email):
    if not email:
        return url
    return (
        "https://accounts.google.com/AccountChooser"
        "?source=ogb"
        f"&continue={quote(url, safe='')}"
        f"&Email={quote(email, safe='')}"
    )


def _launch(cmd, url, profile_dir):
    args = list(cmd)
    if profile_dir:
        args.append(f"--profile-directory={profile_dir}")
    args.append("--new-window")
    args.append(url)
    subprocess.Popen(
        args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def main():
    if len(sys.argv) < 2:
        return 2

    url = sys.argv[1]
    email = os.environ.get("VSPAGENT_GOOGLE_EMAIL") or ""
    if email:
        url = _with_account_email(url, email)
    else:
        url = _with_authuser(url, os.environ.get("VSPAGENT_GOOGLE_AUTHUSER"))
    profile_dir = os.environ.get("VSPAGENT_CHROME_PROFILE") or ""

    for candidate in _chrome_candidates():
        if os.path.isabs(candidate[0]) and not os.path.exists(candidate[0]):
            continue
        try:
            _launch(candidate, url, profile_dir)
            return 0
        except OSError:
            continue

    env = os.environ.copy()
    env.pop("BROWSER", None)
    for opener in ("xdg-open", "open"):
        path = shutil.which(opener)
        if path:
            try:
                subprocess.Popen(
                    [path, url],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                    env=env,
                )
                return 0
            except OSError:
                continue

    return 1


if __name__ == "__main__":
    sys.exit(main())
