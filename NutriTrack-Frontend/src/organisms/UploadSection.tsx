import React, { useState, useRef, useCallback } from "react";
import Card from "../atoms/Card";
import Button from "../atoms/Button";
import { uploadImage } from "../services/foodDetection";
import type { Detection, DetectionResult } from "../types/nutrition";
import {
  saveDetectionToFirestore,
  saveMealToFirestore,
  saveFoodLogToFirestore,
} from "../services/firestore";
import { useAuth } from "../context/AuthContext";

interface UploadSectionProps {
  onDetectionComplete: (result: DetectionResult) => void;
}

// Color palette for bounding boxes (cycles for multiple detections)
const BBOX_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#06b6d4",
];

const UploadSection: React.FC<UploadSectionProps> = ({
  onDetectionComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [mealType, setMealType] = useState<
    "Breakfast" | "Lunch" | "Dinner" | "Snack"
  >("Lunch");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Handle file selection (from input or drag-drop)
  const processFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setDetections([]); // Clear previous detections
      setImageDimensions(null);
    } else {
      setError("Please select a valid image file (JPG, PNG, etc.).");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Capture natural image dimensions when it loads
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  }, []);

  // --- Drag-and-drop handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Upload file to FastAPI /predict endpoint
  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }
    setIsUploading(true);
    setError(null);
    setDetections([]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await uploadImage(formData);

      // Apply threshold filter before determining final list
      const filteredDetections = result.detections.filter(
        (d) => d.confidence >= confidenceThreshold,
      );

      // Save to Firestore explicitly as per requirements
      if (user) {
        try {
          const foodName =
            filteredDetections
              .map((d) => d.food.replace(/_/g, " "))
              .join(", ") || "Unknown Meal";
          await Promise.all([
            saveDetectionToFirestore(
              user.uid,
              filteredDetections,
              result.nutrition,
            ),
            saveMealToFirestore(user.uid, filteredDetections, result.nutrition),
            saveFoodLogToFirestore(
              user.uid,
              foodName,
              result.nutrition,
              mealType,
              result.imageUrl,
            ),
          ]);
        } catch (dbErr) {
          console.warn("Could not save detection history:", dbErr);
        }
      }

      // Store detections for bounding box rendering
      setDetections(filteredDetections);

      // Pass full result to parent
      if (onDetectionComplete && previewUrl && imageDimensions) {
        onDetectionComplete({
          detections: filteredDetections,
          nutrition: result.nutrition,
          imageUrl: previewUrl, // No remote URL since we disabled Firebase storage
          imageWidth: imageDimensions.width,
          imageHeight: imageDimensions.height,
        });
      }
    } catch (err: unknown) {
      console.error("Upload error details:", err);
      const errorObj = err as { detail?: string; message?: string };
      const message =
        errorObj?.detail || errorObj?.message || String(err) || "Unknown error";
      setError(`Failed to analyze image: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Clear current selection
  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setDetections([]);
    setImageDimensions(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  //   Calculate bounding box position and size based on YOLO output and displayed image dimensions.

  const getBboxStyle = (
    bbox: [number, number, number, number],
    colorIndex: number,
  ) => {
    if (!imageDimensions || !imageRef.current) return {};

    const imgEl = imageRef.current;
    const displayWidth = imgEl.clientWidth;
    const displayHeight = imgEl.clientHeight;

    // Scale from natural image coordinates to displayed coordinates
    const scaleX = displayWidth / imageDimensions.width;
    const scaleY = displayHeight / imageDimensions.height;

    const [x1, y1, x2, y2] = bbox;
    const color = BBOX_COLORS[colorIndex % BBOX_COLORS.length];

    return {
      position: "absolute" as const,
      left: `${x1 * scaleX}px`,
      top: `${y1 * scaleY}px`,
      width: `${(x2 - x1) * scaleX}px`,
      height: `${(y2 - y1) * scaleY}px`,
      border: `2px solid ${color}`,
      borderRadius: "4px",
      pointerEvents: "none" as const,
      boxShadow: `0 0 0 1px rgba(0,0,0,0.1), inset 0 0 0 1px ${color}33`,
    };
  };

  const getLabelStyle = (colorIndex: number) => {
    const color = BBOX_COLORS[colorIndex % BBOX_COLORS.length];
    return {
      position: "absolute" as const,
      top: "-22px",
      left: "-1px",
      backgroundColor: color,
      color: "#fff",
      fontSize: "10px",
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: "3px 3px 0 0",
      whiteSpace: "nowrap" as const,
      lineHeight: "16px",
      letterSpacing: "0.02em",
    };
  };

  return (
    <Card className="p-0 overflow-visible">
      <div className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          ></span>
          AI Food Recognition
        </h3>
        <p className="text-sm text-slate-500 mb-5">
          Upload a photo of your meal and let AI detect food items.
        </p>

        {/* Drag-and-drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !previewUrl && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload food image"
          onKeyDown={(e) => {
            if (e.key === "Enter") fileInputRef.current?.click();
          }}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 p-6 text-center
            ${
              isDragging
                ? "border-emerald-400 bg-emerald-50/70 scale-[1.01]"
                : previewUrl
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/30"
            }`}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            aria-label="Choose food image"
          />

          {previewUrl ? (
            /* Image preview with bounding box overlays */
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative w-full max-w-md mx-auto"
                ref={containerRef}
              >
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Preview of selected food"
                  className="w-full h-auto max-h-80 object-contain rounded-xl shadow-md"
                  onLoad={handleImageLoad}
                />

                {/* Bounding box overlays */}
                {detections.length > 0 && imageDimensions && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      width: imageRef.current?.clientWidth,
                      height: imageRef.current?.clientHeight,
                      margin: "0 auto",
                    }}
                  >
                    {detections
                      .filter((det) => det.confidence >= confidenceThreshold)
                      .map((det, i) => (
                        <div
                          key={`bbox-${i}`}
                          style={getBboxStyle(det.bbox, i)}
                        >
                          <span style={getLabelStyle(i)}>
                            {det.food.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-base font-bold shadow-md hover:bg-red-600 transition-colors z-10"
                  aria-label="Remove selected image"
                >
                  ×
                </button>
              </div>
              <p className="text-sm font-medium text-slate-700 truncate max-w-xs">
                {selectedFile?.name}
              </p>
            </div>
          ) : (
            /* Upload placeholder */
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-700">
                  Drag & drop your food image here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  or click to browse • JPG, PNG supported
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Meal Type & Filter Controls */}
        {/* <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Meal Type</label>
                        <div className="flex gap-2">
                            {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMealType(m as any)}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${
                                        mealType === m 
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02]' 
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="confidence-threshold" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            Confidence: {Math.round(confidenceThreshold * 100)}%
                        </label>
                        <div className="flex items-center h-full pt-1">
                            <input
                                id="confidence-threshold"
                                type="range"
                                min="0.1"
                                max="0.95"
                                step="0.05"
                                value={confidenceThreshold}
                                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>
                </div> */}

        {/* Error message */}
        {error && (
          <div
            className="mt-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Success summary (when detections exist) */}
        {detections.length > 0 && !error && (
          <div className="mt-3 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-200 flex items-center gap-2">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Detected {detections.length} food item
            {detections.length !== 1 ? "s" : ""} successfully!
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex-1 py-3"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                {/* Loading spinner */}
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Analyze Food"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default UploadSection;
