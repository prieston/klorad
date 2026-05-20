"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Button,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Modal,
  Panel,
} from "@klorad/design-system";
import { useMaps } from "@/app/hooks/useMaps";
import LocationsHeader from "./LocationsHeader";

interface Props {
  orgId: string;
  userId: string;
}

export default function MapsPageClient({ orgId }: Props) {
  const router = useRouter();
  const { maps, isLoading, createMap, deleteMap } = useMaps(orgId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setNewName("");
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const map = await createMap(newName.trim());
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    if (map) router.push(`/org/${orgId}/maps/${map.id}`);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await deleteMap(confirmDelete.id);
    setDeleting(false);
    setConfirmDelete(null);
  };

  const showSkeleton = isLoading && maps.length === 0;

  return (
    <div className="w-full space-y-8 px-6 py-8 md:px-10">
      <LocationsHeader maps={maps} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="group flex min-h-[208px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-1 text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <AddIcon fontSize="small" />
          </span>
          <span className="text-sm font-medium">New map</span>
          <span className="text-xs text-text-tertiary">
            Create a new campus map
          </span>
        </button>

        {showSkeleton
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[208px] animate-pulse rounded-2xl bg-surface-2"
              />
            ))
          : maps.map((map) => (
              <CampusCard
                key={map.id}
                name={map.name}
                updatedAt={map.updatedAt}
                thumbnail={map.thumbnail ?? undefined}
                href={`/org/${orgId}/maps/${map.id}`}
                onEdit={() => router.push(`/org/${orgId}/maps/${map.id}`)}
                onDelete={() =>
                  setConfirmDelete({ id: map.id, name: map.name })
                }
              />
            ))}
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="New campus map"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? "Creating…" : "Create map"}
            </Button>
          </>
        }
      >
        <Field label="Map name">
          <Input
            autoFocus
            placeholder="e.g. Main Campus"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </Field>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Delete map?"
        description={`"${confirmDelete?.name ?? ""}" and all its POIs will be permanently removed. This cannot be undone.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete map"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function CampusCard({
  name,
  updatedAt,
  thumbnail,
  href,
  onEdit,
  onDelete,
}: {
  name: string;
  updatedAt: string | number | Date;
  thumbnail?: string;
  href: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const updated = new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="group relative">
      <Link href={href} className="block">
        <Panel className="overflow-hidden rounded-2xl transition-colors duration-200 group-hover:border-line-strong">
          <div className="aspect-video bg-surface-2">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="p-4">
            <div className="truncate font-medium text-text-primary">{name}</div>
            <div className="mt-1 text-xs text-text-tertiary">
              Updated {updated}
            </div>
          </div>
        </Panel>
      </Link>
      <div className="absolute right-2 top-2">
        <Menu
          trigger={
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Map options"
              className="bg-surface-1"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          }
        >
          <MenuItem onClick={onEdit}>Edit</MenuItem>
          <MenuItem tone="danger" onClick={onDelete}>
            Delete
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}
