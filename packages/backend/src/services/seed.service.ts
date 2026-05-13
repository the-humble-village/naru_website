import prisma from '../db.js';

/**
 * Generate test data matching the legacy PHP NGenerateTestData class.
 * Runs inside a Prisma transaction so everything is atomic.
 */
export async function generateTestData() {
  return prisma.$transaction(async (tx: any) => {
    // Delete all existing data in FK-safe order
    await tx.childVisit.deleteMany();
    await tx.familyVisit.deleteMany();
    await tx.child.deleteMany();
    await tx.parent.deleteMany();
    await tx.family.deleteMany();
    await tx.birthingAssistantCommunity.deleteMany();
    await tx.birthingAssistantTraining.deleteMany();
    await tx.birthingAssistant.deleteMany();
    await tx.community.deleteMany();
    await tx.site.deleteMany();
    await tx.training.deleteMany();
    await tx.resource.deleteMany();
    await tx.childVisitQuestion.deleteMany();
    await tx.parentVisitQuestion.deleteMany();
    await tx.familyVisitQuestion.deleteMany();

    // Communities
    const communityTitles = ['San Marcos', 'La Esperanza', 'El Progreso'];
    const communities = await Promise.all(
      communityTitles.map((title) =>
        tx.community.create({ data: { title } })
      )
    );

    // Sites
    const siteTitles = ['Clinic Alpha', 'Clinic Beta', 'Community Center'];
    const sites = await Promise.all(
      siteTitles.map((title) =>
        tx.site.create({ data: { title } })
      )
    );

    // Training
    const trainingTitles = ['Nutrition Basics', 'Child Development', 'Health & Hygiene'];
    const trainings = await Promise.all(
      trainingTitles.map((title) =>
        tx.training.create({ data: { title } })
      )
    );

    // Resources
    const resourceTitles = ['Food Basket', 'Medicine Kit', 'Educational Materials'];
    await Promise.all(
      resourceTitles.map((title) =>
        tx.resource.create({ data: { title } })
      )
    );

    // Child visit questions
    const childQuestions = [
      'Weight gain since last visit?',
      'Any signs of illness?',
      'Feeding schedule followed?',
    ];
    await Promise.all(
      childQuestions.map((title) =>
        tx.childVisitQuestion.create({ data: { title } })
      )
    );

    // Parent visit questions
    const parentQuestions = [
      'Attended prenatal checkup?',
      'Any concerns about pregnancy?',
      'Nutritional supplements taken?',
    ];
    await Promise.all(
      parentQuestions.map((title) =>
        tx.parentVisitQuestion.create({ data: { title } })
      )
    );

    // Family visit questions
    const familyQuestions = [
      'Family access to clean water?',
      'Food security this month?',
      'Received community support?',
    ];
    await Promise.all(
      familyQuestions.map((title) =>
        tx.familyVisitQuestion.create({ data: { title } })
      )
    );

    // Birthing assistant with community + training links
    const ba = await tx.birthingAssistant.create({
      data: {
        name: 'Maria Lopez',
        servedCommunities: {
          create: [
            { communityId: communities[0]!.id },
            { communityId: communities[1]!.id },
          ],
        },
        trainingsReceived: {
          create: [
            { trainingId: trainings[0]!.id },
            { trainingId: trainings[1]!.id },
          ],
        },
      },
    });

    // Families with parents and children
    const today = new Date();
    let totalChildVisits = 0;
    let totalFamilyVisits = 0;

    const familyData = [
      {
        familyName: 'Garcia',
        inCrisis: false,
        communityId: communities[0]!.id,
        siteId: sites[0]!.id,
        parent: { name: 'Ana Garcia', role: 'Mother', birthDate: new Date('1985-03-15') },
        children: [
          { name: 'Luis Garcia', birthDate: new Date('2018-06-10'), sex: 'MALE' as const, weight: 12500 },
          { name: 'Rosa Garcia', birthDate: new Date('2020-11-22'), sex: 'FEMALE' as const, weight: 9800 },
        ],
      },
      {
        familyName: 'Rodriguez',
        inCrisis: false,
        communityId: communities[1]!.id,
        siteId: sites[1]!.id,
        parent: { name: 'Carlos Rodriguez', role: 'Father', birthDate: new Date('1980-07-22') },
        children: [
          { name: 'Pedro Rodriguez', birthDate: new Date('2019-03-05'), sex: 'MALE' as const, weight: 11200 },
        ],
      },
      {
        familyName: 'Martinez',
        inCrisis: true,
        communityId: communities[0]!.id,
        siteId: sites[2]!.id,
        parent: { name: 'Sofia Martinez', role: 'Mother', birthDate: new Date('1990-11-08') },
        children: [
          { name: 'Mia Martinez', birthDate: new Date('2021-01-30'), sex: 'FEMALE' as const, weight: 8400 },
          { name: 'Juan Martinez', birthDate: new Date('2017-08-14'), sex: 'MALE' as const, weight: 14000 },
        ],
      },
      {
        familyName: 'Lopez',
        inCrisis: false,
        communityId: communities[2]!.id,
        siteId: sites[0]!.id,
        parent: { name: 'Luis Lopez', role: 'Father', birthDate: new Date('1978-04-30') },
        children: [
          { name: 'Sara Lopez', birthDate: new Date('2022-05-18'), sex: 'FEMALE' as const, weight: 7600 },
        ],
      },
      {
        familyName: 'Hernandez',
        inCrisis: false,
        communityId: communities[1]!.id,
        siteId: sites[1]!.id,
        parent: { name: 'Elena Hernandez', role: 'Mother', birthDate: new Date('1988-09-12') },
        children: [
          { name: 'Diego Hernandez', birthDate: new Date('2016-12-02'), sex: 'MALE' as const, weight: 15500 },
          { name: 'Lucia Hernandez', birthDate: new Date('2023-02-09'), sex: 'FEMALE' as const, weight: 6200 },
        ],
      },
    ];

    for (const fd of familyData) {
      const family = await tx.family.create({
        data: {
          familyName: fd.familyName,
          childrenEditable: fd.children.length,
          inCrisis: fd.inCrisis,
          communityId: fd.communityId,
          siteId: fd.siteId,
          notes: 'Test data family.',
        },
      });

      await tx.parent.create({
        data: {
          familyId: family.id,
          name: fd.parent.name,
          role: fd.parent.role,
          birthDate: fd.parent.birthDate,
        },
      });

      let childVisitCount = 0;
      for (const child of fd.children) {
        const createdChild = await tx.child.create({
          data: {
            familyId: family.id,
            name: child.name,
            birthDate: child.birthDate,
            sex: child.sex,
            dateEntered: today,
            weight: child.weight,
            nutritionalState: 'Normal',
            reasonEnrollment: 'Enrolled for test data.',
            observations: '',
          },
        });

        // Two child visits: 2 months ago and 1 month ago
        const twoMonthsAgo = new Date(today);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        await tx.childVisit.create({
          data: {
            familyId: family.id,
            childId: createdChild.id,
            visitDate: twoMonthsAgo,
            weight: Math.round(child.weight * 0.95),
            armCircumference: 130,
            height: 0,
            notes: 'Initial visit — test data.',
          },
        });
        await tx.childVisit.create({
          data: {
            familyId: family.id,
            childId: createdChild.id,
            visitDate: oneMonthAgo,
            weight: Math.round(child.weight * 0.975),
            armCircumference: 135,
            height: 0,
            notes: 'Follow-up visit — test data.',
          },
        });
        await tx.childVisit.create({
          data: {
            familyId: family.id,
            childId: createdChild.id,
            visitDate: today,
            weight: child.weight,
            armCircumference: 138,
            height: 0,
            notes: 'Current month visit — test data.',
          },
        });
        childVisitCount += 3;
      }

      totalChildVisits += childVisitCount;

      // Two family visits: 2 months ago and 1 month ago
      const twoMonthsAgo = new Date(today);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      await tx.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: twoMonthsAgo,
          trainingsReceived: [],
          resourcesReceived: [],
          questions: [],
          notes: 'Initial family visit — test data.',
        },
      });
      await tx.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: oneMonthAgo,
          trainingsReceived: [],
          resourcesReceived: [],
          questions: [],
          notes: 'Follow-up family visit — test data.',
        },
      });
      await tx.familyVisit.create({
        data: {
          familyId: family.id,
          visitDate: today,
          trainingsReceived: [],
          resourcesReceived: [],
          questions: [],
          notes: 'Current month family visit — test data.',
        },
      });
      totalFamilyVisits += 3;
    }

    return {
      communities: communities.length,
      sites: sites.length,
      trainings: trainings.length,
      resources: resourceTitles.length,
      birthingAssistants: 1,
      families: familyData.length,
      children: familyData.reduce((sum, f) => sum + f.children.length, 0),
      parents: familyData.length,
      childVisits: totalChildVisits,
      familyVisits: totalFamilyVisits,
    };
  });
}
