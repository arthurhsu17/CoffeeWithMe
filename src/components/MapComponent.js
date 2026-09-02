import React, { useState, useEffect } from 'react';
import {
  fetchCoordinates,
  fetchNearbyPlaces,
  getTravelTimes,
  fetchTripAdvisorRating,
  calculateMidpoint,
  calculateDistance
} from './utils';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SEARCH_RADIUS_METERS = 1500;
const TOP_SHOP_COUNT = 5;

const makeIcon = (url) => L.icon({
  iconUrl: url,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const icons = {
  green: makeIcon('/images/green-dot.png'),
  blue: makeIcon('/images/blue-dot.png'),
  red: makeIcon('/images/red-dot.png'),
  purple: makeIcon('/images/purple-dot.png')
};

const iconUrls = {
  driving: '/images/car-driving.png',
  walking: '/images/man-walking.png',
  transit: '/images/public-transport.png'
};

// MapContainer only reads center/zoom on mount, so push updates imperatively
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  return null;
};

const Legend = ({searchType}) => {
  return (
    <div className="bg-white p-4 rounded-box shadow-md mt-4">
      <h3 className="text-lg font-semibold mb-2">Legend</h3>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-red-500 rounded-full mr-2"></div>
        <span>{searchType === 'cafe' ? 'Coffee Shops' : searchType === 'bar' ? 'Bars/Pubs' : 'Restaurants'}</span>
      </div>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-green-500 rounded-full mr-2"></div>
        <span>Midpoint</span>
      </div>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-blue-500 rounded-full mr-2"></div>
        <span>Selected Locations</span>
      </div>
      <div className="flex items-center">
        <div className="w-5 h-5 bg-purple-500 rounded-full mr-2"></div>
        <span>Current Location</span>
      </div>
    </div>
  );
};

const MapComponent = () => {
  const [location1, setLocation1] = useState('Dollar Bay Point E14 9BX');
  const [location2, setLocation2] = useState('Chinatown London');
  const [midpoint, setMidpoint] = useState(null);
  const [topCoffeeShops, setTopCoffeeShops] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [coords1, setCoords1] = useState(null);
  const [coords2, setCoords2] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [searchType, setSearchType] = useState('cafe');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          console.log("Current location set:", { lat: latitude, lng: longitude });
        },
        (error) => {
          console.error("Error getting current location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  const fetchPlaces = async (lat, lng, origin1, origin2, type) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const places = await fetchNearbyPlaces(lat, lng, SEARCH_RADIUS_METERS, type);

      // Sort by distance from the midpoint and only enrich the top few,
      // so we stay well within the free routing/rating rate limits
      const nearest = places
        .map(place => ({
          ...place,
          distance: calculateDistance(lat, lng, place.lat, place.lon)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, TOP_SHOP_COUNT);

      const tripAdvisorKey = process.env.REACT_APP_TRIPADVISOR_API_KEY;
      const shopsData = [];
      for (const place of nearest) {
        const shopCoords = { lat: place.lat, lng: place.lon };
        const [travelTimes1, travelTimes2, taRating] = await Promise.all([
          getTravelTimes(origin1, shopCoords),
          getTravelTimes(origin2, shopCoords),
          fetchTripAdvisorRating(place.name, place.lat, place.lon, tripAdvisorKey)
        ]);
        shopsData.push({
          ...place,
          rating: taRating ? taRating.rating : null,
          numReviews: taRating ? taRating.numReviews : 0,
          travelTimes1,
          travelTimes2
        });
      }

      setTopCoffeeShops(shopsData);
      if (shopsData.length === 0) {
        setErrorMessage("No places found near the midpoint. Try a different search type.");
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      setTopCoffeeShops([]);
      setErrorMessage("Something went wrong fetching places. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    if (midpoint && coords1 && coords2 && !isLoading) {
      fetchPlaces(midpoint.lat, midpoint.lng, coords1, coords2, type);
    }
  };

  const TravelTimes = ({ location, drivingTime, walkingTime, transitTime }) => (
    <div className="mt-2">
      <p className="font-semibold">From {location}:</p>
      <p className="ml-2 flex items-center">
        <img src={iconUrls.driving} alt="Driving" className="h-5 w-5 mr-1" />
        Driving: <span className="font-medium ml-1">{drivingTime}</span>
      </p>
      <p className="ml-2 flex items-center">
        <img src={iconUrls.walking} alt="Walking" className="h-5 w-5 mr-1" />
        Walking: <span className="font-medium ml-1">{walkingTime}</span>
      </p>
      <p className="ml-2 flex items-center">
        <img src={iconUrls.transit} alt="Public Transport" className="h-5 w-5 mr-1" />
        Public Transport: <span className="font-medium ml-1">{transitTime}</span>
      </p>
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    // Nominatim asks for max 1 request/second, so geocode one at a time
    const newCoords1 = await fetchCoordinates(location1);
    const newCoords2 = await fetchCoordinates(location2);
    setCoords1(newCoords1);
    setCoords2(newCoords2);
    if (newCoords1 && newCoords2) {
      const calculatedMidpoint = calculateMidpoint(newCoords1, newCoords2);
      setMidpoint(calculatedMidpoint);
      setMapCenter(calculatedMidpoint);

      const distance = calculateDistance(
        newCoords1.lat,
        newCoords1.lng,
        newCoords2.lat,
        newCoords2.lng
      );
      const zoomLevel = distance < 5 ? 14 : distance < 10 ? 12 : 10;
      setMapZoom(zoomLevel);

      fetchPlaces(calculatedMidpoint.lat, calculatedMidpoint.lng, newCoords1, newCoords2, searchType);
    } else {
      setErrorMessage("One or both locations could not be found.");
    }
  };

  const StarRating = ({ rating, totalRatings }) => {
    if (rating == null) {
      return <p className="text-sm opacity-70 mt-2 mb-2">No rating data available</p>;
    }
    return (
      <div className="flex items-center mt-2 mb-2">
        <div className="rating rating-sm">
          {[...Array(5)].map((_, i) => (
            <input
              key={i}
              type="radio"
              name={`rating-${rating}`}
              className="mask mask-star-2 bg-orange-400"
              checked={i < Math.round(rating)}
              readOnly
            />
          ))}
        </div>
        <span className="ml-2 text-sm opacity-70">
          {rating.toFixed(1)} ({totalRatings})
        </span>
      </div>
    );
  };

  const defaultCenter = { lat: 51.5074, lng: -0.1278 }; // London
  const center = mapCenter || currentLocation || defaultCenter;

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-800">
      <h1 className="text-4xl font-bold mb-8 text-center text-white">Find Your Next Meetup Spot</h1>
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="form-control flex-1">
            <label className="label">
              <span className="label-text">Location 1</span>
            </label>
            <input
              type="text"
              value={location1}
              onChange={(e) => setLocation1(e.target.value)}
              placeholder="e.g., 266 Derby Road"
              required
              className="input input-bordered w-full"
            />
          </div>
          <div className="form-control flex-1">
            <label className="label">
              <span className="label-text">Location 2</span>
            </label>
            <input
              type="text"
              value={location2}
              onChange={(e) => setLocation2(e.target.value)}
              placeholder="e.g., Savoy Cinema"
              required
              className="input input-bordered w-full"
            />
          </div>
          <button type="submit" className="btn btn-accent self-end" disabled={isLoading}>
            {isLoading ? <span className="loading loading-spinner loading-sm"></span> : 'Search'}
          </button>
        </div>
      </form>
      <div className="flex justify-center mb-4">
        <button
          onClick={() => handleSearchTypeChange('cafe')}
          className={`btn mx-2 ${searchType === 'cafe' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Cafes
        </button>
        <button
          onClick={() => handleSearchTypeChange('bar')}
          className={`btn mx-2 ${searchType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Bars/Pubs
        </button>
        <button
          onClick={() => handleSearchTypeChange('restaurant')}
          className={`btn mx-2 ${searchType === 'restaurant' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Restaurants
        </button>
      </div>
      {errorMessage && (
        <div className="alert alert-warning mb-4">
          <span>{errorMessage}</span>
        </div>
      )}
      <div className="mb-8">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={mapZoom}
          style={{ height: "400px", width: "100%", maxWidth: "100vw", margin: "0 auto" }}
        >
          <MapUpdater center={center} zoom={mapZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {midpoint && <Marker position={[midpoint.lat, midpoint.lng]} icon={icons.green} />}
          {coords1 && <Marker position={[coords1.lat, coords1.lng]} icon={icons.blue} />}
          {coords2 && <Marker position={[coords2.lat, coords2.lng]} icon={icons.blue} />}
          {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={icons.purple} />}
          {topCoffeeShops.map((shop) => (
            <Marker
              key={shop.id}
              position={[shop.lat, shop.lon]}
              icon={icons.red}
            >
              <Popup>
                <div>
                  <h3 className="font-semibold">{shop.name}</h3>
                  <p>{shop.address}</p>
                  <p>{shop.distance.toFixed(2)} km from midpoint</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <Legend searchType={searchType} />
      {topCoffeeShops.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Top 5 {searchType === 'cafe' ? 'Coffee Shops' : searchType === 'bar' ? 'Bars/Pubs' : 'Restaurants'} Near Midpoint
          </h2>
          <div className="space-y-4">
            {topCoffeeShops.map((shop, index) => (
              <div key={index} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title text-xl">{shop.name}</h3>
                  <p className="text-gray-600">{shop.address}</p>
                  <StarRating rating={shop.rating} totalRatings={shop.numReviews} />
                  <TravelTimes
                    location={location1}
                    drivingTime={shop.travelTimes1.driving}
                    walkingTime={shop.travelTimes1.walking}
                    transitTime={shop.travelTimes1.transit}
                  />
                  <TravelTimes
                    location={location2}
                    drivingTime={shop.travelTimes2.driving}
                    walkingTime={shop.travelTimes2.walking}
                    transitTime={shop.travelTimes2.transit}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
