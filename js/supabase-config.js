/**
 * Supabase 云数据库配置文件
 * 用于管理数据在云端和本地之间的同步
 */

// ⚠️ 重要：请替换为你自己的 Supabase 项目信息
// 获取方式：Supabase 项目 → Settings → API
const SUPABASE_URL = 'https://jrczjbabkmgiozgdyahc.supabase.co'  // 例如: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyY3pqYmFia21naW96Z2R5YWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzg0MjMsImV4cCI6MjA3Nzg1NDQyM30.OUe0_8Y0fi6GH_ILvg9uddjcGd-RTTXNUXx_lIbYVlU'  // 以 eyJhbGci 开头的长字符串

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
 * Supabase 数据同步管理器
 * 负责本地 LocalStorage 和云端数据库之间的双向同步
 */
class SupabaseSync {
  constructor() {
    this.enabled = isSupabaseConfigured && supabaseClient !== null;
    this.syncPromise = null; // 用于跟踪同步状态
    this.isLocalOperation = false; // 标记是否正在进行本地操作
    this.hasInitialized = sessionStorage.getItem('supabase_initialized') === 'true'; // 标记本次会话是否已初始化
    if (this.enabled) {
      console.log('🌐 云同步已启用');
      // 不在构造函数中自动初始化，让页面控制何时同步
    } else {
      console.log('📱 仅使用本地存储模式');
    }
  }

