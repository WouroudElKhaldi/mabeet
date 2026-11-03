import { Skeleton } from "@/components/ui/skeleton";

// The shape of the place page: title, photos, then the text column beside the booking box.
export default function Loading() {
  return (
    <div className="mx-auto max-w-280 px-4 pt-6 sm:px-6 lg:px-10">
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-6 aspect-4/3 w-full rounded-xl lg:aspect-auto lg:h-104" />
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="mt-6 h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
