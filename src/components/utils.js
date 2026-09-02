// src/utils.js
// All data comes from free/open APIs:
//  - Geocoding: Nominatim (OpenStreetMap) - free, no key, max 1 req/sec
//  - Places: Overpass API (OpenStreetMap) - free, no key
//  - Driving/walking times: OSRM via FOSSGIS routing.openstreetmap.de - free, no key
//  - Public transport times: TfL Unified API (London only) - free, no key
//  - Ratings (optional): TripAdvisor Content API - free 5,000 calls/month, needs key

// Nominatim is strong on addresses/postcodes but often misses business and
// building names, so fall back to Photon (also free, no key) when it draws a blank.
const geocodeWithNominatim = async (locationName) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
};

const geocodeWithPhoton = async (locationName) => {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(locationName)}&limit=1&lang=en`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const feature = data.features && data.features[0];
  if (!feature || !feature.geometry) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng };
};

export const fetchCoordinates = async (locationName) => {
  for (const geocode of [geocodeWithNominatim, geocodeWithPhoton]) {
    try {
      const coords = await geocode(locationName);
      if (coords) return coords;
    } catch (error) {
      console.error(`Error fetching coordinates for ${locationName}:`, error);
    }
  }
  console.error(`No results found for the specified location: ${locationName}`);
  return null;
};

// Maps the app's search types to OpenStreetMap amenity tags
const OSM_AMENITY_FILTERS = {
  cafe: '^(cafe)$',
  bar: '^(bar|pub|nightclub|biergarten)$',
  restaurant: '^(restaurant|fast_food)$'
};

export const fetchNearbyPlaces = async (lat, lng, radius, searchType) => {
  const amenityFilter = OSM_AMENITY_FILTERS[searchType] || OSM_AMENITY_FILTERS.cafe;
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"${amenityFilter}"]["name"](around:${radius},${lat},${lng});
      way["amenity"~"${amenityFilter}"]["name"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }
  const data = await response.json();

  return data.elements.map((element) => {
    const elemLat = element.lat ?? element.center?.lat;
    const elemLon = element.lon ?? element.center?.lon;
    const tags = element.tags || {};
    return {
      id: `${element.type}/${element.id}`,
      lat: elemLat,
      lon: elemLon,
      name: tags.name,
      address: formatOsmAddress(tags)
    };
  }).filter((place) => place.lat && place.lon && place.name);
};

const formatOsmAddress = (tags) => {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:postcode']
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
};

const formatDuration = (totalMinutes) => {
  if (totalMinutes == null || isNaN(totalMinutes)) return 'N/A';
  const minutes = Math.round(totalMinutes);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} mins`;
};

const fetchOsrmDuration = async (profile, origin, destination) => {
  // profile: 'routed-car' or 'routed-foot'
  const url = `https://routing.openstreetmap.de/${profile}/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
    return formatDuration(data.routes[0].duration / 60);
  }
  return 'N/A';
};

const fetchTflTransitDuration = async (origin, destination) => {
  // TfL only covers London; anywhere else this fails and we show N/A
  const url = `https://api.tfl.gov.uk/Journey/JourneyResults/` +
    `${origin.lat},${origin.lng}/to/${destination.lat},${destination.lng}`;
  const response = await fetch(url);
  if (!response.ok) return 'N/A';
  const data = await response.json();
  if (data.journeys && data.journeys.length > 0) {
    return formatDuration(data.journeys[0].duration);
  }
  return 'N/A';
};

export const getTravelTimes = async (origin, destination) => {
  const safe = (promise) => promise.catch((error) => {
    console.error('Travel time lookup failed:', error);
    return 'N/A';
  });

  const [driving, walking, transit] = await Promise.all([
    safe(fetchOsrmDuration('routed-car', origin, destination)),
    safe(fetchOsrmDuration('routed-foot', origin, destination)),
    safe(fetchTflTransitDuration(origin, destination))
  ]);
  return { driving, walking, transit };
};

// Optional ratings via TripAdvisor Content API (free tier: 5,000 calls/month).
// Uses 2 calls per place (search + details), so only call for the top few results.
export const fetchTripAdvisorRating = async (name, lat, lng, apiKey) => {
  if (!apiKey) return null;
  try {
    const searchUrl = `https://api.content.tripadvisor.com/api/v1/location/search` +
      `?key=${apiKey}&searchQuery=${encodeURIComponent(name)}&latLong=${lat},${lng}&language=en`;
    const searchResponse = await fetch(searchUrl, { headers: { accept: 'application/json' } });
    if (!searchResponse.ok) return null;
    const searchData = await searchResponse.json();
    if (!searchData.data || searchData.data.length === 0) return null;

    const locationId = searchData.data[0].location_id;
    const detailsUrl = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details` +
      `?key=${apiKey}&language=en`;
    const detailsResponse = await fetch(detailsUrl, { headers: { accept: 'application/json' } });
    if (!detailsResponse.ok) return null;
    const details = await detailsResponse.json();
    if (!details.rating) return null;

    return {
      rating: parseFloat(details.rating),
      numReviews: parseInt(details.num_reviews, 10) || 0
    };
  } catch (error) {
    console.error(`TripAdvisor rating lookup failed for ${name}:`, error);
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
