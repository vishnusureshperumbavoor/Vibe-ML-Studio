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
    DEFAULT_DEMO_DATASET,
    generate_blurb_pubmedqa_training_script,
    generate_blurb_predict_script,
    BLURB_LEADERBOARD_STANDINGS
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

blurb_app = typer.Typer(
    name="blurb",
    help="Microsoft BLURB Benchmark Suite — Zero-VRAM Evaluation & Leaderboard",
    no_args_is_help=True,
)
app.add_typer(blurb_app, name="blurb")


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
            all_text = []
            for out in parsed_json.get("outputs", []):
                all_text.extend(out.get("text", []))
            combined_text = "".join(all_text)
            m = re.search(r'###VSPML_PREDICT_START###(.*?)###VSPML_PREDICT_END###', combined_text, re.DOTALL)
            if m:
                pred_data = json.loads(m.group(1).strip())
            elif "VSPML_PREDICT_RESULT:" in combined_text:
                clean_str = combined_text.split("VSPML_PREDICT_RESULT:")[1].strip()
                pred_data = json.loads(clean_str)
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


# ==============================================================================
# Microsoft BLURB Benchmark Commands
# ==============================================================================

@blurb_app.command("leaderboard")
def blurb_leaderboard():
    """
    Display official Microsoft BLURB biomedical benchmark leaderboard standings.
    """
    print_banner()

    table = Table(
        title="[bold cyan]🏆 Microsoft BLURB Official Benchmark Leaderboard (microsoft.github.io/BLURB)[/bold cyan]",
        border_style="cyan"
    )
    table.add_column("Rank", justify="center", style="bold yellow", width=6)
    table.add_column("Model / Contributor", style="bold white", width=38)
    table.add_column("BLURB Score", justify="right", style="bold green", width=13)
    table.add_column("PubMedQA Acc", justify="right", style="bold magenta", width=14)
    table.add_column("Architecture", style="dim", width=24)
    table.add_column("Params", justify="right", style="dim", width=8)

    for entry in BLURB_LEADERBOARD_STANDINGS:
        r = str(entry["rank"])
        model_name = entry["model"]
        b_score = str(entry["blurb_score"])
        qa_acc = str(entry["qa_accuracy"])
        arch = entry["architecture"]
        params = entry["params"]

        if r == "🎯":
            table.add_row(
                f"[bold red]{r}[/bold red]",
                f"[bold cyan]{model_name}[/bold cyan]",
                f"[bold cyan]{b_score}[/bold cyan]",
                f"[bold cyan]{qa_acc}[/bold cyan]",
                f"[bold cyan]{arch}[/bold cyan]",
                f"[bold cyan]{params}[/bold cyan]"
            )
        else:
            table.add_row(r, model_name, b_score, qa_acc, arch, params)

    console.print(table)
    console.print(
        "\n[dim]Run [bold cyan]vspml blurb train --dataset pubmedqa[/bold cyan] to train your model "
        "and benchmark directly against Microsoft PubMedBERT & BioLinkBERT.[/dim]\n"
    )


@blurb_app.command("status")
def blurb_status_alias():
    """Alias for vspml blurb leaderboard."""
    blurb_leaderboard()


