import os
from app.utils.place_info_search import GooglePlaceSearchTool, TavilyPlaceSearchTool
from langchain.tools import tool
from typing import List
from dotenv import load_dotenv

load_dotenv()


class PlaceSearchTool:
    def __init__(self):
        self.google = GooglePlaceSearchTool(os.environ.get("GPLACES_API_KEY"))
        self.tavily = TavilyPlaceSearchTool()
        self.place_search_tool_list = self._setup_tools()

    def _setup_tools(self) -> List:
        @tool
        def search_attractions(place: str) -> str:
            """Search attractions of a place"""
            try:
                result = self.google.google_search_attractions(place)
                if result:
                    return f"Attractions in {place} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_attractions(place)
                return f"Google failed ({e}). Attractions in {place} (Tavily): {result}"

        @tool
        def search_restaurants(place: str) -> str:
            """Search restaurants of a place"""
            try:
                result = self.google.google_search_restaurants(place)
                if result:
                    return f"Restaurants in {place} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_restaurants(place)
                return f"Google failed ({e}). Restaurants in {place} (Tavily): {result}"

        @tool
        def search_activities(place: str) -> str:
            """Search activities of a place"""
            try:
                result = self.google.google_search_activity(place)
                if result:
                    return f"Activities in {place} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_activity(place)
                return f"Google failed ({e}). Activities in {place} (Tavily): {result}"

        @tool
        def search_transportation(place: str) -> str:
            """Search transportation options of a place"""
            try:
                result = self.google.google_search_transportation(place)
                if result:
                    return f"Transportation in {place} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_transportation(place)
                return f"Google failed ({e}). Transportation in {place} (Tavily): {result}"

        return [search_attractions, search_restaurants, search_activities, search_transportation]
