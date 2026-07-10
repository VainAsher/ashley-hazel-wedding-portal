import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Theme-tinted loading placeholder block. Pure Tailwind (`animate-pulse`),
 * no dependencies — size it with height/width utility classes.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-plum/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
