const fs = require('fs');
const path = require('path');

const ACTIVITY_FILE = path.join(__dirname, '../volume/activityData.json');
const WORK_START_HOUR = parseInt(process.env.WORK_START_HOUR) || 8;
const WORK_END_HOUR = parseInt(process.env.WORK_END_HOUR) || 17;

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
                const rawData = fs.readFileSync(ACTIVITY_FILE);
                if (!rawData || rawData.length === 0) {
                    console.warn('Файл активности пуст, создаём новый');
                    return;
                }

                const data = JSON.parse(rawData);
                console.log('Загруженные данные:', data);

                // Проверяем структуру данных
                if (!data.userTime || !Array.isArray(data.userTime)) {
                    throw new Error('Некорректная структура данных userTime');
                }

                // Безопасное преобразование данных с валидацией
                this.userTime = new Map(
                    data.userTime.map(([userId, userData]) => {
                        // Проверяем и корректируем данные пользователя
                        const validatedData = {
                            startTime: userData.startTime ? new Date(userData.startTime) : null,
                            totalTime: this.validateTotalTime(userData.totalTime)
                        };
                        console.log(`Загружены данные пользователя ${userId}:`, validatedData);
                        return [userId, validatedData];
                    })
                );

                this.lastActivity = new Map(data.lastActivity || []);
                this.lastNotification = new Map(data.lastNotification || []);
            }
        } catch (error) {
            console.error('Критическая ошибка загрузки данных активности:', error);
            // Создаём резервную копию проблемного файла
            if (fs.existsSync(ACTIVITY_FILE)) {
                const backupPath = `${ACTIVITY_FILE}.backup.${Date.now()}`;
                fs.copyFileSync(ACTIVITY_FILE, backupPath);
                console.log(`Создана резервная копия: ${backupPath}`);
            }
            // Инициализируем чистые данные
            this.userTime = new Map();
            this.lastActivity = new Map();
            this.lastNotification = new Map();
        }
    }

    validateTotalTime(totalTime) {
        // Проверяем, что значение является числом и не отрицательное
        if (typeof totalTime !== 'number' || isNaN(totalTime) || totalTime < 0) {
            console.warn(`Некорректное значение totalTime: ${totalTime}, устанавливаем 0`);
            return 0;
        }
        return totalTime;
    }

    saveData() {
        try {
            // Валидация данных перед сохранением
            const dataToSave = {
                userTime: Array.from(this.userTime.entries()).map(([userId, userData]) => [
                    userId,
                    {
                        startTime: userData.startTime,
                        totalTime: this.validateTotalTime(userData.totalTime)
                    }
                ]),
                lastActivity: Array.from(this.lastActivity.entries()),
                lastNotification: Array.from(this.lastNotification.entries())
            };

            // Создаём директорию, если она не существует
            const dir = path.dirname(ACTIVITY_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Сначала пишем во временный файл
            const tempFile = `${ACTIVITY_FILE}.temp`;
            fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2));
            
            // Затем безопасно переименовываем
            fs.renameSync(tempFile, ACTIVITY_FILE);
            
            console.log('Данные успешно сохранены');
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            throw error;
        }
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
        console.log(`Обновление присутствия для ${userId}:`, {
            oldStatus: oldPresence?.status || 'offline',
            newStatus: newPresence.status
        });

        if (!this.userTime.has(userId)) {
            console.log(`Инициализация нового пользователя ${userId}`);
            this.userTime.set(userId, { startTime: null, totalTime: 0 });
        }

        const userData = this.userTime.get(userId);
        console.log(`Текущие данные пользователя ${userId}:`, userData);

        if (userData.totalTime === null) {
            console.warn(`Исправление null totalTime для пользователя ${userId}`);
            userData.totalTime = 0;
        }

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