import React, { useState, useEffect } from 'react';
import { fetchCoordinates, calculateMidpoint, calculateDistance } from './utils';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = {
  height: "400px",
  width: "800px"
};

const libraries = ['places'];

const Legend = () => {
  return (
    <div style={{ background: 'white', padding: '10px', borderRadius: '5px', marginTop: '10px' }}>
      <h3>Legend</h3>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: 'red', marginRight: '5px' }}></div>
        <span>Coffee Shops</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: 'green', marginRight: '5px' }}></div>
        <span>Midpoint</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: 'blue', marginRight: '5px' }}></div>
        <span>Selected Locations</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '20px', height: '20px', backgroundColor: 'purple', marginRight: '5px' }}></div>
        <span>Current Location</span>
      </div>
    </div>
  );
};


const MapComponent = () => {
  const [location1, setLocation1] = useState('33 Rochester Drive');
  const [location2, setLocation2] = useState('23 Newton Road');
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
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=cafe](around:5000,${lat},${lng});out;`;
  
    try {
      const response = await fetch(overpassUrl);
      const data = await response.json();
      const shops = data.elements.map(element => {
        const name = element.tags.name || element.tags['brand'] || "Unnamed Cafe";
        let address = "Address not available";
        let location = "";
        let additionalInfo = [];
        
        if (element.tags['addr:street']) {
          address = element.tags['addr:street'];
          if (element.tags['addr:housenumber']) {
            address = `${element.tags['addr:housenumber']} ${address}`;
          }
        } else if (element.tags['addr:full']) {
          address = element.tags['addr:full'];
        }
  
        if (element.tags['located_in']) {
          location = `Located in: ${element.tags['located_in']}`;
        } else if (element.tags['located_in:name']) {
          location = `Located in: ${element.tags['located_in:name']}`;
        }
  
        // Collect additional information
        for (const [key, value] of Object.entries(element.tags)) {
          if (!['name', 'brand', 'amenity', 'addr:street', 'addr:housenumber', 'addr:full', 'located_in', 'located_in:name'].includes(key)) {
            additionalInfo.push(`${key}: ${value}`);
          }
        }
  
        return {
          id: element.id,
          lat: element.lat,
          lon: element.lon,
          name: name,
          address: address,
          location: location,
          additionalInfo: additionalInfo,
          distance: calculateDistance(lat, lng, element.lat, element.lon)
        };
      });
  
      // Sort the shops by distance in ascending order
      shops.sort((a, b) => a.distance - b.distance);
  
      setTopCoffeeShops(shops.slice(0, 5));
    } catch (error) {
      console.error("Error fetching coffee shops:", error);
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
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} libraries={libraries}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter || currentLocation || { lat: 0, lng: 0 }}
          zoom={mapZoom}
        >
          {midpoint && <Marker position={midpoint} options={{ icon: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' } }} />}
          {coords1 && <Marker position={coords1} options={{ icon: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' } }} />}
          {coords2 && <Marker position={coords2} options={{ icon: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' } }} />}
          {currentLocation && <Marker position={currentLocation} options={{ icon: { url: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png' } }} />}
          {topCoffeeShops.map(shop => (
            <Marker
              key={shop.id}
              position={{ lat: shop.lat, lng: shop.lon }}
              options={{ icon: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' } }}
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
                {selectedShop.additionalInfo.length > 0 && (
                  <>
                    <p>Additional Information:</p>
                    <ul>
                      {selectedShop.additionalInfo.map((info, i) => (
                        <li key={i}>{info}</li>
                      ))}
                    </ul>
                  </>
                )}
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
      <Legend />
      {topCoffeeShops.length > 0 && (
        <div>
          <h2>Top 5 Coffee Shops Near Midpoint</h2>
          <ul>
            {topCoffeeShops.map((shop, index) => (
              <li key={index}>
                <strong>{shop.name}</strong>
                <br />
                Address: {shop.address}
                {shop.location && (
                  <>
                    <br />
                    {shop.location}
                  </>
                )}
                {shop.additionalInfo.length > 0 && (
                  <>
                    <br />
                    Additional Information:
                    <ul>
                      {shop.additionalInfo.map((info, i) => (
                        <li key={i}>{info}</li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MapComponent;