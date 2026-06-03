import { z } from "zod";

// Zod schemas for the ICP rubric and user profile JSONB (icp-config D-C). The DB does
// not validate JSONB; these are the contract the qualifier (Wave 3) reads and the
// config Server Actions validate before persisting. Shapes mirror the prototype
// _data/icp-config.ts types and the domain model. `name`/`version`/`active` are typed
// columns on the rubric table, not part of this criteria JSON.
//
// Pure schemas with no server-only dependency (no DB, secrets, or I/O), so they are
// safe to import from client components too - e.g. for client-side form validation that
// reuses the same contract. Intentionally NOT `server-only`.

export const rubricBandSchema = z.object({
  score: z.number().int().min(1).max(5),
  criteria: z.string().min(1),
});

export const rubricCriteriaSchema = z.object({
  idealTitles: z.array(z.string()),
  idealStages: z.array(z.string()),
  positiveSignals: z.array(z.string()),
  disqualifiers: z.array(z.string()),
  bands: z.array(rubricBandSchema),
  insufficientDataRule: z.string(),
  platformNote: z.string(),
});
export type RubricCriteria = z.infer<typeof rubricCriteriaSchema>;

export const caseStudySchema = z.object({
  title: z.string(),
  result: z.string(),
});

export const userProfileSchema = z.object({
  positioning: z.string().min(1),
  offer: z.string(),
  voice: z.string(),
  caseStudies: z.array(caseStudySchema),
});
export type UserProfileData = z.infer<typeof userProfileSchema>;

export interface SaveRubricInput {
  name: string;
  criteria: RubricCriteria;
}
