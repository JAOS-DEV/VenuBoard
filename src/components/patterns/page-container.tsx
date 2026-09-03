import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";

interface PageContainerProps extends ComponentProps<"div"> {
  width?: "default" | "narrow" | "wide";
}

export function PageContainer({
  className,
  width = "default",
  ...props
}: PageContainerProps): ReactElement {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-4 sm:px-6 sm:py-6",
        width === "narrow" && "max-w-xl",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-6xl",
        className,
      )}
      {...props}
    />
  );
}
