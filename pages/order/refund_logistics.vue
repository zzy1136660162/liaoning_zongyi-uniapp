<template>
  <view class="offline-refund-page">
    <view class="notice-title">请线下联系客服</view>
    <view class="notice-text">制剂、健康产品发货后不支持在线申请退款或填写退货物流，请线下联系客服，由后台处理退款。</view>
    <button class="detail-btn" @tap="viewRefundDetail">查看退款进度</button>
  </view>
</template>

<script>
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'REFUND', accessType: '退款售后', pageType: 'REFUND_LOGISTICS', requestUri: '/pages/order/refund_logistics' }

export default {
  name: 'RefundLogistics',
  data() {
    return { refundApplicationId: null, sessionGeneration: getSessionGeneration() }
  },
  onLoad(options) {
    this.refundApplicationId = options.refundApplicationId || null
  },
  onShow() {
    if (!isCurrentSession(this.sessionGeneration)) return
    logPageView({ ...PAGE_LOG, pageId: this.refundApplicationId || '', actionCode: 'REFUND_LOGISTICS_VIEW', accessTitle: '退款联系客服提示', accessDescription: '旧退货物流入口提示线下联系客服办理退款' })
  },
  methods: {
    viewRefundDetail() {
      if (!isCurrentSession(this.sessionGeneration)) return
      logButtonClick({ ...PAGE_LOG, pageId: this.refundApplicationId || '', actionCode: 'REFUND_DETAIL_OPEN', accessTitle: '查看退款进度', accessDescription: '从历史退货入口查看退款处理进度' })
      uni.redirectTo({
        url: this.refundApplicationId
          ? `/pages/order/refund_detail?refundApplicationId=${encodeURIComponent(this.refundApplicationId)}`
          : '/pages/order/refund_list'
      })
    }
  }
}
</script>

<style scoped>
.offline-refund-page {
  padding: 64rpx 40rpx;
}
.notice-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}
.notice-text {
  margin: 28rpx 0 48rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: #666;
}
.detail-btn {
  border-radius: 44rpx;
  font-size: 30rpx;
  background: #ff6b35;
  color: #fff;
}
</style>
