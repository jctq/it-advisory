export type CheckoutCustomerInput = {
  readonly customerName?: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
};

export function hasCheckoutCustomer(input: CheckoutCustomerInput): boolean {
  return (
    (input.customerName?.trim().length ?? 0) > 0 ||
    (input.customerEmail?.trim().length ?? 0) > 0 ||
    (input.customerPhone?.trim().length ?? 0) > 0
  );
}

/**
 * PayMongo checkout shows a fixed +63 prefix; billing.phone must be the national number only.
 */
export function normalizePaymongoBillingPhone(phone: string): string {
  let digits = phone.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('63') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }
  return digits;
}

export function buildPaymongoBilling(
  input: CheckoutCustomerInput,
): { readonly name?: string; readonly email?: string; readonly phone?: string } | undefined {
  const name = input.customerName?.trim() ?? '';
  const email = input.customerEmail?.trim() ?? '';
  const rawPhone = input.customerPhone?.trim() ?? '';
  const phone = rawPhone.length > 0 ? normalizePaymongoBillingPhone(rawPhone) : '';
  if (name.length === 0 && email.length === 0 && phone.length === 0) {
    return undefined;
  }
  return {
    ...(name.length > 0 ? { name } : {}),
    ...(email.length > 0 ? { email } : {}),
    ...(phone.length > 0 ? { phone } : {}),
  };
}

export function splitCustomerName(fullName: string): { readonly givenNames: string; readonly surname: string } {
  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return { givenNames: 'Customer', surname: '.' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { givenNames: parts[0]!, surname: '.' };
  }
  return { givenNames: parts[0]!, surname: parts.slice(1).join(' ') };
}

export function buildXenditCustomer(
  input: CheckoutCustomerInput,
): Record<string, string> | undefined {
  const email = input.customerEmail?.trim() ?? '';
  const phone = input.customerPhone?.trim() ?? '';
  const name = input.customerName?.trim() ?? '';
  if (email.length === 0 && phone.length === 0 && name.length === 0) {
    return undefined;
  }
  const customer: Record<string, string> = {};
  if (email.length > 0) {
    customer.email = email;
  }
  if (phone.length > 0) {
    customer.mobile_number = phone;
  }
  if (name.length > 0) {
    const { givenNames, surname } = splitCustomerName(name);
    customer.given_names = givenNames;
    customer.surname = surname;
  }
  return customer;
}
