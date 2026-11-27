"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Shown when a page fails to render on the server (usually card-api being
// unreachable). Layout, nav and footer stay; the digest ties it to the logs.
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        This page didn&apos;t load
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        The card catalog may be busy or offline. Try again in a moment; if it keeps
        happening, check the catalog status.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/status">Catalog status</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
