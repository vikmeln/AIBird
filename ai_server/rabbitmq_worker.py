import os
import json
from pathlib import Path
from datetime import datetime, timezone
import pika
from PIL import Image
from bird_model import predict_bird, contains_bird


REQUEST_QUEUE = "bird.analysis.requests"
RESULT_QUEUE = "bird.analysis.results"


UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "../uploads")).resolve()


class NoBirdDetected(Exception):
    pass


# Обработка сообщения от Central Server
def process_message(channel, method, properties, body):
    job_id = None
    try:
        job = json.loads(body)
        job_id = job["job_id"]
        filename = job["stored_filename"]
        # Проверяем имя файла
        if not isinstance(job_id, str) or not job_id:
            raise ValueError("Invalid job ID")
        if not isinstance(filename, str) or (
            not filename
            or "/" in filename
            or "\\" in filename
        ):
            raise ValueError("Invalid filename")
        image_path = UPLOADS_DIR / filename
        if not image_path.is_file():
            raise FileNotFoundError("Image not found")
        if image_path.stat().st_size > 10 * 1024 * 1024:
            raise ValueError("Image is too large")
        with Image.open(image_path) as source:
            if source.format not in {"JPEG", "PNG"}:
                raise ValueError("Invalid image format")
            if source.width * source.height > 20_000_000:
                raise ValueError("Resolution is too large")
            source.load()
            image = source.convert("RGB")
        # Сначала проверяем наличие птицы
        if not contains_bird(image):
            raise NoBirdDetected(
                "No bird detected in the image"
            )
        predictions = predict_bird(image)
        if not predictions:
            raise ValueError("No predictions")
        result = {
            "job_id": job_id,
            "status": "completed",
            "top_3": predictions,
            "analysis_date": datetime.now(
                timezone.utc
            ).isoformat()
        }
        print(
            "Bird recognized:",
            predictions[0]["species"]
        )
    except NoBirdDetected as error:
        print("Image rejected:", error)
        result = {
            "job_id": job_id,
            "status": "failed",
            "error": "no_bird_detected"
        }
    except Exception as error:
        print("Analysis error:", error)
        if not isinstance(job_id, str) or not job_id:
            channel.basic_reject(
                delivery_tag=method.delivery_tag,
                requeue=False
            )
            return
        result = {
            "job_id": job_id,
            "status": "failed",
            "error": "Image analysis failed"
        }
    # Отправляем результат Central Server
    try:
        channel.basic_publish(
            exchange="",
            routing_key=RESULT_QUEUE,
            body=json.dumps(result).encode("utf-8"),
            mandatory=True,
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2
            )
        )
        channel.basic_ack(delivery_tag=method.delivery_tag)
        print("Result sent to Central Server")
    except Exception as error:
        print("RabbitMQ publish error:", error)
        if channel.is_open:
            channel.basic_nack(
                delivery_tag=method.delivery_tag,
                requeue=True
            )


# Запуск RabbitMQ Worker
def run_worker():
    credentials = pika.PlainCredentials(
        os.getenv("RABBITMQ_USER", "guest"),
        os.getenv("RABBITMQ_PASSWORD", "guest")
    )
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=os.getenv("RABBITMQ_HOST", "localhost"),
            credentials=credentials,
            heartbeat=600
        )
    )
    channel = connection.channel()
    # Создаём очереди
    channel.queue_declare(
        queue=REQUEST_QUEUE,
        durable=True
    )
    channel.queue_declare(
        queue=RESULT_QUEUE,
        durable=True
    )
    channel.confirm_delivery()
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=REQUEST_QUEUE,
        on_message_callback=process_message,
        auto_ack=False
    )
    print("Waiting for bird analysis requests...")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        print("Worker stopped")
    finally:
        if connection.is_open:
            connection.close()


if __name__ == "__main__":
    run_worker()
