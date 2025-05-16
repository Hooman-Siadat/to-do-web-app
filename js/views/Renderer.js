import DateTimeManager from "../services/DateTimeManager.js";

export default class Renderer {
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
        checkbox.type = "radio";
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
            // changeStatus to expired
            this.taskManager.changeTaskStatus(task.id, this.TASK_STATUS.EXPIRED);
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
