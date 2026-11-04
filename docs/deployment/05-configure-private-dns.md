# 05 — Configure Private DNS for MongoDB

## Objective

Create a private Cloud DNS zone and assign stable internal DNS names to the three Mumbai MongoDB VMs.

## DNS configuration

| Property | Value |
|---|---|
| Zone | `mongodb-private-zone` |
| DNS suffix | `mongodb.internal.` |
| Visibility | Private |
| Authorized VPC | `rakops-vpc-dev` |
| TTL | 300 seconds |

## 1. Enable Cloud DNS API

```bash
gcloud services enable dns.googleapis.com \
  --project=rakops-lab-509318
```

## 2. Create the private zone

```bash
gcloud dns managed-zones create mongodb-private-zone \
  --project=rakops-lab-509318 \
  --description="Private DNS zone for MongoDB multi-region replica set" \
  --dns-name="mongodb.internal." \
  --visibility=private \
  --networks=rakops-vpc-dev
```

## 3. Create A records for the Mumbai nodes

### mongodb-0

```bash
gcloud dns record-sets create mongodb-0.mongodb.internal. \
  --project=rakops-lab-509318 \
  --zone=mongodb-private-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=10.0.1.32
```

### mongodb-1

```bash
gcloud dns record-sets create mongodb-1.mongodb.internal. \
  --project=rakops-lab-509318 \
  --zone=mongodb-private-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=10.0.1.33
```

### mongodb-2

```bash
gcloud dns record-sets create mongodb-2.mongodb.internal. \
  --project=rakops-lab-509318 \
  --zone=mongodb-private-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=10.0.1.34
```

## 4. List DNS records

```bash
gcloud dns record-sets list \
  --project=rakops-lab-509318 \
  --zone=mongodb-private-zone
```

## 5. Verify name resolution from each MongoDB VM

```bash
getent hosts mongodb-0.mongodb.internal
getent hosts mongodb-1.mongodb.internal
getent hosts mongodb-2.mongodb.internal
```

## 6. Verify MongoDB port connectivity using DNS names

```bash
nc -vz mongodb-0.mongodb.internal 27017
nc -vz mongodb-1.mongodb.internal 27017
nc -vz mongodb-2.mongodb.internal 27017
```

## Resulting DNS mapping

| DNS name | Address |
|---|---|
| `mongodb-0.mongodb.internal` | `10.0.1.32` |
| `mongodb-1.mongodb.internal` | `10.0.1.33` |
| `mongodb-2.mongodb.internal` | `10.0.1.34` |

These names are used as the replica-set member hostnames in the subsequent configuration.
