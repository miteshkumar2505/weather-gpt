import google.generativeai as genai
from app.config import get_settings

settings = get_settings()

genai.configure(
    api_key=settings.gemini_api_key,
    transport="rest"
)

print("Testing Gemini...")

try:
    model = genai.GenerativeModel("models/gemini-3.6-flash")
    response = model.generate_content("Say hello in one sentence.")
    print("SUCCESS:")
    print(response.text)

except Exception as error:
    print("ERROR:")
    print(error)