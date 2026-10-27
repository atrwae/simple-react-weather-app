import { useState, useRef } from "react";
import { UpdateFetchesTodayTracker } from './App.tsx';

export type Place = { id: number; name: string; admin1?: string; country: string; latitude: number; longitude: number };

export function LocationSearch({ onSelect }: { onSelect: (p: Place) => void }) {
  const [results, setResults] = useState<Place[]>([]);

    const timer = useRef<number>(0);

    const search = (name: string) => {
      clearTimeout(timer.current);
        if (name.length < 2) return setResults([]);
        timer.current = window.setTimeout(async () =>
        {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=pl`);
            UpdateFetchesTodayTracker(1);
            console.log("External API fetch -> fetching G-OM cities data");
            setResults((await res.json()).results ?? []);

        }, 500);
  };

  return (
      <div style={{ display: "inline-block" }}>
          <input placeholder="Wpisz miasto..." onChange={(e) => search(e.target.value)} />
          <ul style={{
              position: "absolute", backgroundColor: "#2a326b", textAlign: "left",
              borderRadius: "12px", padding: "0 15px 0 30px", width: "max-content"
          }}>
            {results.map((p) => (
                <li key={p.id} onClick={() => { onSelect(p); setResults([]); }}>
                {p.name}, {p.admin1 ? `${p.admin1}, ` : ""}{p.country}
                </li>
            ))}
        </ul>
    </div>
  );
}
