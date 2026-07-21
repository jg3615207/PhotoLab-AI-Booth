from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    api_key: str = "ef39127499964ff48a68690afd80f268"
    rh_base_url: str = "https://www.runninghub.ai"
    rh_workflow_id: str = "2078434616146497537"

    openai_api_key: str = "sk-VKkoyB4BvptnANxDrGPmeiu5KxLgj6cn1Y0W4CY9aZfmZSV1u3rEOw3WZTvwzf9d"
    openai_base_url: str = "https://opencode.ai/zen/v1"
    openai_model: str = "mimo-v2.5-free"

    upload_dir: str = str(Path(__file__).parent.parent / "data" / "uploads")
    output_dir: str = str(Path(__file__).parent.parent / "data" / "outputs")
    print_dir: str = str(Path(__file__).parent.parent / "data" / "prints")
    db_path: str = str(Path(__file__).parent.parent / "data" / "booth.db")

    server_host: str = "0.0.0.0"
    server_port: int = 8000
    printer_name: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
