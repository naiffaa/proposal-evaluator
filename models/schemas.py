from dataclasses import dataclass
from typing import List


@dataclass
class EvaluationCriterion:
    name: str
    description: str
    weight: float
    mandatory: bool


@dataclass
class CriterionEvaluation:
    criterion: str
    score: float
    rationale: str
    strengths: List[str]
    gaps: List[str]
    evidence: List[str]


@dataclass
class VendorEvaluation:
    vendor_name: str
    overall_score: float
    risk_level: str
    recommendation: str
    evaluations: List[CriterionEvaluation]