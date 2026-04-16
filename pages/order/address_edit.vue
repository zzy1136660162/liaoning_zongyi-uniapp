<template>
  <view class="page">
    <view style="padding: 20rpx;">

    
    <!-- 表单内容 -->
    <scroll-view class="form-content" scroll-y>
      <view class="form-section">
        <view class="form-item">
          <text class="label"><text class="required">*</text> 收货人</text>
          <input 
            class="input" 
            v-model="formData.name" 
            placeholder="请输入收货人姓名"
            maxlength="20"
          />
        </view>
        
        <view class="form-item">
          <text class="label"><text class="required">*</text> 手机号</text>
          <input 
            class="input" 
            v-model="formData.phone" 
            placeholder="请输入手机号"
            type="number"
            maxlength="11"
          />
        </view>
        
        <view class="form-item picker-item">
          <text class="label"><text class="required">*</text> 区域</text>
          <picker
            mode="multiSelector"
            :range="multiRange"
            :value="multiValue"
            @columnchange="onMultiColumnChange"
            @change="onMultiChange"
          >
            <view
              class="picker-value"
              :class="{ placeholder: !formData.province }"
            >
              <template v-if="formData.province || formData.city || formData.district || formData.street">
                {{ [formData.province, formData.city, formData.district, formData.street].filter(Boolean).join(' ') || '请选择省/市/区/街道' }}
              </template>
              <template v-else>
                请选择省/市/区/街道
              </template>
        </view>
          </picker>
          <text class="arrow">›</text>
        </view>
        
        <view class="form-item">
          <text class="label"><text class="required">*</text> 详细地址</text>
          <textarea 
            class="textarea" 
            v-model="formData.detail" 
            placeholder="请输入详细地址，如门牌号、楼层等"
            maxlength="100"
            :auto-height="true"
          />
        </view>
        
        <view class="form-item checkbox-item" @click="toggleDefault">
          <text class="label">设为默认地址</text>
          <view 
            class="checkbox" 
            :class="{ checked: formData.isDefault }"
          ></view>
        </view>
      </view>
    </scroll-view>
  </view>
    <!-- 底部保存按钮 -->
    <view class="footer">
      <button class="save-btn" @click="saveAddress">保存</button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { 
  STORAGE_KEY_SHIPPING_ADDRESSES,
  STORAGE_KEY_DEFAULT_ADDRESS_ID
} from '@/utils/storage.js'
import { getAddressDetail, addAddress, updateAddress } from '@/api/address.js'
import { logPageView } from '@/api/access-log.js'
import { getImageUrl } from '@/utils/config.js'

const isEdit = ref(false)
const addressId = ref(null)

const formData = reactive({
  name: '',
  phone: '',
  region: '',
  province: '',
  city: '',
  district: '',
  street: '',
  detail: '',
  isDefault: false
})

// 四级联动 picker 数据：省 / 市 / 区 / 街道
const multiRange = ref([[], [], [], []])
const multiValue = ref([0, 0, 0, 0])
const DEFAULT_STREETS = ['请选择街道']
const STREET_PLACEHOLDER = DEFAULT_STREETS[0]
const NATIONAL_REGION_DATA = ref([])
const REGION_DATA_URL = '/profile/liaoning_zongyi/data/pcas-code.json'

// 异步加载省市区街道数据（从远程 JSON，而不是打包进主包）
const initRegionData = () => {
  return new Promise((resolve) => {
    if (NATIONAL_REGION_DATA.value && NATIONAL_REGION_DATA.value.length > 0) {
      resolve()
      return
    }
    uni.request({
      url: getImageUrl(REGION_DATA_URL),
      method: 'GET',
      success: (res) => {
        if (Array.isArray(res.data)) {
          NATIONAL_REGION_DATA.value = res.data
        } else {
          NATIONAL_REGION_DATA.value = []
        }
        resolve()
      },
      fail: (err) => {
        console.error('加载区域数据失败:', err)
        NATIONAL_REGION_DATA.value = []
        resolve()
      }
    })
  })
}

const findStreetsByRegion = (provinceName, cityName, districtName) => {
  if (!provinceName || !cityName || !districtName) return []
  const provinceNode = NATIONAL_REGION_DATA.value.find(item => item.name === provinceName)
  if (!provinceNode || !provinceNode.children) return []
  const cityNode = provinceNode.children.find(item => item.name === cityName)
  if (!cityNode || !cityNode.children) return []
  const districtNode = cityNode.children.find(item => item.name === districtName)
  if (!districtNode || !districtNode.children) return []
  return districtNode.children.map(street => street.name)
}


