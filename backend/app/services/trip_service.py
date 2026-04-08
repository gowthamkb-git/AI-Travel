from app.agent.agentic_workflow import GraphBuilder
from app.exception.exceptionhandling import TripPlannerException
from app.logger.logging import logger
from app.schemas.trip_schema import Coordinates
from app.utils.budget_insights import build_budget_insight
from app.utils.conversation_memory import resolve_locked_destination
from app.utils.destination_resolver import format_resolved_location, resolve_destination
from app.utils.currency_insights import build_currency_insight
from app.utils.live_weather import fetch_live_weather
from app.schemas.trip_schema import TripResponse, ChatMessage, WeatherData
from app.utils.response_formatter import format_trip_response
from app.utils.widget_extractor import extract_widgets
from langchain_core.messages import HumanMessage, AIMessage
from typing import List, Optional
import re
import requests


RAW_TOOL_CALL_PATTERN = re.compile(r"\(function=[^)]+\>.*?</function\)", re.IGNORECASE | re.DOTALL)
TRIP_FORMAT_PATTERNS = re.compile(r"\b(plan|trip|travel|visit|itinerary|days?\b|from\b|to\b)\b", re.IGNORECASE)
ITINERARY_OUTPUT_PATTERNS = re.compile(r"(day\s+\d+|popular spots|off-?beat|cost breakdown|hotel options|transportation)", re.IGNORECASE)
TOOL_LEAK_PATTERNS = re.compile(r"(let me call .*tool|i(?:'| wi)ll need to .*tool|need to call the .*tool)", re.IGNORECASE)


def _sanitize_raw_tool_calls(text: str) -> str:
    cleaned = RAW_TOOL_CALL_PATTERN.sub("", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _extract_detailed_plan(text: str) -> str:
    if "## Detailed Plan" in text:
        return text.split("## Detailed Plan", 1)[1].strip()
    return text.strip()


def _reverse_geocode_current_location(current_location: Optional[Coordinates]) -> Optional[str]:
    if not current_location:
        return None

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": current_location.lat,
                "lon": current_location.lng,
                "format": "jsonv2",
                "addressdetails": 1,
            },
            headers={"User-Agent": "ai-trip-planner/1.0"},
            timeout=10,
        )
        if response.status_code != 200:
            return None

        data = response.json()
        address = data.get("address") or {}
        locality = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("state")
        )
        country = address.get("country")
        parts = [part for part in [locality, country] if part]
        return ", ".join(parts) if parts else None
    except Exception:
        return None


