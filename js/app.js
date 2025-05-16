// MODEL
class Task {
    constructor(
        id,
        content,
        creationTime,
        creationDate,
        dueDate,
        dueTime,
        priority,
        getNotified = false,
        notificationOffset = 0,
        notificationTimestamp = 0,
        status = 0,
        modificationDate = "",
        completionDate = "",
        completionTime = ""
    ) {
        this.id = id;
        this.content = content;
        this.creationTime = creationTime;
        this.creationDate = creationDate;
        this.dueDate = dueDate;
        this.dueTime = dueTime;
        this.priority = priority;
        // if no modification date then use the creation date
        this.getNotified = getNotified;
        this.notificationOffset = notificationOffset;
        this.notificationTimestamp = notificationTimestamp;
        this.status = status;
        this.modificationDate = modificationDate || creationDate;
        this.completionDate = completionDate;
        this.completionTime = completionTime;
    }
}

class TaskManager {
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

// VIEW
class Renderer {
    constructor(elements, dynamicElementsClasses, taskManager, notificationServices) {
        // Elements
        this.elements = elements;
        this.lists = elements.lists;
        this.formFields = elements.form;
        // Preset class names
        this.classes = dynamicElementsClasses;

        // Helper classes
        this.taskManager = taskManager;
        this.notificationServices = notificationServices;
        // Enums
        this.TASK_STATUS = taskManager.TASK_STATUS;
        this.TASK_PRIORITY = taskManager.TASK_PRIORITY;
    }

    renderTasks(taskStatus = "all") {
        // Check for expired tasks and change status
        this.taskManager.checkForExpiredTasks();

        // Schedule notification
        this.notificationServices.scheduleNotification(this);

        // Clear and prepare UI
        this.clearTasks(taskStatus);
        this.renderUpcomingTasks();

        // Get the sorted tasks list
        let sortedLists = new Object();

        for (const status of Object.values(this.TASK_STATUS)) {
            // we need ascending order for active tasks and descending for other tasks
            const ascOrder = status === this.TASK_STATUS.ACTIVE ? true : false;
            sortedLists[status] = this.taskManager.getSortedTasks(status, ascOrder).all;
        }

        // Check for empty lists so we can inject placeholder
        for (const [status, tasks] of Object.entries(sortedLists)) {
            if (tasks.length === 0) {
                this.createPlaceholder(Number(status));
            }
        }

        // flat the object for all tasks
        sortedLists =
            taskStatus.trim().toLowerCase() === "all"
                ? Object.values(sortedLists).flat()
                : sortedLists[taskStatus];

        // Render tasks
        sortedLists.forEach((task) => {
            this.createNodes(task, this.classes);
        });
    }

    // clear tasks from lists
    clearTasks(taskStatus = "all") {
        if (taskStatus === this.TASK_STATUS.ACTIVE) {
            this.lists.active.innerHTML = "";
        } else if (taskStatus === this.TASK_STATUS.COMPLETED) {
            this.lists.completed.innerHTML = "";
        } else if (taskStatus === this.TASK_STATUS.EXPIRED) {
            this.lists.expired.innerHTML = "";
        } else {
            this.lists.active.innerHTML = "";
            this.lists.completed.innerHTML = "";
            this.lists.expired.innerHTML = "";
            this.lists.upcoming.innerHTML = "";
        }
    }

    // render "count" number of upcoming tasks
    renderUpcomingTasks(count = 5) {
        const upcomingTasks = this.taskManager.getUpcomingTasks(count);

        // if no upcoming tasks
        if (!upcomingTasks) {
            this.createPlaceholder();
        } else {
            upcomingTasks.forEach((task) => {
                const listItem = this.createTaskContainer(task.id);
                const taskContent = document.createElement("p");
                const timeLeft = DateTimeManager.getTimeDifference(task.dueDate, task.dueTime).text;
                const timeLeftSpan = this.createInfoSpan(timeLeft, this.classes.icons.timeLeft);

                taskContent.textContent = task.content;

                listItem.append(taskContent);
                listItem.append(timeLeftSpan);
                this.lists.upcoming.append(listItem);
            });
        }
    }

