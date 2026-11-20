import type { Metadata } from "next";
import Link from "next/link";
import { CatalogStatus } from "@/components/CatalogStatus";
import { Button } from "@/components/ui/button";
import { loadCatalogStatusServer } from "@/lib/server-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog status",
  robots: { index: false, follow: true },
};

// The former home page content; moves to the account page once sign-in exists.
export default async function StatusPage() {
  const initialStatus = await loadCatalogStatusServer();

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Enigmic
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Catalog status</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Browser traffic stays on this origin. The BFF at{" "}
        <code className="font-mono text-[10px]">/api/cards/*</code> holds the server-side
        credential and calls the public Card API.
      </p>

      <div className="mt-8">
        <CatalogStatus initial={initialStatus} />
      </div>

      <section className="mt-6">
        <Button asChild>
          <Link href="/browse">Browse cards</Link>
        </Button>
      </section>
    </>
  );
}
