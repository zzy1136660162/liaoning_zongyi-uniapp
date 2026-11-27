<template>
  <view v-if="usage" class="his-therapy-usage">
    <text class="usage-title">医院核销次数</text>
    <text v-if="usage.status === 'STALE'" class="usage-note">上次同步 {{ syncedTime }}</text>
    <text v-if="!usage.groups || !usage.groups.length" class="usage-note">{{ statusText(usage.status) }}</text>
    <view v-for="group in usage.groups" :key="group.goodsCode" class="usage-group">
      <text class="usage-goods">{{ group.name }}</text>
      <text v-if="group.status !== 'READY'" class="usage-note">{{ group.status === 'REFUNDED' ? '该商品已退费' : statusText(group.status) }}</text>
      <view v-for="(project, index) in group.projects" :key="index" class="usage-project">
        <text>{{ project.name || project.code }}{{ project.spec ? ' · ' + project.spec : '' }}</text>
        <text class="usage-count">剩余 {{ project.remainingTimes }} 次</text>
      </view>
    </view>
  </view>
</template>

<script>
const usageStatuses = {
  PENDING: '待同步',
  UNKNOWN: '暂无医院次数',
  UNPAID: '医院未确认付款',
  REFUNDED: '医院订单已退费',
  CANCELED: '医院订单已作废',
  ORDER_UNPAID: '商城订单待付款',
  ORDER_REFUNDED: '商城订单已退款',
  ORDER_CANCELED: '商城订单已取消'
}

export default {
  props: {
    usage: { type: Object, default: null }
  },
  computed: {
    syncedTime() {
      return this.usage?.syncedAt ? String(this.usage.syncedAt).replace('T', ' ').slice(0, 19) : ''
    }
  },
  methods: {
    statusText(status) {
      return usageStatuses[status] || usageStatuses.UNKNOWN
    }
  }
}
</script>

<style scoped lang="scss">
.his-therapy-usage {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin: 12rpx 0;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: $mini-primary-soft;
  color: $mini-text;
  font-size: 24rpx;
}

.usage-title,
.usage-goods {
  font-weight: 600;
}

.usage-group {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.usage-project {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.usage-count {
  flex-shrink: 0;
  color: $mini-primary;
  font-weight: 600;
}

.usage-note {
  color: $mini-text-muted;
}
</style>
