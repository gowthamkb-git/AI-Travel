from app.utils.expense_calculator import Calculator
from langchain.tools import tool
from typing import List, Union
import re


class CalculatorTool:
    def __init__(self):
        self.calculator = Calculator()
        self.calculator_tool_list = self._setup_tools()

    def _setup_tools(self) -> List:
        def to_float(v) -> float:
            try:
                cleaned = re.sub(r"[^\d.\-]", "", str(v).strip())
                return float(cleaned) if cleaned != "" else 0.0
            except (TypeError, ValueError):
                return 0.0

        def parse_costs(value: Union[List[float], str]) -> List[float]:
            if isinstance(value, list):
                return [to_float(item) for item in value]

            text = str(value).strip()
            if not text:
                return []

            matches = re.findall(r"-?\d[\d,]*(?:\.\d+)?", text)
            return [to_float(match) for match in matches]

        @tool
        def estimate_total_hotel_cost(price_per_night: Union[float, str], total_days: Union[float, str]) -> float:
            """Calculate total hotel cost given price per night and number of days"""
            return self.calculator.multiply(to_float(price_per_night), to_float(total_days))

        @tool
        def calculate_total_expense(costs: Union[List[float], str]) -> float:
            """Calculate total expense of the trip given a list of costs or a stringified list of amounts"""
            return self.calculator.calculate_total(*parse_costs(costs))

        @tool
        def calculate_daily_expense_budget(total_cost: Union[float, str], days: Union[int, str]) -> float:
            """Calculate daily expense budget given total cost and number of days"""
            return self.calculator.calculate_daily_budget(to_float(total_cost), int(to_float(days)) or 1)

        return [estimate_total_hotel_cost, calculate_total_expense, calculate_daily_expense_budget]
