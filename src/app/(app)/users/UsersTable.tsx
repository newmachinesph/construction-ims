"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Field";
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

  async function updateUser(id: string, body: Record<string, unknown>) {
    setError(null);
    setPendingId(id);
    const result = await api.patch(`/api/users/${id}`, body);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      {error ? <p className="text-xs text-alert">{error}</p> : null}
      <TableWrap>
        <Table>
          <THead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Last login</Th>
            <Th>Active</Th>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>No users found.</EmptyRow>
            ) : (
              rows.map((u) => (
                <Tr key={u.id}>
                  <Td>{u.fullName}</Td>
                  <Td muted>{u.email}</Td>
                  <Td>
                    {canWrite ? (
                      <Select
                        value={u.role}
                        disabled={pendingId === u.id}
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
                      roleLabel(u.role)
                    )}
                  </Td>
                  <Td muted className="whitespace-nowrap text-xs">
                    {u.lastLoginAt ? formatManila(u.lastLoginAt) : "never"}
                  </Td>
                  <Td>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0.5"
                        disabled={pendingId === u.id}
                        onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                        title={u.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        <StatusBadge value={u.isActive ? "ACTIVE" : "INACTIVE"} tone={u.isActive ? "solid" : "muted"} />
                      </Button>
                    ) : (
                      <StatusBadge value={u.isActive ? "ACTIVE" : "INACTIVE"} tone={u.isActive ? "solid" : "muted"} />
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </section>
  );
}
