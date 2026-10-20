# TabBar 组件重构文档

## 概述

将页面中重复的底部导航栏（TabBar）代码抽取封装成公共组件，实现代码复用和统一管理。

## 完成的工作

### 1. 创建公共组件

**文件路径：** `components/TabBar/TabBar.vue`

**功能特性：**
- 包含4个导航项：首页、购物车、订单、我的
- 组件统一维护购物车数量角标，页面无需传入数量
- 支持当前选中状态高亮
- 响应式设计，适配不同屏幕
- 统一的样式和动画效果

**组件接口：**

```javascript
// Props
{
  current: String    // 当前激活的标签 ('home' | 'cart' | 'order' | 'mine')
}

// Events
{
  change: (tab) => {}  // 标签切换事件
}
```

### 2. 更新页面集成组件

已在以下7个页面中集成 TabBar 组件，统一使用组件内部的购物车角标：

- `pages/products/medicine_list.vue`
- `pages/products/medicine_index.vue`
- `pages/products/priducts_list.vue`
- `pages/products/priducts_list2.vue`
- `pages/cart/cart.vue`
- `pages/order/order_list.vue`
- `pages/user/profile.vue`

商品列表和购物车页面仍保留刷新商品列表、数量控件与结算栏的业务订阅；仅供 TabBar 使用的数量状态和重复订阅已从页面移除。

#### 2.1 购物车页面
**文件：** `pages/cart/cart.vue`

**修改内容：**
- 引入 TabBar 组件
- 替换原有的 tab-bar 模板代码
- 简化 `switchTab` 方法为 `handleTabChange`
- 移除重复的 TabBar 样式代码

#### 2.2 个人中心页面
**文件：** `pages/user/profile.vue`

**修改内容：**
- 引入 TabBar 组件
- 替换原有的 tab-bar 模板代码
- 简化 `switchTab` 方法为 `handleTabChange`
- 移除重复的 TabBar 样式代码

#### 2.3 商品列表页面
**文件：** `pages/products/priducts_list.vue`

**修改内容：**
- 引入 TabBar 组件
- 替换原有的 tab-bar 模板代码
- 简化 `switchTab` 方法为 `handleTabChange`
- 移除重复的 TabBar 样式代码

## 代码对比

### 重构前

每个页面都需要复制相同的代码：

```vue
<!-- 模板部分 -->
<view class="tab-bar">
  <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home')">
    <uni-icons type="home" :size="24" :color="currentTab === 'home' ? '#4A90E2' : '#999999'"></uni-icons>
    <text class="tab-text">首页</text>
  </view>
  <!-- ... 更多重复代码 ... -->
</view>

<!-- 脚本部分 -->
switchTab(tab) {
  this.currentTab = tab
  if (tab === 'home') {
    // 跳转逻辑...
  }
  // ... 更多重复代码 ...
}

<!-- 样式部分 -->
<style>
.tab-bar { /* ... 100+ 行重复样式 ... */ }
</style>
```

### 重构后

每个页面只需一行代码：

```vue
<!-- 模板部分 -->
<TabBar :current="currentTab" @change="handleTabChange" />

<!-- 脚本部分 -->
import TabBar from '@/components/TabBar/TabBar.vue'

export default {
  components: { TabBar },
  methods: {
    handleTabChange(tab) {
      this.currentTab = tab
    }
  }
}

<!-- 样式部分 - 无需重复定义 -->
```

## 优势

### 1. 代码复用
- **减少代码量：** 每个页面减少约 200 行重复代码
- **统一维护：** 修改一处即可更新所有页面
- **降低错误：** 避免复制粘贴导致的不一致

### 2. 易于维护
- **集中管理：** TabBar 逻辑和样式集中在一个文件
- **快速定位：** 问题排查更简单
- **版本控制：** Git diff 更清晰

### 3. 功能增强
- **统一体验：** 所有页面的导航行为一致
- **灵活扩展：** 新增功能只需修改组件
- **样式统一：** 自动应用相同的设计规范

## 使用方法

在需要使用 TabBar 的页面中：

```vue
<template>
  <view class="page">
    <!-- 页面内容 -->
    
    <!-- 引入 TabBar 组件 -->
    <TabBar 
      :current="currentTab" 
      @change="handleTabChange" 
    />
  </view>
</template>

<script>
import TabBar from '@/components/TabBar/TabBar.vue'

export default {
  components: {
    TabBar
  },
  data() {
    return {
      currentTab: 'home'  // 当前页面对应的 tab
    }
  },
  methods: {
    handleTabChange(tab) {
      // 可选：处理 tab 切换事件
      this.currentTab = tab
    }
  }
}
</script>
```

## 注意事项

1. **页面底部留白：** 确保页面容器有足够的 `padding-bottom`，避免内容被 TabBar 遮挡
   ```css
   .page-container {
     padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
   }
   ```

2. **购物车数量：** 公共组件通过 `getCartTotalQuantity()` 读取全部本地购物车商品的数量总和；不依赖当前分类、分页或勾选状态。加购、增减、删除、清空及服务端同步写入购物车后，统一通过 `cartUpdated` 事件刷新。数量为 0 时隐藏，超过 99 时显示 `99+`。页面不再传 `cartCount`，也不需要额外请求接口刷新角标。

   组件初始化和挂载时读取数量，通过 `onPageShow` 在返回页面时补充刷新，卸载时取消自己的事件订阅。商品资料更新时，只有库存修正导致数量实际变化才补发本地刷新事件，元数据更新仍保持静默。

3. **当前 Tab 标识：** 根据页面类型设置正确的 `currentTab` 值
   - 商品列表页：`'home'`
   - 购物车页：`'cart'`
   - 订单页：`'order'`
   - 个人中心页：`'mine'`

## 后续优化建议

1. **路由配置：** 可以考虑使用 uni-app 的 tabBar 配置替代自定义实现
2. **状态管理：** 将购物车数量等全局状态移至 Pinia store
3. **动画优化：** 添加页面切换过渡动画
4. **主题支持：** 支持自定义颜色主题

## 总结

通过组件化重构：
- ✅ 消除了代码重复
- ✅ 提高了可维护性
- ✅ 统一了用户体验
- ✅ 简化了页面代码

这是一次成功的代码重构实践，符合 DRY（Don't Repeat Yourself）原则。
