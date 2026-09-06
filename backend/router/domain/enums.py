from enum import Enum


class Intent(str, Enum):
    ANALYZE = "analyze"
    COMPARE = "compare"
    QUESTION_ANSWER = "question_answer"


class TaskType(str, Enum):
    NDVI = "ndvi"
    NDWI = "ndwi"
    NDBI = "ndbi"
    CHANGE_DETECTION = "change_detection"
    CHANGEFORMER = "changeformer"
    VQA = "vqa"
    CAPTIONING = "captioning"


class Modality(str, Enum):
    SINGLE_IMAGE = "single_image"
    PAIRED_IMAGE = "paired_image"