import Task from "../models/Task.js";
import DateTimeManager from "./DateTimeManager.js";

export default class TaskManager {
    constructor(formFields, EXPIRY_DELAY, storageKey = "userTasks") {
        this.formFields = formFields;
        this.EXPIRY_DELAY = EXPIRY_DELAY;
        this.tasksStorageKey = storageKey;
        this.TASK_STATUS = {
            ACTIVE: 0,
            COMPLETED: 1,
            EXPIRED: 2,
        };
        this.TASK_PRIORITY = {
            LOW: 0,
            MEDIUM: 1,
            HIGH: 2,
            VERY_HIGH: 3,
        };
        // a list of all task objects
        this.tasksList = this._loadFromLocalStorage();
    }

    // Create new task
    createTask() {
        const validatedValues = this.validateTaskEntries(this.formFields);

        // if user entries failed to validate
        if (!validatedValues) return null;

        const taskObj = new Task(
            validatedValues.taskID,
            validatedValues.taskContent,
            validatedValues.creationTime,
            validatedValues.creationDate,
            validatedValues.dueDate,
            validatedValues.dueTime,
            validatedValues.priority,
            validatedValues.getNotified,
            validatedValues.notificationOffset,
            validatedValues.notificationTimestamp
        );

        this.tasksList.push(taskObj);
        this._saveToLocalStorage();
        return taskObj;
    }

    // createTask() helper function
    validateTaskEntries(formFields) {
        // if no entries
        if (!formFields.taskEntry.value.trim()) return false;

        const currentDateTime = DateTimeManager.getCurrentDateTime();
        const taskContent = formFields.taskEntry.value.trim();
        const taskID = crypto.randomUUID();
        const creationDate = currentDateTime.currentDateShort;
        const creationTime = currentDateTime.currentTime24Hour;
        const priority = Number(formFields.priority.value);

        // Verify due date and time
        let dueDate = formFields.dateEntry.value;
        let dueTime = formFields.timeEntry.value;

        // convert UTC to locale
        dueDate = dueDate ? new Date(`${dueDate} ${dueTime}`).toLocaleDateString() : "";

        // if due date is not set but there is a due time then due date is currentDate
        if (!dueDate && dueTime) dueDate = currentDateTime.currentDateShort;
        // if theres a due date but no due time then due time will be the very end of the day
        if (dueDate && !dueTime) dueTime = "23:59";

        const dateTimeEntry = new Date(`${dueDate} ${dueTime}`).getTime();

        // validate due date and time
        if (dateTimeEntry < DateTimeManager.getCurrentDateTime().currentTimestamp) {
            alert("Please select a future date and time.");
            return false;
        }

        // Notification
        const getNotified = formFields.notification.checked;
        let notificationOffset = 0;
        let notificationTimestamp = 0;

        if (getNotified) {
            notificationOffset = Number(formFields.notificationOffset.value);

            // make sure notification doesnt fall in the past
            const notificationDateTime = DateTimeManager.calculateNotificationTime(
                dueDate,
                dueTime,
                notificationOffset
            );

            const isExpired = DateTimeManager.getTimeDifference(
                notificationDateTime.date,
                notificationDateTime.time
            ).isExpired;

            if (isExpired) {
                alert("Please select a valid notification time.");
                return false;
            }

            notificationTimestamp = notificationDateTime.timestamp;
        }

        const validatedValues = {
            taskID,
            taskContent,
            creationTime,
            creationDate,
            dueDate,
            dueTime,
            priority,
            getNotified,
            notificationOffset,
            notificationTimestamp,
        };
        return validatedValues;
    }

    // Returns an array of task objects
    getTasksByStatus(taskStatus = "all") {
        // taskStatus: 0 = active, 1 = completed, 2 = expired
        // Update tasks lists
        this.tasksList = this._loadFromLocalStorage();

        // Return all tasks if no specific status is given
        if (taskStatus === "all") return this.tasksList;

        // Otherwise, return filtered tasks matching the status
        return this.tasksList.filter((task) => task.status == taskStatus);
    }

    // get a task from tasksList by task.id
    getTaskById(taskID) {
        const requestedTask = this.tasksList.filter((task) => task.id === taskID);

        return requestedTask[0];
    }

    // delete task from localStorage
    deleteTask(taskID) {
        const newTasksList = this.tasksList.filter((task) => task.id !== taskID);

        this.tasksList = newTasksList;
        this._saveToLocalStorage();
        return true;
    }

