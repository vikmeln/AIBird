import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# Не загружаем настоящие модели Hugging Face
transformers = ModuleType("transformers")


def forbidden_pipeline(*args, **kwargs):
    raise AssertionError(
        "Real Hugging Face model must not be loaded in unit tests"
    )

transformers.pipeline = forbidden_pipeline
sys.modules["transformers"] = transformers

# Не подключаемся к настоящему RabbitMQ
pika = ModuleType("pika")
pika.BasicProperties = lambda **kwargs: SimpleNamespace(**kwargs)
sys.modules["pika"] = pika
