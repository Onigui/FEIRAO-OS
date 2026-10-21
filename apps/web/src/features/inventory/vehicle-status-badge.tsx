import { Badge } from "@/components/ui/badge";
import { VEHICLE_STATUS_LABEL } from "@/features/inventory/constants";
import type { VehicleStatus } from "@/features/inventory/types";
import { cn } from "@/lib/utils";

const TONE: Record<VehicleStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RESERVED: "bg-amber-100 text-amber-800 border-amber-200",
  SOLD: "bg-sky-100 text-sky-800 border-sky-200",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE[status])}>
      {VEHICLE_STATUS_LABEL[status]}
    </Badge>
  );
}
