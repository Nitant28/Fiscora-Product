import Link from "next/link";

export default function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Fiscora Vendor Portal
            </p>
            <h1 className="text-lg font-bold text-gray-900">
              Supplier Workspace
            </h1>
          </div>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/vendor-portal/dashboard">
              Dashboard
            </Link>
            <Link href="/vendor-portal/profile">
              Profile
            </Link>
            <Link href="/vendor-portal/documents">
              Documents
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
