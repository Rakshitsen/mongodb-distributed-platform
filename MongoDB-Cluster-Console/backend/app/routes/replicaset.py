from fastapi import APIRouter
from app.core.mongo import mongo_service

router = APIRouter(tags=["replicaset"])

@router.get("/replicaset/status")
def get_replica_set_status():
    status = mongo_service.get_replica_set_status()
    
    if "error" in status:
        return status
        
    members = []
    for member in status.get("members", []):
        members.append({
            "host": member.get("name"),
            "state": member.get("stateStr"),
            "health": member.get("health")
        })
        
    return {
        "replicaSet": status.get("set"),
        "current_primary": next((m.get("name") for m in status.get("members", []) if m.get("stateStr") == "PRIMARY"), None),
        "members": members
    }

@router.get("/driver/topology")
def get_driver_topology():
    return mongo_service.get_driver_topology()

@router.get("/driver/pool")
def get_driver_pool():
    return mongo_service.get_pool_stats()
