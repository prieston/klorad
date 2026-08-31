# Parsons Meeting Prep — PSM: Digital Twin Demo
**Thu 23 July 2026, 16:00–16:45 (Teams) — 45 minutes total. Plan for ~15 min demo, ~10 min technical slides, ~20 min discussion.**

---

## 1. Who is actually in the room (researched 22 Jul 2026)

One correction to your framing first: **this is not primarily an engineering audience.** Based on public records, none of the Parsons attendees is confirmed as a day-to-day "iNET product manager" — the room is weighted toward **partnerships, technology strategy, and regional business development**. Pitch at "technical executive" level: diagrams and guarantees, not code. Keep the deep detail in your back pocket (this doc).

### Guada Casuso — the technical decision-maker ⭐
- **VP of Technology & Innovation, Parsons** (2023 press release: led *engineering, software delivery and R&D for the iNET smart mobility platform*; current title trends toward "Parsons X Digital Labs & Strategic Partnerships"). Ex-**Microsoft** — Office of the CTO, autonomous systems, sustainability. Publicly writes about digital twins + AI + cyber.
- **She is the closest thing to the "product owner" in this meeting.**
- Will probe: AI capability (Paris), cloud architecture, scalability, how PSMdt fits the iNET roadmap. Azure heritage — expect "can this run on/next to our Azure stack?" (Answer: yes — standard Node/Postgres workload, portable.)

### Carla Anguiano — the organizer
- **Senior Director, Ecosystem Alliance Partner Manager.** Partnerships/alliances role, not engineering.
- Will probe: partnership structure, licensing, joint go-to-market, "what does a deal look like?" Have a one-sentence answer ready even if commercial terms aren't yours to close.

### Richard Chylinski [NN-CA] — the ITS veteran
- **VP / Regional Manager, Infrastructure — Canada & International.** Computer Science degree; ~24 years at **Delcan** (the Canadian ITS firm Parsons acquired in 2014) as Senior Principal Systems PM.
- **He has deep, real ATMS/TMC domain knowledge and will spot any ITS hand-waving instantly.** Be precise about subsystem names, NTCIP/DMS realities, TMC operations.
- Will probe: deployability for his DOT/municipal clients, effort to stand up, operations realism.

### Adam Chandler
- Weakly confirmed as **Manager, Information Technology at Parsons** (single stale source). Low web footprint — possibly the closest to a hands-on PM/IT role. If anyone asks about hosting, IT integration, SSO — likely him.

