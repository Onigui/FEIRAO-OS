"use client";

import { useState } from "react";
import { fromLocalInput, toLocalInput } from "@/features/fairs/constants";
import type { FairInput, FairSummary } from "@/features/fairs/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Formulário curto do feirão: nome, início, fim, local, endereço e descrição. */
export function FairForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  initial?: FairSummary;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: FairInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startsAt, setStartsAt] = useState(initial ? toLocalInput(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial ? toLocalInput(initial.endsAt) : "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (name.trim().length < 3) return setError("Dê um nome ao feirão.");
        if (!startsAt || !endsAt) return setError("Informe o início e o fim.");
        if (endsAt <= startsAt) return setError("O fim precisa ser depois do início.");
        if (venue.trim().length < 2) return setError("Informe o local.");
        onSubmit({
          name: name.trim(),
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt),
          venue: venue.trim(),
          address: address.trim() || null,
          description: description.trim() || null,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="fair-name">Nome do feirão</Label>
        <Input
          id="fair-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Feirão de Novembro"
          maxLength={160}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fair-start">Início</Label>
          <Input
            id="fair-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fair-end">Fim</Label>
          <Input
            id="fair-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fair-venue">Local</Label>
        <Input
          id="fair-venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Pátio da AF Veículos"
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fair-address">Endereço (opcional)</Label>
        <Input
          id="fair-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fair-description">Descrição (opcional)</Label>
        <Textarea
          id="fair-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
