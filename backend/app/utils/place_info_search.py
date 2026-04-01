import os
from langchain_tavily import TavilySearch
from langchain_google_community import GooglePlacesTool, GooglePlacesAPIWrapper


class GooglePlaceSearchTool:
    def __init__(self, api_key: str):
        self.places_wrapper = GooglePlacesAPIWrapper(gplaces_api_key=api_key)
        self.places_tool = GooglePlacesTool(api_wrapper=self.places_wrapper)

    def google_search_attractions(self, place: str):
        return self.places_tool.run(f"top attractive places in and around {place}")

    def google_search_restaurants(self, place: str):
        return self.places_tool.run(f"what are the top 10 restaurants and eateries in and around {place}?")

    def google_search_activity(self, place: str):
        return self.places_tool.run(f"Activities in and around {place}")

    def google_search_transportation(self, place: str):
        return self.places_tool.run(f"What are the different modes of transportations available in {place}")


class TavilyPlaceSearchTool:
    def _search(self, query: str):
        tool = TavilySearch(topic="general", include_answer="advanced")
        result = tool.invoke({"query": query})
        if isinstance(result, dict) and result.get("answer"):
            return result["answer"]
        return result

    def tavily_search_attractions(self, place: str):
        return self._search(f"top attractive places in and around {place}")

    def tavily_search_restaurants(self, place: str):
        return self._search(f"what are the top 10 restaurants and eateries in and around {place}.")

    def tavily_search_activity(self, place: str):
        return self._search(f"activities in and around {place}")

    def tavily_search_transportation(self, place: str):
        return self._search(f"What are the different modes of transportations available in {place}")
