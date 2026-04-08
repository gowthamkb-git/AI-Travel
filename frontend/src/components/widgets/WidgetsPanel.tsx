import WeatherCard from "../insights/WeatherCard";
import CurrencyCard from "../insights/CurrencyCard";
import ExpenseCard from "../insights/ExpenseCard";
import MapView from "../map/MapView";
import PlacesList from "../places/PlacesList";

export default function WidgetsPanel() {
  return (
    <div className="h-full p-4 space-y-4 overflow-y-auto backdrop-blur-xl">

      <WeatherCard />
      <CurrencyCard />
      <ExpenseCard />
      <MapView />
      <PlacesList />

    </div>
  );
}