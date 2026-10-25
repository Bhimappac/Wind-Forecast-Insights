import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import router as api_router
from backend.app.config import settings
from backend.app.services.data_store import data_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wind_forecast_insights")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load snapshot Parquet/JSON data into in-memory store
    logger.info("Initializing Wind Forecast Insights backend...")
    try:
        act_cnt, fc_cnt = data_store.load_snapshots()
        logger.info(
            "Snapshot loaded successfully: %d actuals, %d forecasts.",
            act_cnt,
            fc_cnt,
        )
    except Exception as e:
        logger.error("Failed to load data snapshot: %s", e)
    yield
    logger.info("Shutting down Wind Forecast Insights backend.")


app = FastAPI(
    title="Wind Forecast Insights API",
    description=(
        "Production API for the UK Day-Ahead Power Trading Team. "
        "Provides decision-time wind generation forecasts and quantified accuracy metrics "
        "using official Elexon BMRS data for January 2026."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["System"])
async def root():
    return {
        "name": "Wind Forecast Insights API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
        "description": "UK Day-Ahead Wind Forecast & Trading Accuracy Service",
    }
