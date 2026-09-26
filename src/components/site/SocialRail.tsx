import { Icon } from "./icon";
import c from "./chrome.module.css";

type SocialLink = { label: string; icon: string; href: string };

/** Réseaux sociaux collés au bord gauche de l'écran, sur toutes les pages de
 *  la vitrine. Affiché seulement quand la gouttière est assez large pour ne
 *  pas recouvrir le contenu ; en dessous, le pied de page prend le relais. */
export default function SocialRail({ socials }: { socials: SocialLink[] }) {
  if (socials.length === 0) return null;
  return (
    <nav className={c.rail} aria-label="MediCare Pro sur les réseaux sociaux">
      <ul>
        {socials.map((s) => (
          <li key={s.label}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${s.label} (nouvel onglet)`}
              data-label={s.label}
            >
              <Icon name={s.icon} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
