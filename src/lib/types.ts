export interface InfoCard {
  icon: string;
  title: string;
  text: string;
}

export interface Studio {
  id: string;
  slug: string;
  status: "draft" | "live";
  name: string;
  tagline: string;
  description: string;
  timezone: string;
  address: string;
  city: string;
  lat: number | null;
  lon: number | null;
  phone: string;
  socials: { label: string; url: string }[];
  rating: { value: number; count: number; source: string; url: string } | null;
  theme_color: string;
  accent: string;
  logo_path: string | null;
  hero_path: string | null;
  hero_position: string;
  info_cards: InfoCard[];
  slot_step_minutes: number;
  buffer_minutes: number;
  lead_minutes: number;
  horizon_days: number;
  cancel_hours: number;
}

export interface Service {
  id: string;
  studio_id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  price_from: boolean;
  duration_minutes: number;
  duration_days: number;
  is_active: boolean;
  sort: number;
}

export interface Box {
  id: string;
  studio_id: string;
  name: string;
  is_active: boolean;
  sort: number;
}

export interface WorkingHours {
  studio_id: string;
  weekday: number;
  opens: string;
  closes: string;
}

export interface DayOff {
  studio_id: string;
  day: string;
  note: string;
}

export interface GalleryItem {
  id: string;
  studio_id: string;
  image_path: string;
  caption: string;
  sort: number;
  updated_at: string;
}

export interface ReviewAlbum {
  id: string;
  author: string;
  excerpt: string;
  rating: number;
  reviewed_at: string;
  source_url: string;
  photo_urls: string[];
}

export interface StudioBundle {
  studio: Studio;
  services: Service[];
  boxes: Box[];
  hours: WorkingHours[];
  daysOff: DayOff[];
  gallery: GalleryItem[];
  reviewAlbums: ReviewAlbum[];
}

export type BookingStatus = "booked" | "arrived" | "done" | "cancelled";

/** Запись, как её видит клиент (по секретной ссылке). */
export interface PublicBooking {
  id: string;
  token: string;
  status: BookingStatus;
  serviceName: string;
  price: number;
  startsAt: string;
  endsAt: string;
  boxName: string | null;
  clientName: string;
  clientPhone: string;
  car: string;
  comment: string;
  canCancel: boolean;
  cancelDeadline: string;
  cancelHours: number;
  studio: { slug: string; name: string; address: string; phone: string; timezone: string; lat: number | null; lon: number | null };
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  free: boolean;
}

export interface AvailabilityDay {
  date: string;
  isOpen: boolean;
  slots: AvailabilitySlot[];
}

export interface Availability {
  timezone: string;
  bookable: boolean;
  days: AvailabilityDay[];
}

/** Запись в кабинете владельца. */
export interface OwnerBooking {
  id: string;
  studio_id: string;
  service_id: string | null;
  box_id: string;
  service_name: string;
  price: number;
  client_name: string;
  client_phone: string;
  car: string;
  comment: string;
  starts_at: string;
  ends_at: string;
  block_until: string;
  status: BookingStatus;
  source: "online" | "manual";
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  kind: "payment" | "refund";
  amount: number;
  method: "card" | "cash" | "sbp" | "transfer";
  note: string;
  created_at: string;
}
