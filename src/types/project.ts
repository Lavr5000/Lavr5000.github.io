export interface Project {
  id: string;
  name: string;
  customer?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  customer?: string;
  address?: string;
}
