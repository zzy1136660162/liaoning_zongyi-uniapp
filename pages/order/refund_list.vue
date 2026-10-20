<template>
  <view class="page">
    <!-- 顶部导航 -->
    <!-- <view class="nav-bar">
      <view class="nav-left" @tap="goBack">
        <uni-icons type="back" size="20" color="#333"></uni-icons>
      </view>
      <view class="nav-title">退货申请</view>
      <view class="nav-right"></view>
    </view> -->

    <!-- 标签页 -->
    <view class="tab-bar">
      <view
        class="tab-item"
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: activeTab === tab.key }"
        @tap="switchTab(tab.key)"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <view class="tab-badge" v-if="tab.count > 0">{{ tab.count }}</view>
      </view>
    </view>

    <!-- 申请列表 -->
    <scroll-view
      :key="activeTab"
      class="list-container"
      scroll-y
      refresher-enabled
      :refresher-triggered="refreshing"
      :lower-threshold="120"
      @refresherrefresh="refreshRefunds"
      @scrolltolower="loadMoreRefunds"
    >
      <view
        v-if="statsError"
        class="list-status"
        @tap="loadRefundStats"
      >
        退款数量加载失败，点击重试
      </view>
      <view
        v-if="hasLoaded && !loading && !loadError && refundList.length === 0"
        class="empty-state"
      >
        <uni-icons type="list" size="80" color="#ddd"></uni-icons>
        <text class="empty-text">暂无退货申请</text>
      </view>

      <view class="refund-list">
        <view
          class="refund-item"
          v-for="item in refundList"
          :key="item.id"
          @tap="goToDetail(item.id)"
        >
          <view class="item-header">
            <view class="order-info">
              <text class="order-no">订单：{{ item.orderNo }}</text>
              <text class="apply-time">{{ formatDateTime(item.createdAt) }}</text>
            </view>
            <view class="status-tag" :class="'status-' + item.status">
              {{ getStatusText(item.status) }}
            </view>
          </view>

          <view class="item-content">
            <view class="refund-info">
              <text class="reason">原因：{{ item.refundReason }}</text>
              <text class="amount">退款：¥{{ item.refundAmount }}</text>
            </view>

            <view class="progress-info" v-if="item.status >= 3">
              <text class="progress-text">
                {{ getProgressText(item.status) }}
              </text>
            </view>
          </view>

          <view class="item-footer" v-if="item.status === 0">
            <button
              class="action-btn cancel-btn"
              :disabled="cancellingRefundId === item.id"
              @tap.stop="cancelRefund(item.id)"
            >
              取消申请
            </button>
          </view>
        </view>
      </view>
      <view class="list-status">
        <text v-if="loading">
          退款记录加载中...
        </text>
        <button
          v-else-if="loadError"
          class="list-retry"
          @tap="retryRefunds"
        >
          {{ loadError }}，点击重试
        </button>
        <button
          v-else-if="hasMore"
          class="list-retry"
          @tap="loadMoreRefunds"
        >
          加载更多
        </button>
        <text v-else-if="hasLoaded && refundList.length > 0">
          没有更多退款记录了
        </text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getRefundPage, getRefundStats, cancelRefund } from '@/api/refund.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { getSessionGeneration, isCurrentSession, onSessionChanged } from '@/utils/session.js'

const REFUND_PAGE_SIZE = 20

