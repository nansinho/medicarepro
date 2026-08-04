import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      /* bg-secondary et non bg-accent : `accent` est une surface bleutée,
         un squelette qui pulse en bleu se lit comme un contenu chargé. */
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  )
}

export { Skeleton }
