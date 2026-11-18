FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/.cache/huggingface

RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Библиотеки проекта
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Файлы AI Server и RabbitMQ Worker
COPY main.py bird_model.py rabbitmq_worker.py ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
