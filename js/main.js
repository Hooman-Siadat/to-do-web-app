import App from "./controller/App.js";

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        dateTimeDisplay: {
            date: document.querySelector("#date-display"),
            time: document.querySelector("#time-display"),
        },
        form: {
            taskForm: document.querySelector("#task-form"),
            taskEntry: document.querySelector("#task-entry"),
            addTaskButton: document.querySelector("#add-task-button"),
            resetButton: document.querySelector("#form-reset"),
            dateEntry: document.querySelector("#date-entry"),
            toggleAllDay: document.querySelector("#toggle-all-day"),
            timeEntry: document.querySelector("#time-entry"),
            priority: document.querySelector("#priority"),
            notification: document.querySelector("#notification"), //get notification?
            notificationOffset: document.querySelector("#notification-offset"), // notification offset
        },
        lists: {
            upcoming: document.querySelector("#upcoming-list"),
            active: document.querySelector("#active-list"),
            completed: document.querySelector("#completed-list"),
            expired: document.querySelector("#expired-list"),
        },
        tabs: {
            upcomingList: document.querySelector("#upcoming-list-tab"),
            activeList: document.querySelector("#active-list-tab"),
            completedList: document.querySelector("#completed-list-tab"),
            expiredList: document.querySelector("#expired-list-tab"),
        },
        messageBoxContainer: document.querySelector("#message-box-container"),
    };

    // Initiate controller
    new App(elements);
});
