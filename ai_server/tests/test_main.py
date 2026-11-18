from io import BytesIO
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import main


client = TestClient(main.app)


# Создание фотографии JPEG
def jpeg_bytes():
    buffer = BytesIO()
    Image.new(
        "RGB",
        (10, 10),
        "white"
    ).save(buffer, format="JPEG")
    return buffer.getvalue()


# Отправка фотографии на API
def submit(name="bird.jpg", data=None):
    if data is None:
        data = jpeg_bytes()
    return client.post(
        "/predict",
        files={
            "file": (
                name,
                data,
                "application/octet-stream"
            )
        }
    )


# Проверка доступности AI Server
def test_health():
    result = client.get("/health")
    assert result.status_code == 200
    assert result.json() == {
        "status": "running",
        "model": main.MODEL_NAME
    }


# Прямое распознавание по умолчанию запрещено
def test_predict_disabled_by_default(monkeypatch):
    monkeypatch.delenv(
        "ENABLE_DIRECT_PREDICT",
        raising=False
    )
    result = submit()
    assert result.status_code == 403


# Успешное распознавание через API
def test_successful_prediction(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    monkeypatch.setattr(
        main,
        "predict_bird",
        lambda image: [
            {"species": "COCKATOO", "confidence": 0.8},
            {"species": "MACAW", "confidence": 0.15},
            {"species": "TOUCAN", "confidence": 0.05}
        ]
    )
    result = submit(r"album\bird.jpg")
    assert result.status_code == 200
    data = result.json()
    assert data["image_name"] == "bird.jpg"
    assert data["predicted_species"] == "COCKATOO"
    assert data["confidence"] == 0.8
    assert len(data["top_3"]) == 3
    assert "analysis_date" in data


# Запрещённые расширения
@pytest.mark.parametrize("filename", [
    "bird.gif",
    "bird.webp",
    "notes.txt"
])
def test_forbidden_extension(monkeypatch, filename):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    result = submit(filename)
    assert result.status_code == 400


# Пустой файл
def test_empty_file(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    result = submit("bird.jpg", b"")
    assert result.status_code == 400


# Некорректное изображение
def test_invalid_image(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    result = submit(
        "bird.jpg",
        b"not a picture"
    )
    assert result.status_code == 400


# Файл больше 10 МБ
def test_too_large(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    result = submit(
        "bird.jpg",
        b"1" * (main.MAX_FILE_SIZE + 1)
    )
    assert result.status_code == 413


# Слишком большое разрешение изображения
def test_huge_resolution(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    fake = MagicMock()
    fake.__enter__.return_value = fake
    fake.format = "JPEG"
    fake.width = 5000
    fake.height = 5000
    monkeypatch.setattr(
        main.Image,
        "open",
        lambda _: fake
    )
    result = submit("bird.jpg", b"fake"
    )
    assert result.status_code == 413


# Ошибка нейросети
def test_model_failure(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    def broken(image):
        raise RuntimeError("model failure")
    monkeypatch.setattr(
        main,
        "predict_bird",
        broken
    )
    result = submit()
    assert result.status_code == 500


# Пустой ответ нейросети
def test_model_empty_response(monkeypatch):
    monkeypatch.setenv(
        "ENABLE_DIRECT_PREDICT",
        "true"
    )
    monkeypatch.setattr(
        main,
        "predict_bird",
        lambda image: []
    )
    result = submit()
    assert result.status_code == 500
