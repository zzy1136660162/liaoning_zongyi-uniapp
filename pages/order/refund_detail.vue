<template>
  <view
    class="page"
  >
    <view class="status-card">
      <view class="status-section">
        <view
          class="status-icon"
          :class="'status-' + detail.status"
        >
          <uni-icons
            :type="getStatusIcon(detail.status)"
            size="30"
            :color="getStatusColor(detail.status)"
          />
        </view>
        <view class="status-info">
          <text class="status-label">
            售后进度
          </text>
          <text class="status-text">
            {{ getRefundStageText(detail) }}
          </text>
        </view>
      </view>
      <view
        v-if="statusNotice"
        class="status-notice"
      >
        <text>{{ statusNotice }}</text>
      </view>
      <view class="amount-section">
        <text class="amount-label">
          申请退款金额
        </text>
        <view class="amount-value">
          <text class="currency">
            ¥
          </text>
          <text>{{ formatAmount(detail.refundAmount) }}</text>
        </view>
      </view>
    </view>

    <view class="detail-card products-section">
      <view class="section-header">
        <text class="section-title">
          售后商品
        </text>
        <text
          v-if="detail.items && detail.items.length"
          class="section-caption"
        >
          {{ detail.items.length }} 项商品
        </text>
      </view>
      <view class="product-list">
        <view
          v-for="item in detail.items"
          :key="item.id"
          class="product-item"
        >
          <image
            class="product-image"
            :src="getProductImageUrl(item.productImage)"
            mode="aspectFill"
            @error="handleProductImageError(item.productImage)"
          />
          <view class="product-info">
            <text class="product-name">
              {{ item.productName }}
            </text>
            <view class="product-meta">
              <text class="price">
                单价 ¥{{ formatAmount(item.price) }}
              </text>
              <text class="quantity">
                ×{{ item.quantity }}
              </text>
            </view>
            <view class="product-subtotal">
              <text class="subtotal-label">
                申请小计
              </text>
              <text class="subtotal">
                ¥{{ formatAmount(item.subtotalAmount) }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-card">
      <view class="section-header">
        <text class="section-title">
          申请信息
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          申请单号
        </text>
        <text
          class="info-value number-value"
          selectable
        >
          {{ detail.refundNo || '—' }}
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          申请时间
        </text>
        <text class="info-value">
          {{ formatDateTime(detail.createdAt) || '—' }}
        </text>
      </view>
      <view
        v-if="detail.orderInfo"
        class="info-row"
      >
        <text class="info-label">
          订单编号
        </text>
        <text
          class="info-value number-value"
          selectable
        >
          {{ detail.orderInfo.orderNo || '—' }}
        </text>
      </view>
      <view
        v-if="detail.orderInfo && detail.orderInfo.completeTime"
        class="info-row"
      >
        <text class="info-label">
          订单完成时间
        </text>
        <text class="info-value">
          {{ formatDateTime(detail.orderInfo.completeTime) }}
        </text>
      </view>
      <view class="reason-block">
        <text class="reason-label">
          申请原因
        </text>
        <text class="reason-text">
          {{ detail.refundReason || '未填写' }}
        </text>
        <text
          v-if="detail.refundDescription"
          class="description"
        >
          {{ detail.refundDescription }}
        </text>
      </view>
    </view>

    <view
      v-if="detail.returnLogisticsCompany"
      class="detail-card"
    >
      <view class="section-header">
        <text class="section-title">
          退货物流
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          物流公司
        </text>
        <text class="info-value">
          {{ detail.returnLogisticsCompany }}
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          物流单号
        </text>
        <text
          class="info-value number-value"
          selectable
        >
          {{ detail.returnLogisticsNo || '—' }}
        </text>
      </view>
      <view
        v-if="detail.returnTime"
        class="info-row"
      >
        <text class="info-label">
          发货时间
        </text>
        <text class="info-value">
          {{ formatDateTime(detail.returnTime) }}
        </text>
      </view>
    </view>

    <view
      v-if="detail.status >= 1 && (detail.reviewTime || detail.reviewRemark)"
      class="detail-card"
    >
      <view class="section-header">
        <text class="section-title">
          审核信息
        </text>
      </view>
      <view
        v-if="detail.reviewTime"
        class="info-row"
      >
        <text class="info-label">
          审核时间
        </text>
        <text class="info-value">
          {{ formatDateTime(detail.reviewTime) }}
        </text>
      </view>
      <view
        v-if="detail.reviewRemark"
        class="remark-block"
      >
        <text class="reason-label">
          审核备注
        </text>
        <text class="remark-text">
          {{ detail.reviewRemark }}
        </text>
      </view>
    </view>

    <view
      v-if="detail.status === 4 && detail.refundTime"
      class="detail-card"
    >
      <view class="section-header">
        <text class="section-title">
          退款记录
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          退款时间
        </text>
        <text class="info-value">
          {{ formatDateTime(detail.refundTime) }}
        </text>
      </view>
      <view class="info-row">
        <text class="info-label">
          退款金额
        </text>
        <text class="info-value refund-amount">
          ¥{{ formatAmount(detail.refundAmount) }}
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { getRefundStageText } from '@/utils/refund.js'
import dayjs from 'dayjs'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { createPageReturn } from '@/utils/page-return.js'
import { getRefundDetail } from '@/api/refund.js'
import { useProductImages } from '@/utils/product-image.js'
import { logPageView } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'REFUND', accessType: '退款售后', pageType: 'REFUND_DETAIL', requestUri: '/pages/order/refund_detail' }

