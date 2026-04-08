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
        def search_attractions(city: str) -> str:
            """Search attractions of a city or destination"""
            try:
                result = self.google.google_search_attractions(city)
                if result:
                    return f"Attractions in {city} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_attractions(city)
                return f"Google failed ({e}). Attractions in {city} (Tavily): {result}"

        @tool
        def search_restaurants(city: str) -> str:
            """Search restaurants of a city or destination"""
            try:
                result = self.google.google_search_restaurants(city)
                if result:
                    return f"Restaurants in {city} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_restaurants(city)
                return f"Google failed ({e}). Restaurants in {city} (Tavily): {result}"

        @tool
        def search_activities(city: str) -> str:
            """Search activities of a city or destination"""
            try:
                result = self.google.google_search_activity(city)
                if result:
                    return f"Activities in {city} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_activity(city)
                return f"Google failed ({e}). Activities in {city} (Tavily): {result}"

        @tool
        def search_transportation(city: str) -> str:
            """Search transportation options of a city or destination"""
            try:
                result = self.google.google_search_transportation(city)
                if result:
                    return f"Transportation in {city} (Google): {result}"
            except Exception as e:
                result = self.tavily.tavily_search_transportation(city)
                return f"Google failed ({e}). Transportation in {city} (Tavily): {result}"

        return [search_attractions, search_restaurants, search_activities, search_transportation]
