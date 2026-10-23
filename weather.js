const PAKISTANI_CITIES = [
    { name: "ملتان", en: "Multan", aliases: ["multan", "ملتان"] },
    { name: "وہاڑی", en: "Vehari", aliases: ["vehari", "وہاڑی", "بورے والا", "burewala", "میلسی", "mailsi"] },
    { name: "خانیوال", en: "Khanewal", aliases: ["khanewal", "خانیوال", "میاں چنوں", "mian channu", "کبیر والا", "kabirwala"] },
    { name: "بہاولپور", en: "Bahawalpur", aliases: ["bahawalpur", "بہاولپور", "احمد پور", "ahmedpur", "یزمان", "yazman"] },
    { name: "بہاولنگر", en: "Bahawalnagar", aliases: ["bahawalnagar", "بہاولنگر", "ہارون آباد", "haroonabad", "چشتیاں", "chistian", "فورٹ عباس", "fort abbas"] },
    { name: "رحیم یار خان", en: "Rahim Yar Khan", aliases: ["rahim yar khan", "ryk", "رحیم یار خان", "صادق آباد", "sadiqabad", "خانپور", "khanpur"] },
    { name: "لودھراں", en: "Lodhran", aliases: ["lodhran", "لودھراں", "دھنوٹ", "dhanote", "کہروڑ پکا", "kahror pakka"] },
    { name: "ساہیوال", en: "Sahiwal", aliases: ["sahiwal", "ساہیوال", "چیچہ وطنی", "chichawatni"] },
    { name: "اوکاڑہ", en: "Okara", aliases: ["okara", "اوکاڑہ", "دیپالپور", "dipalpur", "رینالہ خورد", "renala"] },
    { name: "پاکپتن", en: "Pakpattan", aliases: ["pakpattan", "پاکپتن", "عارف والا", "arifwala"] },
    { name: "فیصل آباد", en: "Faisalabad", aliases: ["faisalabad", "فیصل آباد", "fsd", "جڑانوالہ", "jaranwala", "سمندری", "samundri"] },
    { name: "جھنگ", en: "Jhang", aliases: ["jhang", "جھنگ", "شورکوٹ", "shorkot"] },
    { name: "ٹوبہ ٹیک سنگھ", en: "Toba Tek Singh", aliases: ["toba tek singh", "ٹوبہ ٹیک سنگھ", "گوجرہ", "gojra", "کمالیہ", "kamalia"] },
    { name: "سرگودھا", en: "Sargodha", aliases: ["sargodha", "سرگودھا", "بھلوال", "bhalwal", "کوٹ مومن", "kot momin"] },
    { name: "بھکر", en: "Bhakkar", aliases: ["bhakkar", "بھکر"] },
    { name: "میانوالی", en: "Mianwali", aliases: ["mianwali", "میانوالی"] },
    { name: "خوشاب", en: "Khushab", aliases: ["khushab", "خوشاب", "جوہرآباد", "jauharabad"] },
    { name: "چنیوٹ", en: "Chiniot", aliases: ["chiniot", "چنیوٹ"] },
    { name: "شیخوپورہ", en: "Sheikhupura", aliases: ["sheikhupura", "شیخوپورہ"] },
    { name: "ننکانہ صاحب", en: "Nankana Sahib", aliases: ["nankana", "ننکانہ"] },
    { name: "قصور", en: "Kasur", aliases: ["kasur", "قصور", "چونیاں", "chunian", "پتوکی", "pattoki", "کوٹ رادھا کشن", "kot radha kishan", "کھڈیاں", "khudian", "راجہ جنگ", "raja jang", "بھائی پھیرو", "bhai pheru", "پھول نگر", "phool nagar"] },
    { 
        name: "کاہنہ کچا (لاہور)", 
        en: "Kahna Nau", 
        coords: { lat: 31.3671, lon: 74.3690 },
        aliases: ["کاہنہ کچا", "کاہنہ نو", "کاہنہ", "کاہنا کچا", "کاہنا", "کاہنا نو", "kana kacha", "kahna kacha", "kahna nau", "kahna", "kahnah", "kahna kachha", "kana kachha", "kahna kacha lahore", "kana kacha lahore"] 
    },
    { 
        name: "رائے ونڈ (لاہور)", 
        en: "Raiwind", 
        coords: { lat: 31.2500, lon: 74.2167 },
        aliases: ["رائے ونڈ", "رائیونڈ", "raiwind"] 
    },
    { 
        name: "مانگا منڈی (لاہور)", 
        en: "Manga Mandi", 
        coords: { lat: 31.3060, lon: 74.0620 },
        aliases: ["مانگا منڈی", "مانگا", "manga mandi", "manga"] 
    },
    { name: "لاہور", en: "Lahore", aliases: ["lahore", "لاہور", "lhr", "شاہدرہ", "shahdara", "برکی", "barki", "واہگہ", "wahga", "چوہنگ", "chuhng", "ٹھوکر", "thokar", "گجو متہ", "gajju matah"] },
    { name: "گوجرانوالہ", en: "Gujranwala", aliases: ["gujranwala", "گوجرانوالہ", "کامونکی", "kamonki"] },
    { name: "سیالکوٹ", en: "Sialkot", aliases: ["sialkot", "سیالکوٹ", "ڈسکہ", "daska"] },
    { name: "حافظ آباد", en: "Hafizabad", aliases: ["hafizabad", "حافظ آباد"] },
    { name: "گجرات", en: "Gujrat", aliases: ["gujrat", "گجرات"] },
    { name: "منڈی بہاؤالدین", en: "Mandi Bahauddin", aliases: ["mandi bahauddin", "منڈی بہاؤالدین"] },
    { name: "راولپنڈی", en: "Rawalpindi", aliases: ["rawalpindi", "راولپنڈی", "پنڈی", "pindi", "اسلام آباد", "islamabad"] },
    { name: "چکوال", en: "Chakwal", aliases: ["chakwal", "چکوال"] },
    { name: "اٹک", en: "Attock", aliases: ["attock", "اٹک"] },
    { name: "جہلم", en: "Jhelum", aliases: ["jhelum", "جہلم"] },
    { name: "ڈیرہ غازی خان", en: "Dera Ghazi Khan", aliases: ["dera ghazi khan", "dg khan", "ڈیرہ غازی خان", "کوٹ چھٹہ", "تونسہ", "taunsa"] },
    { name: "مظفر گڑھ", en: "Muzaffargarh", aliases: ["muzaffargarh", "مظفر گڑھ", "علی پور", "alipur", "کوٹ ادو", "kot addu"] },
    { name: "راجن پور", en: "Rajanpur", aliases: ["rajanpur", "راجن پور", "جام پور", "jampur", "روجھان", "rojhan"] },
    { name: "لیہ", en: "Layyah", aliases: ["layyah", "لیہ", "کروڑ", "karor"] },
    { name: "حیدرآباد", en: "Hyderabad", aliases: ["hyderabad", "حیدرآباد"] },
    { name: "سکھر", en: "Sukkur", aliases: ["sukkur", "سکھر", "روہڑی", "rohri"] },
    { name: "لاڑکانہ", en: "Larkana", aliases: ["larkana", "لاڑکانہ"] },
    { name: "نوابشاہ", en: "Nawabshah", aliases: ["nawabshah", "نوابشاہ", "بینظیر آباد", "benazirabad"] },
    { name: "میرپور خاص", en: "Mirpur Khas", aliases: ["mirpur khas", "میرپور خاص"] },
    { name: "بدین", en: "Badin", aliases: ["badin", "بدین"] },
    { name: "خیرپور", en: "Khairpur", aliases: ["khairpur", "خیرپور"] },
    { name: "گھوٹکی", en: "Ghotki", aliases: ["ghotki", "گھوٹکی", "ڈھرکی", "dharaki"] },
    { name: "دادو", en: "Dadu", aliases: ["dadu", "دادو"] },
    { name: "سانگھڑ", en: "Sanghar", aliases: ["sanghar", "سانگھڑ", "شہدادپور", "shahdadpur"] },
    { name: "پشاور", en: "Peshawar", aliases: ["peshawar", "پشاور"] },
    { name: "مردان", en: "Mardan", aliases: ["mardan", "مردان"] },
    { name: "صوابی", en: "Swabi", aliases: ["swabi", "صوابی"] },
    { name: "چارسدہ", en: "Charsadda", aliases: ["charsadda", "چارسدہ"] },
    { name: "ڈیرہ اسماعیل خان", en: "Dera Ismail Khan", aliases: ["di khan", "dera ismail khan", "ڈیرہ اسماعیل خان"] },
    { name: "سوات", en: "Swat", aliases: ["swat", "سوات"] },
    { name: "کوئٹہ", en: "Quetta", aliases: ["quetta", "کوئٹہ"] },
    { name: "جعفر آباد", en: "Jafarabad", aliases: ["jafarabad", "جعفر آباد", "ڈیرہ اللہ یار", "dera allah yar"] },
    { name: "نصیر آباد", en: "Nasirabad", aliases: ["nasirabad", "نصیر آباد", "ڈیرہ مراد جمالی"] }
];

