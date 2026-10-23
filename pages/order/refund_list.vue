<template>
  <view class="page">
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @tap="switchTab(tab.key)"
      >
        <view class="tab-label">
          <text class="tab-text">
            {{ tab.label }}
          </text>
          <text
            v-if="tab.count > 0"
            class="tab-badge"
          >
            {{ tab.count > 99 ? '99+' : tab.count }}
          </text>
        </view>
        <view class="tab-indicator" />
      </view>
    </view>

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
      <view class="list-content">
        <view
          v-if="statsError"
          class="stats-notice"
          @tap="loadRefundStats"
        >
          <uni-icons
            type="info"
            size="16"
            color="#ff6b35"
          />
          <text class="stats-notice-text">
            退款数量加载失败，点击重试
          </text>
          <uni-icons
            type="right"
            size="12"
            color="#ff6b35"
          />
        </view>

        <view
          v-if="hasLoaded && refundList.length > 0"
          class="list-heading"
        >
          <text class="list-title">
            退款申请
          </text>
          <text class="list-count">
            共 {{ total }} 笔
          </text>
        </view>

        <view
          v-if="loading && refundList.length === 0"
          class="state-card"
        >
          <view class="state-icon">
            <uni-icons
              type="refreshempty"
              size="26"
              color="#ff6b35"
            />
          </view>
          <text class="state-title">
            正在加载退款记录
          </text>
          <text class="state-description">
            请稍候，正在查询申请进度
          </text>
        </view>
        <view
          v-else-if="loadError && refundList.length === 0"
          class="state-card"
        >
          <view class="state-icon">
            <uni-icons
              type="info"
              size="26"
              color="#ff6b35"
            />
          </view>
          <text class="state-title">
            退款记录加载失败
          </text>
          <text class="state-description">
            {{ loadError }}
          </text>
          <button
            class="state-retry"
            @tap="retryRefunds"
          >
            重新加载
          </button>
        </view>
        <view
          v-else-if="hasLoaded && !loading && !loadError && refundList.length === 0"
          class="state-card"
        >
          <view class="state-icon">
            <uni-icons
              type="list"
              size="26"
              color="#ff6b35"
            />
          </view>
          <text class="state-title">
            暂无退款申请
          </text>
          <text class="state-description">
            {{ activeTab === 'all' ? '提交退款申请后，可在这里查看处理进度' : '当前分类下暂无记录，可切换其他分类查看' }}
          </text>
        </view>

        <view class="refund-list">
          <view
            v-for="item in refundList"
            :key="item.id"
            class="refund-item"
            hover-class="refund-item--hover"
            @tap="goToDetail(item.id)"
          >
            <view class="item-header">
              <view class="card-title">
                <uni-icons
                  type="loop"
                  size="17"
                  color="#ff6b35"
                />
                <text>退款申请</text>
              </view>
              <view
                class="status-tag"
                :class="'status-' + item.status"
              >
                {{ getRefundStageText(item) }}
              </view>
            </view>

            <view class="amount-section">
              <text class="amount-label">
                申请退款金额
              </text>
              <view class="amount-value">
                <text class="currency">
                  ¥
                </text>
                <text class="amount">
                  {{ item.refundAmount == null ? '—' : item.refundAmount }}
                </text>
              </view>
            </view>

            <view class="application-info">
              <view class="info-row">
                <text class="info-label">
                  退款原因
                </text>
                <text class="info-value reason">
                  {{ item.refundReason || '未填写' }}
                </text>
              </view>
              <view class="info-row">
                <text class="info-label">
                  订单编号
                </text>
                <text class="info-value order-no">
                  {{ item.orderNo || '—' }}
                </text>
              </view>
              <view class="info-row">
                <text class="info-label">
                  申请时间
                </text>
                <text class="info-value apply-time">
                  {{ formatDateTime(item.createdAt) || '—' }}
                </text>
              </view>
            </view>

            <view class="item-footer">
              <button
                v-if="item.status === 0"
                class="action-btn cancel-btn"
                :disabled="cancellingRefundId === item.id"
                @tap.stop="cancelRefund(item.id)"
              >
                {{ cancellingRefundId === item.id ? '处理中...' : '取消申请' }}
              </button>
              <button
                class="action-btn detail-btn"
                @tap.stop="goToDetail(item.id)"
              >
                查看详情
              </button>
            </view>
          </view>
        </view>

        <view
          v-if="refundList.length > 0"
          class="list-status"
        >
          <text v-if="loading">
            正在加载更多记录...
          </text>
          <view
            v-else-if="loadError"
            class="more-error"
          >
            <text class="more-error-text">
              {{ loadError }}
            </text>
            <button
              class="list-retry"
              @tap="retryRefunds"
            >
              点击重试
            </button>
          </view>
          <button
            v-else-if="hasMore"
            class="list-retry"
            @tap="loadMoreRefunds"
          >
            加载更多
          </button>
          <view
            v-else-if="hasLoaded"
            class="list-end"
          >
            <view class="end-line" />
            <text>没有更多退款记录了</text>
            <view class="end-line" />
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { getRefundPage, getRefundStats, cancelRefund } from '@/api/refund.js'
import { getRefundStageText } from '@/utils/refund.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'REFUND', accessType: '退款售后', pageType: 'REFUND_LIST', pageId: '', requestUri: '/pages/order/refund_list' }
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
  },

  onShow() {
    if (!this.disposed) logPageView({ ...PAGE_LOG, actionCode: 'REFUND_LIST_VIEW', accessTitle: '退款记录', accessDescription: '进入退款记录列表，查看当前筛选状态下的退款申请', extraData: { statusFilter: this.activeTab } })
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
    getRefundStageText,
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
      logButtonClick({ ...PAGE_LOG, actionCode: 'REFUND_FILTER', accessTitle: '筛选退款记录', accessDescription: '切换退款申请列表的状态筛选', extraData: { statusFilter: tabKey } })
      return this.loadRefundList()
    },

    goToDetail(refundApplicationId) {
      if (this.disposed) return
      logButtonClick({ ...PAGE_LOG, actionCode: 'REFUND_DETAIL_OPEN', accessTitle: '查看退款详情', accessDescription: '从退款记录列表打开指定退款申请', extraData: { refundApplicationId } })
      uni.navigateTo({
        url: `/pages/order/refund_detail?refundApplicationId=${refundApplicationId}`
      })
    },

    async cancelRefund(refundApplicationId) {
      if (this.disposed || this.cancellingRefundId !== null) return
      const session = getSessionGeneration()
      this.cancellingRefundId = refundApplicationId
      try {
        const confirm = await this.showConfirm('确定要取消此退货申请吗？')
        if (this.disposed || !isCurrentSession(session)) return
        if (!confirm) {
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'REFUND_CANCEL_RESULT', actionResult: 'CANCELLED', accessTitle: '取消退款申请', accessDescription: '用户关闭确认弹窗，保留原退款申请', extraData: { refundApplicationId } })
          return
        }
        logButtonClick({ ...PAGE_LOG, actionCode: 'REFUND_CANCEL', accessTitle: '取消退款申请', accessDescription: '用户确认取消尚可撤销的退款申请', extraData: { refundApplicationId } })

        uni.showLoading({ title: '取消中...' })

        await cancelRefund(refundApplicationId)
        if (this.disposed || !isCurrentSession(session)) return
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'REFUND_CANCEL_RESULT', actionResult: 'SUCCESS', accessTitle: '取消退款申请', accessDescription: '退款申请已取消', extraData: { refundApplicationId } })

        uni.hideLoading()
        uni.showToast({
          title: '取消成功',
          icon: 'success'
        })

        // 重新加载列表
        await this.refreshRefunds()

      } catch (error) {
        if (this.disposed || !isCurrentSession(session)) return
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'REFUND_CANCEL_RESULT', actionResult: getActionFailureResult(error), accessTitle: '取消退款申请', accessDescription: '取消退款申请未获得成功确认', extraData: { refundApplicationId, reason: 'CANCEL_NOT_CONFIRMED' } })
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
      if (Number.isNaN(date.getTime())) return ''
      const pad = value => String(value).padStart(2, '0')
      // 固定 24 小时制，避免不同设备的区域设置显示上午/下午。
      return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #f5f5f5;
}

