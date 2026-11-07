import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as schemas from '../index';

const updateSchemas: Array<[string, z.ZodType]> = [];
for (const [name, value] of Object.entries(schemas) as Array<[string, unknown]>) {
  if (name.endsWith('UpdateSchema') && value instanceof z.ZodType) {
    updateSchemas.push([name, value]);
  }
}

// Zod 4 applies .default() inside .partial(). A defaulted field left in an update schema
// silently resets stored data whenever a client omits that key.
describe('update schemas', () => {
  it('covers the schemas that have defaulted create fields', () => {
    expect(updateSchemas.map(([name]) => name)).toEqual(expect.arrayContaining([
      'BirthingAssistantUpdateSchema',
      'FamilyUpdateSchema',
      'PhotoAttachmentUpdateSchema',
      'ProgramUpdateSchema',
      'QuestionUpdateSchema',
      'QuestionSetUpdateSchema',
      'VisitUpdateSchema',
    ]));
  });

  it.each(updateSchemas)('%s adds nothing to an empty update', (_name, schema) => {
    expect(schema.parse({})).toEqual({});
  });
});
