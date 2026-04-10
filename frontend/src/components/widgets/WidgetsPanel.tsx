import WeatherCard from "../insights/WeatherCard";
import MapView from "../map/MapView";

export default function WidgetsPanel() {
  return (
    <div className="h-full min-h-0 p-4 flex flex-col gap-4 backdrop-blur-xl">
      <WeatherCard />
      <div className="flex-1 min-h-0">
        <MapView />
      </div>
    </div>
  );
}
