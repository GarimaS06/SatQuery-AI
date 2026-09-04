from dataclasses import dataclass, field


@dataclass
class AnalysisResult:
    """Standard output schema for all Person B analysis functions.

    Every analysis tool (NDVI, NDWI, NDBI, change detection, etc.)
    returns an instance of this dataclass so that Person D's router
    and Person E's API can consume results in a uniform way.
    """

    success: bool
    analysis_type: str
    result: dict
    evidence: dict
    output_files: dict
    error: str = ""
    metadata: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """Return all fields as a plain Python dictionary."""
        return {
            "success": self.success,
            "analysis_type": self.analysis_type,
            "result": self.result,
            "evidence": self.evidence,
            "output_files": self.output_files,
            "error": self.error,
            "metadata": self.metadata,
            "warnings": self.warnings,
        }

