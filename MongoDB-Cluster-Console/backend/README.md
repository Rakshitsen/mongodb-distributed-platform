# Backend

FastAPI service for the infrastructure learning platform.

Key responsibilities:

- expose health and readiness endpoints
- expose database info and stats endpoints
- provide CRUD endpoints for a small `products` collection
- log every request with timing and MongoDB outcome

Run with:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

