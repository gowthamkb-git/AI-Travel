import os

import requests
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true"


@router.post("")
async def transcribe(file: UploadFile = File(...)):
    api_key = os.getenv("Deepgram_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Deepgram API key is not configured")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    content_type = (file.content_type or "application/octet-stream").split(";")[0].strip()

    try:
        response = requests.post(
            DEEPGRAM_URL,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": content_type,
            },
            data=audio_bytes,
            timeout=45,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        detail = "Deepgram transcription request failed"
        if exc.response is not None:
            try:
                error_body = exc.response.json()
                detail = error_body.get("err_msg") or error_body.get("message") or detail
            except ValueError:
                detail = exc.response.text or detail
        raise HTTPException(status_code=502, detail=detail) from exc

    data = response.json()

    try:
        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
    except (KeyError, IndexError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Invalid transcription response from Deepgram") from exc

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected in the recorded audio")

    return {"transcript": transcript}
