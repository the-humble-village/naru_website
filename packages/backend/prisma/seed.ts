import { PrismaClient, ProgramKind, SubjectType } from '@prisma/client';

const prisma = new PrismaClient();

// The six program rows from SCHEMA_V2.md §3. Each kind may have many rows; a new
// nutrition variant or a "Formula" program is a new row here, not a migration.
const PROGRAMS: Array<{
  name: string;
  kind: ProgramKind;
  subjectType: SubjectType;
  description: string;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  visitIntervalDays: number | null;
  sortOrder: number;
}> = [
  {
    name: 'Expectant Mother',
    kind: ProgramKind.PREGNANCY,
    subjectType: SubjectType.MOTHER,
    description: 'Prenatal accompaniment for a pregnant mother through to delivery.',
    minAgeMonths: null,
    maxAgeMonths: null,
    visitIntervalDays: 30,
    sortOrder: 10,
  },
  {
    name: 'Nutrition Infant <6m',
    kind: ProgramKind.NUTRITION,
    subjectType: SubjectType.CHILD,
    description: 'Nutritional recovery for infants under six months.',
    minAgeMonths: 0,
    maxAgeMonths: 6,
    visitIntervalDays: 30,
    sortOrder: 20,
  },
  {
    name: 'Nutrition Child 6m+',
    kind: ProgramKind.NUTRITION,
    subjectType: SubjectType.CHILD,
    description: 'Nutritional recovery for children six months and older.',
    minAgeMonths: 6,
    maxAgeMonths: null,
    visitIntervalDays: 30,
    sortOrder: 30,
  },
  {
    name: 'Midwives',
    kind: ProgramKind.MIDWIFE,
    subjectType: SubjectType.PERSON,
    description: 'Community midwives who accompany pregnant women.',
    minAgeMonths: null,
    maxAgeMonths: null,
    visitIntervalDays: null,
    sortOrder: 40,
  },
  {
    name: 'Youth / Students',
    kind: ProgramKind.STUDENT,
    subjectType: SubjectType.PERSON,
    description: 'Youth and student sponsorship.',
    minAgeMonths: null,
    maxAgeMonths: null,
    visitIntervalDays: null,
    sortOrder: 50,
  },
  {
    name: 'PAF',
    kind: ProgramKind.FAMILY_PAF,
    subjectType: SubjectType.FAMILY,
    description: 'Family-level PAF programme.',
    minAgeMonths: null,
    maxAgeMonths: null,
    visitIntervalDays: null,
    sortOrder: 60,
  },
];

async function main() {
  for (const program of PROGRAMS) {
    const existing = await prisma.program.findFirst({
      where: { name: program.name, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.program.update({ where: { id: existing.id }, data: program });
      console.log(`updated program: ${program.name}`);
    } else {
      await prisma.program.create({ data: program });
      console.log(`created program: ${program.name}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
