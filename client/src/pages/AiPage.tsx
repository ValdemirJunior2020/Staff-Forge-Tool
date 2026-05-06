// client/src/pages/AiPage.tsx

import { useState } from "react";
import {
  Bot,
  ExternalLink,
  Laugh,
  Send,
  Sheet,
  Sparkles,
} from "lucide-react";
import { trackEvent } from "../lib/firebase";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1QZO61rBDUUbNH-lkWrmhgADjHraZkV4wfZ_cSo0MaD8/edit?usp=sharing";

const NO_AI_MESSAGE =
  "No money invested to make this Part of the project work 😜🤦‍♂️😜🤦‍♂️😜🤦‍♂️";

const suggestedQuestions = [
  "Which vendor is underutilized?",
  "Where are idle hours highest?",
  "Do we have staffing risk?",
  "What should I tell my boss?",
];

export default function AiPage() {
  const [question, setQuestion] = useState(
    "Where are we losing the most productivity?"
  );
  const [answer, setAnswer] = useState("");

  async function handleAskAi(selectedQuestion?: string) {
    const finalQuestion = selectedQuestion || question;

    setQuestion(finalQuestion);
    setAnswer(NO_AI_MESSAGE);

    await trackEvent("ai_question_attempted", {
      question: finalQuestion,
      message: NO_AI_MESSAGE,
    });
  }

  async function handleOpenSheet() {
    await trackEvent("google_sheet_opened_from_ai_page", {
      url: GOOGLE_SHEET_URL,
    });

    window.open(GOOGLE_SHEET_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-200">
          StaffForge AI Assistant
        </p>

        <h2 className="mt-4 text-4xl font-black">
          Ask questions about staffing, vendors, idle time, and utilization.
        </h2>

        <p className="mt-4 max-w-4xl text-slate-300">
          This is where the AI layer will answer leadership questions using the
          StaffForge Google Sheet data.
        </p>

        <button
          type="button"
          onClick={handleOpenSheet}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-slate-950 shadow-lg transition hover:bg-blue-50 active:scale-95"
        >
          <Sheet size={18} />
          Open Source Google Sheet
          <ExternalLink size={16} />
        </button>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <Bot />
            </div>

            <div>
              <h3 className="text-2xl font-black">StaffForge AI Assistant</h3>
              <p className="text-sm text-slate-500">
                This part is disabled until the company invests in the AI API.
              </p>
            </div>
          </div>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="min-h-32 w-full rounded-2xl border border-blue-500 p-4 outline-none focus:ring-4 focus:ring-blue-100"
            placeholder="Ask a workforce question..."
          />

          <div className="mt-4 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => handleAskAi()}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-95"
            >
              <Send size={18} />
              Ask StaffForge AI
            </button>

            <button
              type="button"
              onClick={handleOpenSheet}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-900 shadow-md transition hover:bg-slate-100 hover:shadow-lg active:scale-95"
            >
              <Sheet size={18} />
              Open Data Source
              <ExternalLink size={16} />
            </button>
          </div>

          {answer && (
            <div className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-6 text-orange-900">
              <div className="mb-3 flex items-center gap-3">
                <Laugh />
                <h4 className="text-xl font-black">AI Status</h4>
              </div>

              <p className="text-lg font-bold">{answer}</p>
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="text-blue-700" />
            <h3 className="text-xl font-black">Suggested questions</h3>
          </div>

          <div className="space-y-3">
            {suggestedQuestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleAskAi(item)}
                className="w-full rounded-2xl bg-slate-50 p-4 text-left font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">Data source</p>

            <button
              type="button"
              onClick={handleOpenSheet}
              className="mt-3 flex w-full items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 text-left font-black text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-95"
            >
              Staff-Forge Tool Sheet
              <ExternalLink size={18} />
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}