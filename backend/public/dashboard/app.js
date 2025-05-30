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
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || error.error || 'Ошибка загрузки статистики досок');
        }
        
        const groups = await response.json();
        const container = document.getElementById('boardGroups');
        container.innerHTML = '';

        if (!Array.isArray(groups) || groups.length === 0) {
            container.innerHTML = '<div class="text-center">Нет данных по доскам</div>';
            return;
        }

        groups.forEach((group, index) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'mb-4';
            
            // Создаем таблицу для группы
            const table = document.createElement('table');
            table.className = 'table table-hover';
            
            // Заголовок таблицы
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Название доски</th>
                    <th class="text-center">${group.listNames[0]}</th>
                    <th class="text-center">${group.listNames[1]}</th>
                    <th class="text-center">Всего</th>
                </tr>
            `;
            
            // Тело таблицы
            const tbody = document.createElement('tbody');
            
            group.boards.forEach(board => {
                const total = board.counts[0] + board.counts[1];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${board.boardName}</td>
                    <td class="text-center">${board.counts[0]}</td>
                    <td class="text-center">${board.counts[1]}</td>
                    <td class="text-center">${total}</td>
                `;
                tbody.appendChild(tr);
            });
            
            // Добавляем таблицу в любом случае
            table.appendChild(thead);
            table.appendChild(tbody);
            groupDiv.appendChild(table);
            container.appendChild(groupDiv);
        });

        if (container.children.length === 0) {
            container.innerHTML = '<div class="text-center">Нет активных досок</div>';
        }
    } catch (error) {
        showError(error.message || 'Не удалось загрузить статистику досок');
        console.error(error);
        
        // Очищаем контейнер и показываем сообщение об ошибке
        const container = document.getElementById('boardGroups');
        container.innerHTML = '<div class="text-center text-danger">Ошибка загрузки данных</div>';
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
        updateCharts(data);
    } catch (error) {
        showError('Не удалось загрузить данные');
        console.error(error);
    }
}

function updateCharts(data) {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,  // соотношение ширины к высоте 2:1
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Часы'
                }
            }
        }
    };

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
            ...commonOptions,
            plugins: {
                legend: {
                    display: false // скрываем легенду, так как она не нужна для одного набора данных
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
            ...commonOptions,
            plugins: {
                legend: {
                    position: 'bottom',
                    display: true
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