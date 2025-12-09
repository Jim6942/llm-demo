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
    print(f"Filename received: {file.filename}")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        pdf_reader = pypdf.PdfReader(file.file)
        
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
                print("Page extracted...")

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
    print("Chat endpoint hit")
    try:
        system_instruction = (
            """You are the **Revax Demo Tax Assistant**, an AI used in a prototype of the Revax platform.
            Your job in this demo:
            - Summarise and explain the content of uploaded PDFs.
            - Pull out key points, open questions and possible tax risks.
            - Draft short emails, notes or explanations based on what the user asks.
            - Answer general, high-level tax questions (assume UK corporate / business tax unless the user clearly says otherwise).

            This is a demo. You are not giving formal tax advice. When answers touch real tax outcomes, add a brief reminder that a qualified professional should review the output before it is relied on.

            If the system includes text from a PDF, treat it as the user’s document. Use it as your primary context:
            - If they ask for a summary, give a concise overview first, then a few bullet points with key issues or risks.
            - If they ask a question about the document, refer back to relevant passages when you explain your reasoning.
            - If the document seems long or technical, briefly mention what you focused on.

            Style:
            - Be clear, structured and fairly concise. Prefer short paragraphs and bullet points over big walls of text.
            - Explain any important assumptions you make (for example, that the company is UK-resident, part of a group, etc.).
            - Don’t invent precise section numbers, dates or rates if you’re not sure.

            Greeting behaviour:
            - On the first user message, briefly introduce yourself as a Revax demo assistant.
            - Mention that they can upload a (test) PDF for summarising or ask you to draft an email/memo.
            - Give one or two simple example prompts, and note that generic or dummy documents are fine."""
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

        print(f"Sending request with {len(api_messages)} messages")
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