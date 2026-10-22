import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { FAIR_STATUS_LABEL, FAIR_STATUS_VARIANT, formatFairPeriod } from "@/features/fairs/constants";
import type { FairSummary } from "@/features/fairs/types";
import { Badge } from "@/components/ui/badge";

export function FairCard({ fair, children }: { fair: FairSummary; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white/90 p-4" data-testid="fair-card">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/fairs/${fair.id}`} className="font-semibold text-primary hover:underline">
          {fair.name}
        </Link>
        <Badge variant={FAIR_STATUS_VARIANT[fair.status]}>{FAIR_STATUS_LABEL[fair.status]}</Badge>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" /> {formatFairPeriod(fair.startsAt, fair.endsAt)}
      </p>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" /> {fair.venue}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {fair.isOrganizer ? "Organizado por você" : `Organizado por ${fair.organizer.name}`} ·{" "}
        {fair.counts.acceptedStores} lojas · {fair.counts.vehicles} carros · {fair.counts.myVehicles} seus
      </p>
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
