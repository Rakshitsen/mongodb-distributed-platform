# MongoDB Cluster Console

A full-stack observability console for a MongoDB replica set. It provides a React dashboard and FastAPI API for inspecting replica-set health, PyMongo driver topology, sample database workloads, connection pools, and operational logs.

This application lives inside the `MongoDB-Infrastructure-Platform` repository. Infrastructure provisioning and disaster-recovery procedures are documented in the repository-level `docs/` directory.

## Capabilities

- **Replica-set status:** View members, `PRIMARY` / `SECONDARY` states, and health.
- **Driver topology:** Inspect PyMongo's view of connected servers, read preference, write concern, and writable-server information.
- **Sample product workload:** Exercise CRUD operations against a MongoDB `products` collection.
- **Read/write tests:** Trigger operations and inspect metadata such as execution host, selected MongoDB node, replica state, and latency.
- **Connection pools:** Inspect PyMongo connection-pool information.
- **Operation logs:** Review timestamps, operation type, endpoint, duration, and success/failure details.

This is an infrastructure observability and distributed-systems learning tool, not an e-commerce application.

## Application architecture

```text
Browser
  |
  v
React + Vite frontend (:3000)
  |
  | HTTP API (VITE_API_BASE)
  v
FastAPI backend (:8000)
  |
  | PyMongo
  v
MongoDB replica set (rs0)
```

| Path | Responsibility |
|---|---|
| `frontend/` | React dashboard served by Vite |
| `backend/app/main.py` | FastAPI entry point |
| `backend/app/core/` | Settings, MongoDB client/service, logging |
| `backend/app/models/` | API/data models |
| `backend/app/routes/` | System, replica-set, product, and log routes |
| `backend/requirements.txt` | Python dependencies |
| `systemd/` | Example systemd service units |

## Requirements

- Linux host or VM with network access to MongoDB.
- Python 3 and `venv`.
- Node.js and npm compatible with `frontend/package.json`.
- A MongoDB replica set and an application database/user.

```bash
python3 --version
node --version
npm --version
```

## Configuration

### Backend

Create `backend/.env`:

```dotenv
ENVIRONMENT=development
MONGO_URI=mongodb://<username>:<url-encoded-password>@<mongo-host-1>:27017,<mongo-host-2>:27017,<mongo-host-3>:27017/app_db?replicaSet=rs0&authSource=admin
MONGO_DATABASE=app_db
LOG_LEVEL=INFO
```

If private DNS SRV discovery is configured and verified, the URI may instead use:

```dotenv
MONGO_URI=mongodb+srv://<username>:<url-encoded-password>@rs0.mongodb.internal/app_db?tls=false
```

The SRV example assumes the DNS SRV/TXT records provide the replica-set discovery options. `mongodb+srv://` enables TLS by default; `tls=false` is only appropriate for the current lab configuration if MongoDB TLS is not enabled. Configure TLS and remove `tls=false` before using this pattern in production.

- Replace placeholders; do not include angle brackets.
- URL-encode special characters in the password.
- Use a least-privilege application user, normally with `readWrite` on `app_db`. Do not use the MongoDB root/admin account for application runtime access.
- Keep `.env` out of Git. Never commit credentials.

### Frontend

Create `frontend/.env`:

```dotenv
VITE_API_BASE=http://<application-vm-address>:8000
```

This address is used by the browser. When accessing the dashboard remotely, `localhost` refers to the browser user's machine, not the application VM. Restart Vite after changing environment variables.

## Manual startup

Run commands from the `MongoDB-Cluster-Console/` directory. Start the backend and frontend in separate terminals.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Create backend/.env before starting.
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

In another terminal:

```bash
cd frontend
npm ci

# Create frontend/.env before starting.
npm run dev -- --host 0.0.0.0
```

The Vite port is configured in `vite.config.js` (currently `3000`). Open:

```text
http://<application-vm-address>:3000
```

Verify the backend:

```bash
curl http://127.0.0.1:8000/health
```

If the browser cannot reach the API, check `VITE_API_BASE`, backend bind address, firewall rules, CORS configuration, and backend logs.

## Nginx and public DNS deployment

The application host also has an Nginx HTTPS virtual host configured for `chailearn.rakops.in`. Public DNS for the domain is managed through **Cloudflare**. The public DNS record was updated in Cloudflare to direct the domain to the application host.

This is a host-level reverse-proxy configuration. The Nginx configuration supplied for the host currently contains these routes:

| Public path | Nginx upstream | Purpose shown in current Nginx config |
|---|---|---|
| `/` | `http://127.0.0.1:3001` | TanStack Start SSR frontend |
| `/api/` | `http://127.0.0.1:3000` | Backend API |
| `/docker/` | `http://127.0.0.1:3002/` | Docker frontend |
| `/docker/api/` | `http://127.0.0.1:3003/api/` | Docker backend API |

