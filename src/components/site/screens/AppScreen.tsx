import type { JSX } from "react";
import type { MockupKindKey } from "@/lib/cms/sections.schema";
import {
  AccountingScreen,
  AgendaScreen,
  AiScreen,
  BilanScreen,
  InvoiceScreen,
  OrthoScreen,
} from "./ScreensCabinet";
import {
  ChuteScreen,
  PortalScreen,
  PosturoScreen,
  PwaScreen,
  SignatureScreen,
  StatsScreen,
  VitaleScreen,
} from "./ScreensSuivi";
import s from "./screens.module.css";

/** Écrans disponibles : les mockups du CMS + les orthèses plantaires. */
export type ScreenKind = MockupKindKey | "ortho";

const SCREENS: Record<ScreenKind, () => JSX.Element> = {
  agenda: AgendaScreen,
  bilan: BilanScreen,
  bilanChute: ChuteScreen,
  bilanPosturo: PosturoScreen,
  ortho: OrthoScreen,
  invoice: InvoiceScreen,
  accounting: AccountingScreen,
  ai: AiScreen,
  signature: SignatureScreen,
  vitale: VitaleScreen,
  portal: PortalScreen,
  stats: StatsScreen,
  pwa: PwaScreen,
};

/**
 * Écran du logiciel à l'échelle de son conteneur (ordinateur de la
 * vitrine). Illustration : le parent le masque aux lecteurs d'écran.
 */
export default function AppScreen({ kind }: { kind: ScreenKind }) {
  const Screen = SCREENS[kind] ?? AgendaScreen;
  return (
    <div className={s.view}>
      <div className={s.root}>
        <Screen />
      </div>
    </div>
  );
}