// 根据当前 multiValue 计算四级联动各列选项
const buildMultiRange = () => {
  const provinces = NATIONAL_REGION_DATA.value.map(p => p.name)
  let pIndex = multiValue.value[0] || 0
  if (pIndex < 0 || pIndex >= provinces.length) pIndex = 0

  const province = NATIONAL_REGION_DATA.value[pIndex] || {}
  const cities = (province.children || []).map(c => c.name)
  let cIndex = multiValue.value[1] || 0
  if (cIndex < 0 || cIndex >= cities.length) cIndex = 0

  const city = (province.children || [])[cIndex] || {}
  const districts = (city.children || []).map(d => d.name)
  let dIndex = multiValue.value[2] || 0
  if (dIndex < 0 || dIndex >= districts.length) dIndex = 0

  const district = (city.children || [])[dIndex] || {}
  const streets = (district.children || []).map(s => s.name)
  const streetList = streets.length > 0 ? streets : DEFAULT_STREETS
  let sIndex = multiValue.value[3] || 0
  if (sIndex < 0 || sIndex >= streetList.length) sIndex = 0

  multiRange.value = [provinces, cities, districts, streetList]
  multiValue.value = [pIndex, cIndex, dIndex, sIndex]
}

const hasRealStreetOptions = () => {
  return (multiRange.value[3] || []).some(street => street !== STREET_PLACEHOLDER)
}

const restoreStreetAndDetail = (addressDetailText) => {
  const detailText = addressDetailText || ''
  const streets = findStreetsByRegion(formData.province, formData.city, formData.district)
  const matchedStreet = streets.find(street => detailText.startsWith(street))
  if (matchedStreet) {
    formData.street = matchedStreet
    formData.detail = detailText.slice(matchedStreet.length) || ''
  } else {
    formData.street = ''
    formData.detail = detailText
  }
}

// 根据已有的表单省市区街道，回填 multiSelector 的索引
const setMultiValueFromForm = () => {
  const provinces = NATIONAL_REGION_DATA.value
  const pIndex = provinces.findIndex(p => p.name === formData.province)
  let p = pIndex >= 0 ? pIndex : 0

  const province = provinces[p] || {}
  const cities = (province.children || [])
  const cIndex = cities.findIndex(c => c.name === formData.city)
  let c = cIndex >= 0 ? cIndex : 0

  const city = cities[c] || {}
  const districts = (city.children || [])
  const dIndex = districts.findIndex(d => d.name === formData.district)
  let d = dIndex >= 0 ? dIndex : 0

  const district = districts[d] || {}
  const streets = (district.children || []).map(s => s.name)
  const streetList = streets.length > 0 ? streets : DEFAULT_STREETS
  const sIndex = streetList.findIndex(s => s === formData.street)
  let s = sIndex >= 0 ? sIndex : 0

  multiValue.value = [p, c, d, s]
  buildMultiRange()
}

onMounted(async () => {
  // 初始化四级联动数据（先加载区域 JSON，再构建多列选择数据）
  await initRegionData()
  buildMultiRange()

  // 检查是否是编辑模式
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage && currentPage.options && currentPage.options.id) {
    isEdit.value = true
    // 统一转换为字符串类型，避免类型不匹配
    addressId.value = String(currentPage.options.id)
    console.log('编辑地址 ID:', addressId.value)
    loadAddress()
    // 设置导航栏标题
    uni.setNavigationBarTitle({
      title: '编辑地址'
    })
  } else {
    // 新增地址模式：设置默认省市为辽宁省沈阳市
    formData.province = '辽宁省'
    formData.city = '沈阳市'
    formData.region = '辽宁省 沈阳市'
    
    // 更新 picker 的选中索引
    setMultiValueFromForm()
    
    // 设置导航栏标题
    uni.setNavigationBarTitle({
      title: '新增地址'
    })
  }

  // 记录页面访问日志
  const pageTitle = isEdit.value ? '编辑地址' : '新增地址'
  logPageView(pageTitle, `用户进入${pageTitle}页面`)
})

const loadAddress = async () => {
  try {
    uni.showLoading({ title: '加载中...' })
    
    // ✅ 直接调用地址详情接口
    console.log('加载地址详情，ID:', addressId.value)
    const address = await getAddressDetail(addressId.value)
    
    if (address) {
      console.log('获取到地址详情:', address)
      
      // 填充表单数据
      formData.name = address.name || address.receiverName || ''
      formData.phone = address.phone || address.receiverPhone || ''
      formData.province = address.province || ''
      formData.city = address.city || ''
      formData.district = address.district || ''
      restoreStreetAndDetail(address.addressDetail || address.detail || '')
      formData.isDefault = address.isDefault === 1 || address.isDefault === true
      
      // 构建完整的区域字符串
      formData.region = `${formData.province} ${formData.city} ${formData.district}`.trim()
      
      console.log('反显表单数据:', formData)
      
      // 更新多列选择器索引
      setMultiValueFromForm()
      
      uni.hideLoading()
    } else {
      uni.hideLoading()
      console.error('地址数据为空')
      uni.showToast({ title: '地址数据加载失败', icon: 'none' })
    }
  } catch (e) {
    console.error('加载地址详情失败:', e)
    uni.hideLoading()
    uni.showToast({ 
      title: e.message || '加载失败，请重试', 
      icon: 'none' 
    })
  }
}


