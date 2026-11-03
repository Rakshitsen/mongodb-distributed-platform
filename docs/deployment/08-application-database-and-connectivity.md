# 08 — Application Database and Connectivity

## Objective

Create a separate application database and application user, insert test data, and document the MongoDB connection string and DNS SRV/TXT records from the working notes.

The application should not connect using the MongoDB administrator account.

## 1. Create app_db and its application user

Connect to the primary with `rsAdmin`, then:

```javascript
use app_db

db.createUser({
  user: "appUser",
  pwd: passwordPrompt(),
  roles: [
    { role: "readWrite", db: "app_db" }
  ]
})
```

The user is granted `readWrite` on `app_db`, rather than administrative privileges.

## 2. Insert application test data

Still inside `app_db`:

```javascript
db.users.insertOne(
  {
    name: "Replica Set Test User",
    email: "replication-test@example.com",
    environment: "development",
    createdAt: new Date()
  },
  {
    writeConcern: {
      w: "majority",
      wtimeout: 5000
    }
  }
)
```

The source notes use `w: "majority"` so the write is acknowledged by a majority of the configured replica-set voting members.

Verify:

```javascript
db.users.find().pretty()
```

## 3. MongoDB hostnames and private IPs

| Node | Hostname | Private IP |
|---|---|---|
| `mongodb-0` | `mongodb-0.mongodb.internal` | `10.0.1.32` |
| `mongodb-1` | `mongodb-1.mongodb.internal` | `10.0.1.33` |
| `mongodb-2` | `mongodb-2.mongodb.internal` | `10.0.1.34` |

The notes recommend hostnames rather than hard-coded IP addresses in the application URI.

## 4. Standard multi-host connection URI

```text
mongodb://appUser:<PASSWORD>@mongodb-0.mongodb.internal:27017,mongodb-1.mongodb.internal:27017,mongodb-2.mongodb.internal:27017/app_db?replicaSet=rs0&authSource=app_db&w=majority
```

Replace the placeholder with the URL-encoded application password. Do not commit a populated URI to Git.

The URI includes the three seed hosts, database `app_db`, replica-set name `rs0`, authentication database `app_db`, and majority write concern.

## 5. Create the DNS SRV record

The raw notes document:

```bash
gcloud dns record-sets create _mongodb._tcp.rs0.mongodb.internal. \
  --zone=mongodb-private-zone \
  --type=SRV \
  --ttl=300 \
  --rrdatas="0 0 27017 mongodb-0.mongodb.internal.","0 0 27017 mongodb-1.mongodb.internal.","0 0 27017 mongodb-2.mongodb.internal."
```

This record contains the three MongoDB endpoints.

## 6. Create the DNS TXT record

The raw notes document:

```bash
gcloud dns record-sets create rs0.mongodb.internal. \
  --zone=mongodb-private-zone \
  --type=TXT \
  --ttl=300 \
  --rrdatas='"replicaSet=rs0&authSource=admin"'
```

The recorded TXT value specifies `replicaSet=rs0` and `authSource=admin`.

## 7. Verify SRV and TXT records

```bash
dig +short SRV _mongodb._tcp.rs0.mongodb.internal
dig +short TXT rs0.mongodb.internal
```

Expected SRV targets:

```text
0 0 27017 mongodb-0.mongodb.internal.
0 0 27017 mongodb-1.mongodb.internal.
0 0 27017 mongodb-2.mongodb.internal.
```

Expected TXT value:

```text
"replicaSet=rs0&authSource=admin"
```

## 8. Test the SRV connection

The raw notes use the administrator account for this test:

```bash
mongosh "mongodb+srv://rsAdmin@rs0.mongodb.internal/app_db?tls=false" --password
```

After connecting:

```javascript
db.runCommand({ hello: 1 })

rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr
}))
```

The expected topology is one primary and two secondaries.

## 9. Application environment example from the notes

```dotenv
MONGO_URI=mongodb+srv://rsAdmin:<URL_ENCODED_PASSWORD>@rs0.mongodb.internal/app_db?tls=false
MONGO_DATABASE=app_db
LOG_LEVEL=INFO
```

This is the example recorded in the raw notes. The same notes create `appUser` specifically for application access, so the application should use that dedicated user rather than `rsAdmin`.

The notes use `authSource=admin` in the TXT record, while the standard multi-host URI uses `authSource=app_db`. Keep the authentication database consistent with the database where the chosen user was created.

The SRV test includes `tls=false`; this is documented as the command used in the notes, not as evidence of TLS configuration.

## 10. Application VM connectivity checks

Before application connection, the source notes require:

1. The application VM must resolve all three MongoDB DNS names and reach TCP port `27017`.
2. Its network tag must be allowed by a dedicated firewall rule.

Do not expose MongoDB to `0.0.0.0/0`.
