export type UserRole = 'STUDENT' | 'TEACHER' | 'COLLEGE_ADMIN' | 'PLATFORM_ADMIN' | 'ADMIN';

export interface College {
  id: number;
  college_code: string;
  name: string;
  domain: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  contact_email?: string | null;
  is_active: boolean;
}

export interface User {
  id: number;
  institutional_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  college_id?: number | null;
  college?: College | null;
  college_name?: string | null;
  college_code?: string | null;
  class_name?: string | null;
  section?: string | null;
  department?: string | null;
  student_id_usn?: string | null;
  year_of_study?: string | number | null;
  semester?: string | number | null;
  phone_number?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  privacy_hide_contact?: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  institutional_id: string;
  student_id_usn?: string | null;
  full_name: string;
  email: string;
  college_id?: number | null;
  college_code?: string | null;
  college_name?: string | null;
}

export interface RegisterRequest {
  college_code: string;
  full_name: string;
  email: string;
  password: string;
  student_id_usn: string;
  institutional_id?: string;
  department?: string;
  year_of_study?: string | number;
  semester?: string | number;
  phone_number?: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  phone_number?: string;
  department?: string;
  student_id_usn?: string;
  year_of_study?: string | number;
  semester?: string | number;
  bio?: string;
  privacy_hide_contact?: boolean;
}

export type ReportType = 'LOST' | 'FOUND';

export type ReportStatus =
  | 'OPEN'
  | 'PENDING_HANDOVER'
  | 'IN_CUSTODY'
  | 'CLAIM_PENDING'
  | 'RETURNED'
  | 'CLOSED';

export type ReportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active: boolean;
}

export interface CampusLocation {
  id: number;
  name: string;
  building: string;
  floor?: string | null;
  description?: string | null;
  is_active: boolean;
}

export interface StorageLocation {
  id: number;
  name: string;
  building: string;
  room_number: string;
  locker_box_identifier?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface ItemImage {
  id: number;
  report_id: number;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  image_width: number;
  image_height: number;
  visual_features?: {
    embedding?: number[];
    dominant_colors?: Array<{ name: string; percentage: number; hsv: number[] }>;
    primary_color?: string;
    edge_density?: number;
    brightness?: number;
    aspect_ratio?: number;
    model_version?: string;
  } | null;
  is_primary: boolean;
  created_at: string;
}

export interface Item {
  id: number;
  report_id: number;
  item_name: string;
  category_id: number;
  category?: Category | null;
  visual_description?: string | null;
  color?: string | null;
  brand?: string | null;
  distinguishing_features?: string | null;
  primary_image_id?: number | null;
}

export interface Report {
  id: number;
  report_number: string;
  report_type: ReportType;
  college_id?: number | null;
  college?: College | null;
  submitted_by_student_id?: number | null;
  reported_lost_by_student_id?: number | null;
  reported_found_by_student_id?: number | null;
  created_by_user_id: number;
  received_by_teacher_id?: number | null;
  report_date: string;
  approximate_event_time?: string | null;
  location_id: number;
  detailed_description: string;
  status: ReportStatus;
  priority: ReportPriority;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  
  item?: Item | null;
  location?: CampusLocation | null;
  images: ItemImage[];
  creator?: User | null;
  submitting_student?: User | null;
  lost_student?: User | null;
  finder_student?: User | null;
  receiving_teacher?: User | null;
  matches_count?: number;
  claims_count?: number;
}

export interface ReportCloseRequest {
  reason: string;
  notes?: string;
}

export interface ReportListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Report[];
}

export type MatchStatus = 'SUGGESTED' | 'REVIEWED' | 'CONFIRMED' | 'REJECTED';

export interface MatchExplanation {
  visual_similarity_percent?: number | null;
  category_match?: boolean;
  category_name?: string | null;
  color_match?: boolean;
  shared_colors?: string[];
  temporal_proximity_days?: number | null;
  location_proximity?: string | null;
  summary: string;
}

export interface Match {
  id: number;
  lost_report_id: number;
  found_report_id: number;
  similarity_score: number;
  visual_score: number;
  metadata_score: number;
  matching_model_version: string;
  matching_features: MatchExplanation;
  match_status: MatchStatus;
  reviewed_by_user_id?: number | null;
  reviewed_at?: string | null;
  created_at: string;
  lost_report?: Report | null;
  found_report?: Report | null;
  lost_report_summary?: any;
  found_report_summary?: any;
}

export type ClaimStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface Claim {
  id: number;
  found_report_id: number;
  claimant_student_id: number;
  linked_lost_report_id?: number | null;
  claim_description: string;
  private_ownership_evidence: string;
  status: ClaimStatus;
  reviewed_by_teacher_id?: number | null;
  review_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  claimant?: User | null;
  reviewer?: User | null;
  found_report_summary?: any;
}

export type HandoverStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface CustodyRecord {
  id: number;
  report_id: number;
  item_id?: number | null;
  previous_custodian_id?: number | null;
  new_custodian_id: number;
  transferred_by_user_id: number;
  received_by_user_id?: number | null;
  storage_location_id?: number | null;
  handover_status: HandoverStatus;
  handover_notes?: string | null;
  transferred_at: string;
  acknowledged_at?: string | null;
  previous_custodian?: User | null;
  new_custodian?: User | null;
  transferred_by?: User | null;
  received_by?: User | null;
  storage_location?: StorageLocation | null;
}

export type VerificationMethod =
  | 'STUDENT_ID_CARD'
  | 'GOVERNMENT_PHOTO_ID'
  | 'PRIVATE_FEATURE_PROOF'
  | 'SERIAL_NUMBER_OR_INVOICE'
  | 'DEVICE_PASSCODE_UNLOCK'
  | 'FACULTY_ATTESTATION';

export interface ReturnRecord {
  id: number;
  report_id: number;
  item_id?: number | null;
  claim_id: number;
  released_by_teacher_id: number;
  collected_by_student_id: number;
  verification_method: VerificationMethod;
  returned_at: string;
  notes?: string | null;
  releasing_teacher?: User | null;
  collecting_student?: User | null;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  link_url?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SystemStats {
  total_lost_reports: number;
  total_found_reports: number;
  total_returned_items: number;
  active_in_custody: number;
  pending_claims: number;
  suggested_matches: number;
  total_students: number;
  total_teachers: number;
  recovery_rate_percent: number;
  average_resolution_days: number;
}

export interface ModelHealth {
  engine_name: string;
  version: string;
  status: string;
  feature_dimensions: number;
  indexed_images_count: number;
  last_inference_time_ms: number;
}

export interface AuditLog {
  id: number;
  actor_user_id?: number | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  timestamp: string;
  change_metadata?: Record<string, any> | null;
  ip_address?: string | null;
  actor?: User | null;
}
