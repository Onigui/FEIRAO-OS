import {
  FairParticipantStatus,
  FairStatus,
  MembershipRole,
  VehicleFuel,
  VehicleStatus,
  VehicleTransmission,
} from '@prisma/client';
import { prisma } from './shared/client';
import {
  upsertCompany,
  upsertMembership,
  upsertUser,
} from './shared/factories';

/**
 * Perfil "vitrine": dados de demonstração da Vitrine e Feirões.
 * Lojas FICTÍCIAS de Botucatu (nomes inventados), estoque realista sem fotos
 * (as fotos entram pelo celular na demonstração) e um feirão publicado.
 * Idempotente: pode rodar de novo; carros e feirão são achados pelo slug.
 */

const CITY = 'Botucatu';
const DOMAIN = 'vitrine.demo.autopilot.dev';

export const VITRINE_DEMO = {
  stores: [
    { slug: 'serra-veiculos-demo', name: 'Serra Veículos (demo)', address: 'Av. Exemplo, 1000', whatsapp: '14900000001' },
    { slug: 'cuesta-motors-demo', name: 'Cuesta Motors (demo)', address: 'Rua Exemplo, 200', whatsapp: '14900000002' },
    { slug: 'rio-bonito-autos-demo', name: 'Rio Bonito Autos (demo)', address: 'Av. Modelo, 350', whatsapp: '14900000003' },
    { slug: 'praca-car-demo', name: 'Praça Car (demo)', address: 'Rua Modelo, 45', whatsapp: '14900000004' },
  ],
  /** Gerente nas 4 lojas: troca de loja no seletor (como o dono do projeto fará). */
  adminEmail: `admin@${DOMAIN}`,
  carsPerStore: 30,
  fair: {
    slug: 'feirao-de-novembro-demo',
    name: 'Feirão de Novembro (demo)',
    venue: 'Pátio da Serra Veículos',
    address: 'Av. Exemplo, 1000 — Botucatu',
    /** Sábado, 8h às 18h (horário de Brasília). */
    startsAt: new Date('2026-11-28T11:00:00Z'),
    endsAt: new Date('2026-11-28T21:00:00Z'),
    carsPerStore: 20,
  },
} as const;

type Model = {
  make: string;
  model: string;
  versions: string[];
  basePrice: number; // reais, ano 2020
  transmission: VehicleTransmission;
  fuel: VehicleFuel;
  bodyType: string;
};

