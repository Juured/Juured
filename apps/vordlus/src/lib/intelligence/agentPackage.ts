import type { ProfilePolicy } from "./profiles";
import type { AppliedRiskRule } from "./riskRules";
import type { PersonalizedScoreResult } from "./scoring";
import type { EvidenceFact, MetricResult } from "./types";
import {
  isVisualizationViewModel,
  type VisualizationViewModel,
} from "./visualizations";

export type AgentListingSummary = {
  id: string;
  address: string;
  propertyType: string | null;
  askingPrice: number | null;
};

export type AgentEvidencePackage = {
  version: 1;
  generatedAt: string;
  listing: AgentListingSummary;
  evidence: EvidenceFact<unknown>[];
  metrics: MetricResult[];
  riskRules: AppliedRiskRule[];
  profilePolicy: ProfilePolicy;
  scores: PersonalizedScoreResult;
  visualizations: VisualizationViewModel[];
};

export type AgentPackageInput = Omit<AgentEvidencePackage, "version">;

export function buildAgentPackage(input: AgentPackageInput): AgentEvidencePackage {
  if (!input.visualizations.every(isVisualizationViewModel)) {
    throw new TypeError("Agent package contains an unregistered visualization");
  }

  return {
    version: 1,
    generatedAt: input.generatedAt,
    listing: {
      id: input.listing.id,
      address: input.listing.address,
      propertyType: input.listing.propertyType,
      askingPrice: input.listing.askingPrice,
    },
    evidence: input.evidence,
    metrics: input.metrics,
    riskRules: input.riskRules,
    profilePolicy: input.profilePolicy,
    scores: input.scores,
    visualizations: input.visualizations,
  };
}
