# PSMdt Commercial Blueprint — Draft v1

Working document for the Monday strategy sessions with Parsons. Goal: give the customer-facing teams (Jody, Evan, Richard Chylinski) the segments, pains, and quantified value stories they need to sell PSMdt as an optional module on iNET. All numbers are published industry benchmarks with sources; the Flyover pilot replaces them with our own measured figures over time.

---

## 1. Positioning in one paragraph

PSMdt is an optional iNET module ("the digital-twin module") that turns any iNET deployment into installable, real-time mobile apps for every stakeholder: maintenance crews, incident responders, traffic police, executives, even the public. It connects through APIs, requires zero development bandwidth from the iNET core team, and writes field activity back into iNET. It does not compete with any iNET module; it extends their reach to the field and monetizes data iNET already has.

**Guardrail (important):** Asset Guardian already owns asset inventory, work orders, and mobile data capture. PSMdt must always be presented as the *field-device telemetry twin + stakeholder communication layer* that feeds Asset Guardian, never as an alternative to it. The people we need to convince (Jody, Evan) own Asset Guardian; if PSMdt smells like competition, our champions become blockers.

---

## 2. The value logic (three claims, each with a benchmark anchor)

**Claim 1: See faults instantly instead of discovering them.**
One third of a major DOT's ITS field elements are in poor condition (Caltrans reports ~67% of TMS field elements in good condition; uptime 89% vs a 90% statutory target — Caltrans Mile Marker, 2019). Real-time fault push alerts attack exactly this gap: no more finding out a sign is dark from a citizen complaint.

**Claim 2: Dispatch on condition, not on schedule.**
Moving from reactive to condition-based maintenance saves 12–18% of maintenance cost, and reactive-heavy organizations can save 30–40% (US Dept. of Energy FEMP O&M Best Practices Guide). Every avoided or better-targeted site visit also saves a fully loaded truck roll (FDOT mandates 3 preventive visits per device per year, each priced with mobilization, travel, labor and traffic control; utility-sector estimates put a truck roll at $250–500).

**Claim 3: Minutes matter, and alerts buy minutes.**
Each minute a freeway lane stays blocked causes 4 minutes of post-clearance delay (FHWA EDC). Secondary-crash probability rises ~1 percentage point per 2–3 extra minutes of clearance time (FHWA-SA-19-042, 2019). Traffic incident management programs return benefit-cost ratios from 3:1 to over 38:1 (USDOT ITS JPO, 2017). PSMdt's push-to-phone alerting is an enabler of exactly these programs.

**Headline umbrella stat:** McKinsey (July 2025) estimates digital twins can improve capital and operational efficiency of public infrastructure by 20–30%.

---

## 3. Segments

### 3.1 Highway & toll-road concessionaires (incl. tunnel operators — the premium niche)

- **Who buys and how:** Private SPVs; no public tender — commercial negotiation via their O&M arm or the integrator already on the project. Opex/SaaS pricing fits their 25–35-year cashflow models.
- **The pain that opens the wallet:** availability-payment and penalty regimes. Concession contracts carry deductions sized by lanes affected, duration, and time of day (World Bank PPP guidance); FHWA confirms payments "can be reduced or eliminated" when incident-response and state-of-good-repair metrics slip. Device uptime and response times are contract money, not IT hygiene.
- **Tunnel sub-segment:** EU Directive 2004/54/EC makes equipment monitoring and availability a legal obligation for TEN-T tunnels, with a personally accountable Tunnel Manager. Hundreds of devices per km, safety-protected budgets. Highest willingness to pay per device.
- **PSMdt use cases:** device-health worlds for O&M crews with instant fault push; incident-response worlds for patrol vehicles; evidence trail (alert history, acknowledgements) for penalty disputes and handback audits.
- **Quantified story:** avoided penalty deductions (client-specific, ask for their deduction schedule) + 12–18% maintenance savings + faster clearance = fewer secondary incidents (~1pp per 2–3 min).
- **Seller's line:** *"Your availability KPIs live or die on field devices. PSMdt tells your crews the moment anything degrades, and proves your response times when the deduction dispute comes."*
- **Flyover pilot must prove:** time-to-detection before/after; number of faults caught by push alert vs discovered manually.

### 3.2 State DOTs / road authorities

