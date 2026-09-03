import { mapEventsModuleAvailability } from "@/core/events/module-state";
import type { EventsModuleAvailability } from "@/core/events/module-state";

export type AtmosphereModuleAvailability = EventsModuleAvailability;

export const mapAtmosphereModuleAvailability = mapEventsModuleAvailability;
