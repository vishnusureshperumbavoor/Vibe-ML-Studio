from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

BANNER = r"""[bold magenta]
__     ______  ____    __  __ _     
\ \   / / ___||  _ \  |  \/  | |    
 \ \ / /\___ \| |_) | | |\/| | |    
  \ V /  ___) |  __/  | |  | | |___ 
   \_/  |____/|_|     |_|  |_|_____|
[/bold magenta]
[bold white] VSP ML[/bold white] [bold cyan]v0.1.0[/bold cyan] [dim]| Zero-VRAM Decision Model CLI via Google Colab MCP[/dim]
"""

def print_banner():
    console.print(BANNER)

def print_success(message: str, title: str = "Success"):
    console.print(
        Panel(
            f"[bold green]✔[/bold green] {message}",
            title=f"[bold green]{title}[/bold green]",
            border_style="green",
        )
    )

def print_error(message: str, title: str = "Error"):
    console.print(
        Panel(
            f"[bold red]✖[/bold red] {message}",
            title=f"[bold red]{title}[/bold red]",
            border_style="red",
        )
    )

def print_status_table(status_data: dict):
    table = Table(title="[bold cyan]VSP ML Status[/bold cyan]", border_style="cyan")
    table.add_column("Property", style="bold white", width=22)
    table.add_column("Status / Value", style="white")

    connected = status_data.get("connected", False)
    status_str = "[bold green]🟢 Connected (Active)[/bold green]" if connected else "[bold yellow]🟡 Ready to Pair[/bold yellow]"
    
    table.add_row("Colab GPU Pairing", status_str)
    table.add_row("Daemon State", status_data.get("status", "unknown"))
    table.add_row("Status Message", status_data.get("message", "N/A"))
    
    tools = status_data.get("tools", [])
    tools_formatted = ", ".join(f"[dim]{t}[/dim]" for t in tools) if tools else "[dim]None[/dim]"
    table.add_row("Active MCP Tools", tools_formatted)
    
    mode = "[bold green]Cloud GPU (Zero Local VRAM)[/bold green]"
    table.add_row("Compute Target", mode)

    console.print(table)
