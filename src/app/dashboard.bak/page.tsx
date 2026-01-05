"use client";

import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Project } from "@/types/project";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 100;

export default function DashboardPage() {
  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [validationError, setValidationError] = useState("");

  const validateName = (value: string): string => {
    if (value.length < MIN_NAME_LENGTH) {
      return `Название должно содержать минимум ${MIN_NAME_LENGTH} символа`;
    }
    if (value.length > MAX_NAME_LENGTH) {
      return `Название не может превышать ${MAX_NAME_LENGTH} символов`;
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    const error = validateName(name);
    if (error) {
      setValidationError(error);
      return;
    }

    createProject.mutate(
      { name, customer: customer || undefined },
      {
        onSuccess: () => {
          setName("");
          setCustomer("");
        },
      }
    );
  };

  const handleDelete = (projectId: string, projectName: string) => {
    if (confirm(`Удалить проект "${projectName}"? Все связанные задачи будут удалены.`)) {
      deleteProject.mutate(projectId);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Загрузка...</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Проекты</h1>

        {/* Error states */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Ошибка загрузки проектов: {error.message}
          </div>
        )}

        {createProject.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Ошибка создания проекта: {createProject.error.message}
          </div>
        )}

        {validationError && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
            {validationError}
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleSubmit} className="mb-8 flex gap-4 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError("");
              }}
              placeholder="Название проекта"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={MIN_NAME_LENGTH}
              maxLength={MAX_NAME_LENGTH}
            />
            <p className="text-xs text-slate-500 mt-1">
              От {MIN_NAME_LENGTH} до {MAX_NAME_LENGTH} символов
            </p>
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Заказчик (опционально)"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? "Создание..." : "Создать"}
          </Button>
        </form>

        {/* Projects list */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project: Project) => (
            <div key={project.id} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow relative group">
              {/* Delete button - top right corner */}
              <button
                onClick={() => handleDelete(String(project.id), project.name)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="Удалить проект"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>

              <h3 className="font-semibold text-lg mb-2 pr-8">{project.name}</h3>
              {project.customer && (
                <p className="text-slate-600 text-sm mb-1">Заказчик: {project.customer}</p>
              )}
              {project.address && (
                <p className="text-slate-500 text-sm mb-4">Адрес: {project.address}</p>
              )}
              <a
                href={`/projects/${project.id}`}
                className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm"
              >
                Открыть →
              </a>
            </div>
          ))}
        </div>

        {projects?.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>Нет проектов. Создайте первый проект выше.</p>
          </div>
        )}
      </div>
    </main>
  );
}
