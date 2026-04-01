import os
from app.utils.currency_converter import CurrencyConverter
from langchain.tools import tool
from typing import List
from dotenv import load_dotenv

load_dotenv()


class CurrencyConverterTool:
    def __init__(self):
        self.currency_service = CurrencyConverter(os.environ.get("EXCHANGE_RATE_API_KEY"))
        self.currency_converter_tool_list = self._setup_tools()

    def _setup_tools(self) -> List:
        @tool
        def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
            """Convert amount from one currency to another"""
            return self.currency_service.convert(amount, from_currency, to_currency)

        return [convert_currency]
