import React from "react";
import { Check, ChevronRight } from "lucide-react";

const STEPS = [
  { id: "home", num: 1, label: "Load" },
  { id: "review", num: 2, label: "Check claims" },
  { id: "handover", num: 3, label: "Handover" },
  { id: "backtest", num: 4, label: "Test it" },
];

export default function StepBar({ activeTab, setActiveTab }) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeTab);

  return (
    <div className="bg-white border-b border-[#e2e8f0] sticky top-16 z-30 shadow-2xs no-print">
      <div className="max-w-5xl mx-auto px-4 py-2">
        <nav aria-label="Progress" className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((step, idx) => {
            const isActive = step.id === activeTab;
            const isDone = idx < activeIdx;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveTab(step.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer truncate ${
                    isActive
                      ? "bg-[#004ac6] text-white shadow-2xs"
                      : isDone
                      ? "bg-[#ecfdf5] text-[#059669] hover:bg-[#d1fae5] border border-[#a7f3d0]"
                      : "bg-[#f8f9ff] text-[#64748b] hover:text-[#0b1c30] hover:bg-[#f1f5f9] border border-[#e2e8f0]"
                  }`}
                  title={`Step ${step.num}: ${step.label}`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isDone
                        ? "bg-[#a7f3d0] text-[#065f46]"
                        : "bg-[#e2e8f0] text-[#475569]"
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3 text-[#065f46]" /> : step.num}
                  </span>
                  <span className="truncate">{step.label}</span>
                </button>

                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
