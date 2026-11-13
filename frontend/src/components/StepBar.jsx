import React from "react";
import { Check, ChevronRight } from "lucide-react";

const STEPS = [
  { id: "home",     num: 1, label: "Load" },
  { id: "review",   num: 2, label: "Check claims" },
  { id: "handover", num: 3, label: "Handover" },
  { id: "backtest", num: 4, label: "Test it" },
];

export default function StepBar({ activeTab, setActiveTab }) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeTab);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-14 z-20 shadow-xs no-print">
      <div className="max-w-5xl mx-auto px-4 py-2.5">
        <nav aria-label="Progress" className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((step, idx) => {
            const isActive = step.id === activeTab;
            const isDone   = idx < activeIdx;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveTab(step.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[15px] font-bold transition-all cursor-pointer truncate ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200"
                      : isDone
                      ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                      : "bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                  }`}
                  title={`Step ${step.num}: ${step.label}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isActive
                        ? "bg-white/25 text-white"
                        : isDone
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </span>
                  <span className="truncate">{step.label}</span>
                </button>

                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
