// src/utils.js
export const fetchCoordinates = async (locationName, apiKey) => {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${apiKey}`;
  
    try {
      const response = await fetch(geocodeUrl);
      const data = await response.json();
      console.log(`Geocoding response for ${locationName}:`, data); // Log the full API response
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      } else {
        console.error(`No results found for the specified location: ${locationName}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching coordinates for ${locationName}:`, error);
      return null;
    }
  };
  
  export const calculateMidpoint = (coords1, coords2) => {
    const lat1 = (coords1.lat * Math.PI) / 180;
    const lon1 = (coords1.lng * Math.PI) / 180;
    const lat2 = (coords2.lat * Math.PI) / 180;
    const lon2 = (coords2.lng * Math.PI) / 180;
  
    const dLon = lon2 - lon1;
    const Bx = Math.cos(lat2) * Math.cos(dLon);
    const By = Math.cos(lat2) * Math.sin(dLon);
  
    const midLat = Math.atan2(
      Math.sin(lat1) + Math.sin(lat2),
      Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)
    );
    const midLon = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);
  
    return { lat: (midLat * 180) / Math.PI, lng: (midLon * 180) / Math.PI };
  };
  
  export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };
  
  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };
  