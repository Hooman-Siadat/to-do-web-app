export default class DateTimeManager {
    // Return current date and time
    static getCurrentDateTime() {
        const now = new Date();
        // Helper function to format time
        const formatTime = (options) => now.toLocaleTimeString("en-US", options);

        return {
            currentDateShort: now.toLocaleDateString(),
            // used for date inputs (ISO format)
            currentDateISO: now.toLocaleDateString("en-CA"),
            currentDateFormatted: now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            currentTime12Hour: formatTime({
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
            }),
            currentTime24Hour: formatTime({
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }),
            currentDateTime: now,
            currentTimestamp: now.getTime(),
        };
    }

    // calculate expiration date, if theres a due time, theres a due date
    static getTimeDifference(toDate, toTime) {
        const diffMs = new Date(`${toDate} ${toTime}`) - new Date(); // may be negative
        const isExpired = diffMs < 0 ? true : false;
        const absDiff = Math.abs(diffMs);
        const verb = isExpired ? "passed" : "left";

        let mins = Math.floor(absDiff / (1000 * 60)) % 60;
        let hours = Math.floor(absDiff / (1000 * 60 * 60)) % 24;
        let days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

        days = days ? `${days} days` : "";
        hours = hours ? `${hours} hours` : "";
        mins = mins ? `${mins} mins` : "";

        const text =
            !days && !hours && !mins ? `less than 1 min ${verb}` : `${days} ${hours} ${mins} ${verb}`.trim();

        return { days, hours, mins, isExpired, text };
    }

    // returns a timestamp which is the result of task due date and time minus notification offset
    static calculateNotificationTime(dueDate, dueTime, offset) {
        const dueDateTime = new Date(`${dueDate} ${dueTime}`);
        const notificationDateTime = new Object();
        const shortTimeFormat = {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        };

        // notification time
        dueDateTime.setTime(dueDateTime.getTime() - offset * 60 * 1000);

        notificationDateTime.date = dueDateTime.toLocaleDateString();
        notificationDateTime.time = dueDateTime.toLocaleTimeString("en-US", shortTimeFormat);
        notificationDateTime.timestamp = dueDateTime.getTime();

        return notificationDateTime;
    }
}
