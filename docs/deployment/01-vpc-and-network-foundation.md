# 01 — VPC and Network Foundation

## Objective

Use the existing custom GCP VPC as the network foundation for the MongoDB deployment. The supplied notes treat the VPC as existing infrastructure; they do not contain the actual VPC creation procedure.

## Network details

| Resource | Recorded value |
|---|---|
| Project | `rakops-lab-509318` |
| VPC | `rakops-vpc-dev` |
| Mumbai subnet | `mumbai-subnet` |
| Region | `asia-south1` |
| Primary subnet range | `10.0.0.0/20` |
| Pods secondary range | `10.4.0.0/14` |
| Services secondary range | `10.0.16.0/20` |

The secondary ranges are included in the source notes as part of the broader GKE network setup.

## 1. Verify project and account

Run from the Ubuntu workstation:

```bash
gcloud config get-value project
gcloud config get-value account
```

If needed:

```bash
gcloud config set project rakops-lab-509318
```

## 2. Audit the existing network

```bash
gcloud compute networks describe rakops-vpc-dev

gcloud compute networks subnets list \
  --filter="network:rakops-vpc-dev"

gcloud compute firewall-rules list \
  --filter="network:rakops-vpc-dev"

gcloud compute routers list

gcloud compute routers nats list \
  --router=rakops-vpc-dev-router \
  --router-region=asia-south1

gcloud compute instances list
```

These commands inspect the VPC, subnets, firewall rules, routers, NAT, and existing VMs.

## 3. Create the MongoDB internal firewall rule

The recorded ingress rule permits TCP `27017` from source-tagged `mongodb-node` VMs to target-tagged `mongodb-node` VMs:

```bash
gcloud compute firewall-rules create allow-mongodb-internal \
  --direction=INGRESS \
  --priority=1000 \
  --network=rakops-vpc-dev \
  --action=ALLOW \
  --rules=tcp:27017 \
  --source-tags=mongodb-node \
  --target-tags=mongodb-node
```

## 4. Create the lab ICMP rule

```bash
gcloud compute firewall-rules create allow-icmp-mongodb-lab \
  --network=rakops-vpc-dev \
  --priority=1000 \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=icmp \
  --source-ranges=10.0.1.0/24
```

## Network access notes

- MongoDB VMs are created without external IP addresses.
- MongoDB member communication uses private connectivity.
- TCP `27017` is not intended to be exposed publicly.
- The initial VM is tagged `mongodb-node` and `iap-ssh`.
- SSH administration is performed through IAP in the VM provisioning notes.

The raw notes refer to an existing IAP firewall rule but do not provide its creation command.
