# Operations Runbook

## Settlement is pending
1. inspect GenLayer transaction state; accepted is not enough
2. verify finalized decision exists in Postgres
3. verify settlement instruction payload equals DecisionOutbox
4. inspect zkSync gateway dispatch/message ID
5. inspect destination Mailbox delivery
6. inspect PRAEST receiver/program processed-instruction state
7. inspect escrow remaining/balances
8. only then retry a safe idempotent transport step

## Probe reports collector error
Do not open a service outage solely from collector failure. Check regional quorum, DNS/TLS/network status and worker health. Preserve `UNKNOWN/COLLECTOR_ERROR` evidence separately.

## Suspected key compromise
Pause affected route/integration, rotate the narrowest key, update trusted sender/ISM/config, reconcile all non-final/unreconciled messages, and record the event in audit/incident systems.

## Database recovery
Restore to an isolated instance first, reconcile chain-authoritative settlement state after restore, then reopen writes. Never assume restored DB settlement state is newer than destination chain state.
