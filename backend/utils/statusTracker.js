const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '../volume/status_stats.json');
const WORK_START_HOUR = 10;
const WORK_END_HOUR = 18;

class StatusTracker {
    constructor() {
        this.statusData = new Map();
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(STATUS_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
                this.statusData = new Map(data.map(([id, entry]) => [
                    id,
                    {
                        ...entry,
                        startTime: entry.startTime ? new Date(entry.startTime) : null
                    }
                ]));
            }
        } catch (error) {
            console.error('Ошибка загрузки данных статусов:', error);
        }
    }

    saveData() {
        const data = Array.from(this.statusData.entries()).map(([id, entry]) => [
            id,
            {
                ...entry,
                startTime: entry.startTime ? entry.startTime.getTime() : null
            }
        ]);
        fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
    }

    isWorkingHours() {
        const now = new Date();
        const hours = now.getHours();
        const day = now.getDay();
        return day >= 1 && day <= 5 && hours >= WORK_START_HOUR && hours < WORK_END_HOUR;
    }

    getUserStatus(nickname) {
        const match = nickname.match(/^\[([^\]]+)\]/);
        if (!match) return null;
        
        // Convert Russian status to English
        const statusMap = {
            'онлайн': 'online',
            'оффлайн': 'offline',
            'отошел': 'away'
        };
        
        return statusMap[match[1].toLowerCase()] || match[1].toLowerCase();
    }

    updateUserStatus(userId, nickname, timestamp = new Date()) {
        const status = this.getUserStatus(nickname);
        if (!status) return;

        if (!this.statusData.has(userId)) {
            this.statusData.set(userId, { 
                currentStatus: status,
                startTime: timestamp,
                totalTime: { online: 0, away: 0, offline: 0 }
            });
        } else {
            const userData = this.statusData.get(userId);
            if (userData.currentStatus !== status) {
                if (userData.startTime) {
                    const duration = timestamp - userData.startTime;
                    userData.totalTime[userData.currentStatus] += duration;
                }
                userData.currentStatus = status;
                userData.startTime = timestamp;
            }
        }
        this.saveData();
    }

    async resetAllStatuses(client) {
        const now = new Date();
        if (now.getHours() === WORK_END_HOUR && now.getMinutes() === 0) {
            const guild = client.guilds.cache.first();
            if (!guild) return;

            const bot = guild.members.me;
            if (!bot.permissions.has('ManageNicknames')) {
                console.error('Bot lacks permission to manage nicknames');
                return;
            }

            const members = await guild.members.fetch();
            for (const [, member] of members) {
                if (member.user.bot) continue;
                if (member.roles.highest.position >= bot.roles.highest.position) continue;
                
                let originalNick = member.nickname || member.user.username;
                originalNick = originalNick.replace(/^\[[^\]]+\]\s*\|\s*/, '');
                
                try {
                    await member.setNickname(`[оффлайн] | ${originalNick}`);
                    this.updateUserStatus(member.id, `[оффлайн] | ${originalNick}`);
                } catch (error) {
                    console.error(`Ошибка сброса статуса для ${member.displayName}:`, error);
                }
            }
        }
    }

    getDailyReport() {
        const report = [];
        for (const [userId, data] of this.statusData.entries()) {
            const totalOnline = Math.floor(data.totalTime.online / (1000 * 60 * 60));
            const totalAway = Math.floor(data.totalTime.away / (1000 * 60 * 60));
            report.push({
                userId,
                online: totalOnline,
                away: totalAway,
                status: data.currentStatus
            });
        }
        return report;
    }

    resetDailyStats() {
        for (const data of this.statusData.values()) {
            data.totalTime = { online: 0, away: 0, offline: 0 };
        }
        this.saveData();
    }
}

module.exports = new StatusTracker(); 