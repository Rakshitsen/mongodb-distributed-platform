import socket
import time
from datetime import datetime, timezone
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.core.settings import settings
from app.core.logging import MongoCommandLogger


class MongoService:
    def __init__(self) -> None:
        self.client = MongoClient(
            settings.mongo_uri, 
            serverSelectionTimeoutMS=2000,
            event_listeners=[MongoCommandLogger()]
        )
        self.database = self.client[settings.mongo_database]
        self.last_successful_connection: datetime | None = None
        self.last_failed_connection: datetime | None = None
        self.last_error: str | None = None

    def ping(self) -> tuple[bool, str]:
        try:
            self.client.admin.command("ping")
            self.last_successful_connection = datetime.now(timezone.utc)
            self.last_error = None
            return True, "ok"
        except PyMongoError as exc:
            self.last_failed_connection = datetime.now(timezone.utc)
            self.last_error = str(exc)
            return False, str(exc)

    def info(self) -> dict[str, Any]:
        healthy, message = self.ping()
        server_info = self.client.server_info() if healthy else {}
        build_info = server_info if isinstance(server_info, dict) else {}
        return {
            "database": settings.mongo_database,
            "uri": settings.mongo_uri,
            "healthy": healthy,
            "message": message,
            "version": build_info.get("version"),
            "host": self.client.address[0] if self.client.address else None,
            "last_successful_connection": self.last_successful_connection.isoformat() if self.last_successful_connection else None,
            "last_failed_connection": self.last_failed_connection.isoformat() if self.last_failed_connection else None,
            "current_error": self.last_error,
        }

    def stats(self) -> dict[str, Any]:
        return self.database.command("dbstats")

    def get_replica_set_status(self) -> dict[str, Any]:
        try:
            return self.client.admin.command("replSetGetStatus")
        except PyMongoError as exc:
            return {"error": str(exc), "healthy": False}

    def get_driver_topology(self) -> dict[str, Any]:
        desc = self.client.topology_description
        servers = []
        for server in desc.server_descriptions().values():
            servers.append({
                "address": f"{server.address[0]}:{server.address[1]}",
                "type": server.server_type_name,
                "state": "CONNECTED" if server.is_writable or server.is_readable else "DISCONNECTED"
            })
        
        return {
            "read_preference": self.client.read_preference.name,
            "write_concern": self.client.write_concern.document,
            "replica_set_name": desc.replica_set_name,
            "connected_nodes": servers,
            "current_writable_server": f"{desc.primary[0]}:{desc.primary[1]}" if desc.primary else None
        }

    def get_pool_stats(self) -> dict[str, Any]:
        # PyMongo doesn't expose connection pool stats easily in newer versions
        # but we can provide some info from the topology
        desc = self.client.topology_description
        return {
            "replica_set_members": len(desc.server_descriptions()),
            "pool_size": self.client.options.pool_options.max_pool_size,
            "metadata": "PyMongo manages pools per-server internally."
        }


mongo_service = MongoService()

