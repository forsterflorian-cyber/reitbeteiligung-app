export type UserRole = "owner" | "rider";

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
  status: string;
  message: string | null;
  created_at: string;
};

export type Approval = {
  horse_id: string;
  rider_id: string;
  status: string;
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

export type BookingRequest = {
  id: string;
  slot_id: string;
  horse_id: string;
  rider_id: string;
  status: string;
  created_at: string;
};
