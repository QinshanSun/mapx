import { Check, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CHINA_CITIES, normalizeCityName } from "@/data/china-cities";
import { updateDefaultCity } from "@/services/settings-service";
import type { FirstLaunchSettings } from "@/types/settings";

interface SettingsPanelProps {
  settings: FirstLaunchSettings;
  onChange: (settings: FirstLaunchSettings) => void;
  onError: (error: unknown) => void;
}

export function SettingsPanel({ settings, onChange, onError }: SettingsPanelProps) {
  const citySelectRef = useRef<HTMLSelectElement>(null);
  const [selectedCity, setSelectedCity] = useState(normalizeCityName(settings.defaultCity));
  const [isSaving, setIsSaving] = useState(false);
  const currentCity = CHINA_CITIES.find((city) => city.name === selectedCity) ?? CHINA_CITIES[0];
  const hasChanges = selectedCity !== normalizeCityName(settings.defaultCity);

  async function saveCity() {
    setIsSaving(true);
    try {
      const cityToSave = normalizeCityName(citySelectRef.current?.value ?? selectedCity);
      const nextSettings = await updateDefaultCity(cityToSave, settings);
      onChange(nextSettings);
      setSelectedCity(nextSettings.defaultCity);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <section className="rounded-lg border border-border p-4">
        <label className="block text-sm font-medium" htmlFor="settings-default-city">
          默认城市
          <select
            ref={citySelectRef}
            id="settings-default-city"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            value={selectedCity}
            onInput={(event) => setSelectedCity(event.currentTarget.value)}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            {CHINA_CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
          <p>城市中心：{currentCity.centerLng.toFixed(4)}, {currentCity.centerLat.toFixed(4)}</p>
          <p>百度 AK：{settings.baiduAk ? "已配置" : "未配置"}</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasChanges || isSaving}
            onClick={() => setSelectedCity(normalizeCityName(settings.defaultCity))}
          >
            <RotateCcw />
            恢复
          </Button>
          <Button type="button" size="sm" disabled={!hasChanges || isSaving} onClick={saveCity}>
            <Check />
            保存城市
          </Button>
        </div>
      </section>
    </div>
  );
}
