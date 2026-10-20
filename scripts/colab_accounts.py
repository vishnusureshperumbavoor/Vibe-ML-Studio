#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.request

API_BASE = "http://127.0.0.1:2000"


def fetch_accounts():
    try:
        with urllib.request.urlopen(f"{API_BASE}/colab/accounts", timeout=5) as response:
            return json.load(response).get("accounts", [])
    except (OSError, ValueError, urllib.error.URLError):
        return []


def label(account):
    email = account.get("email") or "not signed in"
    name = account.get("name") or email
    default = " [default]" if account.get("is_last_used") else ""
    authuser = account.get("authuser", 0)
    return f"{account['index']}) {name} <{email}> [authuser={authuser}]{default}"


def selection(account):
    return "\t".join(
        [
            account.get("profile_dir", ""),
            str(account.get("authuser", 0)),
            account.get("email", ""),
        ]
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["list", "select"])
    parser.add_argument("--account", type=int)
    args = parser.parse_args()

    accounts = fetch_accounts()
    if not accounts:
        return 0

    if args.mode == "list":
        for account in accounts:
            print(label(account))
        return 0

    if args.account is not None:
        if 1 <= args.account <= len(accounts):
            print(selection(accounts[args.account - 1]))
            return 0
        print(f"Invalid account number: {args.account}", file=sys.stderr)
        return 2

    if not sys.stdin.isatty():
        print("Available Chrome accounts:", file=sys.stderr)
        for account in accounts:
            print(f"  {label(account)}", file=sys.stderr)
        print("Non-interactive session: rerun with --account N or --profile DIR.", file=sys.stderr)
        return 2

    print("Available Chrome accounts:", file=sys.stderr)
    for account in accounts:
        print(f"  {label(account)}", file=sys.stderr)

    while True:
        print(f"Select account [1-{len(accounts)}]: ", end="", file=sys.stderr, flush=True)
        try:
            choice = input().strip()
        except (EOFError, KeyboardInterrupt):
            print(file=sys.stderr)
            return 2
        if not choice:
            choice = "1"
        if choice.isdigit() and 1 <= int(choice) <= len(accounts):
            print(selection(accounts[int(choice) - 1]))
            return 0
        print("Invalid selection.", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
