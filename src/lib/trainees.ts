export const TRAINEES = ["Alex Rivera", "Priya Sharma", "Jordan Lee"] as const;

export type TraineeName = (typeof TRAINEES)[number];
