import asyncio
import os
import sys
import json
import uuid

class KernelManager:
    def __init__(self):
        self.process = None
        self.loop = asyncio.get_event_loop()
        self.marker = f"VML_END_OF_BLOCK_{uuid.uuid4().hex[:8]}"

    async def start(self):
        """Starts a persistent Python interactive session."""
        if self.process:
            await self.stop()
        
        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        
        # Start python in interactive, unbuffered mode
        self.process = await asyncio.create_subprocess_exec(
            sys.executable, "-u", "-i",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env
        )
        
        # Suppress REPL prompts
        self.process.stdin.write(b"import sys; sys.ps1 = ''; sys.ps2 = ''\n")
        await self.process.stdin.drain()
        
        print(f"Kernel started: PID {self.process.pid}")

    async def stop(self):
        """Kills the current kernel session."""
        if self.process:
            try:
                self.process.kill()
                await self.process.wait()
            except Exception:
                pass
            self.process = None

    async def execute(self, code: str):
        """Executes a block of code and yields output until finished."""
        if not self.process:
            await self.start()

        # Append a marker to detect end of execution
        # We wrap the code to ensure the marker is printed even on error, or at least tried.
        # However, a catastrophic syntax error might break the -i loop.
        full_code = f"\n{code}\nprint('{self.marker}')\n"
        
        try:
            self.process.stdin.write(full_code.encode('utf-8'))
            await self.process.stdin.drain()
            
            while True:
                line_bytes = await self.process.stdout.readline()
                if not line_bytes:
                    break
                    
                line = line_bytes.decode('utf-8', errors='replace')
                
                # Check if we hit the marker
                if self.marker in line:
                    break
                
                yield line
                
        except Exception as e:
            yield f"\n[KERNEL ERROR] {str(e)}\n"
            await self.stop() # Restart on total failure

kernel_manager = KernelManager()
