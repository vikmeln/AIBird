import os
from functools import lru_cache
from PIL import Image
from transformers import pipeline


MODEL_NAME = os.getenv(
    "HF_MODEL_ID",
    "dima806/bird_species_image_detection"
)

DETECTION_MODEL_NAME = os.getenv(
    "BIRD_DETECTION_MODEL_ID",
    "facebook/detr-resnet-50"
)

BIRD_THRESHOLD = float(os.getenv("BIRD_DETECTION_THRESHOLD", "0.40"))


# Загрузка модели распознавания видов птиц
@lru_cache(maxsize=1)
def get_model():
    print("Loading Hugging Face model...")
    model = pipeline(
        task="image-classification",
        model=MODEL_NAME,
        device=-1
    )
    print("Model loaded successfully!")
    return model


# Загрузка модели обнаружения птиц
@lru_cache(maxsize=1)
def get_bird_detector():
    print("Loading bird detection model...")
    detector = pipeline(
        task="object-detection",
        model=DETECTION_MODEL_NAME,
        device=-1
    )
    print("Bird detection model loaded!")
    return detector


# Проверка наличия птицы на фотографии
def contains_bird(image: Image.Image) -> bool:
    detector = get_bird_detector()
    detections = detector(
        image.convert("RGB"),
        threshold=BIRD_THRESHOLD
    )
    for detection in detections:
        if detection["label"].lower() == "bird":
            print(
                "Bird detected:",
                round(float(detection["score"]), 4)
            )
            return True
    print("No bird detected in the image")
    return False


# Распознавание вида птицы по фотографии
def predict_bird(image: Image.Image):
    model = get_model()
    predictions = model(
        image.convert("RGB"),
        top_k=3
    )
    results = []
    for prediction in predictions:
        results.append({
            "species": prediction["label"],
            "confidence": round(
                float(prediction["score"]), 4
            )
        })
    return results
