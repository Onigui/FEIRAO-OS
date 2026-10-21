"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert } from "lucide-react";
import {
  commitImport,
  downloadImportTemplate,
  previewImport,
} from "@/features/inventory/api";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/features/inventory/constants";
import {
  formatKm,
  formatPriceCents,
  formatYears,
} from "@/features/inventory/format";
import type { ImportPreview } from "@/features/inventory/types";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { RequireRole } from "@/components/auth/require-role";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportContent() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const template = useMutation({
    mutationFn: downloadImportTemplate,
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (error) => toast.error(friendlyError(error)),
  });

  const read = useMutation({
    mutationFn: previewImport,
    onSuccess: (data) => {
      setPreview(data);
      setImported(null);
    },
    onError: (error) => {
      setPreview(null);
      toast.error(friendlyError(error, "Não foi possível ler a planilha."));
    },
  });

  const commit = useMutation({
    mutationFn: () => commitImport((preview?.valid ?? []).map((v) => v.vehicle)),
    onSuccess: async (res) => {
      setImported(res.imported);
      setPreview(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`${res.imported} carros importados`);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível importar.")),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Importar planilha"
        description="Traga o estoque de uma vez. As fotos você adiciona depois, carro por carro."
        breadcrumbs={breadcrumbsForPath("/inventory/import")}
      />

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">1. Baixe o modelo</CardTitle>
          <CardDescription>
            Colunas: marca, modelo, versão, ano de fabricação, ano do modelo, preço, km,
            câmbio, combustível, carroceria, cor e descrição. Até 500 carros por arquivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={template.isPending} onClick={() => template.mutate("xlsx")}>
            <Download className="mr-2 h-4 w-4" /> Modelo Excel
          </Button>
          <Button variant="outline" disabled={template.isPending} onClick={() => template.mutate("csv")}>
            <Download className="mr-2 h-4 w-4" /> Modelo CSV
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2. Envie o arquivo</CardTitle>
          <CardDescription>
            Nada é gravado agora: primeiro mostramos o que está certo e o que precisa corrigir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-testid="import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              read.mutate(file);
            }}
          />
          <Button disabled={read.isPending} onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {read.isPending ? "Lendo…" : "Escolher arquivo"}
          </Button>
          {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
        </CardContent>
      </Card>

      {imported !== null ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="flex items-center gap-2 font-medium text-emerald-900" data-testid="import-done">
              <CheckCircle2 className="h-5 w-5" /> {imported} carros importados.
            </p>
            <Button asChild variant="outline">
              <Link href="/inventory">Ver estoque</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {preview ? (
        <Card className="bg-white/90">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">3. Confira e confirme</CardTitle>
            <CardDescription data-testid="import-summary">
              {preview.valid.length} de {preview.totalRows} linhas prontas para importar
              {preview.errors.length ? ` · ${preview.errors.length} com erro` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {preview.errors.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                  <TriangleAlert className="h-4 w-4" /> Linhas que não serão importadas
                </p>
                <ul className="space-y-1 text-sm text-amber-900" data-testid="import-errors">
                  {preview.errors.map((e) => (
                    <li key={e.line}>
                      Linha {e.line}: {e.messages.join("; ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-900/80">
                  Corrija na planilha e envie de novo, ou importe só as linhas certas agora.
                </p>
              </div>
            ) : null}

            {preview.valid.length ? (
              <div className="max-h-96 overflow-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Linha</th>
                      <th className="px-3 py-2 font-medium">Carro</th>
                      <th className="px-3 py-2 font-medium">Ano</th>
                      <th className="px-3 py-2 font-medium">Preço</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">Km</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">Câmbio / combustível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.map(({ line, vehicle: v }) => (
                      <tr key={line} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">{line}</td>
                        <td className="px-3 py-2">
                          {v.make} {v.model} {v.version ?? ""}
                        </td>
                        <td className="px-3 py-2">{formatYears(v.yearManufacture, v.yearModel)}</td>
                        <td className="px-3 py-2">{formatPriceCents(v.priceCents)}</td>
                        <td className="hidden px-3 py-2 sm:table-cell">{formatKm(v.mileageKm)}</td>
                        <td className="hidden px-3 py-2 md:table-cell">
                          {TRANSMISSION_LABEL[v.transmission]} · {FUEL_LABEL[v.fuel]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!preview.valid.length || commit.isPending}
                onClick={() => commit.mutate()}
              >
                {commit.isPending
                  ? "Importando…"
                  : `Importar ${preview.valid.length} carros`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setFileName(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function InventoryImportPage() {
  return (
    <RequireRole allow={["OWNER", "ADMIN"]}>
      <ImportContent />
    </RequireRole>
  );
}
