"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";

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
  /** Compact single-thumbnail mode for forms; default is a gallery grid. */
  title?: string;
}

/**
 * Lists, uploads and deletes photos for a record. Talks to /api/attachments,
 * which streams bytes back through an auth-gated route (images are private).
 */
export function PhotoManager({ entity, entityId, canWrite = false, title = "Photos" }: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // No synchronous setState here: `loading` starts true, so the mount effect
  // that calls this must not flip state before its first await (react-hooks
  // set-state-in-effect). Refetches after upload/delete just skip the spinner.
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attachments?entity=${entity}&entityId=${entityId}`);
      const body = await res.json();
      if (body.ok) setItems(body.data);
    } finally {
      setLoading(false);
    }
  }, [entity, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("entity", entity);
      fd.set("entityId", entityId);
      fd.set("file", file);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const body = await res.json();
      if (!body.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

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
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-xs text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <ImagePlus className="size-3.5" />
              {busy ? "Uploading…" : "Add photo"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mb-2 flex items-center gap-1 text-xs text-alert">
          <X className="size-3.5" /> {error}
        </p>
      )}

      {loading ? (
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
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 hidden size-7 items-center justify-center rounded-md bg-ink/80 text-surface transition-colors hover:bg-ink group-hover:flex"
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
