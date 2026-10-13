import asyncio
import json
import os
import sys
import typer
from typing import Optional
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.table import Table
from vspml.ui import console, print_banner, print_success, print_error, print_status_table
from vspml.colab import fetch_daemon_status, trigger_daemon_connect, wait_for_colab_pairing, execute_remote_code
from vspml.recipes import (
    generate_decision_training_script,
    generate_decision_prediction_script,
    DEFAULT_DEMO_DATASET
)

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

    console.print("[bold yellow]⚡ Opening pairing connection to Google Colab...[/bold yellow]")
    connect_resp = asyncio.run(trigger_daemon_connect())
    if connect_resp.get("status") == "error":
        print_error(f"Failed to initiate connection: {connect_resp.get('message')}")
        raise typer.Exit(code=1)

    console.print("[dim]Google Colab tab launched in your browser. Completing handshake...[/dim]")

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
def decision_train(
    model: str = typer.Option("convaiinnovations/laya", "--model", "-m", help="Base decision model Hugging Face ID"),
    epochs: int = typer.Option(3, "--epochs", "-e", help="Number of training epochs"),
    batch_size: int = typer.Option(4, "--batch-size", "-b", help="Per-device training batch size"),
    lr: float = typer.Option(3e-5, "--lr", help="Learning rate for AdamW"),
    data: Optional[str] = typer.Option(None, "--data", "-d", help="Path to local CSV or JSONL training dataset"),
    text_col: str = typer.Option("text", "--text-col", help="Text column name in dataset"),
    label_col: str = typer.Option("label", "--label-col", help="Label column name in dataset"),
    output: str = typer.Option("./laya_decision_model", "--output", "-o", help="Output path on Colab"),
):
    """
    Fine-tune a System 1 Decision Model on Google Colab Cloud GPU.
    """
    print_banner()

    # 1. Verify Colab connection
    status = asyncio.run(fetch_daemon_status())
    if not status or not status.get("connected"):
        print_error(
            "Google Colab GPU is not connected!\n"
            "Run [bold cyan]vspml connect[/bold cyan] to pair your Colab session first.",
            title="Colab Not Connected"
        )
        raise typer.Exit(code=1)

    # 2. Parse dataset
    dataset_records = None
    if data and os.path.exists(data):
        console.print(f"[dim]Loading custom dataset from {data}...[/dim]")
        if data.endswith(".jsonl") or data.endswith(".json"):
            with open(data, "r") as f:
                if data.endswith(".jsonl"):
                    dataset_records = [json.loads(line) for line in f if line.strip()]
                else:
                    dataset_records = json.load(f)
        elif data.endswith(".csv"):
            import csv
            with open(data, "r") as f:
                reader = csv.DictReader(f)
                dataset_records = [{text_col: row[text_col], label_col: row[label_col]} for row in reader]

    if not dataset_records:
        console.print("[bold yellow]⚡ No custom dataset provided. Using built-in Clinical Triage Decision Dataset (10 cases: Emergency / Urgent / Routine)...[/bold yellow]")
        dataset_records = DEFAULT_DEMO_DATASET

    labels = sorted(list(set(item[label_col] for item in dataset_records)))
    console.print(f"[bold cyan]🎯 Decision Classes ({len(labels)}):[/bold cyan] {labels}")
    console.print(f"[dim]Total Samples: {len(dataset_records)} | Base Model: {model} | Epochs: {epochs}[/dim]")

    # 3. Generate Colab Execution Recipe
    recipe = generate_decision_training_script(
        model_id=model,
        labels=labels,
        dataset=dataset_records,
        epochs=epochs,
        learning_rate=lr,
        batch_size=batch_size,
        output_dir=output
    )

    console.print("\n[bold magenta]🚀 Offloading training payload to Google Colab Cloud GPU...[/bold magenta]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]{task.description}[/bold cyan]"),
        console=console,
        transient=False,
    ) as progress:
        task = progress.add_task("Executing Decision Model fine-tuning loop on Colab...", total=None)
        try:
            res = asyncio.run(execute_remote_code(recipe, keep_cell=True))
            progress.update(task, completed=True, description="[bold green]Execution Finished![/bold green]")
        except Exception as e:
            print_error(f"Remote execution failed: {e}")
            raise typer.Exit(code=1)

    raw_output = res.get("output", "")
    is_error = res.get("isError", False)

    console.print("\n[bold cyan]📋 Remote Google Colab Execution Logs:[/bold cyan]")
    clean_lines = []
    try:
        data_parsed = json.loads(raw_output)
        outputs = data_parsed.get("outputs", [])
        for out in outputs:
            text_lines = out.get("text", [])
            for line in text_lines:
                clean_lines.append(line.rstrip())
            trace_lines = out.get("traceback", [])
            if trace_lines:
                is_error = True
            for line in trace_lines:
                clean_lines.append(line.rstrip())
    except Exception:
        clean_lines = raw_output.split("\n")


    for line in clean_lines:
        if "Epoch" in line or "loss" in line.lower() or "step" in line.lower() or "training" in line.lower():
            console.print(f"[bold green]• {line}[/bold green]")
        elif "warning" in line.lower() or "installing" in line.lower():
            console.print(f"[yellow]{line}[/yellow]")
        else:
            console.print(f"[dim]{line}[/dim]")

    if is_error:
        print_error("Colab executed with an error during training. Check logs above.", title="Training Failed")
        raise typer.Exit(code=1)

    print_success(
        f"Decision Model fine-tuning completed successfully!\n"
        f"• Base Backbone: {model}\n"
        f"• Checkpoint: {output}\n"
        f"• Ready for instant testing with `vspml decision predict`",
        title="Training Complete"
    )


