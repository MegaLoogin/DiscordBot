const fs = require('fs');
const path = require('path');
const activityTracker = require('./activityTracker');
const { changeUserStatus } = require('../commands/main/status');

const STATUS_FILE = path.join(__dirname, '../volume/status_stats.json');
const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR) || 8;
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR) || 17;

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
        const match = nickname.match(/^(\p{Emoji})/u);
        if (!match) return null;
        
        const emojiMap = {
            '🟢': 'online',
            '🔴': 'offline',
            '🟡': 'away'
        };
        
        return emojiMap[match[1]] || null;
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
            if (userData.startTime) {
                const duration = timestamp - userData.startTime;
                userData.totalTime[userData.currentStatus] += duration;
            }
            userData.currentStatus = status;
            userData.startTime = timestamp;
        }
    }

    parseNickname(nickname) {
        const statusMatch = nickname.match(/^(\p{Emoji})\s*(.+)$/u);
        if (statusMatch) {
            return {
                currentStatus: statusMatch[1],
                baseName: statusMatch[2]
            };
        }
        return {
            currentStatus: null,
            baseName: nickname
        };
    }

    async resetAllStatuses(client) {
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
            
            const currentNick = member.nickname || member.user.globalName || member.user.username;
            const { currentStatus, baseName } = this.parseNickname(currentNick);

            if (!currentStatus) {
                const newNick = `🔴 ${baseName}`;
                try {
                    await member.setNickname(newNick);
                } catch (error) {
                    console.error(`Ошибка обновления статуса для ${member.displayName}:`, error);
                }
            }

            this.updateUserStatus(member.id, currentStatus ? currentNick : `🔴 ${baseName}`);
        }

        this.saveData();
    }

    getDailyReport() {
        const report = [];
        for (const [userId, data] of this.statusData.entries()) {
            const totalOnline = Math.floor(data.totalTime.online / (1000 * 60));
            const totalAway = Math.floor(data.totalTime.away / (1000 * 60));
            const totalOffline = Math.floor(data.totalTime.offline / (1000 * 60));
            report.push({
                userId,
                online: totalOnline,
                away: totalAway,
                offline: totalOffline
            });
        }
        return report;
    }

    async resetDailyStats(client) {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        for (const [userId, data] of this.statusData.entries()) {
            data.totalTime = { online: 0, away: 0, offline: 0 };
            data.currentStatus = '🔴';

            try {
                const member = await guild.members.fetch(userId);
                await changeUserStatus(member, 'offline');
            } catch (error) {
                console.error(`Ошибка обновления статуса для пользователя ${userId}:`, error);
            }
        }
        this.saveData();
    }

    formatReport(report) {
        return report.map((u, i) => 
            `${i + 1}. <@${u.userId}>:\n` +
            `  • Активность: ${activityTracker.formatTime(u.activity)}\n` +
            `  • Статус онлайн: ${Math.floor(u.online / 60)}ч ${Math.round(u.online % 60)}м\n` +
            `  • Статус отошел: ${Math.floor(u.away / 60)}ч ${Math.round(u.away % 60)}м\n` +
            `  • Статус офлайн: ${Math.floor(u.offline / 60)}ч ${Math.round(u.offline % 60)}м`
        ).join('\n\n');
    }
}

module.exports = new StatusTracker(); 