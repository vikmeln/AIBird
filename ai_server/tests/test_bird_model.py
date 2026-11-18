from unittest.mock import Mock
import pytest
from PIL import Image
import bird_model


# Проверка обнаружения птицы, человека и пустого изображения
@pytest.mark.parametrize("objects, expected", [
    ([{"label": "bird", "score": 0.9}], True),
    ([{"label": "BIRD", "score": 0.8}], True),
    ([{"label": "person", "score": 0.99}], False),
    ([
        {"label": "person", "score": 0.9},
        {"label": "bird", "score": 0.7}
    ], True),
    ([], False),
])
def test_detect_bird_objects(monkeypatch, objects, expected):
    detector = Mock(return_value=objects)
    monkeypatch.setattr(
        bird_model,
        "get_bird_detector",
        lambda: detector
    )
    result = bird_model.contains_bird(Image.new("L", (24, 24)))
    assert result is expected
    assert detector.call_args.args[0].mode == "RGB"
    assert (
        detector.call_args.kwargs["threshold"]
        == bird_model.BIRD_THRESHOLD
    )


# Проверка трёх результатов и округления вероятностей
def test_top3_and_rounding(monkeypatch):
    classifier = Mock(return_value=[
        {"label": "COCKATOO", "score": 0.754321},
        {"label": "MACAW", "score": 0.200012},
        {"label": "TOUCAN", "score": 0.045667}
    ])
    monkeypatch.setattr(
        bird_model,
        "get_model",
        lambda: classifier
    )
    result = bird_model.predict_bird(Image.new("L", (24, 24)))
    assert result == [
        {"species": "COCKATOO", "confidence": 0.7543},
        {"species": "MACAW", "confidence": 0.2},
        {"species": "TOUCAN", "confidence": 0.0457}
    ]
    assert classifier.call_args.kwargs["top_k"] == 3
    assert classifier.call_args.args[0].mode == "RGB"


# Низкая вероятность вида не должна скрывать результат
def test_low_confidence_is_not_filtered(monkeypatch):
    monkeypatch.setattr(
        bird_model,
        "get_model",
        lambda: lambda *args, **kwargs: [{"label": "BIRD", "score": 0.181}]
    )
    result = bird_model.predict_bird(Image.new("RGB", (5, 5)))
    assert result[0]["confidence"] == 0.181


# Проверка однократной загрузки моделей
@pytest.mark.parametrize("getter, task, model_var", [
    ("get_model", "image-classification", "MODEL_NAME"),
    (
        "get_bird_detector",
        "object-detection",
        "DETECTION_MODEL_NAME"
    )
])
def test_model_is_cached(monkeypatch, getter, task, model_var):
    fake_pipeline = Mock(return_value=object())
    monkeypatch.setattr(
        bird_model,
        "pipeline",
        fake_pipeline
    )
    method = getattr(bird_model, getter)
    method.cache_clear()
    try:
        first = method()
        second = method()
        assert first is second
        fake_pipeline.assert_called_once_with(
            task=task,
            model=getattr(bird_model, model_var),
            device=-1
        )
    finally:
        method.cache_clear()