const toggleDefault = () => {
  formData.isDefault = !formData.isDefault
}

const validateForm = () => {
  if (!formData.name || formData.name.trim() === '') {
    uni.showToast({ title: '请输入收货人姓名', icon: 'none' })
    return false
  }
  
  if (!formData.phone || formData.phone.trim() === '') {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return false
  }
  
  const phoneReg = /^1[3-9]\d{9}$/
  if (!phoneReg.test(formData.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return false
  }
  
  if (!formData.region || formData.region.trim() === '') {
    uni.showToast({ title: '请选择省市区', icon: 'none' })
    return false
  }
  
  if (hasRealStreetOptions() && (!formData.street || formData.street.trim() === '')) {
    uni.showToast({ title: '请选择街道', icon: 'none' })
    return false
  }
  
  if (!formData.detail || formData.detail.trim() === '') {
    uni.showToast({ title: '请输入详细地址', icon: 'none' })
    return false
  }
  
  return true
}

const saveAddress = async () => {
  if (!validateForm()) {
    return
  }
  
  try {
    uni.showLoading({ title: '保存中...' })
    
    // 准备提交数据
    const streetPart = formData.street && formData.street !== STREET_PLACEHOLDER ? formData.street : ''
    const addressDetail = `${streetPart}${formData.detail || ''}`
    const addressData = {
      receiverName: formData.name,
      receiverPhone: formData.phone,
      province: formData.province || '',
      city: formData.city || '',
      district: formData.district || '',
      addressDetail,
      isDefault: formData.isDefault ? 1 : 0
    }
    
    if (isEdit.value) {
      // ✅ 编辑模式：调用更新API
      await updateAddress(addressId.value, addressData)
    } else {
      // ✅ 新增模式：调用新增API
      await addAddress(addressData)
    }
    
    uni.hideLoading()
    uni.showToast({ 
      title: isEdit.value ? '保存成功' : '添加成功', 
      icon: 'success'
    })
    
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
    
  } catch (e) {
    console.error('保存地址失败:', e)
    uni.hideLoading()
    uni.showToast({ 
      title: e.message || '保存失败，请重试', 
      icon: 'none' 
    })
  }
}

// multiSelector 列变化：联动重置后续列，并重算可选项
const onMultiColumnChange = (event) => {
  const { column, value } = event.detail || {}
  const newValue = [...multiValue.value]
  newValue[column] = value
  if (column === 0) {
    newValue[1] = 0
    newValue[2] = 0
    newValue[3] = 0
  } else if (column === 1) {
    newValue[2] = 0
    newValue[3] = 0
  } else if (column === 2) {
    newValue[3] = 0
  }
  multiValue.value = newValue
  buildMultiRange()
}

// multiSelector 完成选择：写回表单里的省市区街道
const onMultiChange = (event) => {
  const value = event.detail?.value || [0, 0, 0, 0]
  multiValue.value = value
  const [pIndex, cIndex, dIndex, sIndex] = value
  const [provinces, cities, districts, streets] = multiRange.value

  formData.province = provinces[pIndex] || ''
  formData.city = cities[cIndex] || ''
  formData.district = districts[dIndex] || ''
  const selectedStreet = streets[sIndex] || ''
  formData.street = selectedStreet === STREET_PLACEHOLDER ? '' : selectedStreet

  formData.region = [formData.province, formData.city, formData.district]
    .filter(Boolean)
    .join(' ')

  console.log('区域选择变更:', formData.province, formData.city, formData.district, formData.street)
}

</script>

<style scoped>
.page {
  background: #f6f7fb;
  min-height: 100vh;
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.form-content {
  flex: 1;
}

.form-section {
  background: #fff;
  border-radius: 8rpx;
  padding: 20rpx;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.form-item:last-child {
  border-bottom: none;
}

.picker-item {
  position: relative;
}

.label {
  width: 200rpx;
  font-size: 28rpx;
  color: #333;
  flex-shrink: 0;
}

.required {
  color: #ff4d4f;
  margin-right: 4rpx;
}

.input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.textarea {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  min-height: 120rpx;
  line-height: 1.6;
}

.region-value {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.picker-value {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.placeholder {
  color: #999;
}

.arrow {
  color: #999;
  font-size: 28rpx;
  margin-left: 12rpx;
}

.checkbox-item {
  justify-content: space-between;
  cursor: pointer;
}

.checkbox-item:active {
  opacity: 0.7;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.checkbox.checked {
  background: #2a82e4;
  border-color: #2a82e4;
}

.checkbox.checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 24rpx;
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

.save-btn {
  width: 100%;
  background: #2a82e4;
  color: #fff;
  font-size: 30rpx;
  padding: 16rpx 0;
  border-radius: 8rpx;
  border: none;
}
</style>

