/**
 * Supabase 多用户云数据库配置文件
 * 支持宥宝和梨果两个用户，共用同一个数据库但使用不同的表
 */

// ⚠️ 重要：请替换为你自己的 Supabase 项目信息
// 获取方式：Supabase 项目 → Settings → API
const SUPABASE_URL = 'https://jrczjbabkmgiozgdyahc.supabase.co'  // 例如: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyY3pqYmFia21naW96Z2R5YWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzg0MjMsImV4cCI6MjA3Nzg1NDQyM30.OUe0_8Y0fi6GH_ILvg9uddjcGd-RTTXNUXx_lIbYVlU'  // 以 eyJhbGci 开头的长字符串

// 用户配置
const USERS = {
  youbao: {
    name: '宥宝',
    tablePrefix: 'youbao_',
    localStoragePrefix: 'dingdang_'
  },
  liguo: {
    name: '梨果',
    tablePrefix: 'liguo_',
    localStoragePrefix: 'liguo_'
  }
};

// 获取当前用户（从localStorage读取，默认为宥宝）
function getCurrentUser() {
  return localStorage.getItem('current_user') || 'youbao';
}

// 设置当前用户
function setCurrentUser(userId) {
  if (!USERS[userId]) {
    console.error(`无效的用户ID: ${userId}`);
    return false;
  }
  localStorage.setItem('current_user', userId);
  console.log(`已切换到用户: ${USERS[userId].name}`);
  return true;
}

// 获取当前用户配置
function getCurrentUserConfig() {
  const userId = getCurrentUser();
  return USERS[userId];
}

// 获取表名（自动添加当前用户前缀）
function getTableName(tableName) {
  const config = getCurrentUserConfig();
  return `${config.tablePrefix}${tableName}`;
}

// 获取localStorage键名（自动添加当前用户前缀）
function getLocalStorageKey(key) {
  const config = getCurrentUserConfig();
  return `${config.localStoragePrefix}${key}`;
}

// 检查是否已配置 Supabase
const isSupabaseConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' &&
                             SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

// 初始化 Supabase 客户端（如果已配置）
let supabaseClient = null;
if (isSupabaseConfigured && typeof window.supabase !== 'undefined') {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase 客户端初始化成功');
  } catch (error) {
    console.error('❌ Supabase 客户端初始化失败:', error);
  }
}

/**
 * Supabase 多用户数据同步管理器
 * 负责本地 LocalStorage 和云端数据库之间的双向同步
 * 支持多个用户使用不同的数据表
 */
class SupabaseSyncMultiUser {
  constructor() {
    this.enabled = isSupabaseConfigured && supabaseClient !== null;
    this.syncPromise = null;
    this.isLocalOperation = false;
    this.hasInitialized = sessionStorage.getItem('supabase_initialized') === 'true';

    if (this.enabled) {
      const userConfig = getCurrentUserConfig();
      console.log(`🌐 云同步已启用 - 当前用户: ${userConfig.name} (${getCurrentUser()})`);
    } else {
      console.log('📱 仅使用本地存储模式');
    }
  }