const CATALOG: Model[] = [
  { make: 'Chevrolet', model: 'Onix', versions: ['1.0 LT', '1.0 Turbo LTZ', '1.0 Premier'], basePrice: 62000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Chevrolet', model: 'Tracker', versions: ['1.0 Turbo LT', '1.2 Turbo Premier'], basePrice: 98000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Volkswagen', model: 'Gol', versions: ['1.0 MPI', '1.6 MSI'], basePrice: 48000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Volkswagen', model: 'Polo', versions: ['1.0 MPI', '1.0 TSI Comfortline', '1.0 TSI Highline'], basePrice: 72000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Volkswagen', model: 'T-Cross', versions: ['1.0 TSI Sense', '1.4 TSI Highline'], basePrice: 105000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Fiat', model: 'Argo', versions: ['1.0 Drive', '1.3 Drive', '1.8 HGT'], basePrice: 58000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Fiat', model: 'Mobi', versions: ['1.0 Like', '1.0 Trekking'], basePrice: 42000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Fiat', model: 'Strada', versions: ['1.3 Freedom CD', '1.4 Endurance CS'], basePrice: 82000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Picape' },
  { make: 'Fiat', model: 'Toro', versions: ['1.8 Freedom', '2.0 Diesel Volcano 4x4'], basePrice: 118000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'Picape' },
  { make: 'Hyundai', model: 'HB20', versions: ['1.0 Sense', '1.0 Comfort Plus', '1.6 Diamond'], basePrice: 60000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Hyundai', model: 'Creta', versions: ['1.6 Action', '2.0 Prestige'], basePrice: 98000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Toyota', model: 'Corolla', versions: ['2.0 GLi', '2.0 XEi', '1.8 Hybrid Altis'], basePrice: 115000, transmission: 'CVT', fuel: 'FLEX', bodyType: 'Sedã' },
  { make: 'Toyota', model: 'Hilux', versions: ['2.8 SR 4x4', '2.8 SRV 4x4'], basePrice: 210000, transmission: 'AUTOMATIC', fuel: 'DIESEL', bodyType: 'Picape' },
  { make: 'Honda', model: 'Civic', versions: ['2.0 EX', '2.0 EXL', '1.5 Touring'], basePrice: 112000, transmission: 'CVT', fuel: 'FLEX', bodyType: 'Sedã' },
  { make: 'Honda', model: 'HR-V', versions: ['1.8 LX', '1.8 EXL'], basePrice: 102000, transmission: 'CVT', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Renault', model: 'Kwid', versions: ['1.0 Zen', '1.0 Intense'], basePrice: 43000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Renault', model: 'Duster', versions: ['1.6 Zen', '1.3 Turbo Iconic'], basePrice: 85000, transmission: 'CVT', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Jeep', model: 'Renegade', versions: ['1.8 Sport', '1.3 Turbo Longitude'], basePrice: 95000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Jeep', model: 'Compass', versions: ['2.0 Sport', '1.3 Turbo Limited'], basePrice: 135000, transmission: 'AUTOMATIC', fuel: 'FLEX', bodyType: 'SUV' },
  { make: 'Ford', model: 'Ka', versions: ['1.0 SE', '1.5 SE Plus'], basePrice: 46000, transmission: 'MANUAL', fuel: 'FLEX', bodyType: 'Hatch' },
  { make: 'Nissan', model: 'Kicks', versions: ['1.6 S', '1.6 SV', '1.6 SL'], basePrice: 88000, transmission: 'CVT', fuel: 'FLEX', bodyType: 'SUV' },
];

const COLORS = ['Prata', 'Branco', 'Preto', 'Cinza', 'Vermelho', 'Azul'];

