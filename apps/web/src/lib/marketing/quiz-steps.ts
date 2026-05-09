import { SITUATION_OPTIONS } from '@/lib/marketing/situation-options';

export type QuizStep = {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  {
    id: 'situation',
    question: 'Describe your situation — guided intake',
    options: [...SITUATION_OPTIONS],
  },
  {
    id: 'duration',
    question: 'How long has this been happening?',
    options: ['Less than 1 month', '1–3 months', '3–6 months', 'More than 6 months'],
  },
  {
    id: 'system',
    question: 'What system / project is involved?',
    options: ['ERP', 'HRIS', 'CRM', 'Accounting', 'Custom software', 'Unsure'],
  },
  {
    id: 'outcome',
    question: 'What outcome do you want?',
    options: [
      'Rescue the project',
      'Assess the vendor',
      'Get independent advice',
      'Validate the roadmap',
      'Reduce risk before spending more',
    ],
  },
] as const;

export const QUIZ_TOTAL_STEPS: number = QUIZ_STEPS.length;
