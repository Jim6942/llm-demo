import os
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from typing import List
from openai import OpenAI
import pypdf
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    OPENAI_API_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()

client = OpenAI(api_key=settings.OPENAI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    document_text: str | None = None

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Revax Sandbox API is ready"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        pdf_reader = pypdf.PdfReader(file.file)
        
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        if not extracted_text.strip():
            return {"filename": file.filename, "text": "", "warning": "No text found in PDF"}

        return {
            "filename": file.filename, 
            "text": extracted_text.strip()
        }

    except Exception as e:
        print(f"Error parsing PDF: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse PDF file.")


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        system_instruction = (
            "You are a helpful professional assistant helping a user draft documents. "
            "Be concise, professional, and clear."
        )

        if request.document_text:
            safe_text = request.document_text[:20000] 
            system_instruction += f"\n\nCONTEXT FROM USER DOCUMENT:\n{safe_text}"
            
            if len(request.document_text) > 20000:
                system_instruction += "\n[...Document truncated for length...]"

        api_messages = [
            {"role": "system", "content": system_instruction}
        ]
        
        for msg in request.messages:
            api_messages.append({"role": msg.role, "content": msg.content})

        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=api_messages,
            temperature=1
        )

        reply = response.choices[0].message.content
        return {"reply": reply}

    except Exception as e:
        print(f"OpenAI Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))