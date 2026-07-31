import type { Place } from './types';

/**
 * Bundled place directory.
 *
 * Search hits this list first so results appear instantly and the app works
 * with no network at all. It is not meant to be exhaustive — anything not here
 * is resolved through `geocoding.ts`, which covers the rest of the world.
 *
 * India is deliberately well covered down to district towns, since that is
 * where the bundled list earns its keep.
 */

const IST = { timezone: 'Asia/Kolkata', utcOffsetMinutes: 330 };

/**
 * `elevation` is in metres and matters more than it looks: Ooty and Chennai sit
 * two degrees of latitude apart but 2.2km of altitude, which is a 12°C
 * difference the climate model can only see if it is recorded here.
 */
function india(
  id: string,
  name: string,
  region: string,
  latitude: number,
  longitude: number,
  elevation = 0,
): Place {
  return {
    id,
    name,
    region,
    country: 'India',
    countryCode: 'IN',
    coordinates: { latitude, longitude },
    elevation,
    ...IST,
  };
}

function world(
  id: string,
  name: string,
  country: string,
  countryCode: string,
  latitude: number,
  longitude: number,
  timezone: string,
  utcOffsetMinutes: number,
  region?: string,
  elevation = 0,
): Place {
  return {
    id,
    name,
    region,
    country,
    countryCode,
    coordinates: { latitude, longitude },
    timezone,
    utcOffsetMinutes,
    elevation,
  };
}

/** Tamil Nadu and the far south, including the towns this list exists for. */
const TAMIL_NADU: Place[] = [
  india('chennai', 'Chennai', 'Tamil Nadu', 13.0827, 80.2707),
  india('coimbatore', 'Coimbatore', 'Tamil Nadu', 11.0168, 76.9558),
  india('madurai', 'Madurai', 'Tamil Nadu', 9.9252, 78.1198),
  india('tiruchirappalli', 'Tiruchirappalli', 'Tamil Nadu', 10.7905, 78.7047),
  india('salem-in', 'Salem', 'Tamil Nadu', 11.6643, 78.146),
  india('tirunelveli', 'Tirunelveli', 'Tamil Nadu', 8.7139, 77.7567),
  india('nagercoil', 'Nagercoil', 'Tamil Nadu', 8.1833, 77.4119),
  india('kanyakumari', 'Kanyakumari', 'Tamil Nadu', 8.0883, 77.5385),
  india('thoothukudi', 'Thoothukudi', 'Tamil Nadu', 8.7642, 78.1348),
  india('vellore', 'Vellore', 'Tamil Nadu', 12.9165, 79.1325),
  india('erode', 'Erode', 'Tamil Nadu', 11.341, 77.7172),
  india('thanjavur', 'Thanjavur', 'Tamil Nadu', 10.787, 79.1378),
  india('rameswaram', 'Rameswaram', 'Tamil Nadu', 9.2876, 79.3129),
  india('ooty', 'Udhagamandalam (Ooty)', 'Tamil Nadu', 11.4064, 76.6932, 2240),
  india('kodaikanal', 'Kodaikanal', 'Tamil Nadu', 10.2381, 77.4892, 2130),
  india('puducherry', 'Puducherry', 'Puducherry', 11.9416, 79.8083),
];