### BC Smith
- **No reliable public profile found.** (One unconfirmed lead: a Parsons "BIM guy" Brian S. Smith — if true, expect 3D-model/BIM pipeline questions — but don't rely on it.) Treat as a wildcard; ask people to introduce themselves at the start.

### Your side
Lymberopoulos (Polinde), Andreas Vlachos, Konstantinos Evangelidis, Dimitris & Panagiotis Papaioannou (PSM), Rich (V Advisory Group).

---

## 2. Strategy: speak their language

Recent Parsons context worth knowing cold:

- **iNET was rebuilt as an Azure SaaS** (Aug 2024, "iNET R12" on Azure Marketplace) and shipped **iNET Sidekick** — an AI virtual traffic operator on Azure OpenAI. → Position **Paris as complementary**: *Sidekick assists the TMC operator inside iNET; Paris answers stakeholders inside their scoped world.*
- **Asset Guardian** is their asset-lifecycle module (AI computer vision, work orders, GIS). → Position PSMdt as **its field surface** (inspections, work orders in hand, status write-back), never a competitor.
- **Two days ago (20 Jul 2026) Parsons won a $33M NYSDOT contract**: statewide iNET across 11 districts, 6,000+ signal controllers. Congratulate them; frame PSMdt as the way such mega-deployments reach every stakeholder's phone. Their March 2026 release theme: "reactive → proactive," unified digital platforms, cross-agency data sharing — echo those exact phrases.
- Their claims: 76 iNET installations, 100+ ATMS implementations, "most operated traffic management software in the world," "never been hacked."
- **No public formal iNET partner program exists** — integration happens via project teaming. Precedent for a partner-built mobile app on iNET: **Port of Oakland "GoPort" app** (2024). Use it if partnership mechanics come up.
- Security vocabulary they use: **NIST, NERC CIP, Zero Trust, IT/OT convergence** — not SOC 2/ISO checklists. Frame your security answers in those terms.
- Geography: iNET is strong in North America and the Gulf; **little European footprint** — PSM as a **European beachhead** is a legitimate card to play.

⚠️ **Stat check on your existing deck:** it says "140,000+ devices in iNET" and "100+ installations." Parsons' own public number is **76 iNET deployments / 100+ ATMS implementations**, and no public device count exists. Know where your 140k figure came from, or soften to "the full device estate of any iNET deployment" if challenged.

⚠️ Also: you said the meeting is "at Parsons" — it's a **45-minute Teams call**. Rehearse the phone-demo camera flow (QR → install → push notification) so it works over screen-share; have the mock scenario page (`klorad-mock-inet.vercel.app`) pre-loaded.

---

## 3. Q&A bank

### Architecture & integration

**"How does PSMdt actually connect to iNET?"**
Three narrow paths, nothing else: (A) paginated REST pull to sync the device catalog; (B) HMAC-signed webhooks inbound for real-time events; (C) on-demand live status reads. Auth is HTTP Basic per source, credentials encrypted at rest, all server-side — iNET credentials never reach a browser.

**"What do you need from us to go to production?"**
One thing: production iNET emits the documented webhook contract — registration endpoint, HMAC-SHA256 signature over the raw body, and **the `status` object present on every event** (the threshold engine evaluates `payload.status[field]`; without it, threshold rules silently no-op). Our mock-iNET server is the reference implementation and we hand it over. Everything else we already consume from the existing REST surface.

**"We don't have a public API / our interfaces are bespoke."**
Expected — that's why the connector is an adapter. We implement against whatever interface spec you provide (REST, C2C/TMDD-style, or a bilateral ICD). Two methods to satisfy: `listEntities` and `getStatus`. The rest of the platform doesn't change.

**"Can it run on Azure / on-prem?"** (likely from Casuso or Chandler)
Yes. It's a standard Next.js/Node app + Postgres. Today it runs serverless with managed Postgres in Frankfurt (EU residency); the same app runs as a container on Azure App Service/AKS with Azure Database for PostgreSQL, or fully on-prem. Nothing in the stack is provider-locked (web push is the W3C VAPID standard — no Firebase).

**"What happens at scale — 6,000 signals, 140k devices?"**
Catalog sync is paginated + bulk-upserted (one SQL statement per page), idempotent, resumable mid-sync — cost is dominated by the source's pagination, not us. Read paths hit our own DB, not iNET, so stakeholder load never touches the ATMS. Push fan-out is per-world and parallel; dead endpoints are pruned automatically. Alert evaluation is O(rules) per event, and rules are indexed per project/source.

**"What about webhook delivery failures?"**
Sender retries 3× with backoff (1s/5s/30s); 410 Gone deactivates the subscription; every receipt (matched or not) is logged with a per-rule outcome visible in the operator dashboard — operators diagnose "why didn't it fire" without logs.

### Data

**"What iNET data do you store, exactly?"**
Durable: device catalog (identity, geo, subsystem, curation flags, plus the raw JSON payload for re-rendering), worlds/themes, alert rules + alert history, broadcast history, anonymous push subscriptions, encrypted secrets. **Never stored: live device status, video streams, visitor identity, plaintext credentials.** Live state is polled at read time, rendered, discarded — iNET stays the single source of truth.

**"Where does the data live? (residency/sovereignty)"**
Managed Postgres, Frankfurt (EU). But the app doesn't care — any Postgres anywhere, including the customer's own tenancy. For a North-American DOT we'd deploy in-region.

**"Who else can see our data?" (multi-tenancy)**
Organization → Project → DataSource hierarchy; every query is project-scoped. Per-source webhook secrets, per-project AI keys. One operator's estate is invisible to another's.

### Security

**"How is the public app secured if it's anonymous?"**
Anonymity is a feature, not a gap: visitor PWAs carry zero PII (push subscription = browser endpoint + crypto keys). Sensitive worlds use `authenticated` visibility gated on org credentials; `linkOnly` and `public` exist for civic-transparency use cases — the operator chooses per world.

**"Have you done a security audit / pen test?"**
Honest answer if not done: "The controls are in place — HMAC with constant-time compare, AES-256-GCM at rest, RBAC on every route, strict tenant scoping — and we'd welcome a joint security review with your team as a concrete next step." (Do NOT bluff a certification; they think in NIST/Zero-Trust terms, not checkbox audits.)

**"Could someone forge a webhook and spam alerts?"**
No — every event is HMAC-SHA256-signed with a per-source secret and verified with constant-time comparison; unknown sources 404, unregistered webhooks 400, bad signatures 401.

### AI (expect this from Casuso)

**"How does Paris relate to iNET Sidekick?"**
Complementary by audience: Sidekick serves the TMC operator inside iNET; Paris serves the field crew and stakeholder inside their scoped world. Different user, different scope, same philosophy of grounded AI.

**"Does the AI hallucinate device data?"**
It can't cite what it didn't fetch: four read-only tools (three cached from Postgres, one live iNET status read), max 5 tool iterations per question, instructed never to invent numbers, and every reply carries tap-actions that deep-link to the actual device so the user sees the real value.

**"What goes to Anthropic? Can we control it?"**
The user's question and tool results only — no PII, no bulk data. Per-project bring-your-own API key means an operator's device data stays under their own Anthropic contract; the platform fallback key is rate-limited.

**"Why Anthropic and not Azure OpenAI?"** (plausible given their stack)
The AI layer is a swappable orchestration pattern (tool-use loop). If a deployment requires Azure OpenAI for procurement/compliance alignment, that's an adapter — the tools, grounding, and UI don't change.

### Commercial / partnership (Anguiano, Chylinski)

**"What does the partnership model look like?"**
Follow the precedent: partner-built app on iNET, project-based teaming (like GoPort at Port of Oakland). White-label means Parsons can present branded worlds to its DOT clients. Licensing/commercials → route to your business folks; your job is to make integration feel low-risk.

**"Could Parsons just build this?"**
Don't get defensive. The value isn't one feature — it's the shipped, working chain (worlds → one-tap install → rules → push → grounded AI) plus the roadmap velocity of a focused team. Partnering gets it into iNET deployments now; the FLYOVER project makes PSM a live reference customer.

**"What's the deployment effort for one of my clients?"** (Chylinski)
Point at an iNET tenant, sync, curate a world, share a QR — a scoped pilot world on a live deployment is days, not months, once the webhook emitter exists. No hardware, no app store submission, nothing installed inside the customer's network.

### Wildcards

- **BIM/3D pipeline** (if BC Smith is the BIM lead): device 3D models are per-subsystem mappings today, custom models uploadable per project; glTF-based pipeline can ingest their models.
- **Offline?** PWA caches the shell; live status needs connectivity; last-known values render on fetch failure.
- **Roadmap?** Other verticals (Campus, Heritage) prove the platform generalizes; for mobility: more connectors (non-iNET ATMS), more alert channels (SMS/email/Teams), deeper Asset Guardian write-back.
- **"Why 'Paris'?"** Have a one-liner ready — light moment, take it.

---

## 4. Your ask + proposed next steps (say these before the call ends)

1. **Interface specs**: iNET webhook emitter spec exchange — we provide the mock as reference implementation.
2. **Pilot**: a scoped PSMdt world on one live iNET tenant (or the Curiosity Lab / a Gulf deployment) — days of work, high demo value.
3. **Security review**: joint session with their team — you have nothing to hide and it builds trust with a NIST-minded org.

---

## 5. Numbers to have at your fingertips

| Fact | Value |
|---|---|
| Alert latency end-to-end (local) | ~200–800 ms + push-service hop |
| Webhook retries | 3× (1s / 5s / 30s), 410 = deactivate |
| Subsystems supported | 6: CCTV, AID, VMS, DMS, VSLS, radar |
| Event types | device.status_changed, incident.posted, incident.status_changed, vds.tick |
| Secrets at rest | AES-256-GCM |
| Webhook integrity | HMAC-SHA256, constant-time compare |
| Paris tool cap | 5 iterations/question; 4 read-only tools |
| DB | Managed Postgres, Frankfurt (EU), portable |
| Full sync (mock, few hundred devices) | 2–4 s |
| Parsons' own numbers | 76 iNET installs, 100+ ATMS; NYSDOT $33M, 6,000+ controllers (20 Jul 2026) |

Good luck tomorrow — you're well armed.
