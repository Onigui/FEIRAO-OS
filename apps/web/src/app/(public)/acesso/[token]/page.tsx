"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  apiMessage,
  completeAccessLink,
  fetchAccessLink,
  PASSWORD_HINT,
  passwordProblem,
} from "@/features/auth/access";
import { BrandMark } from "@/components/brand/logo";
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

/**
 * Etapa 6 — página aberta pelo link que a loja manda por WhatsApp.
 * Convite: cria a senha (ou confirma a conta que a pessoa já tem). Redefinição: senha nova.
 */
export default function AccessLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ["access-link", token],
    queryFn: () => fetchAccessLink(token),
    retry: false,
  });

  const complete = useMutation({
    mutationFn: () =>
      completeAccessLink(
        token,
        info.data?.mode === "CONFIRM_EXISTING"
          ? { currentPassword }
          : { password },
      ),
    onSuccess: (res) => {
      toast.success(
        info.data?.purpose === "INVITE"
          ? "Pronto! Agora é só entrar."
          : "Senha nova salva. Agora é só entrar.",
      );
      window.location.assign(`/login?email=${encodeURIComponent(res.email)}`);
    },
    onError: (e) =>
      setFormError(apiMessage(e, "Não foi possível concluir. Tente de novo.")),
  });

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!info.data) return;
    if (info.data.mode === "CONFIRM_EXISTING") {
      if (!currentPassword) {
        setFormError("Digite a senha que você já usa para entrar.");
        return;
      }
    } else {
      const problem = passwordProblem(password, info.data.email);
      if (problem) {
        setFormError(problem);
        return;
      }
      if (password !== confirm) {
        setFormError("As duas senhas não são iguais.");
        return;
      }
    }
    complete.mutate();
  }

  const data = info.data;
  const isInvite = data?.purpose === "INVITE";
  const confirmExisting = data?.mode === "CONFIRM_EXISTING";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <BrandMark size={36} className="h-9 w-9" />
          <p className="font-display text-3xl leading-none">Autopilot</p>
        </div>

        <Card className="bg-white/90 shadow-sm">
          {info.isLoading ? (
            <CardContent className="p-6 text-sm text-muted-foreground">
              Abrindo seu link…
            </CardContent>
          ) : info.isError || !data ? (
            <>
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  Este link não vale mais
                </CardTitle>
                <CardDescription>
                  Ele já foi usado, venceu ou foi trocado por um mais novo. Peça
                  um link novo para o dono ou gerente da loja.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <a href="/login">Ir para o login</a>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  {isInvite
                    ? `Bem-vindo à equipe da ${data.companyName}`
                    : "Criar senha nova"}
                </CardTitle>
                <CardDescription>
                  {confirmExisting
                    ? "Você já tem conta no Autopilot. Confirme com a senha que você já usa para liberar o acesso a esta loja."
                    : isInvite
                      ? "Crie sua senha. Depois é só entrar com seu e-mail e essa senha."
                      : `Escolha uma senha nova para entrar no painel da ${data.companyName}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onSubmit} noValidate>
                  <div className="space-y-1">
                    <Label>Seu e-mail de acesso</Label>
                    <p
                      className="rounded-md bg-muted px-3 py-2 text-sm"
                      data-testid="access-email"
                    >
                      {data.email}
                    </p>
                  </div>

                  {confirmExisting ? (
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Sua senha atual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        className="h-12 text-base"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Nova senha</Label>
                        <Input
                          id="new-password"
                          type="password"
                          autoComplete="new-password"
                          className="h-12 text-base"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {PASSWORD_HINT}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Repita a senha</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          className="h-12 text-base"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                        />
                      </div>
                    </>
                  )}

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
                    disabled={complete.isPending}
                  >
                    {complete.isPending
                      ? "Salvando…"
                      : confirmExisting
                        ? "Liberar acesso"
                        : "Salvar senha"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