@decision_app.command("predict")
def decision_predict(
    text: str = typer.Option(..., "--text", "-t", help="Input text or patient/case query to classify"),
    model_dir: str = typer.Option("./laya_decision_model", "--model-dir", "-m", help="Path to fine-tuned model checkpoint on Colab"),
):
    """
    Run sub-30ms decision inference on the fine-tuned model via Google Colab.
    """
    print_banner()

    status = asyncio.run(fetch_daemon_status())
    if not status or not status.get("connected"):
        print_error(
            "Google Colab GPU is not connected!\n"
            "Run [bold cyan]vspml connect[/bold cyan] first.",
            title="Colab Not Connected"
        )
        raise typer.Exit(code=1)

    console.print(f"[bold white]Evaluating Input:[/bold white] [italic]\"{text}\"[/italic]")

    script = generate_decision_prediction_script(text=text, model_dir=model_dir)

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]Querying Decision Model on Colab...[/bold cyan]"),
        console=console,
        transient=True,
    ) as progress:
        progress.add_task("predict", total=None)
        try:
            res = asyncio.run(execute_remote_code(script, keep_cell=False))
        except Exception as e:
            print_error(f"Inference failed: {e}")
            raise typer.Exit(code=1)

    raw_output = res.get("output", "")
    pred_data = None
    import re

    # 1. Check for delimiter in raw_output
    match = re.search(r'###VSPML_PREDICT_START###(.*?)###VSPML_PREDICT_END###', raw_output, re.DOTALL)
    if match:
        try:
            pred_data = json.loads(match.group(1).strip())
        except Exception:
            pass

    # 2. Check structured outputs from Colab cell
    if not pred_data:
        try:
            parsed_json = json.loads(raw_output)
            for out in parsed_json.get("outputs", []):
                for text_line in out.get("text", []):
                    m = re.search(r'###VSPML_PREDICT_START###(.*?)###VSPML_PREDICT_END###', text_line, re.DOTALL)
                    if m:
                        pred_data = json.loads(m.group(1).strip())
                        break
                    elif "VSPML_PREDICT_RESULT:" in text_line:
                        clean_str = text_line.split("VSPML_PREDICT_RESULT:")[1].strip()
                        pred_data = json.loads(clean_str)
                        break
        except Exception:
            pass

    if not pred_data:

        console.print("[dim]Raw Colab Response:[/dim]")
        console.print(raw_output)
        print_error("Could not parse prediction output.", title="Parsing Error")
        raise typer.Exit(code=1)

    top_class = pred_data.get("top_class", "unknown")
    conf = pred_data.get("confidence", 0.0)
    entropy = pred_data.get("entropy", 0.0)
    probs = pred_data.get("probabilities", {})

    table = Table(title="[bold cyan]System 1 Decision Output[/bold cyan]", border_style="cyan")
    table.add_column("Category", style="bold white", width=18)
    table.add_column("Confidence", justify="right", width=14)
    table.add_column("Probability Bar", width=30)

    for cat, prob in sorted(probs.items(), key=lambda x: x[1], reverse=True):
        pct = round(prob * 100, 1)
        bars = int(prob * 26)
        bar_visual = f"[bold green]{'█' * bars}[/bold green]{'░' * (26 - bars)}"
        is_winner = (cat == top_class)
        cat_str = f"[bold green]▶ {cat}[/bold green]" if is_winner else f"[dim]{cat}[/dim]"
        pct_str = f"[bold green]{pct}%[/bold green]" if is_winner else f"[dim]{pct}%[/dim]"
        table.add_row(cat_str, pct_str, bar_visual)

    console.print(table)

    summary_text = (
        f"[bold white]Decision Verdict:[/bold white] [bold green]{top_class.upper()}[/bold green]\n"
        f"[bold white]Confidence:[/bold white] [bold cyan]{round(conf * 100, 1)}%[/bold cyan]\n"
        f"[bold white]Entropy (Uncertainty):[/bold white] [bold yellow]{entropy}[/bold yellow] "
        f"[dim]({'Low Uncertainty' if entropy < 0.5 else 'Moderate/High Uncertainty'})[/dim]"
    )
    console.print(Panel(summary_text, title="[bold green]Final Decision[/bold green]", border_style="green"))


def main():
    app()

if __name__ == "__main__":
    main()
