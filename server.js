const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

// 中間件設置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 讀取 content.json
async function readContent() {
    try {
        const content = await fs.readFile('public/content.json', 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('讀取檔案錯誤：', error);
        return { pages: [] };
    }
}

// 儲存 content.json
async function saveContent(content) {
    try {
        await fs.writeFile(
            'public/content.json', 
            JSON.stringify(content, null, 2),
            'utf8'
        );
        return true;
    } catch (error) {
        console.error('儲存檔案錯誤：', error);
        return false;
    }
}

// API 路由
// 獲取所有頁面
app.get('/api/pages', async (req, res) => {
    try {
        const content = await readContent();
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: '讀取頁面失敗' });
    }
});

// 新增或更新頁面
app.post('/api/pages', async (req, res) => {
    try {
        const content = await readContent();
        const newPage = req.body;
        
        const index = content.pages.findIndex(p => p.id === newPage.id);
        if (index > -1) {
            content.pages[index] = newPage;
        } else {
            content.pages.push(newPage);
        }
        
        await saveContent(content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '儲存頁面失敗' });
    }
});

// 刪除頁面
app.delete('/api/pages/:id', async (req, res) => {
    try {
        const content = await readContent();
        content.pages = content.pages.filter(p => p.id !== req.params.id);
        await saveContent(content);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '刪除頁面失敗' });
    }
});

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
}); 