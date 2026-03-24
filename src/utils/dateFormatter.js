/**
 * Formats date into Google Ads required format:
 * 'yyyy-mm-dd hh:mm:ss+|-hh:mm'
 */
const formatForGoogleAds = (date) => {
    if (!date) date = new Date();

    const pad = (num) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // Get timezone offset in hours and minutes
    const tzo = -date.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const tzoHours = pad(Math.floor(Math.abs(tzo) / 60));
    const tzoMinutes = pad(Math.abs(tzo) % 60);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}${dif}${tzoHours}:${tzoMinutes}`;
};

module.exports = {
    formatForGoogleAds
};
