# Database Schema

Core relationships:

```text
Tenant 1---N Vendor 1---N Site 1---N Team
Tenant 1---N Vendor 1---N Agent 1---N VendorAccount
Agent 1---N AgentSnapshot
Agent 1---N UtilizationInterval
Tenant 1---N Recommendation
Tenant 1---N UserSession 1---N AuditEvent
Tenant 1---N ImportBatch
```

Mapped workbook patterns:

- Concentrix: `CON Master List` → Employee ID, Full Legal Name, Team Leader, Email, HP ID, Status.
- Teleperformance: `Zendesk` → Name, Email, TP Emp ID, Status.
- WNS: `Active agents` → First Name, Last Name, Supervisor, Email, ID, Billable, Admin Access.
- Buwelo: `Active Agents - COL/GH/PH` → First Name, Last Name, Supervisor, Email, ID, Billable, Admin Access.
- Telus: matrix utilization → date, HP ID, state, hour, duration minutes.
