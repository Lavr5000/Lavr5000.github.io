import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50 mb-6">
            АвтоДок
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-4">
            Автоматическое формирование комплекта исполнительной документации
          </p>
          <p className="text-base text-slate-500 dark:text-slate-500 mb-12 max-w-2xl mx-auto">
            Загрузите акт выполненных работ и получите полный комплект документов:
            КС-2, КС-3, акты скрытых работ, исполнительные схемы и другие документы
            по нормативным требованиям
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Перейти к проектам
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/ai-testing">
                AI Testing
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs">
                Документация
              </Link>
            </Button>
          </div>

          <div className="mt-20 grid gap-8 md:grid-cols-3 text-left">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-slate-50">Автоматический анализ</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                AI анализирует загруженный документ и определяет необходимые виды работ и материалы
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-slate-50">Нормативный контроль</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Подбор сертификатов и допусков согласно актуальным нормативным требованиям
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-slate-900 dark:text-slate-50">Экспорт документов</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Формирование комплекта документов в форматах PDF, DOCX, XLSX
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
