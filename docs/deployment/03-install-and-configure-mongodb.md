# 03 — Install and Configure MongoDB

## Objective

Install MongoDB Community Edition on `mongodb-0` (Ubuntu 24.04 LTS) and configure the service to listen on the VM's private network interface.

## Version discrepancy in the source notes

The supplied files are inconsistent:

- The initial installation metadata table says MongoDB `8.0.34`.
- The repository configuration uses the MongoDB 9.0 APT repository and `server-9.asc`.
- The package installation commands pin `9.0.4`.
- Later service and network validation notes also identify `9.0.4`.

The commands below follow the recorded 9.0.4 installation procedure. The discrepancy is not silently resolved; verify the actual installed version on the VM.

## 1. Install prerequisites

```bash
sudo apt update
sudo apt-get install gnupg curl
```

## 2. Import the MongoDB signing key

```bash
curl -fsSL https://pgp.mongodb.com/server-9.asc | \
  sudo gpg --dearmor \
  --output /usr/share/keyrings/mongodb-server-9.gpg
```

This downloads the public signing key and converts the ASCII-armored key into a GPG keyring file for APT package signature verification.

## 3. Add the MongoDB APT repository

```bash
echo "deb [ arch=amd64 signed-by=/usr/share/keyrings/mongodb-server-9.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/9.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-9.0.list

sudo apt-get update
```

## 4. Check available versions

```bash
apt-cache madison mongodb-org
```

## 5. Install the pinned packages

The following exact package list and version are recorded in the raw notes:

```bash
sudo apt-get install -y \
  mongodb-org=9.0.4 \
  mongodb-org-database=9.0.4 \
  mongodb-org-server=9.0.4 \
  mongodb-org-shell=9.0.4 \
  mongodb-org-mongos=9.0.4 \
  mongodb-org-tools=9.0.4 \
  mongodb-org-database-tools-extra=9.0.4
```

## 6. Verify version and hold packages

```bash
mongod --version
```

The notes record holding the MongoDB packages:

```bash
sudo apt-mark hold \
  mongodb-org \
  mongodb-org-database \
  mongodb-org-server \
  mongodb-org-shell \
  mongodb-org-mongos \
  mongodb-org-tools \
  mongodb-org-database-tools-extra
```

## 7. Inspect the initial network listener

The initial MongoDB listener was recorded as:

```text
tcp LISTEN 127.0.0.1:27017
```

Initial `/etc/mongod.conf` network configuration:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

This permits local connections only. A connection to the VM's private IP is refused when MongoDB is not listening on that interface. A VPC firewall rule does not change MongoDB's bind configuration.

## 8. Update network binding

Edit the configuration:

```bash
sudo nano /etc/mongod.conf
```

The notes record changing the listener to:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0
```

The later per-node replica-set configuration narrows the listener to loopback and the node's own private IP; that configuration is documented in [06 — Replica-set member authentication](06-replica-set-member-authentication.md).

## 9. Restart and validate

```bash
sudo systemctl restart mongod
sudo systemctl status mongod
sudo ss -lntp | grep 27017
mongosh --eval 'db.adminCommand({ ping: 1 })'
```

From the application server, the source notes use:

```bash
nc -vz 10.0.1.32 27017
```

## Validation recorded in the notes

For `mongodb-0`, the notes record:
- `mongod` as `active (running)`;
- listeners on `10.0.1.32:27017` and `127.0.0.1:27017`;
- a successful TCP connection from the ChaiLearn application server to `10.0.1.32:27017`.

These observations document standalone service and TCP reachability at the time of the recorded tests. Replica-set setup and database authentication are separate steps.
