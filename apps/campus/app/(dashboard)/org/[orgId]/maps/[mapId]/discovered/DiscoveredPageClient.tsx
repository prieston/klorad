"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Newspaper,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Panel } from "@klorad/design-system";
import { CRAWLER_DEMO_LIMITS } from "@klorad/crawler/limits";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";

type ContentType = "news" | "event";

interface DiscoveredItemRow {
  id: string;
  sourceUrl: string;
  contentType: ContentType;
  extracted: Record<string, unknown>;
  createdAt: string;
  job: { startedAt: string; instructions: string | null };
}

interface DiscoveredResponse {
  items: DiscoveredItemRow[];
  countsByType: Record<string, number>;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as DiscoveredResponse;
  });

export default function DiscoveredPageClient({
  mapId,
  crawlerConfigured,
}: {
  mapId: string;
  crawlerConfigured: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ContentType>("news");
  const [urlText, setUrlText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, mutate } = useSWR<DiscoveredResponse>(
    `/api/maps/${mapId}/crawler/discovered`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = data?.items ?? [];
  const newsCount = data?.countsByType.news ?? 0;
  const eventCount = data?.countsByType.event ?? 0;
  const filtered = items.filter((i) => i.contentType === activeTab);

  const startCrawl = async () => {
    const urls = urlText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      toast.error("Paste at least one URL.");
      return;
    }
    if (urls.length > CRAWLER_DEMO_LIMITS.maxUrlsPerJob) {
      toast.error(
        `Demo cap is ${CRAWLER_DEMO_LIMITS.maxUrlsPerJob} URLs per crawl.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/crawler/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, instructions: instructions || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Crawl failed");
      toast.success(
        `Crawl done — ${body.itemsCreated} item${
          body.itemsCreated === 1 ? "" : "s"
        } extracted.`,
      );
      setUrlText("");
      setInstructions("");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Crawl failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/crawler/discovered/${id}/approve`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Approval failed");
      toast.success("Approved.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    }
  };

  const onReject = async (id: string) => {
    try {
      const res = await fetch(`/api/crawler/discovered/${id}/reject`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Rejected.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Agentic crawler"
        title="Discovered"
        subtitle="Pull news and events from the web; approve what's real, drop what isn't."
      />

      {!crawlerConfigured ? (
        <Panel className="mb-6 rounded-2xl p-6">
          <p className="text-sm text-text-secondary">
            Crawler not configured. Set <code>FIRECRAWL_API_KEY</code> and{" "}
            <code>ANTHROPIC_API_KEY</code> in this environment to enable the
            Start crawl button.
          </p>
        </Panel>
      ) : null}

      {/* Start crawl form */}
      <Panel className="mb-8 rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles
            size={16}
            strokeWidth={1.75}
            className="text-accent"
            aria-hidden
          />
          <h2 className="text-sm font-semibold text-text-primary">
            Start a crawl
          </h2>
          <span className="ml-auto text-xs text-text-tertiary">
            Demo cap: {CRAWLER_DEMO_LIMITS.maxUrlsPerJob} URLs / crawl,{" "}
            {CRAWLER_DEMO_LIMITS.maxPendingItems} items in inbox
          </span>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-text-secondary">
            URLs (one per line)
          </span>
          <textarea
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            rows={4}
            placeholder="https://example.edu/news/some-article&#10;https://example.edu/events/spring-2026"
            className="w-full rounded-xl border border-line-soft bg-white px-3 py-2 font-mono text-xs leading-relaxed text-text-primary focus:border-accent focus:outline-none"
            disabled={submitting || !crawlerConfigured}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-text-secondary">
            Instructions (optional)
          </span>
          <textarea
            value={instructions}
            onChange={(e) =>
              setInstructions(
                e.target.value.slice(
                  0,
                  CRAWLER_DEMO_LIMITS.maxInstructionsLength,
                ),
              )
            }
            rows={2}
            placeholder="e.g. Only extract items from the past 30 days. Skip alumni news."
            className="w-full rounded-xl border border-line-soft bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            disabled={submitting || !crawlerConfigured}
          />
          <span className="mt-1 block text-[0.7rem] text-text-tertiary">
            {instructions.length} /{" "}
            {CRAWLER_DEMO_LIMITS.maxInstructionsLength}
          </span>
        </label>

        <button
          type="button"
          onClick={startCrawl}
          disabled={submitting || !crawlerConfigured}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          ) : (
            <Sparkles size={14} strokeWidth={1.75} />
          )}
          {submitting ? "Crawling…" : "Start crawl"}
        </button>
      </Panel>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-full border border-line-soft bg-surface-1 p-1">
        <TabButton
          active={activeTab === "news"}
          onClick={() => setActiveTab("news")}
          icon={Newspaper}
          label="News"
          count={newsCount}
        />
        <TabButton
          active={activeTab === "event"}
          onClick={() => setActiveTab("event")}
          icon={Calendar}
          label="Events"
          count={eventCount}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <Panel className="rounded-2xl p-6 text-sm text-text-tertiary">
          Loading…
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="rounded-2xl p-8 text-center text-sm text-text-tertiary">
          Nothing pending. Start a crawl above to populate this inbox.
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <DiscoveredCard
              key={item.id}
              item={item}
              onApprove={() => onApprove(item.id)}
              onReject={() => onReject(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Newspaper;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
          : "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2"
      }
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
      <span
        className={
          active
            ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[0.65rem]"
            : "rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-text-tertiary"
        }
      >
        {count}
      </span>
    </button>
  );
}

function DiscoveredCard({
  item,
  onApprove,
  onReject,
}: {
  item: DiscoveredItemRow;
  onApprove: () => void;
  onReject: () => void;
}) {
  const payload = item.extracted as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title : "(no title)";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : typeof payload.description === "string"
        ? payload.description
        : "";
  const when =
    typeof payload.startsAt === "string"
      ? payload.startsAt
      : typeof payload.publishedAt === "string"
        ? payload.publishedAt
        : null;
  return (
    <article className="rounded-2xl border border-line-soft bg-white p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-text-primary">{title}</h3>
          {when ? (
            <p className="mt-1 text-xs text-text-tertiary">{when}</p>
          ) : null}
        </div>
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:text-accent-hover"
        >
          Source
          <ExternalLink size={12} strokeWidth={1.75} />
        </a>
      </header>
      {body ? (
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-text-secondary">
          {body}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          <CheckCircle2 size={12} strokeWidth={1.75} />
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-soft px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
        >
          <XCircle size={12} strokeWidth={1.75} />
          Reject
        </button>
      </div>
    </article>
  );
}
