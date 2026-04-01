import os
from app.utils.weather_info import WeatherForecastTool
from langchain.tools import tool
from typing import List
from dotenv import load_dotenv

load_dotenv()


class WeatherInfoTool:
    def __init__(self):
        self.weather_service = WeatherForecastTool(os.environ.get("OPENWEATHERMAP_API_KEY"))
        self.weather_tool_list = self._setup_tools()

    def _setup_tools(self) -> List:
        @tool
        def get_current_weather(city: str) -> str:
            """Get current weather for a city"""
            data = self.weather_service.get_current_weather(city)
            if data:
                temp = data.get("main", {}).get("temp", "N/A")
                desc = data.get("weather", [{}])[0].get("description", "N/A")
                return f"Current weather in {city}: {temp}°C, {desc}"
            return f"Could not fetch weather for {city}"

        @tool
        def get_weather_forecast(city: str) -> str:
            """Get weather forecast for a city"""
            data = self.weather_service.get_forecast_weather(city)
            if data and "list" in data:
                summary = [
                    f"{item['dt_txt'].split(' ')[0]}: {item['main']['temp']}°C, {item['weather'][0]['description']}"
                    for item in data["list"]
                ]
                return f"Weather forecast for {city}:\n" + "\n".join(summary)
            return f"Could not fetch forecast for {city}"

        return [get_current_weather, get_weather_forecast]
