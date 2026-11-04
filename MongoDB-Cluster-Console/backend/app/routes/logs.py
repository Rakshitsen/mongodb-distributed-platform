from fastapi import APIRouter

from app.core.logging import recent_logs

router = APIRouter()


@router.get("/logs")
def logs():
    return {"items": list(recent_logs)}
