/** Whether contact fields satisfy marketing checkout and manage-booking lookup rules. */
export function hasCheckoutManageContact(input: {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}): boolean {
  const trimmedName = input.fullName.trim();
  const trimmedEmail = input.email.trim();
  const trimmedPhone = input.phone.trim();
  return (
    trimmedName.length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) &&
    trimmedPhone.replace(/\s/g, '').length >= 7
  );
}
