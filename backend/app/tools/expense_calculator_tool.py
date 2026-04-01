from app.utils.expense_calculator import Calculator
from langchain.tools import tool
from typing import List, Union


class CalculatorTool:
    def __init__(self):
        self.calculator = Calculator()
        self.calculator_tool_list = self._setup_tools()

    def _setup_tools(self) -> List:
        def to_float(v) -> float:
            try:
                return float(str(v).strip()) if str(v).strip() != '' else 0.0
            except (TypeError, ValueError):
                return 0.0

        @tool
        def estimate_total_hotel_cost(price_per_night: Union[float, str], total_days: Union[float, str]) -> float:
            """Calculate total hotel cost given price per night and number of days"""
            return self.calculator.multiply(to_float(price_per_night), to_float(total_days))

        @tool
        def calculate_total_expense(costs: List[float]) -> float:
            """Calculate total expense of the trip given a list of costs"""
            return self.calculator.calculate_total(*[to_float(c) for c in costs])

        @tool
        def calculate_daily_expense_budget(total_cost: Union[float, str], days: Union[int, str]) -> float:
            """Calculate daily expense budget given total cost and number of days"""
            return self.calculator.calculate_daily_budget(to_float(total_cost), int(to_float(days)) or 1)

        return [estimate_total_hotel_cost, calculate_total_expense, calculate_daily_expense_budget]
