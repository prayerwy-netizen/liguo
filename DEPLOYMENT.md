# 梨果礼物兑换系统 - 部署指南

本指南将帮助你将系统部署到 GitHub Pages 和 Supabase，实现在线访问和云端数据存储。

## 📋 部署方案概述

### 当前架构（纯前端 + LocalStorage）
- ✅ 完全离线可用
- ✅ 无服务器成本
- ❌ 数据只存在本地浏览器
- ❌ 无法跨设备同步
- ❌ 清除浏览器数据会丢失所有记录

### 升级后架构（前端 + Supabase云数据库）
- ✅ 数据云端存储，永久保存
- ✅ 跨设备同步（手机、平板、电脑共享数据）
- ✅ 自动备份
- ✅ 可扩展到多个家庭
- 💰 Supabase 免费版足够使用

---

## 🚀 部署步骤

### 第一步：部署到 GitHub Pages（托管前端）

#### 1.1 创建 GitHub 仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角 "+" → "New repository"
3. 填写信息：
   - Repository name: `dingdang-gift-system`
   - Description: 梨果礼物兑换系统
   - 选择 **Public**（必须公开才能使用免费的 GitHub Pages）
   - ✅ 勾选 "Add a README file"
4. 点击 "Create repository"

#### 1.2 上传代码到 GitHub

**方法 A：使用 GitHub 网页上传（推荐新手）**

1. 在你的仓库页面，点击 "Add file" → "Upload files"
2. 将整个项目文件夹中的所有文件拖拽到页面（除了 `.git` 文件夹）
3. 在底部填写提交信息：`Initial commit - 初始版本`
4. 点击 "Commit changes"

**方法 B：使用 Git 命令行**

```bash
# 在项目文件夹中打开终端
cd "/Users/king_yu/Desktop/24/机器人/学习/梨果打卡器"

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 创建第一次提交
git commit -m "Initial commit - 初始版本"

# 连接到 GitHub 仓库（替换成你的用户名）
git remote add origin https://github.com/你的用户名/dingdang-gift-system.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

#### 1.3 启用 GitHub Pages

1. 在仓库页面，点击 "Settings"（设置）
2. 左侧菜单找到 "Pages"
3. 在 "Source" 下选择：
   - Branch: `main`
   - Folder: `/root`
4. 点击 "Save"
5. 等待 1-2 分钟，页面会显示你的网站地址：
   ```
   https://你的用户名.github.io/dingdang-gift-system/
   ```

✅ **前端部署完成！** 现在可以通过这个网址访问系统了。

---

### 第二步：集成 Supabase 云数据库

#### 2.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并注册账号
2. 点击 "New Project"
3. 填写项目信息：
   - Name: `dingdang-gift-system`
   - Database Password: 设置一个强密码（请记住！）
   - Region: 选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`（距离中国最近）
4. 点击 "Create new project"，等待 2-3 分钟初始化

#### 2.2 创建数据库表结构

1. 在 Supabase 项目页面，点击左侧 "SQL Editor"
2. 点击 "New query"
3. 复制以下 SQL 代码并执行：

```sql
-- 创建任务表
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  score INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('positive', 'negative')),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建礼物表
CREATE TABLE gifts (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  image TEXT,
  score INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建积分记录表
CREATE TABLE records (
  id BIGSERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  task_name VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  note TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建兑换申请表
CREATE TABLE requests (
  id BIGSERIAL PRIMARY KEY,
  gift_id INTEGER REFERENCES gifts(id),
  gift_name VARCHAR(100) NOT NULL,
  score INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建系统设置表
CREATE TABLE settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认PIN码
INSERT INTO settings (key, value) VALUES ('parent_pin', '1234');

-- 插入17个默认任务
INSERT INTO tasks (name, unit, score, type) VALUES
('算数', '10题/次', 3, 'positive'),
('英语绘本', '1本/次', 5, 'positive'),
('跳绳', '100个/次', 3, 'positive'),
('玩具收纳', '1次', 2, 'positive'),
('刷牙', '1次', 1, 'positive'),
('洗澡', '1次', 1, 'positive'),
('洗袜子', '1双', 2, 'positive'),
('洗碗', '1次', 3, 'positive'),
('扫地', '1次', 3, 'positive'),
('拖地', '1次', 5, 'positive'),
('叠衣服', '1次', 2, 'positive'),
('整理书桌', '1次', 2, 'positive'),
('帮忙做饭', '1次', 5, 'positive'),
('乱发脾气', '1次', -3, 'negative'),
('打人', '1次', -5, 'negative'),
('说谎', '1次', -5, 'negative'),
('用脏话骂人', '1次', -2, 'negative'),
('不听话顶嘴', '1次', -3, 'negative');

-- 启用行级安全（Row Level Security）
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 创建公开访问策略（因为是单用户家庭应用，允许匿名访问）
CREATE POLICY "Enable all access for all users" ON tasks FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON gifts FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON records FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON requests FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON settings FOR ALL USING (true);
```

4. 点击 "Run" 执行，确认显示 "Success"

#### 2.3 获取 API 密钥

