# 07 — Initialize and Validate the MongoDB Replica Set

## Objective

Initialize the three-member replica set from `mongodb-0` and validate member health.

## 1. Verify DNS from all three nodes

Run on each VM:

```bash
getent hosts mongodb-0.mongodb.internal
getent hosts mongodb-1.mongodb.internal
getent hosts mongodb-2.mongodb.internal
```

All three names must resolve from every node.

## 2. Connect locally to mongodb-0

```bash
mongosh --host 127.0.0.1 --port 27017
```

## 3. Initiate rs0

Run inside `mongosh`:

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    {
      _id: 0,
      host: "mongodb-0.mongodb.internal:27017",
      priority: 2
    },
    {
      _id: 1,
      host: "mongodb-1.mongodb.internal:27017",
      priority: 1
    },
    {
      _id: 2,
      host: "mongodb-2.mongodb.internal:27017",
      priority: 1
    }
  ]
})
```

Expected immediate response:

```javascript
{ ok: 1 }
```

This means the configuration request was accepted; it does not prove that all members have already become healthy.

## 4. Observe the election and member states

Wait for the election, then run:

```javascript
rs.status()
```

For a focused view:

```javascript
rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health
}))
```

Expected state:

| Member | Expected state |
|---|---|
| `mongodb-0` | `PRIMARY` |
| `mongodb-1` | `SECONDARY` |
| `mongodb-2` | `SECONDARY` |

The higher priority makes `mongodb-0` preferred, not permanently guaranteed, to be primary.

## 5. Create the MongoDB administrator

The source procedure creates the first user while connected locally, before users exist. Inside the current shell:

```javascript
use admin

db.createUser({
  user: "rsAdmin",
  pwd: passwordPrompt(),
  roles: [
    { role: "root", db: "admin" }
  ]
})
```

Enter a strong password when prompted. Do not place the password directly in the command or commit it to Git.

Expected response:

```javascript
{ ok: 1 }
```

## 6. Verify authenticated access

Exit the current shell:

```javascript
exit
```

Reconnect:

```bash
mongosh \
  --host mongodb-0.mongodb.internal \
  --port 27017 \
  --username rsAdmin \
  --authenticationDatabase admin \
  --password
```

Enter the password when prompted, then run:

```javascript
db.adminCommand({ connectionStatus: 1 })

rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health
}))
```

Confirm authentication succeeds and all three members remain healthy.

## 7. Insert a replication test document on the primary

```javascript
use dr_lab

db.replication_test.insertOne({
  message: "MongoDB replication validation",
  source: "mongodb-0",
  createdAt: new Date()
})
```

The source notes expect an acknowledged write and inserted ID.

## 8. Verify replication on mongodb-1

Open a separate SSH session to `mongodb-1` and connect:

```bash
mongosh \
  --host mongodb-1.mongodb.internal \
  --port 27017 \
  --username rsAdmin \
  --authenticationDatabase admin \
  --password
```

Inside `mongosh`:

```javascript
db.getMongo().setReadPref("secondary")
use dr_lab
db.replication_test.find().pretty()
```

The inserted test document should be visible.

## 9. Verify replication on mongodb-2

```bash
mongosh \
  --host mongodb-2.mongodb.internal \
  --port 27017 \
  --username rsAdmin \
  --authenticationDatabase admin \
  --password
```

Then:

```javascript
db.getMongo().setReadPref("secondary")
use dr_lab
db.replication_test.find().pretty()
```

The same test document should be visible on `mongodb-2`.

## Expected outcome

- Replica set `rs0` is initialized.
- `mongodb-0` is the preferred primary.
- `mongodb-1` and `mongodb-2` are secondaries.
- Administrator authentication works.
- A document inserted on the primary can be read from both secondaries.
