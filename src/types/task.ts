export type TaskStatus = "queued" | "processing" | "parsing" | "analyzing" | "searching_certificates" | "generating" | "packaging" | "completed" | "failed" | "waiting_user";

export interface Work {
  description: string;
  unit: string;
  quantity: number;
}

export interface Material {
  name: string;
  quantity: number;
  unit: string;
}

export interface Signatory {
  role: "contractor" | "customer";
  org_name: string;
  director: string;
}

export interface ParsedData {
  works: Work[];
  materials: Material[];
  signatories: Signatory[];
}

export interface Task {
  id: number;
  project_id: number;
  status: TaskStatus;
  input_file_path: string | null;
  output_file_path: string | null;
  parsed_data: ParsedData | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreateResponse {
  task_id: number;
  status: string;
  input_file_path: string;
}
