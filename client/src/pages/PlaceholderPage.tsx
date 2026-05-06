// client/src/pages/PlaceholderPage.tsx

import { useState } from "react";
import { CheckCircle2, Construction } from "lucide-react";
import { trackEvent } from "../lib/firebase";

type PlaceholderPageProps = {
  title: string;
};

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  const [message, setMessage] = useState("");

  async function handleAction(action: string) {
    const finalMessage = `${action} started for ${title}. This click was tracked in Firebase.`;
    setMessage(finalMessage);

    await trackEvent("module_button_clicked", {
      module: title,
      action,
    });
  }

  return (
    <div className="sf-card p-8">
      <Construction className="mb-4 text-blue-700" size={36} />

      <h2 className="text-3xl font-black">{title}</h2>

      <p className="mt-3 max-w-3xl text-slate-600">
        This module is clickable and ready for the next production sprint. The
        schema already supports this area.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {["Open analysis", "Export report", "Create action"].map((button) => (
          <button
            key={button}
            type="button"
            onClick={() => handleAction(button)}
            className="sf-button sf-secondary"
          >
            {button}
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
          <CheckCircle2 size={22} />
          {message}
        </div>
      )}
    </div>
  );
}