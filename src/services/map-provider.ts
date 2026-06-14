export interface MapViewState {
  center: {
    lng: number;
    lat: number;
  };
  zoom: number;
}

export interface MapProvider {
  init(container: HTMLElement, view: MapViewState): Promise<void>;
  destroy(): void;
  setView(view: MapViewState): void;
  getView(): MapViewState | null;
}
