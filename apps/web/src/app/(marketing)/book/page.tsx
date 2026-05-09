import type { Metadata } from 'next';
import { BookingPicker } from './booking-picker';

export const metadata: Metadata = {
  title: 'Book a session · IT Advisory',
  description: 'Choose a Philippine-time slot for your consultation.',
};

export default function BookPage() {
  return (
    <main>
      <BookingPicker />
    </main>
  );
}
