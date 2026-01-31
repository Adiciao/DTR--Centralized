import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, MapPin, SignalHigh, SignalLow, SignalMedium, Navigation, Loader2, AlertCircle } from 'lucide-react';
import { GeoState } from '../types';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
  geo: GeoState;
  locationName: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose, geo, locationName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  
  // Specific state for the high-accuracy fetch process
  const [refiningLocation, setRefiningLocation] = useState(true);
  
  // Ensure video is actually playing before allowing capture
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    startCamera();
    // Trigger a dedicated high-accuracy fetch on mount to "wake up" the GPS specifically for this action
    triggerHighAccuracyFetch();
    
    return () => {
      stopCamera();
    };
  }, []);

  const triggerHighAccuracyFetch = () => {
      setRefiningLocation(true);
      if(navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (pos) => {
                  // We don't strictly need to store this since the hook in Dashboard updates `geo` prop,
                  // but this call forces the hardware to prioritize location.
                  // We simulate a small delay to show the user we are "locking on".
                  setTimeout(() => setRefiningLocation(false), 800);
              },
              (err) => {
                  console.warn("High accuracy fetch failed, relying on cached position", err);
                  setRefiningLocation(false);
              },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
      } else {
          setRefiningLocation(false);
      }
  };

  const startCamera = async () => {
    try {
      setIsCameraReady(false); // Reset ready state
      // Use 'environment' for rear camera
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setError("Unable to access camera. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!isCameraReady) return;

    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        const { videoWidth, videoHeight } = videoRef.current;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
        
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        stopCamera();
        onCapture(dataUrl);
      }
    }
  };

  // Accuracy Helpers
  const getAccuracyColor = (acc: number | null) => {
      if (!acc) return 'text-gray-400';
      if (acc <= 20) return 'text-green-500';
      if (acc <= 100) return 'text-yellow-500';
      return 'text-red-500';
  };

  const getAccuracyLabel = (acc: number | null) => {
      if (!acc) return 'No Signal';
      if (acc <= 20) return 'Excellent';
      if (acc <= 100) return 'Good';
      return 'Weak';
  };

  const getSignalIcon = (acc: number | null) => {
      if (!acc) return <SignalLow className="w-4 h-4 text-gray-400" />;
      if (acc <= 20) return <SignalHigh className="w-4 h-4 text-green-500" />;
      if (acc <= 100) return <SignalMedium className="w-4 h-4 text-yellow-500" />;
      return <SignalLow className="w-4 h-4 text-red-500" />;
  };

  const isCaptureDisabled = refiningLocation || !isCameraReady;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-between">
      
      {/* Top Bar */}
      <div className="w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Camera className="w-4 h-4 text-blue-400" /> 
                Clock In Verification
            </h3>
            {refiningLocation ? (
                 <p className="text-[10px] text-blue-300 flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Refining Location...
                </p>
            ) : (
                <p className="text-[10px] text-gray-300">Take a clear photo of yourself</p>
            )}
        </div>
        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition backdrop-blur-sm">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Main Viewfinder */}
      <div className="relative w-full flex-1 bg-black flex flex-col justify-center">
        {error ? (
          <div className="text-white p-6 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
            <p>{error}</p>
          </div>
        ) : (
            <>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    onCanPlay={() => setIsCameraReady(true)}
                    className="w-full h-full object-cover"
                />
                
                {/* Location Dashboard Overlay */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Fake Map Icon / Tile */}
                        <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden relative opacity-90 border border-slate-600">
                             {/* Abstract Map Pattern */}
                             <div className="absolute inset-0 bg-slate-700">
                                 <div className="w-[120%] h-[2px] bg-slate-500 absolute top-1/3 -left-1 rotate-12"></div>
                                 <div className="w-[120%] h-[2px] bg-slate-500 absolute top-2/3 -left-1 -rotate-6"></div>
                                 <div className="w-[2px] h-[120%] bg-slate-500 absolute left-1/2 -top-1"></div>
                                 <div className="w-2 h-2 bg-blue-500 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg border border-white"></div>
                             </div>
                        </div>
                        
                        <div className="flex flex-col">
                            <h4 className="text-white font-bold text-xs flex items-center gap-1">
                                {locationName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-gray-300">
                                    {geo.lat ? `${geo.lat.toFixed(5)}, ${geo.lng?.toFixed(5)}` : 'Waiting for GPS...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                             <span className={`text-[10px] font-bold ${getAccuracyColor(geo.accuracy)}`}>
                                 {getAccuracyLabel(geo.accuracy)}
                             </span>
                             {getSignalIcon(geo.accuracy)}
                        </div>
                        <span className="text-[9px] text-gray-500">
                            Accuracy: {geo.accuracy ? `~${Math.round(geo.accuracy)}m` : 'N/A'}
                        </span>
                    </div>
                </div>
            </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Bottom Controls */}
      <div className="w-full p-6 bg-black flex justify-center pb-8 z-10">
        {!error && (
          <button 
            onClick={handleCapture}
            disabled={isCaptureDisabled}
            className={`w-18 h-18 p-1 rounded-full border-4 transition-all shadow-lg flex items-center justify-center
                ${isCaptureDisabled 
                    ? 'border-gray-500 cursor-not-allowed opacity-50' 
                    : 'border-white cursor-pointer active:scale-95 hover:border-blue-400'}
            `}
          >
            <div className={`w-16 h-16 rounded-full ${isCaptureDisabled ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}></div>
          </button>
        )}
        {error && (
          <button 
              onClick={() => { setError(''); startCamera(); triggerHighAccuracyFetch(); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
              <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        )}
      </div>
    </div>
  );
};