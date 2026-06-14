export interface ChinaCity {
  name: string;
  centerLng: number;
  centerLat: number;
}

export const CHINA_CITIES: ChinaCity[] = [
  { name: "上海", centerLng: 121.4737, centerLat: 31.2304 },
  { name: "北京", centerLng: 116.4074, centerLat: 39.9042 },
  { name: "深圳", centerLng: 114.0579, centerLat: 22.5431 },
  { name: "广州", centerLng: 113.2644, centerLat: 23.1291 },
  { name: "杭州", centerLng: 120.1551, centerLat: 30.2741 },
  { name: "成都", centerLng: 104.0665, centerLat: 30.5728 },
  { name: "重庆", centerLng: 106.5516, centerLat: 29.563 },
  { name: "武汉", centerLng: 114.3054, centerLat: 30.5931 },
  { name: "南京", centerLng: 118.7969, centerLat: 32.0603 },
  { name: "西安", centerLng: 108.9398, centerLat: 34.3416 },
  { name: "苏州", centerLng: 120.5853, centerLat: 31.2989 },
  { name: "天津", centerLng: 117.2009, centerLat: 39.0842 },
  { name: "青岛", centerLng: 120.3826, centerLat: 36.0671 },
  { name: "宁波", centerLng: 121.5504, centerLat: 29.8746 },
  { name: "厦门", centerLng: 118.0894, centerLat: 24.4798 },
  { name: "福州", centerLng: 119.2965, centerLat: 26.0745 },
  { name: "长沙", centerLng: 112.9388, centerLat: 28.2282 },
  { name: "郑州", centerLng: 113.6254, centerLat: 34.7466 },
  { name: "济南", centerLng: 117.1201, centerLat: 36.6512 },
  { name: "合肥", centerLng: 117.2272, centerLat: 31.8206 },
  { name: "昆明", centerLng: 102.8329, centerLat: 24.8801 },
  { name: "南宁", centerLng: 108.3669, centerLat: 22.817 },
  { name: "贵阳", centerLng: 106.6302, centerLat: 26.647 },
  { name: "南昌", centerLng: 115.8582, centerLat: 28.6829 },
  { name: "太原", centerLng: 112.5489, centerLat: 37.8706 },
  { name: "石家庄", centerLng: 114.5149, centerLat: 38.0428 },
  { name: "沈阳", centerLng: 123.4315, centerLat: 41.8057 },
  { name: "大连", centerLng: 121.6147, centerLat: 38.914 },
  { name: "长春", centerLng: 125.3235, centerLat: 43.8171 },
  { name: "哈尔滨", centerLng: 126.5349, centerLat: 45.8038 },
  { name: "呼和浩特", centerLng: 111.7492, centerLat: 40.8426 },
  { name: "兰州", centerLng: 103.8343, centerLat: 36.0611 },
  { name: "西宁", centerLng: 101.7782, centerLat: 36.6171 },
  { name: "银川", centerLng: 106.2309, centerLat: 38.4872 },
  { name: "乌鲁木齐", centerLng: 87.6168, centerLat: 43.8256 },
  { name: "海口", centerLng: 110.1983, centerLat: 20.044 },
  { name: "三亚", centerLng: 109.5119, centerLat: 18.2528 },
  { name: "拉萨", centerLng: 91.1172, centerLat: 29.6469 },
  { name: "无锡", centerLng: 120.3119, centerLat: 31.4912 },
  { name: "佛山", centerLng: 113.1214, centerLat: 23.0218 },
  { name: "东莞", centerLng: 113.7518, centerLat: 23.0207 },
  { name: "珠海", centerLng: 113.5767, centerLat: 22.2707 },
  { name: "惠州", centerLng: 114.4168, centerLat: 23.1115 },
  { name: "中山", centerLng: 113.3926, centerLat: 22.5176 },
  { name: "温州", centerLng: 120.6994, centerLat: 27.9949 },
  { name: "泉州", centerLng: 118.6757, centerLat: 24.8741 },
  { name: "烟台", centerLng: 121.4479, centerLat: 37.4638 },
  { name: "洛阳", centerLng: 112.454, centerLat: 34.6197 },
  { name: "南通", centerLng: 120.8943, centerLat: 31.9802 },
];

const CITY_NAMES = new Set(CHINA_CITIES.map((city) => city.name));

export function isSupportedCityName(cityName: string) {
  return CITY_NAMES.has(cityName.trim());
}

export function normalizeCityName(cityName: string, fallback = "上海") {
  const trimmed = cityName.trim();

  return isSupportedCityName(trimmed) ? trimmed : fallback;
}
