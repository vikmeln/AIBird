import json
from types import SimpleNamespace
from unittest.mock import Mock, MagicMock
import pytest
from PIL import Image
import rabbitmq_worker as worker


# Временная папка и поддельный канал RabbitMQ
@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setattr(
        worker,
        "UPLOADS_DIR",
        tmp_path
    )
    channel = Mock()
    channel.is_open = True
    return tmp_path, channel


# Создание тестовой фотографии
def photo(folder, name="bird.jpg", fmt="JPEG"):
    Image.new(
        "RGB",
        (32, 32),
        "white"
    ).save(
        folder / name,
        format=fmt
    )


# Имитация задания из RabbitMQ
def send(channel, filename="bird.jpg", job_id="123"):
    job = {
        "job_id": job_id,
        "stored_filename": filename
    }
    worker.process_message(
        channel,
        SimpleNamespace(delivery_tag=7),
        None,
        json.dumps(job).encode()
    )
    if channel.basic_publish.called:
        return json.loads(channel.basic_publish.call_args.kwargs["body"])
    return None


# Успешная обработка JPEG и PNG
@pytest.mark.parametrize("name, fmt", [
    ("bird.jpg", "JPEG"),
    ("bird.png", "PNG")
])
def test_successful_analysis(env, monkeypatch, name, fmt):
    folder, channel = env
    photo(folder, name, fmt)
    detect = Mock(return_value=True)
    classify = Mock(return_value=[
        {"species": "COCKATOO", "confidence": 0.7},
        {"species": "MACAW", "confidence": 0.2},
        {"species": "TOUCAN", "confidence": 0.1}
    ])
    monkeypatch.setattr(worker, "contains_bird", detect)
    monkeypatch.setattr(worker, "predict_bird", classify)
    result = send(channel, name)
    assert result["status"] == "completed"
    assert result["job_id"] == "123"
    assert len(result["top_3"]) == 3
    assert result["top_3"][0]["species"] == "COCKATOO"
    assert "analysis_date" in result
    detect.assert_called_once()
    classify.assert_called_once()
    assert (
        channel.basic_publish.call_args.kwargs["routing_key"]
        == worker.RESULT_QUEUE
    )
    channel.basic_ack.assert_called_once_with(delivery_tag=7)
    channel.basic_nack.assert_not_called()


# Отказ, если птица не обнаружена
def test_no_bird_is_rejected_without_classification(env, monkeypatch):
    folder, channel = env
    photo(folder)
    monkeypatch.setattr(
        worker,
        "contains_bird",
        lambda image: False
    )
    classify = Mock()
    monkeypatch.setattr(
        worker,
        "predict_bird",
        classify
    )
    result = send(channel)
    assert result["status"] == "failed"
    assert result["error"] == "no_bird_detected"
    classify.assert_not_called()
    channel.basic_ack.assert_called_once()


# Отсутствующие и запрещённые пути фотографий
@pytest.mark.parametrize("filename", [
    "missing.jpg",
    "../bird.jpg",
    "folder/bird.jpg",
    r"folder\bird.jpg",
    ""
])
def test_missing_or_invalid_filename_fails(env, filename):
    folder, channel = env
    result = send(channel, filename)
    assert result["status"] == "failed"
    channel.basic_ack.assert_called_once()


# Неправильный ID задания
def test_invalid_job_id_rejected(env):
    folder, channel = env
    result = send(channel, job_id="")
    assert result is None
    channel.basic_reject.assert_called_once_with(
        delivery_tag=7,
        requeue=False
    )
    channel.basic_publish.assert_not_called()


# Повреждённое изображение
def test_corrupt_image_fails(env):
    folder, channel = env
    (folder / "bird.jpg").write_bytes(b"not an image")
    result = send(channel)
    assert result["status"] == "failed"
    assert result["error"] == "Image analysis failed"


# Запрещённый формат GIF
def test_gif_image_fails(env):
    folder, channel = env
    photo(folder, "bird.gif", "GIF")
    result = send(channel, "bird.gif")
    assert result["status"] == "failed"


# Ограничение 10 МБ
def test_file_over_10_mb_fails(env):
    folder, channel = env
    with (folder / "bird.jpg").open("wb") as file:
        file.seek(10 * 1024 * 1024)
        file.write(b"1")
    result = send(channel)
    assert result["status"] == "failed"


# Ограничение разрешения 20 миллионов пикселей
def test_resolution_over_20_megapixels_fails(env, monkeypatch):
    folder, channel = env
    (folder / "bird.jpg").write_bytes(b"fake")
    fake = MagicMock()
    fake.__enter__.return_value = fake
    fake.format = "JPEG"
    fake.width = 5000
    fake.height = 5000
    monkeypatch.setattr(
        worker.Image,
        "open",
        lambda path: fake
    )
    result = send(channel)
    assert result["status"] == "failed"


# Модель вернула пустой результат
def test_empty_predictions_fails(env, monkeypatch):
    folder, channel = env
    photo(folder)
    monkeypatch.setattr(
        worker,
        "contains_bird",
        lambda image: True
    )
    monkeypatch.setattr(
        worker,
        "predict_bird",
        lambda image: []
    )
    result = send(channel)
    assert result["status"] == "failed"


def test_detector_error_fails(env, monkeypatch):
    folder, channel = env
    photo(folder)
    monkeypatch.setattr(
        worker,
        "contains_bird",
        Mock(side_effect=RuntimeError("model unavailable"))
    )
    result = send(channel)
    assert result["status"] == "failed"
    assert result["error"] == "Image analysis failed"


# Ошибка RabbitMQ — задание возвращается в очередь
def test_publish_error_requeues_message(env, monkeypatch):
    folder, channel = env
    photo(folder)
    monkeypatch.setattr(
        worker,
        "contains_bird",
        lambda image: False
    )
    channel.basic_publish.side_effect = RuntimeError("network error")
    send(channel)
    channel.basic_ack.assert_not_called()
    channel.basic_nack.assert_called_once_with(
        delivery_tag=7,
        requeue=True
    )
