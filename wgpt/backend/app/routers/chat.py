"""
WeatherGPT — Chat Router
Conversational AI endpoint powered by Google Gemini.
"""

from fastapi import APIRouter, HTTPException
from app.schemas import ChatRequest, ChatResponse
from app.services import chat_service

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to WeatherGPT's AI assistant.
    The assistant can fetch live weather data to answer your questions.
    """
    try:
        reply, session_id, sources = await chat_service.chat(
            message=request.message,
            session_id=request.session_id,
            city=request.city,
        )
        return ChatResponse(
            reply=reply,
            session_id=session_id,
            sources=sources,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
