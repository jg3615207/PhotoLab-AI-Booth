from dataclasses import dataclass
from abc import ABC, abstractmethod

@dataclass
class GenerateResult:
    image_url: str
    task_id: str
    cost_time: int
    cost_money: float

class AIProvider(ABC):
    @abstractmethod
    async def upload_image(self, image_path: str) -> str:
        ...

    @abstractmethod
    async def generate(
        self,
        guest_image_path: str,
        style_ref_path: str | None,
        prompt: str,
        seed: int | None = None,
    ) -> GenerateResult:
        ...
