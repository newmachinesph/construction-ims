"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { Input, Select, FormError } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Table, TableWrap, THead, TBody, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { api } from "@/components/ui/api";
import { formatManila } from "@/lib/ph";
import { ROLE_LABELS } from "@/lib/rbac";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

function roleLabel(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

export function UsersTable({ rows, canWrite }: { rows: UserRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inline edit of name + email.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ fullName: "", email: "" });

  async function updateUser(id: string, body: Record<string, unknown>) {
    setError(null);
    setPendingId(id);
    const result = await api.patch(`/api/users/${id}`, body);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  function startEdit(u: UserRow) {
    setError(null);
    setEditingId(u.id);
    setDraft({ fullName: u.fullName, email: u.email });
  }

  const colCount = canWrite ? 6 : 5;

  return (
    <section className="flex flex-col gap-3">
      <FormError>{error}</FormError>
      <TableWrap>
        <Table>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Last login</Th>
            <Th>Active</Th>
            {canWrite ? <Th /> : null}
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={colCount}>No users found.</EmptyRow>
            ) : (
              rows.map((u) => {
                // The administrator's role is fixed and they cannot be deactivated —
                // there is no recovery flow if the last admin locks themselves out.
                // The server enforces this too; this only keeps the UI honest.
                const isAdmin = u.role === "ADMIN";
                const isEditing = editingId === u.id;
                const busy = pendingId === u.id;

                return (
                  <Tr key={u.id}>
                    <Td>
                      {isEditing ? (
                        <Input
                          aria-label={`Full name for ${u.email}`}
                          value={draft.fullName}
                          onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        u.fullName
                      )}
                    </Td>

                    <Td muted>
                      {isEditing ? (
                        <Input
                          aria-label={`Email for ${u.fullName}`}
                          type="email"
                          value={draft.email}
                          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        u.email
                      )}
                    </Td>

                    <Td>
                      {canWrite && !isAdmin ? (
                        <Select
                          aria-label={`Role for ${u.fullName}`}
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className="h-8 w-auto py-0 text-xs"
                        >
                          {ROLE_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {roleLabel(u.role)}
                          {isAdmin ? (
                            <span
                              title="The administrator's role is locked"
                              className="inline-flex items-center rounded border border-line-strong px-1 text-[10px] font-medium uppercase tracking-wide text-muted"
                            >
                              Locked
                            </span>
                          ) : null}
                        </span>
                      )}
                    </Td>

                    <Td muted className="whitespace-nowrap text-xs">
                      {u.lastLoginAt ? formatManila(u.lastLoginAt) : "never"}
                    </Td>

                    <Td>
                      {canWrite && !isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0.5"
                          disabled={busy}
                          onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                          title={u.isActive ? "Click to deactivate" : "Click to activate"}
                        >
                          <StatusBadge
                            value={u.isActive ? "ACTIVE" : "INACTIVE"}
                            tone={u.isActive ? "solid" : "muted"}
                          />
                        </Button>
                      ) : (
                        <StatusBadge
                          value={u.isActive ? "ACTIVE" : "INACTIVE"}
                          tone={u.isActive ? "solid" : "muted"}
                        />
                      )}
                    </Td>

                    {canWrite ? (
                      <Td>
                        {isEditing ? (
                          <span className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Save changes"
                              disabled={busy || !draft.fullName.trim() || !draft.email.trim()}
                              onClick={() =>
                                updateUser(u.id, {
                                  fullName: draft.fullName.trim(),
                                  email: draft.email.trim(),
                                })
                              }
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Cancel edit"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${u.fullName}`}
                            disabled={busy}
                            onClick={() => startEdit(u)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
