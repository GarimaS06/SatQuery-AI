import re

from ..domain.enums import Intent, Modality, TaskType
from ..domain.models import RoutingDecision
from .keywords import DIRECT_KEYWORDS, SYNONYMS
from .patterns import COMPOUND_PATTERNS


def normalize_question(question: str) -> str:
    """
    Normalize a user question before routing.

    Steps:
    1. Convert to lowercase.
    2. Replace hyphens with spaces.
    3. Replace punctuation with spaces.
    4. Collapse repeated whitespace.
    5. Strip leading/trailing whitespace.
    """

    question = question.lower()
    question = question.replace("-", " ")
    question = re.sub(r"[^\w\s]", " ", question)
    question = re.sub(r"\s+", " ", question)

    return question.strip()

def _contains_phrase(question: str, phrase: str) -> bool:
    """
    Check whether a complete word/phrase exists in the normalized question.
    """

    pattern = rf"\b{re.escape(phrase)}\b"
    return re.search(pattern, question) is not None

def _find_matches(question: str, vocabulary: dict) -> dict:
    """
    Find all vocabulary phrases present in the normalized question.
    """

    matches = {}

    for task_name, phrases in vocabulary.items():
        found = []

        for phrase in phrases:
            normalized_phrase = normalize_question(phrase)

            if _contains_phrase(question, normalized_phrase):
                found.append(normalized_phrase)

        if found:
            matches[task_name] = found

    return matches

def _get_direct_matches(question: str) -> dict:
    """
    Find explicit/direct routing keywords in the question.

    VQA keywords are intentionally excluded here because
    VQA is a fallback, not a priority match.
    """

    direct_keywords = {
    key: value
    for key, value in DIRECT_KEYWORDS.items()
    if key not in {"vqa"}
}

    return _find_matches(question, direct_keywords)

def _get_compound_matches(question: str) -> dict:
    """
    Find compound routing patterns in the question.
    """

    matches = {}

    for pattern_name, phrases in COMPOUND_PATTERNS.items():
        found = []

        for phrase in phrases:
            normalized_phrase = normalize_question(phrase)

            if _contains_phrase(question, normalized_phrase):
                found.append(normalized_phrase)

        if found:
            matches[pattern_name] = found

    return matches

def _get_synonym_matches(question: str) -> dict:
    """
    Find synonym-based routing signals in the question.
    """

    return _find_matches(question, SYNONYMS)

def _task_type(task_name: str) -> TaskType:
    """
    Convert an internal task name into TaskType.
    """

    return TaskType(task_name)

def _order_tasks(tasks: list[TaskType]) -> list[TaskType]:
    """
    Return tasks in a deterministic order.

    CHANGE_DETECTION always runs last.
    Other tasks follow TaskType enum declaration order.
    """

    task_order = {
    TaskType.NDVI: 0,
    TaskType.NDWI: 1,
    TaskType.NDBI: 2,
    TaskType.CHANGE_DETECTION: 3,
    TaskType.VQA: 4,
    TaskType.CAPTIONING: 5,
}

    return sorted(tasks, key=lambda task: task_order[task])

def _intent_for_tasks(tasks: list[TaskType]) -> Intent:
    """
    Determine the user's intent from the selected tasks.
    """

    if TaskType.VQA in tasks:
        return Intent.QUESTION_ANSWER

    if TaskType.CHANGE_DETECTION in tasks:
        return Intent.COMPARE

    return Intent.ANALYZE

def _modality_for_image2(has_image2: bool) -> Modality:
    """
    Determine modality from the presence of a second image.
    """

    if has_image2:
        return Modality.PAIRED_IMAGE

    return Modality.SINGLE_IMAGE

def _matches_to_task_types(matches: dict) -> list[TaskType]:
    """
    Convert matched task names into TaskType values.
    """

    tasks = []

    for task_name in matches:
        tasks.append(_task_type(task_name))

    return _order_tasks(tasks)

def _matched_keywords_for_tasks(matches: dict) -> dict[TaskType, list[str]]:
    """
    Convert matched task names into a TaskType-keyed dictionary.
    """

    return {
        _task_type(task_name): phrases
        for task_name, phrases in matches.items()
    }

def _build_decision(
    intent: Intent,
    tasks: list[TaskType],
    modality: Modality,
    matched_keywords: dict[TaskType, list[str]],
    matched_rule: str,
    confidence: float,
    ambiguous: bool = False,
    notes: list[str] | None = None,
) -> RoutingDecision:
    """
    Build a deterministic RoutingDecision.
    """

    return RoutingDecision(
        intent=intent,
        tasks=tasks,
        modality=modality,
        matched_keywords=matched_keywords,
        matched_rule=matched_rule,
        confidence=confidence,
        ambiguous=ambiguous,
        notes=notes or [],
    )

