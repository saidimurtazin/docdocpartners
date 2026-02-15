import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ClinicLocation {
  id: number;
  name: string;
  city: string;
  address?: string;
  type?: string;
  lat: number;
  lng: number;
  specializations?: string;
  phone?: string;
}

interface ClinicMapProps {
  clinics: ClinicLocation[];
  className?: string;
  height?: string;
}

// Custom marker icon using our brand colors
const createCustomIcon = (isActive: boolean) =>
  L.divIcon({
    className: "custom-clinic-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        background: ${isActive ? "linear-gradient(135deg, #1a2f5a, #3b5998)" : "#6b7280"};
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(26, 47, 90, 0.4);
        border: 2px solid white;
        transition: transform 0.2s;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
          line-height: 1;
        ">+</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });

// City coordinates for Russian cities
const cityCoordinates: Record<string, [number, number]> = {
  "Москва": [55.7558, 37.6173],
  "Санкт-Петербург": [59.9343, 30.3351],
  "Казань": [55.7887, 49.1221],
  "Новосибирск": [55.0084, 82.9357],
  "Краснодар": [45.0355, 38.9753],
  "Екатеринбург": [56.8389, 60.6057],
  "Нижний Новгород": [56.2965, 43.9361],
  "Самара": [53.1959, 50.1004],
  "Ростов-на-Дону": [47.2357, 39.7015],
  "Уфа": [54.7388, 55.9721],
  "Воронеж": [51.6720, 39.1843],
  "Волгоград": [48.7080, 44.5133],
  "Красноярск": [56.0184, 92.8672],
  "Пермь": [58.0105, 56.2502],
  "Тюмень": [57.1553, 65.5341],
  "Сочи": [43.5854, 39.7231],
  "Калининград": [54.7104, 20.4522],
};

export default function ClinicMap({ clinics, className = "", height = "500px" }: ClinicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [activeClinic, setActiveClinic] = useState<ClinicLocation | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map centered on Russia
    const map = L.map(mapRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
    }).setView([55.7558, 49.0], 5);

    // Add zoom control to bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Use CartoDB Positron tiles for a clean, modern look
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || clinics.length === 0) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const bounds: L.LatLngBoundsExpression = [];

    clinics.forEach((clinic) => {
      let lat = clinic.lat;
      let lng = clinic.lng;

      // If no coordinates, try to get from city
      if ((!lat || !lng) && clinic.city) {
        const coords = cityCoordinates[clinic.city];
        if (coords) {
          lat = coords[0] + (Math.random() - 0.5) * 0.05;
          lng = coords[1] + (Math.random() - 0.5) * 0.05;
        }
      }

      if (!lat || !lng) return;

      const marker = L.marker([lat, lng], { icon: createCustomIcon(true) });

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; min-width: 200px; padding: 4px;">
          <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 6px; color: #1a2f5a;">${clinic.name}</h3>
          ${clinic.city ? `<p style="font-size: 13px; color: #6b7280; margin: 0 0 4px;">${clinic.city}${clinic.address ? `, ${clinic.address}` : ""}</p>` : ""}
          ${clinic.type ? `<span style="display: inline-block; padding: 2px 8px; background: #f0f4ff; color: #3b5998; border-radius: 12px; font-size: 11px; font-weight: 600;">${clinic.type}</span>` : ""}
          ${clinic.specializations ? `<p style="font-size: 12px; color: #9ca3af; margin: 6px 0 0;">${clinic.specializations}</p>` : ""}
          ${clinic.phone ? `<p style="font-size: 12px; margin: 4px 0 0;"><a href="tel:${clinic.phone}" style="color: #3b5998; text-decoration: none;">${clinic.phone}</a></p>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 280,
        className: "clinic-popup",
      });

      marker.addTo(map);
      bounds.push([lat, lng] as [number, number]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 10 });
    }
  }, [clinics]);

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 ${className}`}>
      {/* Map gradient overlay at top */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background/60 to-transparent z-[400] pointer-events-none" />

      <div ref={mapRef} style={{ height, width: "100%" }} className="z-0" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[400] glass-card rounded-xl px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#1a2f5a] to-[#3b5998]" />
          <span className="text-foreground font-medium">{clinics.length} клиник на карте</span>
        </div>
      </div>
    </div>
  );
}