class TripService:
    def _should_format_trip_response(self, question: str, answer: str) -> bool:
        if ITINERARY_OUTPUT_PATTERNS.search(answer):
            return True
        if TRIP_FORMAT_PATTERNS.search(question):
            return True
        return False

    def _build_trip_response(
        self,
        question: str,
        answer: str,
        current_location: Optional[Coordinates] = None,
        locked_destination: Optional[dict] = None,
    ) -> TripResponse:
        detailed_answer = _extract_detailed_plan(answer)
        widgets = extract_widgets(detailed_answer)
        resolved = locked_destination or resolve_destination(question, detailed_answer)
        live_weather = fetch_live_weather(question, detailed_answer, resolved)
        live_currency = build_currency_insight(question, detailed_answer, current_location, resolved)
        live_budget = build_budget_insight(question, detailed_answer, current_location, resolved)

        if live_weather:
            widgets.weather = live_weather
        elif not widgets.weather and resolved:
            widgets.weather = WeatherData(location=format_resolved_location(resolved))

        if live_currency:
            widgets.currency = live_currency
        if live_budget:
            widgets.budget = live_budget

        destination = (
            (widgets.weather.location if widgets.weather else None)
            or (format_resolved_location(resolved) if resolved else None)
        )
        destination_coords = (
            Coordinates(lat=float(resolved["lat"]), lng=float(resolved["lon"]))
            if resolved and resolved.get("lat") is not None and resolved.get("lon") is not None
            else None
        )
        formatted_answer = (
            format_trip_response(detailed_answer, widgets)
            if self._should_format_trip_response(question, detailed_answer)
            else detailed_answer
        )
        return TripResponse(
            answer=formatted_answer,
            widgets=widgets,
            destination=destination,
            destination_coords=destination_coords,
        )

    def restore_trip_details(
        self,
        question: str,
        answer: str,
        current_location: Optional[Coordinates] = None,
        location_context: Optional[str] = None,
    ) -> TripResponse:
        try:
            normalized_question, locked_destination = resolve_locked_destination(
                question,
                location_context=location_context,
            )
            return self._build_trip_response(normalized_question, answer, current_location, locked_destination)
        except Exception as e:
            logger.error(f"Trip restore error: {e}")
            raise TripPlannerException(str(e))

    def get_trip_plan(
        self,
        question: str,
        model_provider: str = "groq",
        history: Optional[List[ChatMessage]] = None,
        current_location: Optional[Coordinates] = None,
        location_context: Optional[str] = None,
    ) -> TripResponse:
        try:
            logger.info(f"Building graph with provider: {model_provider}")
            builder = GraphBuilder(model_provider=model_provider)
            graph = builder()

            normalized_question, locked_destination = resolve_locked_destination(
                question,
                history=history,
                location_context=location_context,
            )
            locked_location_name = format_resolved_location(locked_destination) if locked_destination else None

            messages = []
            if locked_location_name:
                messages.append(
                    HumanMessage(
                        content=(
                            f"Planner context: the locked destination for this request is {locked_location_name}. "
                            "Use this exact destination for weather, attractions, currency, budget, and map-related guidance. "
                            "Do not switch to another city, state, or country unless the user explicitly changes destination."
                        )
                    )
                )
            for msg in history or []:
                if msg.role in {"human", "user"}:
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))
            current_location_text = _reverse_geocode_current_location(current_location)
            if current_location and current_location_text:
                messages.append(
                    HumanMessage(
                        content=(
                            f"Planner context: the user's current live location is {current_location_text}. "
                            "Use this as the trip origin and do not ask the user for their current location again."
                        )
                    )
                )
            messages.append(HumanMessage(content=normalized_question))

            output = graph.invoke({"messages": messages})

            if isinstance(output, dict) and "messages" in output:
                answer = output["messages"][-1].content
                if isinstance(answer, list):
                    answer = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in answer
                    )
            else:
                answer = str(output)

            sanitized_answer = _sanitize_raw_tool_calls(answer)
            if sanitized_answer != answer or len(sanitized_answer.strip()) < 40:
                if isinstance(output, dict) and "messages" in output:
                    repaired = builder.synthesize_answer(output["messages"])
                    answer = repaired.content if hasattr(repaired, "content") else str(repaired)
                    if isinstance(answer, list):
                        answer = "".join(
                            part.get("text", "") if isinstance(part, dict) else str(part)
                            for part in answer
                        )
                    answer = _sanitize_raw_tool_calls(answer)
                else:
                    answer = sanitized_answer

            if current_location and re.search(r"(tell me|please tell me).*(current (city|location)|where you are)", answer, re.IGNORECASE):
                messages.append(
                    HumanMessage(
                        content=(
                            "You already know the user's current live location from planner context. "
                            "Do not ask for it again. Produce the full trip plan now."
                        )
                    )
                )
                repaired = builder.synthesize_answer(messages)
                answer = repaired.content if hasattr(repaired, "content") else str(repaired)
                if isinstance(answer, list):
                    answer = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in answer
                    )
                answer = _sanitize_raw_tool_calls(answer)

            if TOOL_LEAK_PATTERNS.search(answer):
                messages.append(
                    HumanMessage(
                        content=(
                            "Do not mention tools. Answer the user's latest question directly and clearly using the current conversation context."
                        )
                    )
                )
                repaired = builder.synthesize_answer(messages)
                answer = repaired.content if hasattr(repaired, "content") else str(repaired)
                if isinstance(answer, list):
                    answer = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in answer
                    )
                answer = _sanitize_raw_tool_calls(answer)

            return self._build_trip_response(normalized_question, answer, current_location, locked_destination)
        except Exception as e:
            logger.error(f"TripService error: {e}")
            raise TripPlannerException(str(e))