const SOUTH_INDIA: Place[] = [
  india('bengaluru', 'Bengaluru', 'Karnataka', 12.9716, 77.5946, 920),
  india('mysuru', 'Mysuru', 'Karnataka', 12.2958, 76.6394, 770),
  india('mangaluru', 'Mangaluru', 'Karnataka', 12.9141, 74.856),
  india('kochi', 'Kochi', 'Kerala', 9.9312, 76.2673),
  india('thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', 8.5241, 76.9366),
  india('kozhikode', 'Kozhikode', 'Kerala', 11.2588, 75.7804),
  india('munnar', 'Munnar', 'Kerala', 10.0889, 77.0595, 1600),
  india('hyderabad', 'Hyderabad', 'Telangana', 17.385, 78.4867, 542),
  india('visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185),
  india('vijayawada', 'Vijayawada', 'Andhra Pradesh', 16.5062, 80.648),
  india('panaji', 'Panaji', 'Goa', 15.4909, 73.8278),
];

const REST_OF_INDIA: Place[] = [
  india('delhi', 'New Delhi', 'Delhi', 28.6139, 77.209, 216),
  india('pune', 'Pune', 'Maharashtra', 18.5204, 73.8567, 560),
  india('nagpur', 'Nagpur', 'Maharashtra', 21.1458, 79.0882, 310),
  india('kolkata', 'Kolkata', 'West Bengal', 22.5726, 88.3639),
  india('darjeeling', 'Darjeeling', 'West Bengal', 27.036, 88.2627, 2045),
  india('ahmedabad', 'Ahmedabad', 'Gujarat', 23.0225, 72.5714),
  india('surat', 'Surat', 'Gujarat', 21.1702, 72.8311),
  india('jaipur', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, 431),
  india('lucknow', 'Lucknow', 'Uttar Pradesh', 26.8467, 80.9462),
  india('varanasi', 'Varanasi', 'Uttar Pradesh', 25.3176, 82.9739),
  india('bhopal', 'Bhopal', 'Madhya Pradesh', 23.2599, 77.4126, 527),
  india('indore', 'Indore', 'Madhya Pradesh', 22.7196, 75.8577, 553),
  india('patna', 'Patna', 'Bihar', 25.5941, 85.1376),
  india('guwahati', 'Guwahati', 'Assam', 26.1445, 91.7362),
  india('chandigarh', 'Chandigarh', 'Chandigarh', 30.7333, 76.7794, 350),
  india('shimla', 'Shimla', 'Himachal Pradesh', 31.1048, 77.1734, 2200),
  india('srinagar', 'Srinagar', 'Jammu and Kashmir', 34.0837, 74.7973, 1585),
  india('leh', 'Leh', 'Ladakh', 34.1526, 77.5771, 3500),
];

const WORLD: Place[] = [
  world('new-york', 'New York', 'United States', 'US', 40.7128, -74.006, 'America/New_York', -240, 'New York'),
  world('los-angeles', 'Los Angeles', 'United States', 'US', 34.0522, -118.2437, 'America/Los_Angeles', -420, 'California'),
  world('toronto', 'Toronto', 'Canada', 'CA', 43.6532, -79.3832, 'America/Toronto', -240, 'Ontario'),
  world('mexico-city', 'Mexico City', 'Mexico', 'MX', 19.4326, -99.1332, 'America/Mexico_City', -360, undefined, 2240),
  world('sao-paulo', 'São Paulo', 'Brazil', 'BR', -23.5505, -46.6333, 'America/Sao_Paulo', -180),
  world('buenos-aires', 'Buenos Aires', 'Argentina', 'AR', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires', -180),
  world('paris', 'Paris', 'France', 'FR', 48.8566, 2.3522, 'Europe/Paris', 120),
  world('berlin', 'Berlin', 'Germany', 'DE', 52.52, 13.405, 'Europe/Berlin', 120),
  world('madrid', 'Madrid', 'Spain', 'ES', 40.4168, -3.7038, 'Europe/Madrid', 120, undefined, 667),
  world('rome', 'Rome', 'Italy', 'IT', 41.9028, 12.4964, 'Europe/Rome', 120),
  world('amsterdam', 'Amsterdam', 'Netherlands', 'NL', 52.3676, 4.9041, 'Europe/Amsterdam', 120),
  world('istanbul', 'Istanbul', 'Türkiye', 'TR', 41.0082, 28.9784, 'Europe/Istanbul', 180),
  world('moscow', 'Moscow', 'Russia', 'RU', 55.7558, 37.6173, 'Europe/Moscow', 180),
  world('nairobi', 'Nairobi', 'Kenya', 'KE', -1.2864, 36.8172, 'Africa/Nairobi', 180, undefined, 1795),
  world('lagos', 'Lagos', 'Nigeria', 'NG', 6.5244, 3.3792, 'Africa/Lagos', 60),
  world('cape-town', 'Cape Town', 'South Africa', 'ZA', -33.9249, 18.4241, 'Africa/Johannesburg', 120),
  world('colombo', 'Colombo', 'Sri Lanka', 'LK', 6.9271, 79.8612, 'Asia/Colombo', 330),
  world('kathmandu', 'Kathmandu', 'Nepal', 'NP', 27.7172, 85.324, 'Asia/Kathmandu', 345, undefined, 1400),
  world('dhaka', 'Dhaka', 'Bangladesh', 'BD', 23.8103, 90.4125, 'Asia/Dhaka', 360),
  world('karachi', 'Karachi', 'Pakistan', 'PK', 24.8607, 67.0011, 'Asia/Karachi', 300),
  world('bangkok', 'Bangkok', 'Thailand', 'TH', 13.7563, 100.5018, 'Asia/Bangkok', 420),
  world('jakarta', 'Jakarta', 'Indonesia', 'ID', -6.2088, 106.8456, 'Asia/Jakarta', 420),
  world('manila', 'Manila', 'Philippines', 'PH', 14.5995, 120.9842, 'Asia/Manila', 480),
  world('hong-kong', 'Hong Kong', 'Hong Kong', 'HK', 22.3193, 114.1694, 'Asia/Hong_Kong', 480),
  world('shanghai', 'Shanghai', 'China', 'CN', 31.2304, 121.4737, 'Asia/Shanghai', 480),
  world('beijing', 'Beijing', 'China', 'CN', 39.9042, 116.4074, 'Asia/Shanghai', 480),
  world('seoul', 'Seoul', 'South Korea', 'KR', 37.5665, 126.978, 'Asia/Seoul', 540),
  world('sydney', 'Sydney', 'Australia', 'AU', -33.8688, 151.2093, 'Australia/Sydney', 600, 'New South Wales'),
  world('melbourne', 'Melbourne', 'Australia', 'AU', -37.8136, 144.9631, 'Australia/Melbourne', 600, 'Victoria'),
  world('auckland', 'Auckland', 'New Zealand', 'NZ', -36.8485, 174.7633, 'Pacific/Auckland', 720),
];

/**
 * Everything searchable offline. The featured demo cities from
 * `mock-provider.ts` are prepended there, so they always rank first.
 */
export const DIRECTORY: Place[] = [...TAMIL_NADU, ...SOUTH_INDIA, ...REST_OF_INDIA, ...WORLD];

/**
 * Case- and accent-insensitive comparison key.
 *
 * `NFD` splits accented letters into a base letter plus a combining mark, and
 * the filter drops the marks — so "sao paulo" matches "São Paulo" and
 * "reykjavik" matches "Reykjavík". Done by code point rather than a regex
 * character class, because a range of invisible combining marks written inline
 * is trivially corrupted by tooling and fails silently.
 */
const COMBINING_START = 0x0300;
const COMBINING_END = 0x036f;

function fold(value: string) {
  const decomposed = value.toLowerCase().normalize('NFD');
  let out = '';

  for (const char of decomposed) {
    const code = char.codePointAt(0) ?? 0;
    if (code < COMBINING_START || code > COMBINING_END) out += char;
  }
  return out;
}

/** Substring match across name, region and country. */
export function matchesQuery(place: Place, query: string) {
  return fold(`${place.name} ${place.region ?? ''} ${place.country}`).includes(fold(query));
}
