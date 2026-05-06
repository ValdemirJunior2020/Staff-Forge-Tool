# Firebase Setup

Collections:

```text
staffforge_sessions/{sessionId}
staffforge_events/{eventId}
staffforge_exports/{exportId}
```

Landing page flow:

1. User enters Full Name, Email, Company/Department.
2. React stores the session locally and writes to Firestore if Firebase env vars exist.
3. Every page view, filter, AI question, export, and major click is tracked.
4. Admin Audit page can read sessions/events through the backend in production.
