export type UserRole = "owner" | "rider";

export type TrialRequestStatus = "requested" | "accepted" | "declined" | "completed";
export type ApprovalStatus = "approved" | "revoked";
export type BookingRequestStatus = "requested" | "accepted" | "declined" | "canceled";

export type Profile = {
  id: string;
  role: UserRole;
  is_premium: boolean;
  created_at: string;
};

export type Horse = {
  id: string;
  owner_id: string;
  title: string;
  plz: string;
  description: string | null;
  active: boolean;
  stockmass_cm: number | null;
  rasse: string | null;
  farbe: string | null;
  geschlecht: string | null;
  alter: number | null;
  created_at: string;
};

export type HorseImage = {
  id: string;
  horse_id: string;
  storage_path: string;
  created_at: string;
};

export type RiderProfile = {
  user_id: string;
  experience: string | null;
  weight: number | null;
  notes: string | null;
};

export type TrialRequest = {
  id: string;
  horse_id: string;
  rider_id: string;
  status: TrialRequestStatus;
  message: string | null;
  created_at: string;
};

export type Approval = {
  horse_id: string;
  rider_id: string;
  status: ApprovalStatus;
  created_at: string;
};

export type Conversation = {
  id: string;
  horse_id: string;
  rider_id: string;
  owner_id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type AvailabilitySlot = {
  id: string;
  horse_id: string;
  start_at: string;
  end_at: string;
  active: boolean;
};

export type AvailabilityRule = {
  id: string;
  horse_id: string;
  slot_id: string;
  start_at: string;
  end_at: string;
  active: boolean;
  created_at: string;
};

export type BookingRequest = {
  id: string;
  slot_id: string;
  availability_rule_id: string | null;
  horse_id: string;
  rider_id: string;
  status: BookingRequestStatus;
  requested_start_at: string | null;
  requested_end_at: string | null;
  created_at: string;
};

export type CalendarBlock = {
  id: string;
  horse_id: string;
  start_at: string;
  end_at: string;
  created_at: string;
};

export type Booking = {
  id: string;
  booking_request_id: string;
  availability_rule_id: string;
  slot_id: string;
  horse_id: string;
  rider_id: string;
  start_at: string;
  end_at: string;
  created_at: string;
};