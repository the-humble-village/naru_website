/**
 * Generates realistic development data for every table except `users`.
 *
 * Covers all 23 non-user tables: the lookup tables, question banks and question sets,
 * birthing assistants and their junctions, files (with real image bytes written to the
 * local storage dir so photos actually render), and the family → parent/child → visit tree.
 *
 * Usage — from packages/backend:
 *   npx tsx scripts/seed-dev-data.ts                 # add data to the DB in .env
 *   npx tsx scripts/seed-dev-data.ts --reset         # wipe seeded tables first (never users)
 *   npx tsx scripts/seed-dev-data.ts --families=40   # scale it up
 *   npx tsx scripts/seed-dev-data.ts --seed=7        # different pseudo-random draw
 *   npx tsx scripts/seed-dev-data.ts --help
 *
 * Deterministic: the same --seed and --families produce the same data, so a screenshot or
 * bug report is reproducible. Two things still vary per run — row IDs / localIds, and dates,
 * which are generated as offsets from "now" so the data never goes stale.
 */

import { PrismaClient, Prisma, Sex } from '@prisma/client'
import { randomUUID, createHash } from 'crypto'
import { deflateSync } from 'zlib'
import { promises as fs } from 'fs'
import path from 'path'
import { config as loadDotenv } from 'dotenv'

loadDotenv()

// ── CLI ─────────────────────────────────────────────────────────────────────

interface Options {
  reset: boolean
  families: number
  seed: number
  databaseUrl: string
  allowRemote: boolean
  skipImages: boolean
}

const HELP = `
Seed development data for every table except "users".

  --families=N       number of families to generate (default 12)
  --seed=N           PRNG seed; same seed => same data (default 42)
  --reset            delete existing rows in seeded tables first (never touches users;
                     leaves previously written image files on disk as orphans)
  --database-url=URL override the DATABASE_URL from .env
  --allow-remote     permit a non-localhost database host (refused by default)
  --skip-images      create File rows but don't write image bytes to disk
  --help
`.trim()

function parseArgs(argv: string[]): Options {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP)
    process.exit(0)
  }

  const value = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit?.slice(name.length + 3)
  }

  const int = (name: string, fallback: number): number => {
    const raw = value(name)
    if (raw === undefined) return fallback
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`--${name} must be a non-negative integer (got "${raw}")`)
    }
    return n
  }

  const databaseUrl = value('database-url') || process.env.DATABASE_URL || ''
  if (!databaseUrl) {
    throw new Error('No database URL. Set DATABASE_URL in packages/backend/.env or pass --database-url=...')
  }

  return {
    reset: argv.includes('--reset'),
    families: int('families', 12),
    seed: int('seed', 42),
    databaseUrl,
    allowRemote: argv.includes('--allow-remote'),
    skipImages: argv.includes('--skip-images'),
  }
}

/**
 * This script writes and (with --reset) deletes data, so make it hard to point at
 * anything but a local development database by accident.
 */
function assertSafeTarget(opts: Options): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed with NODE_ENV=production.')
  }

  let url: URL
  try {
    url = new URL(opts.databaseUrl)
  } catch {
    throw new Error(`Database URL is not a valid URL: "${opts.databaseUrl}"`)
  }

  const local = ['localhost', '127.0.0.1', '::1', '[::1]']
  if (!local.includes(url.hostname) && !opts.allowRemote) {
    throw new Error(
      `Refusing to seed remote host "${url.hostname}".\n` +
      `This script generates fake data. Pass --allow-remote only if you are certain.`
    )
  }

  return decodeURIComponent(url.pathname.replace(/^\//, ''))
}

// ── Deterministic PRNG ──────────────────────────────────────────────────────

/** mulberry32 — small, fast, and seedable, so runs are reproducible. */
function makeRng(seed: number) {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    /** Float in [min, max), rounded to `decimals`. */
    float: (min: number, max: number, decimals = 1): number => {
      const raw = min + next() * (max - min)
      const f = 10 ** decimals
      return Math.round(raw * f) / f
    },
    bool: (trueChance = 0.5): boolean => next() < trueChance,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    /** `count` distinct members of `items` (or all of them, if fewer). */
    sample: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items]
      const out: T[] = []
      for (let i = 0; i < count && pool.length; i++) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0])
      }
      return out
    },
  }
}

