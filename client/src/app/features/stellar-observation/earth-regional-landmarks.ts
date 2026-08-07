import type { EarthHorizonCityscapeKind } from './earth-horizon-cityscapes';
import { PARIS_PANORAMA_HEIGHT, PARIS_PANORAMA_WIDTH } from './earth-paris-landmarks';

type EarthRegionalLandmarkCity = Exclude<EarthHorizonCityscapeKind, 'paris' | 'procedural'>;

interface EarthRegionalLandmarkCityReference {
  readonly latitude: number;
  readonly longitude: number;
  readonly referenceHeightMeters: number;
  readonly referenceRenderedHeightPixels: number;
}

export interface EarthRegionalLandmarkDefinition {
  readonly cityscapeKind: EarthRegionalLandmarkCity;
  readonly heightMeters: number;
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string;
  readonly silhouettePath: string;
  readonly sourceAspectRatio: number;
  readonly sourceUrl: string;
  readonly sourceViewBox: string;
}

export interface EarthRegionalLandmarkLayout extends EarthRegionalLandmarkDefinition {
  readonly bearingDegrees: number;
  readonly centerX: number;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const CITY_REFERENCES: Readonly<
  Record<EarthRegionalLandmarkCity, EarthRegionalLandmarkCityReference>
> = {
  'new-york': reference(40.71427, -74.00597, 541.3, 168),
  tokyo: reference(35.6895, 139.69171, 634, 176),
  london: reference(51.50853, -0.12574, 309.6, 156),
  sydney: reference(-33.86785, 151.20732, 309, 154),
  cairo: reference(30.06263, 31.24967, 393.8, 174),
  rio: reference(-22.90642, -43.18223, 163, 142),
  seoul: reference(37.566, 126.9784, 555, 174),
};

export const EARTH_REGIONAL_LANDMARKS: readonly EarthRegionalLandmarkDefinition[] = [
  landmark(
    'new-york',
    'one-world-trade-center',
    'One World Trade Center',
    40.712743,
    -74.013379,
    541.3,
    100,
    220,
    'M16 220V92L28 75 36 42 46 28 49 0H51L54 28 64 42 72 75 84 92V220H16ZM28 92 50 42 72 92 50 74 28 92Z',
    'https://wtcprod.panynj.gov/en/local/learn-about-wtc/one-world-trade-center.html',
  ),
  landmark(
    'new-york',
    'empire-state-building',
    'Empire State Building',
    40.748441,
    -73.985664,
    443.2,
    106,
    220,
    'M12 220V104H22V78H31V57H42V35H49V8L53 0 57 8V35H64V57H75V78H84V104H94V220H12ZM39 104H67V220H39V104Z',
    'https://www.esbnyc.com/about/facts-figures',
  ),
  landmark(
    'new-york',
    'chrysler-building',
    'Chrysler Building',
    40.751652,
    -73.975311,
    318.9,
    104,
    220,
    'M14 220V102H25V78H34L40 54 48 35 50 0H54L56 35 64 54 70 78H79V102H90V220H14ZM42 55 52 38 62 55 52 51 42 55ZM36 76 52 58 68 76 52 70 36 76Z',
    'https://www.nyc.gov/site/lpc/designations/landmark-reports.page',
  ),
  landmark(
    'new-york',
    'brooklyn-bridge',
    'Brooklyn Bridge',
    40.706086,
    -73.996864,
    84.3,
    260,
    130,
    'M0 130V118H42V52H56V35H70V52H84V118H176V52H190V35H204V52H218V118H260V130H0ZM48 118V59H78V118H48ZM182 118V59H212V118H182ZM69 43C103 66 118 89 130 110 142 89 157 66 191 43L190 49C158 72 145 95 130 118 115 95 102 72 70 49L69 43ZM0 116C22 78 42 59 55 48V55C40 68 23 87 8 116H0ZM205 48C218 59 238 78 260 116H252C237 87 220 68 205 55V48Z',
    'https://www.nyc.gov/html/dot/html/bridges/brooklyn_bridge.shtml',
  ),
  landmark(
    'tokyo',
    'tokyo-skytree',
    'Tokyo Skytree',
    35.710063,
    139.8107,
    634,
    96,
    240,
    'M18 240 35 92 43 68 47 26 49 0H51L53 26 57 68 65 92 82 240H65L55 136H45L31 240H18ZM37 94H63L58 110H42L37 94ZM31 132H69L65 145H35L31 132Z',
    'https://www.tokyo-skytree.jp/about/spec/',
  ),
  landmark(
    'tokyo',
    'tokyo-tower',
    'Tokyo Tower',
    35.658581,
    139.745433,
    333,
    116,
    220,
    'M8 220H38L48 132H68L78 220H108L75 86H67L61 26 59 0H57L55 26 49 86H41L8 220ZM45 98H71L67 116H49L45 98ZM35 145H81L76 158H40L35 145ZM24 188H92L88 199H28L24 188Z',
    'https://www.tokyotower.co.jp/en/lightup/en.php',
  ),
  landmark(
    'tokyo',
    'tokyo-metropolitan-government-building',
    'Tokyo Metropolitan Government Building',
    35.689634,
    139.692101,
    243,
    150,
    200,
    'M8 200V66H20V28H34V0H58V28H68V200H8ZM82 200V28H92V0H116V28H130V66H142V200H82ZM20 82H58V96H20V82ZM92 82H130V96H92V82Z',
    'https://www.english.metro.tokyo.lg.jp/w/000-101-000543',
  ),
  landmark(
    'tokyo',
    'mode-gakuen-cocoon-tower',
    'Mode Gakuen Cocoon Tower',
    35.69171,
    139.69694,
    203.7,
    100,
    200,
    'M50 0C76 18 88 62 84 115 81 158 68 188 58 200H42C32 188 19 158 16 115 12 62 24 18 50 0ZM29 57 71 140 65 158 25 78 29 57ZM71 57 29 140 35 158 75 78 71 57Z',
    'https://www.mode.ac.jp/tokyo/campus',
  ),
  landmark(
    'london',
    'the-shard',
    'The Shard',
    51.5045,
    -0.0865,
    309.6,
    102,
    220,
    'M12 220 48 18 55 0 59 40 90 220H12ZM31 201 53 50 71 201H31ZM58 47 79 201H70L58 47Z',
    'https://www.the-shard.com/about/',
  ),
  landmark(
    'london',
    'gherkin',
    '30 St Mary Axe',
    51.5145,
    -0.0803,
    180,
    100,
    200,
    'M50 0C72 16 88 55 87 103 86 151 71 186 58 200H42C29 186 14 151 13 103 12 55 28 16 50 0ZM29 56 72 139 67 156 25 76 29 56ZM71 56 28 139 33 156 75 76 71 56Z',
    'https://www.fosterandpartners.com/projects/30-st-mary-axe',
  ),
  landmark(
    'london',
    'st-pauls-cathedral',
    "St Paul's Cathedral",
    51.513845,
    -0.098351,
    111,
    174,
    160,
    'M0 160V142H25V116H38V91H45C46 70 55 51 75 42V27H82V17H85V0H89V17H92V27H99V42C119 51 128 70 129 91H136V116H149V142H174V160H0ZM55 91C56 68 68 51 87 47 106 51 118 68 119 91H55Z',
    'https://www.stpauls.co.uk/history-collections/history',
  ),
  landmark(
    'london',
    'tower-bridge',
    'Tower Bridge',
    51.5055,
    -0.0754,
    65,
    260,
    130,
    'M0 130V117H48V44H58V22H84V44H94V117H166V44H176V22H202V44H212V117H260V130H0ZM58 54H84V117H58V54ZM176 54H202V117H176V54ZM84 46C103 67 116 91 130 110 144 91 157 67 176 46V57C157 79 144 101 130 119 116 101 103 79 84 57V46Z',
    'https://www.towerbridge.org.uk/discover/history',
  ),
  landmark(
    'sydney',
    'sydney-tower',
    'Sydney Tower Eye',
    -33.870451,
    151.208755,
    309,
    86,
    220,
    'M36 220 42 92H31V70L43 52 47 14 49 0H51L53 14 57 52 69 70V92H58L64 220H36ZM24 70C31 53 69 53 76 70V88H24V70Z',
    'https://www.sydneytowereye.com.au/explore/about-us/',
  ),
  landmark(
    'sydney',
    'crown-sydney',
    'Crown Sydney',
    -33.865143,
    151.20166,
    271.3,
    112,
    220,
    'M18 220C13 176 17 139 33 108 48 79 44 45 60 0 79 39 72 77 87 109 101 139 100 177 94 220H18ZM36 204C32 157 43 124 58 96 74 126 82 159 76 204H36Z',
    'https://www.crownsydney.com.au/about',
  ),
  landmark(
    'sydney',
    'chifley-tower',
    'Chifley Tower',
    -33.866313,
    151.211313,
    244,
    104,
    220,
    'M12 220V72H23V49H35V32H47V14H55V0H59V14H69V32H81V49H92V72H100V220H12ZM31 80H81V220H31V80Z',
    'https://www.chifley.com.au/about/',
  ),
  landmark(
    'sydney',
    'sydney-harbour-bridge',
    'Sydney Harbour Bridge',
    -33.852306,
    151.210787,
    134,
    300,
    140,
    'M0 140V124H34V104H48C68 40 107 8 150 8S232 40 252 104H266V124H300V140H0ZM55 104C74 52 109 23 150 23s76 29 95 81h-17c-17-39-43-61-78-61s-61 22-78 61H55ZM42 96H58V124H42V96ZM242 96H258V124H242V96Z',
    'https://www.transport.nsw.gov.au/operations/roads-and-waterways/environment-and-heritage/sydney-harbour-bridge',
  ),
  landmark(
    'cairo',
    'iconic-tower',
    'Iconic Tower',
    30.0134,
    31.6923,
    393.8,
    104,
    220,
    'M15 220V62L30 48 38 24 50 0 62 24 70 48 89 62V220H15ZM30 68 50 44 74 68 68 80 32 80 30 68Z',
    'https://www.cscec.com/english/NewsCenter/News/202203/3494196.html',
  ),
  landmark(
    'cairo',
    'cairo-tower',
    'Cairo Tower',
    30.045915,
    31.22427,
    187,
    92,
    220,
    'M31 220 40 86H28V62C34 44 58 44 64 62V86H52L61 220H31ZM24 62C31 35 61 35 68 62V79H24V62ZM35 95 57 205M57 95 35 205',
    'https://www.cairo.gov.eg/en/culture/cairo-history/modern-landmarks/cairo-tower/',
  ),
  landmark(
    'cairo',
    'muhammad-ali-mosque',
    'Muhammad Ali Mosque',
    30.028743,
    31.259918,
    84,
    220,
    150,
    'M0 150V134H24V53H29V24H32V0H35V24H38V53H50C52 32 70 16 91 16s39 16 41 37h12V134H174V53H179V24H182V0H185V24H188V53H196V134H220V150H0ZM58 69C60 43 75 29 91 29s31 14 33 40H58ZM46 92C48 72 58 62 70 62s22 10 24 30H46ZM88 92C90 72 100 62 112 62s22 10 24 30H88Z',
    'https://egymonuments.gov.eg/en/monuments/muhammad-ali-mosque',
  ),
  landmark(
    'cairo',
    'sultan-hassan-mosque',
    'Sultan Hassan Mosque',
    30.032663,
    31.256584,
    68,
    190,
    150,
    'M0 150V132H28V70H36V34H42V0H47V34H54V70H78V54C82 32 106 20 126 34 137 42 142 56 142 70H158V132H190V150H0ZM85 70C87 50 98 40 110 40s23 10 25 30H85Z',
    'https://egymonuments.gov.eg/en/monuments/sultan-hassan-mosque',
  ),
  landmark(
    'rio',
    'rio-sul-center',
    'Rio Sul Center',
    -22.9571,
    -43.1761,
    163,
    116,
    210,
    'M10 210V54L28 38H51V18L58 0 65 18V38H88L106 54V210H10ZM31 62H51V198H31V62ZM65 62H85V198H65V62Z',
    'https://www.skyscrapercenter.com/building/rio-sul-center/3328',
  ),
  landmark(
    'rio',
    'central-do-brasil',
    'Central do Brasil',
    -22.9031,
    -43.1913,
    135,
    118,
    210,
    'M12 210V96H26V74H41V48H50V24H55V0H63V24H68V48H77V74H92V96H106V210H12ZM45 55H73V83H45V55ZM51 61H67V77H51V61Z',
    'https://www.ipatrimonio.org/rio-de-janeiro-edificio-da-estacao-dom-pedro-ii-central-do-brasil/',
  ),
  landmark(
    'rio',
    'rio-metropolitan-cathedral',
    'Rio Metropolitan Cathedral',
    -22.910711,
    -43.180736,
    75,
    150,
    150,
    'M0 150 38 32 75 0 112 32 150 150H0ZM38 124 55 50 75 30 95 50 112 124H38ZM68 46H82V120H68V46ZM45 77H105V91H45V77Z',
    'https://riotur.rio/que_fazer/catedral-metropolitana-de-sao-sebastiao/',
  ),
  landmark(
    'rio',
    'candelaria-church',
    'Candelária Church',
    -22.90047,
    -43.17799,
    62,
    200,
    150,
    'M0 150V132H24V78H38V52H50V25H58V0H64V25H72V52H82C85 31 100 18 116 18s31 13 34 34h10V78H174V52H186V25H194V0H200V150H0ZM92 62C94 42 104 32 116 32s22 10 24 30H92Z',
    'https://riotur.rio/que_fazer/igreja-da-candelaria/',
  ),
  landmark(
    'seoul',
    'lotte-world-tower',
    'Lotte World Tower',
    37.5125,
    127.1025,
    555,
    94,
    230,
    'M13 230C18 170 25 106 40 48L47 0 54 48C69 106 76 170 81 230H13ZM30 207C33 145 40 91 47 54 54 91 61 145 64 207H30Z',
    'https://www.lotte.co.kr/global/en/business/compDetail.do?compCd=L407',
  ),
  landmark(
    'seoul',
    'building-63',
    '63 Building',
    37.5198,
    126.9402,
    249,
    104,
    210,
    'M14 210 27 24 47 0 77 20 90 210H14ZM31 193 42 28 62 17 73 193H31Z',
    'https://english.visitseoul.net/attractions/63%2520Square/ENP000210',
  ),
  landmark(
    'seoul',
    'trade-tower',
    'Trade Tower',
    37.5112,
    127.0591,
    228,
    112,
    210,
    'M12 210V22H37V0H55V38H75V0H100V210H12ZM37 48H75V210H37V48Z',
    'https://www.coexcenter.com/about-coex/',
  ),
  landmark(
    'seoul',
    'gyeongbokgung',
    'Gyeongbokgung Palace',
    37.579617,
    126.977041,
    24,
    240,
    120,
    'M0 120V106H24V83H10L46 65H91V48H74L120 20 166 48H149V65H194L230 83H216V106H240V120H0ZM45 83H195V106H45V83ZM91 48H149V65H91V48Z',
    'https://www.royalpalace.go.kr/eng/index.do',
  ),
];

export function projectEarthRegionalLandmarkLayouts(
  kind: EarthHorizonCityscapeKind,
  panoramaUnitsPerRenderedPixel: number,
): readonly EarthRegionalLandmarkLayout[] {
  if (kind === 'paris' || kind === 'procedural') {
    return [];
  }

  const unitsPerPixel =
    Number.isFinite(panoramaUnitsPerRenderedPixel) && panoramaUnitsPerRenderedPixel > 0
      ? panoramaUnitsPerRenderedPixel
      : 1;
  const reference = CITY_REFERENCES[kind];
  const panoramaUnitsPerMeter =
    (reference.referenceRenderedHeightPixels / reference.referenceHeightMeters) * unitsPerPixel;

  return EARTH_REGIONAL_LANDMARKS.filter(
    (landmarkDefinition) => landmarkDefinition.cityscapeKind === kind,
  ).map((landmarkDefinition) => {
    const bearingDegrees = initialBearingDegrees(reference, landmarkDefinition);
    const centerX = (bearingDegrees / 360) * PARIS_PANORAMA_WIDTH;
    const height = landmarkDefinition.heightMeters * panoramaUnitsPerMeter;
    const width = height * landmarkDefinition.sourceAspectRatio;

    return {
      ...landmarkDefinition,
      bearingDegrees,
      centerX,
      height,
      width,
      x: centerX - width / 2,
      y: PARIS_PANORAMA_HEIGHT - height,
    };
  });
}

function landmark(
  cityscapeKind: EarthRegionalLandmarkCity,
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  heightMeters: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  silhouettePath: string,
  sourceUrl: string,
): EarthRegionalLandmarkDefinition {
  return {
    cityscapeKind,
    heightMeters,
    id,
    latitude,
    longitude,
    name,
    silhouettePath,
    sourceAspectRatio: viewBoxWidth / viewBoxHeight,
    sourceUrl,
    sourceViewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
  };
}

function reference(
  latitude: number,
  longitude: number,
  referenceHeightMeters: number,
  referenceRenderedHeightPixels: number,
): EarthRegionalLandmarkCityReference {
  return { latitude, longitude, referenceHeightMeters, referenceRenderedHeightPixels };
}

function initialBearingDegrees(
  origin: Pick<EarthRegionalLandmarkCityReference, 'latitude' | 'longitude'>,
  destination: Pick<EarthRegionalLandmarkDefinition, 'latitude' | 'longitude'>,
): number {
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(destinationLatitude);
  const x =
    Math.cos(originLatitude) * Math.sin(destinationLatitude) -
    Math.sin(originLatitude) * Math.cos(destinationLatitude) * Math.cos(longitudeDelta);

  return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)));
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
