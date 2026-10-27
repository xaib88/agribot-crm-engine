// Calendar & Meeting Scheduling Engine for Autonomous WhatsApp Agent
function generateGoogleCalendarUrl({ title, description = '', location = '', startTime, endTime }) {
    const pad = (n) => String(n).padStart(2, '0');
    
    // Format YYYYMMDDTHHmmssZ (UTC)
    const formatUtc = (d) => {
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    };

    const startStr = formatUtc(startTime);
    const endStr = formatUtc(endTime);

    const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams({
        text: title,
        dates: `${startStr}/${endStr}`,
        details: description,
        location: location
    });

    return `${base}&${params.toString()}`;
}

function parseMeetingDetails(query) {
    const now = new Date();
    // Default to PKT offset (+5 hours)
    const pktNow = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000);

    let targetDate = new Date(pktNow);
    let isTomorrow = /کل|tomorrow/i.test(query) && !/پرسوں/i.test(query);
    let isDayAfter = /پرسوں|day after tomorrow/i.test(query);

    if (isTomorrow) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (isDayAfter) {
        targetDate.setDate(targetDate.getDate() + 2);
    }

    // Detect Time (e.g., 5 بجے, 11 بجے, 3 PM, 10 AM, 5:30)
    let hours = 11; // default 11:00 AM
    let minutes = 0;

    const timeMatch = query.match(/(\d{1,2})(?::(\d{2}))?\s*(بجے|am|pm|صبح|شام|دوپہر|رات)?/i);
    if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const period = (timeMatch[3] || '').toLowerCase();

        const isEvening = /شام|رات|pm/i.test(query) || period === 'pm' || period === 'شام' || period === 'رات';
        const isMorning = /صبح|am/i.test(query) || period === 'am' || period === 'صبح';

        if (isEvening && h < 12) h += 12;
        if (isMorning && h === 12) h = 0;
        // Default afternoon heuristic if between 1 and 7 without am/pm
        if (!isMorning && !isEvening && h >= 1 && h <= 7) h += 12;

        hours = h;
        minutes = m;
    }

    targetDate.setHours(hours, minutes, 0, 0);

    // End time: 1 hour later
    const endDate = new Date(targetDate.getTime() + 60 * 60 * 1000);

    // Extract Title / Participant
    let title = 'ملاقات / میٹنگ';
    const withMatch = query.match(/(?:ساتھ|with)\s+([a-zA-Z\u0600-\u06FF\s]+?)(?:\s+(?:کی|کا|کے|میٹنگ|meeting|ڈیل)|\s*$)/i);
    if (withMatch && withMatch[1]) {
        title = `میٹنگ بمعہ ${withMatch[1].trim()}`;
    } else if (/ڈیل|deal|پراپرٹی|property/i.test(query)) {
        title = 'ریئل اسٹیٹ ڈیل میٹنگ';
    }

    // Extract Location
    let location = 'آن کال / لوکیشن پر';
    const locMatch = query.match(/(?:پر|at|in|near)\s+([a-zA-Z\u0600-\u06FF\s]+?)(?:\s+(?:میٹنگ|meeting|ڈیل)|\s*$)/i);
    if (locMatch && locMatch[1] && !/کل|پرسوں|صبح|شام/i.test(locMatch[1])) {
        location = locMatch[1].trim();
    }

    // Convert back from PKT to UTC for Google Calendar URL
    const startUtc = new Date(targetDate.getTime() - (5 * 60 * 60 * 1000));
    const endUtc = new Date(endDate.getTime() - (5 * 60 * 60 * 1000));

    const gcalUrl = generateGoogleCalendarUrl({
        title,
        description: `واٹس ایپ اٹونومک ایجنٹ کے ذریعے خودکار طور پر شیڈول کی گئی۔ اصل ہدایت: "${query}"`,
        location,
        startTime: startUtc,
        endTime: endUtc
    });

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = targetDate.toLocaleDateString('ur-PK', options);

    return {
        title,
        location,
        targetDate,
        formattedDate,
        gcalUrl
    };
}

module.exports = {
    generateGoogleCalendarUrl,
    parseMeetingDetails
};
