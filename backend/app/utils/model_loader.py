from typing import Literal, Optional, Any
from pydantic import BaseModel, Field
from app.utils.config_loader import load_config
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
import os
from dotenv import load_dotenv

load_dotenv()


class ModelLoader(BaseModel):
    model_provider: Literal["groq", "openai", "gemini"] = "gemini"
    config: Optional[dict] = Field(default=None, exclude=True)

    def model_post_init(self, __context: Any) -> None:
        self.config = load_config()

    class Config:
        arbitrary_types_allowed = True

    def load_llm(self):
        if self.model_provider == "groq":
            model_name = self.config["llm"]["groq"]["model_name"]
            return ChatGroq(model=model_name, api_key=os.getenv("GROQ_API_KEY"))
        elif self.model_provider == "openai":
            model_name = self.config["llm"]["openai"]["model_name"]
            return ChatOpenAI(model_name=model_name, api_key=os.getenv("OPENAI_API_KEY"))
        elif self.model_provider == "gemini":
            model_name = self.config["llm"]["gemini"]["model_name"]
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=os.getenv("GEMINI_API_KEY"),
            )
        raise ValueError(f"Unsupported model provider: {self.model_provider}")