export default {
  name: 'RefundDetail',
  setup() {
    return useProductImages()
  },
  data() {
    const sessionGeneration = getSessionGeneration()
    return {
      refundApplicationId: null,
      detail: {},
      pageActive: true,
      detailRequestSequence: 0,
      detailLoading: false,
      sessionGeneration,
      pageReturn: createPageReturn(() => isCurrentSession(sessionGeneration))
    }
  },

  computed: {
    statusNotice() {
      const { status, paymentRefundStatus, refundLastError } = this.detail
      // 与阶段标题保持一致：渠道仍在处理或确认时，不能提前展示完成说明。
      if (['PROCESSING', 'UNKNOWN'].includes(paymentRefundStatus)) return refundLastError || ''
      // 成功结果优先于历史提示，兼容仅有数字状态的旧退款记录。
      if (paymentRefundStatus === 'SUCCESS' || status === 4) {
        return '退款已完成，请查看原支付账户的到账记录。'
      }
      return refundLastError || ''
    }
  },

  onLoad(options) {
    this.pageReturn.bind()
    this.refundApplicationId = options.refundApplicationId
    if (!this.refundApplicationId) {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      })
      this.pageReturn.schedule(() => this.safeNavigateBack(), 1500)
    }

  },

  onShow() {
    this.pageReturn.show()
    if (!this.pageActive || !isCurrentSession(this.sessionGeneration)) return
    logPageView({ ...PAGE_LOG, pageId: this.refundApplicationId || '', actionCode: 'REFUND_DETAIL_VIEW', accessTitle: '退款详情', accessDescription: '进入退款详情，查看审核、退货与资金退款进度' })
    if (this.refundApplicationId) this.loadDetail()
  },

  onHide() {
    this.pageReturn.hide()
  },

  onUnload() {
    this.pageReturn.dispose()
    if (this.detailLoading && isCurrentSession(this.sessionGeneration)) uni.hideLoading()
    this.detailLoading = false
    this.pageActive = false
    this.detailRequestSequence++
  },

  methods: {
    getRefundStageText,
    isDetailRequestCurrent(sequence) {
      return this.pageActive && sequence === this.detailRequestSequence && isCurrentSession(this.sessionGeneration)
    },
    async loadDetail() {
      if (!this.pageActive || !isCurrentSession(this.sessionGeneration)) return
      const sequence = ++this.detailRequestSequence
      this.detailLoading = true
      try {
        uni.showLoading({ title: '加载中...' })

        const detail = await getRefundDetail(this.refundApplicationId, { showLoading: false, silent: true })
        if (!this.isDetailRequestCurrent(sequence)) return
        this.detail = detail || {}
      } catch (error) {
        if (!this.isDetailRequestCurrent(sequence) || error.code === 'SESSION_CHANGED') return
        console.error('event=ui_order_refund_detail stage=load_detail result=failed reason=operation_incomplete')
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      } finally {
        if (this.isDetailRequestCurrent(sequence)) {
          this.detailLoading = false
          uni.hideLoading()
        }
      }
    },

    getStatusIcon(status) {
      if (['PROCESSING', 'UNKNOWN'].includes(this.detail.paymentRefundStatus)) return 'spinner-cycle'
      if (this.detail.paymentRefundStatus === 'SUCCESS') return 'checkbox-filled'
      const iconMap = {
        0: 'spinner-cycle', // 待审核
        1: 'checkmarkempty', // 审核通过
        2: 'close',      // 审核拒绝
        3: 'paperplane', // 退货中
        4: 'checkbox-filled', // 已退货
        5: 'close'       // 退货失败
      }
      return iconMap[status] || 'help'
    },

    getStatusColor(status) {
      const colorMap = {
        0: '#ff6b35', // 待审核 - 橙色
        1: '#007aff', // 审核通过 - 蓝色
        2: '#ff3b30', // 审核拒绝 - 红色
        3: '#ff9500', // 退货中 - 橙色
        4: '#34c759', // 已退货 - 绿色
        5: '#8e8e93'  // 退货失败 - 灰色
      }
      return colorMap[status] || '#666'
    },

    // 安全返回上一页，如果是首页则跳转到订单列表
    safeNavigateBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        // 如果是首页，跳转到订单列表
        uni.redirectTo({
          url: '/pages/order/order_list'
        })
      }
    },

    goBack() {
      this.safeNavigateBack()
    },

    formatAmount(value) {
      if (value === null || value === undefined || String(value).trim() === '') return '—'
      const amount = Number(value)
      return Number.isFinite(amount) ? amount.toFixed(2) : '—'
    },

    formatDateTime(dateTime) {
      if (!dateTime) return ''
      const date = dayjs(dateTime)
      return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : dateTime
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));
  background: #f5f6f8;
  color: #252a34;

}

