import React, { useState, useEffect } from 'react';
import { fetchCoordinates, calculateMidpoint, calculateDistance } from './utils';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = {
  height: "400px",
  width: "100%",
  maxWidth: "100vw",
  margin: "0 auto"
};

const libraries = ['places'];

const Legend = () => {
  return (
    <div className="bg-base-100 p-4 rounded-box shadow-md mt-4">
      <h3 className="text-lg font-semibold mb-2">Legend</h3>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-error mr-2"></div>
        <span>Coffee Shops</span>
      </div>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-success mr-2"></div>
        <span>Midpoint</span>
      </div>
      <div className="flex items-center mb-2">
        <div className="w-5 h-5 bg-info mr-2"></div>
        <span>Selected Locations</span>
      </div>
      <div className="flex items-center">
        <div className="w-5 h-5 bg-secondary mr-2"></div>
        <span>Current Location</span>
      </div>
    </div>
  );
};

const MapComponent = () => {
  const [location1, setLocation1] = useState('266 Derby Road NG7 1PR');
  const [location2, setLocation2] = useState('Pret a Manger Nottingham');
  const [midpoint, setMidpoint] = useState(null);
  const [topCoffeeShops, setTopCoffeeShops] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [coords1, setCoords1] = useState(null);
  const [coords2, setCoords2] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [selectedShop, setSelectedShop] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          console.log("Current location set:", { lat: latitude, lng: longitude }); // Added console log
        },
        (error) => {
          console.error("Error getting current location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  const fetchCoffeeShops = async (lat, lng) => {
    try {
      // Create a new instance of the PlacesService
      const map = new window.google.maps.Map(document.createElement('div'));
      const service = new window.google.maps.places.PlacesService(map);
  
      // Create a request object for the nearby search
      const request = {
        location: new window.google.maps.LatLng(lat, lng),
        radius: 1000, // 5000 meters = 5km
        type: 'cafe',
      };
  
      // Make the nearby search request
      const results = await new Promise((resolve, reject) => {
        service.nearbySearch(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            resolve(results);
          } else {
            reject(new Error(`Places API request failed with status: ${status}`));
          }
        });
      });
  
      // Process the results
      const shopsData = results.map(place => ({
        id: place.place_id,
        lat: place.geometry.location.lat(),
        lon: place.geometry.location.lng(),
        name: place.name,
        address: place.vicinity,
        googleRating: place.rating || 0,
        googleStars: Math.round(place.rating) || 0,
        userRatingsTotal: place.user_ratings_total || 0,
        distance: calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng()),
      }));
  
      // Sort and set the top coffee shops
      const sortedShops = shopsData.sort((a, b) => a.distance - b.distance);
      setTopCoffeeShops(sortedShops.slice(0, 5));
  
    } catch (error) {
      console.error("Error fetching coffee shops:", error);
      setTopCoffeeShops([]);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    const coords1 = await fetchCoordinates(location1, apiKey);
    const coords2 = await fetchCoordinates(location2, apiKey);
    setCoords1(coords1);
    setCoords2(coords2);
    if (coords1 && coords2) {
      const calculatedMidpoint = calculateMidpoint(coords1, coords2);
      setMidpoint(calculatedMidpoint);
      setMapCenter(calculatedMidpoint);

      // Calculate the distance between the two locations
      const distance = calculateDistance(
        coords1.lat,
        coords1.lng,
        coords2.lat,
        coords2.lng
      );

      // Adjust the zoom level based on the distance
      const zoomLevel = distance < 5 ? 14 : distance < 10 ? 12 : 10;
      setMapZoom(zoomLevel);

      fetchCoffeeShops(calculatedMidpoint.lat, calculatedMidpoint.lng);
    } else {
      console.error("One or both locations could not be found.");
    }
  };

  const handleMarkerClick = (shop) => {
    setSelectedShop(shop);
  };

  const handleInfoWindowClose = () => {
    setSelectedShop(null);
  };

  const iconUrls = {
    green: '/images/green-dot.png',
    blue: '/images/blue-dot.png',
    red: '/images/red-dot.png',
    purple: '/images/purple-dot.png'
    
    
  };

  const GoogleRating = ({ rating, totalRatings }) => {
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

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-800">
      <h1 className="text-4xl font-bold mb-8 text-center text-white">Find Artisanal Coffee Shops</h1>
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
          <button type="submit" className="btn btn-accent self-end">Search</button>
        </div>
      </form>
      <div className="mb-8">
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} libraries={libraries}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter || currentLocation || { lat: 0, lng: 0 }}
            zoom={mapZoom}
          >
          {midpoint && <Marker position={midpoint} icon={{ url: iconUrls.green }} />}
          {coords1 && <Marker position={coords1} icon={{ url: iconUrls.blue }} />}
          {coords2 && <Marker position={coords2} icon={{ url: iconUrls.blue }} />}
          {currentLocation && <Marker position={currentLocation} icon={{ url: iconUrls.purple }} />}
          {topCoffeeShops.map((shop, index) => (
            <Marker
              key={shop.id}
              position={{ lat: shop.lat, lng: shop.lon }}
              icon={{ url: iconUrls.red }}
              onClick={() => handleMarkerClick(shop)}
            />
          ))}
          {selectedShop && (
            <InfoWindow
              position={{ lat: selectedShop.lat, lng: selectedShop.lon }}
              onCloseClick={handleInfoWindowClose}
            >
              <div>
                <h3>{selectedShop.name}</h3>
                <p>{selectedShop.address}</p>
                {selectedShop.location && <p>{selectedShop.location}</p>}

                <GoogleMap
                  mapContainerStyle={{ height: '200px', width: '300px' }}
                  center={{ lat: selectedShop.lat, lng: selectedShop.lon }}
                  zoom={16}
                >
                  <Marker position={{ lat: selectedShop.lat, lng: selectedShop.lon }} />
                </GoogleMap>
              </div>
            </InfoWindow>
          )}
          </GoogleMap>
        </LoadScript>
      </div>
      <Legend />
      {topCoffeeShops.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">Top 5 Artisanal Coffee Shops Near Midpoint</h2>
          <div className="space-y-4">
            {topCoffeeShops.map((shop, index) => (
              <div key={index} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">{shop.name}</h3>
                  <p>Address: {shop.address}</p>
                  <GoogleRating rating={shop.googleRating} totalRatings={shop.userRatingsTotal} />
                  {shop.location && (
                    <p>{shop.location}</p>
                  )}
                  
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