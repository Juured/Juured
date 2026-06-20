"use client";

type Plan = { name: string; maxFloors: number };

export function PlaneeringuRadar({ plans }: { plans: Plan[] | null }) {
  if (plans == null) return null;
  if (plans.length === 0) {
    return (
      <div className="mx-4 my-2 px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 text-[10.5px] flex items-center gap-2 text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" aria-hidden="true" />
        <span>Planeeringuid lähedal ei ole</span>
      </div>
    );
  }
  const maxFloor = plans.reduce((m, p) => Math.max(m, p.maxFloors ?? 0), 0);
  if (maxFloor >= 5) {
    return (
      <div className="mx-4 my-2 px-2.5 py-1.5 border border-red-200 bg-red-50 text-[10.5px] flex items-center gap-2 text-red-900">
        <span className="w-1.5 h-1.5 rounded-full bg-red-800" aria-hidden="true" />
        <span>Uus {maxFloor}-korruseline plaanitakse lähedale</span>
      </div>
    );
  }
  return (
    <div className="mx-4 my-2 px-2.5 py-1.5 border border-amber-200 bg-amber-50 text-[10.5px] flex items-center gap-2 text-amber-900">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-700" aria-hidden="true" />
      <span>{plans.length} madal planeering 500 m raadiuses</span>
    </div>
  );
}