    // generate new task nodes dynamically
    createNodes(task, classes) {
        const taskContainer = this.createTaskContainer(task.id);
        const taskContentContainer = this.createTaskContentContainer(classes, task);
        const statusBar = this.createStatusBar(classes, task);

        taskContainer.appendChild(taskContentContainer);
        taskContainer.appendChild(statusBar);

        // Append to the correct list
        switch (task.status) {
            case this.TASK_STATUS.ACTIVE:
                this.lists.active.appendChild(taskContainer);
                break;
            case this.TASK_STATUS.COMPLETED:
                this.lists.completed.appendChild(taskContainer);
                break;
            case this.TASK_STATUS.EXPIRED:
                this.lists.expired.appendChild(taskContainer);
                break;
        }
    }

    // create list item node
    createTaskContainer(taskId = "") {
        const container = document.createElement("li");

        if (!taskId) return container;

        container.setAttribute("data-id", taskId);

        return container;
    }

    // create task user entry node
    createTaskContentContainer(classes, task) {
        // task entry container
        const container = document.createElement("div");
        container.classList.add(classes.taskContent.container);

        // task entry
        const content = document.createElement("p");
        content.classList.add(classes.taskContent.content);
        content.textContent = task.content;

        // task delete button
        const deleteButton = this.createDeleteButton(classes, task.id);
        container.append(content, deleteButton);

        // for active tasks only
        if (task.status === this.TASK_STATUS.ACTIVE) {
            const checkbox = this.createStatusCheckbox(classes, task.id);
            const editButton = this.createEditButton(classes, task.id);
            container.prepend(checkbox);
            container.appendChild(editButton);
            // for completed tasks
        } else if (task.status === this.TASK_STATUS.COMPLETED) {
            const completedIcon = this.createIcon(classes.icons.taskCompleted);
            container.prepend(completedIcon);
            // for expired tasks
        } else if (task.status === this.TASK_STATUS.EXPIRED) {
            const checkbox = this.createStatusCheckbox(classes, task.id);
            container.prepend(checkbox);
            const editButton = this.createEditButton(classes, task.id);
            container.appendChild(editButton);
        }

        return container;
    }

    // create task delete button node
    createDeleteButton(classes, taskId) {
        const button = document.createElement("button");
        button.classList.add(classes.taskContent.deleteButton, classes.icons.className);
        button.textContent = classes.icons.delete.txt;
        button.addEventListener("click", () => {
            const verify = confirm("Continue deleting the task?");
            if (!verify) return false;

            this.taskManager.deleteTask(taskId);
            this.renderTasks();
        });
        return button;
    }

    // create task status checkbox node
    createStatusCheckbox(classes, taskId) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add(classes.taskContent.taskStateCheckbox);
        checkbox.checked = false;
        checkbox.addEventListener("change", (e) => {
            const verify = confirm("Do you want to mark this task as completed?");

            if (!verify) {
                e.target.checked = false;
                return false;
            }

            // change task status to completed
            this.taskManager.changeTaskStatus(taskId, this.TASK_STATUS.COMPLETED);
            this.renderTasks();
        });
        return checkbox;
    }

    // create task update button node
    createEditButton(classes, taskId) {
        const button = document.createElement("button");
        button.classList.add(classes.taskContent.editButton, classes.icons.className);
        button.textContent = classes.icons.edit.txt;

        button.addEventListener("click", () => {
            const targetTask = this.taskManager.getTaskById(taskId);

            // fill in the task content and priority
            this.formFields.taskEntry.value = targetTask.content;
            this.formFields.priority.value = targetTask.priority;

            // fill in the due time
            if (targetTask.dueTime) {
                this.formFields.toggleAllDay.checked = false;
                this.formFields.timeEntry.disabled = false;
                this.formFields.timeEntry.value = targetTask.dueTime;
                // TODO fix the time format, save ISO, convert to display
                this.formFields.dateEntry.value = "";
            } else {
                this.formFields.toggleAllDay.checked = true;
                this.formFields.timeEntry.value = "";
                this.formFields.dateEntry.value = "";
                this.formFields.timeEntry.disabled = true;
            }

            // fill in notification
            if (targetTask.getNotified) {
                this.formFields.notification.checked = true;
                this.formFields.notificationOffset.disabled = false;
                this.formFields.notificationOffset.value = targetTask.notificationOffset;
            } else {
                this.formFields.notificationOffset.value = 0;
                this.formFields.notificationOffset.disabled = true;
                this.formFields.notification.checked = false;
            }

            // focus task entry
            this.formFields.taskEntry.focus();

            // delete task
            this.taskManager.deleteTask(taskId);

            // Render tasks
            this.renderTasks();
        });
        return button;
    }

