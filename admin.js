import config from './config.js';

class TaskAdmin {
    constructor() {
        this.tasks = [];
        this.currentTask = null;
        this.currentFilter = 'all';
        this.githubConfig = {
            ...config.github,
            token: null
        };
        this.init();
    }

    async init() {
        const token = localStorage.getItem('github_token');
        if (!token) {
            this.showTokenInput();
            return;
        }

        if (await this.validateToken(token)) {
            this.githubConfig.token = token;
            await this.loadTasks();
            this.setupEventListeners();
            document.getElementById('admin').style.display = 'block';
        } else {
            this.logout();
            alert('Token 無效或已過期，請重新輸入');
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    logout() {
        localStorage.removeItem('github_token');
        this.githubConfig.token = null;
        this.showTokenInput();
    }

    showTokenInput() {
        document.getElementById('tokenInput').style.display = 'block';
        document.getElementById('admin').style.display = 'none';
        
        // 清除任何現有的 token 狀態顯示
        const statusDiv = document.querySelector('.token-status');
        if (statusDiv) statusDiv.remove();
    }

    async saveToken(token) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'token-status';
        document.getElementById('tokenInput').appendChild(statusDiv);

        statusDiv.textContent = '驗證中...';
        
        if (await this.validateToken(token)) {
            statusDiv.textContent = 'Token 有效！';
            statusDiv.classList.add('valid');
            localStorage.setItem('github_token', token);
            this.githubConfig.token = token;
            setTimeout(() => this.init(), 1000);
        } else {
            statusDiv.textContent = 'Token 無效，請檢查後重試';
            statusDiv.classList.add('invalid');
        }
    }

    async loadTasks() {
        try {
            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.path}`);
            const data = await response.json();
            // 使用 TextDecoder 來正確解碼 UTF-8 內容
            const decoder = new TextDecoder();
            const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
            const content = JSON.parse(decoder.decode(bytes));
            this.tasks = content.tasks;
            this.sha = data.sha;
            this.renderTasks();
        } catch (error) {
            console.error('載入失敗：', error);
            alert('載入失敗');
        }
    }

    async saveContent() {
        try {
            const content = JSON.stringify({ tasks: this.tasks }, null, 2);
            // 使用 TextEncoder 來正確處理 UTF-8 編碼
            const encoder = new TextEncoder();
            const bytes = encoder.encode(content);
            const base64Content = btoa(String.fromCharCode(...bytes));

            const response = await fetch(`https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${this.githubConfig.path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: 'Update content via CMS',
                    content: base64Content,
                    sha: this.sha,
                    branch: this.githubConfig.branch
                })
            });

            if (!response.ok) {
                throw new Error('儲存失敗');
            }

            // 更新 SHA
            const data = await response.json();
            this.sha = data.content.sha;

            return true;
        } catch (error) {
            console.error('儲存失敗：', error);
            return false;
        }
    }

    setupEventListeners() {
        // 表單事件
        const form = document.getElementById('taskForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // 按鈕事件
        document.getElementById('newTaskBtn').addEventListener('click', () => this.showEditor());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteTask());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideEditor());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // 篩選按鈕
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentFilter = e.target.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderTasks();
            });
        });
    }

    renderTasks() {
        const container = document.getElementById('tasksList');
        const filteredTasks = this.filterTasks();
        
        if (filteredTasks.length === 0) {
            container.innerHTML = '<p class="no-tasks">沒有待辦事項</p>';
            return;
        }

        container.innerHTML = filteredTasks
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(task => this.createTaskHTML(task))
            .join('');

        // 添加任務操作事件
        container.querySelectorAll('.task-item-admin').forEach(item => {
            const taskId = item.dataset.id;
            item.querySelector('.edit-btn').addEventListener('click', () => this.editTask(taskId));
            item.querySelector('.task-status-toggle').addEventListener('click', () => this.toggleTaskStatus(taskId));
        });
    }

    createTaskHTML(task) {
        return `
            <div class="task-item-admin ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-date">${this.formatDate(task.date)}</div>
                <div class="task-content">${task.content}</div>
                <div class="task-status-toggle ${task.completed ? 'completed' : 'pending'}">
                    ${task.completed ? '已完成' : '未完成'}
                </div>
                <div class="task-actions">
                    <button class="edit-btn secondary-btn">編輯</button>
                </div>
            </div>
        `;
    }

    showEditor(task = null) {
        this.currentTask = task;
        const editor = document.querySelector('.editor');
        editor.classList.add('active');

        const form = document.getElementById('taskForm');
        const deleteBtn = document.getElementById('deleteBtn');

        if (task) {
            form.taskId.value = task.id;
            form.date.value = task.date;
            form.content.value = task.content;
            form.completed.checked = task.completed;
            deleteBtn.style.display = 'block';
        } else {
            form.reset();
            form.taskId.value = '';
            form.date.value = new Date().toISOString().split('T')[0];
            deleteBtn.style.display = 'none';
        }
    }

    hideEditor() {
        const editor = document.querySelector('.editor');
        editor.classList.remove('active');
        this.currentTask = null;
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.showEditor(task);
        }
    }

    async deleteTask() {
        if (!this.currentTask || !confirm('確定要刪除這個任務嗎？')) return;

        try {
            const index = this.tasks.findIndex(t => t.id === this.currentTask.id);
            if (index > -1) {
                this.tasks.splice(index, 1);
                if (await this.saveContent()) {
                    this.renderTasks();
                    this.hideEditor();
                    alert('任務已刪除！');
                } else {
                    throw new Error('刪除失敗');
                }
            }
        } catch (error) {
            console.error('刪除失敗：', error);
            alert('刪除失敗，請稍後再試。');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = {
            id: e.target.taskId.value || `task-${Date.now()}`,
            date: e.target.date.value,
            content: e.target.content.value,
            completed: e.target.completed.checked
        };

        try {
            if (this.currentTask) {
                const index = this.tasks.findIndex(t => t.id === this.currentTask.id);
                if (index > -1) {
                    this.tasks[index] = formData;
                }
            } else {
                this.tasks.push(formData);
            }

            if (await this.saveContent()) {
                this.renderTasks();
                this.hideEditor();
                alert('任務已儲存！');
            } else {
                throw new Error('儲存失敗');
            }
        } catch (error) {
            console.error('儲存失敗：', error);
            alert('儲存失敗，請稍後再試。');
        }
    }

    async toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            if (await this.saveContent()) {
                this.renderTasks();
            }
        }
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

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
}

window.saveToken = function() {
    const token = document.getElementById('githubToken').value;
    if (!token) {
        alert('請輸入 GitHub Token');
        return;
    }
    adminPanel.saveToken(token);
};

let adminPanel;
window.addEventListener('DOMContentLoaded', () => {
    adminPanel = new TaskAdmin();
}); 