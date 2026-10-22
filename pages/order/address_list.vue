<template>
  <view class="page">
    <view style="padding: 20rpx;">
    <!-- 地址列表 -->
    <scroll-view class="address-list" scroll-y>
      <view 
        v-for="address in addresses" 
        :key="address.id"
        class="address-item"
        @click="selectAddress(address)"
      >
        <view class="address-content">
          <view class="address-header">
            <view v-if="address.isDefault" class="default-badge">默认</view>
            <text class="name">{{ address.receiverName }}</text>
            <text class="phone">{{ address.receiverPhone }}</text>
          </view>
          <view class="address-detail">
            {{ address.region || (address.province + address.city + address.district) }}{{ address.addressDetail || (address.street || '') + (address.detail || '') }}
          </view>
        </view>
        <view class="address-actions" @click.stop>
          <view class="action-btn" @click="editAddress(address)">编辑</view>
          <view class="action-btn delete" @click="deleteAddress(address.id)">删除</view>
        </view>
      </view>
      
      <view v-if="addresses.length === 0" class="empty-state">
        <text>暂无收货地址</text>
      </view>
    </scroll-view>
  </view>
    <!-- 底部添加按钮 -->
    <view class="footer">
      <button class="add-btn" @click="addAddress">+ 添加收货地址</button>
    </view>
  </view>
</template>

<script setup>
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'
const pageSession = getSessionGeneration()
import { ref, getCurrentInstance } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getAddressList, deleteAddress as delAddressApi, setDefaultAddress as setDefaultApi } from '@/api/address.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'ADDRESS', accessType: '收货地址', pageType: 'ADDRESS_LIST', pageId: '', requestUri: '/pages/order/address_list' }

const addresses = ref([])
const isSelectMode = ref(false)
const pageInstance = getCurrentInstance()

onLoad((options) => {
  // 检查是否是选择模式
  isSelectMode.value = options?.select === 'true'
  
})

onShow(() => {
  // 页面显示时重新加载地址列表（从编辑页面返回时）
  loadAddresses()

  // 记录页面访问日志
  if (isCurrentSession(pageSession)) logPageView({ ...PAGE_LOG, actionCode: 'ADDRESS_LIST_VIEW', accessTitle: '收货地址', accessDescription: isSelectMode.value ? '进入收货地址列表，为当前订单选择收货地址' : '进入收货地址列表，管理收货地址', extraData: { mode: isSelectMode.value ? 'SELECT' : 'MANAGE' } })
})

const loadAddresses = async () => {
  if (!isCurrentSession(pageSession)) return
  try {
    // ✅ 从后端API获取地址列表
    const list = await getAddressList()
    if (!isCurrentSession(pageSession)) return
    addresses.value = list
    
  } catch (e) {
    if (!isCurrentSession(pageSession)) return
    console.error('加载地址列表失败:', e)
    addresses.value = []
    uni.showToast({ title: '地址加载失败，请重试', icon: 'none' })
  }
}

const selectAddress = (address) => {
  if (!isCurrentSession(pageSession)) return
  if (isSelectMode.value) {
    const eventChannel = pageInstance?.proxy?.getOpenerEventChannel?.()
    if (!eventChannel?.emit) {
      uni.showToast({ title: '请从订单页重新选择地址', icon: 'none' })
      return
    }
    eventChannel.emit('addressSelected', address.id)
    logButtonClick({ ...PAGE_LOG, actionCode: 'ADDRESS_SELECT', accessTitle: '选择收货地址', accessDescription: '为当前订单选用收货地址', extraData: { addressId: address.id } })
    uni.navigateBack()
  } else {
    // 非选择模式：设置为默认地址
    setDefaultAddress(address.id)
  }
}