@blurb_app.command("train")
def blurb_train(
    dataset: str = typer.Option("pubmedqa", "--dataset", "-d", help="BLURB dataset to benchmark on ('pubmedqa')"),
    model: str = typer.Option("convaiinnovations/laya", "--model", "-m", help="Hugging Face model backbone"),
    epochs: int = typer.Option(4, "--epochs", "-e", help="Training epochs (recommended: 3-5)"),
    lr: float = typer.Option(3e-5, "--lr", help="Learning rate"),
    batch_size: int = typer.Option(8, "--batch-size", "-b", help="Per-device batch size on Colab GPU"),
    output: str = typer.Option("./laya_blurb_pubmedqa", "--output", "-o", help="Checkpoint output directory on Colab"),
):
    """
    Train and benchmark your model on the official Microsoft BLURB PubMedQA split with zero local VRAM.
    """
    print_banner()

    status = asyncio.run(fetch_daemon_status())
    if not status or not status.get("connected"):
        print_error(
            "Google Colab GPU is not connected!\n"
            "Run [bold cyan]vspml connect[/bold cyan] first to pair with your Colab tab.",
            title="Colab Not Connected"
        )
        raise typer.Exit(code=1)

    console.print(Panel(
        f"[bold white]Microsoft BLURB Benchmark Target:[/bold white] [bold cyan]{dataset.upper()}[/bold cyan]\n"
        f"• Base Backbone: [bold yellow]{model}[/bold yellow]\n"
        f"• Split: [bold green]Official 450 Train | 50 Dev | 500 Test (PMID-locked)[/bold green]\n"
        f"• Target Metric: [bold magenta]Test Accuracy & Macro-F1 vs Microsoft PubMedBERT[/bold magenta]\n"
        f"• Checkpoint Path: [dim]{output}[/dim]",
        title="[bold green]BLURB Benchmark Execution[/bold green]",
        border_style="green"
    ))

    # 1. Generate execution recipe
    recipe = generate_blurb_pubmedqa_training_script(
        model_id=model,
        epochs=epochs,
        learning_rate=lr,
        batch_size=batch_size,
        output_dir=output
    )

    console.print("\n[bold magenta]🚀 Offloading BLURB training payload to Google Colab Cloud GPU...[/bold magenta]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]{task.description}[/bold cyan]"),
        console=console,
        transient=False,
    ) as progress:
        task = progress.add_task(f"Executing {epochs}-epoch BLURB benchmark loop on Colab...", total=None)
        try:
            res = asyncio.run(execute_remote_code(recipe, keep_cell=True))
            progress.update(task, completed=True, description="[bold green]BLURB Run Completed![/bold green]")
        except Exception as e:
            print_error(f"Remote BLURB execution failed: {e}")
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
        if "TEST ACCURACY" in line or "TEST MACRO-F1" in line:
            console.print(f"[bold green]🏆 {line}[/bold green]")
        elif "Epoch" in line or "loss" in line.lower() or "eval" in line.lower():
            console.print(f"[bold cyan]• {line}[/bold cyan]")
        elif "warning" in line.lower() or "installing" in line.lower():
            console.print(f"[yellow]{line}[/yellow]")
        else:
            console.print(f"[dim]{line}[/dim]")

    if is_error:
        print_error("Colab executed with an error during the benchmark run. Check logs above.", title="Benchmark Error")
        raise typer.Exit(code=1)

    # Parse structured benchmark result
    import re
    bench_data = None
    m = re.search(r'###VSPML_BLURB_RESULT_START###(.*?)###VSPML_BLURB_RESULT_END###', raw_output, re.DOTALL)
    if m:
        try:
            bench_data = json.loads(m.group(1).strip())
        except Exception:
            pass

    if not bench_data:
        combined = "\n".join(clean_lines)
        m = re.search(r'###VSPML_BLURB_RESULT_START###(.*?)###VSPML_BLURB_RESULT_END###', combined, re.DOTALL)
        if m:
            try:
                bench_data = json.loads(m.group(1).strip())
            except Exception:
                pass


    if bench_data:
        acc_pct = bench_data.get("accuracy_pct", 0.0)
        macro_f1_pct = bench_data.get("macro_f1_pct", 0.0)
        class_f1 = bench_data.get("class_f1", {})

        comp_table = Table(
            title="[bold green]🏁 Official BLURB PubMedQA Comparison (500 Test Samples)[/bold green]",
            border_style="green"
        )
        comp_table.add_column("Model", style="bold white", width=34)
        comp_table.add_column("Accuracy", justify="right", width=14)
        comp_table.add_column("Status / Comparison", width=28)

        comp_table.add_row(
            "[bold cyan]VSP ML (Your Fine-Tuned Model)[/bold cyan]",
            f"[bold green]{acc_pct}%[/bold green]",
            "[bold green]▶ Evaluated on 500 Test Samples[/bold green]"
        )
        comp_table.add_row(
            "BioLinkBERT-Large (Stanford #1 SOTA)",
            "83.50%",
            "[dim]SOTA Benchmark Baseline[/dim]"
        )
        comp_table.add_row(
            "BioLinkBERT-Base (Stanford)",
            "80.81%",
            "[dim]Base Encoder Baseline[/dim]"
        )
        comp_table.add_row(
            "MSR BiomedBERT / PubMedBERT (Microsoft)",
            "77.86%",
            "[dim]Microsoft Official Baseline[/dim]"
        )
        comp_table.add_row(
            "BioELECTRA-Base (Saama Research)",
            "76.38%",
            "[dim]ELECTRA Baseline[/dim]"
        )

        console.print(comp_table)

        f1_text = (
            f"[bold white]Official BLURB Metrics on 500 Test Samples:[/bold white]\n"
            f"• Test Accuracy: [bold green]{acc_pct}%[/bold green]\n"
            f"• Macro-F1: [bold green]{macro_f1_pct}%[/bold green]\n"
            f"• Class F1: Yes=[bold cyan]{round(class_f1.get('yes', 0.0)*100, 1)}%[/bold cyan] | "
            f"No=[bold cyan]{round(class_f1.get('no', 0.0)*100, 1)}%[/bold cyan] | "
            f"Maybe=[bold cyan]{round(class_f1.get('maybe', 0.0)*100, 1)}%[/bold cyan]\n"
            f"• Saved Checkpoint: [dim]{output}[/dim]\n\n"
            f"[bold yellow]Next Step:[/bold yellow] Test live decisions with `vspml blurb predict` or upload to Hugging Face!"
        )
        console.print(Panel(f1_text, title="[bold green]BLURB Results Verified[/bold green]", border_style="green"))
    else:
        print_success(
            f"BLURB benchmark finished!\nCheckpoint saved to: {output}",
            title="Benchmark Run Finished"
        )


