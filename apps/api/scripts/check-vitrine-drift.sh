#!/usr/bin/env bash
# Vitrine e Feirões — compara o banco migrado com o schema.prisma.
# Falha se o Prisma ainda quiser mudar algum objeto da Vitrine/Feirões
# (sinal de que a migration escrita à mão não bate com o schema).
# Diferenças em objetos antigos do AutoPilot só são listadas, sem falhar.
set -uo pipefail

out=$(npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1)
status=$?
echo "$out"
if [ $status -ne 0 ]; then
  echo "::error title=Prisma drift::prisma migrate diff falhou (exit $status)"
  exit 1
fi

pattern='vehicles|vehicle_photos|vehicle_status_transitions|"fairs"|fair_participants|fair_vehicles|lead_vehicle_interests|showcase_analytics_events|"Vehicle|"Fair|ShowcaseAnalyticsType|showcase_enabled|showcase_terms|public_whatsapp|public_address|"city"'
hits=$(echo "$out" | grep -v '^--' | grep -E "$pattern" || true)
if [ -n "$hits" ]; then
  n=0
  while IFS= read -r line; do
    n=$((n + 1))
    [ $n -le 10 ] && echo "::error title=Vitrine drift::$line"
  done <<< "$hits"
  exit 1
fi
other=$(echo "$out" | grep -v '^--' | grep -v '^\s*$' | wc -l)
echo "::notice title=Vitrine drift::nenhuma diferença nas tabelas da Vitrine/Feirões (outras linhas de diff: $other)"