    // create task status bar node #CHECKED#
    createStatusBar(classes, task) {
        const bar = document.createElement("div");
        bar.classList.add(classes.taskStatusBar.container);

        const priorityValues = Object.keys(this.TASK_PRIORITY);
        const priorityText = priorityValues[task.priority].split("_").join(" ").toLowerCase();
        const priorityTextContent = `Priority: ${priorityText}`;
        const priorityClassName = `priority-${priorityText}`.toLowerCase().replace(/\s+/g, "-");

        const prioritySpan = this.createInfoSpan(
            priorityTextContent,
            classes.icons.priority,
            priorityClassName
        );

        bar.appendChild(prioritySpan);

        // task status bar info span
        switch (task.status) {
            case this.TASK_STATUS.ACTIVE:
                if (task.dueDate) {
                    // due date info span
                    const dueDateSpan = this.createInfoSpan(
                        `${task.dueDate}`,
                        classes.icons.dueDate,
                        classes.taskStatusBar.dueDate
                    );

                    bar.appendChild(dueDateSpan);
                }
                if (task.dueTime) {
                    // due time info span
                    const dueTimeSpan = this.createInfoSpan(
                        `${task.dueTime}`,
                        classes.icons.dueTime,
                        classes.taskStatusBar.dueTime
                    );
                    bar.appendChild(dueTimeSpan);
                }
                if (task.getNotified) {
                    // notification info span
                    const notificationSpan = this.createInfoSpan(
                        `${task.notificationOffset} mins before`,
                        classes.icons.notification,
                        classes.taskStatusBar.notification
                    );
                    bar.appendChild(notificationSpan);
                }

                break;
            case this.TASK_STATUS.COMPLETED:
                const completionDateSpan = this.createInfoSpan(
                    `${task.completionDate}`,
                    classes.icons.completionDate,
                    classes.taskStatusBar.completionDate
                );
                const completionTimeSpan = this.createInfoSpan(
                    `${task.completionTime}`,
                    classes.icons.completionTime,
                    classes.taskStatusBar.completionTime
                );
                bar.appendChild(completionDateSpan);
                bar.appendChild(completionTimeSpan);
                break;
            case this.TASK_STATUS.EXPIRED:
                if (task.dueTime) {
                    const timePassed = DateTimeManager.getTimeDifference(task.dueDate, task.dueTime).text;
                    const timePassedSpan = this.createInfoSpan(
                        timePassed,
                        classes.icons.timePassed,
                        classes.taskStatusBar.timePassed
                    );
                    bar.appendChild(timePassedSpan);
                }
                break;
        }

        return bar;
    }

    // create task status bar info spans node
    createInfoSpan(text, icon = "", className = "") {
        const spanTag = document.createElement("span");

        if (className) {
            spanTag.classList.add(this.classes.taskStatusBar.spanInfo, className);
        } else {
            spanTag.classList.add(this.classes.taskStatusBar.spanInfo);
        }
        spanTag.textContent = text;

        // attach icon
        if (icon) spanTag.prepend(this.createIcon(icon));

        return spanTag;
    }

    // create icon
    createIcon(icon) {
        const iconTag = document.createElement("i");
        // set attributes
        iconTag.classList.add(this.classes.icons.className);
        iconTag.setAttribute("alt", icon.alt);
        iconTag.setAttribute("title", icon.alt);
        // set text content
        iconTag.textContent = icon.txt;

        return iconTag;
    }

