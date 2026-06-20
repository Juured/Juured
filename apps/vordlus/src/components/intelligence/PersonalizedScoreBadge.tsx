import type { UserProfile } from "@/lib/intelligence/profiles";

type Props = {
  profile: UserProfile;
  score: number;
  confidence: number;
};

export function PersonalizedScoreBadge({ profile, score, confidence }: Props) {
  return (
    <div className="border-b border-rule bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Sobivus sulle
          </p>
          <p className="mt-0.5 text-[10.5px] text-faint">
            {profile === "homebuyer" ? "Koduhuvilise kaalud" : "Investori kaalud"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[22px] leading-none text-ink">{Math.round(score)}/100</p>
          <p className="mt-1 font-mono text-[9.5px] text-muted">
            Kindlus {Math.round(confidence * 100)}%
          </p>
        </div>
      </div>
    </div>
  );
}
