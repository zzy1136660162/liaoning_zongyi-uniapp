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
    <view class="list-container">
      <view v-if="filteredList.length === 0" class="empty-state">
        <uni-icons type="list" size="80" color="#ddd"></uni-icons>
        <text class="empty-text">暂无退货申请</text>
      </view>

      <view v-else class="refund-list">
        <view
          class="refund-item"
          v-for="item in filteredList"
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
            <button class="action-btn cancel-btn" @tap.stop="cancelRefund(item.id)">
              取消申请
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getRefundList, cancelRefund } from '@/api/refund.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

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
      refundList: []
    }
  },

  computed: {
    filteredList() {
      if (this.activeTab === 'all') {
        return this.refundList
      }

      const statusMap = {
        pending: [0, 1],      // 待审核、审核通过
        processing: [3],      // 退货中
        completed: [4, 5]     // 已退货、退货失败
      }

      return this.refundList.filter(item =>
        statusMap[this.activeTab]?.includes(item.status)
      )
    }
  },

  onLoad() {
    this.loadRefundList()
    logPageView('退货申请列表', 'REFUND_LIST')
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadRefundList()
  },

  methods: {
    async loadRefundList() {
      try {
        const result = await getRefundList()
        this.refundList = result || []

        // 更新标签数量
        this.updateTabCounts()

      } catch (error) {
        console.error('加载退货申请列表失败:', error)
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      }
    },

    updateTabCounts() {
      // 重置计数
      this.tabs.forEach(tab => tab.count = 0)

      // 统计各状态数量
      this.refundList.forEach(item => {
        this.tabs[0].count++ // 全部

        if ([0, 1].includes(item.status)) {
          this.tabs[1].count++ // 待审核
        } else if (item.status === 3) {
          this.tabs[2].count++ // 处理中
        } else if ([4, 5].includes(item.status)) {
          this.tabs[3].count++ // 已完成
        }
      })
    },

    switchTab(tabKey) {
      this.activeTab = tabKey
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
      try {
        logButtonClick('取消退货申请', 'REFUND_LIST', refundApplicationId.toString())

        const confirm = await this.showConfirm('确定要取消此退货申请吗？')
        if (!confirm) return

        uni.showLoading({ title: '取消中...' })

        await cancelRefund(refundApplicationId)

        uni.hideLoading()
        uni.showToast({
          title: '取消成功',
          icon: 'success'
        })

        // 重新加载列表
        this.loadRefundList()

      } catch (error) {
        console.error('取消退货申请失败:', error)
        uni.hideLoading()
        uni.showToast({
          title: error.message || '取消失败',
          icon: 'none'
        })
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
  min-height: 100vh;
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
</style>