/** Gerador determinístico (mesmo resultado a cada execução). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function buildDemoCars(storeIndex: number, count: number) {
  const rand = rng(1000 + storeIndex * 97);
  return Array.from({ length: count }, (_, i) => {
    const m = CATALOG[Math.floor(rand() * CATALOG.length)];
    const version = m.versions[Math.floor(rand() * m.versions.length)];
    const yearModel = 2016 + Math.floor(rand() * 9); // 2016–2024
    const yearManufacture = rand() < 0.6 ? yearModel : yearModel - 1;
    const age = 2026 - yearModel;
    const mileageKm = Math.round((age * 12000 + rand() * 15000) / 100) * 100 + 3000;
    // Deprecia ~8% ao ano a partir de 2020, arredonda para R$ 500.
    const price = m.basePrice * Math.pow(0.92, yearModel >= 2020 ? -(yearModel - 2020) * 0.5 : 2020 - yearModel);
    const priceCents = Math.round(price / 500) * 500 * 100;
    return {
      key: `${storeIndex}-${i}`,
      make: m.make,
      model: m.model,
      version,
      yearManufacture,
      yearModel,
      priceCents,
      mileageKm,
      transmission: m.transmission,
      fuel: m.fuel,
      bodyType: m.bodyType,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      // ~10% reservados para a vitrine parecer real.
      status: rand() < 0.1 ? VehicleStatus.RESERVED : VehicleStatus.AVAILABLE,
    };
  });
}

function slugPart(v: string) {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type VitrineSeedCounts = {
  companies: number;
  users: number;
  vehicles: number;
  fairVehicles: number;
};

export async function seedVitrine(): Promise<VitrineSeedCounts> {
  const admin = await upsertUser(prisma, { email: VITRINE_DEMO.adminEmail, name: 'Gerente Demo' });
  const companyIds: string[] = [];

  for (const [index, store] of VITRINE_DEMO.stores.entries()) {
    const company = await upsertCompany(prisma, { slug: store.slug, name: store.name, profile: 'vitrine' });
    companyIds.push(company.id);
    await prisma.company.update({
      where: { id: company.id },
      data: {
        city: CITY,
        publicAddress: store.address,
        publicWhatsapp: store.whatsapp,
        showcaseEnabled: true,
        showcaseTermsAcceptedAt: company.showcaseTermsAcceptedAt ?? new Date(),
      },
    });

    const owner = await upsertUser(prisma, {
      email: `dono.${store.slug}@${DOMAIN}`,
      name: `Dono ${store.name}`,
    });
    await upsertMembership(prisma, { companyId: company.id, userId: owner.id, role: MembershipRole.OWNER, invitedBy: owner.id });
    await upsertMembership(prisma, { companyId: company.id, userId: admin.id, role: MembershipRole.ADMIN, invitedBy: owner.id });

    for (const car of buildDemoCars(index, VITRINE_DEMO.carsPerStore)) {
      const slug = `${slugPart(car.make)}-${slugPart(car.model)}-${car.yearModel}-demo${car.key}`;
      const code = `D${String(index)}${car.key.split('-')[1].padStart(2, '0')}${store.slug.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')}`.slice(0, 8);
      const data = { ...car } as Partial<typeof car>;
      delete data.key;
      await prisma.vehicle.upsert({
        where: { slug },
        create: { ...(data as Omit<typeof car, 'key'>), slug, showcaseCode: code, companyId: company.id },
        update: { ...(data as Omit<typeof car, 'key'>), deletedAt: null },
      });
    }
  }

  // Feirão publicado, organizado pela primeira loja, com as quatro confirmadas.
  const organizerId = companyIds[0];
  const f = VITRINE_DEMO.fair;
  const fair = await prisma.fair.upsert({
    where: { slug: f.slug },
    create: {
      slug: f.slug,
      name: f.name,
      companyId: organizerId,
      venue: f.venue,
      address: f.address,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      status: FairStatus.PUBLISHED,
      description: 'Feirão de demonstração com as lojas fictícias da vitrine.',
    },
    update: { name: f.name, venue: f.venue, address: f.address, startsAt: f.startsAt, endsAt: f.endsAt, deletedAt: null },
  });

  for (const [index, companyId] of companyIds.entries()) {
    await prisma.fairParticipant.upsert({
      where: { fairId_companyId: { fairId: fair.id, companyId } },
      create: {
        fairId: fair.id,
        companyId,
        organizerCompanyId: organizerId,
        status: FairParticipantStatus.ACCEPTED,
        respondedAt: new Date(),
      },
      update: {},
    });
    const cars = await prisma.vehicle.findMany({
      where: { companyId, deletedAt: null, status: { in: [VehicleStatus.AVAILABLE, VehicleStatus.RESERVED] } },
      orderBy: { slug: 'asc' },
      take: f.carsPerStore,
      select: { id: true, priceCents: true },
    });
    for (const [i, car] of cars.entries()) {
      // Código determinístico para a demo (o painel gera aleatório).
      const qrCode = `Q${index}${String(i).padStart(2, '0')}DEMO`.slice(0, 8);
      await prisma.fairVehicle.upsert({
        where: { fairId_vehicleId: { fairId: fair.id, vehicleId: car.id } },
        create: {
          fairId: fair.id,
          vehicleId: car.id,
          companyId,
          organizerCompanyId: organizerId,
          // 5% de desconto no feirão, arredondado para R$ 500.
          priceCentsAtFair: Math.round((car.priceCents * 0.95) / 50000) * 50000,
          qrCode,
        },
        update: {},
      });
    }
  }

  const [vehicles, fairVehicles] = await Promise.all([
    prisma.vehicle.count({ where: { companyId: { in: companyIds } } }),
    prisma.fairVehicle.count({ where: { fairId: fair.id } }),
  ]);
  return {
    companies: companyIds.length,
    users: VITRINE_DEMO.stores.length + 1,
    vehicles,
    fairVehicles,
  };
}
