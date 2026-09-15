'use client';

import { useRouter, usePathname } from 'next/navigation';

export function WarehouseFilters({ cities, selectedCity, selectedMonth }: { cities: string[]; selectedCity: string; selectedMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function update(next: { city?: string; month?: string }) {
    const params = new URLSearchParams({ city: next.city ?? selectedCity, month: next.month ?? selectedMonth });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 items-center">
      <select className="input-field w-40" value={selectedCity} onChange={(e) => update({ city: e.target.value })}>
        <option value="EGY">EGY (All Egypt)</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input type="month" className="input-field w-40" value={selectedMonth} onChange={(e) => update({ month: e.target.value })} />
    </div>
  );
}
