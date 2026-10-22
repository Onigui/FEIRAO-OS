"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createFair } from "@/features/fairs/api";
import { FairForm } from "@/features/fairs/fair-form";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { RequireRole } from "@/components/auth/require-role";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

function NewFair() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: createFair,
    onSuccess: (fair) => {
      toast.success("Feirão criado");
      router.push(`/fairs/${fair.id}`);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível criar.")),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo feirão"
        description="Começa como rascunho. Depois você convida as lojas, escolhe seus carros e publica."
        breadcrumbs={breadcrumbsForPath("/fairs/new")}
      />
      <Card className="bg-white/90">
        <CardContent className="pt-6">
          <FairForm
            submitLabel="Criar feirão"
            pending={mutation.isPending}
            onSubmit={(i) => mutation.mutate(i)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewFairPage() {
  return (
    <RequireRole allow={["OWNER", "ADMIN"]}>
      <NewFair />
    </RequireRole>
  );
}