1. 在 Supabase 项目页面，点击左侧 "Settings" → "API"
2. 找到以下两个信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJ...`（很长的字符串）
3. 复制保存这两个值

---

### 第三步：前端代码集成 Supabase

#### 3.1 添加 Supabase 客户端库

在所有 HTML 文件的 `<head>` 标签中，在 `common.js` 引用之前添加：

```html
<!-- Supabase 客户端库 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

#### 3.2 创建 Supabase 配置文件

创建新文件 `js/supabase.js`：

```javascript
// Supabase 配置
const SUPABASE_URL = 'https://你的项目ID.supabase.co'  // 替换成你的 Project URL
const SUPABASE_ANON_KEY = '你的anon_key'  // 替换成你的 anon public key

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 数据同步管理器
class SupabaseDataManager {
  constructor() {
    this.initSync()
  }

  // 初始化：从云端拉取数据到本地
  async initSync() {
    try {
      await this.syncFromCloud()
      console.log('✅ 数据已从云端同步')
    } catch (error) {
      console.error('❌ 同步失败，使用本地数据:', error)
    }
  }

  // 从云端同步到本地
  async syncFromCloud() {
    // 同步任务
    const { data: tasks } = await supabase.from('tasks').select('*')
    if (tasks) localStorage.setItem('tasks', JSON.stringify(tasks))

    // 同步礼物
    const { data: gifts } = await supabase.from('gifts').select('*')
    if (gifts) localStorage.setItem('gifts', JSON.stringify(gifts))

    // 同步记录
    const { data: records } = await supabase.from('records').select('*')
    if (records) localStorage.setItem('records', JSON.stringify(records))

    // 同步申请
    const { data: requests } = await supabase.from('requests').select('*')
    if (requests) localStorage.setItem('requests', JSON.stringify(requests))

    // 同步设置
    const { data: settings } = await supabase.from('settings').select('*')
    if (settings) {
      const settingsObj = {}
      settings.forEach(item => settingsObj[item.key] = item.value)
      localStorage.setItem('settings', JSON.stringify(settingsObj))
    }
  }

  // 同步单个任务到云端
  async syncTask(task) {
    if (task.id) {
      await supabase.from('tasks').upsert(task)
    }
  }

  // 同步单个礼物到云端
  async syncGift(gift) {
    if (gift.id) {
      await supabase.from('gifts').upsert(gift)
    }
  }

  // 同步单个记录到云端
  async syncRecord(record) {
    const { data } = await supabase.from('records').insert([record]).select()
    return data?.[0]
  }

  // 同步单个申请到云端
  async syncRequest(request) {
    if (request.id) {
      await supabase.from('requests').upsert(request)
    }
  }

  // 更新设置
  async syncSetting(key, value) {
    await supabase.from('settings').upsert({ key, value })
  }

  // 删除任务
  async deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
  }

  // 删除礼物
  async deleteGift(id) {
    await supabase.from('gifts').delete().eq('id', id)
  }
}

// 创建全局实例
const supabaseSync = new SupabaseDataManager()
```

#### 3.3 修改 `common.js` 集成云同步

在 `common.js` 中的 `DataManager` 类的关键方法后添加云同步调用。

例如，在 `addTask` 方法后添加：
```javascript
addTask(task) {
  // ... 原有代码 ...

  // 同步到云端
  if (window.supabaseSync) {
    supabaseSync.syncTask(newTask)
  }

  return newTask
}
```

对所有增删改操作都添加类似的云同步调用。

---

## ✅ 部署完成检查清单

- [ ] GitHub 仓库已创建并上传代码
- [ ] GitHub Pages 已启用并可访问
- [ ] Supabase 项目已创建
- [ ] 数据库表结构已创建
- [ ] API 密钥已获取并配置到代码中
- [ ] Supabase 客户端库已添加到 HTML
- [ ] `supabase.js` 配置文件已创建
- [ ] `common.js` 已集成云同步逻辑
- [ ] 测试：添加任务→刷新页面→数据仍存在
- [ ] 测试：在手机上访问→数据与电脑一致

---

## 🎯 下一步增强

部署完成后，你可以继续优化：

1. **添加数据迁移功能**：一键将本地 LocalStorage 数据导入到 Supabase
2. **实时同步**：使用 Supabase Realtime 实现多设备实时更新
3. **用户认证**：添加家长账号登录（支持多个家庭）
4. **数据统计**：在 Supabase 中查询和分析积分趋势
5. **自定义域名**：将 GitHub Pages 绑定到你的域名

---

## 🆘 常见问题

### Q: GitHub Pages 显示 404
A: 确保仓库是 Public，并且在 Settings → Pages 中选择了正确的分支。

### Q: Supabase 连接失败
A: 检查 API 密钥是否正确，确保网络可以访问 `supabase.co`。

### Q: 数据没有同步
A: 打开浏览器开发者工具（F12）→ Console，查看是否有错误信息。

### Q: 如何备份数据？
A: 在 Supabase 项目 → Database → Backups 中可以手动备份或设置自动备份。

---

**部署成功后，你的系统将：**
- 📱 可在任何设备通过网址访问
- ☁️ 数据永久保存在云端
- 🔄 多设备自动同步
- 🔒 免费且安全

有问题随时问我！🎉
