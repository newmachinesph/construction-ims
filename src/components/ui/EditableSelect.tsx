"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Select, Input } from "./Field";
import { Button } from "./Button";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A `<select>` with an inline "＋ new" creator, so a category or unit missing from
 * the list can be added without leaving the item form. The parent owns the option
 * list and the create call (`onCreate`): it should POST, append the new option to
 * its own state, and return it — this component then selects it.
 */
export function EditableSelect({
  id,
  value,
  onChange,
  options,
  onCreate,
  newLabel = "New",
  placeholder = "e.g. Drum",
  required,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Create the record; resolve with the new option, or reject with a message. */
  onCreate?: (name: string) => Promise<SelectOption>;
  newLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = text.trim();
    if (!name || !onCreate) return;
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate(name);
      onChange(created.value);
      setText("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add it.");
    } finally {
      setBusy(false);
    }
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            autoFocus
            value={text}
            placeholder={placeholder}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setAdding(false);
              }
            }}
          />
          <Button size="sm" aria-label={`Save ${newLabel}`} disabled={busy || !text.trim()} onClick={submit}>
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cancel"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
        {error ? <p className="text-xs text-alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {onCreate ? (
        <Button
          variant="secondary"
          size="sm"
          aria-label={newLabel}
          title={newLabel}
          disabled={disabled}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
