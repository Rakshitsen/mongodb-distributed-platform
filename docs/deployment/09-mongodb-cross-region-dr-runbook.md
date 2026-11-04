# MongoDB Cross-Region Disaster Recovery Runbook

## Environment

Replica set: `rs0`

### Normal topology

| Member | Region | Zone | Private IP | Normal role | Votes | Priority |
|---|---|---|---|---|---:|---:|
| `mongodb-0` | Mumbai (`asia-south1`) | `asia-south1-a` | `10.0.1.32` | PRIMARY | 1 | 1 |
| `mongodb-1` | Mumbai (`asia-south1`) | `asia-south1-b` | `10.0.1.33` | SECONDARY | 1 | 1 |
| `mongodb-2` | Mumbai (`asia-south1`) | `asia-south1-c` | `10.0.1.34` | SECONDARY | 1 | 1 |
| `mongodb-3` | Delhi (`asia-south2`) | `asia-south2-b` | `10.0.2.3` | DR SECONDARY | 1 | 0 |
| `mongodb-4` | Delhi (`asia-south2`) | `asia-south2-a` | `10.0.2.4` | DR SECONDARY | 1 | 0 |

The current five-member configuration has five votes and requires three votes for a majority. If all three Mumbai members are unavailable, the two Delhi members cannot elect a primary without a controlled forced reconfiguration.

> **Scope:** This is a manual, operator-driven DR procedure for a lab environment. It is not automatic failover and should not be treated as a production-approved procedure without tested backups, fencing, monitoring, and a documented RPO/RTO.

---

## 0. Critical safety rules

1. **Fence Mumbai before promoting Delhi.** Confirm the Mumbai VMs are stopped or otherwise isolated so they cannot accept writes or communicate with Delhi. A network partition is not proof that Mumbai is powered off.
2. Never force-reconfigure Delhi while a Mumbai primary may still be running. This can create two independently writable sides.
3. A forced reconfiguration can roll back writes, including writes previously acknowledged with majority write concern. Record the last known successful write and understand the RPO before proceeding.
4. Back up the surviving Delhi data before reconfiguration. Do not delete MongoDB data directories or `local` databases as a shortcut.
5. The two-node Delhi configuration below requires **both Delhi members to be available** to form a majority (2 of 2). If either Delhi node is unavailable, stop and reassess; do not improvise another forced configuration.
6. Keep the original configuration and command outputs outside the MongoDB VMs. Do not rely on the failed Mumbai region for your only copy.
7. Do not change replica-set member hostnames or DNS records casually. The names in the replica-set config must resolve to the intended private IPs from every member and from the application.

### Before the planned simulation

From the current primary, save the original configuration and status:

```javascript
// Run in mongosh while the five-member set is healthy.
printjson(rs.conf());
printjson(rs.status());
```

Save the output in a file outside the MongoDB VMs, for example `rs0-original-config.txt`.

Check replication lag and confirm all five members are healthy:

```javascript
rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health,
  optime: m.optime
}));
```

Create and verify a backup/snapshot of the MongoDB data in accordance with your lab's backup plan. A VM disk snapshot is not a substitute for a tested database backup.

---

# Part A — Mumbai region outage and Delhi DR promotion

## A1. Simulate/fence the Mumbai outage

Stop all three Mumbai VMs using your chosen GCP procedure:

- `mongodb-0`
- `mongodb-1`
- `mongodb-2`

For a controlled lab simulation, verify their instance status in GCP and confirm they are actually stopped. If you are simulating a network partition instead of a power outage, apply an explicit fencing rule that prevents the Mumbai nodes from serving application writes and from rejoining the replica set until the DR operation is complete.

Do not continue until Mumbai is fenced.

## A2. Confirm Delhi is the only surviving region

From a machine in the Delhi VPC, check both nodes:

```bash
for host in mongodb-3.mongodb.internal mongodb-4.mongodb.internal; do
  echo "===== $host ====="
  getent hosts "$host"
  nc -vz -w 5 "$host" 27017
done
```

Check `mongod` on both Delhi nodes:

```bash
sudo systemctl status mongod --no-pager
sudo ss -lntp | grep 27017
```

Connect directly to `mongodb-3` (or `mongodb-4`) using the admin account. Enter the password when prompted; do not put it in shell history:

```bash
mongosh "mongodb://rsAdmin@mongodb-3.mongodb.internal:27017/admin?directConnection=true" --password
```

