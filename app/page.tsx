import Link from "next/link";
import type { CardApiSet } from "@enigmic-co/card-api-contracts";
import { CardGrid } from "@/components/CardGrid";
import { HomeSearch } from "@/components/HomeSearch";
import { loadHomePageData } from "@/lib/catalog.server";
import { hrefForSetFilter } from "@/lib/search-url";

// Rendered per request so a deploy never bakes in an empty page when card-api
// is unreachable at build time; the lists still come from the data cache.
export const dynamic = "force-dynamic";

function formatReleaseDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

function SectionHeading({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <Link
        href={href}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

function SetTile({ set }: { set: CardApiSet }) {
  const code = set.codes[0];
  const released = formatReleaseDate(set.releaseDate);
  const body = (
    <>
      <span className="line-clamp-2 font-medium leading-snug">{set.name}</span>
      <span className="mt-2 text-xs text-muted-foreground">
        {[released, set.cardCount != null ? `${set.cardCount} cards` : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </>
  );
  const className =
    "flex h-full flex-col justify-between rounded-lg border border-border/60 bg-card p-4 text-sm";

  return code ? (
    <Link
      href={hrefForSetFilter(code)}
      className={`${className} transition-colors hover:border-foreground/30`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function HomePage() {
  const { newestSets, newestCards } = await loadHomePageData();
  // undefined = the request failed (an empty list is just left out).
  const listsUnavailable = newestSets === undefined || newestCards === undefined;

  return (
    <div className="space-y-12">
      <section className="mx-auto max-w-2xl pt-6 text-center sm:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Enigmic Cards
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Search the Yu-Gi-Oh! card catalog: card text, stats, printings and legality.
        </p>
        <div className="mt-6 text-left">
          <HomeSearch />
        </div>
      </section>

      {listsUnavailable ? (
        <p
          role="status"
          className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          {newestSets === undefined && newestCards === undefined
            ? "The newest sets and cards"
            : newestSets === undefined
              ? "The newest sets"
              : "The newest cards"}{" "}
          couldn&apos;t be loaded right now. The card catalog may be busy or offline; try
          again in a moment.
        </p>
      ) : null}

      {newestSets && newestSets.length > 0 ? (
        <section aria-labelledby="newest-sets">
          <SectionHeading
            id="newest-sets"
            title="Newest sets"
            href="/sets"
            linkLabel="All sets"
          />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {newestSets.map((set) => (
              <li key={set.id}>
                <SetTile set={set} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {newestCards && newestCards.length > 0 ? (
        <section aria-labelledby="newest-cards">
          <SectionHeading
            id="newest-cards"
            title="Newest cards"
            href="/browse"
            linkLabel="Browse all"
          />
          <CardGrid cards={newestCards} />
        </section>
      ) : null}

      <section className="max-w-2xl border-t border-border/40 pt-6 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-2 font-medium text-foreground">What is this?</h2>
        <p>
          A Yu-Gi-Oh! card catalog built from Konami&apos;s official card database, with
          printings, sets and ban-list legality. It is a hobby project and not affiliated
          with Konami.{" "}
          <Link
            href="/status"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Catalog status
          </Link>
        </p>
      </section>
    </div>
  );
}
