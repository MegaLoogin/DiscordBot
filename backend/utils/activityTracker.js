const fs = require('fs');
const path = require('path');

const ACTIVITY_FILE = path.join(__dirname, '../volume/activityData.json');
const WORK_START_HOUR = 10;
const WORK_END_HOUR = 18;

class ActivityTracker {
    constructor() {
        this.userTime = new Map();
        this.lastActivity = new Map();
        this.lastNotification = new Map();
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(ACTIVITY_FILE)) {
                const data = JSON.parse(fs.readFileSync(ACTIVITY_FILE));
                this.userTime = new Map(data.userTime);
                this.lastActivity = new Map(data.lastActivity);
                this.lastNotification = new Map(data.lastNotification);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных активности:', error);
        }
    }

    saveData() {
        const data = {
            userTime: Array.from(this.userTime.entries()),
            lastActivity: Array.from(this.lastActivity.entries()),
            lastNotification: Array.from(this.lastNotification.entries())
        };
        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data));
    }

    isWorkingTime() {
        const now = new Date();
        const hours = now.getHours();
        const day = now.getDay();
        return day >= 1 && day <= 5 && hours >= WORK_START_HOUR && hours < WORK_END_HOUR;
    }

    formatTime(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}ч ${minutes}м`;
    }

    async getDailyReport(client, adminIds) {
        const report = [];
        const now = new Date();

        for (const [userId, data] of this.userTime) {
            if(adminIds.includes(userId)) continue;

            let total = data.totalTime;
            if (data.startTime) {
                total += now - data.startTime;
            }

            try {
                const user = await client.users.fetch(userId);
                report.push({
                    userId: userId,
                    time: total
                });
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        }

        return report;
    }

    resetData() {
        this.userTime.clear();
        this.lastActivity.clear();
        this.lastNotification.clear();
        this.saveData();
    }

    checkActivity(userId, adminIds) {
        if(adminIds.includes(userId)) return false;
        const now = Date.now();
        const fourHours = 4 * 60 * 60 * 1000;
        
        const activeTime = this.lastActivity.get(userId);
        if (activeTime && now - activeTime >= fourHours) {
            const lastNotified = this.lastNotification.get(userId) || 0;
            if (now - lastNotified >= fourHours) {
                return true;
            }
        }
        return false;
    }

    updateMessageActivity(userId) {
        this.lastActivity.set(userId, Date.now());
        this.saveData();
    }

    updateVoiceActivity(userId) {
        this.lastActivity.set(userId, Date.now());
        this.saveData();
    }

    updatePresence(userId, oldPresence, newPresence) {
        if (!this.userTime.has(userId)) {
            this.userTime.set(userId, { startTime: null, totalTime: 0 });
        }

        const userData = this.userTime.get(userId);
        const now = new Date();
        const newStatus = newPresence.status;
        const oldStatus = oldPresence?.status || 'offline';

        if (newStatus !== oldStatus) {
            if (newStatus !== 'offline') {
                if (!userData.startTime) {
                    userData.startTime = now;
                }
            } else {
                if (userData.startTime) {
                    userData.totalTime += now - userData.startTime;
                    userData.startTime = null;
                }
            }
            this.saveData();
        }
    }
}

module.exports = new ActivityTracker(); 