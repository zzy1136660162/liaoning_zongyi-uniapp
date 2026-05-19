<template>
  <view class="tab-bar">
    <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home')">
      <uni-icons type="home" :size="26" :color="currentTab === 'home' ? '#1890ff' : '#8c8c8c'"></uni-icons>
      <text class="tab-text">首页</text>
    </view>
    <view class="tab-item" :class="{ active: currentTab === 'cart' }" @click="switchTab('cart')">
      <view class="tab-icon-wrapper">
        <uni-icons type="cart" :size="26" :color="currentTab === 'cart' ? '#1890ff' : '#8c8c8c'"></uni-icons>
        <view class="tab-badge" v-if="cartCount > 0">{{ cartCount > 99 ? '99+' : cartCount }}</view>
      </view>
      <text class="tab-text">购物车</text>
    </view>
    <view class="tab-item" :class="{ active: currentTab === 'mine' }" @click="switchTab('mine')">
      <uni-icons type="person" :size="26" :color="currentTab === 'mine' ? '#1890ff' : '#8c8c8c'"></uni-icons>
      <text class="tab-text">我的</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'TabBar',
  props: {
    current: {
      type: String,
      default: 'home'
    },
    cartCount: {
      type: Number,
      default: 0
    }
  },
  computed: {
    currentTab() {
      return this.current
    }
  },
  methods: {
    switchTab(tab) {
      this.$emit('change', tab)

      if (tab === this.currentTab) {
        uni.pageScrollTo({
          scrollTop: 0,
          duration: 300
        })
        return
      }

      if (tab === 'home') {
        uni.redirectTo({
          url: '/pages/products/medicine_list'
        })
      } else if (tab === 'cart') {
        uni.redirectTo({
          url: '/pages/cart/cart'
        })
      } else if (tab === 'mine') {
        uni.redirectTo({
          url: '/pages/user/profile'
        })
      }
    }
  }
}
</script>

<style scoped lang="scss">
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #ffffff;
  border-top: 1rpx solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 101;
  backdrop-filter: blur(10rpx);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12rpx 0;
  position: relative;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item:active {
  opacity: 0.6;
  transform: scale(0.96);
}

.tab-item.active .tab-text {
  color: #1890ff;
  font-weight: 500;
}

.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8rpx;
  width: 52rpx;
  height: 52rpx;
}

.tab-badge {
  position: absolute;
  top: -6rpx;
  right: -10rpx;
  background: #ff4d4f;
  color: #ffffff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
  font-weight: 500;
  border: 2rpx solid #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(255, 77, 79, 0.25);
}

.tab-text {
  font-size: 22rpx;
  color: #8c8c8c;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.2;
  font-weight: 400;
}
</style>
