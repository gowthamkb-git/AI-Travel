from langchain_groq import ChatGroq
import os


class ModelLoader:
    def __init__(self, model_provider: str = "groq"):
        self.model_provider = model_provider

    def load_llm(self, model_name: str | None = None, temperature: float = 0.7):
        if self.model_provider == "groq":
            return ChatGroq(
                model=model_name or "llama-3.1-8b-instant",
                temperature=temperature,
                groq_api_key=os.getenv("GROQ_API_KEY"),
            )

        # fallback (optional)
        raise ValueError(f"Unsupported model provider: {self.model_provider}")
