import React, { useState } from 'react';
import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { fetchCoordinates, calculateMidpoint, calculateDistance } from './utils';

const mapContainerStyle = {
  height: "400px",
  width: "800px"
};

const libraries = ['places'];

const MapComponent = () => {
  const [location1, setLocation1] = useState('');
  const [location2, setLocation2] = useState('');
  const [midpoint, setMidpoint] = useState(null);
  const [topCoffeeShops, setTopCoffeeShops] = useState([]);

  const fetchCoffeeShops = async (lat, lng) => {
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=cafe](around:5000,${lat},${lng});out;`;

    try {
      const response = await fetch(overpassUrl);
      const data = await response.json();
      const shops = data.elements.map(element => ({
        id: element.id,
        lat: element.lat,
        lon: element.lon,
        name: element.tags.name || "Unnamed Cafe",
        address: element.tags['addr:street'] || "Unknown Address",
        distance: calculateDistance(lat, lng, element.lat, element.lon)
      }));

      // Sort the shops by distance in ascending order
      shops.sort((a, b) => a.distance - b.distance);

      setTopCoffeeShops(shops.slice(0, 3));
    } catch (error) {
      console.error("Error fetching coffee shops:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const coords1 = await fetchCoordinates(location1, apiKey);
    const coords2 = await fetchCoordinates(location2, apiKey);
    if (coords1 && coords2) {
      const calculatedMidpoint = calculateMidpoint(coords1, coords2);
      setMidpoint(calculatedMidpoint);
      fetchCoffeeShops(calculatedMidpoint.lat, calculatedMidpoint.lng);
    } else {
      console.error("One or both locations could not be found.");
    }
  };

  const onMapLoad = (map) => {
    const markers = topCoffeeShops.map(shop => {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: shop.lat, lng: shop.lon },
        title: shop.name
      });
      return marker;
    });
    return markers;
  };

  return (
    <div>
      <h1>Find Coffee Shops Between Two Locations</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Location 1:
          <input
            type="text"
            value={location1}
            onChange={(e) => setLocation1(e.target.value)}
            placeholder="e.g., 266 Derby Road"
            required
          />
        </label>
        <label>
          Location 2:
          <input
            type="text"
            value={location2}
            onChange={(e) => setLocation2(e.target.value)}
            placeholder="e.g., Savoy Cinema"
            required
          />
        </label>
        <button type="submit">Search</button>
      </form>
      {midpoint && (
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} libraries={libraries}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={midpoint}
            zoom={14}
            onLoad={onMapLoad}
          />
        </LoadScript>
      )}
      {topCoffeeShops.length > 0 && (
        <div>
          <h2>Top 3 Coffee Shops Near Midpoint</h2>
          <ul>
            {topCoffeeShops.map((shop, index) => (
              <li key={index}>
                <strong>{shop.name}</strong>: {shop.address}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
