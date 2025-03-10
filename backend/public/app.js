let activityChart = null;
let statusChart = null;

function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
}

function updateCurrentTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleString('ru-RU');
}

function getStatusIndicator(status) {
    const statusClass = {
        'online': 'status-online',
        'away': 'status-away',
        'offline': 'status-offline'
    }[status] || 'status-offline';

    return `<span class="status-indicator ${statusClass}"></span>${status}`;
}

async function refreshData() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        updateTable(data);
        updateCharts(data);
        updateCurrentTime();
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
    }
}

function updateTable(data) {
    const tbody = document.getElementById('userStats');
    tbody.innerHTML = '';

    data.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${getStatusIndicator(user.currentStatus)}</td>
            <td class="time-cell">${formatTime(user.statusTime.online)}</td>
            <td class="time-cell">${formatTime(user.statusTime.away)}</td>
            <td class="time-cell">${formatTime(user.statusTime.offline)}</td>
            <td class="time-cell">${formatTime(user.activityTime)}</td>
            <td>${formatDateTime(user.lastActivity)}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateCharts(data) {
    // Обновление графика активности
    const activityData = {
        labels: data.map(user => user.username),
        datasets: [{
            label: 'Время активности',
            data: data.map(user => user.activityTime / (1000 * 60 * 60)), // конвертируем в часы
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };

    if (activityChart) {
        activityChart.destroy();
    }

    activityChart = new Chart(document.getElementById('activityChart'), {
        type: 'bar',
        data: activityData,
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Часы'
                    }
                }
            }
        }
    });

    // Обновление графика статусов
    const statusData = {
        labels: ['Онлайн', 'Отошел', 'Оффлайн'],
        datasets: data.map(user => ({
            label: user.username,
            data: [
                user.statusTime.online / (1000 * 60 * 60),
                user.statusTime.away / (1000 * 60 * 60),
                user.statusTime.offline / (1000 * 60 * 60)
            ]
        }))
    };

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(document.getElementById('statusChart'), {
        type: 'bar',
        data: statusData,
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Часы'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Обновляем данные каждую минуту
setInterval(refreshData, 60000);

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    refreshData();
}); 