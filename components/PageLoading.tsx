// Route-level loading state (app/**/loading.tsx): shown at once while the
// server renders the next page, so a click never looks ignored. It fills the
// screen so the footer starts below the fold: on a slow first load the page
// streams in after it, and a short placeholder made the footer jump
// (Lighthouse CLS 0.36 on /browse and /sets, 2026-10-13).
export function PageLoading({ label }: { label: string }) {
  return (
    <div className="min-h-[100svh] py-16" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground motion-reduce:animate-none"
        />
        {label}
      </div>
    </div>
  );
}