Nginx configuration file:

```text
/etc/nginx/sites-enabled/default
```

The HTTPS virtual host uses:

```text
/etc/nginx/ssl/fullchain.pem
/etc/nginx/ssl/privkey.pem
```

The HTTP virtual host redirects requests to HTTPS. The TLS configuration shown enables TLS 1.2 and TLS 1.3.

### Important separation from the MongoDB Cluster Console

The upstream ports in the current `chailearn.rakops.in` Nginx configuration do **not** match the MongoDB Cluster Console's documented development ports (`3000` for Vite and `8000` for FastAPI). Do not assume that this existing virtual host currently publishes the MongoDB Cluster Console. If the console is to be served through Nginx, add a dedicated virtual host or explicit routes whose upstreams match the actual console processes.

### Operational checks

After modifying Nginx configuration:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

Inspect logs when troubleshooting:

```bash
sudo tail -n 100 /var/log/nginx/access.log
sudo tail -n 100 /var/log/nginx/error.log
```

Check the public DNS record in Cloudflare and confirm that the domain resolves to the intended public endpoint. If Cloudflare proxying is enabled, the public DNS lookup may return Cloudflare addresses rather than the VM's origin IP; verify the record and proxy mode in the Cloudflare dashboard.

Do not commit TLS private keys or certificate material to Git. Keep `privkey.pem` restricted to the required system account (the supplied host shows root ownership and mode `600`). Renewed certificates must be installed at the configured paths before reloading Nginx.

## systemd deployment

The repository includes:

```text
systemd/
├── infra-learning-backend.service
└── infra-learning-frontend.service
```

Review both unit files before installing. Confirm `User`, `Group`, `WorkingDirectory`, `EnvironmentFile`, `ExecStart`, and paths match the target host. The unit files may need adjustment for the deployment directory and service account.

A typical installation flow is:

```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now infra-learning-backend.service
sudo systemctl enable --now infra-learning-frontend.service
```

Inspect status and logs:

```bash
sudo systemctl status infra-learning-backend.service --no-pager
sudo systemctl status infra-learning-frontend.service --no-pager
sudo journalctl -u infra-learning-backend.service -f
sudo journalctl -u infra-learning-frontend.service -f
```

Ensure the backend environment file exists and is readable by the configured service account. Protect it because it contains credentials. Confirm the frontend service receives the correct API base URL.

## API areas

The route modules are:

| Module | Area |
|---|---|
| `routes/system.py` | System/application and database information |
| `routes/replicaset.py` | Replica-set and driver topology |
| `routes/products.py` | Sample product workload and read/write tests |
| `routes/logs.py` | Logs |

The application includes health, system/database information, replica-set status, driver topology, connection-pool, product, read/write test, and log functionality. Consult the route source for exact endpoint paths and request/response schemas; update this README when the API changes.

## Troubleshooting

### MongoDB operations fail

- Check `MONGO_URI`, `MONGO_DATABASE`, and `authSource`.
- Confirm the application VM resolves and reaches MongoDB members on TCP `27017`.
- Check replica-set health and MongoDB logs.
- Confirm the application user has the required permissions on `app_db`.

### Frontend loads but API requests fail

- Ensure `VITE_API_BASE` is reachable from the browser and is not incorrectly set to browser-side `localhost`.
- Confirm the backend listens on the expected port.
- Check browser developer tools, CORS settings, and backend logs.
- Restart Vite after changing frontend environment variables.

### Nginx returns 502 Bad Gateway

- Confirm the relevant upstream process is running and listening on the port configured in the Nginx `proxy_pass`.
- Test the upstream locally with `curl`.
- Run `sudo nginx -t` and inspect `/var/log/nginx/error.log`.
- Confirm the Nginx route is intended for this application; do not assume ports used by another service are interchangeable.

## Security

- Never commit `.env`, passwords, MongoDB keyfiles, private keys, or service-account credentials.
- Do not use the MongoDB root user for application connections.
- Restrict network access to frontend, backend, and MongoDB ports.
- The lab configuration described here currently uses MongoDB without TLS; enable TLS before using it over untrusted networks.
- Avoid logging credentials or full connection strings.

## Related documentation

From this directory:

- `../docs/architecture.md` — infrastructure architecture.
- `../docs/operations.md` — operational procedures.
- `../docs/deployment/` — infrastructure and MongoDB deployment guides.
- `../docs/deployment/09-mongodb-cross-region-dr-runbook.md` — Mumbai/Delhi DR runbook.
