import type { Metadata } from 'next';
import { QuizFlow } from './quiz-flow';

export const metadata: Metadata = {
  title: 'Guided diagnostic · IT Advisory',
  description: 'Answer a few questions to get a tailored consultation recommendation.',
};

export default function QuizPage() {
  return (
    <main>
      <QuizFlow />
    </main>
  );
}