.tab-bar {
  display: flex;
  flex-shrink: 0;
  padding: 0 16rpx;
  background: #fff;
  border-bottom: 1rpx solid #eeeeee;
}

.tab-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 100rpx;
  position: relative;
}

.tab-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  max-width: 100%;
}

.tab-text {
  color: #666;
  font-size: 28rpx;
  line-height: 40rpx;
  white-space: nowrap;
}

.tab-badge {
  flex-shrink: 0;
  box-sizing: border-box;
  min-width: 30rpx;
  padding: 0 7rpx;
  border-radius: 16rpx;
  color: #888;
  background: #f3f3f3;
  font-size: 19rpx;
  line-height: 30rpx;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 36rpx;
  height: 6rpx;
  border-radius: 6rpx;
  background: transparent;
}

.tab-item.active .tab-text {
  color: #ff6b35;
  font-weight: 600;
}

.tab-item.active .tab-badge {
  color: #ff6b35;
  background: #fff0e9;
}

.tab-item.active .tab-indicator {
  background: #ff6b35;
}

.list-container {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
}

.list-content {
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));
}

.stats-notice {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 22rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #fff0e9;
}

.stats-notice-text {
  flex: 1;
  min-width: 0;
  color: #c6653b;
  font-size: 24rpx;
  line-height: 1.6;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4rpx 20rpx;
}

