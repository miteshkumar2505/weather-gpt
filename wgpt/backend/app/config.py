"""
WeatherGPT — Configuration
Loads environment variables and provides centralized settings.
"""

import os
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    openweathermap_api_key: str = os.getenv("OPENWEATHERMAP_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")

    # OpenWeatherMap base URLs
    owm_base_url: str = "https://api.openweathermap.org/data/2.5"
    owm_geo_url: str = "https://api.openweathermap.org/geo/1.0"

    # Defaults
    default_units: str = "metric"  # metric = Celsius, imperial = Fahrenheit
    default_lang: str = "en"

    # App
    app_name: str = "WeatherGPT"
    app_version: str = "1.0.0"
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
