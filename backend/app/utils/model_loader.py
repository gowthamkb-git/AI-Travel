from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
import os


class ModelLoader:
    def __init__(self, model_provider: str = "groq"):
        self.model_provider = (model_provider or os.getenv("MODEL_PROVIDER") or "groq").lower()

    def load_llm(self, model_name: str | None = None, temperature: float = 0.7):
        if self.model_provider == "huggingface":
            return ChatOpenAI(
                model=model_name or "openai/gpt-oss-120b",
                temperature=temperature,
                api_key=os.getenv("HUGGINGFACE_API_KEY"),
                base_url=os.getenv("HUGGINGFACE_BASE_URL", "https://router.huggingface.co/v1"),
            )

        if self.model_provider == "openai":
            return ChatOpenAI(
                model=model_name or "gpt-4o-mini",
                temperature=temperature,
                api_key=os.getenv("OPENAI_API_KEY"),
            )

        if self.model_provider == "groq":
            return ChatGroq(
                model=model_name or "llama-3.1-8b-instant",
                temperature=temperature,
                groq_api_key=os.getenv("GROQ_API_KEY"),
            )

        # fallback (optional)
        raise ValueError(f"Unsupported model provider: {self.model_provider}")
