type CalendarMonth = {
  month: string;
  monthKey: string;
  items: {
    id: number;
    title: string;
    vendorName: string;
    endDate: string;
    autoRenew: boolean;
  }[];
};

export default function RenewalCalendar({
  months,
}: {
  months: CalendarMonth[];
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        Renewal calendar
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Contract expiries grouped by month for renewal planning.
      </p>

      {months.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No upcoming renewals in the next 6 months.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <div
              key={month.monthKey}
              className="rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              <h3 className="font-semibold text-gray-900">
                {month.month}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {month.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-white px-3 py-2 shadow-sm"
                  >
                    <p className="font-medium">
                      {item.title}
                    </p>
                    <p className="text-gray-500">
                      {item.vendorName} ·{" "}
                      {new Date(
                        item.endDate
                      ).toLocaleDateString()}
                      {item.autoRenew
                        ? " · Auto renew"
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
