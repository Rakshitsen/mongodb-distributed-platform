# 06 — Configure Replica-set Member Authentication

## Objective

Configure internal authentication between the three MongoDB members using a shared keyfile. Set the replica-set name to `rs0` and configure each node to listen on its own private IP.

## 1. Generate the keyfile

Generate it on the local Linux workstation, not on a MongoDB VM:

```bash
openssl rand -base64 756 > mongodb-keyfile
chmod 600 mongodb-keyfile
```

Do not display or commit the keyfile contents.

## 2. Copy the same keyfile to all three VMs

### mongodb-0

```bash
gcloud compute scp mongodb-keyfile mongodb-0:/tmp/mongodb-keyfile \
  --project=rakops-lab-509318 \
  --zone=asia-south1-a \
  --tunnel-through-iap
```

### mongodb-1

```bash
gcloud compute scp mongodb-keyfile mongodb-1:/tmp/mongodb-keyfile \
  --project=rakops-lab-509318 \
  --zone=asia-south1-b \
  --tunnel-through-iap
```

### mongodb-2

```bash
gcloud compute scp mongodb-keyfile mongodb-2:/tmp/mongodb-keyfile \
  --project=rakops-lab-509318 \
  --zone=asia-south1-c \
  --tunnel-through-iap
```

## 3. Install the keyfile on each VM

Run on all three VMs:

```bash
sudo install -o mongodb -g mongodb -m 400 \
  /tmp/mongodb-keyfile /etc/mongodb-keyfile

sudo rm /tmp/mongodb-keyfile
```

Verify owner, group, and mode:

```bash
sudo stat -c '%U %G %a %n' /etc/mongodb-keyfile
```

## 4. Verify keyfile consistency

Run on all three nodes:

```bash
sudo sha256sum /etc/mongodb-keyfile
```

The SHA-256 hashes must match exactly across the three nodes.

## 5. Configure mongodb-0

Edit `/etc/mongod.conf`:

```bash
sudo nano /etc/mongod.conf
```

Keep the existing configuration and update the relevant sections:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.1.32

security:
  keyFile: /etc/mongodb-keyfile

replication:
  replSetName: rs0
```

## 6. Configure mongodb-1

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.1.33

security:
  keyFile: /etc/mongodb-keyfile

replication:
  replSetName: rs0
```

## 7. Configure mongodb-2

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.1.34

security:
  keyFile: /etc/mongodb-keyfile

replication:
  replSetName: rs0
```

Each node uses its own private IP while sharing the same keyfile and replica-set name.

## 8. Restart MongoDB on all three nodes

```bash
sudo systemctl restart mongod
sudo systemctl status mongod --no-pager
sudo journalctl -u mongod -n 30 --no-pager
```

Replica-set initiation is covered in the next document.
