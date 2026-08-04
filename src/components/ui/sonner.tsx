"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { useAdminTheme } from "@/components/admin/AdminThemeProvider"

/* Le thème vient du sélecteur explicite du back office, pas de next-themes :
   celui-ci tournait sans fournisseur et renvoyait "system", donc les toasts
   suivaient le réglage de l'OS — exactement ce qui a été écarté. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { mode } = useAdminTheme()

  return (
    <Sonner
      theme={mode}
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--r-sm, 12px)",
          "--normal-shadow": "var(--mp-shadow-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
