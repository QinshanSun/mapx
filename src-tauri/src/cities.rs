use crate::errors::AppError;

pub const DEFAULT_CITY: &str = "上海";

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CityCenter {
    pub name: &'static str,
    pub lng: f64,
    pub lat: f64,
}

const SUPPORTED_CITIES: &[CityCenter] = &[
    CityCenter {
        name: "上海",
        lng: 121.4737,
        lat: 31.2304,
    },
    CityCenter {
        name: "北京",
        lng: 116.4074,
        lat: 39.9042,
    },
    CityCenter {
        name: "深圳",
        lng: 114.0579,
        lat: 22.5431,
    },
    CityCenter {
        name: "广州",
        lng: 113.2644,
        lat: 23.1291,
    },
    CityCenter {
        name: "杭州",
        lng: 120.1551,
        lat: 30.2741,
    },
    CityCenter {
        name: "成都",
        lng: 104.0665,
        lat: 30.5728,
    },
    CityCenter {
        name: "重庆",
        lng: 106.5516,
        lat: 29.563,
    },
    CityCenter {
        name: "武汉",
        lng: 114.3054,
        lat: 30.5931,
    },
    CityCenter {
        name: "南京",
        lng: 118.7969,
        lat: 32.0603,
    },
    CityCenter {
        name: "西安",
        lng: 108.9398,
        lat: 34.3416,
    },
    CityCenter {
        name: "苏州",
        lng: 120.5853,
        lat: 31.2989,
    },
    CityCenter {
        name: "天津",
        lng: 117.2009,
        lat: 39.0842,
    },
    CityCenter {
        name: "青岛",
        lng: 120.3826,
        lat: 36.0671,
    },
    CityCenter {
        name: "宁波",
        lng: 121.5504,
        lat: 29.8746,
    },
    CityCenter {
        name: "厦门",
        lng: 118.0894,
        lat: 24.4798,
    },
    CityCenter {
        name: "福州",
        lng: 119.2965,
        lat: 26.0745,
    },
    CityCenter {
        name: "长沙",
        lng: 112.9388,
        lat: 28.2282,
    },
    CityCenter {
        name: "郑州",
        lng: 113.6254,
        lat: 34.7466,
    },
    CityCenter {
        name: "济南",
        lng: 117.1201,
        lat: 36.6512,
    },
    CityCenter {
        name: "合肥",
        lng: 117.2272,
        lat: 31.8206,
    },
    CityCenter {
        name: "昆明",
        lng: 102.8329,
        lat: 24.8801,
    },
    CityCenter {
        name: "南宁",
        lng: 108.3669,
        lat: 22.817,
    },
    CityCenter {
        name: "贵阳",
        lng: 106.6302,
        lat: 26.647,
    },
    CityCenter {
        name: "南昌",
        lng: 115.8582,
        lat: 28.6829,
    },
    CityCenter {
        name: "太原",
        lng: 112.5489,
        lat: 37.8706,
    },
    CityCenter {
        name: "石家庄",
        lng: 114.5149,
        lat: 38.0428,
    },
    CityCenter {
        name: "沈阳",
        lng: 123.4315,
        lat: 41.8057,
    },
    CityCenter {
        name: "大连",
        lng: 121.6147,
        lat: 38.914,
    },
    CityCenter {
        name: "长春",
        lng: 125.3235,
        lat: 43.8171,
    },
    CityCenter {
        name: "哈尔滨",
        lng: 126.5349,
        lat: 45.8038,
    },
    CityCenter {
        name: "呼和浩特",
        lng: 111.7492,
        lat: 40.8426,
    },
    CityCenter {
        name: "兰州",
        lng: 103.8343,
        lat: 36.0611,
    },
    CityCenter {
        name: "西宁",
        lng: 101.7782,
        lat: 36.6171,
    },
    CityCenter {
        name: "银川",
        lng: 106.2309,
        lat: 38.4872,
    },
    CityCenter {
        name: "乌鲁木齐",
        lng: 87.6168,
        lat: 43.8256,
    },
    CityCenter {
        name: "海口",
        lng: 110.1983,
        lat: 20.044,
    },
    CityCenter {
        name: "三亚",
        lng: 109.5119,
        lat: 18.2528,
    },
    CityCenter {
        name: "拉萨",
        lng: 91.1172,
        lat: 29.6469,
    },
    CityCenter {
        name: "无锡",
        lng: 120.3119,
        lat: 31.4912,
    },
    CityCenter {
        name: "佛山",
        lng: 113.1214,
        lat: 23.0218,
    },
    CityCenter {
        name: "东莞",
        lng: 113.7518,
        lat: 23.0207,
    },
    CityCenter {
        name: "珠海",
        lng: 113.5767,
        lat: 22.2707,
    },
    CityCenter {
        name: "惠州",
        lng: 114.4168,
        lat: 23.1115,
    },
    CityCenter {
        name: "中山",
        lng: 113.3926,
        lat: 22.5176,
    },
    CityCenter {
        name: "温州",
        lng: 120.6994,
        lat: 27.9949,
    },
    CityCenter {
        name: "泉州",
        lng: 118.6757,
        lat: 24.8741,
    },
    CityCenter {
        name: "烟台",
        lng: 121.4479,
        lat: 37.4638,
    },
    CityCenter {
        name: "洛阳",
        lng: 112.454,
        lat: 34.6197,
    },
    CityCenter {
        name: "南通",
        lng: 120.8943,
        lat: 31.9802,
    },
];

pub fn validate_city_name(city_name: &str) -> Result<String, AppError> {
    let trimmed = city_name.trim();

    if trimmed.is_empty() {
        return Err(AppError::validation("默认城市不能为空。"));
    }

    if city_center_for(trimmed).is_none() {
        return Err(AppError::validation("默认城市不在支持列表中。"));
    }

    Ok(trimmed.to_string())
}

pub fn city_center_for(city_name: &str) -> Option<CityCenter> {
    let trimmed = city_name.trim();

    SUPPORTED_CITIES
        .iter()
        .copied()
        .find(|city| city.name == trimmed)
}

pub fn default_city_center() -> CityCenter {
    city_center_for(DEFAULT_CITY).expect("default city should be supported")
}
