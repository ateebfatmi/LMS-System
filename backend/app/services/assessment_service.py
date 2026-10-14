from typing import List, Dict, Optional
from backend.app.schemas.assessment import (
    QuestionDefinitionSchema,
    AnswerSubmissionSchema,
    GradedAnswerSchema,
    EvaluationResponse,
)

def grade_single_answer(
    question: QuestionDefinitionSchema,
    answer: Optional[AnswerSubmissionSchema],
) -> GradedAnswerSchema:
    time_spent = answer.time_spent_seconds if answer else 0
    
    # Check unanswered
    if not answer or (answer.number is None and not answer.selected_option_ids):
        return GradedAnswerSchema(
            question_id=question.id,
            status="unanswered",
            score=0.0,
            time_spent_seconds=time_spent,
        )

    # Numerical Questions
    if question.kind == "numerical":
        tolerance = question.numerical_tolerance or 0.0
        if question.correct_number is not None and answer.number is not None:
            is_correct = abs(answer.number - question.correct_number) <= tolerance
            return GradedAnswerSchema(
                question_id=question.id,
                status="correct" if is_correct else "incorrect",
                score=float(question.marks) if is_correct else -float(question.negative_marks or 0.0),
                time_spent_seconds=time_spent,
            )
        return GradedAnswerSchema(
            question_id=question.id,
            status="incorrect",
            score=-float(question.negative_marks or 0.0),
            time_spent_seconds=time_spent,
        )

    selected = set(answer.selected_option_ids or [])
    correct = set(question.correct_option_ids or [])

    # Single Choice
    if question.kind == "single_choice":
        is_correct = selected == correct
        return GradedAnswerSchema(
            question_id=question.id,
            status="correct" if is_correct else "incorrect",
            score=float(question.marks) if is_correct else -float(question.negative_marks or 0.0),
            time_spent_seconds=time_spent,
        )

    # Multiple Choice (JEE Advanced rules)
    if question.kind == "multiple_choice":
        if selected == correct:
            return GradedAnswerSchema(
                question_id=question.id,
                status="correct",
                score=float(question.marks),
                time_spent_seconds=time_spent,
            )

        # If any selected option is NOT in correct set -> Incorrect (-negative marks)
        if not selected.issubset(correct):
            return GradedAnswerSchema(
                question_id=question.id,
                status="incorrect",
                score=-float(question.negative_marks or 0.0),
                time_spent_seconds=time_spent,
            )

        # If partial marking is enabled and subset of correct options chosen
        if question.partial_marking and len(selected) > 0 and len(correct) > 0:
            partial_score = max(1.0, float(int((question.marks / len(correct)) * len(selected))))
            return GradedAnswerSchema(
                question_id=question.id,
                status="partially_correct",
                score=partial_score,
                time_spent_seconds=time_spent,
            )

        return GradedAnswerSchema(
            question_id=question.id,
            status="incorrect",
            score=-float(question.negative_marks or 0.0),
            time_spent_seconds=time_spent,
        )

    return GradedAnswerSchema(
        question_id=question.id,
        status="unanswered",
        score=0.0,
        time_spent_seconds=time_spent,
    )

def evaluate_test_submission(
    questions: List[QuestionDefinitionSchema],
    submissions: List[AnswerSubmissionSchema],
) -> EvaluationResponse:
    submission_map: Dict[str, AnswerSubmissionSchema] = {s.question_id: s for s in submissions}
    graded_answers: List[GradedAnswerSchema] = []

    total_score = 0.0
    maximum_score = sum(q.marks for q in questions)
    correct_cnt = 0
    incorrect_cnt = 0
    unanswered_cnt = 0
    partial_cnt = 0

    for q in questions:
        ans = submission_map.get(q.id)
        graded = grade_single_answer(q, ans)
        graded_answers.append(graded)
        total_score += graded.score

        if graded.status == "correct":
            correct_cnt += 1
        elif graded.status == "incorrect":
            incorrect_cnt += 1
        elif graded.status == "partially_correct":
            partial_cnt += 1
        else:
            unanswered_cnt += 1

    accuracy = (correct_cnt / max(1, correct_cnt + incorrect_cnt)) * 100.0

    return EvaluationResponse(
        total_score=round(total_score, 2),
        maximum_score=round(maximum_score, 2),
        accuracy_percentage=round(accuracy, 1),
        correct_count=correct_cnt,
        incorrect_count=incorrect_cnt,
        unanswered_count=unanswered_cnt,
        partially_correct_count=partial_cnt,
        answers=graded_answers,
    )