Check whether the member is in `SECONDARY` state and inspect its latest optime:

```javascript
db.hello();
rs.status();
```

With Mumbai down, the old five-voter configuration will not have a primary. That is expected.

## A3. Back up the surviving Delhi member

Before force reconfiguration, take a backup of the surviving data using your established backup method. If using a VM/disk snapshot for this lab, ensure MongoDB is in a suitable state for the snapshot and document the snapshot ID.

Do not proceed if the Delhi nodes are not healthy or if you cannot identify which node has the most up-to-date data.

## A4. Force-reconfigure the set to the two Delhi members

Connect directly to `mongodb-3` or `mongodb-4`. Use the current config as the starting point so the member IDs and replica-set settings are retained.

```javascript
cfg = rs.conf();

// Keep only the two Delhi members, retaining their existing _id values.
cfg.members = cfg.members.filter(m =>
  m.host === "mongodb-3.mongodb.internal:27017" ||
  m.host === "mongodb-4.mongodb.internal:27017"
);

// In the two-node DR configuration, both nodes vote and can be elected.
// Both nodes must be online for a majority (2 of 2).
cfg.members.forEach(m => {
  m.votes = 1;
  m.priority = 1;
});

printjson(cfg);
```

**Inspect the printed configuration carefully.** It must contain exactly two members, with the original IDs for `mongodb-3` and `mongodb-4`, both `votes: 1` and `priority: 1`.

Then, and only after confirming Mumbai is fenced:

```javascript
rs.reconfig(cfg, { force: true });
```

A forced reconfiguration is an emergency recovery operation. It is not the normal way to change a replica set. MongoDB documents that it can cause rollback of majority-committed writes.

Wait for an election. Verify:

```javascript
rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health
}));
```

Expected: one Delhi member is `PRIMARY`; the other is `SECONDARY`, both with `health: 1`.

If no primary is elected, stop. Check both nodes' MongoDB logs and connectivity. Do not run repeated force reconfigurations or start Mumbai.

## A5. Validate writes and application connectivity in Delhi

On the new Delhi primary:

```javascript
db.getSiblingDB("dr_test").failover_test.insertOne({
  message: "Delhi DR promotion test",
  source: "Delhi",
  timestamp: new Date()
});
```

Check the record on the Delhi secondary. In `mongosh` connected to the secondary:

```javascript
rs.secondaryOk();
db.getSiblingDB("dr_test").failover_test.find().sort({ _id: -1 }).limit(5);
```

Update the application connection configuration only if required. Prefer the existing SRV hostname if its SRV record still points only to the original Mumbai and Delhi members. Confirm the SRV set contains only active Delhi nodes during the DR window, or use a temporary DR-specific URI.

For a DR-only temporary URI, use both Delhi members:

```text
mongodb://rsAdmin:<URL_ENCODED_PASSWORD>@mongodb-3.mongodb.internal:27017,mongodb-4.mongodb.internal:27017/app_db?replicaSet=rs0&authSource=admin
```

Do not include the password in documentation, screenshots, commands, or source control. The URI above is a template.

Verify the application can read and write, and record the time at which service is restored.

---

# Part B — Mumbai recovery and return to normal topology

## B0. Do not simply power on all Mumbai VMs and assume they will rejoin

The Mumbai nodes have an older replica-set configuration and may contain data that diverged while Delhi was primary. Bring them back in a controlled, fenced state. Do not allow the old Mumbai nodes to serve application traffic or writes.

Keep application writes directed to Delhi until Mumbai has been reconciled and the final topology is verified.

## B1. Restore Mumbai infrastructure while keeping it fenced

Start the Mumbai VMs only when you can keep their MongoDB services isolated from application writes and from the active replica set until you are ready to reconcile them.

Verify the following on each Mumbai VM:

```bash
sudo systemctl status mongod --no-pager
sudo mongod --version | head -n 2
sudo grep -A5 -E '^net:|^security:|^replication:' /etc/mongod.conf
```

Check keyfile checksum and permissions against Delhi:

```bash
sudo sha256sum /etc/mongodb-keyfile
sudo stat -c '%U:%G %a' /etc/mongodb-keyfile
```

The keyfile contents must match across all nodes. Do not print or transmit the keyfile contents in chat.

Confirm private DNS and TCP connectivity between the regions before rejoining:

