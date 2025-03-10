let activityChart = null;
let statusChart = null;

async function loadAvailableDates() {
    try {
        const response = await fetch('/api/stats/available-dates');
        if (!response.ok) throw new Error('Ошибка загрузки дат');
        
        const dates = await response.json();
        const select = document.getElementById('dateSelect');
        select.innerHTML = '<option value="current">Сегодня</option>';
        
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            const [year, month, day] = date.split('-');
            option.textContent = `${day}.${month}.${year}`;
            select.appendChild(option);
        });
    } catch (error) {
        showError('Не удалось загрузить список дат');
        console.error(error);
    }
}

function showError(message) {
    const toast = new bootstrap.Toast(document.getElementById('errorToast'));
    document.querySelector('.toast-body').textContent = message;
    toast.show();
}

function formatTime(minutes) {
    if (minutes === 0) return '0 мин';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? hours + ' ч ' : ''}${mins > 0 ? mins + ' мин' : ''}`.trim();
}

function formatDate(date) {
    return new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateCurrentTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = formatDate(now);
}

function getStatusIndicator(status) {
    const statusClass = {
        'online': 'status-online',
        'away': 'status-away',
        'offline': 'status-offline'
    }[status] || 'status-offline';

    return `<span class="status-indicator ${statusClass}"></span>${status}`;
}

async function updateUserStats(data) {
    const tbody = document.getElementById('userStats');
    tbody.innerHTML = '';

    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7" class="text-center">Нет данных за выбранный период</td>';
        tbody.appendChild(tr);
        return;
    }

    data.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td>
                <span class="status-indicator status-${user.currentStatus}"></span>
                ${user.currentStatus}
            </td>
            <td class="time-cell">${formatTime(Math.floor(user.statusTime.online / 60000))}</td>
            <td class="time-cell">${formatTime(Math.floor(user.statusTime.away / 60000))}</td>
            <td class="time-cell">${formatTime(Math.floor(user.statusTime.offline / 60000))}</td>
            <td class="time-cell">${formatTime(Math.floor(user.activityTime / 60000))}</td>
            <td>${user.lastActivity ? formatDate(user.lastActivity) : 'Нет данных'}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateBoardStats() {
    try {
        const response = await fetch('/api/boards');
        if (!response.ok) throw new Error('Ошибка загрузки статистики досок');
        
        const stats = await response.json();
        const tbody = document.getElementById('boardStats');
        tbody.innerHTML = '';

        if (stats.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" class="text-center">Нет данных по доскам</td>';
            tbody.appendChild(tr);
            return;
        }

        stats.forEach(board => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${board.boardName}</td>
                <td>${board.firstListName}</td>
                <td class="text-center">${board.firstListCount}</td>
                <td>${board.secondListName}</td>
                <td class="text-center">${board.secondListCount}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showError('Не удалось загрузить статистику досок');
        console.error(error);
    }
}

async function refreshData() {
    const selectedDate = document.getElementById('dateSelect').value;
    try {
        const response = await fetch(selectedDate === 'current' ? '/api/stats' : `/api/stats/${selectedDate}`);
        if (!response.ok) throw new Error('Ошибка загрузки данных');
        
        const data = await response.json();
        await updateUserStats(data);
        await updateBoardStats();
        updateCurrentTime();
    } catch (error) {
        showError('Не удалось загрузить данные');
        console.error(error);
    }
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

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await loadAvailableDates();
    await refreshData();
    updateCurrentTime();
    
    // Обновление времени каждую минуту
    // setInterval(updateCurrentTime, 60000);
    
    // Обработчик изменения даты
    document.getElementById('dateSelect').addEventListener('change', refreshData);
}); 