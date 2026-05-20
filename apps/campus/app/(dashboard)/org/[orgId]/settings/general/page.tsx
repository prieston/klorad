"use client";

import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { Button, Field, Input, Panel, Spinner, cn } from "@klorad/design-system";
import { showToast } from "@klorad/ui";
import { useOrganization } from "@/app/hooks/useOrganizations";

export default function SettingsGeneralPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const { organization, loadingOrganization, error: orgError, mutate } =
    useOrganization(orgId);

  const [formData, setFormData] = useState({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        slug: organization.slug || "",
      });
    }
  }, [organization]);

  const error = orgError ? "Failed to load organization data" : null;

  const handleChange =
    (field: "name" | "slug") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSave = async () => {
    if (!organization || !orgId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          ...(organization.isPersonal ? {} : { slug: formData.slug }),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update organization");
      }
      await mutate();
      showToast("Organization updated successfully", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loadingOrganization) {
    return (
      <div className="flex w-full justify-center px-6 py-20">
        <Spinner />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="w-full px-6 py-8 md:px-10">
        <Callout tone="error">Organization not found</Callout>
      </div>
    );
  }

  const hasChanges =
    formData.name !== organization.name ||
    formData.slug !== (organization.slug ?? "");
  const canEdit =
    organization.userRole === "owner" || organization.userRole === "admin";
  const scopeLabel = organization.isPersonal ? "Workspace" : "Organization";

  return (
    <div className="w-full space-y-6 px-6 py-8 md:px-10">
      <div className="flex items-center justify-end gap-2 border-b border-line-soft pb-5">
        {hasChanges && (
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() =>
              setFormData({
                name: organization.name,
                slug: organization.slug ?? "",
              })
            }
          >
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          className="min-w-[96px]"
          disabled={!canEdit || !hasChanges || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Panel className="rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-text-primary">
          {scopeLabel} settings
        </h2>

        {error && (
          <Callout tone="error" className="mt-3">
            {error}
          </Callout>
        )}
        {!canEdit && (
          <Callout tone="info" className="mt-3">
            You need admin or owner role to edit {scopeLabel.toLowerCase()}{" "}
            settings.
          </Callout>
        )}

        <div className="mt-5 space-y-5">
          <Field label={`${scopeLabel} name *`}>
            <Input
              value={formData.name}
              onChange={handleChange("name")}
              disabled={!canEdit || saving}
              placeholder={`Enter ${scopeLabel.toLowerCase()} name`}
            />
          </Field>
          <Field
            label="Slug *"
            hint={
              organization.isPersonal
                ? "Personal organization slug cannot be changed"
                : "URL-friendly identifier — lowercase letters, numbers, hyphens, underscores"
            }
          >
            <Input
              value={formData.slug}
              onChange={handleChange("slug")}
              disabled={!canEdit || saving || organization.isPersonal}
              placeholder={`Enter ${scopeLabel.toLowerCase()} slug`}
            />
          </Field>
        </div>

        <div className="mt-6 border-t border-line-soft pt-5">
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
            {scopeLabel} information
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm text-text-secondary">
            <div>
              {scopeLabel} ID:{" "}
              <span className="text-text-primary">{organization.id}</span>
            </div>
            <div>
              Type:{" "}
              <span className="text-text-primary">
                {organization.isPersonal ? "Personal" : "Team"}
              </span>
            </div>
            <div>
              Your role:{" "}
              <span className="text-text-primary">
                {organization.userRole || "Member"}
              </span>
            </div>
          </dl>
        </div>
      </Panel>
    </div>
  );
}

function Callout({
  tone,
  children,
  className,
}: {
  tone: "error" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<typeof tone, string> = {
    error: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
    info: "border-line-soft bg-accent-soft text-text-secondary",
  };
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
