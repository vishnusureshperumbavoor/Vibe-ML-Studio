import asyncio
import sys
import typer
from rich.progress import Progress, SpinnerColumn, TextColumn
from vspml.ui import console, print_banner, print_success, print_error, print_status_table
from vspml.colab import fetch_daemon_status, trigger_daemon_connect, wait_for_colab_pairing

app = typer.Typer(
    name="vspml",
    help="VSP ML — Zero-VRAM Decision Model CLI via Google Colab MCP",
    no_args_is_help=True,
    add_completion=False,
)

decision_app = typer.Typer(
    name="decision",
    help="Train, evaluate, and deploy System 1 Decision Models (Laya, ModernBERT)",
    no_args_is_help=True,
)
app.add_typer(decision_app, name="decision")

@app.command()
def connect(
    timeout: int = typer.Option(60, "--timeout", "-t", help="Timeout in seconds to wait for Colab tab pairing"),
):
    """
    Pair and connect your terminal session to Google Colab GPU.
    """
    print_banner()

    # 1. Check if already connected
    status = asyncio.run(fetch_daemon_status())
    if not status:
        print_error(
            "VSP ML Daemon is not reachable on http://127.0.0.1:2000.\n"
            "Please ensure the backend server is running (`npm run start:server`).",
            title="Daemon Offline"
        )
        raise typer.Exit(code=1)

    if status.get("connected"):
        print_success("Google Colab GPU session is already paired and connected!", title="Connected")
        print_status_table(status)
        return

    # 2. Trigger Colab pairing
    console.print("[bold yellow]⚡ Opening pairing connection to Google Colab...[/bold yellow]")
    connect_resp = asyncio.run(trigger_daemon_connect())
    if connect_resp.get("status") == "error":
        print_error(f"Failed to initiate connection: {connect_resp.get('message')}")
        raise typer.Exit(code=1)

    console.print("[dim]Google Colab tab launched in your browser. Completing handshake...[/dim]")

    # 3. Wait with live spinner
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]{task.description}[/bold cyan]"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task(f"Waiting for Colab tab to pair (timeout: {timeout}s)...", total=None)
        paired = asyncio.run(wait_for_colab_pairing(timeout_seconds=float(timeout)))

    if paired:
        fresh_status = asyncio.run(fetch_daemon_status()) or {}
        print_success("Google Colab Cloud GPU successfully connected & ready for training!", title="Pairing Successful")
        print_status_table(fresh_status)
    else:
        print_error(
            "Timed out waiting for Colab tab to pair.\n"
            "• Ensure your browser tab at colab.research.google.com finished loading.\n"
            "• Verify Colab has internet access and can connect to localhost.\n"
            "• Run `vspml status` to check connection state.",
            title="Pairing Timeout"
        )
        raise typer.Exit(code=1)


@app.command()
def status():
    """
    Check the connection status and specs of the paired Colab GPU session.
    """
    print_banner()
    status_data = asyncio.run(fetch_daemon_status())
    if not status_data:
        print_error(
            "VSP ML Daemon is offline or unreachable on http://127.0.0.1:2000.",
            title="Daemon Offline"
        )
        raise typer.Exit(code=1)

    print_status_table(status_data)


@app.command()
def version():
    """
    Show VSP ML CLI version.
    """
    print_banner()
    console.print("[bold white]VSP ML CLI Version:[/bold white] [bold cyan]0.1.0[/bold cyan]")
    console.print("[dim]Target: Decision Model Engine (Laya / ModernBERT)[/dim]")


@decision_app.command("train")
def decision_train_stub():
    """
    Fine-tune a System 1 Decision Model on Google Colab GPU.
    """
    print_banner()
    console.print("[yellow]🚧 Decision training pipeline is currently under active build.[/yellow]")
    console.print("Run [bold cyan]vspml connect[/bold cyan] first to prepare your Colab Cloud GPU session.")


def main():
    app()

if __name__ == "__main__":
    main()
