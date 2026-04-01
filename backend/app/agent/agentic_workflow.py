from app.utils.model_loader import ModelLoader
from app.prompt_library.prompt import SYSTEM_PROMPT
from app.tools.weather_info_tool import WeatherInfoTool
from app.tools.place_search_tool import PlaceSearchTool
from app.tools.expense_calculator_tool import CalculatorTool
from app.tools.currency_conversion_tool import CurrencyConverterTool
from langgraph.graph import StateGraph, MessagesState, END, START
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import HumanMessage
import re

NEW_TRIP_PATTERNS = re.compile(
    r"\b(plan|trip|travel|visit|itinerary|days?\s+(?:trip|plan)|go\s+to|travelling\s+to|traveling\s+to)\b",
    re.IGNORECASE
)


class GraphBuilder:
    def __init__(self, model_provider: str = "groq"):
        self.llm = ModelLoader(model_provider=model_provider).load_llm()
        self.system_prompt = SYSTEM_PROMPT

        self.tools = [
            *WeatherInfoTool().weather_tool_list,
            *PlaceSearchTool().place_search_tool_list,
            *CalculatorTool().calculator_tool_list,
            *CurrencyConverterTool().currency_converter_tool_list,
        ]

        self.llm_with_tools = self.llm.bind_tools(tools=self.tools, tool_choice="auto")
        self.llm_plain = self.llm  # no tools bound — safe for follow-ups
        self.graph = None

    def _needs_tools(self, messages) -> bool:
        last_human = next(
            (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
        )
        if not last_human:
            return False
        return bool(NEW_TRIP_PATTERNS.search(last_human.content))

    def agent_function(self, state: MessagesState):
        messages = state["messages"]
        if self._needs_tools(messages):
            response = self.llm_with_tools.invoke([self.system_prompt] + messages)
        else:
            response = self.llm_plain.invoke([self.system_prompt] + messages)
        return {"messages": [response]}

    def build_graph(self):
        builder = StateGraph(MessagesState)
        builder.add_node("agent", self.agent_function)
        builder.add_node("tools", ToolNode(tools=self.tools))
        builder.add_edge(START, "agent")
        builder.add_conditional_edges("agent", tools_condition)
        builder.add_edge("tools", "agent")
        builder.add_edge("agent", END)
        self.graph = builder.compile()
        return self.graph

    def __call__(self):
        return self.build_graph()
