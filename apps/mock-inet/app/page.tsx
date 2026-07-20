import { DemoControlPanel } from "./DemoControlPanel";

/**
 * Developer-facing landing page for the PSMdt-iNET mock.
 *
 * Top half is an interactive demo control panel (client component)
 * with one card per scenario, live active-state badges, a reset
 * button, and an SSE-driven event feed so you can watch the wire
 * as you click. Bottom half is the classic endpoint reference for
 * developers pointing curl / connectors at the mock.
 */
export default function Home() {
  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <header>
        <h1 style={{ marginTop: 0, marginBottom: 4, fontSize: 28 }}>
          PSMdt-iNET Mock
        </h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>
          Mock iNET ATMS surface with demo scenario runners. Trigger a
          scenario below to drive alerts and webhooks against a Klorad
          Mobility source pointed at this deploy.
        </p>
      </header>

      <DemoControlPanel />

      <ApiReference />

      <footer style={{ color: "#64748b", fontSize: 13 }}>
        Auth: HTTP Basic (<code>demo</code>/<code>demo</code> or the
        <code>MOCK_USER</code>/<code>MOCK_PASS</code> env). This
        page&apos;s Trigger + Reset buttons bypass Basic auth via a
        same-origin check.
      </footer>
    </main>
  );
}

/**
 * Endpoint reference — kept below the control panel so people
 * poking at curl still get a quick map without scrolling far.
 * Static / server-rendered; no interactivity.
 */
function ApiReference() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Section title="Layer 1 · iNET drop-in">
        <p style={{ margin: "0 0 8px 0", color: "#cbd5e1" }}>
          Matches the response shape the Klorad{" "}
          <code>@klorad/connectors/inet-atms</code> connector expects.
          Point a Mobility source&apos;s <code>host</code> at this
          deploy and sync.
        </p>
        <List
          items={[
            "GET /atms/{subsystem}-rest/rest/{subsystem}/",
            "GET /atms/{subsystem}-rest/rest/{subsystem}/{externalId}",
            "GET /atms/dms-rest/rest/dms/{externalId}/status",
          ]}
        />
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 0 0" }}>
          Subsystems: <code>cctv aid vms dms vsls radar</code>.
        </p>
      </Section>

      <Section title="Layer 2 · Demo surface">
        <List
          items={[
            "GET/POST /api/incidents · PATCH /api/incidents/:id",
            "GET/POST /api/worlds · GET /api/worlds/:id/devices",
            "GET /api/vds/live",
            "GET /api/stream (SSE)",
            "GET/POST /api/webhooks · DELETE /api/webhooks/:id",
            "GET /api/demo/status · GET /api/demo/overrides",
            "POST /api/demo/scenario/{name}",
          ]}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "4px 0", paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((s) => (
        <li key={s}>
          <code style={{ fontSize: 12 }}>{s}</code>
        </li>
      ))}
    </ul>
  );
}
