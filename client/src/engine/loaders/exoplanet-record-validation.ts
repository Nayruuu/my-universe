export function isOptionalFinite(value: number): boolean {
  return Number.isNaN(value) || Number.isFinite(value);
}

export function isOptionalPositive(value: number): boolean {
  return Number.isNaN(value) || (Number.isFinite(value) && value > 0);
}

export function isOptionalRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isNaN(value) || (Number.isFinite(value) && value >= minimum && value <= maximum);
}
