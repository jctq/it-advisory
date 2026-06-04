export function valueContainsTableKeyword(value: string | null | undefined, needle: string): boolean {
  return (value ?? '').toLowerCase().includes(needle);
}
