"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createVehicle } from "@/features/inventory/api";
import { VehicleForm } from "@/features/inventory/vehicle-form";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function NewVehiclePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: async (vehicle) => {
      toast.success("Carro cadastrado. Agora adicione as fotos.");
      queryClient.setQueryData(["vehicle", vehicle.id], vehicle);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      router.push(`/inventory/${vehicle.id}`);
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível cadastrar o carro.")),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Cadastrar carro"
        description="Preencha o básico; as fotos vêm no próximo passo."
        breadcrumbs={breadcrumbsForPath("/inventory/new")}
      />
      <Card className="bg-white/90">
        <CardContent className="pt-6">
          <VehicleForm
            submitLabel="Salvar e adicionar fotos"
            pending={mutation.isPending}
            onSubmit={(input) => mutation.mutate(input)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
