import google.generativeai as genai
from app.config import get_settings

print("Starting model check...")

settings = get_settings()

if not settings.gemini_api_key:
    print("ERROR: Gemini API key was not loaded from .env")
    exit()

print("API key loaded.")

genai.configure(
    api_key=settings.gemini_api_key,
    transport="rest"
)

print("Checking available models...")

try:
    models = list(genai.list_models())

    print("Total models found:", len(models))

    for model in models:
        if "generateContent" in model.supported_generation_methods:
            print("Available:", model.name)

except Exception as error:
    print("ERROR:", error)