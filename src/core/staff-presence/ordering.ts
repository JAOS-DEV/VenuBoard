import type { StaffCarouselOrder } from "./constants";

export interface OrderableStaffProfile {
  publicId: string;
  displayName: string;
  displayOrder: number;
}

export function compareStaffCarouselOrder(
  left: OrderableStaffProfile,
  right: OrderableStaffProfile,
  order: StaffCarouselOrder,
): number {
  if (order === "name") {
    const byName = left.displayName.localeCompare(right.displayName, "en");
    if (byName !== 0) {
      return byName;
    }
  } else {
    const byOrder = left.displayOrder - right.displayOrder;
    if (byOrder !== 0) {
      return byOrder;
    }
    const byName = left.displayName.localeCompare(right.displayName, "en");
    if (byName !== 0) {
      return byName;
    }
  }

  return left.publicId.localeCompare(right.publicId);
}

export function sortStaffCarousel<T extends OrderableStaffProfile>(
  items: readonly T[],
  order: StaffCarouselOrder,
): T[] {
  return [...items].sort((left, right) =>
    compareStaffCarouselOrder(left, right, order),
  );
}
