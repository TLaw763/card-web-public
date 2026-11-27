import Link from "next/link";

import {
  footerLinkClass as linkClass,
  SiteFooter as EnigmicFooter,
} from "@enigmic-co/ui/SiteFooter";
import { loadCardWebEnv } from "@/lib/env";

// Attribution and non-affiliation notice (WP4). The game icons are covered by
// D-054; card images by D-008 (YGOPRODeck).
export function SiteFooter() {
  const { contactEmail } = loadCardWebEnv();

  return (
    <EnigmicFooter
      links={
        <>
          <Link className={linkClass} href="/status">
            Catalog status
          </Link>
          {contactEmail ? (
            <span>
              Contact:{" "}
              <a className={linkClass} href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </span>
          ) : null}
        </>
      }
    >
      <p>
        <strong className="font-medium text-foreground">Enigmic Cards</strong> is an
        unofficial fan site. It is not affiliated with, endorsed, sponsored or approved by
        Konami.
      </p>
      <p>
        Yu-Gi-Oh! and its card names, card text, artwork and game icons are trademarks and
        copyrights of Konami Digital Entertainment and their respective owners. Card data
        comes from Konami&rsquo;s{" "}
        <a className={linkClass} href="https://www.db.yugioh-card.com/" rel="noopener">
          official card database
        </a>
        ; card images from{" "}
        <a className={linkClass} href="https://ygoprodeck.com/" rel="noopener">
          YGOPRODeck
        </a>
        .
      </p>
    </EnigmicFooter>
  );
}
