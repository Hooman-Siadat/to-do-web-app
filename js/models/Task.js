export default class Task {
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
