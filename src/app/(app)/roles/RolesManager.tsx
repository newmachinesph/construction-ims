"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { cn } from "@/components/ui/cn";
import { PERMISSION_GROUPS, type Permission } from "@/lib/rbac";

interface Role {
  key: string;
  label: string;
  isSystem: boolean;
  isLocked: boolean;
  permissions: Permission[];
  userCount: number;
}

const TOTAL_PERMISSIONS = PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0);

/** Grouped checkbox grid over the whole permission catalogue. */
function PermissionGrid({
  selected,
  disabled,
  onToggle,
  onToggleGroup,
}: {
  selected: Set<Permission>;
  disabled: boolean;
  onToggle: (p: Permission) => void;
  onToggleGroup: (keys: Permission[], on: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {PERMISSION_GROUPS.map((group) => {
        const keys = group.permissions.map((p) => p.key);
        const allOn = keys.every((k) => selected.has(k));
        return (
          <div key={group.label} className="rounded-md border border-line bg-surface-2/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onToggleGroup(keys, !allOn)}
                  className="text-[11px] font-medium text-ink-soft hover:text-ink"
                >
                  {allOn ? "Clear" : "All"}
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {group.permissions.map((p) => (
                <label
                  key={p.key}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    disabled ? "text-muted" : "text-ink",
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={selected.has(p.key)}
                    disabled={disabled}
                    onChange={() => onToggle(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RolesManager({
  initialRoles,
  canWrite,
}: {
  initialRoles: Role[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // At most one role is edited at a time.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftPerms, setDraftPerms] = useState<Set<Permission>>(new Set());

  // Create form.
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPerms, setNewPerms] = useState<Set<Permission>>(new Set());

  function startEdit(role: Role) {
    setError(null);
    setEditingKey(role.key);
    setDraftLabel(role.label);
    setDraftPerms(new Set(role.permissions));
  }

  function toggle(set: Set<Permission>, setter: (s: Set<Permission>) => void, p: Permission) {
    const next = new Set(set);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setter(next);
  }

  function toggleGroup(
    set: Set<Permission>,
    setter: (s: Set<Permission>) => void,
    keys: Permission[],
    on: boolean,
  ) {
    const next = new Set(set);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    setter(next);
  }

  async function saveEdit(role: Role) {
    setError(null);
    setPending(true);
    const res = await api.patch<Role>(`/api/roles/${role.key}`, {
      label: draftLabel.trim(),
      permissions: [...draftPerms],
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRoles((rs) =>
      rs.map((r) =>
        r.key === role.key
          ? { ...r, label: draftLabel.trim(), permissions: [...draftPerms] }
          : r,
      ),
    );
    setEditingKey(null);
    router.refresh();
  }

  async function createRole() {
    setError(null);
    setPending(true);
    const res = await api.post<Role>("/api/roles", {
      label: newLabel.trim(),
      permissions: [...newPerms],
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCreating(false);
    setNewLabel("");
    setNewPerms(new Set());
    router.refresh();
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete the role "${role.label}"? This cannot be undone.`)) return;
    setError(null);
    setPending(true);
    const res = await api.del(`/api/roles/${role.key}`);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRoles((rs) => rs.filter((r) => r.key !== role.key));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError>{error}</FormError>

      {canWrite ? (
        <section className="rounded-card border border-line bg-surface">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">New role</h2>
            <Button
              variant={creating ? "secondary" : "primary"}
              size="sm"
              onClick={() => {
                setCreating((v) => !v);
                setNewLabel("");
                setNewPerms(new Set());
              }}
            >
              {creating ? (
                <>
                  <X className="size-4" /> Close
                </>
              ) : (
                <>
                  <Plus className="size-4" /> New role
                </>
              )}
            </Button>
          </div>

          {creating ? (
            <div className="flex flex-col gap-4 border-t border-line px-5 py-5">
              <Field label="Role name" htmlFor="newRoleLabel" required className="max-w-sm">
                <Input
                  id="newRoleLabel"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Bodega Supervisor"
                  required
                />
              </Field>
              <PermissionGrid
                selected={newPerms}
                disabled={false}
                onToggle={(p) => toggle(newPerms, setNewPerms, p)}
                onToggleGroup={(keys, on) => toggleGroup(newPerms, setNewPerms, keys, on)}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {newPerms.size} of {TOTAL_PERMISSIONS} permissions selected
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending || !newLabel.trim()}
                    onClick={createRole}
                  >
                    {pending ? "Saving…" : "Create role"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        {roles.map((role) => {
          const isEditing = editingKey === role.key;
          const editable = canWrite && !role.isLocked;

          return (
            <section key={role.key} className="rounded-card border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{role.label}</span>
                  {role.isLocked ? (
                    <span className="inline-flex items-center gap-1 rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      <Lock className="size-3" /> Locked
                    </span>
                  ) : role.isSystem ? (
                    <span className="inline-flex items-center rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Built-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded border border-line-strong px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      Custom
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {role.isLocked ? "Full access" : `${role.permissions.length} permissions`}
                    {" · "}
                    {role.userCount} {role.userCount === 1 ? "user" : "users"}
                  </span>
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (isEditing ? setEditingKey(null) : startEdit(role))}
                    >
                      {isEditing ? (
                        <>
                          <X className="size-4" /> Close
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-4" /> Edit
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>

              {role.isLocked ? (
                <div className="border-t border-line px-5 py-3 text-xs text-muted">
                  The Administrator always has every permission and cannot be edited or deleted —
                  this prevents anyone from locking themselves out of the system.
                </div>
              ) : isEditing ? (
                <div className="flex flex-col gap-4 border-t border-line px-5 py-5">
                  <Field label="Role name" htmlFor={`label-${role.key}`} required className="max-w-sm">
                    <Input
                      id={`label-${role.key}`}
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      required
                    />
                  </Field>
                  <PermissionGrid
                    selected={draftPerms}
                    disabled={false}
                    onToggle={(p) => toggle(draftPerms, setDraftPerms, p)}
                    onToggleGroup={(keys, on) => toggleGroup(draftPerms, setDraftPerms, keys, on)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {draftPerms.size} of {TOTAL_PERMISSIONS} permissions selected
                    </span>
                    <div className="flex gap-2">
                      {!role.isSystem ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-alert"
                          disabled={pending}
                          onClick={() => deleteRole(role)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={pending || !draftLabel.trim()}
                        onClick={() => saveEdit(role)}
                      >
                        <Save className="size-4" /> {pending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
