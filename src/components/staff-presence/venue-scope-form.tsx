"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { selectAdminVenue } from "@/core/staff-presence/actions";
import type { AdminVenueOption } from "@/core/staff-presence/directory";

interface VenueScopeFormProps {
  venues: AdminVenueOption[];
  currentVenueId: string | null;
  label: string;
  submitLabel: string;
}

export function VenueScopeForm({
  venues,
  currentVenueId,
  label,
  submitLabel,
}: VenueScopeFormProps): React.ReactElement {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      action={async (formData) => {
        const venueId = String(formData.get("venueId") ?? "");
        const selected = venues.find((row) => row.id === venueId);
        if (selected === undefined) {
          return;
        }
        await selectAdminVenue({
          venueId: selected.id,
          businessId: selected.businessId,
        });
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <Label htmlFor="admin-venue">{label}</Label>
        <select
          id="admin-venue"
          name="venueId"
          defaultValue={currentVenueId ?? venues[0]?.id ?? ""}
          className="h-11 w-full rounded-md border border-input bg-background px-3"
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
