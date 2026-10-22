"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  apiMessage,
  changePassword,
  PASSWORD_HINT,
  passwordProblem,
} from "@/features/auth/access";
import { useAuth } from "@/providers/auth-provider";
import { breadcrumbsForPath, ROLE_LABEL } from "@/lib/nav";
import { PageHeader } from "@/components/layout/page-header";
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

/** Etapa 6 — qualquer pessoa da equipe troca a própria senha. */
export default function AccountPage() {
  const { user, company, membership } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: (res) => {
      toast.success(
        res.otherSessionsRevoked > 0
          ? `Senha trocada. Saímos da sua conta em ${res.otherSessionsRevoked} outro(s) aparelho(s).`
          : "Senha trocada.",
      );
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e) =>
      setFormError(apiMessage(e, "Não foi possível trocar a senha.")),
  });

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!current) {
      setFormError("Digite sua senha atual.");
      return;
    }
    const problem = passwordProblem(next, user?.email);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (next === current) {
      setFormError("A nova senha precisa ser diferente da atual.");
      return;
    }
    if (next !== confirm) {
      setFormError("As duas senhas novas não são iguais.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minha conta"
        description="Seus dados de acesso ao painel."
        breadcrumbs={breadcrumbsForPath("/conta")}
      />

      <Card className="bg-white/90">
        <CardContent className="space-y-1 p-4 text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-muted-foreground">{user?.email}</p>
          <p className="text-muted-foreground">
            {company?.name}
            {membership?.role
              ? ` · ${ROLE_LABEL[membership.role] ?? membership.role}`
              : ""}
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-lg bg-white/90">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>
            Ao trocar, você continua conectado aqui e sai dos outros aparelhos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="h-12 text-base"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="h-12 text-base"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Repita a nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="h-12 text-base"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {formError ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="form-error"
              >
                {formError}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-12 w-full text-base"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Salvando…" : "Trocar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