def route(question: str, has_image2: bool) -> RoutingDecision:
    """
    Route a user question to one or more specialist tasks.

    This function is pure:
    - no file I/O
    - no ML execution
    - no API calls
    """

    normalized_question = normalize_question(question)

    direct_matches = _get_direct_matches(normalized_question)
    compound_matches = _get_compound_matches(normalized_question)
    synonym_matches = _get_synonym_matches(normalized_question)

    modality = _modality_for_image2(has_image2)

    # ---------------------------------------------------------
    # Tier 1: literal compound patterns
    # ---------------------------------------------------------
    if compound_matches:
        tasks = []

        for pattern_name in compound_matches:
            if pattern_name == "vegetation_change":
                tasks.extend([
                    TaskType.NDVI,
                    TaskType.CHANGE_DETECTION,
                ])

            elif pattern_name == "water_change":
                tasks.extend([
                    TaskType.NDWI,
                    TaskType.CHANGE_DETECTION,
                ])

        tasks = _order_tasks(list(dict.fromkeys(tasks)))

        matched_keywords = {
            TaskType.CHANGE_DETECTION: ["change"]
        }

        for pattern_name, phrases in compound_matches.items():
            if pattern_name == "vegetation_change":
                matched_keywords[TaskType.NDVI] = phrases

            elif pattern_name == "water_change":
                matched_keywords[TaskType.NDWI] = phrases

        return _build_decision(
            intent=Intent.COMPARE,
            tasks=tasks,
            modality=modality,
            matched_keywords=matched_keywords,
            matched_rule=f"compound_pattern:{list(compound_matches)[0]}",
            confidence=0.90,
        )

    # ---------------------------------------------------------
    # Tier 2: direct keywords + compound interaction
    # ---------------------------------------------------------
    if direct_matches:
        change_signals = direct_matches.get(
            "change_detection",
            []
        )

        non_change_direct = {
            task_name: phrases
            for task_name, phrases in direct_matches.items()
            if task_name != "change_detection"
        }

        # Generic change/compare + multiple synonym signals.
        if (
            change_signals
            and len(non_change_direct) == 0
            and len(synonym_matches) >= 2
        ):
            synonym_tasks = _matches_to_task_types(
                synonym_matches
            )

            selected_task = synonym_tasks[0]

            tasks = _order_tasks([
                selected_task,
                TaskType.CHANGE_DETECTION,
            ])

            matched_keywords = {
                selected_task: synonym_matches.get(
                    selected_task.value,
                    []
                ),
                TaskType.CHANGE_DETECTION: change_signals,
            }

            return _build_decision(
                intent=Intent.COMPARE,
                tasks=tasks,
                modality=modality,
                matched_keywords=matched_keywords,
                matched_rule="change_with_multiple_signals",
                confidence=0.50,
                ambiguous=True,
                notes=[
                    "Multiple analysis signals matched with a "
                    "change signal; selected task using "
                    "deterministic enum order."
                ],
            )

        # Generic change/compare + exactly one synonym.
        if (
            change_signals
            and len(non_change_direct) == 0
            and len(synonym_matches) == 1
        ):
            tasks = _matches_to_task_types(
                synonym_matches
            )

            tasks.append(TaskType.CHANGE_DETECTION)
            tasks = _order_tasks(tasks)

            matched_keywords = _matched_keywords_for_tasks(
                synonym_matches
            )

            matched_keywords[
                TaskType.CHANGE_DETECTION
            ] = change_signals

            return _build_decision(
                intent=Intent.COMPARE,
                tasks=tasks,
                modality=modality,
                matched_keywords=matched_keywords,
                matched_rule="procedural_compound",
                confidence=0.90,
            )

        # Normal explicit/direct keyword routing.
        tasks = _matches_to_task_types(
            direct_matches
        )

        matched_keywords = _matched_keywords_for_tasks(
            direct_matches
        )

        notes = []

        # Direct keyword wins over unrelated synonyms.
        if synonym_matches:
            notes.append(
                f"Suppressed synonym matches: "
                f"{list(synonym_matches.keys())}"
            )

        return _build_decision(
            intent=_intent_for_tasks(tasks),
            tasks=tasks,
            modality=modality,
            matched_keywords=matched_keywords,
            matched_rule="direct_keyword",
            confidence=0.95,
            notes=notes,
        )

    # ---------------------------------------------------------
    # Tier 3: synonym-only routing
    # ---------------------------------------------------------
    if synonym_matches:
        tasks = _matches_to_task_types(
            synonym_matches
        )

        matched_keywords = _matched_keywords_for_tasks(
            synonym_matches
        )

        ambiguous = len(tasks) > 1
        confidence = 0.50 if ambiguous else 0.75

        notes = []

        if ambiguous:
            notes.append(
                "Multiple synonym signals matched; "
                "selected task using deterministic enum order."
            )

        return _build_decision(
            intent=_intent_for_tasks(tasks),
            tasks=tasks,
            modality=modality,
            matched_keywords=matched_keywords,
            matched_rule="synonym_match",
            confidence=confidence,
            ambiguous=ambiguous,
            notes=notes,
        )

    # ---------------------------------------------------------
    # Tier 4: VQA fallback
    # ---------------------------------------------------------
    return _build_decision(
        intent=Intent.QUESTION_ANSWER,
        tasks=[TaskType.VQA],
        modality=modality,
        matched_keywords={TaskType.VQA: []},
        matched_rule="vqa_fallback",
        confidence=0.30,
    )

def validate_decision(
    decision: RoutingDecision,
    has_image2: bool,
) -> None:
    """
    Validate whether the selected tasks can run
    with the available images.
    """

    if TaskType.CHANGE_DETECTION in decision.tasks and not has_image2:
        raise ValueError(
            "CHANGE_DETECTION requires a second image."
        )