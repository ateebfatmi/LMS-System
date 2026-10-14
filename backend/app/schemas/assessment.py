from pydantic import BaseModel, Field
from typing import List, Optional

class OptionDefinition(BaseModel):
    id: str
    text: str

class QuestionDefinitionSchema(BaseModel):
    id: str
    kind: str = Field(..., pattern="^(single_choice|multiple_choice|numerical)$")
    subject: Optional[str] = None
    topic: Optional[str] = None
    marks: float = 4.0
    negative_marks: Optional[float] = 1.0
    correct_option_ids: Optional[List[str]] = None
    correct_number: Optional[float] = None
    numerical_tolerance: Optional[float] = 0.0
    partial_marking: Optional[bool] = False

class AnswerSubmissionSchema(BaseModel):
    question_id: str
    selected_option_ids: Optional[List[str]] = None
    number: Optional[float] = None
    time_spent_seconds: Optional[int] = 0

class GradedAnswerSchema(BaseModel):
    question_id: str
    status: str  # correct, incorrect, unanswered, partially_correct
    score: float
    time_spent_seconds: int = 0

class EvaluationRequest(BaseModel):
    questions: List[QuestionDefinitionSchema]
    submissions: List[AnswerSubmissionSchema]

class EvaluationResponse(BaseModel):
    total_score: float
    maximum_score: float
    accuracy_percentage: float
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    partially_correct_count: int
    answers: List[GradedAnswerSchema]
