import DateTimeManager from "./DateTimeManager.js";

export default class NotificationServices {
    constructor(taskManager, messageBoxTimeout) {
        this.taskManager = taskManager;
        // Message box duration timeout
        this.messageBoxTimeout = messageBoxTimeout;
        this.scheduledTimeouts = [];
    }

    scheduleNotification(renderer) {
        // Clear already set timeouts
        this.clearScheduledTimeouts();

        // get the next upcoming tax with getNotified true
        const nextTasks = this.taskManager.getNextUpcomingNotification();
        if (nextTasks.length === 0) return null;

        // time difference between now and due date
        const nextTaskNotificationTime = new Date(nextTasks[0].notificationTimestamp).getTime();
        const now = DateTimeManager.getCurrentDateTime().currentTimestamp;
        const timeDifference = nextTaskNotificationTime - now;

        const newTimeout = setTimeout(() => {
            renderer.showOnScreenMessage(nextTasks, this.messageBoxTimeout);
        }, timeDifference);

        // record newly set timeout
        this.scheduledTimeouts.push(newTimeout);
    }

    clearScheduledTimeouts() {
        this.scheduledTimeouts.forEach((t) => clearTimeout(t));
        this.scheduledTimeouts = [];
    }

    showBrowserNotification() {}
}