    // placeholder list item to be used when no tasks available (0) active, (1) completed, (2) expired, else upcoming
    createPlaceholder(list = "upcoming") {
        // TODO I dont like how task status is hard coded here, find a better solution
        const placeholders = {
            0: { text: "No active tasks available.", targetList: this.lists.active },
            1: { text: "No completed tasks :(", targetList: this.lists.completed },
            2: { text: "No expired tasks! Good job keeping up!", targetList: this.lists.expired },
            upcoming: { text: "No upcoming tasks..", targetList: this.lists.upcoming },
        };

        const { text, targetList } = placeholders[list] || placeholders["upcoming"];

        const listItem = this.createTaskContainer();
        listItem.classList.add(this.classes.taskContent.placeholder);

        const taskContent = document.createElement("p");
        taskContent.textContent = text;

        const warningIcon = this.createIcon(this.classes.icons.warning);

        listItem.append(taskContent);
        listItem.prepend(warningIcon);
        targetList.append(listItem);

        return true;
    }

    showOnScreenMessage(tasks, timeout) {
        const container = this.elements.messageBoxContainer;

        // Get current notification IDs
        const existingIds = new Set(Array.from(container.children).map((el) => el.dataset.notificationId));

        tasks.forEach((task, i) => {
            if (existingIds.has(task.id)) return; // Skip if already shown

            const index = container.children.length;
            // used for stacking effect
            const transitionDelay = index * 300;

            const messageBox = this.createMessageBox(task, transitionDelay);
            container.prepend(messageBox);

            // Wait a tick to allow rendering before adding the class
            requestAnimationFrame(() => {
                messageBox.classList.add(this.classes.messageBox.animateIn);
            });

            setTimeout(() => {
                this.taskManager.checkForExpiredTasks();
                this.removeMessageBox(messageBox);

                if (i === tasks.length - 1) {
                    this.renderTasks();
                }
            }, timeout + transitionDelay);
        });
    }

    createMessageBox(task, transitionDelay) {
        const messageBox = document.createElement("div");
        messageBox.classList.add(this.classes.messageBox.className);
        // to prevent duplicate notifications
        messageBox.setAttribute(`data-notification-id`, task.id);
        messageBox.style.transitionDelay = transitionDelay + "ms";

        const messageContent = document.createElement("span");
        messageContent.textContent = task.content;

        const markCompletedInput = document.createElement("input");
        markCompletedInput.setAttribute("type", "radio");
        markCompletedInput.checked = false;
        markCompletedInput.addEventListener("change", () => {
            this.taskManager.changeTaskStatus(task.id, this.TASK_STATUS.COMPLETED);
            this.renderTasks();
            // mark as completed transition delay
            messageBox.style.transitionDelay = "600ms";
            messageBox.classList.add(this.classes.messageBox.markCompleted);
            // wait for marked as complete transition effect
            messageBox.addEventListener("transitionend", () => {
                this.removeMessageBox(messageBox);
            });
        });

        const closeButton = document.createElement("button");
        closeButton.textContent = "X";
        closeButton.addEventListener("click", () => {
            this.taskManager.checkForExpiredTasks();
            this.renderTasks();
            messageBox.style.transitionDelay = "600ms";
            this.removeMessageBox(messageBox);
        });

        messageBox.appendChild(messageContent);
        messageBox.appendChild(closeButton);
        messageBox.prepend(markCompletedInput);

        return messageBox;
    }

    removeMessageBox(messageBox) {
        messageBox.classList.remove(this.classes.messageBox.animateIn);
        messageBox.classList.add(this.classes.messageBox.animateOut);
        messageBox.addEventListener("transitionend", () => {
            messageBox.remove();
        });
    }
}

