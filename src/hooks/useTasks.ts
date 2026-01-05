import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjectTasks, uploadDocument, fetchTask } from "@/lib/api";

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: () => fetchProjectTasks(projectId),
    enabled: !!projectId,
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["tasks", taskId],
    queryFn: () => fetchTask(taskId),
    enabled: !!taskId,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadDocument(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
    },
  });
}
