import { api } from "@/components/ui/api";
import type { SelectOption } from "@/components/ui/EditableSelect";

export interface CategoryOption {
  id: string;
  name: string;
}
export interface UomOption {
  code: string;
  label: string;
}

/** POST a new category and return it as a select option. Throws on failure. */
export async function createCategoryOption(name: string): Promise<SelectOption> {
  const res = await api.post<{ id: string; name: string }>("/api/categories", { name });
  if (!res.ok) throw new Error(res.error);
  return { value: res.data.id, label: res.data.name };
}

/** POST a new unit of measure and return it as a select option. Throws on failure. */
export async function createUomOption(name: string): Promise<SelectOption> {
  const res = await api.post<{ code: string; label: string }>("/api/uoms", { label: name });
  if (!res.ok) throw new Error(res.error);
  return { value: res.data.code, label: res.data.label };
}
