import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image, UnidentifiedImageError
from bird_model import MODEL_NAME, predict_bird


app = FastAPI(title="AI Bird - AI Server")

MAX_FILE_SIZE = 10 * 1024 * 1024


# Проверка сервера
@app.get("/health")
def health():
    return {
        "status": "running",
        "model": MODEL_NAME
    }


# Проверка модели
@app.post("/predict")
def predict(file: UploadFile = File(...)):
    if os.getenv("ENABLE_DIRECT_PREDICT", "false") != "true":
        raise HTTPException(
            status_code=403,
            detail="Direct prediction is disabled"
        )
    filename = Path(
        (file.filename or "").replace("\\", "/")
    ).name
    extension = Path(filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png"}:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG are allowed"
        )
    try:
        data = file.file.read(MAX_FILE_SIZE + 1)
    finally:
        file.file.close()
    if not data:
        raise HTTPException(400, "Empty file")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "Image is too large")
    try:
        with Image.open(BytesIO(data)) as source:
            if source.format not in {"JPEG", "PNG"}:
                raise ValueError("Invalid format")
            if source.width * source.height > 20_000_000:
                raise HTTPException(413, "Resolution is too large")
            source.load()
            image = source.convert("RGB")
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError
    ):
        raise HTTPException(400, "Invalid image")
    try:
        results = predict_bird(image)
    except Exception:
        raise HTTPException(500, "Model error")
    if not results:
        raise HTTPException(500, "No predictions")
    return {
        "image_name": filename,
        "predicted_species": results[0]["species"],
        "confidence": results[0]["confidence"],
        "top_3": results,
        "analysis_date": datetime.now(
            timezone.utc
        ).isoformat()
    }
