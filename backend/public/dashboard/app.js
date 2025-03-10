let activityChart = null;
let statusChart = null;

async function loadAvailableDates() {
    try {
        const response = await fetch('/api/stats/available-dates');
        const dates = await response.json();
        
        const select = document.getElementById('dateSelect');
        select.innerHTML = '<option value="current">Сегодня</option>';
        
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            // Форматируем дату для отображения
            const [year, month, day] = date.split('-');
            option.textContent = `${day}.${month}.${year}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка при загрузке доступных дат:', error);
        showError('Не удалось загрузить список дат');
    }
}

function showError(message) {
    // Можно улучшить отображение ошибок, добавив toast или alert
    alert(message);
}

function formatTime(ms) {
    if (!ms) return '0ч 0м';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'Нет данных';
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
        const selectedDate = document.getElementById('dateSelect').value;
        const url = selectedDate === 'current' ? '/api/stats' : `/api/stats/${selectedDate}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        updateTable(data);
        updateCharts(data);
        updateCurrentTime();
        
        // Обновляем заголовок с выбранной датой
        const dateDisplay = selectedDate === 'current' ? 'сегодня' : new Date(selectedDate).toLocaleDateString('ru-RU');
        document.querySelector('.card-header h5').textContent = `Сводка активности за ${dateDisplay}`;
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        showError('Не удалось загрузить данные');
    }
}

function updateTable(data) {
    const tbody = document.getElementById('userStats');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" class="text-center">Нет данных за выбранный период</td>';
        tbody.appendChild(row);
        return;
    }

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
            data: data.map(user => user.activityTime / (1000 * 60 * 60)),
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

// Обновляем данные каждую минуту только для текущего дня
setInterval(() => {
    if (document.getElementById('dateSelect').value === 'current') {
        refreshData();
    }
}, 60000);

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadAvailableDates();
    refreshData();
    
    // Обработчик изменения даты
    document.getElementById('dateSelect').addEventListener('change', refreshData);
}); 