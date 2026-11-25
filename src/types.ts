export interface Coordinates { lat: number; lon: number }
export interface Location extends Coordinates { label: string; approximate: boolean }
export interface Station extends Coordinates {
  id: string;
  name: string;
  brand: string;
  address: string;
  municipality: string;
  province: string;
  postalCode: string;
  price: number;
  coordinatesAvailable: boolean;
}
export interface StationDistance extends Station { distance: number }
export interface Dataset {
  stations: Station[];
  publishedAt: string | null;
  fetchedAt: string;
  stale: boolean;
  skipped: number;
  source: string;
}
export type CashbackUnit = 'eur' | 'cent';
export interface TravelDistancePreference {
  route: string;
  value: string;
}
export interface Preferences {
  location: Location | null;
  brand: string;
  liters: string;
  cashback: string;
  unit: CashbackUnit;
  maxCashback: string;
  maxBonusLiters: string;
  travelEnabled: boolean;
  travelConsumption: string;
  travelFuelPrice: string | null;
  nearbyTravelDistance: TravelDistancePreference | null;
  brandTravelDistance: TravelDistancePreference | null;
  includeReturn: boolean;
}
