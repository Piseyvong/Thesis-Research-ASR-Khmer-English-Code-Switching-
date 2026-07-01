from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.storage.database import init_db
from app.routes.asr_routes import router as asr_router
from app.routes.request_routes import router as request_router
from app.routes.manager_routes import router as manager_router
from app.routes.meta_routes import router as meta_router
from app.routes.email_routes import router as email_router
from app.services.seed_service import seed_if_empty


def create_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    log = logging.getLogger("app")

    app = FastAPI(title="Khmer-English Speech Request System", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"] ,
        allow_headers=["*"] ,
    )

    @app.on_event("startup")
    def _startup() -> None:
        init_db()
        seed_if_empty()
        log.info("Backend started")

    app.include_router(meta_router, prefix="/api")
    app.include_router(asr_router, prefix="/api/asr")
    app.include_router(request_router, prefix="/api/requests")
    app.include_router(manager_router, prefix="/api/manager")
    app.include_router(email_router, prefix="/api")

    return app


app = create_app()
