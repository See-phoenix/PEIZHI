from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import builds, parts, prices, servers
from app.config import get_settings
from app.db import SessionLocal, init_db
from app.providers.serpapi import SerpApiShoppingProvider
from app.schemas import HealthOut
from app.seed import seed_parts

APP_VERSION = "0.2.0"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        seed_parts(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PEIZHI 国内配智 API",
        description="API-first：装机推荐 + 云服务器/VPS 选型；多通道价格与用户纠价权威库",
        version=APP_VERSION,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(parts.router)
    app.include_router(builds.router)
    app.include_router(prices.router)
    app.include_router(servers.router)

    @app.get("/health", response_model=HealthOut, tags=["system"])
    def health() -> HealthOut:
        return HealthOut(
            status="ok",
            version=APP_VERSION,
            serpapi_configured=SerpApiShoppingProvider().configured,
        )

    return app


app = create_app()


def export_openapi(target: Path | None = None) -> Path:
    out = target or (Path(__file__).resolve().parents[2] / "packages" / "openapi" / "openapi.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    import json

    out.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
