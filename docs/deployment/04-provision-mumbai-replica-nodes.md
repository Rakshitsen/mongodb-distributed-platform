# 04 — Provision the Mumbai Replica-set Nodes

## Objective

Create a reusable machine image from `mongodb-0` and use it to provision two additional Mumbai VMs: `mongodb-1` and `mongodb-2`.

## 1. Stop and disable MongoDB before image creation

The source notes record this command on `mongodb-0`:

```bash
sudo systemctl disable --now mongod
```

## 2. Create the machine image

Run from the workstation:

```bash
gcloud compute machine-images create mongodb-image \
  --project=rakops-lab-509318 \
  --source-instance=mongodb-0 \
  --source-instance-zone=asia-south1-a \
  --storage-location=asia \
  --description="Ubuntu 24.04 with MongoDB 9.0.4 preinstalled"
```

## 3. Create mongodb-1

```bash
gcloud compute instances create mongodb-1 \
  --project=rakops-lab-509318 \
  --zone=asia-south1-b \
  --source-machine-image=mongodb-image
```

## 4. Create mongodb-2

```bash
gcloud compute instances create mongodb-2 \
  --project=rakops-lab-509318 \
  --zone=asia-south1-c \
  --source-machine-image=mongodb-image
```

## 5. List MongoDB VMs

```bash
gcloud compute instances list \
  --filter="name~mongodb"
```

## 6. Check MongoDB service and listeners

On the relevant VMs:

```bash
sudo systemctl status mongod.service
sudo systemctl enable mongod.service
sudo ss -tulpn
```

## 7. Test connectivity between Mumbai nodes

The source notes record these successful tests from `mongodb-0`:

```bash
nc -vz 10.0.1.33 27017
nc -vz 10.0.1.34 27017
```

Recorded output:

```text
Connection to 10.0.1.33 27017 port [tcp/*] succeeded!
Connection to 10.0.1.34 27017 port [tcp/*] succeeded!
```

The notes then call for validation on each of the three Mumbai VMs.

## Mumbai VM inventory in the subsequent notes

| VM | Zone | Private IP |
|---|---|---|
| `mongodb-0` | `asia-south1-a` | `10.0.1.32` |
| `mongodb-1` | `asia-south1-b` | `10.0.1.33` |
| `mongodb-2` | `asia-south1-c` | `10.0.1.34` |

The raw creation commands for `mongodb-1` and `mongodb-2` do not explicitly specify network, subnet, external-IP, or network-tag flags. The IPs above are those recorded later in the DNS and replica-set notes.
