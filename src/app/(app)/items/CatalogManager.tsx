"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

interface CategoryRow {
  id: string;
  code: string;
  name: string;
}
interface UomRow {
  code: string;
  label: string;
  isSystem: boolean;
}

/**
 * Rename or remove categories and units. A record still used by an item cannot be
 * deleted (the server refuses with a clear message); built-in units are locked.
 * Adding is done inline on the item form itself, so this panel is edit/delete only.
 */
export function CatalogManager({
  categories,
  uoms,
}: {
  categories: CategoryRow[];
  uoms: UomRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // key = `cat:<id>` or `uom:<code>` while its row is being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function save(url: string, body: Record<string, unknown>, okMsg: string) {
    setError(null);
    setBusy(true);
    const result = await api.patch(url, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setEditing(null);
    toast.success(okMsg);
    router.refresh();
  }

  async function remove(url: string, okMsg: string) {
    setError(null);
    setBusy(true);
    const result = await api.del(url);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(okMsg);
    router.refresh();
  }

  function editRow(key: string, current: string) {
    setError(null);
    setEditing(key);
    setDraft(current);
  }

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Manage categories &amp; units
        </h2>
        <Button variant={open ? "secondary" : "primary"} size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? (
            <>
              <X className="size-4" /> Close
            </>
          ) : (
            <>
              <Pencil className="size-4" /> Edit lists
            </>
          )}
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-5 border-t border-line px-5 py-5">
          <FormError>{error}</FormError>
          <p className="text-xs text-muted">
            Add new ones from the item form (＋). Here you can rename them, or delete one that no item
            uses yet.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Categories */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Categories</h3>
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                {categories.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No categories.</li>
                ) : (
                  categories.map((c) => {
                    const key = `cat:${c.id}`;
                    const isEditing = editing === key;
                    return (
                      <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                        {isEditing ? (
                          <>
                            <Input
                              aria-label={`Rename ${c.name}`}
                              className="h-8"
                              value={draft}
                              disabled={busy}
                              onChange={(e) => setDraft(e.target.value)}
                            />
                            <Button
                              size="sm"
                              aria-label="Save"
                              disabled={busy || !draft.trim()}
                              onClick={() => save(`/api/categories/${c.id}`, { name: draft.trim() }, "Category renamed")}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" aria-label="Cancel" onClick={() => setEditing(null)}>
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-ink">{c.name}</span>
                            <span className="tabular text-xs text-muted">{c.code}</span>
                            <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} disabled={busy} onClick={() => editRow(key, c.name)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${c.name}`}
                              disabled={busy}
                              onClick={() => remove(`/api/categories/${c.id}`, "Category deleted")}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Units */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Units of measure</h3>
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                {uoms.map((u) => {
                  const key = `uom:${u.code}`;
                  const isEditing = editing === key;
                  return (
                    <li key={u.code} className="flex items-center gap-2 px-3 py-2">
                      {isEditing ? (
                        <>
                          <Input
                            aria-label={`Rename ${u.label}`}
                            className="h-8"
                            value={draft}
                            disabled={busy}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <Button
                            size="sm"
                            aria-label="Save"
                            disabled={busy || !draft.trim()}
                            onClick={() => save(`/api/uoms/${u.code}`, { label: draft.trim() }, "Unit renamed")}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label="Cancel" onClick={() => setEditing(null)}>
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-ink">{u.label}</span>
                          <span className="tabular text-xs text-muted">{u.code}</span>
                          {u.isSystem ? (
                            <span
                              title="Built-in unit — locked"
                              className="inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-muted"
                            >
                              Built-in
                            </span>
                          ) : null}
                          <Button variant="ghost" size="sm" aria-label={`Edit ${u.label}`} disabled={busy} onClick={() => editRow(key, u.label)}>
                            <Pencil className="size-4" />
                          </Button>
                          {!u.isSystem ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${u.label}`}
                              disabled={busy}
                              onClick={() => remove(`/api/uoms/${u.code}`, "Unit deleted")}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
