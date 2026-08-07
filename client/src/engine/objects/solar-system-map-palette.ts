interface SolarSystemMapAccent {
  readonly base: string;
  readonly active: string;
}

const DEFAULT_SOLAR_SYSTEM_MAP_ACCENT: SolarSystemMapAccent = {
  base: '#c6a96f',
  active: '#ffe1a2',
};

const SOLAR_SYSTEM_MAP_ACCENTS = {
  sun: { base: '#ffd45c', active: '#fff0aa' },
  mercury: { base: '#a7b0ba', active: '#dce4ed' },
  venus: { base: '#e0a141', active: '#ffd17c' },
  earth: { base: '#43b4dd', active: '#9ae8ff' },
  mars: { base: '#d65e48', active: '#ff9e83' },
  jupiter: { base: '#dd9347', active: '#ffc985' },
  saturn: { base: '#d9bd55', active: '#ffe590' },
  uranus: { base: '#55c9c3', active: '#a0fff5' },
  neptune: { base: '#5975df', active: '#9db1ff' },
  pluto: { base: '#9d72ca', active: '#d4a8ff' },
} as const satisfies Record<string, SolarSystemMapAccent>;

export function getSolarSystemMapAccent(objectId: string, active: boolean): string {
  const accent = SOLAR_SYSTEM_MAP_ACCENTS[objectId as keyof typeof SOLAR_SYSTEM_MAP_ACCENTS];
  const resolved = accent ?? DEFAULT_SOLAR_SYSTEM_MAP_ACCENT;

  return active ? resolved.active : resolved.base;
}
