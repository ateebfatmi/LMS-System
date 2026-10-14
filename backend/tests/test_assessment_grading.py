from backend.app.schemas.assessment import (
    QuestionDefinitionSchema,
    AnswerSubmissionSchema,
    EvaluationRequest,
)
from backend.app.services.assessment_service import (
    grade_single_answer,
    evaluate_test_submission,
)

def test_single_choice_grading():
    q = QuestionDefinitionSchema(
        id="q1",
        kind="single_choice",
        marks=4.0,
        negative_marks=1.0,
        correct_option_ids=["opt-b"],
    )

    # Correct
    ans_correct = AnswerSubmissionSchema(question_id="q1", selected_option_ids=["opt-b"])
    res = grade_single_answer(q, ans_correct)
    assert res.status == "correct"
    assert res.score == 4.0

    # Incorrect
    ans_wrong = AnswerSubmissionSchema(question_id="q1", selected_option_ids=["opt-c"])
    res = grade_single_answer(q, ans_wrong)
    assert res.status == "incorrect"
    assert res.score == -1.0

    # Unanswered
    res = grade_single_answer(q, None)
    assert res.status == "unanswered"
    assert res.score == 0.0

def test_jee_advanced_partial_marking():
    q = QuestionDefinitionSchema(
        id="q-adv",
        kind="multiple_choice",
        marks=4.0,
        negative_marks=2.0,
        correct_option_ids=["opt-a", "opt-b", "opt-c"],
        partial_marking=True,
    )

    # All correct options chosen
    ans_all = AnswerSubmissionSchema(question_id="q-adv", selected_option_ids=["opt-a", "opt-b", "opt-c"])
    res = grade_single_answer(q, ans_all)
    assert res.status == "correct"
    assert res.score == 4.0

    # Subset of correct options (Partial credit)
    ans_partial = AnswerSubmissionSchema(question_id="q-adv", selected_option_ids=["opt-a", "opt-b"])
    res = grade_single_answer(q, ans_partial)
    assert res.status == "partially_correct"
    assert res.score >= 1.0

    # Choosing a wrong option results in negative penalty
    ans_wrong = AnswerSubmissionSchema(question_id="q-adv", selected_option_ids=["opt-a", "opt-d"])
    res = grade_single_answer(q, ans_wrong)
    assert res.status == "incorrect"
    assert res.score == -2.0

def test_numerical_tolerance():
    q = QuestionDefinitionSchema(
        id="q-num",
        kind="numerical",
        marks=4.0,
        negative_marks=0.0,
        correct_number=9.8,
        numerical_tolerance=0.05,
    )

    # Within tolerance
    ans_within = AnswerSubmissionSchema(question_id="q-num", number=9.82)
    res = grade_single_answer(q, ans_within)
    assert res.status == "correct"
    assert res.score == 4.0

    # Out of tolerance
    ans_out = AnswerSubmissionSchema(question_id="q-num", number=10.0)
    res = grade_single_answer(q, ans_out)
    assert res.status == "incorrect"
    assert res.score == 0.0

def test_full_evaluation():
    q1 = QuestionDefinitionSchema(id="q1", kind="single_choice", marks=4.0, negative_marks=1.0, correct_option_ids=["b"])
    q2 = QuestionDefinitionSchema(id="q2", kind="numerical", marks=4.0, negative_marks=0.0, correct_number=25.0)

    subs = [
        AnswerSubmissionSchema(question_id="q1", selected_option_ids=["b"]),
        AnswerSubmissionSchema(question_id="q2", number=20.0),
    ]

    eval_res = evaluate_test_submission([q1, q2], subs)
    assert eval_res.correct_count == 1
    assert eval_res.incorrect_count == 1
    assert eval_res.total_score == 4.0
    assert eval_res.accuracy_percentage == 50.0