class DateTimeManager {
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

class NotificationServices {
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

// CONTROLLER
class App {
    constructor(elements) {
        this.elements = elements;
        // List the HTML classes that will be used by Renderer.createNodes() to generate nodes dynamically
        const dynamicElementsClasses = {
            taskContent: {
                container: "task-content-container",
                content: "task-content",
                deleteButton: "task-delete-button",
                editButton: "task-edit-button",
                taskStateCheckbox: "task-state",
                placeholder: "placeholder-item",
            },
            taskStatusBar: {
                container: "status-bar",
                spanInfo: "task-info",
                taskPriority: "task-priority",
                timeLeft: "task-time-left",
                dueTime: "task-due-time",
                dueDate: "task-due-date",
                completionTime: "task-completion-time",
                completionDate: "task-completion-date",
                timePassed: "task-expiration-period",
                notification: "task-notification-offset",
            },
            icons: {
                className: "material-icons-round", // main class name
                priority: {
                    alt: "priority", // description used for alt and title attributes
                    txt: "flag", //material icon string
                },
                taskCompleted: {
                    alt: "completed",
                    txt: "task_alt",
                },
                completionDate: {
                    alt: "completion date",
                    txt: "event_available",
                },
                completionTime: {
                    alt: "completion time",
                    txt: "alarm",
                },
                taskExpired: {
                    alt: "task expired",
                    txt: "gpp_maybe",
                },
                delete: {
                    alt: "delete",
                    txt: "delete",
                },
                edit: {
                    alt: "edit",
                    txt: "edit",
                },
                dueDate: {
                    alt: "due date",
                    txt: "calendar_month",
                },
                dueTime: {
                    alt: "due time",
                    txt: "schedule",
                },
                timeLeft: {
                    alt: "time left",
                    txt: "timelapse",
                },
                timePassed: {
                    alt: "time passed",
                    txt: "timer",
                },
                warning: {
                    alt: "warning",
                    txt: "warning",
                },
                notification: {
                    alt: "notify",
                    txt: "notifications_active",
                },
            },
            animation: {
                newTask: "new-task",
            },
            messageBox: {
                className: "message-box",
                markCompleted: "marked-completed",
                animateIn: "entry-animation",
                animateOut: "close-animation",
            },
        };

        // Tasks are considered expired 59 seconds after their due time
        // Used as notification box duration timeout in milliseconds
        // Also passed to TaskManager.checkForExpiredTasks
        this.EXPIRY_DELAY = 59 * 1000;

        // Helper classes
        this.taskManager = new TaskManager(this.elements.form, this.EXPIRY_DELAY);
        this.notificationServices = new NotificationServices(this.taskManager, this.EXPIRY_DELAY);
        this.renderer = new Renderer(
            this.elements,
            dynamicElementsClasses,
            this.taskManager,
            this.notificationServices
        );

        // Initiate Application ------------------------------------
        this.elements.form.dateEntry.min = DateTimeManager.getCurrentDateTime().currentDateISO;
        this.elements.form.taskEntry.focus();

        // Add task button event handler
        this.elements.form.taskForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const createTask = this.taskManager.createTask();

            // if failed to create task
            if (!createTask) return false;

            this.elements.tabs.activeList.checked = true;
            this.renderer.renderTasks();
            this.resetInputFields();
            this.elements.form.taskEntry.focus();
        });

        // toggle all day checkbox
        this.elements.form.toggleAllDay.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            this.elements.form.timeEntry.value = "";
            this.elements.form.timeEntry.disabled = isChecked;
            this.elements.form.timeEntry.required = true;
            this.elements.form.timeEntry.focus();
        });

        // toggle notification checkbox
        this.elements.form.notification.addEventListener("change", (e) => {
            const isChecked = e.target.checked;

            // check if a time is entered
            if (this.elements.form.timeEntry.disabled || this.elements.form.timeEntry.value.trim() === "") {
                alert("Please select a time first.");
                this.elements.form.notification.checked = false;
                return false;
            }

            this.elements.form.notificationOffset.value = "0";
            this.elements.form.notificationOffset.disabled = !isChecked;
            this.elements.form.notificationOffset.required = true;
            this.elements.form.notificationOffset.focus();
        });

        // Clear form button
        this.elements.form.resetButton.addEventListener("click", () => {
            this.resetInputFields();
        });

        // render all tasks
        this.renderer.renderTasks();

        // set clock and date
        setInterval(() => {
            this.elements.dateTimeDisplay.time.textContent =
                DateTimeManager.getCurrentDateTime().currentTime12Hour;
        }, 1000);
        this.elements.dateTimeDisplay.date.textContent =
            DateTimeManager.getCurrentDateTime().currentDateFormatted;
    }

    resetInputFields() {
        this.elements.form.taskEntry.value = "";
        this.elements.form.dateEntry.value = "";
        this.elements.form.timeEntry.value = "";
        this.elements.form.toggleAllDay.checked = true;
        this.elements.form.timeEntry.disabled = true;
        this.elements.form.notification.checked = false;
        this.elements.form.notificationOffset.value = 0;
        this.elements.form.notificationOffset.disabled = true;
        this.elements.form.priority.value = 1;
    }
}

// on DOMContentLoaded
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
    const app = new App(elements);
});
