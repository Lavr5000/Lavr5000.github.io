import { Project, CreateProjectInput } from "@/types/project";
import { Task, TaskCreateResponse } from "@/types/task";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_URL}/api/v1/projects`);
  if (!response.ok) throw new Error("Failed to fetch projects");
  return response.json();
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`${API_URL}/api/v1/projects/${id}`);
  if (!response.ok) throw new Error("Failed to fetch project");
  return response.json();
}

export async function createProject(data: CreateProjectInput): Promise<Project> {
  const response = await fetch(`${API_URL}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create project");
  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/projects/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete project");
}

export async function uploadDocument(projectId: string, file: File): Promise<TaskCreateResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/v1/upload/projects/${projectId}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload document");
  return response.json();
}

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/tasks`);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

export async function fetchTask(taskId: string): Promise<Task> {
  const response = await fetch(`${API_URL}/api/v1/tasks/${taskId}`);
  if (!response.ok) throw new Error("Failed to fetch task");
  return response.json();
}