```bash
for host in mongodb-0.mongodb.internal mongodb-1.mongodb.internal mongodb-2.mongodb.internal mongodb-3.mongodb.internal mongodb-4.mongodb.internal; do
  echo "===== $host ====="
  getent hosts "$host"
  nc -vz -w 5 "$host" 27017
done
```

## B2. Inspect the recovered Mumbai nodes before re-adding

Inspect each recovered node's MongoDB logs:

```bash
sudo tail -n 100 /var/log/mongodb/mongod.log
```

If a Mumbai node starts and reports that it has been removed from the replica set or has a stale configuration, do not run `rs.initiate()` and do not delete its data directory. It must be reintroduced to the active Delhi-led replica set using the existing member identity and a controlled reconfiguration.

If MongoDB reports rollback, RECOVERING, or data inconsistency, stop and assess the logs and backup state before proceeding.

## B3. Add the Mumbai members back as non-voting members first

On the current Delhi primary, inspect and save the active DR configuration:

```javascript
printjson(rs.conf());
rs.status();
```

The active configuration should contain the two Delhi nodes. Add the three Mumbai members as **non-voting, non-electable** members first. Use the original member IDs from the saved original configuration. The following is an example assuming the original IDs are 0, 1, and 2:

```javascript
cfg = rs.conf();

cfg.members.push(
  { _id: 0, host: "mongodb-0.mongodb.internal:27017", votes: 0, priority: 0 },
  { _id: 1, host: "mongodb-1.mongodb.internal:27017", votes: 0, priority: 0 },
  { _id: 2, host: "mongodb-2.mongodb.internal:27017", votes: 0, priority: 0 }
);

printjson(cfg);
rs.reconfig(cfg);
```

Only use this exact example if the original IDs are confirmed to be 0, 1, and 2 and the current configuration contains no members with those IDs or hostnames. If the reconfiguration is rejected, do not force it automatically; inspect the error and current configuration.

Wait for each Mumbai member to appear in `rs.status()` and complete initial sync. Confirm that all three show `SECONDARY` and `health: 1`, and that their optimes have caught up with the Delhi primary.

**Do not restore votes or priority until all three Mumbai members are fully synchronized.**

## B4. Restore the original three-vote Mumbai majority

Once all five nodes are healthy and caught up, restore the normal voting configuration. MongoDB limits ordinary reconfigurations to one voting-member change at a time, so perform the vote changes as separate reconfigurations.

The intended final settings are:

| Member | Votes | Priority |
|---|---:|---:|
| mongodb-0 | 1 | 1 |
| mongodb-1 | 1 | 1 |
| mongodb-2 | 1 | 1 |
| mongodb-3 | 1 | 0 |
| mongodb-4 | 1 | 0 |

A safe sequence is:

1. Change `mongodb-0` from 0 votes to 1 vote (leave priority 0 temporarily).
2. Change `mongodb-1` from 0 votes to 1 vote (leave priority 0 temporarily).
3. Change `mongodb-2` from 0 votes to 1 vote (leave priority 0 temporarily).
4. Change `mongodb-3` and `mongodb-4` to priority 0 and 1 vote each (they should already be set this way).
5. Set `mongodb-0` priority to 2, and `mongodb-1` and `mongodb-2` priority to 1.

For each step, fetch a fresh config, make only the intended change, print it, then run `rs.reconfig(cfg)` **without** `force: true`. Example for the first vote change:

```javascript
cfg = rs.conf();
cfg.members.find(m => m.host === "mongodb-0.mongodb.internal:27017").votes = 1;
cfg.members.find(m => m.host === "mongodb-0.mongodb.internal:27017").priority = 0;
printjson(cfg);
rs.reconfig(cfg);
```

Repeat with one additional Mumbai member vote change per reconfiguration. Do not batch multiple voting changes into one ordinary reconfiguration.

Then set the final priorities using a fresh config:

```javascript
cfg = rs.conf();

cfg.members.find(m => m.host === "mongodb-0.mongodb.internal:27017").priority = 1;
cfg.members.find(m => m.host === "mongodb-1.mongodb.internal:27017").priority = 1;
cfg.members.find(m => m.host === "mongodb-1.mongodb.internal:27017").votes = 1;
cfg.members.find(m => m.host === "mongodb-2.mongodb.internal:27017").priority = 1;
cfg.members.find(m => m.host === "mongodb-2.mongodb.internal:27017").votes = 1;

cfg.members.find(m => m.host === "mongodb-3.mongodb.internal:27017").priority = 0;
cfg.members.find(m => m.host === "mongodb-4.mongodb.internal:27017").priority = 0;

printjson(cfg);
rs.reconfig(cfg);
```