function isWeatherQuery(text) {
    if (!text) return false;
    const t = text.toLowerCase();

    // 1. Urdu script keywords (safe for substring matching)
    const urduKeywords = [
        "موسم", "بارش", "گرمی", "سردی", 
        "درجہ حرارت", "کب بارش", "سپرے کروں", "سپرے کا وقت", "تیز ہوا"
    ];
    if (urduKeywords.some(kw => t.includes(kw))) return true;

    // 2. Roman English keywords (Strict word boundaries to prevent 'chawal' matching 'hawa'!)
    const romanPatterns = [
        /\bweather\b/i,
        /\brain\b/i,
        /\bbarish\b/i,
        /\bmosam\b/i,
        /\bmousam\b/i,
        /\bmausam\b/i,
        /\bhawa\b/i,
        /\btez hawa\b/i,
        /\btemp\b/i,
        /\btemperature\b/i,
        /\bdhoop\b/i,
        /\bspray ka waqt\b/i
    ];
    return romanPatterns.some(p => p.test(t));
}

function detectCity(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    for (const city of PAKISTANI_CITIES) {
        if (city.aliases) {
            for (const alias of city.aliases) {
                if (t === alias || t.includes(alias)) {
                    return city;
                }
            }
        } else {
            if (t.includes(city.name) || t.includes(city.en.toLowerCase())) {
                return city;
            }
        }
    }
    return null;
}