.status-card,
.detail-card {
  padding: 32rpx;
  border: 1rpx solid #edf0f3;
  border-radius: 24rpx;
  background: #fff;
}

.status-card {
  margin-bottom: 24rpx;
  background: linear-gradient(145deg, #fff8f2 0%, #fff 75%);
  border-color: #fae9dc;
}

.detail-card {
  margin-bottom: 20rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.status-section {
  display: flex;
  align-items: center;
}

.status-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin-right: 24rpx;
  border-radius: 28rpx;
  background: #eef1f5;

  &.status-0 { background: #fff0e6; }
  &.status-1 { background: #eaf3ff; }
  &.status-2 { background: #fff0ee; }
  &.status-3 { background: #fff4e5; }
  &.status-4 { background: #e8f7ee; }
}

.status-info {
  flex: 1;
  min-width: 0;
}

.status-label,
.status-text {
  display: block;
}

.status-label {
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #858b96;
}

.status-text {
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.45;
  word-break: break-all;
}

.status-notice {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: #fff3e8;
  font-size: 24rpx;
  line-height: 1.7;
  color: #a9612b;
  word-break: break-all;
}

.amount-section {
  margin-top: 28rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid #f1e9e2;
}

.amount-label {
  font-size: 26rpx;
  color: #747b87;
}

.amount-value {
  display: flex;
  align-items: baseline;
  margin-top: 10rpx;
  font-size: 60rpx;
  font-weight: 600;
  line-height: 1.2;
  color: #e76b2d;
  word-break: break-all;

  .currency {
    margin-right: 6rpx;
    font-size: 32rpx;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.5;
}

.section-caption {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  color: #939aa5;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
  line-height: 1.65;
}

.info-label {
  flex-shrink: 0;
  width: 184rpx;
  padding-right: 16rpx;
  color: #858b96;
}

.info-value {
  flex: 1;
  min-width: 0;
  text-align: right;
  word-break: break-all;
}

.number-value {
  font-variant-numeric: tabular-nums;
}

.product-item {
  display: flex;
  align-items: flex-start;
  padding: 24rpx 0;
  border-top: 1rpx solid #f0f2f5;

  &:first-child {
    padding-top: 0;
    border-top: none;
  }

  &:last-child {
    padding-bottom: 0;
  }
}

.product-image {
  flex-shrink: 0;
  width: 128rpx;
  height: 128rpx;
  margin-right: 24rpx;
  border-radius: 16rpx;
  background: #f5f6f8;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.5;
  word-break: break-all;
}

.product-meta,
.product-subtotal {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #858b96;
}

.quantity {
  margin-left: 16rpx;
}

.subtotal {
  margin-left: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #3d4654;
}

.reason-block {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #f0f2f5;
}

.reason-label,
.reason-text,
.description,
.remark-text {
  display: block;
  font-size: 26rpx;
  line-height: 1.7;
  word-break: break-all;
}

.reason-label {
  margin-bottom: 12rpx;
  color: #858b96;
}

.description {
  margin-top: 12rpx;
  color: #737c8a;
}

.remark-block {
  margin-top: 16rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #f7f8fa;
}

.refund-amount {
  font-size: 30rpx;
  font-weight: 600;
  color: #e76b2d;
}

</style>
