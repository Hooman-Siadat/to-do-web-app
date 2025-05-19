import TaskManager from "../services/TaskManager.js";
import Renderer from "../views/Renderer.js";
import NotificationServices from "../services/NotificationServices.js";
import DateTimeManager from "../services/DateTimeManager.js";

export default class App {
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

        // Tasks will not be expired until the next minute
        // Used as notification box duration timeout in milliseconds
        // Also passed to TaskManager.checkForExpiredTasks
        this.EXPIRY_DELAY = (() => {
            // 59 * 1000
            const now = new Date();
            const msLeft = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
            return msLeft;
        })();

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

        // Handle repeat exclusive selection between weekly, monthly, annually
        this.elements.form.repeat.options.addEventListener("change", (e) => {
            if (e.target.tagName !== "INPUT") return;

            function resetRepeatGroup(container) {
                container.querySelectorAll("input").forEach((input) => {
                    input.checked = false;
                });
            }

            const name = e.target.name;
            if (name === "weekly") {
                resetRepeatGroup(this.elements.form.repeat.monthlyContainer);
                resetRepeatGroup(this.elements.form.repeat.annuallyContainer);
            } else if (name === "monthly") {
                resetRepeatGroup(this.elements.form.repeat.weeklyContainer);
                resetRepeatGroup(this.elements.form.repeat.annuallyContainer);
            } else if (name === "annually") {
                resetRepeatGroup(this.elements.form.repeat.weeklyContainer);
                resetRepeatGroup(this.elements.form.repeat.monthlyContainer);
            }
        });

        // close repeat options menu
        this.elements.form.repeat.submitButton.addEventListener("click", () => {
            this.elements.form.repeat.button.classList.toggle("view");
            this.repeatTaskButtonIndicator();
        });

        // view/hide options menu
        this.elements.form.repeat.button.addEventListener("click", () => {
            elements.form.repeat.button.classList.toggle("view");
            this.repeatTaskButtonIndicator();
        });

        // reset options menu
        this.elements.form.repeat.resetButton.addEventListener("click", () => {
            const repeatOptionsElements = document.querySelectorAll(
                `#${this.elements.form.repeat.options.id} input`
            );
            for (let element of repeatOptionsElements) {
                element.checked = false;
            }
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

    // change the repeat button style if any repeat options selected
    repeatTaskButtonIndicator() {
        const selectedOptions = document.querySelectorAll(
            `#${this.elements.form.repeat.options.id} input:checked`
        );

        // if items selected
        if (selectedOptions.length > 0) {
            this.elements.form.repeat.button.classList.add("enabled-options");
        } else {
            console.log(selectedOptions.length);
            this.elements.form.repeat.button.classList.remove("enabled-options");
        }
    }
}
