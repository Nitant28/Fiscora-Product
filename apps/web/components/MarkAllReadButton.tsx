"use client";

export default function MarkAllReadButton() {
  async function handleClick() {
    await fetch("/api/proxy/notifications/read-all", {
      method: "PATCH",
    });
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Mark all read
    </button>
  );
}
