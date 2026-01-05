"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002";

interface Provider {
  id: string;
  name: string;
  description: string;
  available: boolean;
}

interface ParseResult {
  provider: string;
  model: string;
  works_count: number;
  materials_count: number;
  confidence: number;
  cost_usd: number;
  time_ms: number;
  works: Array<{
    code: string;
    description: string;
    quantity: number;
    unit: string;
  }>;
  materials: Array<{
    code: string;
    description: string;
    quantity: number;
    unit: string;
  }>;
}

interface TestResponse {
  file_info: {
    name: string;
    size_kb: number;
    rows: number;
    columns: number;
    rows_before_filter: number;
    rows_after_filter: number;
    rows_removed: number;
  };
  results: {
    [key: string]: ParseResult;
  };
  errors: {
    [key: string]: string;
  };
}

interface TestHistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  fileSizeKb: number;
  provider: string;
  status: 'success' | 'error';
  worksCount: number;
  materialsCount: number;
  costUsd: number;
  timeMs: number;
  rowsFiltered: number;
  error?: string;
  results?: TestResponse; // Store full results
}

export default function AITestingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("deepseek");
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TestHistoryItem | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      console.log('[FILE] Selected:', selected.name);
    }
  };

  const handleTest = async () => {
    if (!file) {
      console.log('[TEST] No file selected');
      return;
    }

    console.log('[TEST] Starting test with provider:', selectedProvider);

    setLoading(true);
    setResult(null); // Clear previous results

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", selectedProvider);

      console.log('[TEST] Sending request to:', `${API_URL}/api/v1/ai-testing/test-parse`);

      const response = await fetch(`${API_URL}/api/v1/ai-testing/test-parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TestResponse = await response.json();
      console.log('[TEST] Response received');
      console.log('[TEST] Results keys:', Object.keys(data.results));
      console.log('[TEST] Results:', data.results);

      setResult(data);
      saveToHistory(data, 'success');
    } catch (error) {
      console.error('[TEST] Error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert("Ошибка при тестировании: " + errorMsg);

      // Save error to history
      if (file) {
        const errorData: TestResponse = {
          file_info: {
            name: file.name,
            size_kb: file.size / 1024,
            rows: 0,
            columns: 0,
            rows_before_filter: 0,
            rows_after_filter: 0,
            rows_removed: 0
          },
          results: {},
          errors: {}
        };
        saveToHistory(errorData, 'error', errorMsg);
      }
    } finally {
      setLoading(false);
      console.log('[TEST] Test complete');
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/ai-testing/providers`);
      const data: Provider[] = await response.json();
      setProviders(data);
      console.log('[PROVIDERS] Loaded:', data);
    } catch (error) {
      console.error('[PROVIDERS] Error:', error);
    }
  };

  const loadTestHistory = () => {
    try {
      const saved = localStorage.getItem('ai-test-history');
      if (saved) {
        const history: TestHistoryItem[] = JSON.parse(saved);
        setTestHistory(history);
        console.log('[HISTORY] Loaded:', history.length, 'items');
      }
    } catch (error) {
      console.error('[HISTORY] Error loading:', error);
    }
  };

  const saveToHistory = (data: TestResponse, status: 'success' | 'error', errorMsg?: string) => {
    const providerKey = Object.keys(data.results)[0];
    const providerResult = data.results[providerKey];

    const historyItem: TestHistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      fileName: data.file_info.name,
      fileSizeKb: data.file_info.size_kb,
      provider: providerKey,
      status: status,
      worksCount: providerResult?.works_count || 0,
      materialsCount: providerResult?.materials_count || 0,
      costUsd: providerResult?.cost_usd || 0,
      timeMs: providerResult?.time_ms || 0,
      rowsFiltered: data.file_info.rows_removed || 0,
      error: errorMsg,
      results: status === 'success' ? data : undefined // Store full results for successful tests
    };

    const newHistory = [historyItem, ...testHistory].slice(0, 50);
    setTestHistory(newHistory);
    localStorage.setItem('ai-test-history', JSON.stringify(newHistory));
    console.log('[HISTORY] Saved:', historyItem);
  };

  const clearHistory = () => {
    if (confirm('Очистить всю историю тестов?')) {
      setTestHistory([]);
      localStorage.removeItem('ai-test-history');
      console.log('[HISTORY] Cleared');
    }
  };

  const viewResults = (item: TestHistoryItem) => {
    setSelectedHistoryItem(item);
    setShowResultsModal(true);
  };

  const copyResultsToClipboard = () => {
    if (!selectedHistoryItem?.results) return;

    const results = selectedHistoryItem.results;
    const providerKey = Object.keys(results.results)[0];
    const providerResult = results.results[providerKey];

    // Calculate filter percentage
    const rowsBefore = results.file_info.rows_before_filter || results.file_info.rows || 0;
    const rowsAfter = results.file_info.rows_after_filter || results.file_info.rows || 0;
    const rowsRemoved = results.file_info.rows_removed || 0;
    const filterPercent = rowsBefore > 0 ? ((rowsRemoved / rowsBefore) * 100).toFixed(1) : '0.0';

    const text = `
=== AI PARSING RESULTS ===
File: ${results.file_info.name}
Date: ${new Date(selectedHistoryItem.timestamp).toLocaleString('ru-RU')}
Provider: ${providerKey}
Status: ${selectedHistoryItem.status}

--- FILE INFO ---
Size: ${results.file_info.size_kb.toFixed(2)} KB
Total rows: ${results.file_info.rows?.toLocaleString() || 'N/A'}
Columns: ${results.file_info.columns || 'N/A'}

--- FILTER STATS ---
Rows before filter: ${rowsBefore.toLocaleString()}
Rows after filter: ${rowsAfter.toLocaleString()}
Rows removed: ${rowsRemoved.toLocaleString()}
Filter efficiency: ${filterPercent}% reduction

--- RESULTS ---
Works found: ${providerResult?.works_count || 0}
Materials found: ${providerResult?.materials_count || 0}
Confidence: ${providerResult ? (providerResult.confidence * 100).toFixed(1) + '%' : 'N/A'}
Cost: $${providerResult?.cost_usd?.toFixed(4) || 'N/A'}
Time: ${providerResult?.time_ms || 0} ms

--- WORKS (${providerResult?.works?.length || 0}) ---
${providerResult?.works?.map((w, i) => `${i + 1}. ${w.code} - ${w.description} (${w.quantity} ${w.unit})`).join('\n') || 'None'}

--- MATERIALS (${providerResult?.materials?.length || 0}) ---
${providerResult?.materials?.map((m, i) => `${i + 1}. ${m.code} - ${m.description} (${m.quantity} ${m.unit})`).join('\n') || 'None'}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      alert('Результаты скопированы в буфер обмена!');
    });
  };

  const exportResultsAsJSON = () => {
    if (!selectedHistoryItem?.results) return;

    const json = JSON.stringify(selectedHistoryItem.results, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${selectedHistoryItem.fileName}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadProviders();
    loadTestHistory();
    console.log('[INIT] AI Testing page loaded');
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">AI Testing</h1>
        <p className="text-slate-600 mb-8">Тестирование различных AI моделей для парсинга КС-2 документов</p>

        {/* Provider Selection */}
        <div className="bg-blue-50 p-6 rounded-lg shadow-sm mb-6 border border-blue-200">
          <h2 className="text-lg font-semibold mb-4">Выбор модели для тестирования</h2>

          <div className="flex gap-4 flex-wrap items-center mb-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="provider"
                value="deepseek"
                checked={selectedProvider === "deepseek"}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  console.log('[PROVIDER] Changed to:', e.target.value);
                }}
                className="mr-2"
              />
              <span>DeepSeek-V3 (дешёвый)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="provider"
                value="openai"
                checked={selectedProvider === "openai"}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  console.log('[PROVIDER] Changed to:', e.target.value);
                }}
                className="mr-2"
                disabled={!providers.find(p => p.id === "openai")?.available}
              />
              <span className={!providers.find(p => p.id === "openai")?.available ? "text-slate-400" : ""}>
                OpenAI GPT-4o {providers.find(p => p.id === "openai")?.available ? "" : "(нет ключа)"}
              </span>
            </label>
          </div>

          <div className="p-3 bg-white rounded border border-blue-300">
            <p className="text-sm">
              <strong>Выбрано:</strong> <span className="text-lg font-bold text-blue-600">{selectedProvider.toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Парсинг данных</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Файл КС-2 (Excel)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {file && (
              <p className="text-sm text-slate-500 mt-1">
                Выбран: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleTest}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? "Тестирование..." : "Запустить тест"}
          </Button>
        </div>

        {/* File Info */}
        {result?.file_info && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4">Информация о файле</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500">Название</p>
                <p className="font-medium">{result.file_info.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Размер</p>
                <p className="font-medium">{result.file_info.size_kb.toFixed(1)} KB</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Всего строк</p>
                <p className="font-medium">{result.file_info.rows?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">До фильтрации</p>
                <p className="font-medium">{result.file_info.rows_before_filter?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">После фильтрации</p>
                <p className="font-medium text-green-600">{result.file_info.rows_after_filter?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Удалено (без кодов)</p>
                <p className="font-medium text-orange-600">-{result.file_info.rows_removed?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && Object.keys(result.results).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4">Результаты</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {Object.entries(result.results).map(([providerKey, providerResult]) => (
                <div key={providerKey} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">
                    {providerResult.model}
                    <span className="text-sm font-normal text-slate-500 ml-2">
                      ({providerKey})
                    </span>
                  </h3>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-xs text-slate-500">Работ</p>
                      <p className="text-2xl font-bold text-blue-600">{providerResult.works_count}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs text-slate-500">Материалов</p>
                      <p className="text-2xl font-bold text-green-600">{providerResult.materials_count}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-xs text-slate-500">Уверенность</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {(providerResult.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-xs text-slate-500">Стоимость</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        ${providerResult.cost_usd.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Works Preview */}
                  {providerResult.works.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Первые работы:</h4>
                      <div className="space-y-1 text-sm">
                        {providerResult.works.slice(0, 5).map((work, idx) => (
                          <div key={idx} className="text-slate-600">
                            <span className="font-mono text-xs">{work.code}</span> - {work.description.slice(0, 40)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Materials Preview */}
                  {providerResult.materials.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Первые материалы:</h4>
                      <div className="space-y-1 text-sm">
                        {providerResult.materials.slice(0, 5).map((mat, idx) => (
                          <div key={idx} className="text-slate-600">
                            <span className="font-mono text-xs">{mat.code}</span> - {mat.description.slice(0, 40)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {result && Object.keys(result.errors).length > 0 && (
          <div className="bg-red-50 p-6 rounded-lg border border-red-200">
            <h2 className="text-lg font-semibold text-red-800 mb-3">Ошибки</h2>
            {Object.entries(result.errors).map(([providerKey, error]) => (
              <div key={providerKey} className="text-red-700">
                <strong>{providerKey}:</strong> {error}
              </div>
            ))}
          </div>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">История тестов ({testHistory.length})</h2>
              <button
                onClick={clearHistory}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Очистить историю
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3">Дата/Время</th>
                    <th className="text-left py-2 px-3">Файл</th>
                    <th className="text-left py-2 px-3">Provider</th>
                    <th className="text-center py-2 px-3">Статус</th>
                    <th className="text-center py-2 px-3">Работ</th>
                    <th className="text-center py-2 px-3">Мат-лов</th>
                    <th className="text-right py-2 px-3">Стоимость ($)</th>
                    <th className="text-right py-2 px-3">Время (мс)</th>
                    <th className="text-center py-2 px-3">Фильтр</th>
                    <th className="text-center py-2 px-3">Результаты</th>
                  </tr>
                </thead>
                <tbody>
                  {testHistory.map((item, index) => (
                    <tr key={item.id} className={`border-b border-slate-100 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">{item.fileName}</div>
                        <div className="text-xs text-slate-500">{item.fileSizeKb.toFixed(1)} KB</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                          {item.provider}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'success' ? (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            ✓ OK
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium" title={item.error}>
                            ✗ Ошибка
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-blue-600">
                        {item.worksCount}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-green-600">
                        {item.materialsCount}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        ${item.costUsd.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {item.timeMs.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.rowsFiltered > 0 ? (
                          <span className="text-orange-600 font-medium">-{item.rowsFiltered}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'success' && item.results ? (
                          <button
                            onClick={() => viewResults(item)}
                            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                          >
                            📄 Отчет
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Modal */}
        {showResultsModal && selectedHistoryItem?.results && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Результаты парсинга</h2>
                  <button
                    onClick={() => setShowResultsModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {selectedHistoryItem.fileName} • {new Date(selectedHistoryItem.timestamp).toLocaleString('ru-RU')}
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {(() => {
                  const results = selectedHistoryItem.results;
                  const providerKey = Object.keys(results.results)[0];
                  const providerResult = results.results[providerKey];

                  // Calculate filter percentage
                  const rowsBefore = results.file_info.rows_before_filter || results.file_info.rows || 0;
                  const rowsAfter = results.file_info.rows_after_filter || results.file_info.rows || 0;
                  const rowsRemoved = results.file_info.rows_removed || 0;
                  const filterPercent = rowsBefore > 0 ? ((rowsRemoved / rowsBefore) * 100).toFixed(1) : '0.0';

                  return (
                    <div>
                      {/* File Info & Filter Stats */}
                      <div className="bg-slate-50 rounded-lg p-4 mb-6">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Информация о файле и фильтрации</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Файл</p>
                            <p className="font-medium">{results.file_info.name}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Размер</p>
                            <p className="font-medium">{results.file_info.size_kb.toFixed(1)} KB</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Всего строк</p>
                            <p className="font-medium">{results.file_info.rows?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Столбцов</p>
                            <p className="font-medium">{results.file_info.columns || 0}</p>
                          </div>
                        </div>

                        {/* Filter Progress */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-700">Фильтрация строк</span>
                            <span className="text-sm font-bold text-orange-600">
                              -{rowsRemoved.toLocaleString()} строк ({filterPercent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                            <div className="flex h-full">
                              <div
                                className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                                style={{ width: `${100 - parseFloat(filterPercent)}%` }}
                                title={`Осталось: ${rowsAfter.toLocaleString()}`}
                              >
                                {rowsAfter > 0 && `${100 - parseFloat(filterPercent)}%`}
                              </div>
                              <div
                                className="bg-orange-500 flex items-center justify-center text-xs text-white font-medium"
                                style={{ width: `${filterPercent}%` }}
                                title={`Удалено: ${rowsRemoved.toLocaleString()}`}
                              >
                                {rowsRemoved > 0 && `${filterPercent}%`}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>{rowsBefore.toLocaleString()} до</span>
                            <span>{rowsAfter.toLocaleString()} после</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-slate-500">Работ</p>
                          <p className="text-2xl font-bold text-blue-600">{providerResult?.works_count || 0}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-xs text-slate-500">Материалов</p>
                          <p className="text-2xl font-bold text-green-600">{providerResult?.materials_count || 0}</p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded">
                          <p className="text-xs text-slate-500">Стоимость</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            ${providerResult?.cost_usd?.toFixed(4) || '0.0000'}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-xs text-slate-500">Время</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {providerResult?.time_ms?.toLocaleString() || '0'} ms
                          </p>
                        </div>
                      </div>

                      {/* Works */}
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">Работы ({providerResult?.works?.length || 0})</h3>
                        <div className="bg-slate-50 rounded p-4 max-h-60 overflow-y-auto">
                          {providerResult?.works && providerResult.works.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2">Код</th>
                                  <th className="text-left py-2">Описание</th>
                                  <th className="text-right py-2">Кол-во</th>
                                  <th className="text-left py-2">Ед. изм</th>
                                </tr>
                              </thead>
                              <tbody>
                                {providerResult.works.map((work, idx) => (
                                  <tr key={idx} className="border-b border-slate-100">
                                    <td className="py-2 font-mono text-xs">{work.code}</td>
                                    <td className="py-2">{work.description}</td>
                                    <td className="py-2 text-right">{work.quantity}</td>
                                    <td className="py-2">{work.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-slate-500">Нет данных</p>
                          )}
                        </div>
                      </div>

                      {/* Materials */}
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">Материалы ({providerResult?.materials?.length || 0})</h3>
                        <div className="bg-slate-50 rounded p-4 max-h-60 overflow-y-auto">
                          {providerResult?.materials && providerResult.materials.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2">Код</th>
                                  <th className="text-left py-2">Описание</th>
                                  <th className="text-right py-2">Кол-во</th>
                                  <th className="text-left py-2">Ед. изм</th>
                                </tr>
                              </thead>
                              <tbody>
                                {providerResult.materials.map((mat, idx) => (
                                  <tr key={idx} className="border-b border-slate-100">
                                    <td className="py-2 font-mono text-xs">{mat.code}</td>
                                    <td className="py-2">{mat.description}</td>
                                    <td className="py-2 text-right">{mat.quantity}</td>
                                    <td className="py-2">{mat.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-slate-500">Нет данных</p>
                          )}
                        </div>
                      </div>

                      {/* JSON Preview */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">JSON (для Claude)</h3>
                        <div className="bg-slate-900 text-green-400 rounded p-4 max-h-60 overflow-y-auto">
                          <pre className="text-xs">
                            {JSON.stringify(providerResult || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
                <button
                  onClick={copyResultsToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  📋 Копировать
                </button>
                <button
                  onClick={exportResultsAsJSON}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  💾 Скачать JSON
                </button>
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
