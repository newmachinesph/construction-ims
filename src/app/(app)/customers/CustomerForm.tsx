"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, FormError } from "@/components/ui/Field";
import { api } from "@/components/ui/api";
import { useToast } from "@/lib/store/toast";

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  tin: string | null;
  address: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

interface FormValues {
  code: string;
  name: string;
  tin: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  isActive: boolean;
}

type Props =
  | { mode: "create"; onDone?: () => void }
  | { mode: "edit"; customer: CustomerRow; onDone?: () => void };

function toValues(c?: CustomerRow): FormValues {
  return {
    code: c?.code ?? "",
    name: c?.name ?? "",
    tin: c?.tin ?? "",
    address: c?.address ?? "",
    contactPerson: c?.contactPerson ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    isActive: c?.isActive ?? true,
  };
}

export function CustomerForm(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const isEdit = props.mode === "edit";

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: toValues(isEdit ? props.customer : undefined),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const body = {
      ...values,
      tin: values.tin.trim() || null,
      address: values.address.trim() || null,
      contactPerson: values.contactPerson.trim() || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
    };

    const result = isEdit
      ? await api.patch(`/api/customers/${props.customer.id}`, body)
      : await api.post("/api/customers", body);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Customer updated" : "Customer created");
    if (!isEdit) reset(toValues());
    props.onDone?.();
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError>{error}</FormError>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!isEdit ? (
          <Field label="Code" htmlFor="c-code" required>
            <Input id="c-code" required {...register("code")} />
          </Field>
        ) : null}
        <Field label="Name" htmlFor="c-name" required className="lg:col-span-2">
          <Input id="c-name" required {...register("name")} />
        </Field>
        <Field label="TIN" htmlFor="c-tin" hint="000-000-000">
          <Input id="c-tin" {...register("tin")} />
        </Field>
        <Field label="Contact person" htmlFor="c-contact">
          <Input id="c-contact" {...register("contactPerson")} />
        </Field>
        <Field label="Phone" htmlFor="c-phone">
          <Input id="c-phone" {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="c-email">
          <Input id="c-email" type="email" {...register("email")} />
        </Field>
        <Field label="Address" htmlFor="c-address" className="lg:col-span-2">
          <Input id="c-address" {...register("address")} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="size-4 rounded border-line-strong accent-ink" {...register("isActive")} />
        Active
      </label>
      <div className="flex justify-end gap-2">
        {isEdit ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => props.onDone?.()}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
