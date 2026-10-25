import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class ElexonClient:
    """HTTP Client for querying Elexon BMRS Insights API with retries and timeouts."""

    def __init__(self, base_url: str | None = None, timeout: float = 30.0):
        self.base_url = (base_url or settings.elexon_base_url).rstrip("/")
        self.timeout = timeout
        self.headers = {"User-Agent": "WindForecastInsights/1.0", "Accept": "application/json"}

    async def fetch_fuelhh_actuals(self, date_from: str, date_to: str, fuel_type: str = "WIND") -> list[dict[str, Any]]:
        """Fetch half-hourly generation actuals, filtering to requested fuel type."""
        url = f"{self.base_url}/datasets/FUELHH/stream"
        params = {"settlementDateFrom": date_from, "settlementDateTo": date_to}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params, headers=self.headers)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return [r for r in data if r.get("fuelType") == fuel_type]
            return []

    async def fetch_windfor_forecasts(self, publish_from: str, publish_to: str) -> list[dict[str, Any]]:
        """Fetch WINDFOR wind forecasts published within date range."""
        url = f"{self.base_url}/datasets/WINDFOR/stream"
        params = {"publishDateTimeFrom": publish_from, "publishDateTimeTo": publish_to}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params, headers=self.headers)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return []
