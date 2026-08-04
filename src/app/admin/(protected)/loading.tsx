import { SkeletonPage } from "@/components/admin/kit/skeletons";

/* Squelette générique du back office. Hérité par tout segment qui n'a
   pas son propre loading.tsx : la navigation entre écrans admin ne
   laisse plus la page précédente figée sans retour.
   Il vit à l'intérieur d'AdminFrame, donc il a exactement la largeur de
   l'écran qu'il annonce. */
export default function AdminLoading() {
  return <SkeletonPage />;
}
