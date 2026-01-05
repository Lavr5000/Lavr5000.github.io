"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchProject, fetchTask } from "@/lib/api";
import { useProjectTasks, useUploadDocument } from "@/hooks/useTasks";
import { Project } from "@/types/project";
import { TaskStatus, Task, ParsedData } from "@/types/task";
import { Button } from "@/components/ui/button";
import { ParsedDataModal } from "@/components/ParsedDataModal";

const STATUS_COLORS: Record<TaskStatus, string> = {
  queued: "bg-slate-100 text-slate-700",
  processing: "bg-blue-100 text-blue-700",
  parsing: "bg-yellow-100 text-yellow-700",
  analyzing: "bg-purple-100 text-purple-700",
  searching_certificates: "bg-indigo-100 text-indigo-700",
  generating: "bg-orange-100 text-orange-700",
  packaging: "bg-pink-100 text-pink-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  waiting_user: "bg-amber-100 text-amber-700",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "В очереди",
  processing: "Обработка",
  parsing: "Парсинг",
  analyzing: "Анализ",
  searching_certificates: "Поиск сертификатов",
  generating: "Генерация",
  packaging: "Упаковка",
  completed: "Завершено",
  failed: "Ошибка",
  waiting_user: "Ожидание",
};

// Status order for progress bar
const STATUS_ORDER: TaskStatus[] = [
  "queued",
  "processing",
  "parsing",
  "analyzing",
  "searching_certificates",
  "generating",
  "packaging",
  "completed",
];

function getTaskProgress(task: Task): { current: number; total: number; percentage: number } {
  if (task.status === "failed") return { current: 0, total: STATUS_ORDER.length, percentage: 0 };
  if (task.status === "completed") return { current: STATUS_ORDER.length, total: STATUS_ORDER.length, percentage: 100 };

  const currentIndex = STATUS_ORDER.indexOf(task.status);
  return {
    current: currentIndex + 1,
    total: STATUS_ORDER.length,
    percentage: Math.round(((currentIndex + 1) / STATUS_ORDER.length) * 100),
  };
}

function isActiveStatus(status: TaskStatus): boolean {
  return !["completed", "failed", "queued"].includes(status);
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [selectedTaskData, setSelectedTaskData] = useState<ParsedData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);

  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(params.id as string);
  const uploadDocument = useUploadDocument(params.id as string);

  useEffect(() => {
    if (params.id) {
      fetchProject(params.id as string)
        .then(setProject)
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [params.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    uploadDocument.mutate(file, {
      onError: (err) => setUploadError(err.message),
      onSuccess: () => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
    });
  };

  const handleShowResults = async (taskId: number) => {
    setLoadingTaskId(taskId);
    try {
      const task = await fetchTask(taskId.toString());
      if (task.parsed_data) {
        setSelectedTaskData(task.parsed_data);
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch task data:", err);
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTaskData(null);
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Загрузка...</div>;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Ошибка: {error}
          </div>
          <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-blue-600 hover:underline mb-4 inline-block">
            ← Назад к проектам
          </button>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.customer && <p className="text-slate-600 mt-2">Заказчик: {project.customer}</p>}
          {project.address && <p className="text-slate-500 mt-1">Адрес: {project.address}</p>}
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Загрузить документ</h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploadDocument.isPending}
            />
            <p className="text-xs text-slate-500 mt-2">
              {uploadDocument.isPending ? "Загрузка файла..." : "Поддерживаются файлы Excel (.xlsx, .xls)"}
            </p>
          </div>
          {uploadError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {uploadError}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Задачи обработки</h2>
            {tasks && tasks.some(t => isActiveStatus(t.status)) && (
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <Spinner />
                Обработка...
              </span>
            )}
          </div>
          <div className="p-6">
            {tasksLoading ? (
              <div className="text-center py-8 text-slate-500">Загрузка задач...</div>
            ) : tasks && tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const progress = getTaskProgress(task);
                  const isActive = isActiveStatus(task.status);
                  const isFailed = task.status === "failed";
                  const isCompleted = task.status === "completed";

                  return (
                    <div key={task.id} className={`border rounded-lg p-4 ${isActive ? "border-blue-200 bg-blue-50/30" : "border-slate-200"}`}>
                      {/* Task header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {isActive && <Spinner />}
                          <span className="text-sm text-slate-500">Задача #{task.id}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        {isCompleted && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowResults(task.id)}
                            disabled={loadingTaskId === task.id}
                          >
                            {loadingTaskId === task.id ? "Загрузка..." : "Показать результаты"}
                          </Button>
                        )}
                      </div>

                      {/* File name */}
                      {task.input_file_path && (
                        <p className="text-sm text-slate-600 mb-3">
                          Файл: {task.input_file_path.split("/").pop()}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Прогресс</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isFailed ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Error message */}
                      {task.error_message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                          {task.error_message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>Нет задач</p>
                <p className="text-sm mt-1">Загрузите документ для создания задачи обработки</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Parsed Data Modal */}
      <ParsedDataModal
        data={selectedTaskData}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </main>
  );
}
