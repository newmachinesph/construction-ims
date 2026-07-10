"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2, X } from "lucide-react";
import { api } from "@/components/ui/api";

interface Attachment {
  id: string;
  url: string;
  originalName: string | null;
  contentType: string;
  sizeBytes: number;
}

interface Props {
  entity: "item" | "goods_receipt";
  entityId: string;
  canWrite?: boolean;
  title?: string;
}

async function fetchAttachments(entity: string, entityId: string): Promise<Attachment[]> {
  const res = await fetch(`/api/attachments?entity=${entity}&entityId=${entityId}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Failed to load photos.");
  return body.data as Attachment[];
}

/**
 * Lists, uploads and deletes photos for a record. Talks to /api/attachments,
 * which streams bytes back through an auth-gated route (images are private).
 * The list is cached by React Query and invalidated after each mutation, so
 * navigating away and back doesn't re-flash a loader.
 */
export function PhotoManager({ entity, entityId, canWrite = false, title = "Photos" }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["attachments", entity, entityId];
  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchAttachments(entity, entityId),
  });

  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey });
  }

  async function upload(file: File) {
    setMutationError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("entity", entity);
      fd.set("entityId", entityId);
      fd.set("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setMutationError(body?.error ?? "Upload failed.");
        return;
      }
      await invalidate();
    } catch {
      setMutationError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setMutationError(null);
    setBusy(true);
    try {
      const result = await api.del(`/api/attachments/${id}`);
      if (!result.ok) {
        setMutationError(result.error);
        return;
      }
      await invalidate();
    } finally {
      setBusy(false);
    }
  }

  const displayError = mutationError ?? (isError ? (error instanceof Error ? error.message : "Failed to load photos.") : null);

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {canWrite && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-50"
            >
              <ImagePlus className="size-3.5" />
              {busy ? "Uploading…" : "Add photo"}
            </button>
          </>
        )}
      </div>

      {displayError && (
        <p className="mb-2 flex items-center gap-1 text-xs text-alert" role="alert">
          <X className="size-3.5" /> {displayError}
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-md border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated blob route, not a static asset */}
              <img src={a.url} alt={a.originalName ?? "photo"} className="aspect-square w-full object-cover" />
              {canWrite && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(a.id)}
                  aria-label={`Delete photo ${a.originalName ?? ""}`.trim()}
                  className="absolute right-1 top-1 hidden size-7 items-center justify-center rounded-md bg-ink/80 text-surface transition-colors hover:bg-ink focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper group-hover:flex group-focus-within:flex"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
