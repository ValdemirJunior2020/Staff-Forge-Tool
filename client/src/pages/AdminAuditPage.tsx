// client/src/pages/AdminAuditPage.tsx

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  Eye,
  MousePointerClick,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db, trackEvent } from "../lib/firebase";

type AuditSession = {
  id: string;
  fullName: string;
  tenantKey: string;
  pageUrl: string;
  userAgent: string;
  startedAt: string;
  lastSeenAt: string;
};

type AuditEvent = {
  id: string;
  eventName: string;
  pageUrl: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

function formatTimestamp(value: any): string {
  try {
    if (!value) return "-";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString();
    }
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }
    return String(value);
  } catch {
    return "-";
  }
}

function toCsvValue(value: unknown): string {
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [
    headers.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function AdminAuditPage() {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadAuditData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const sessionsQuery = query(
        collection(db, "staffforge_sessions"),
        orderBy("startedAt", "desc"),
        limit(50)
      );

      const eventsQuery = query(
        collection(db, "staffforge_events"),
        orderBy("createdAt", "desc"),
        limit(100)
      );

      const [sessionsSnapshot, eventsSnapshot] = await Promise.all([
        getDocs(sessionsQuery),
        getDocs(eventsQuery),
      ]);

      const mappedSessions: AuditSession[] = sessionsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: String(data.fullName || "Unknown"),
          tenantKey: String(data.tenantKey || "-"),
          pageUrl: String(data.pageUrl || "-"),
          userAgent: String(data.userAgent || "-"),
          startedAt: formatTimestamp(data.startedAt),
          lastSeenAt: formatTimestamp(data.lastSeenAt),
        };
      });

      const mappedEvents: AuditEvent[] = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          eventName: String(data.eventName || "unknown_event"),
          pageUrl: String(data.pageUrl || "-"),
          createdAt: formatTimestamp(data.createdAt),
          metadata:
            typeof data.metadata === "object" && data.metadata
              ? data.metadata
              : {},
        };
      });

      setSessions(mappedSessions);
      setEvents(mappedEvents);

      await trackEvent("admin_audit_loaded", {
        sessionsCount: mappedSessions.length,
        eventsCount: mappedEvents.length,
      });
    } catch (error) {
      console.error("Admin audit load failed:", error);
      setErrorMessage(
        "Could not load Firebase audit data. Check Firestore rules and make sure data exists in staffforge_sessions and staffforge_events."
      );
      setSessions([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditData();
  }, []);

  const uniqueVisitors = useMemo(() => {
    return new Set(sessions.map((session) => session.fullName)).size;
  }, [sessions]);

  const pageViews = useMemo(() => {
    return events.filter((event) => event.eventName === "page_view").length;
  }, [events]);

  const clicks = useMemo(() => {
    return events.filter(
      (event) =>
        event.eventName.includes("clicked") ||
        event.eventName === "sidebar_clicked"
    ).length;
  }, [events]);

  function exportSessions() {
    downloadCsv(
      "staffforge-audit-sessions.csv",
      [
        "ID",
        "Full Name",
        "Tenant Key",
        "Started At",
        "Last Seen At",
        "Page URL",
        "User Agent",
      ],
      sessions.map((session) => [
        session.id,
        session.fullName,
        session.tenantKey,
        session.startedAt,
        session.lastSeenAt,
        session.pageUrl,
        session.userAgent,
      ])
    );
  }

  function exportEvents() {
    downloadCsv(
      "staffforge-audit-events.csv",
      ["ID", "Event Name", "Created At", "Page URL", "Metadata"],
      events.map((event) => [
        event.id,
        event.eventName,
        event.createdAt,
        event.pageUrl,
        JSON.stringify(event.metadata),
      ])
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          Admin Audit
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Sessions, visits, clicks, and page views
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This page reads directly from Firebase collections{" "}
          <b>staffforge_sessions</b> and <b>staffforge_events</b>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadAuditData}
            className="sf-button sf-primary"
          >
            <RefreshCw size={18} />
            {loading ? "Loading..." : "Refresh Audit"}
          </button>

          <button
            type="button"
            onClick={exportSessions}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Sessions
          </button>

          <button
            type="button"
            onClick={exportEvents}
            className="sf-button sf-secondary"
          >
            <Download size={18} />
            Export Events
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="sf-card p-5">
          <Users className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Total Sessions</p>
          <h3 className="mt-2 text-3xl font-black">{sessions.length}</h3>
        </div>

        <div className="sf-card p-5">
          <ShieldCheck className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Unique Visitors</p>
          <h3 className="mt-2 text-3xl font-black">{uniqueVisitors}</h3>
        </div>

        <div className="sf-card p-5">
          <Eye className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Page Views</p>
          <h3 className="mt-2 text-3xl font-black">{pageViews}</h3>
        </div>

        <div className="sf-card p-5">
          <MousePointerClick className="mb-3 text-blue-700" />
          <p className="text-sm font-bold text-slate-500">Tracked Clicks</p>
          <h3 className="mt-2 text-3xl font-black">{clicks}</h3>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Recent Sessions</h3>
          <p className="text-sm text-slate-500">
            People who entered the StaffForge command center
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Started At</th>
                <th className="p-4">Last Seen</th>
                <th className="p-4">Tenant</th>
                <th className="p-4">Page URL</th>
              </tr>
            </thead>

            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-t border-slate-100">
                  <td className="p-4 font-black">{session.fullName}</td>
                  <td className="p-4">{session.startedAt}</td>
                  <td className="p-4">{session.lastSeenAt}</td>
                  <td className="p-4">{session.tenantKey}</td>
                  <td className="p-4">{session.pageUrl}</td>
                </tr>
              ))}

              {!loading && sessions.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center font-semibold text-slate-500"
                    colSpan={5}
                  >
                    No sessions found yet. Enter the app and click around first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sf-card overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-xl font-black">Recent Events</h3>
          <p className="text-sm text-slate-500">
            Page views, sidebar clicks, exports, and user actions
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-4">Event</th>
                <th className="p-4">Created At</th>
                <th className="p-4">Page URL</th>
                <th className="p-4">Metadata</th>
              </tr>
            </thead>

            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-blue-600" />
                      <span className="font-black">{event.eventName}</span>
                    </div>
                  </td>
                  <td className="p-4">{event.createdAt}</td>
                  <td className="p-4">{event.pageUrl}</td>
                  <td className="p-4">
                    <pre className="whitespace-pre-wrap text-xs text-slate-600">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}

              {!loading && events.length === 0 && (
                <tr>
                  <td
                    className="p-6 text-center font-semibold text-slate-500"
                    colSpan={4}
                  >
                    No events found yet. Click through the app and refresh this
                    page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}