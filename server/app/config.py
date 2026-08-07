from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    api_key: str = ""
    admin_api_key: str = "photolab_admin_secret"
    rh_base_url: str = "https://www.runninghub.ai"
    rh_workflow_id: str = ""

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"
    public_base_url: str = ""

    upload_dir: str = str(Path(__file__).parent.parent / "data" / "inputs")
    output_dir: str = str(Path(__file__).parent.parent / "data" / "outputs")
    print_dir: str = str(Path(__file__).parent.parent / "data" / "prints")
    db_path: str = str(Path(__file__).parent.parent / "data" / "booth.db")

    server_host: str = "0.0.0.0"
    server_port: int = 8000
    printer_name: str = ""

    db_mode: str = "local"  # "local" | "remote"
    cf_account_id: str = ""
    cf_d1_database_id: str = ""
    cf_api_token: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
