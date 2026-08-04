import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* Fusionne des classes conditionnelles (clsx) puis dédoublonne les
   utilitaires Tailwind en conflit (tailwind-merge). Helper attendu par
   tous les composants du registre shadcn/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
