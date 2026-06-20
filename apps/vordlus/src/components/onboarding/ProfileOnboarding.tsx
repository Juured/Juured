"use client";

import { saveUserProfile } from "@/lib/intelligence/profileStore";
import type { UserProfile } from "@/lib/intelligence/profiles";

type Props = {
  profile: UserProfile | null;
  onSelect: (profile: UserProfile) => void;
};

const OPTIONS: {
  value: UserProfile;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    value: "homebuyer",
    label: "Ostan endale kodu",
    title: "Koduhuvilise vaade",
    description: "Rohkem kaalu saavad kulud, õiguslik kindlus, ohutus ja igapäevane sobivus.",
  },
  {
    value: "investor",
    label: "Investeerin",
    title: "Investeerimisvaade",
    description: "Rohkem kaalu saavad õiglane hind, tootlus, likviidsus ja kasvupotentsiaal.",
  },
];

export function ProfileOnboarding({ profile, onSelect }: Props) {
  const selected = OPTIONS.find((option) => option.value === profile);

  function select(nextProfile: UserProfile) {
    saveUserProfile(nextProfile);
    onSelect(nextProfile);
  }

  return (
    <section className="mt-5 border border-rule bg-paperDeep px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="max-w-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          Personaalne analüüs
        </p>
        <h2 className="mt-1 font-display text-[19px] text-ink">
          {selected?.title ?? "Millise eesmärgiga sa kinnisvara hindad?"}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {selected?.description ??
            "Objekti faktid ei muutu. Sinu valik muudab ainult hinnangu kaale ja seda, milliseid järeldusi esile tõstame."}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 border border-rule bg-paper sm:mt-0 sm:min-w-[330px]">
        {OPTIONS.map((option) => {
          const active = profile === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => select(option.value)}
              className={`min-h-11 px-3 py-2 text-[12px] font-medium transition-colors ${
                active
                  ? "bg-ink text-paper"
                  : "text-muted hover:bg-paperDeep hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
