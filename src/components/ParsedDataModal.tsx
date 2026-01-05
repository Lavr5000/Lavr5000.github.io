"use client";

import { useState } from "react";
import { ParsedData } from "@/types/task";
import { X } from "lucide-react";

interface ParsedDataModalProps {
  data: ParsedData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ParsedDataModal({ data, isOpen, onClose }: ParsedDataModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-semibold">Результаты обработки</h2>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Закрыть</span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          {!data ? (
            <p className="text-center text-muted-foreground">Нет данных</p>
          ) : (
            <Tabs data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

interface TabsProps {
  data: ParsedData;
}

function Tabs({ data }: TabsProps) {
  const [activeTab, setActiveTab] = useState<"works" | "materials" | "signatories">("works");

  const tabs = [
    { id: "works" as const, label: "Работы", count: data.works.length },
    { id: "materials" as const, label: "Материалы", count: data.materials.length },
    { id: "signatories" as const, label: "Подписанты", count: data.signatories.length },
  ];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "works" && <WorksTable works={data.works} />}
        {activeTab === "materials" && <MaterialsTable materials={data.materials} />}
        {activeTab === "signatories" && <SignatoriesTable signatories={data.signatories} />}
      </div>
    </div>
  );
}

function WorksTable({ works }: { works: Array<{ description: string; unit: string; quantity: number }> }) {
  if (works.length === 0) {
    return <p className="text-center text-muted-foreground">Нет работ</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">№</th>
            <th className="px-4 py-2 text-left font-medium">Описание</th>
            <th className="px-4 py-2 text-left font-medium">Ед. изм.</th>
            <th className="px-4 py-2 text-left font-medium">Кол-во</th>
          </tr>
        </thead>
        <tbody>
          {works.map((work, index) => (
            <tr key={index} className="border-b">
              <td className="px-4 py-2">{index + 1}</td>
              <td className="px-4 py-2">{work.description}</td>
              <td className="px-4 py-2">{work.unit}</td>
              <td className="px-4 py-2">{work.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialsTable({ materials }: { materials: Array<{ name: string; quantity: number; unit: string }> }) {
  if (materials.length === 0) {
    return <p className="text-center text-muted-foreground">Нет материалов</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">№</th>
            <th className="px-4 py-2 text-left font-medium">Название</th>
            <th className="px-4 py-2 text-left font-medium">Ед. изм.</th>
            <th className="px-4 py-2 text-left font-medium">Кол-во</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material, index) => (
            <tr key={index} className="border-b">
              <td className="px-4 py-2">{index + 1}</td>
              <td className="px-4 py-2">{material.name}</td>
              <td className="px-4 py-2">{material.unit}</td>
              <td className="px-4 py-2">{material.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignatoriesTable({ signatories }: { signatories: Array<{ role: string; org_name: string; director: string }> }) {
  if (signatories.length === 0) {
    return <p className="text-center text-muted-foreground">Нет подписантов</p>;
  }

  const roleLabels: Record<string, string> = {
    contractor: "Подрядчик",
    customer: "Заказчик",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">№</th>
            <th className="px-4 py-2 text-left font-medium">Роль</th>
            <th className="px-4 py-2 text-left font-medium">Организация</th>
            <th className="px-4 py-2 text-left font-medium">Директор</th>
          </tr>
        </thead>
        <tbody>
          {signatories.map((signatory, index) => (
            <tr key={index} className="border-b">
              <td className="px-4 py-2">{index + 1}</td>
              <td className="px-4 py-2">{roleLabels[signatory.role] || signatory.role}</td>
              <td className="px-4 py-2">{signatory.org_name}</td>
              <td className="px-4 py-2">{signatory.director}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