.list-title {
  color: #333;
  font-size: 28rpx;
  font-weight: 600;
}

.list-count {
  color: #999;
  font-size: 24rpx;
}

.refund-item {
  overflow: hidden;
  margin-bottom: 24rpx;
  border: 1rpx solid #eeeeee;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.025);
}

.refund-item--hover {
  background: #fffdfb;
}

.item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 26rpx 28rpx;
  border-bottom: 1rpx solid #f2f2f2;
}

.card-title {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10rpx;
  color: #333;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 40rpx;
}

.status-tag {
  min-width: 0;
  padding: 4rpx 14rpx;
  border-radius: 10rpx;
  color: #8e8e93;
  background: rgba(142, 142, 147, 0.1);
  font-size: 24rpx;
  line-height: 32rpx;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.status-0 { color: #ff6b35; background: rgba(255, 107, 53, 0.1); }
.status-1 { color: #007aff; background: rgba(0, 122, 255, 0.1); }
.status-2 { color: #ff3b30; background: rgba(255, 59, 48, 0.1); }
.status-3 { color: #ff9500; background: rgba(255, 149, 0, 0.1); }
.status-4 { color: #34c759; background: rgba(52, 199, 89, 0.1); }
.status-5 { color: #8e8e93; background: rgba(142, 142, 147, 0.1); }

.amount-section {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24rpx;
  padding: 28rpx 28rpx 24rpx;
}

.amount-label {
  flex-shrink: 0;
  color: #777;
  font-size: 26rpx;
  line-height: 1.6;
}

.amount-value {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 5rpx;
  min-width: 0;
  color: #ff6b35;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.currency {
  flex-shrink: 0;
  font-size: 26rpx;
}

.amount {
  min-width: 0;
  font-size: 40rpx;
  line-height: 1.25;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.application-info {
  margin: 0 28rpx;
  padding: 22rpx 24rpx;
  border-radius: 14rpx;
  background: #fafafa;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.info-row:first-child {
  margin-top: 0;
}

.info-label {
  flex-shrink: 0;
  width: 104rpx;
  color: #999;
}

.info-value {
  flex: 1;
  min-width: 0;
  color: #555;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.reason {
  color: #444;
}

.order-no,
.apply-time {
  font-variant-numeric: tabular-nums;
}

.item-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
  padding: 24rpx 28rpx 28rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 164rpx;
  min-height: 72rpx;
  margin: 0;
  padding: 0 24rpx;
  border: 1rpx solid #e5e5e5;
  border-radius: 34rpx;
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.5;
}

.action-btn::after,
.state-retry::after,
.list-retry::after {
  border: none;
}

.cancel-btn {
  color: #666;
  background: #fff;
}

.cancel-btn[disabled] {
  color: #aaa;
  background: #f7f7f7;
  border-color: #eee;
}

.detail-btn {
  color: #ff6b35;
  border-color: #ffc5ad;
  background: #fff8f4;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 32rpx;
  padding: 64rpx 32rpx;
  background: transparent;
  text-align: center;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  margin-bottom: 20rpx;
  border-radius: 50%;
  background: #fff2eb;
}

.state-title {
  color: #444;
  font-size: 26rpx;
  font-weight: 400;
  line-height: 1.5;
}

.state-description {
  max-width: 100%;
  margin-top: 10rpx;
  color: #999;
  font-size: 22rpx;
  line-height: 1.7;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.state-retry {
  min-width: 200rpx;
  margin: 32rpx 0 0;
  padding: 18rpx 36rpx;
  border: 1rpx solid #ffc5ad;
  border-radius: 40rpx;
  color: #ff6b35;
  background: #fff8f4;
  font-size: 24rpx;
  line-height: 1.5;
}

.list-status {
  padding: 10rpx 0 16rpx;
  color: #999;
  font-size: 22rpx;
  line-height: 1.6;
  text-align: center;
}

.list-retry {
  display: inline-block;
  margin: 0;
  padding: 12rpx 28rpx;
  border: none;
  color: #ff6b35;
  background: transparent;
  font-size: 24rpx;
  line-height: 1.6;
}

.more-error {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.more-error-text {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.list-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
}

.end-line {
  width: 48rpx;
  height: 1rpx;
  background: #ddd;
}
</style>
