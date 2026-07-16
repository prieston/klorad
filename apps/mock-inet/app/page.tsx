/**
 * Developer-facing landing. Lists the endpoint surface so someone
 * hitting `/` in the browser knows what this is and how to poke it.
 */
export default function Home() {
  const example = (path: string) => `GET ${path} — HTTP Basic (demo/demo)`;
  return (
    <main style={{ maxWidth: 780, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>PSMdt-iNET Mock</h1>
      <p style={{ color: "#94a3b8", marginTop: 0 }}>
        Mock Parsons/iNET ATMS surface + demo scenario runners. Two layers,
        one deploy.
      </p>

      <Section title="Layer 1 — iNET drop-in">
        <p>
          Byte-compatible with the shape the Klorad{" "}
          <code>@klorad/connectors/inet-atms</code> connector talks to.
          Point a Mobility source&apos;s <code>host</code> at this deploy and
          sync as usual.
        </p>
        <List
          items={[
            example("/atms/{subsystem}-rest/rest/{subsystem}/"),
            example("/atms/{subsystem}-rest/rest/{subsystem}/{externalId}"),
            example(
              "/atms/dms-rest/rest/dms/{externalId}/status",
            ),
          ]}
        />
        <p>
          Subsystems: <code>cctv aid vms dms vsls radar</code>.
        </p>
      </Section>

      <Section title="Layer 2 — Demo surface">
        <List
          items={[
            "GET/POST /api/incidents · PATCH /api/incidents/:id",
            "GET/POST /api/worlds · GET /api/worlds/:id/devices",
            "GET /api/vds/live",
            "GET /api/stream (SSE)",
            "GET/POST /api/webhooks · DELETE /api/webhooks/:id",
          ]}
        />
      </Section>

      <Section title="One-tap scenarios">
        <List
          items={[
            "POST /api/demo/scenario/incident",
            "POST /api/demo/scenario/vms-inspection",
            "POST /api/demo/scenario/traffic",
            "POST /api/demo/scenario/radar-spike (optional ?deviceId=…)",
            "POST /api/demo/scenario/dms-alarm (optional ?deviceId=…)",
            "POST /api/demo/scenario/incident-cascade",
            "GET  /api/demo/overrides — inspect active status overrides",
          ]}
        />
        <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 13 }}>
          Radar / DMS scenarios flip device status for 3 minutes and
          emit <code>device.status_changed</code> events. Wire a
          webhook against them from Mobility to drive the alert-rule
          engine.
        </p>
      </Section>

      <p style={{ marginTop: 40, color: "#64748b" }}>
        Auth: HTTP Basic. Defaults <code>demo</code> / <code>demo</code>;
        override with <code>MOCK_USER</code> / <code>MOCK_PASS</code>.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 8, fontSize: 18 }}>{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "8px 0", paddingLeft: 20, lineHeight: 1.7 }}>
      {items.map((s) => (
        <li key={s}>
          <code>{s}</code>
        </li>
      ))}
    </ul>
  );
}
