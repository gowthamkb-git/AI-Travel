export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface WeatherData {
  temp: string | null;
  condition: string | null;
  location: string | null;
  season: string | null;
  best_time_to_visit?: string | null;
  feels_like?: string | null;
  humidity?: string | null;
  wind_speed?: string | null;
  key_points?: string[];
}

export interface CurrencyData {
  rate: string | null;
  from_currency: string | null;
  to_currency: string | null;
  symbol: string | null;
  from_symbol?: string | null;
  user_country?: string | null;
  destination_country?: string | null;
  same_currency?: boolean | null;
  exchange_text?: string | null;
  key_points?: string[];
}

export interface BudgetBreakdown {
  accommodation: string | null;
  food: string | null;
  transport: string | null;
  activities: string | null;
}

export interface BudgetData {
  total: string | null;
  per_day: string | null;
  currency_symbol: string | null;
  breakdown: BudgetBreakdown | null;
  total_local?: string | null;
  total_destination?: string | null;
  per_day_local?: string | null;
  per_day_destination?: string | null;
  destination_currency?: string | null;
  local_currency?: string | null;
  same_currency?: boolean | null;
  exchange_text?: string | null;
  key_points?: string[];
}

export interface WidgetData {
  weather: WeatherData | null;
  currency: CurrencyData | null;
  budget: BudgetData | null;
}

export interface Coords {
  lat: number;
  lng: number;
}

export interface PlaceMarker {
  name: string;
  coords: Coords;
  distanceKm?: number | null;
  rating?: number | null;
  address?: string | null;
  placeId?: string | null;
  googleMapsUrl?: string | null;
}

export interface RouteInfo {
  mode: "road" | "train" | "plane";
  label: string;
  distanceKm: number;
  durationMinutes: number;
  path: Coords[];
  notes: string[];
  estimated?: boolean;
}

export interface TripRequest {
  question: string;
  model_provider?: string;
  history?: { role: string; content: string }[];
  current_location?: Coords | null;
  location_context?: string | null;
}

export interface TripResponse {
  answer: string;
  widgets: WidgetData | null;
  destination?: string | null;
  destination_coords?: Coords | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  usage_limit: number;
  usage_count: number;
  avatar_url?: string | null;
  created_at: string;
}

export interface TripHistory {
  id: string;
  query: string;
  response: string;
  created_at: string;
}