This can cause an election or primary stepdown. Expect a short write interruption. Monitor the replica-set status and application driver reconnection.

## B5. Return primary to Mumbai

Once all five nodes are healthy, all Mumbai nodes are fully synchronized, and the original vote distribution is restored, MongoDB should prefer `mongodb-0` because it has priority 2.

Check:

```javascript
rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health
}));
```

If `mongodb-0` is not primary, inspect its health, replication lag, and logs. Do not force an election or step down another primary until the set is healthy and you understand why the higher-priority node has not taken over.

## B6. Restore application DNS and validate

Ensure the Cloud DNS SRV record includes all five members:

```bash
dig +short SRV _mongodb._tcp.rs0.mongodb.internal
dig +short TXT rs0.mongodb.internal
```

Expected SRV targets:

- `mongodb-0.mongodb.internal.`
- `mongodb-1.mongodb.internal.`
- `mongodb-2.mongodb.internal.`
- `mongodb-3.mongodb.internal.`
- `mongodb-4.mongodb.internal.`

Keep the application's normal SRV URI:

```text
mongodb+srv://rsAdmin:<URL_ENCODED_PASSWORD>@rs0.mongodb.internal/app_db?tls=false
```

`tls=false` is included here because the current MongoDB configuration shown in this lab does not enable TLS. For production, configure TLS and remove `tls=false`.

Restart/reload the application only if required by its configuration management. Verify application health, CRUD operations, and that the driver discovers the correct primary.

---

# Part C — Final validation checklist

## Replica set

```javascript
rs.status().members.map(m => ({
  name: m.name,
  state: m.stateStr,
  health: m.health,
  optime: m.optime
}));
```

Expected normal topology:

- `mongodb-0`: `PRIMARY`, health 1
- `mongodb-1`: `SECONDARY`, health 1
- `mongodb-2`: `SECONDARY`, health 1
- `mongodb-3`: `SECONDARY`, health 1
- `mongodb-4`: `SECONDARY`, health 1

Check the final configuration:

```javascript
rs.conf().members.map(m => ({
  id: m._id,
  host: m.host,
  votes: m.votes,
  priority: m.priority
}));
```

Expected final counts:

- `votingMembersCount`: 5
- `majorityVoteCount`: 3
- `writeMajorityCount`: 3

## Application and data

- [ ] Application connects using the expected SRV URI.
- [ ] Application health endpoint succeeds.
- [ ] Test write succeeds on the primary.
- [ ] Test record appears on both Delhi secondaries.
- [ ] Test record appears on both other Mumbai secondaries.
- [ ] No unexpected rollback or replication errors appear in MongoDB logs.
- [ ] DNS SRV and TXT records resolve correctly.
- [ ] Application is not configured with a stale temporary DR-only URI.

## Record the exercise

Record these values for the DR test report:

| Metric | Value |
|---|---|
| Mumbai outage start time | |
| Delhi primary election time | |
| Application restored time | |
| Measured RTO | |
| Last confirmed write before outage | |
| First confirmed write in Delhi | |
| Observed data loss / RPO | |
| Mumbai recovery start time | |
| Mumbai fully synchronized time | |
| Original topology restored time | |

---

## Important design limitation

This five-voter layout is optimized for normal Mumbai operation, not automatic Delhi takeover. Mumbai has three votes and Delhi has two. Losing Mumbai removes the majority.

The manual forced reconfiguration is a controlled disaster-recovery mechanism, not automatic regional failover. In the temporary two-node Delhi configuration, both Delhi nodes must be available to maintain a two-vote majority. A more resilient automatic DR architecture needs a deliberate quorum design, such as a third voting member in an independent failure domain, plus fencing to prevent split-brain.

## Official MongoDB references

- [Reconfigure a replica set with unavailable members](https://www.mongodb.com/docs/manual/tutorial/reconfigure-replica-set-with-unavailable-members/)
- [rs.reconfig()](https://www.mongodb.com/docs/manual/reference/method/rs.reconfig/)
- [replSetReconfig command](https://www.mongodb.com/docs/manual/reference/command/replSetReconfig/)

**Do not execute this runbook blindly on a production cluster.** Validate the commands against the exact MongoDB server version and the saved live configuration before each reconfiguration.
