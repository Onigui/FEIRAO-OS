-- Etapa 6 — acesso da equipe: links de uso único (convite / redefinir senha).
-- Só o hash SHA-256 do token é guardado. Sem RLS: tabela de autenticação, como sessions.

-- CreateTable
CREATE TABLE "access_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "purpose" VARCHAR(16) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_links_token_hash_key" ON "access_links"("token_hash");

-- CreateIndex
CREATE INDEX "access_links_user_id_idx" ON "access_links"("user_id");

-- CreateIndex
CREATE INDEX "access_links_membership_id_idx" ON "access_links"("membership_id");

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
