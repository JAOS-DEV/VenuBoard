"use client";

import type { ReactElement, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { useRouter } from "@/core/i18n/navigation";
import { cn } from "@/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
  href: string;
}

export interface FilterSelectField {
  id: string;
  label: string;
  value: string;
  options: readonly FilterSelectOption[];
}

interface ResponsiveFilterControlsProps {
  fields: readonly FilterSelectField[];
  chips: ReactNode;
}

function FilterSelect({ field }: { field: FilterSelectField }): ReactElement {
  const router = useRouter();

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      <select
        id={field.id}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base md:text-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        value={field.value}
        onChange={(event) => {
          const selected = field.options.find(
            (option) => option.value === event.target.value,
          );
          if (selected !== undefined) {
            router.push(selected.href);
          }
        }}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ResponsiveFilterControls({
  fields,
  chips,
}: ResponsiveFilterControlsProps): ReactElement {
  return (
    <>
      <div
        className={cn(
          "grid gap-3 md:hidden",
          fields.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
        data-testid="responsive-filter-selects"
      >
        {fields.map((field) => (
          <FilterSelect key={field.id} field={field} />
        ))}
      </div>
      <div
        className="hidden space-y-3 md:block"
        data-testid="responsive-filter-chips"
      >
        {chips}
      </div>
    </>
  );
}