export default {
  name: 'RefundList',
  data() {
    return {
      activeTab: 'all',
      tabs: [
        { key: 'all', label: '全部', count: 0 },
        { key: 'pending', label: '待审核', count: 0 },
        { key: 'processing', label: '处理中', count: 0 },
        { key: 'completed', label: '已完成', count: 0 }
      ],
      refundList: [],
      pageNum: 0,
      total: 0,
      hasMore: false,
      hasLoaded: false,
      loading: false,
      refreshing: false,
      loadError: '',
      statsLoading: false,
      statsError: false,
      requestSequence: 0,
      statsRequestSequence: 0,
      cancellingRefundId: null,
      disposed: false,
      unsubscribeSessionChanged: null
    }
  },

  onLoad() {
    this.unsubscribeSessionChanged = onSessionChanged(() => {
      this.requestSequence += 1
      this.statsRequestSequence += 1
      this.resetRefundList()
      this.loading = false
      this.refreshing = false
      this.statsLoading = false
      this.statsError = false
      this.cancellingRefundId = null
      this.loadError = '登录状态已变更'
      this.tabs.forEach(tab => { tab.count = 0 })
    })
    logPageView('退货申请列表', 'REFUND_LIST')
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshRefunds()
  },

  onUnload() {
    this.disposed = true
    this.requestSequence += 1
    this.statsRequestSequence += 1
    this.unsubscribeSessionChanged?.()
    this.unsubscribeSessionChanged = null
  },

  methods: {
    resetRefundList() {
      this.refundList = []
      this.pageNum = 0
      this.total = 0
      this.hasMore = false
      this.hasLoaded = false
    },
    async fetchRefundPage(nextPage) {
      const sequence = ++this.requestSequence
      const session = getSessionGeneration()
      const tab = this.activeTab
      const isCurrentRequest = () => !this.disposed && sequence === this.requestSequence &&
        isCurrentSession(session) && tab === this.activeTab
      this.loading = true
      this.loadError = ''
      try {
        const page = await getRefundPage({ tab, pageNum: nextPage, pageSize: REFUND_PAGE_SIZE })
        if (!isCurrentRequest()) return
        const merged = new Map((nextPage === 1 ? [] : this.refundList).map(item => [String(item.id), item]))
        page.rows.forEach(item => merged.set(String(item.id), item))
        this.refundList = [...merged.values()]
        this.pageNum = page.pageNum
        this.total = page.total
        this.hasMore = page.hasMore
        this.hasLoaded = true
      } catch (error) {
        if (!isCurrentRequest()) return
        this.loadError = error.message || '退款记录加载失败'
      } finally {
        if (isCurrentRequest()) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    loadRefundList() {
      if (this.disposed) return
      this.resetRefundList()
      return this.fetchRefundPage(1)
    },
    loadMoreRefunds() {
      if (this.disposed || this.loading || this.loadError || !this.hasMore) return
      return this.fetchRefundPage(this.pageNum + 1)
    },
    retryRefunds() {
      if (this.disposed || this.loading) return
      return this.pageNum === 0 ? this.loadRefundList() : this.fetchRefundPage(this.pageNum + 1)
    },
    async loadRefundStats() {
      if (this.disposed) return
      const sequence = ++this.statsRequestSequence
      const session = getSessionGeneration()
      const isCurrentRequest = () => !this.disposed && sequence === this.statsRequestSequence && isCurrentSession(session)
      this.statsLoading = true
      this.statsError = false
      try {
        const stats = await getRefundStats() || {}
        if (!isCurrentRequest()) return
        this.tabs.forEach(tab => { tab.count = Number(stats[tab.key]) || 0 })
      } catch (_) {
        if (isCurrentRequest()) this.statsError = true
      } finally {
        if (isCurrentRequest()) this.statsLoading = false
      }
    },
    refreshRefunds() {
      if (this.disposed) return
      this.refreshing = true
      return Promise.all([this.loadRefundList(), this.loadRefundStats()])
    },
    switchTab(tabKey) {
      if (tabKey === this.activeTab || !this.tabs.some(tab => tab.key === tabKey)) return
      this.activeTab = tabKey
      return this.loadRefundList()
    },

    getStatusText(status) {
      const statusMap = {
        0: '待审核',
        1: '审核通过',
        2: '审核拒绝',
        3: '退货中',
        4: '已退货',
        5: '退货失败'
      }
      return statusMap[status] || '未知状态'
    },

    getProgressText(status) {
      const progressMap = {
        3: '请提交退货物流信息',
        4: '退货完成，款项已退回',
        5: '退货申请被拒绝'
      }
      return progressMap[status] || ''
    },

    goToDetail(refundApplicationId) {
      uni.navigateTo({
        url: `/pages/order/refund_detail?refundApplicationId=${refundApplicationId}`
      })
    },

    async cancelRefund(refundApplicationId) {
      if (this.disposed || this.cancellingRefundId !== null) return
      const session = getSessionGeneration()
      this.cancellingRefundId = refundApplicationId
      try {
        logButtonClick('取消退货申请', 'REFUND_LIST', refundApplicationId.toString())

        const confirm = await this.showConfirm('确定要取消此退货申请吗？')
        if (!confirm || this.disposed || !isCurrentSession(session)) return

        uni.showLoading({ title: '取消中...' })

        await cancelRefund(refundApplicationId)
        if (this.disposed || !isCurrentSession(session)) return

        uni.hideLoading()
        uni.showToast({
          title: '取消成功',
          icon: 'success'
        })

        // 重新加载列表
        await this.refreshRefunds()

      } catch (error) {
        if (this.disposed || !isCurrentSession(session)) return
        console.error('取消退货申请失败:', error)
        uni.hideLoading()
        uni.showToast({
          title: error.message || '取消失败',
          icon: 'none'
        })
      } finally {
        if (!this.disposed && isCurrentSession(session)) this.cancellingRefundId = null
      }
    },

    showConfirm(message) {
      return new Promise((resolve) => {
        uni.showModal({
          title: '提示',
          content: message,
          success: (res) => {
            resolve(res.confirm)
          }
        })
      })
    },

    goBack() {
      uni.navigateBack()
    },

    formatDateTime(dateTime) {
      if (!dateTime) return ''
      const date = new Date(dateTime)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

// 导航栏
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: #fff;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #e5e5e5;

  .nav-left {
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
  }

  .nav-right {
    width: 80rpx;
  }
}

// 标签页
.tab-bar {
  flex-shrink: 0;
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid #e5e5e5;

  .tab-item {
    flex: 1;
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    .tab-text {
      font-size: 28rpx;
      color: #666;
    }

    &.active .tab-text {
      color: #ff6b35;
      font-weight: 600;
    }

    .tab-badge {
      position: absolute;
      top: 12rpx;
      right: 20rpx;
      min-width: 32rpx;
      height: 32rpx;
      line-height: 32rpx;
      padding: 0 8rpx;
      background: #ff6b35;
      color: #fff;
      font-size: 20rpx;
      border-radius: 16rpx;
      text-align: center;
      box-shadow: 0 2rpx 8rpx rgba(255, 107, 53, 0.3);
    }
  }
}

// 列表容器
.list-container {
  flex: 1;
  height: 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 20rpx;

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120rpx 0;

    .empty-text {
      font-size: 28rpx;
      color: #999;
      margin-top: 24rpx;
    }
  }

  .refund-list {
    .refund-item {
      background: #fff;
      border-radius: 16rpx;
      margin-bottom: 16rpx;
      padding: 32rpx;
      box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);

      .item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24rpx;

        .order-info {
          flex: 1;

          .order-no {
            display: block;
            font-size: 28rpx;
            color: #333;
            margin-bottom: 8rpx;
          }

          .apply-time {
            display: block;
            font-size: 24rpx;
            color: #999;
          }
        }

        .status-tag {
          padding: 8rpx 16rpx;
          border-radius: 20rpx;
          font-size: 24rpx;
          font-weight: 500;

          &.status-0 { color: #ff6b35; background: rgba(255, 107, 53, 0.1); }
          &.status-1 { color: #007aff; background: rgba(0, 122, 255, 0.1); }
          &.status-2 { color: #ff3b30; background: rgba(255, 59, 48, 0.1); }
          &.status-3 { color: #ff9500; background: rgba(255, 149, 0, 0.1); }
          &.status-4 { color: #34c759; background: rgba(52, 199, 89, 0.1); }
          &.status-5 { color: #8e8e93; background: rgba(142, 142, 147, 0.1); }
        }
      }

      .item-content {
        .refund-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16rpx;

          .reason {
            font-size: 26rpx;
            color: #666;
            flex: 1;
          }

          .amount {
            font-size: 28rpx;
            color: #ff6b35;
            font-weight: 600;
          }
        }

        .progress-info {
          .progress-text {
            font-size: 24rpx;
            color: #007aff;
          }
        }
      }

      .item-footer {
        margin-top: 24rpx;
        padding-top: 24rpx;
        border-top: 1rpx solid #f0f0f0;

        .action-btn {
          width: 100%;
          height: 72rpx;
          border: none;
          border-radius: 36rpx;
          font-size: 28rpx;
          font-weight: 500;

          &.cancel-btn {
            background: #f5f5f5;
            color: #666;
          }
        }
      }
    }
  }
}

.list-status {
  padding: 24rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.list-retry {
  font-size: 26rpx;
  color: #007aff;
  background: transparent;
}

.list-retry::after {
  border: none;
}
</style>