type Rng = ReturnType<typeof makeRng>

// ── Reference data ──────────────────────────────────────────────────────────
// Spanish-language content: the deployment is Latin American and the app ships es/en.

const COMMUNITY_NAMES = [
  'San Juan Atitán', 'Santa María Chiquimula', 'Chichicastenango', 'Nebaj',
  'Todos Santos Cuchumatán', 'San Pedro Necta', 'Aguacatán', 'Sacapulas',
] as const

const SITE_NAMES = [
  'Clínica Central Huehuetenango', 'Puesto de Salud Nebaj', 'Centro Comunitario Sacapulas',
  'Clínica Móvil Ixil', 'Puesto de Salud Aguacatán',
] as const

const RESOURCE_TITLES = [
  'Incaparina (bolsa 1kg)', 'Vitaminas prenatales', 'Filtro de agua', 'Jabón antibacterial',
  'Mosquitero tratado', 'Suero oral', 'Semillas de hortaliza', 'Estufa mejorada',
  'Kit de higiene menstrual', 'Zinc pediátrico',
] as const

const TRAINING_TITLES = [
  'Lactancia materna exclusiva', 'Preparación de Incaparina', 'Higiene y lavado de manos',
  'Señales de peligro en el embarazo', 'Parto limpio y seguro', 'Planificación familiar',
  'Alimentación complementaria', 'Primeros auxilios básicos',
] as const

const CHILD_QUESTIONS = [
  '¿El niño ha tenido diarrea en los últimos 15 días?',
  '¿El niño ha tenido tos o dificultad para respirar?',
  '¿El niño ha recibido sus vacunas al día?',
  '¿El niño come al menos tres veces al día?',
  '¿El niño ha tenido fiebre esta semana?',
  '¿El niño asiste a la escuela o guardería?',
] as const

const PARENT_QUESTIONS = [
  '¿Asiste a sus controles prenatales?',
  '¿Toma sus vitaminas prenatales a diario?',
  '¿Cuenta con apoyo familiar en el hogar?',
  '¿Ha tenido sangrado o dolor fuerte?',
  '¿Tiene un plan de parto definido?',
  '¿Ha recibido orientación sobre lactancia?',
] as const

const FAMILY_QUESTIONS = [
  '¿La familia tiene acceso a agua potable?',
  '¿La vivienda cuenta con letrina o sanitario?',
  '¿Cocinan con estufa mejorada o fogón abierto?',
  '¿Algún miembro de la familia migró este año?',
  '¿La familia cultiva alimentos para consumo propio?',
  '¿Hay animales dentro de la vivienda?',
] as const

const SURNAMES = [
  'Pérez', 'Mendoza', 'García', 'López', 'Ramírez', 'Hernández', 'Morales', 'Ixcoy',
  'Chávez', 'Tzul', 'Bautista', 'Velásquez', 'Cocón', 'Ajanel', 'Sales', 'Quiñónez',
] as const

const FEMALE_NAMES = [
  'María', 'Ana', 'Rosa', 'Juana', 'Petrona', 'Lucía', 'Catarina', 'Isabel',
  'Manuela', 'Dominga', 'Elena', 'Silvia', 'Marta', 'Angelina',
] as const

const MALE_NAMES = [
  'José', 'Juan', 'Pedro', 'Diego', 'Miguel', 'Francisco', 'Andrés', 'Mateo',
  'Sebastián', 'Tomás', 'Baltazar', 'Nicolás', 'Gaspar', 'Elias',
] as const

const PARENT_ROLES = ['mother', 'father', 'caregiver', 'grandmother'] as const

const NUTRITIONAL_STATES = [
  'Normal', 'Desnutrición aguda moderada', 'Desnutrición aguda severa',
  'Riesgo de desnutrición', 'En recuperación',
] as const

const YES_NO = ['sí', 'no'] as const

