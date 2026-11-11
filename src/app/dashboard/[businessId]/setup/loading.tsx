import { Skeleton } from "@/components/ui/skeleton";

/** A screen of the guided setup while it loads: the progress bar, the question and its form. */
export default function SetupLoading() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-10 w-3/4 rounded-lg" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
