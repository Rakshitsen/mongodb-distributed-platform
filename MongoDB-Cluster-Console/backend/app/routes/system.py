from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.core.mongo import mongo_service
from app.core.settings import settings

router = APIRouter()
started_at = datetime.now(timezone.utc)


@router.get("/health")
def health(request: Request):
    healthy, message = mongo_service.ping()
    request.state.mongo_status = message
    return {
        "application": "ok",
        "mongodb": "ok" if healthy else "degraded",
        "database_reachable": healthy,
        "current_error": None if healthy else message,
    }


@router.get("/ready")
def ready(request: Request):
    healthy, message = mongo_service.ping()
    request.state.mongo_status = message
    return {
        "ready": healthy,
        "database_reachable": healthy,
        "reason": None if healthy else message,
    }


@router.get("/info")
def info():
    mongo_info = mongo_service.info()
    return {
        "application": settings.app_name,
        "environment": settings.environment,
        "hostname": __import__("socket").gethostname(),
        "database": mongo_info["database"],
        "database_version": mongo_info["version"],
        "mongodb_host": mongo_info["host"],
        "started_at": started_at.isoformat(),
        "uptime_seconds": int((datetime.now(timezone.utc) - started_at).total_seconds()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/version")
def version():
    return {"version": "1.0.0", "service": settings.app_name}


@router.get("/metrics-ready")
def metrics_ready():
    healthy, _ = mongo_service.ping()
    return {"metrics_ready": healthy}


@router.get("/database/info")
def database_info():
    return mongo_service.info()


@router.get("/database/stats")
def database_stats():
    return mongo_service.stats()

