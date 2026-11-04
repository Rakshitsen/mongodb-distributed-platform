from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import configure_logging, request_logging_middleware
from app.core.settings import settings
from app.routes.logs import router as logs_router
from app.routes.products import router as products_router
from app.routes.system import router as system_router
from app.routes.replicaset import router as replicaset_router

configure_logging(settings.log_level)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(request_logging_middleware)
app.include_router(system_router)
app.include_router(logs_router)
app.include_router(products_router)
app.include_router(replicaset_router)
