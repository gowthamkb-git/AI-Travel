from app.agent.agentic_workflow import GraphBuilder
from app.exception.exceptionhandling import TripPlannerException
from app.logger.logging import logger
from app.schemas.trip_schema import TripResponse, ChatMessage
from app.utils.widget_extractor import extract_widgets
from langchain_core.messages import HumanMessage, AIMessage
from typing import List


class TripService:
    def get_trip_plan(self, question: str, model_provider: str = "gemini", history: List[ChatMessage] = []) -> TripResponse:
        try:
            logger.info(f"Building graph with provider: {model_provider}")
            graph = GraphBuilder(model_provider=model_provider)()

            messages = []
            for msg in history:
                if msg.role == "human":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    # Truncate long AI messages (trip plans) to save tokens
                    content = msg.content[:800] + "...[truncated]" if len(msg.content) > 800 else msg.content
                    messages.append(AIMessage(content=content))
            messages.append(HumanMessage(content=question))

            output = graph.invoke({"messages": messages})

            if isinstance(output, dict) and "messages" in output:
                answer = output["messages"][-1].content
            else:
                answer = str(output)

            widgets = extract_widgets(answer)
            return TripResponse(answer=answer, widgets=widgets)
        except Exception as e:
            logger.error(f"TripService error: {e}")
            raise TripPlannerException(str(e))
