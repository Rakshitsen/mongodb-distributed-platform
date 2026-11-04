import socket
import time
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Body
from bson.errors import InvalidId
from pymongo.write_concern import WriteConcern

from app.core.mongo import mongo_service
from app.models.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])
collection = mongo_service.database["products"]


def serialize(doc):
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "sku": doc["sku"],
        "description": doc.get("description"),
        "price": doc["price"],
    }


@router.get("", response_model=list[ProductOut])
def list_products():
    return [serialize(doc) for doc in collection.find().sort("_id", -1)]


@router.get("/test-read")
def test_read():
    start = time.perf_counter()
    # Execute a simple find
    doc = collection.find_one()
    latency = round((time.perf_counter() - start) * 1000, 2)
    
    # Get info about the server we are talking to
    try:
        is_master = mongo_service.client.admin.command("isMaster")
        server_used = f"{mongo_service.client.address[0]}:{mongo_service.client.address[1]}" if mongo_service.client.address else "unknown"
        replica_state = "PRIMARY" if is_master.get("ismaster") else "SECONDARY"
    except Exception:
        server_used = "unknown"
        replica_state = "unknown"

    return {
        "hostname_executing": socket.gethostname(),
        "mongodb_server": server_used,
        "replica_state": replica_state,
        "latency_ms": latency,
        "data_found": doc is not None
    }


@router.post("/test-write")
def test_write(payload: dict = Body(...)):
    # payload can be {"w": "majority"} or {"w": 1}
    wc_val = payload.get("w", 1)
    wc = WriteConcern(w=wc_val)
    
    coll_with_wc = collection.with_options(write_concern=wc)
    
    start = time.perf_counter()
    test_sku = f"test-{int(time.time())}"
    result = coll_with_wc.insert_one({
        "name": "Test Product",
        "sku": test_sku,
        "price": 0.0,
        "test": True,
        "created_at": datetime.now(timezone.utc)
    })
    execution_time = round((time.perf_counter() - start) * 1000, 2)
    
    # Get primary host
    try:
        is_master = mongo_service.client.admin.command("isMaster")
        primary = is_master.get("primary")
    except Exception:
        primary = "unknown"

    return {
        "acknowledged": result.acknowledged,
        "write_concern": wc_val,
        "execution_time_ms": execution_time,
        "primary_hostname": primary
    }


@router.post("", response_model=ProductOut)
def create_product(payload: ProductCreate):
    # Check if SKU already exists
    if collection.find_one({"sku": payload.sku}):
        raise HTTPException(status_code=400, detail="SKU already exists")
    result = collection.insert_one(payload.model_dump())
    doc = collection.find_one({"_id": result.inserted_id})
    return serialize(doc)


@router.get("/{sku}", response_model=ProductOut)
def get_product(sku: str):
    doc = collection.find_one({"sku": sku})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return serialize(doc)


@router.put("/{sku}", response_model=ProductOut)
def update_product(sku: str, payload: ProductUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = collection.update_one({"sku": sku}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    doc = collection.find_one({"sku": sku})
    return serialize(doc)


@router.delete("/{sku}")
def delete_product(sku: str):
    result = collection.delete_one({"sku": sku})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": True}