const FAMILY_NOTES = [
  'Familia colaboradora, asiste puntualmente a las visitas.',
  'Viven a dos horas caminando del puesto de salud.',
  'El padre trabaja en la costa durante la temporada de cosecha.',
  'La abuela cuida a los niños durante el día.',
  'Casa de adobe con piso de tierra; sin agua entubada.',
  'Se les entregó filtro de agua el mes pasado.',
] as const

const VISIT_NOTES = [
  'Se revisó el peso y se entregó Incaparina.',
  'Se explicó la preparación correcta del suero oral.',
  'La madre reporta mejoría en el apetito del niño.',
  'Se recomendó traslado al centro de salud para evaluación.',
  'Sin novedades; continuar con el plan actual.',
  'Se reforzó la importancia del lavado de manos.',
  'No se encontró a la familia en casa; se reprogramó.',
] as const

// ── Placeholder image generation ────────────────────────────────────────────
// Real PNG bytes, so seeded photos render in the UI instead of 404-ing. Written by
// hand rather than pulling in an image library for a dev-only script.

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

/** A 320x240 truecolour PNG: a vertical gradient in `hue` with a lighter diagonal band. */
function placeholderPng(hue: [number, number, number]): Buffer {
  const width = 320
  const height = 240
  const raw = Buffer.alloc(height * (1 + width * 3))

  let o = 0
  for (let y = 0; y < height; y++) {
    raw[o++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const shade = 0.55 + 0.45 * (y / height)
      const band = Math.abs((x + y) % 96) < 12 ? 1.25 : 1
      raw[o++] = Math.min(255, Math.round(hue[0] * shade * band))
      raw[o++] = Math.min(255, Math.round(hue[1] * shade * band))
      raw[o++] = Math.min(255, Math.round(hue[2] * shade * band))
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // bytes 10-12 (compression, filter, interlace) stay 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/** `days` before `from`, at a plausible mid-morning visit hour. */
function daysBefore(from: Date, days: number, rng: Rng): Date {
  const d = new Date(from.getTime() - days * DAY_MS)
  d.setUTCHours(rng.int(8, 16), rng.pick([0, 15, 30, 45]), 0, 0)
  return d
}

function fullName(rng: Rng, sex: 'f' | 'm'): string {
  const first = rng.pick(sex === 'f' ? FEMALE_NAMES : MALE_NAMES)
  return `${first} ${rng.pick(SURNAMES)}`
}

/** Rough WHO-ish median weight in kg, so z-scores and charts land in a sane range. */
function plausibleWeightKg(ageDays: number, sex: Sex, rng: Rng): number {
  const years = ageDays / 365.25
  const median = years < 1 ? 3.3 + years * 6.2 : 9.5 + (years - 1) * 2.3
  const adjusted = median * (sex === Sex.MALE ? 1.02 : 0.98)
  // ±18% spread puts a realistic minority into the malnourished z-score bands
  return Math.max(2.2, Math.round(adjusted * rng.float(0.82, 1.18, 3) * 10) / 10)
}

/** Rough height in mm for an age, tracking the same growth curve. */
function plausibleHeightMm(ageDays: number, rng: Rng): number {
  const years = ageDays / 365.25
  const cm = years < 1 ? 50 + years * 25 : 75 + (years - 1) * 7.5
  return Math.round(cm * rng.float(0.94, 1.06, 3) * 10)
}

function questionAnswers<T extends { id: number; title: string }>(
  bank: readonly T[],
  rng: Rng
): Prisma.JsonArray {
  return rng.sample(bank, rng.int(2, Math.min(4, bank.length))).map((q) => ({
    questionId: q.id,
    question: q.title,
    answer: rng.pick(YES_NO),
  }))
}

// ── Reset ───────────────────────────────────────────────────────────────────

/**
 * Deletes every seeded table, children before parents. `users` is deliberately absent —
 * this script never touches accounts.
 */
async function resetSeededTables(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.childVisitQuestionSetItem.deleteMany(),
    prisma.parentVisitQuestionSetItem.deleteMany(),
    prisma.familyVisitQuestionSetItem.deleteMany(),
    prisma.childVisitQuestionSet.deleteMany(),
    prisma.parentVisitQuestionSet.deleteMany(),
    prisma.familyVisitQuestionSet.deleteMany(),
    prisma.childVisitQuestion.deleteMany(),
    prisma.parentVisitQuestion.deleteMany(),
    prisma.familyVisitQuestion.deleteMany(),
    prisma.birthingAssistantCommunity.deleteMany(),
    prisma.birthingAssistantTraining.deleteMany(),
    prisma.childVisit.deleteMany(),
    prisma.parentVisit.deleteMany(),
    prisma.familyVisit.deleteMany(),
    prisma.child.deleteMany(),
    prisma.parent.deleteMany(),
    prisma.family.deleteMany(),
    prisma.birthingAssistant.deleteMany(),
    prisma.community.deleteMany(),
    prisma.site.deleteMany(),
    prisma.resource.deleteMany(),
    prisma.training.deleteMany(),
    prisma.file.deleteMany(),
  ])
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed(prisma: PrismaClient, opts: Options) {
  const rng = makeRng(opts.seed)
  const now = new Date()
  const counts: Record<string, number> = {}
  const track = (table: string, n: number) => {
    counts[table] = (counts[table] ?? 0) + n
  }

  // ── Lookup tables ─────────────────────────────────────────────────────────

  const communities = await Promise.all(
    COMMUNITY_NAMES.map((title) => prisma.community.create({ data: { title } }))
  )
  track('communities', communities.length)

  // Guatemalan highlands, roughly — enough for the map to look right.
  const sites = await Promise.all(
    SITE_NAMES.map((title, i) => {
      const lat = rng.float(15.0, 15.6, 5)
      const lng = rng.float(-91.7, -91.0, 5)
      const r = rng.float(0.02, 0.06, 4)
      return prisma.site.create({
        data: {
          title,
          lat,
          lng,
          // Closed GeoJSON ring (first point repeated last)
          boundary: [
            [lng - r, lat - r],
            [lng + r, lat - r],
            [lng + r, lat + r],
            [lng - r, lat + r],
            [lng - r, lat - r],
          ] as Prisma.JsonArray,
          // One retired site, to exercise soft-delete filtering
          deletedAt: i === SITE_NAMES.length - 1 ? daysBefore(now, 45, rng) : null,
        },
      })
    })
  )
  track('sites', sites.length)
  const liveSites = sites.filter((s) => !s.deletedAt)

  const resources = await Promise.all(
    RESOURCE_TITLES.map((title) => prisma.resource.create({ data: { title } }))
  )
  track('resources', resources.length)

  const trainings = await Promise.all(
    TRAINING_TITLES.map((title) => prisma.training.create({ data: { title } }))
  )
  track('training', trainings.length)

  // ── Question banks ────────────────────────────────────────────────────────

  const childQuestions = await Promise.all(
    CHILD_QUESTIONS.map((title, i) =>
      prisma.childVisitQuestion.create({ data: { title, sortOrder: i * 10 } })
    )
  )
  track('child_visit_questions', childQuestions.length)

  const parentQuestions = await Promise.all(
    PARENT_QUESTIONS.map((title, i) =>
      prisma.parentVisitQuestion.create({ data: { title, sortOrder: i * 10 } })
    )
  )
  track('parent_visit_questions', parentQuestions.length)

  const familyQuestions = await Promise.all(
    FAMILY_QUESTIONS.map((title, i) =>
      prisma.familyVisitQuestion.create({ data: { title, sortOrder: i * 10 } })
    )
  )
  track('family_visit_questions', familyQuestions.length)

  // ── Question sets (+ their junction items) ────────────────────────────────

  const buildSets = async <Q extends { id: number }>(
    label: string,
    names: readonly string[],
    bank: readonly Q[],
    createSet: (name: string) => Promise<{ id: number }>,
    createItem: (setId: number, questionId: number, sortOrder: number) => Promise<unknown>
  ) => {
    for (const name of names) {
      const set = await createSet(name)
      const chosen = rng.sample(bank, rng.int(3, bank.length))
      await Promise.all(chosen.map((q, i) => createItem(set.id, q.id, i * 10)))
      track(`${label}_sets`, 1)
      track(`${label}_set_items`, chosen.length)
    }
  }

  await buildSets(
    'child_visit_question',
    ['Rutina mensual', 'Seguimiento nutricional'],
    childQuestions,
    (name) => prisma.childVisitQuestionSet.create({ data: { name } }),
    (setId, questionId, sortOrder) =>
      prisma.childVisitQuestionSetItem.create({ data: { setId, questionId, sortOrder } })
  )

  await buildSets(
    'parent_visit_question',
    ['Control prenatal', 'Posparto'],
    parentQuestions,
    (name) => prisma.parentVisitQuestionSet.create({ data: { name } }),
    (setId, questionId, sortOrder) =>
      prisma.parentVisitQuestionSetItem.create({ data: { setId, questionId, sortOrder } })
  )

  await buildSets(
    'family_visit_question',
    ['Evaluación del hogar', 'Visita de seguimiento'],
    familyQuestions,
    (name) => prisma.familyVisitQuestionSet.create({ data: { name } }),
    (setId, questionId, sortOrder) =>
      prisma.familyVisitQuestionSetItem.create({ data: { setId, questionId, sortOrder } })
  )

  // ── Files ─────────────────────────────────────────────────────────────────
  // Written to the same uploads/<key> layout the local storage driver reads from.

  const storageDir = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || 'uploads')
  const palette: Array<[number, number, number]> = [
    [86, 132, 96], [176, 137, 84], [104, 116, 148], [158, 96, 104],
    [120, 140, 108], [148, 124, 92], [96, 128, 136], [136, 112, 132],
  ]

  const files = await Promise.all(
    palette.map(async (hue, i) => {
      const bytes = placeholderPng(hue)
      const stamp = daysBefore(now, rng.int(1, 200), rng)
      const yyyy = stamp.getUTCFullYear()
      const mm = String(stamp.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(stamp.getUTCDate()).padStart(2, '0')
      const s3Key = `uploads/${yyyy}/${mm}/${dd}/${randomUUID()}.png`

      if (!opts.skipImages) {
        const target = path.join(storageDir, s3Key)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, bytes)
      }

      return prisma.file.create({
        data: {
          hash: createHash('sha256').update(bytes).digest('hex'),
          extension: 'png',
          s3Key,
          mimeType: 'image/png',
          size: bytes.length,
          confirmed: true, // only confirmed files get download URLs
          createdAt: stamp,
        },
      })
    })
  )
  track('files', files.length)
  const photoIds = files.map((f) => f.id)
  const somePhotos = (max: number) => rng.sample(photoIds, rng.int(0, max)) as Prisma.JsonArray

  // ── Birthing assistants (+ junctions) ─────────────────────────────────────

  const assistants = await Promise.all(
    Array.from({ length: 6 }, () =>
      prisma.birthingAssistant.create({
        data: { name: fullName(rng, 'f'), localId: randomUUID() },
      })
    )
  )
  track('birthing_assistants', assistants.length)

  for (const ba of assistants) {
    const served = rng.sample(communities, rng.int(1, 3))
    const received = rng.sample(trainings, rng.int(1, 4))

    await Promise.all([
      ...served.map((c) =>
        prisma.birthingAssistantCommunity.create({
          data: { birthingAssistantId: ba.id, communityId: c.id },
        })
      ),
      ...received.map((t) =>
        prisma.birthingAssistantTraining.create({
          data: { birthingAssistantId: ba.id, trainingId: t.id },
        })
      ),
    ])
    track('birthing_assistant_communities', served.length)
    track('birthing_assistant_trainings', received.length)
  }

  // ── Families and everything hanging off them ──────────────────────────────

  for (let f = 0; f < opts.families; f++) {
    const surname = rng.pick(SURNAMES)
    // A tenth of families are soft-deleted, so list endpoints have something to filter
    const familyDeleted = rng.bool(0.1) ? daysBefore(now, rng.int(5, 120), rng) : null

    const family = await prisma.family.create({
      data: {
        localId: randomUUID(),
        familyName: `Familia ${surname}`,
        childrenEditable: rng.int(0, 4),
        inCrisis: rng.bool(0.18),
        notes: rng.bool(0.7) ? rng.pick(FAMILY_NOTES) : null,
        photos: somePhotos(2),
        communityId: rng.pick(communities).id,
        siteId: rng.bool(0.85) ? rng.pick(liveSites).id : null,
        birthingAssistantId: rng.bool(0.6) ? rng.pick(assistants).id : null,
        createdAt: daysBefore(now, rng.int(30, 700), rng),
        deletedAt: familyDeleted,
      },
    })
    track('families', 1)

    // Parents ---------------------------------------------------------------
    const parentCount = rng.int(1, 2)
    for (let p = 0; p < parentCount; p++) {
      const role = p === 0 ? 'mother' : rng.pick(PARENT_ROLES)
      const isFemale = role !== 'father'
      const expecting = isFemale && rng.bool(0.25)

      const parent = await prisma.parent.create({
        data: {
          localId: randomUUID(),
          familyId: family.id,
          name: `${rng.pick(isFemale ? FEMALE_NAMES : MALE_NAMES)} ${surname}`,
          role,
          birthDate: daysBefore(now, rng.int(18, 55) * 365, rng),
          dateEntered: daysBefore(now, rng.int(30, 700), rng),
          photos: somePhotos(2),
          reasonEnroll: rng.bool(0.6)
            ? rng.pick([
                'Embarazo de alto riesgo.',
                'Hijo con desnutrición aguda.',
                'Referida por la comadrona de la comunidad.',
                'Solicitó apoyo nutricional para sus hijos.',
              ])
            : null,
          dueDate: expecting ? new Date(now.getTime() + rng.int(10, 240) * DAY_MS) : null,
          notes: rng.bool(0.4) ? rng.pick(FAMILY_NOTES) : null,
        },
      })
      track('parents', 1)

      // Parent visits
      const parentVisitCount = rng.int(0, 3)
      for (let v = 0; v < parentVisitCount; v++) {
        await prisma.parentVisit.create({
          data: {
            localId: randomUUID(),
            familyId: family.id,
            parentId: parent.id,
            visitDate: daysBefore(now, (v + 1) * rng.int(20, 45), rng),
            weight: rng.float(45, 85, 1),
            trainingsReceived: rng
              .sample(trainings, rng.int(0, 2))
              .map((t) => ({ id: t.id, title: t.title })) as Prisma.JsonArray,
            resourcesReceived: rng
              .sample(resources, rng.int(0, 3))
              .map((r) => ({ id: r.id, title: r.title })) as Prisma.JsonArray,
            questions: questionAnswers(parentQuestions, rng),
            photos: somePhotos(2),
            notes: rng.bool(0.5) ? rng.pick(VISIT_NOTES) : null,
          },
        })
        track('parent_visits', 1)
      }
    }

    // Children --------------------------------------------------------------
    const childCount = rng.int(1, 4)
    for (let c = 0; c < childCount; c++) {
      const sex = rng.bool() ? Sex.MALE : Sex.FEMALE
      const ageDays = rng.int(30, 5 * 365)
      const birthDate = daysBefore(now, ageDays, rng)
      const currentWeight = plausibleWeightKg(ageDays, sex, rng)
      const currentHeightMm = plausibleHeightMm(ageDays, rng)
      const currentMuacMm = rng.int(115, 165)

      const child = await prisma.child.create({
        data: {
          localId: randomUUID(),
          familyId: family.id,
          name: `${rng.pick(sex === Sex.MALE ? MALE_NAMES : FEMALE_NAMES)} ${surname}`,
          birthDate,
          sex,
          dateEntered: daysBefore(now, rng.int(10, Math.max(11, ageDays)), rng),
          photos: somePhotos(3),
          weight: currentWeight,
          nutritionalState: rng.bool(0.75) ? rng.pick(NUTRITIONAL_STATES) : null,
          reasonEnrollment: rng.bool(0.5)
            ? rng.pick([
                'Bajo peso para la edad.',
                'Hermano mayor ya inscrito en el programa.',
                'Detectado en jornada comunitaria.',
                'Referido por el puesto de salud.',
              ])
            : null,
          observations: rng.bool(0.5) ? rng.pick(VISIT_NOTES) : null,
        },
      })
      track('children', 1)

      // Child visits, oldest first. Measurements interpolate back from the child's current
      // values so a growth chart trends upward — a child must never appear to shrink.
      const visitCount = rng.int(1, 5)
      for (let v = visitCount; v >= 1; v--) {
        const daysAgo = v * rng.int(25, 40)
        const progress = 1 - v / (visitCount + 1)
        const grown = (current: number, startFraction: number, jitter: number): number =>
          current * (startFraction + (1 - startFraction) * progress) * rng.float(1 - jitter, 1 + jitter, 4)

        await prisma.childVisit.create({
          data: {
            localId: randomUUID(),
            familyId: family.id,
            childId: child.id,
            visitDate: daysBefore(now, daysAgo, rng),
            weight: Math.max(2.2, Math.round(grown(currentWeight, 0.78, 0.02) * 10) / 10),
            armCircumference: Math.round(grown(currentMuacMm, 0.88, 0.015)),
            height: Math.round(grown(currentHeightMm, 0.85, 0.008)),
            incap: rng.bool(0.35),
            leche: rng.bool(0.55),
            bagsGiven: rng.bool(0.4) ? String(rng.int(1, 4)) : null,
            recvAnyMedicine: rng.bool(0.3) ? rng.pick(YES_NO) : null,
            leftFromProg: rng.bool(0.05) ? 'sí' : null,
            passedAway: null,
            questions: questionAnswers(childQuestions, rng),
            photos: somePhotos(2),
            notes: rng.bool(0.6) ? rng.pick(VISIT_NOTES) : null,
          },
        })
        track('child_visits', 1)
      }
    }

    // Family visits ---------------------------------------------------------
    const familyVisitCount = rng.int(1, 3)
    for (let v = 0; v < familyVisitCount; v++) {
      await prisma.familyVisit.create({
        data: {
          localId: randomUUID(),
          familyId: family.id,
          visitDate: daysBefore(now, (v + 1) * rng.int(30, 60), rng),
          trainingsReceived: rng
            .sample(trainings, rng.int(0, 3))
            .map((t) => ({ id: t.id, title: t.title })) as Prisma.JsonArray,
          resourcesReceived: rng
            .sample(resources, rng.int(0, 3))
            .map((r) => ({ id: r.id, title: r.title })) as Prisma.JsonArray,
          questions: questionAnswers(familyQuestions, rng),
          photos: somePhotos(2),
          notes: rng.bool(0.6) ? rng.pick(VISIT_NOTES) : null,
        },
      })
      track('family_visits', 1)
    }
  }

  return counts
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const dbName = assertSafeTarget(opts)

  const prisma = new PrismaClient({ datasources: { db: { url: opts.databaseUrl } } })

  try {
    const userCount = await prisma.user.count()
    console.log(`Seeding database "${dbName}" (${userCount} user account(s) will not be touched)`)
    console.log(`  families=${opts.families}  seed=${opts.seed}  reset=${opts.reset}`)

    if (opts.reset) {
      await resetSeededTables(prisma)
      console.log('  cleared existing rows in all seeded tables')
    }

    const started = Date.now()
    const counts = await seed(prisma, opts)
    const elapsed = ((Date.now() - started) / 1000).toFixed(1)

    console.log('\nInserted:')
    for (const table of Object.keys(counts).sort()) {
      console.log(`  ${table.padEnd(34)} ${String(counts[table]).padStart(5)}`)
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    console.log(`  ${'TOTAL'.padEnd(34)} ${String(total).padStart(5)}   in ${elapsed}s`)

    const stillUsers = await prisma.user.count()
    if (stillUsers !== userCount) {
      throw new Error(`User count changed (${userCount} -> ${stillUsers}); this should never happen.`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
