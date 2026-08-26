import asyncio
import time
from typing import Callable, Optional
from datetime import datetime

class AutoScheduler:
    def __init__(self, sync_runner: Callable):
        self.sync_runner = sync_runner
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.interval_minutes = 0

    def start(self, interval_minutes: int):
        self.interval_minutes = interval_minutes
        if self.interval_minutes > 0 and not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

    async def _loop(self):
        while self.is_running:
            try:
                await asyncio.sleep(self.interval_minutes * 60)
                if self.is_running:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] AutoScheduler triggering periodic backup sync...")
                    await self.sync_runner()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"AutoScheduler error: {str(e)}")
                await asyncio.sleep(10)
