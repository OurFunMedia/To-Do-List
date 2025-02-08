class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.setupEventListeners();
    }

    async loadTasks() {
        try {
            const response = await fetch('content.json?' + new Date().getTime());
            const data = await response.json();
            this.tasks = data.tasks;
            this.renderTasks();
        } catch (error) {
            console.error('載入失敗：', error);
            document.getElementById('taskContainer').innerHTML = '<p>載入失敗，請重新整理頁面。</p>';
        }
    }

    setupEventListeners() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.target.dataset.filter;
                // 更新按鈕狀態
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // 重新渲染任務列表
                this.renderTasks();
            });
        });
    }

    renderTasks() {
        const container = document.getElementById('taskContainer');
        const filteredTasks = this.filterTasks();
        
        if (filteredTasks.length === 0) {
            container.innerHTML = '<p class="no-tasks">沒有待辦事項</p>';
            return;
        }

        container.innerHTML = filteredTasks
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(task => this.createTaskHTML(task))
            .join('');
    }

    filterTasks() {
        switch (this.currentFilter) {
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            case 'completed':
                return this.tasks.filter(task => task.completed);
            default:
                return this.tasks;
        }
    }

    createTaskHTML(task) {
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-date">${this.formatDate(task.date)}</div>
                <div class="task-content">${task.content}</div>
                <div class="task-status ${task.completed ? 'completed' : 'pending'}">
                    <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                </div>
            </div>
        `;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
}); 