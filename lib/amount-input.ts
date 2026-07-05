/** Keep only digits and spaces for amount fields */
export function sanitizeAmountInput(value: string): string {
  return value.replace(/[^\d\s]/g, "")
}
