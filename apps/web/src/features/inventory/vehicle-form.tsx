"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FUELS,
  FUEL_LABEL,
  TRANSMISSIONS,
  TRANSMISSION_LABEL,
} from "@/features/inventory/constants";
import {
  centsToReaisInput,
  parseIntLoose,
  parseReaisToCents,
} from "@/features/inventory/format";
import type {
  Vehicle,
  VehicleFuel,
  VehicleInput,
  VehicleTransmission,
} from "@/features/inventory/types";

const maxYear = new Date().getFullYear() + 1;
const year = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Ano com 4 dígitos")
  .refine((v) => Number(v) >= 1950 && Number(v) <= maxYear, `Entre 1950 e ${maxYear}`);

const schema = z
  .object({
    make: z.string().trim().min(1, "Informe a marca").max(60),
    model: z.string().trim().min(1, "Informe o modelo").max(80),
    version: z.string().trim().max(120).optional(),
    yearManufacture: year,
    yearModel: year,
    price: z
      .string()
      .refine((v) => (parseReaisToCents(v) ?? 0) > 0, "Preço inválido"),
    mileage: z
      .string()
      .refine((v) => parseIntLoose(v) !== null, "Km inválido"),
    transmission: z.enum(["MANUAL", "AUTOMATIC", "CVT", "AUTOMATED"]),
    fuel: z.enum(["FLEX", "GASOLINE", "ETHANOL", "DIESEL", "HYBRID", "ELECTRIC"]),
    bodyType: z.string().trim().max(40).optional(),
    color: z.string().trim().max(40).optional(),
    description: z.string().trim().max(5000).optional(),
  })
  .refine(
    (v) =>
      Number(v.yearModel) === Number(v.yearManufacture) ||
      Number(v.yearModel) === Number(v.yearManufacture) + 1,
    { path: ["yearModel"], message: "Igual ou 1 a mais que o de fabricação" },
  );

type FormValues = z.infer<typeof schema>;

function toDefaults(vehicle?: Vehicle): FormValues {
  const thisYear = String(new Date().getFullYear());
  return {
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    version: vehicle?.version ?? "",
    yearManufacture: vehicle ? String(vehicle.yearManufacture) : thisYear,
    yearModel: vehicle ? String(vehicle.yearModel) : thisYear,
    price: vehicle ? centsToReaisInput(vehicle.priceCents) : "",
    mileage: vehicle ? String(vehicle.mileageKm) : "",
    transmission: vehicle?.transmission ?? "MANUAL",
    fuel: vehicle?.fuel ?? "FLEX",
    bodyType: vehicle?.bodyType ?? "",
    color: vehicle?.color ?? "",
    description: vehicle?.description ?? "",
  };
}

function toInput(values: FormValues): VehicleInput {
  const empty = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    make: values.make.trim(),
    model: values.model.trim(),
    version: empty(values.version),
    yearManufacture: Number(values.yearManufacture),
    yearModel: Number(values.yearModel),
    priceCents: parseReaisToCents(values.price) as number,
    mileageKm: parseIntLoose(values.mileage) as number,
    transmission: values.transmission,
    fuel: values.fuel,
    bodyType: empty(values.bodyType),
    color: empty(values.color),
    description: empty(values.description),
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

/** Formulário curto, pensado para o celular: obrigatórios primeiro. */
export function VehicleForm({
  vehicle,
  submitLabel,
  pending,
  onSubmit,
}: {
  vehicle?: Vehicle;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (input: VehicleInput) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(vehicle),
  });
  const errors = form.formState.errors;

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => onSubmit(toInput(values)))}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="make">Marca</Label>
          <Input id="make" autoComplete="off" placeholder="Volkswagen" {...form.register("make")} />
          <FieldError message={errors.make?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" autoComplete="off" placeholder="Gol" {...form.register("model")} />
          <FieldError message={errors.model?.message} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="version">Versão (opcional)</Label>
          <Input id="version" autoComplete="off" placeholder="1.0 MPI" {...form.register("version")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yearManufacture">Ano de fabricação</Label>
          <Input id="yearManufacture" inputMode="numeric" maxLength={4} {...form.register("yearManufacture")} />
          <FieldError message={errors.yearManufacture?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yearModel">Ano do modelo</Label>
          <Input id="yearModel" inputMode="numeric" maxLength={4} {...form.register("yearModel")} />
          <FieldError message={errors.yearModel?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Preço (R$)</Label>
          <Input id="price" inputMode="decimal" placeholder="59.900" {...form.register("price")} />
          <FieldError message={errors.price?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mileage">Quilometragem</Label>
          <Input id="mileage" inputMode="numeric" placeholder="45.000" {...form.register("mileage")} />
          <FieldError message={errors.mileage?.message} />
        </div>
        <div className="space-y-1.5">
          <Label>Câmbio</Label>
          <Select
            value={form.watch("transmission")}
            onValueChange={(v) => form.setValue("transmission", v as VehicleTransmission)}
          >
            <SelectTrigger aria-label="Câmbio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSMISSIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRANSMISSION_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Combustível</Label>
          <Select
            value={form.watch("fuel")}
            onValueChange={(v) => form.setValue("fuel", v as VehicleFuel)}
          >
            <SelectTrigger aria-label="Combustível">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUELS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FUEL_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bodyType">Carroceria (opcional)</Label>
          <Input id="bodyType" placeholder="Hatch, Sedã, SUV…" {...form.register("bodyType")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">Cor (opcional)</Label>
          <Input id="color" placeholder="Prata" {...form.register("color")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Único dono, revisões em dia…"
            {...form.register("description")}
          />
        </div>
      </div>
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