const setDefaultAddress = async (addressId) => {
  if (!isCurrentSession(pageSession)) return
  try {
    logButtonClick({ ...PAGE_LOG, actionCode: 'ADDRESS_DEFAULT', accessTitle: '设置默认地址', accessDescription: '将指定收货地址设为默认地址', extraData: { addressId } })
    // ✅ 调用后端API设置默认地址
    await setDefaultApi(addressId)
    if (!isCurrentSession(pageSession)) return
    logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ADDRESS_DEFAULT_RESULT', actionResult: 'SUCCESS', accessTitle: '设置默认地址', accessDescription: '默认收货地址已保存', extraData: { addressId } })
    
    // 更新本地数据
    addresses.value.forEach(addr => {
      addr.isDefault = addr.id === addressId
    })
    uni.showToast({ title: '已设为默认地址', icon: 'success' })
    
    // 重新加载列表
    await loadAddresses()
  } catch (e) {
    if (!isCurrentSession(pageSession)) return
    logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ADDRESS_DEFAULT_RESULT', actionResult: getActionFailureResult(e), accessTitle: '设置默认地址', accessDescription: '设置默认收货地址未获得成功确认', extraData: { addressId, reason: 'SAVE_NOT_CONFIRMED' } })
    console.error('设置默认地址失败:', e)
    uni.showToast({ title: '设置失败', icon: 'none' })
  }
}

const editAddress = (address) => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'ADDRESS_EDIT_OPEN', accessTitle: '编辑收货地址', accessDescription: '打开已有收货地址进行编辑', extraData: { addressId: address.id } })
  uni.navigateTo({
    url: `/pages/order/address_edit?id=${address.id}`
  })
}

const deleteAddress = (addressId) => {
  if (!isCurrentSession(pageSession)) return
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这个收货地址吗？',
    success: async (res) => {
      if (!isCurrentSession(pageSession)) return
      if (!res.confirm) {
        logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ADDRESS_DELETE_RESULT', actionResult: 'CANCELLED', accessTitle: '删除收货地址', accessDescription: '用户取消删除收货地址', extraData: { addressId } })
        return
      }
      if (res.confirm && isCurrentSession(pageSession)) {
        try {
          logButtonClick({ ...PAGE_LOG, actionCode: 'ADDRESS_DELETE', accessTitle: '删除收货地址', accessDescription: '用户确认删除收货地址', extraData: { addressId } })
          // ✅ 调用后端API删除地址
          await delAddressApi(addressId)
    if (!isCurrentSession(pageSession)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ADDRESS_DELETE_RESULT', actionResult: 'SUCCESS', accessTitle: '删除收货地址', accessDescription: '收货地址已删除', extraData: { addressId } })
          
          uni.showToast({ title: '删除成功', icon: 'success' })
          
          // 重新加载列表
          await loadAddresses()
        } catch (e) {
    if (!isCurrentSession(pageSession)) return
          logAccess({ ...PAGE_LOG, actionType: 'BEHAVIOR', actionCode: 'ADDRESS_DELETE_RESULT', actionResult: getActionFailureResult(e), accessTitle: '删除收货地址', accessDescription: '删除收货地址未获得成功确认', extraData: { addressId, reason: 'DELETE_NOT_CONFIRMED' } })
          console.error('删除地址失败:', e)
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const addAddress = () => {
  logButtonClick({ ...PAGE_LOG, actionCode: 'ADDRESS_CREATE_OPEN', accessTitle: '新增收货地址', accessDescription: '打开新增收货地址页面' })
  uni.navigateTo({
    url: '/pages/order/address_edit'
  })
}
</script>

<style scoped>
.page {
  background: #f6f7fb;
  min-height: 100vh;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.address-list {
  flex: 1;
}

.address-item {
  background: #fff;
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.address-content {
  min-width: 0;
  text-align: left;
}

.address-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx 20rpx;
  margin-bottom: 12rpx;
}

.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  max-width: 100%;
  word-break: break-all;
}

.phone {
  font-size: 28rpx;
  color: #666;
  white-space: nowrap;
}

.default-badge {
  flex-shrink: 0;
  background: #2a82e4;
  color: #fff;
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  white-space: nowrap;
}

.address-detail {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  word-break: break-all;
}

.address-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.action-btn {
  font-size: 26rpx;
  color: #2a82e4;
  padding: 8rpx 16rpx;
  border: 1rpx solid #2a82e4;
  border-radius: 4rpx;
}

.action-btn.delete {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.empty-state {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 12rpx rgba(0,0,0,0.1);
  z-index: 100;
}

.add-btn {
  width: 100%;
  background: #2a82e4;
  color: #fff;
  font-size: 30rpx;
  padding: 16rpx 0;
  border-radius: 8rpx;
  border: none;
}
</style>

