import { useState, useEffect } from 'react';
import { GeoState } from '../types';

export const useGeolocation = () => {
  const [geo, setGeo] = useState<GeoState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo(prev => ({ ...prev, error: "Geolocation is not supported by your browser", loading: false }));
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setGeo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        error: null,
        loading: false,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMsg = "Unknown GPS Error";
      switch(error.code) {
          case error.PERMISSION_DENIED: errorMsg = "User denied the request for Geolocation."; break;
          case error.POSITION_UNAVAILABLE: errorMsg = "Location information is unavailable."; break;
          case error.TIMEOUT: errorMsg = "The request to get user location timed out."; break;
      }
      setGeo(prev => ({ ...prev, error: errorMsg, loading: false }));
    };

    // Use watchPosition for continuous updates
    const watcherId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0 // Force fresh readings
    });

    return () => {
      navigator.geolocation.clearWatch(watcherId);
    };
  }, []);

  return geo;
};