  /**
   * 初始化：从云端同步数据到本地
   * @returns {Promise} 同步完成的 Promise
   */
  async init() {
    if (!this.enabled) return Promise.resolve();

    // 如果本次会话已经初始化过，直接使用本地数据
    if (this.hasInitialized) {
      console.log('📱 使用本地数据（本次会话已同步）');
      return Promise.resolve();
    }

    // 如果已经在同步中，返回同一个 Promise
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        await this.syncFromCloud();
        console.log('✅ 数据已从云端同步到本地');
        // 标记本次会话已初始化
        this.hasInitialized = true;
        sessionStorage.setItem('supabase_initialized', 'true');
      } catch (error) {
        console.error('❌ 云端同步失败，将使用本地数据:', error);
        throw error;
      } finally {
        this.syncPromise = null; // 重置同步状态
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
      // 同步任务 (正向任务在前,负向任务在后)
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('liguo_tasks')
        .select('*')
        .order('type', { ascending: false })  // positive 在前, negative 在后 (p > n)
        .order('score', { ascending: false }); // 同类型中,分数高的在前

      if (tasksError) throw tasksError;
      if (tasks && tasks.length > 0) {
        localStorage.setItem('liguo_tasks', JSON.stringify(tasks));
        console.log(`✅ 同步 ${tasks.length} 个任务`);
      }

      // 同步礼物
      const { data: gifts, error: giftsError } = await supabaseClient
        .from('liguo_gifts')
        .select('*')
        .order('id', { ascending: true });

      if (giftsError) throw giftsError;
      if (gifts) {
        localStorage.setItem('liguo_gifts', JSON.stringify(gifts));
        console.log(`✅ 同步 ${gifts.length} 个礼物`);
      }

      // 同步记录
      const { data: records, error: recordsError } = await supabaseClient
        .from('liguo_records')
        .select('*')
        .order('date', { ascending: false });

      if (recordsError) throw recordsError;
      if (records) {
        // 转换数据库字段名(下划线)为前端字段名(驼峰)
        const formattedRecords = records.map(record => ({
          id: record.id,
          taskId: record.task_id,
          taskName: record.task_name,
          score: record.score,
          note: record.note,
          date: record.date
        }));
        localStorage.setItem('liguo_records', JSON.stringify(formattedRecords));
        console.log(`✅ 同步 ${records.length} 条记录`);
      }

      // 同步兑换申请
      const { data: requests, error: requestsError } = await supabaseClient
        .from('liguo_requests')
        .select('*')
        .order('date', { ascending: false });

      if (requestsError) throw requestsError;
      if (requests) {
        // 转换数据库字段名(下划线)为前端字段名(驼峰)
        const formattedRequests = requests.map(request => ({
          id: request.id,
          giftId: request.gift_id,
          giftName: request.gift_name,
          score: request.score,
          status: request.status,
          date: request.date
        }));
        localStorage.setItem('liguo_requests', JSON.stringify(formattedRequests));
        console.log(`✅ 同步 ${requests.length} 个兑换申请`);
      }

      // 同步设置
      const { data: settings, error: settingsError } = await supabaseClient
        .from('liguo_settings')
        .select('*');

      if (settingsError) throw settingsError;
      if (settings) {
        const settingsObj = {};
        settings.forEach(item => {
          settingsObj[item.key] = item.value;
        });
        localStorage.setItem('liguo_settings', JSON.stringify(settingsObj));
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
        .from('liguo_tasks')
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
        .from('liguo_tasks')
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
        .from('liguo_tasks')
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
        .from('liguo_gifts')
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
        .from('liguo_gifts')
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
        .from('liguo_gifts')
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
        .from('liguo_records')
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
      // 标记正在进行本地操作，暂时忽略实时监听
      this.isLocalOperation = true;

      console.log(`🗑️ 正在删除云端记录 ID: ${id}`);

      const { data, error } = await supabaseClient
        .from('liguo_records')
        .delete()
        .eq('id', id)
        .select(); // 返回被删除的数据以确认操作成功

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
        console.warn('⚠️ 删除操作执行但未返回数据 - 可能记录不存在或权限不足');
      }

      // 延迟1秒后重置标记，避免实时监听触发同步
      setTimeout(() => {
        this.isLocalOperation = false;
      }, 1000);
    } catch (error) {
      console.error('❌ 同步记录删除失败:', error);
      this.isLocalOperation = false;
      throw error; // 重新抛出错误，让调用方知道失败了
    }
  }

  /**
   * 添加兑换申请到云端
   */
  async addRequest(request) {
    if (!this.enabled) return request;

    try {
      const { data, error } = await supabaseClient
        .from('liguo_requests')
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
        .from('liguo_requests')
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
        .from('liguo_settings')
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
      // 重置会话标记，强制同步
      this.hasInitialized = false;
      sessionStorage.removeItem('supabase_initialized');

      await this.syncFromCloud();
      console.log('✅ 手动同步完成');

      // 同步完成后重新标记
      this.hasInitialized = true;
      sessionStorage.setItem('supabase_initialized', 'true');

      return true;
    } catch (error) {
      console.error('❌ 手动同步失败:', error);
      return false;
    }
  }

  /**
   * 启用实时监听 - 当其他终端修改数据时自动同步
   * @param {Function} onDataChange - 数据变化时的回调函数
   */
  enableRealtime(onDataChange) {
    if (!this.enabled) return;

    console.log('🔔 启用实时同步监听...');

    // 添加防抖延迟，避免频繁同步
    let syncTimeout = null;
    const debouncedSync = async (tableName) => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        // 如果正在进行本地操作，跳过同步
        if (this.isLocalOperation) {
          console.log('⏸️ 检测到本地操作，跳过实时同步');
          return;
        }
        console.log('📥 开始同步数据...');
        await this.syncFromCloud();
        if (onDataChange) onDataChange(tableName);
      }, 500); // 延迟500ms，避免重复触发
    };

    // 监听 liguo_records 表的变化（只监听INSERT和UPDATE，忽略DELETE）
    const recordsChannel = supabaseClient
      .channel('liguo-records-changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'liguo_records' },
          async (payload) => {
            console.log('📥 检测到 liguo_records 新增:', payload.eventType);
            await debouncedSync('records');
          })
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'liguo_records' },
          async (payload) => {
            console.log('📥 检测到 liguo_records 更新:', payload.eventType);
            await debouncedSync('records');
          })
      .subscribe();

    // 监听 liguo_tasks 表的变化（只监听INSERT和UPDATE）
    const tasksChannel = supabaseClient
      .channel('liguo-tasks-changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'liguo_tasks' },
          async (payload) => {
            console.log('📥 检测到 liguo_tasks 新增:', payload.eventType);
            await debouncedSync('tasks');
          })
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'liguo_tasks' },
          async (payload) => {
            console.log('📥 检测到 liguo_tasks 更新:', payload.eventType);
            await debouncedSync('tasks');
          })
      .subscribe();

    // 监听 liguo_gifts 表的变化（只监听INSERT和UPDATE）
    const giftsChannel = supabaseClient
      .channel('liguo-gifts-changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'liguo_gifts' },
          async (payload) => {
            console.log('📥 检测到 liguo_gifts 新增:', payload.eventType);
            await debouncedSync('gifts');
          })
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'liguo_gifts' },
          async (payload) => {
            console.log('📥 检测到 liguo_gifts 更新:', payload.eventType);
            await debouncedSync('gifts');
          })
      .subscribe();

    // 监听 liguo_requests 表的变化（只监听INSERT和UPDATE）
    const requestsChannel = supabaseClient
      .channel('liguo-requests-changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'liguo_requests' },
          async (payload) => {
            console.log('📥 检测到 liguo_requests 新增:', payload.eventType);
            await debouncedSync('requests');
          })
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'liguo_requests' },
          async (payload) => {
            console.log('📥 检测到 liguo_requests 更新:', payload.eventType);
            await debouncedSync('requests');
          })
      .subscribe();

    console.log('✅ 实时监听已启用,多终端数据将自动同步');
  }

  /**
   * 数据迁移：将本地数据上传到云端
   */
  async migrateLocalToCloud() {
    if (!this.enabled) {
      console.log('❌ 云同步未启用，无法迁移');
      return { success: false, message: '云同步未启用' };
    }

    try {
      let uploadCount = 0;

      // 迁移任务
      const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      if (localTasks.length > 0) {
        for (const task of localTasks) {
          await this.addTask(task);
          uploadCount++;
        }
      }

      // 迁移礼物
      const localGifts = JSON.parse(localStorage.getItem('gifts') || '[]');
      if (localGifts.length > 0) {
        for (const gift of localGifts) {
          await this.addGift(gift);
          uploadCount++;
        }
      }

      // 迁移记录
      const localRecords = JSON.parse(localStorage.getItem('records') || '[]');
      if (localRecords.length > 0) {
        for (const record of localRecords) {
          await this.addRecord(record);
          uploadCount++;
        }
      }

      // 迁移兑换申请
      const localRequests = JSON.parse(localStorage.getItem('requests') || '[]');
      if (localRequests.length > 0) {
        for (const request of localRequests) {
          await this.addRequest(request);
          uploadCount++;
        }
      }

      console.log(`✅ 数据迁移完成，共上传 ${uploadCount} 条数据`);
      return { success: true, count: uploadCount };
    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
      return { success: false, message: error.message };
    }
  }
}

// 创建全局实例
window.supabaseSync = new SupabaseSync();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabaseSync, SupabaseSync };
}
