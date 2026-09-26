import type { ReactElement, SVGProps } from "react";
import * as I from "@/components/icons";
import type { IconKey } from "@/lib/cms/sections.schema";

/* Résolution des clés d'icônes du CMS (IconKeySchema) vers les composants
   d'icons.tsx. Un seul registre pour tout le kit de la vitrine. */
const MAP: Record<IconKey, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  ShieldPlus: I.ShieldPlus,
  Shield: I.Shield,
  ShieldCheck: I.ShieldCheck,
  Phone: I.Phone,
  Mail: I.Mail,
  MapPin: I.MapPin,
  Headset: I.Headset,
  Lock: I.Lock,
  CheckCircle: I.CheckCircle,
  Grid: I.Grid,
  Clock: I.Clock,
  FileText: I.FileText,
  Signature: I.Signature,
  Calculator: I.Calculator,
  Calendar: I.Calendar,
  Smartphone: I.Smartphone,
  Invoice: I.Invoice,
  BadgeCheck: I.BadgeCheck,
  Refresh: I.Refresh,
  Monitor: I.Monitor,
  User: I.User,
  Star: I.Star,
  Facebook: I.Facebook,
  LinkedIn: I.LinkedIn,
  Instagram: I.Instagram,
  XSocial: I.XSocial,
  YouTube: I.YouTube,
  Eye: I.Eye,
  Users: I.Users,
  Info: I.Info,
  Server: I.Server,
  Key: I.Key,
  Globe: I.Globe,
  Sparkles: I.Sparkles,
  Zap: I.Zap,
  TrendingUp: I.TrendingUp,
  Wallet: I.Wallet,
  Layers: I.Layers,
  Foot: I.Foot,
  Insole: I.Insole,
};

export function Icon({
  name,
  ...props
}: { name: IconKey | string } & SVGProps<SVGSVGElement>) {
  const Cmp = MAP[name as IconKey] ?? I.CheckCircle;
  return <Cmp aria-hidden="true" {...props} />;
}
