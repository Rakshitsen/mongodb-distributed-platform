# 02 — Provision the Initial MongoDB VM

## Objective

Create the first Ubuntu VM in the existing GCP VPC. It serves as the pilot environment for MongoDB installation, configuration, and operational testing, and later becomes the first replica-set member.

## VM configuration

| Property | Value |
|---|---|
| Name | `mongodb-0` |
| Project | `rakops-lab-509318` |
| Region / zone | `asia-south1` / `asia-south1-a` |
| Machine type | `e2-medium` |
| vCPU / memory | 2 / 4 GB |
| OS | Ubuntu 24.04 LTS |
| Boot disk | 30 GB `pd-balanced` |
| VPC / subnet | `rakops-vpc-dev` / `mumbai-subnet` |
| External IP | None |
| Network tags | `mongodb-node`, `iap-ssh` |

These are the initial lab specifications in the notes.

## 1. Verify the active project

```bash
gcloud config get-value project
gcloud config set project rakops-lab-509318
```

Use the `set` command only if the active project needs changing.

## 2. Create mongodb-0

```bash
gcloud compute instances create mongodb-0 \
  --project=rakops-lab-509318 \
  --zone=asia-south1-a \
  --machine-type=e2-medium \
  --network=rakops-vpc-dev \
  --subnet=mumbai-subnet \
  --no-address \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-balanced \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --tags=mongodb-node,iap-ssh
```

`--no-address` prevents assignment of an external IP. The network, subnet, image family, disk, and tags are explicitly set in this command.

## 3. Verify the VM and private IP

```bash
gcloud compute instances describe mongodb-0 \
  --zone=asia-south1-a

gcloud compute instances list

gcloud compute instances describe mongodb-0 \
  --zone=asia-south1-a \
  --format="get(networkInterfaces[0].networkIP)"
```

The subsequent notes record `10.0.1.32` as the private IP.

## 4. Connect through IAP

```bash
gcloud compute ssh mongodb-0 \
  --zone=asia-south1-a \
  --tunnel-through-iap
```

The source notes state that an IAP firewall rule must allow TCP `22` from Google's IAP range.

## 5. Verify OS and network

Run after connecting:

```bash
hostnamectl
lsb_release -a
free -h
df -h
ip -br address
ip route
```

The notes recommend retaining these outputs as deployment evidence.

## Expected result

`mongodb-0` exists in the Mumbai region, uses the existing VPC and subnet, has no public IP, is accessible through IAP, and has had its OS and network configuration checked. MongoDB installation is the next step.