- **Who buys and how:** formal RFPs, long cycles — but the realistic route is as a module rider on Parsons' existing statewide iNET contracts (NJDOT statewide 2025; NYSDOT $33M, 2026). No independent tendering needed.
- **Pain:** aging device fleets with poor inventory data (Caltrans: ~7,700 signals/signs/sensors to repair or replace); TMC operators blind to field-tech reality; federal asset-management compliance (risk-based TAMPs) demands condition data.
- **PSMdt use cases:** maintenance-district worlds; executive dashboards on phones; statewide fleets scoped per district; Asset Guardian field companion (inspections, work orders, write-back).
- **Quantified story:** per-device O&M baseline exists (WisDOT: ≈$1,282/camera/yr, ≈$1,676/DMS/yr) → apply 12–18% condition-based savings across a 1,000+ device fleet; add TIM enablement (B/C 3:1–38:1).
- **Seller's line:** *"You already run iNET statewide. This switches on a live field view of every device for every district, for less than what two truck rolls per device per year cost you today."*
- **Flyover pilot must prove:** truck rolls avoided per month; MTTR reduction.

### 3.3 Large municipalities / cities

- **Who buys and how:** public tender or cooperative purchasing; most budget-constrained segment; SaaS price must be small and defensible.
- **Pain:** understaffed signal/ITS maintenance (FHWA publishes staffing guidelines precisely because agencies can't staff it); citizen complaints are the de facto fault-detection system; liability exposure from failed devices.
- **PSMdt use cases:** small scoped worlds per department; civic-transparency public worlds (community goodwill + fewer complaint calls); simple alerting without TMC-grade tooling.
- **Quantified story:** modest: fewer truck rolls, faster fault awareness, plus the soft but real value of a branded public-facing app (511-style traveler information systems show measurable congestion-cost reductions — ~2.9% per metro area, LSE/ISR research via USDOT).
- **Seller's line:** *"Your residents report broken signs before your systems do. Flip that: your crew's phones know first, and your citizens get a city-branded live map."*
- **Flyover pilot must prove:** the one-tap install + white-label story (municipalities buy the demo, not the architecture).

### 3.4 Seaports

- **Who buys and how:** semi-commercial port authorities, tenders plus grant-funded multi-agency programs. Precedent is already ours: Port of Oakland FITS runs on iNET with Parsons holding a 5-year O&M contract — PSMdt slots into an existing structure.
- **Pain:** landside truck congestion, gate queues, rail-crossing blockages; emissions compliance (EPA documents gate management as an air-quality issue); terminal customers demand visibility.
- **PSMdt use cases:** carrier/trucker worlds (queue and gate status, scoped per terminal); port-ops device monitoring; incident push for landside events.
- **Quantified story:** truck turn-time value + emissions/idling reduction (grant-fundable); congestion cost anchor: US trucking lost $108.8B to congestion in 2022 (ATRI, 2024).
- **Seller's line:** *"Oakland proved iNET runs a port. PSMdt puts that intelligence in every trucker's and terminal operator's pocket, scoped to exactly what each may see."*
- **Flyover pilot relevance:** indirect — use it as the live demo of the same mechanics.

---

## 4. ROI model skeleton (fill with client numbers in the meeting)

Per-client annual value = A + B + C, where:

- **A. Maintenance savings** = (device count) × (annual O&M cost per device, default $1,300–1,700) × (12–18% conservative, 30% if reactive-heavy)
- **B. Avoided truck rolls** = (no-fault-found or avoidable visits per year) × ($250–500 per roll, or client's own fully loaded rate)
- **C. Incident/penalty value** = concessionaires: avoided deduction schedule; DOTs: minutes saved × 4:1 delay multiplier × value of time; safety: ~1pp secondary-crash reduction per 2–3 minutes of faster clearance

Rule for sellers: never present A+B+C as our claim; present the formula, plug in the client's own numbers live, and let their figures make the case.

---

## 5. What the Flyover pilot must measure (start baselining NOW, before deployment)

To replace benchmarks with our own numbers, we need before/after data. Capture the "before" immediately:

1. Current time-to-detection of a device fault (how is it discovered today, and how long after occurrence?)
2. Site visits per month per device type, and share that find nothing actionable
3. MTTR: fault occurrence → repair complete
4. Incident notification chain today: who learns what, when, via which channel
5. Maintenance cost baseline for the monitored device fleet

After 3–6 months of PSMdt: same five metrics. The deltas become the commercial deck's proof slide, and the made-up "10% fewer maintenance cycles" example becomes a measured number.

---

## 6. Benchmark library (for the deck's footnotes)

| # | Figure | Source, year | Strength |
|---|---|---|---|
| 1 | 12–18% maintenance savings preventive vs reactive; 30–40% for reactive-heavy orgs | US DOE FEMP O&M Guide, 2010 | Strong (gov) |
| 2 | ~1/3 of DOT ITS field elements in poor condition; 89% uptime vs 90% target | Caltrans Mile Marker, 2019 | Strong (gov) |
| 3 | 1 min lane blockage = 4 min delay | FHWA EDC TIM program | Strong (gov) |
| 4 | Secondary-crash probability +1pp per 2–3 min clearance time | FHWA-SA-19-042, 2019 | Strong (gov) |
| 5 | TIM program B/C ratios 3:1 to 38:1 | USDOT ITS JPO, 2017 | Strong (gov) |
| 6 | Per-device O&M: ≈$1,282/camera/yr, ≈$1,676/DMS/yr | WisDOT via ITS JPO, 2014 | Strong (gov, dated) |
| 7 | 3 preventive visits/device/yr mandated; 20%/10% corrective event rates | FDOT ITS Maintenance Cost Formula, 2017 | Strong (gov) |
| 8 | Truck roll $250–500 | S&C Electric, 2017 | Medium (vendor) |
| 9 | Digital twins: 20–30% efficiency on public infrastructure | McKinsey, Jul 2025 | Strong (consultancy) |
| 10 | 511/traveler info: ~2.9% congestion-cost reduction per metro | ISR/LSE via USDOT, 2019–20 | Strong (academic) |
| 11 | Tech-assisted inspection B/C 9.3:1 (Oregon DOT UAS) | USDOT ITS JPO, 2018 | Strong (gov) |
| 12 | Congestion cost to US trucking: $108.8B (2022) | ATRI, 2024 | Strong (industry) |
| 13 | Urban digital twins: $280B savings by 2030 | ABI Research, 2021 | Medium (forecast) |

Numbers 1–7 and 9–11 are safe in front of any audience. 8, 12, 13 are supporting color; label them as estimates.

---

## 7. Stakeholders and open items

- **Jody & Evan:** not identifiable from public sources (verified; no confident match on LinkedIn, press, or conference lists). Action: get full names, roles, and emails from Carla before the next session; do not guess. Until then, treat them as Asset Guardian's worldwide solution owners and tailor everything to "PSMdt feeds your module" framing.
- **Richard Chylinski:** already profiled (24-year Delcan ITS veteran, Canada/International). His lens: what can my clients deploy, at what effort, at what price.
- **Commercial model:** open by design ("Module 35" licensing, possible iNET white-label). Keep the blueprint model-agnostic; the value math works under any branding.
- **For the Monday session:** (1) validate the four segments and kill any that don't resonate; (2) pick the top 2 for the commercial deck; (3) agree the Flyover baseline metrics list; (4) get the deduction-schedule/penalty examples from a real concession if Parsons can share one.

---

## 8. Sources

Government/academic: DOE FEMP O&M Guide (www1.eere.energy.gov/femp/pdfs/om_5.pdf) · FHWA EDC TIM (fhwa.dot.gov/innovation/everydaycounts/edc-2/tim.cfm) · FHWA Benefits of TIM 2019 (highways.dot.gov/sites/fhwa.dot.gov/files/2022-06/fhwasa19042.pdf) · USDOT ITS JPO TIM briefing 2017 (itskrs.its.dot.gov) · Caltrans Mile Marker Winter 2019 (dot.ca.gov) · FDOT ITS Maintenance Cost Formula 2017 · WisDOT O&M costs via itskrs.its.dot.gov · Oregon DOT UAS study via itskrs.its.dot.gov/2021-b01602 · 511 study via itskrs.its.dot.gov/2020-b01465 · World Bank PPP road concessions (ppp.worldbank.org) · FHWA availability payments (fhwa.dot.gov/ipd/fact_sheets/availability_payments.aspx) · EU Directive 2004/54/EC (eur-lex.europa.eu).
Industry/consultancy: McKinsey digital twins for government infrastructure, Jul 2025 · ATRI congestion cost 2024 · ABI Research 2021 · S&C Electric truck-roll cost 2017.
Parsons context: Asset Guardian product page · Port of Oakland FITS releases (2024) · NJDOT statewide iNET (2025) · NYSDOT award (Jul 2026).
