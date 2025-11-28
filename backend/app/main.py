import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI()

# Allow your Vite dev site to call the backend while you develop
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000", 
	"https://interlinked-chi.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

class GenerateIn(BaseModel):
    prompt: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/generate")
def generate(payload: GenerateIn):
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    print(f"Using model: {model}")
    
    try:
        # Create config to disable safety settings
        config = types.GenerateContentConfig(
            safety_settings=[
                types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_NONE",
                ),
                types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_NONE",
                ),
            ]
        )

        resp = client.models.generate_content(
            model=model,
            contents=payload.prompt,
            config=config,
        )

        # Safely check for candidates and text
        if not resp.candidates:
             print(f"No candidates returned. Full response: {resp}")
             return {"text": "Error: No response candidates returned from Gemini."}
        
        # Check if the first candidate has content parts
        first_candidate = resp.candidates[0]
        if not first_candidate.content or not first_candidate.content.parts:
             finish_reason = first_candidate.finish_reason
             print(f"No content parts. Finish reason: {finish_reason}")
             return {"text": f"Error: Generation stopped. Reason: {finish_reason}"}

        return {"text": resp.text}

    except Exception as e:
        print(f"Error generating content: {e}")
        return {"text": f"Error: {str(e)}"}

