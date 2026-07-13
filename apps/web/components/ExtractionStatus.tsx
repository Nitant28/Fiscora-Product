"use client";

/**
 * ExtractionStatus
 * Purpose: Display OCR/worker extraction state on invoice detail.
 * Data: Props from document processing status.
 * Roles: invoice.view.
 */
export default function ExtractionStatus({
  extractionConfidence,
  notes = [],
}: {
  extractionConfidence: number | null;
  notes?: Array<{
    id: number;
    type: string;
    message: string;
  }>;
}) {
  const hasConfidence =
    extractionConfidence != null &&
    extractionConfidence > 0;

  if (!hasConfidence) {
    return null;
  }

  const confidence = Math.round(
    extractionConfidence
  );

  let level: "High" | "Medium" | "Low";
  let levelClass: string;

  if (confidence >= 90) {
    level = "High";
    levelClass =
      "border-green-200 bg-green-50 text-green-800";
  } else if (confidence >= 75) {
    level = "Medium";
    levelClass =
      "border-yellow-200 bg-yellow-50 text-yellow-800";
  } else {
    level = "Low";
    levelClass =
      "border-red-200 bg-red-50 text-red-800";
  }

  return (
    <div
      className={`rounded-xl border p-4 ${levelClass}`}
    >
      <p className="text-sm font-medium">
        Extraction Confidence: {level}
      </p>
      <p className="mt-1 text-xs opacity-80">
        Score: {confidence}/100
      </p>
      {notes.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-current/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Extraction notes
          </p>
          {notes.map((note) => (
            <p
              key={note.id}
              className="text-xs opacity-90"
            >
              {note.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
