"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogStatusSnapshot } from "@/lib/server-catalog-types";
import { createBrowserCardClient } from "@/lib/card-client.browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CLIENT_FETCH_TIMEOUT_MS = 12_000;
const cardClient = createBrowserCardClient();

interface CatalogStatusProps {
  initial: CatalogStatusSnapshot;
}

export function CatalogStatus({ initial }: CatalogStatusProps) {
  const [status, setStatus] = useState<CatalogStatusSnapshot>(initial);
  const [source, setSource] = useState<"server" | "bff">("server");
  // Starts true: the mount effect below fetches straight away.
  const [isRefreshing, setIsRefreshing] = useState(true);

  // A promise chain rather than async/await: every setState then runs in a
  // callback, so the mount effect can call this without tripping
  // react-hooks/set-state-in-effect.
  const loadViaBff = useCallback(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

    return Promise.all([
      cardClient.getHealth(controller.signal),
      cardClient.getDataVersion(controller.signal),
    ])
      .then(([healthResponse, versionResponse]) => {
        setStatus({
          health: healthResponse.status,
          dataVersion: versionResponse.data.version,
          error: null,
        });
        setSource("bff");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.name === "AbortError"
            ? "The catalog BFF request timed out. Try again or refresh the page."
            : error instanceof Error
              ? error.message
              : "Failed to reach the catalog BFF.";

        setStatus((current) => ({
          ...current,
          error: message,
        }));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setIsRefreshing(false);
      });
  }, []);

  const refreshViaBff = useCallback(() => {
    setIsRefreshing(true);
    void loadViaBff();
  }, [loadViaBff]);

  useEffect(() => {
    void loadViaBff();
  }, [loadViaBff]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && status.error) {
        refreshViaBff();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshViaBff, status.error]);

  return (
    <Card className="rounded-xl border-border/50 py-0 shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 border-b border-border/40 py-4">
        <CardTitle className="text-base">Catalog status</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshViaBff}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh via BFF"}
        </Button>
      </CardHeader>

      <CardContent className="py-5">
        {status.error ? (
          <p
            className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {status.error}
          </p>
        ) : null}

        <dl className="grid gap-3">
          <div>
            <dt className="text-sm text-muted-foreground">Health</dt>
            <dd className="mt-1 text-sm">{status.health ?? "unavailable"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Data version</dt>
            <dd className="mt-1 break-all font-mono text-[10px]">
              {status.dataVersion ?? "unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Loaded from</dt>
            <dd className="mt-1 text-sm">
              {source === "bff"
                ? "Browser → /api/cards BFF (@enigmic-co/card-sdk)"
                : "Server catalog proxy"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
