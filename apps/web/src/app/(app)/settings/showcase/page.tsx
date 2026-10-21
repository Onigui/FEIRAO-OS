"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getShowcaseSettings, updateShowcaseSettings } from "@/features/inventory/api";
import type { ShowcaseSettings } from "@/features/inventory/types";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatPhone } from "@/lib/format";
import { RequireRole } from "@/components/auth/require-role";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  publicWhatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "WhatsApp com DDD"),
  city: z.string().trim().max(120),
  publicAddress: z.string().trim().max(300),
  acceptTerms: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

function defaults(s?: ShowcaseSettings): FormValues {
  return {
    publicWhatsapp: s?.publicWhatsapp ? formatPhone(s.publicWhatsapp) : "",
    city: s?.city ?? "",
    publicAddress: s?.publicAddress ?? "",
    acceptTerms: Boolean(s?.showcaseTermsAcceptedAt),
  };
}

function ShowcaseContent() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["showcase-settings"], queryFn: getShowcaseSettings });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (query.data) form.reset(defaults(query.data));
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: updateShowcaseSettings,
    onSuccess: (data, input) => {
      queryClient.setQueryData(["showcase-settings"], data);
      if (input.showcaseEnabled === true) toast.success("Vitrine ativada");
      else if (input.showcaseEnabled === false) toast.success("Vitrine desativada");
      else toast.success("Dados da vitrine salvos");
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível salvar.")),
  });

  if (query.isLoading) return <LoadingBlock rows={3} label="Carregando vitrine…" />;
  if (query.isError || !query.data) {
    return <ErrorPanel title="Não foi possível carregar a vitrine" onRetry={() => void query.refetch()} />;
  }
  const s = query.data;

  const payload = (values: FormValues) => ({
    publicWhatsapp: values.publicWhatsapp || null,
    city: values.city || null,
    publicAddress: values.publicAddress || null,
    ...(values.acceptTerms && !s.showcaseTermsAcceptedAt ? { acceptTerms: true } : {}),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Vitrine da loja"
        description="Os dados que aparecem para o público na vitrine e nos feirões."
        breadcrumbs={breadcrumbsForPath("/settings/showcase")}
        actions={
          s.showcaseEnabled ? (
            <Badge variant="success">Vitrine ativa</Badge>
          ) : (
            <Badge variant="muted">Vitrine desativada</Badge>
          )
        }
      />

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Endereço da vitrine</CardTitle>
          <CardDescription>
            {s.slug ? (
              <>
                Sua vitrine fica em{" "}
                <span className="font-medium text-foreground" data-testid="showcase-url">
                  {APP_URL}/vitrine/{s.slug}
                </span>
                . Para mudar, use Configurações (só o dono).
              </>
            ) : (
              <>
                A loja ainda não tem endereço.{" "}
                <Link href="/settings" className="text-primary underline">
                  Defina em Configurações
                </Link>{" "}
                (só o dono).
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Dados públicos</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((values) => mutation.mutate(payload(values)))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="publicWhatsapp">WhatsApp da loja</Label>
                <Input
                  id="publicWhatsapp"
                  inputMode="tel"
                  placeholder="(14) 99999-0000"
                  {...form.register("publicWhatsapp")}
                />
                {form.formState.errors.publicWhatsapp ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.publicWhatsapp.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" placeholder="Botucatu" {...form.register("city")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="publicAddress">Endereço (opcional)</Label>
                <Input
                  id="publicAddress"
                  placeholder="Av. Dep. Dante Delmanto, 1600"
                  {...form.register("publicAddress")}
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                disabled={Boolean(s.showcaseTermsAcceptedAt)}
                {...form.register("acceptTerms")}
              />
              <span>
                Li e aceito o{" "}
                <Link href="/termos" target="_blank" className="text-primary underline">
                  termo de uso da vitrine
                </Link>
                : a loja é responsável pelos contatos que recebe e garante que pode publicar as
                fotos e dados dos carros.
                {s.showcaseTermsAcceptedAt ? (
                  <span className="block text-xs text-muted-foreground">
                    Aceito em {formatDateTime(s.showcaseTermsAcceptedAt)} (versão {s.termsVersion}).
                  </span>
                ) : null}
              </span>
            </label>

            <Button type="submit" variant="outline" disabled={mutation.isPending}>
              Salvar dados
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {s.showcaseEnabled ? "Desativar a vitrine" : "Ativar a vitrine"}
          </CardTitle>
          <CardDescription>
            {s.showcaseEnabled
              ? "Os carros param de aparecer para o público. Nada é apagado."
              : "Precisa de endereço da vitrine, WhatsApp, cidade e termo aceito."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant={s.showcaseEnabled ? "outline" : "default"}
            disabled={mutation.isPending}
            onClick={form.handleSubmit((values) =>
              mutation.mutate({ ...payload(values), showcaseEnabled: !s.showcaseEnabled }),
            )}
          >
            {s.showcaseEnabled ? "Desativar vitrine" : "Salvar e ativar vitrine"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShowcaseSettingsPage() {
  return (
    <RequireRole allow={["OWNER", "ADMIN"]}>
      <ShowcaseContent />
    </RequireRole>
  );
}
