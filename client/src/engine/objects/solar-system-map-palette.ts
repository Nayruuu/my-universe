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
  eris: { base: '#9d72ca', active: '#d4a8ff' },
  haumea: { base: '#9d72ca', active: '#d4a8ff' },
  makemake: { base: '#9d72ca', active: '#d4a8ff' },
  ceres: { base: '#b88a57', active: '#f0bd80' },
  vesta: { base: '#b88a57', active: '#f0bd80' },
  pallas: { base: '#b88a57', active: '#f0bd80' },
  hygiea: { base: '#b88a57', active: '#f0bd80' },
  bennu: { base: '#b88a57', active: '#f0bd80' },
  halley: { base: '#55a99f', active: '#9df3e6' },
  '67p-churyumov-gerasimenko': { base: '#55a99f', active: '#9df3e6' },
} as const satisfies Record<string, SolarSystemMapAccent>;

const SATELLITE_PARENT_IDS: Readonly<Record<string, keyof typeof SOLAR_SYSTEM_MAP_ACCENTS>> = {
  moon: 'earth',
  phobos: 'mars',
  deimos: 'mars',
  io: 'jupiter',
  europa: 'jupiter',
  ganymede: 'jupiter',
  callisto: 'jupiter',
  titan: 'saturn',
  mimas: 'saturn',
  enceladus: 'saturn',
  tethys: 'saturn',
  dione: 'saturn',
  rhea: 'saturn',
  iapetus: 'saturn',
  miranda: 'uranus',
  ariel: 'uranus',
  umbriel: 'uranus',
  titania: 'uranus',
  oberon: 'uranus',
  triton: 'neptune',
  charon: 'pluto',
};

export function getSolarSystemMapAccent(objectId: string, active: boolean): string {
  const directAccent = SOLAR_SYSTEM_MAP_ACCENTS[objectId as keyof typeof SOLAR_SYSTEM_MAP_ACCENTS];
  const parentId = SATELLITE_PARENT_IDS[objectId];
  const accent = directAccent ?? (parentId ? SOLAR_SYSTEM_MAP_ACCENTS[parentId] : undefined);
  const resolved = accent ?? DEFAULT_SOLAR_SYSTEM_MAP_ACCENT;

  return active ? resolved.active : resolved.base;
}
