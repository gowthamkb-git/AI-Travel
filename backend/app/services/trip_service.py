from app.agent.agentic_workflow import GraphBuilder
from app.exception.exceptionhandling import TripPlannerException
from app.logger.logging import logger
from app.schemas.trip_schema import Coordinates
from app.utils.budget_insights import build_budget_insight
from app.utils.conversation_memory import resolve_locked_destination
from app.utils.destination_resolver import format_resolved_location, resolve_destination
from app.utils.currency_insights import build_currency_insight
from app.utils.live_weather import fetch_live_weather
from app.schemas.trip_schema import TripResponse, ChatMessage, WeatherData, WidgetData
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
ROUGH_OUTLINE_PATTERNS = re.compile(
    r"(here'?s a rough outline|i'?d be happy to help|now, let me calculate|<function=|rough outline)",
    re.IGNORECASE,
)
SEASON_FOLLOWUP_PATTERNS = re.compile(
    r"\b(best seasons? to visit|best season to visit|best time to visit|which is the best season|when to visit)\b",
    re.IGNORECASE,
)
WEATHER_FOLLOWUP_PATTERNS = re.compile(
    r"\b(weather|forecast|temperature|climate|rain|humidity|wind)\b",
    re.IGNORECASE,
)
BUDGET_FOLLOWUP_PATTERNS = re.compile(
    r"\b(budget|cost|expense|price|pricing|daily spend|per day|total spend|total cost)\b",
    re.IGNORECASE,
)
HOTEL_FOLLOWUP_PATTERNS = re.compile(
    r"\b(hotel|hotels|stay|stays|accommodation|accommodations|resort|homestay|guest house|guesthouse|lodging)\b",
    re.IGNORECASE,
)
RESTAURANT_FOLLOWUP_PATTERNS = re.compile(
    r"\b(restaurant|restaurants|food|eat|eating|dining|cafe|cafes|local food|where to eat)\b",
    re.IGNORECASE,
)
PLACE_FOLLOWUP_PATTERNS = re.compile(
    r"\b(must visit places?|top places?|best places?|tourist places?|attractions?|sightseeing|spots to visit|places to visit)\b",
    re.IGNORECASE,
)
EXTEND_FOLLOWUP_PATTERNS = re.compile(
    r"\b(extend|another\s+\d+\s*days?|extra\s+\d+\s*days?|add\s+\d+\s*days?|spend\s+another|for\s+another\s+\d+\s*days?)\b",
    re.IGNORECASE,
)


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
    def _destination_coords(self, locked_destination: Optional[dict]) -> Optional[Coordinates]:
        if not locked_destination:
            return None
        if locked_destination.get("lat") is None or locked_destination.get("lon") is None:
            return None
        return Coordinates(
            lat=float(locked_destination["lat"]),
            lng=float(locked_destination["lon"]),
        )

    def _history_text(self, history: Optional[List[ChatMessage]]) -> str:
        return "\n".join(
            message.content.strip()
            for message in history or []
            if getattr(message, "content", "").strip()
        )

    def _latest_assistant_text(self, history: Optional[List[ChatMessage]]) -> str:
        for message in reversed(history or []):
            if message.role in {"assistant", "ai"} and getattr(message, "content", "").strip():
                return message.content.strip()
        return ""

    def _best_budget_source(self, history: Optional[List[ChatMessage]]) -> str:
        budget_markers = (
            "detailed cost breakdown",
            "budget breakdown",
            "cost breakdown",
            "transportation:",
            "accommodation:",
            "food:",
            "activities:",
            "total:",
        )

        for message in reversed(history or []):
            if message.role not in {"assistant", "ai"}:
                continue
            content = getattr(message, "content", "").strip()
            if not content:
                continue
            lowered = content.lower()
            if any(marker in lowered for marker in budget_markers):
                return content

        return self._latest_assistant_text(history)

    def _history_weather_snapshot(self, history: Optional[List[ChatMessage]], location_name: str) -> Optional[WeatherData]:
        text = self._latest_assistant_text(history)
        if not text:
            return None

        temperature_match = re.search(r"Temperature:\s*([^\n]+)", text, re.IGNORECASE)
        condition_match = re.search(r"Conditions:\s*([^\n]+)", text, re.IGNORECASE)
        if not temperature_match and not condition_match:
            return None

        return WeatherData(
            temp=temperature_match.group(1).strip() if temperature_match else None,
            condition=condition_match.group(1).strip() if condition_match else None,
            location=location_name,
            season=None,
        )

    def _destination_only_response(
        self,
        answer: str,
        locked_destination: dict,
        widgets: Optional[WidgetData] = None,
    ) -> TripResponse:
        return TripResponse(
            answer=answer,
            widgets=widgets,
            destination=format_resolved_location(locked_destination),
            destination_coords=self._destination_coords(locked_destination),
        )

    def _is_season_followup(self, question: str) -> bool:
        return bool(SEASON_FOLLOWUP_PATTERNS.search(question))

    def _is_weather_followup(self, question: str) -> bool:
        return bool(WEATHER_FOLLOWUP_PATTERNS.search(question))

    def _is_budget_followup(self, question: str) -> bool:
        return bool(BUDGET_FOLLOWUP_PATTERNS.search(question))

    def _is_hotel_followup(self, question: str) -> bool:
        return bool(HOTEL_FOLLOWUP_PATTERNS.search(question))

    def _is_restaurant_followup(self, question: str) -> bool:
        return bool(RESTAURANT_FOLLOWUP_PATTERNS.search(question))

    def _is_place_followup(self, question: str) -> bool:
        return bool(PLACE_FOLLOWUP_PATTERNS.search(question))

    def _is_extend_followup(self, question: str) -> bool:
        return bool(EXTEND_FOLLOWUP_PATTERNS.search(question))

    def _build_season_followup_response(
        self,
        question: str,
        history: Optional[List[ChatMessage]],
        locked_destination: dict,
    ) -> TripResponse:
        location_name = format_resolved_location(locked_destination)
        weather = self._history_weather_snapshot(history, location_name) or fetch_live_weather(
            question,
            resolved_location=locked_destination,
        )

        lines = [
            f"The best time to visit {location_name} is usually from October to February.",
            "",
            "Season guide:",
            "1. October to February: Best overall season with more comfortable weather for sightseeing.",
            "2. March to May: Warmer months, still workable if you are okay with hotter afternoons.",
            "3. June to September: Monsoon period with more rain, greener scenery, and fewer crowds.",
        ]

        if weather and weather.condition:
            lines.extend(
                [
                    "",
                    f"Current weather snapshot: {weather.temp or 'N/A'} with {weather.condition.lower()} in {location_name}.",
                ]
            )

        return self._destination_only_response(
            "\n".join(lines),
            locked_destination,
            WidgetData(weather=weather, currency=None, budget=None),
        )

    def _build_weather_followup_response(
        self,
        question: str,
        history: Optional[List[ChatMessage]],
        locked_destination: dict,
    ) -> TripResponse:
        location_name = format_resolved_location(locked_destination)
        weather = self._history_weather_snapshot(history, location_name) or fetch_live_weather(
            question,
            resolved_location=locked_destination,
        )

        if weather:
            lines = [
                f"Current weather in {location_name}: {weather.temp or 'N/A'} with {weather.condition or 'current conditions unavailable'}.",
            ]
            if weather.feels_like:
                lines.append(f"It feels like {weather.feels_like}.")
            if weather.humidity:
                lines.append(f"Humidity is around {weather.humidity}.")
            if weather.wind_speed:
                lines.append(f"Wind speed is about {weather.wind_speed}.")
            if weather.best_time_to_visit:
                lines.append(f"Best travel season note: {weather.best_time_to_visit}")
        else:
            lines = [
                f"I couldn't fetch the live weather for {location_name} right now.",
                "The most comfortable travel season is usually October to February.",
            ]

        return self._destination_only_response(
            "\n".join(lines),
            locked_destination,
            WidgetData(weather=weather, currency=None, budget=None),
        )

    def _build_budget_followup_response(
        self,
        question: str,
        history: Optional[List[ChatMessage]],
        current_location: Optional[Coordinates],
        locked_destination: dict,
    ) -> TripResponse:
        location_name = format_resolved_location(locked_destination)
        budget = build_budget_insight(
            question,
            self._best_budget_source(history),
            current_location,
            locked_destination,
        )

        if budget:
            lines = [f"Budget snapshot for {location_name}:"]
            if budget.total_destination:
                lines.append(f"1. Estimated total at destination: {budget.total_destination}.")
            elif budget.total:
                lines.append(f"1. Estimated total: {budget.total}.")
            if budget.per_day_destination:
                lines.append(f"2. Estimated daily spend: {budget.per_day_destination}.")
            elif budget.per_day:
                lines.append(f"2. Estimated daily spend: {budget.per_day}.")
            if budget.breakdown:
                breakdown_lines = [
                    value
                    for value in [
                        f"Accommodation: {budget.breakdown.accommodation}" if budget.breakdown.accommodation else None,
                        f"Food: {budget.breakdown.food}" if budget.breakdown.food else None,
                        f"Transport: {budget.breakdown.transport}" if budget.breakdown.transport else None,
                        f"Activities: {budget.breakdown.activities}" if budget.breakdown.activities else None,
                    ]
                    if value
                ]
                if breakdown_lines:
                    lines.append("3. Budget breakdown: " + ", ".join(breakdown_lines) + ".")
            if budget.exchange_text:
                lines.append(f"4. {budget.exchange_text}")
        else:
            lines = [
                f"I couldn't build a reliable budget breakdown for {location_name} from the current trip context yet.",
                "Try asking for a refreshed trip plan with budget, days, and traveler count together.",
            ]

        return self._destination_only_response(
            "\n".join(lines),
            locked_destination,
            WidgetData(weather=None, currency=None, budget=budget),
        )

    def _build_llm_focused_response(
        self,
        builder: GraphBuilder,
        history: Optional[List[ChatMessage]],
        question: str,
        locked_destination: dict,
        topic_instruction: str,
    ) -> TripResponse:
        location_name = format_resolved_location(locked_destination)
        messages = [
            HumanMessage(
                content=(
                    f"Planner context: the locked destination is {location_name}. "
                    "Do not switch to any other city, state, or country."
                )
            )
        ]
        for msg in history or []:
            if msg.role in {"human", "user"}:
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        messages.append(
            HumanMessage(
                content=(
                    f"{topic_instruction} Answer only the user's latest follow-up about {location_name}. "
                    "Do not repeat the full itinerary, trip summary, transport plan, budget section, or unrelated widgets."
                )
            )
        )
        messages.append(HumanMessage(content=question))

        focused = builder.synthesize_answer(messages)
        answer = focused.content if hasattr(focused, "content") else str(focused)
        if isinstance(answer, list):
            answer = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in answer
            )
        answer = _sanitize_raw_tool_calls(answer)
        return self._destination_only_response(answer, locked_destination, None)

    def _build_extension_followup_response(
        self,
        builder: GraphBuilder,
        history: Optional[List[ChatMessage]],
        question: str,
        locked_destination: dict,
    ) -> TripResponse:
        location_name = format_resolved_location(locked_destination)
        messages = [
            HumanMessage(
                content=(
                    f"Planner context: the locked destination is {location_name}. "
                    "Do not switch to any other city, state, or country."
                )
            )
        ]
        for msg in history or []:
            if msg.role in {"human", "user"}:
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        messages.append(
            HumanMessage(
                content=(
                    "The user wants to extend the existing trip, not restart it. "
                    "Continue from the already planned trip and add only the extra days/budget requested now. "
                    "Use new places or activities where possible instead of repeating the same stops. "
                    "Return only the extension plan in clean markdown with: short title, one-line intro, added Day sections only, "
                    "then an Incremental Cost Breakdown and short budget tips. "
                    "Do not repeat the original trip from Day 1. "
                    "Do not change the destination."
                )
            )
        )
        messages.append(HumanMessage(content=question))

        focused = builder.synthesize_answer(messages)
        answer = focused.content if hasattr(focused, "content") else str(focused)
        if isinstance(answer, list):
            answer = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in answer
            )
        answer = _sanitize_raw_tool_calls(answer)
        return self._destination_only_response(answer, locked_destination, None)

    def _should_format_trip_response(self, question: str, answer: str) -> bool:
        if ITINERARY_OUTPUT_PATTERNS.search(answer):
            return True
        if TRIP_FORMAT_PATTERNS.search(question):
            return True
        return False

    def _needs_itinerary_rewrite(self, question: str, answer: str) -> bool:
        if not TRIP_FORMAT_PATTERNS.search(question):
            return False
        if RAW_TOOL_CALL_PATTERN.search(answer):
            return True
        if ROUGH_OUTLINE_PATTERNS.search(answer):
            return True
        if not re.search(r"\bday\s*1\b", answer, re.IGNORECASE):
            return True
        return False

    def _rewrite_trip_itinerary(
        self,
        builder: GraphBuilder,
        history: Optional[List[ChatMessage]],
        question: str,
        locked_destination: Optional[dict],
        draft_answer: str,
        current_location_text: Optional[str],
    ) -> str:
        location_name = format_resolved_location(locked_destination) if locked_destination else None
        messages = []
        if location_name:
            messages.append(
                HumanMessage(
                    content=f"Locked destination: {location_name}. Keep the trip strictly for this destination."
                )
            )
        if current_location_text:
            messages.append(HumanMessage(content=f"Origin context: the traveler is currently in {current_location_text}."))
        for msg in history or []:
            if msg.role in {"human", "user"}:
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        messages.append(HumanMessage(content=question))
        messages.append(
            HumanMessage(
                content=(
                    "Rewrite the trip into a polished final itinerary. "
                    "Return only the final answer in clean markdown with this structure: "
                    "title line, one-line intro, Day 1 to Day N headings, each with Morning/Afternoon/Evening, "
                    "then a Cost Breakdown section and short Budget Tips section. "
                    "Do not include tool syntax, raw calculations, XML/function tags, or planning narration. "
                    f"Current rough draft:\n{draft_answer}"
                )
            )
        )

        rewritten = builder.synthesize_answer(messages)
        answer = rewritten.content if hasattr(rewritten, "content") else str(rewritten)
        if isinstance(answer, list):
            answer = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in answer
            )
        return _sanitize_raw_tool_calls(answer)

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
        model_provider: str = "huggingface",
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
            has_prior_context = bool(history)

            if has_prior_context and locked_destination and self._is_season_followup(normalized_question):
                return self._build_season_followup_response(normalized_question, history, locked_destination)

            if has_prior_context and locked_destination and self._is_weather_followup(normalized_question):
                return self._build_weather_followup_response(normalized_question, history, locked_destination)

            if has_prior_context and locked_destination and self._is_budget_followup(normalized_question):
                return self._build_budget_followup_response(
                    normalized_question,
                    history,
                    current_location,
                    locked_destination,
                )

            if has_prior_context and locked_destination and self._is_extend_followup(normalized_question):
                return self._build_extension_followup_response(
                    builder,
                    history,
                    normalized_question,
                    locked_destination,
                )

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
            if has_prior_context and locked_destination and self._is_hotel_followup(normalized_question):
                return self._build_llm_focused_response(
                    builder,
                    history,
                    normalized_question,
                    locked_destination,
                    "Recommend a few practical stay options or stay areas with short reasons.",
                )
            if has_prior_context and locked_destination and self._is_restaurant_followup(normalized_question):
                return self._build_llm_focused_response(
                    builder,
                    history,
                    normalized_question,
                    locked_destination,
                    "Recommend a few practical restaurant or food suggestions with short reasons.",
                )
            if has_prior_context and locked_destination and self._is_place_followup(normalized_question):
                return self._build_llm_focused_response(
                    builder,
                    history,
                    normalized_question,
                    locked_destination,
                    "Recommend the strongest must-visit tourist places or attractions with short reasons.",
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

            if self._needs_itinerary_rewrite(normalized_question, answer):
                answer = self._rewrite_trip_itinerary(
                    builder,
                    history,
                    normalized_question,
                    locked_destination,
                    answer,
                    current_location_text,
                )

            return self._build_trip_response(normalized_question, answer, current_location, locked_destination)
        except Exception as e:
            logger.error(f"TripService error: {e}")
            raise TripPlannerException(str(e))