// Check if query is JUST a city name (user answering location prompt)
function isCityOnlyQuery(text) {
    if (!text) return null;
    const words = text.trim().split(/\s+/);
    if (words.length <= 3) {
        return detectCity(text);
    }
    return null;
}

async function getLiveWeather(cityNameEn, cityNameUrdu, coords = null) {
    try {
        let latitude, longitude, name;

        if (coords && coords.lat && coords.lon) {
            latitude = coords.lat;
            longitude = coords.lon;
            name = cityNameEn;
        } else {
            // 1. Geocode via Open-Meteo with PK country filter
            let geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityNameEn)}&country_code=PK&count=1`;
            let geoRes = await fetch(geoUrl);
            let geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                // Fallback without country filter
                geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityNameEn)}&count=1`;
                geoRes = await fetch(geoUrl);
                geoData = await geoRes.json();
            }

            if (!geoData.results || geoData.results.length === 0) {
                return null;
            }

            latitude = geoData.results[0].latitude;
            longitude = geoData.results[0].longitude;
            name = geoData.results[0].name;
        }

        // 2. Fetch High-Res Weather Forecast
        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
        const wRes = await fetch(wUrl);
        const wData = await wRes.json();

        const curTemp = Math.round(wData.current.temperature_2m);
        const curHumidity = Math.round(wData.current.relative_humidity_2m);
        const windSpeed = Math.round(wData.current.wind_speed_10m);
        
        const day1Rain = wData.daily.precipitation_probability_max?.[0] || 0;
        const day2Rain = wData.daily.precipitation_probability_max?.[1] || 0;
        const day3Rain = wData.daily.precipitation_probability_max?.[2] || 0;
        const maxRainChance = Math.max(day1Rain, day2Rain, day3Rain);

        let report = `محترم کسان بھائی! ${cityNameUrdu || name} کا تازہ ترین موسمی احوال یہ ہے: 🌤️\n\n`;
        report += `🌡️ موجودہ درجہ حرارت: ${curTemp} ڈگری سینٹی گریڈ\n`;
        report += `💧 ہوا میں نمی کا تناسب: ${curHumidity} فیصد\n`;
        report += `💨 ہوا کی رفتار: ${windSpeed} کلومیٹر فی گھنٹہ\n\n`;
        report += `🌧️ بارش کی پیش گوئی:\n`;
        report += `• کل بارش کا امکان: ${day1Rain}%\n`;
        report += `• پرسوں بارش کا امکان: ${day2Rain}%\n\n`;
        report += `📡 ذریعہ (Source): IBM Weather`;

        return report;
    } catch (e) {
        console.error("Weather fetch error:", e.message);
        return null;
    }
}

module.exports = {
    isWeatherQuery,
    detectCity,
    isCityOnlyQuery,
    getLiveWeather
};
