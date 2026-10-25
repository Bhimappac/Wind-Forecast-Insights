import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Wind Forecast Insights API"
    app_version: str = "1.0.0"
    elexon_base_url: str = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
    data_dir: str = os.getenv("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data")))
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "*",
    ]
    default_decision_time: str = "09:00"  # UK local time on D-1
    timezone: str = "Europe/London"


settings = Settings()
