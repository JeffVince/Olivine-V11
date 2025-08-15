# Agent Runtime Incident Playbooks

Guides for responding to common operational issues in the agent runtime.

## Heartbeat Miss
1. **Detect:** Alert fires when `olivine_heartbeats_total` has no samples for 5 minutes.
2. **Triage:**
   - Check agent logs for crashes or pauses.
   - Confirm the host or container is up.
3. **Mitigate:** Restart the agent process. If unavailable, fail over to a standby instance.
4. **Follow up:** Collect logs and note timeline in the incident tracker.

## Quota Breach
1. **Detect:** Dashboard shows a sustained spike in `olivine_commits_total` or a custom quota metric.
2. **Triage:**
   - Identify offending tenant or workflow.
   - Validate quota configuration.
3. **Mitigate:** Throttle or disable excess workloads; raise limits only with approval.
4. **Follow up:** Document the cause and adjust quotas or alerts as needed.

## Database Outage
1. **Detect:** Application errors or alerts indicate loss of connectivity to the primary database.
2. **Triage:**
   - Verify database health and network paths.
   - Check if read replicas are available.
3. **Mitigate:** Fail over to a healthy replica or place the service in read-only mode.
4. **Follow up:** Engage the database team, capture postmortem notes, and update runbooks.