  /**
   * 初始化：从云端同步数据到本地
   */
  async init() {
    if (!this.enabled) return Promise.resolve();

    if (this.hasInitialized) {
      console.log('📱 使用本地数据（本次会话已同步）');
      return Promise.resolve();
    }

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        await this.syncFromCloud();
        const userConfig = getCurrentUserConfig();
        console.log(`✅ ${userConfig.name}的数据已从云端同步到本地`);
        this.hasInitialized = true;
        sessionStorage.setItem('supabase_initialized', 'true');
      } catch (error) {
        console.error('❌ 云端同步失败，将使用本地数据:', error);
        throw error;
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * 从云端拉取所有数据到本地
   */
  async syncFromCloud() {
    if (!this.enabled) return;

    try {
      const userConfig = getCurrentUserConfig();
      console.log(`🔄 正在同步 ${userConfig.name} 的数据...`);

      // 同步任务
      const { data: tasks, error: tasksError } = await supabaseClient
        .from(getTableName('tasks'))
        .select('*')
        .order('type', { ascending: false })
        .order('score', { ascending: false });

      if (tasksError) throw tasksError;
      if (tasks && tasks.length > 0) {
        localStorage.setItem(getLocalStorageKey('tasks'), JSON.stringify(tasks));
        console.log(`✅ 同步 ${tasks.length} 个任务`);
      }

      // 同步礼物
      const { data: gifts, error: giftsError } = await supabaseClient
        .from(getTableName('gifts'))
        .select('*')
        .order('id', { ascending: true });

      if (giftsError) throw giftsError;
      if (gifts) {
        localStorage.setItem(getLocalStorageKey('gifts'), JSON.stringify(gifts));
        console.log(`✅ 同步 ${gifts.length} 个礼物`);
      }

      // 同步记录
      const { data: records, error: recordsError } = await supabaseClient
        .from(getTableName('records'))
        .select('*')
        .order('date', { ascending: false });

      if (recordsError) throw recordsError;
      if (records) {
        const formattedRecords = records.map(record => ({
          id: record.id,
          taskId: record.task_id,
          taskName: record.task_name,
          score: record.score,
          note: record.note,
          date: record.date
        }));
        localStorage.setItem(getLocalStorageKey('records'), JSON.stringify(formattedRecords));
        console.log(`✅ 同步 ${records.length} 条记录`);
      }

      // 同步兑换申请
      const { data: requests, error: requestsError } = await supabaseClient
        .from(getTableName('requests'))
        .select('*')
        .order('date', { ascending: false });

      if (requestsError) throw requestsError;
      if (requests) {
        const formattedRequests = requests.map(request => ({
          id: request.id,
          giftId: request.gift_id,
          giftName: request.gift_name,
          score: request.score,
          status: request.status,
          date: request.date
        }));
        localStorage.setItem(getLocalStorageKey('requests'), JSON.stringify(formattedRequests));
        console.log(`✅ 同步 ${requests.length} 个兑换申请`);
      }

      // 同步设置
      const { data: settings, error: settingsError } = await supabaseClient
        .from(getTableName('settings'))
        .select('*');

      if (settingsError) throw settingsError;
      if (settings) {
        const settingsObj = {};
        settings.forEach(item => {
          settingsObj[item.key] = item.value;
        });
        localStorage.setItem(getLocalStorageKey('settings'), JSON.stringify(settingsObj));
        console.log(`✅ 同步 ${settings.length} 项设置`);
      }
    } catch (error) {
      console.error('❌ 从云端同步数据失败:', error);
      throw error;
    }
  }

  /**
   * 添加任务到云端
   */
  async addTask(task) {
    if (!this.enabled) return task;

    try {
      const { data, error } = await supabaseClient
        .from(getTableName('tasks'))
        .insert([{
          name: task.name,
          unit: task.unit,
          score: task.score,
          type: task.type,
          enabled: task.enabled !== undefined ? task.enabled : true
        }])
        .select();

      if (error) throw error;
      console.log('✅ 任务已同步到云端:', data[0]);
      return data[0];
    } catch (error) {
      console.error('❌ 同步任务到云端失败:', error);
      return task;
    }
  }

  /**
   * 更新任务到云端
   */
  async updateTask(task) {
    if (!this.enabled || !task.id) return;

    try {
      const { error } = await supabaseClient
        .from(getTableName('tasks'))
        .update({
          name: task.name,
          unit: task.unit,
          score: task.score,
          type: task.type,
          enabled: task.enabled
        })
        .eq('id', task.id);

      if (error) throw error;
      console.log('✅ 任务更新已同步到云端');
    } catch (error) {
      console.error('❌ 同步任务更新失败:', error);
    }
  }

  /**
   * 删除云端任务
   */
  async deleteTask(id) {
    if (!this.enabled || !id) return;

    try {
      this.isLocalOperation = true;

      const { error } = await supabaseClient
        .from(getTableName('tasks'))
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('✅ 任务删除已同步到云端');

      setTimeout(() => {
        this.isLocalOperation = false;
      }, 1000);
    } catch (error) {
      console.error('❌ 同步任务删除失败:', error);
      this.isLocalOperation = false;
    }
  }

  /**
   * 添加礼物到云端
   */
  async addGift(gift) {
    if (!this.enabled) return gift;

    try {
      const { data, error } = await supabaseClient
        .from(getTableName('gifts'))
        .insert([{
          name: gift.name,
          image: gift.image || null,
          score: gift.score,
          enabled: gift.enabled !== undefined ? gift.enabled : true
        }])
        .select();

      if (error) throw error;
      console.log('✅ 礼物已同步到云端:', data[0]);
      return data[0];
    } catch (error) {
      console.error('❌ 同步礼物到云端失败:', error);
      return gift;
    }
  }

  /**
   * 更新礼物到云端
   */
  async updateGift(gift) {
    if (!this.enabled || !gift.id) return;

    try {
      const { error } = await supabaseClient
        .from(getTableName('gifts'))
        .update({
          name: gift.name,
          image: gift.image,
          score: gift.score,
          enabled: gift.enabled
        })
        .eq('id', gift.id);

      if (error) throw error;
      console.log('✅ 礼物更新已同步到云端');
    } catch (error) {
      console.error('❌ 同步礼物更新失败:', error);
    }
  }

  /**
   * 删除云端礼物
   */
  async deleteGift(id) {
    if (!this.enabled || !id) return;

    try {
      this.isLocalOperation = true;

      const { error } = await supabaseClient
        .from(getTableName('gifts'))
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('✅ 礼物删除已同步到云端');

      setTimeout(() => {
        this.isLocalOperation = false;
      }, 1000);
    } catch (error) {
      console.error('❌ 同步礼物删除失败:', error);
      this.isLocalOperation = false;
    }
  }

  /**
   * 添加记录到云端
   */
  async addRecord(record) {
    if (!this.enabled) return record;

    try {
      const { data, error } = await supabaseClient
        .from(getTableName('records'))
        .insert([{
          task_id: record.taskId || null,
          task_name: record.taskName,
          score: record.score,
          note: record.note || '',
          date: record.date
        }])
        .select();

      if (error) throw error;
      console.log('✅ 记录已同步到云端:', data[0]);
      return data[0];
    } catch (error) {
      console.error('❌ 同步记录到云端失败:', error);
      return record;
    }
  }

  /**
   * 删除云端记录
   */
  async deleteRecord(id) {
    if (!this.enabled) {
      console.log('⚠️ 云同步未启用，跳过云端删除');
      return;
    }

    if (!id) {
      console.error('❌ deleteRecord: ID 为空');
      return;
    }

    try {
      this.isLocalOperation = true;

      console.log(`🗑️ 正在删除云端记录 ID: ${id}`);

      const { data, error } = await supabaseClient
        .from(getTableName('records'))
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('❌ Supabase 删除错误详情:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (data && data.length > 0) {
        console.log('✅ 记录删除已同步到云端，删除的记录:', data);
      } else {
        console.warn('⚠️ 删除操作执行但未返回数据');
      }

      setTimeout(() => {
        this.isLocalOperation = false;
      }, 1000);
    } catch (error) {
      console.error('❌ 同步记录删除失败:', error);
      this.isLocalOperation = false;
      throw error;
    }
  }

  /**
   * 添加兑换申请到云端
   */
  async addRequest(request) {
    if (!this.enabled) return request;

    try {
      const { data, error } = await supabaseClient
        .from(getTableName('requests'))
        .insert([{
          gift_id: request.giftId || null,
          gift_name: request.giftName,
          score: request.score,
          status: request.status || 'pending',
          date: request.date
        }])
        .select();

      if (error) throw error;
      console.log('✅ 兑换申请已同步到云端:', data[0]);
      return data[0];
    } catch (error) {
      console.error('❌ 同步兑换申请到云端失败:', error);
      return request;
    }
  }

  /**
   * 更新兑换申请到云端
   */
  async updateRequest(request) {
    if (!this.enabled || !request.id) return;

    try {
      const { error } = await supabaseClient
        .from(getTableName('requests'))
        .update({
          status: request.status
        })
        .eq('id', request.id);

      if (error) throw error;
      console.log('✅ 兑换申请更新已同步到云端');
    } catch (error) {
      console.error('❌ 同步兑换申请更新失败:', error);
    }
  }

  /**
   * 更新设置到云端
   */
  async updateSetting(key, value) {
    if (!this.enabled) return;

    try {
      const { error } = await supabaseClient
        .from(getTableName('settings'))
        .upsert({
          key: key,
          value: value,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log(`✅ 设置 ${key} 已同步到云端`);
    } catch (error) {
      console.error('❌ 同步设置失败:', error);
    }
  }

  /**
   * 手动触发完整同步（强制从云端拉取）
   */
  async manualSync() {
    if (!this.enabled) {
      console.log('❌ 云同步未启用');
      return false;
    }

    try {
      this.hasInitialized = false;
      sessionStorage.removeItem('supabase_initialized');

      await this.syncFromCloud();
      console.log('✅ 手动同步完成');

      this.hasInitialized = true;
      sessionStorage.setItem('supabase_initialized', 'true');

      return true;
    } catch (error) {
      console.error('❌ 手动同步失败:', error);
      return false;
    }
  }

  /**
   * 启用实时监听
   */
  enableRealtime(onDataChange) {
    if (!this.enabled) return;

    const userConfig = getCurrentUserConfig();
    console.log(`🔔 启用 ${userConfig.name} 的实时同步监听...`);

    let syncTimeout = null;
    const debouncedSync = async (tableName) => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        if (this.isLocalOperation) {
          console.log('⏸️ 检测到本地操作，跳过实时同步');
          return;
        }
        console.log('📥 开始同步数据...');
        await this.syncFromCloud();
        if (onDataChange) onDataChange(tableName);
      }, 500);
    };

    // 监听当前用户的所有表
    const tables = ['records', 'tasks', 'gifts', 'requests'];
    tables.forEach(table => {
      const fullTableName = getTableName(table);
      supabaseClient
        .channel(`${fullTableName}-changes`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: fullTableName },
            async (payload) => {
              console.log(`📥 检测到 ${fullTableName} 变化:`, payload.eventType);
              await debouncedSync(table);
            })
        .subscribe();
    });

    console.log(`✅ ${userConfig.name} 的实时监听已启用`);
  }
}

// 创建全局实例
window.supabaseSyncMultiUser = new SupabaseSyncMultiUser();

// 为了向后兼容，也创建 supabaseSync 别名
window.supabaseSync = window.supabaseSyncMultiUser;

// 导出用户管理函数
window.userManager = {
  getCurrentUser,
  setCurrentUser,
  getCurrentUserConfig,
  getUsers: () => USERS,
  switchUser: (userId) => {
    if (setCurrentUser(userId)) {
      // 清除session标记，下次访问时会重新同步新用户的数据
      sessionStorage.removeItem('supabase_initialized');
      location.reload();
    }
  }
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    supabaseSyncMultiUser: window.supabaseSyncMultiUser,
    userManager: window.userManager,
    getTableName,
    getLocalStorageKey
  };
}

console.log('✅ 多用户配置已加载');