    // changes a task status to taskStatus
    changeTaskStatus(taskID, taskStatus) {
        const task = this.getTaskById(taskID);
        const currentDate = DateTimeManager.getCurrentDateTime();

        task.status = taskStatus;

        // set completion date and time
        if (taskStatus === this.TASK_STATUS.COMPLETED) {
            task.completionDate = currentDate.currentDateShort;
            task.completionTime = currentDate.currentTime12Hour;
        }

        task.modificationDate = currentDate.currentDateShort;

        const taskIndex = this.tasksList.findIndex((t) => t.id === taskID);

        if (taskIndex > -1) this.tasksList[taskIndex] = task;

        this._saveToLocalStorage();
    }

    // sort the active list by due date, time, priority
    getSortedTasks(taskStatus = "all", asc = true) {
        const tasks = this.getTasksByStatus(taskStatus);
        const sortedTasks = new Object();
        const tasksWithDueDate = tasks.filter((t) => t.dueDate);
        const tasksNoDueDate = tasks.filter((t) => !t.dueDate);

        tasksWithDueDate.sort((a, b) => {
            const dateA = new Date(`${a.dueDate} ${a.dueTime}`);
            const dateB = new Date(`${b.dueDate} ${b.dueTime}`);

            // if two task have different due date and time
            if (dateA.getTime() !== dateB.getTime() && asc) {
                return dateA - dateB; // earlier date/time first
            } else if (dateA.getTime() !== dateB.getTime() && !asc) {
                return dateB - dateA; // later date/time first
            }

            // if two tasks same due date, due time sort by higher priority first
            return b.priority - a.priority;
        });

        // Sort tasks without due date by priority (highest first)
        tasksNoDueDate.sort((a, b) => b.priority - a.priority);

        sortedTasks.withDueDate = tasksWithDueDate;
        sortedTasks.noDueDate = tasksNoDueDate;
        sortedTasks.all = tasksWithDueDate.concat(tasksNoDueDate);

        return sortedTasks;
    }

    // return a list of upcoming tasks by due date and time
    getUpcomingTasks(count = 5) {
        let sortedActiveTasks = this.getSortedTasks(0).withDueDate;

        // if no upcoming tasks
        if (sortedActiveTasks.length === 0) return null;

        // if count = 1 make sure slice(0, 1)
        return sortedActiveTasks.slice(0, count - 1 || 1);
    }

    // Returns the next upcoming task that has a scheduled notification time.
    getNextUpcomingNotification() {
        const activeTasks = this.getTasksByStatus(this.TASK_STATUS.ACTIVE);

        if (activeTasks.length === 0) return [];

        const scheduledTasks = activeTasks.filter((task) => task.notificationTimestamp);

        if (scheduledTasks.length === 0) return [];

        // sort scheduled tasks by notification time in ascending order
        scheduledTasks.sort((taskA, taskB) => taskA.notificationTimestamp - taskB.notificationTimestamp);

        // Get the earliest timestamp
        const earliestTimestamp = scheduledTasks[0].notificationTimestamp;

        // Return all tasks with the same earliest timestamp
        return scheduledTasks.filter((task) => task.notificationTimestamp === earliestTimestamp);
    }

    // check for expired tasks and change status to expired, also returns a list of expired tasks
    checkForExpiredTasks() {
        const activeTasks = this.getTasksByStatus(this.TASK_STATUS.ACTIVE);
        const now = DateTimeManager.getCurrentDateTime().currentTimestamp;
        const expiredTasks = [];

        // Tasks are considered expired 59 seconds after their due time
        const EXPIRY_DELAY = 59 * 1000; // 59 seconds in milliseconds

        activeTasks.forEach((task) => {
            const dueDateTime = new Date(`${task.dueDate} ${task.dueTime}`).getTime();

            if (now - dueDateTime >= EXPIRY_DELAY) {
                // 60 seconds have passed since due time
                this.changeTaskStatus(task.id, this.TASK_STATUS.EXPIRED);
                expiredTasks.push(task);
            }
        });

        return expiredTasks;
    }

    // save tasksList to localStorage
    _saveToLocalStorage(newTaskId = false) {
        // convert to string
        localStorage.setItem(this.tasksStorageKey, JSON.stringify(this.tasksList));

        return true;
    }

    // return a list of task objects
    _loadFromLocalStorage() {
        const tasksList = localStorage.getItem(this.tasksStorageKey);

        // if no data
        if (!tasksList) {
            return [];
        }

        try {
            // return a list of all task objects
            return JSON.parse(tasksList);
        } catch (e) {
            console.error("Failed to parse tasks:", e);
            return [];
        }
    }
}
