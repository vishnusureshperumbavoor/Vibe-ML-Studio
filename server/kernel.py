import asyncio
import os
import sys
import json
import uuid

class KernelManager:
    def __init__(self):
        self.process = None
        self.lock = asyncio.Lock()
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

    async def interrupt(self):
        """Interrupts and terminates the active kernel process immediately."""
        await self.stop()
        print("Kernel process successfully interrupted.")

    async def execute(self, code: str):
        """Executes a block of code and yields output until finished."""
        async with self.lock:
            if not self.process or self.process.returncode is not None:
                await self.start()

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
                if not self.process or self.process.returncode is not None:
                    await self.stop()

kernel_manager = KernelManager()