@blurb_app.command("predict")
def blurb_predict(
    question: str = typer.Option(..., "--question", "-q", help="Biomedical or clinical research question"),
    context: str = typer.Option(..., "--context", "-c", help="Medical research abstract context"),
    model_dir: str = typer.Option("./laya_blurb_pubmedqa", "--model-dir", "-m", help="Path to checkpoint on Colab"),
):
    """
    Run sub-30ms clinical decision inference (yes / no / maybe) on biomedical text via Google Colab.
    """
    print_banner()

    status = asyncio.run(fetch_daemon_status())
    if not status or not status.get("connected"):
        print_error("Google Colab GPU is not connected! Run `vspml connect` first.")
        raise typer.Exit(code=1)

    console.print(f"[bold white]Question:[/bold white] [bold cyan]{question}[/bold cyan]")
    console.print(f"[bold white]Context Abstract:[/bold white] [dim]{context[:200]}...[/dim]\n")

    script = generate_blurb_predict_script(question=question, context=context, model_dir=model_dir)

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold cyan]Evaluating Decision on Colab GPU...[/bold cyan]"),
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
    import re
    pred_data = None

    m = re.search(r'###VSPML_PREDICT_START###(.*?)###VSPML_PREDICT_END###', raw_output, re.DOTALL)
    if m:
        try:
            pred_data = json.loads(m.group(1).strip())
        except Exception:
            pass

    if not pred_data:
        try:
            parsed_json = json.loads(raw_output)
            all_text = []
            for out in parsed_json.get("outputs", []):
                all_text.extend(out.get("text", []))
            combined_text = "".join(all_text)
            m = re.search(r'###VSPML_PREDICT_START###(.*?)###VSPML_PREDICT_END###', combined_text, re.DOTALL)
            if m:
                pred_data = json.loads(m.group(1).strip())
            elif "VSPML_PREDICT_RESULT:" in combined_text:
                clean_str = combined_text.split("VSPML_PREDICT_RESULT:")[1].strip()
                pred_data = json.loads(clean_str)
        except Exception:
            pass


    if not pred_data:
        console.print("[dim]Raw Colab Response:[/dim]")
        console.print(raw_output)
        print_error("Could not parse prediction output.", title="Parsing Error")
        raise typer.Exit(code=1)

    top_class = pred_data.get("top_class", "unknown").upper()
    conf = pred_data.get("confidence", 0.0)
    entropy = pred_data.get("entropy", 0.0)
    probs = pred_data.get("probabilities", {})

    table = Table(title="[bold cyan]PubMedQA Decision Probability Breakdown[/bold cyan]", border_style="cyan")
    table.add_column("Verdict", style="bold white", width=14)
    table.add_column("Probability", justify="right", width=14)
    table.add_column("Confidence Distribution", width=30)

    for cat, prob in sorted(probs.items(), key=lambda x: x[1], reverse=True):
        pct = round(prob * 100, 1)
        bars = int(prob * 26)
        bar_visual = f"[bold green]{'█' * bars}[/bold green]{'░' * (26 - bars)}"
        is_winner = (cat.upper() == top_class)
        cat_str = f"[bold green]▶ {cat.upper()}[/bold green]" if is_winner else f"[dim]{cat.upper()}[/dim]"
        pct_str = f"[bold green]{pct}%[/bold green]" if is_winner else f"[dim]{pct}%[/dim]"
        table.add_row(cat_str, pct_str, bar_visual)

    console.print(table)

    summary_text = (
        f"[bold white]Clinical Decision:[/bold white] [bold green]{top_class}[/bold green]\n"
        f"[bold white]Confidence:[/bold white] [bold cyan]{round(conf * 100, 1)}%[/bold cyan]\n"
        f"[bold white]Shannon Entropy:[/bold white] [bold yellow]{entropy}[/bold yellow] "
        f"[dim]({'High Certainty' if entropy < 0.6 else 'Moderate/Low Certainty'})[/dim]"
    )
    console.print(Panel(summary_text, title="[bold green]BLURB Verdict[/bold green]", border_style="green"))



def main():
    app()

if __name__ == "__main__":
    main()
