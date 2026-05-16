<template>
	<view class="cart-container">
		<!-- 购物车标题栏 -->
		<view class="cart-header">
			<view class="header-left">
				<text class="header-title">🛒 我的购物车</text>
			</view>
		</view>
		<view class="header-decoration">
			<view class="deco-dot dot1"></view>
			<view class="deco-dot dot2"></view>
			<view class="deco-dot dot3"></view>
		</view>

		<!-- 购物车内容区域 -->
		<view class="cart-content">
			<!-- 空购物车状态 -->
			<view class="empty-cart" v-if="cartItems.length === 0">
				<image class="empty-icon" :src="getImageUrl('/profile/liaoning_zongyi/empty_cart.png')" mode="aspectFit"></image>
				<text class="empty-text">购物车还是空的</text>
				<button class="go-shopping-btn" @click="goShopping">去逛逛</button>
			</view>

			<!-- 购物车商品列表 -->
			<view class="cart-list" v-else>
				<view class="cart-item" v-for="(item, index) in cartItems" :key="item.id">
					<!-- 选择框 -->
					<view class="checkbox-wrapper" @click="toggleItemSelection(item.id)">
						<view class="checkbox" :class="{ checked: selectedItems.includes(item.id) }">
							<uni-icons type="checkmarkempty" size="16" color="#ffffff" v-if="selectedItems.includes(item.id)"></uni-icons>
						</view>
					</view>

					<!-- 商品信息 -->
					<view class="item-content">
						<image class="item-image" :src="getImageUrl(item.image)" mode="aspectFill" @click="goToProductDetail(item)"></image>
						<view class="item-info">
							<text class="item-name" @click="goToProductDetail(item)">{{ item.name }}</text>
							<text class="item-desc">规格：{{ item.specText }}</text>
							<view class="item-bottom">
								<text class="item-price">¥{{ item.price.toFixed(2) }}</text>
								<view class="quantity-controls">
									<button class="quantity-btn" @click="decreaseQuantity(item)">-</button>
									<text class="quantity-text">{{ item.quantity }}</text>
									<button class="quantity-btn" @click="increaseQuantity(item)">+</button>
								</view>
							</view>
						</view>
					</view>

					<!-- 删除按钮（编辑模式下显示） -->
					<view class="delete-btn" v-if="isEditMode" @click="removeItem(item.id)">
						<uni-icons type="trash" size="20" color="#ff6b6b"></uni-icons>
					</view>
				</view>
			</view>
		</view>

		<!-- 底部结算栏 -->
		<view class="checkout-bar" v-if="cartItems.length > 0">
			<view class="select-all-wrapper" @click="toggleSelectAll">
				<view class="checkbox" :class="{ checked: isAllSelected }">
					<uni-icons type="checkmarkempty" size="16" color="#ffffff" v-if="isAllSelected"></uni-icons>
				</view>
				<text class="select-all-text">全选</text>
			</view>

			<view class="checkout-info">
				<text class="total-text">合计：<text class="total-price">¥{{ selectedTotalPrice.toFixed(2) }}</text></text>
				<text class="total-count">已选{{ selectedItemCount }}件</text>
			</view>

			<button class="checkout-btn" :disabled="selectedItems.length === 0" @click="goToCheckout">
				{{ isEditMode ? '删除' : '结算' }}
			</button>
		</view>

		<!-- Tab Bar 导航栏 -->
		<TabBar :current="currentTab" :cartCount="cartCount" @change="handleTabChange" />
	</view>
</template>

<script>
import { 
	STORAGE_KEY_CURRENT_CONSULTATION_ID,
	STORAGE_KEY_CURRENT_ORDER,
	STORAGE_KEY_VERIFIED_PRODUCTS,
	STORAGE_KEY_PRODUCT_QUANTITIES,
	STORAGE_KEY_USER_REGISTER
} from '@/utils/storage.js'
import { getCategoryList, getCategoryProducts, getProductDetail } from '@/api/product.js'
import {
	buildOrderInfo,
	clearCheckoutProductIds,
	loadCartItems,
	calculateTotalPrice,
	calculateTotalQuantity,
	saveToCart,
	setCheckoutProductIds,
	removeFromCart
} from '@/utils/cart.js'
import { resolveProductFlow } from '@/utils/product-biz.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView } from '@/api/access-log.js'
import TabBar from '@/components/TabBar/TabBar.vue'

export default {
	components: {
		TabBar
	},
	data() {
		return {
			cartItems: [],
			categories: [],
			selectedItems: [], // 选中的商品ID列表
			isEditMode: false, // 是否处于编辑模式
			currentTab: 'cart' // 当前选中的 tab
		}
	},
	computed: {
		cartCount() {
			return calculateTotalQuantity(this.cartItems)
		},
		selectedItemCount() {
			return this.selectedItems.length
		},
		selectedTotalPrice() {
			const selectedCartItems = this.cartItems.filter(item => this.selectedItems.includes(item.id))
			return calculateTotalPrice(selectedCartItems)
		},
		isAllSelected() {
			return this.cartItems.length > 0 && this.selectedItems.length === this.cartItems.length
		}
	},
	onLoad() {
		this.currentTab = 'cart'
	},
	onShow() {
		// 每次显示购物车页面时重新加载最新数据
		this.loadCategories()

		// 记录页面访问日志
		logPageView('购物车', '用户进入购物车页面')
	},
	methods: {
		getImageUrl,
		async loadCategories() {
			try {
				// 先从购物车获取需要的产品ID
				const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
				const productIds = Object.keys(verifiedProducts).filter(id => verifiedProducts[id])
				
				if (productIds.length === 0) {
					// 如果购物车为空，直接加载购物车数据
					this.categories = []
					this.loadCartData()
					return
				}
				
				// 为购物车中的商品创建虚拟分类结构
				const cartCategory = {
					id: 'cart_items',
					name: '指定药品',
					products: []
				}
				
				// 逐个获取购物车商品的详细信息
				for (const productId of productIds) {
					try {
						const productDetail = await getProductDetail(productId)
						if (productDetail) {
							cartCategory.products.push({
								id: productDetail.id,
								name: productDetail.productName || productDetail.name,
								description: productDetail.subTitle || productDetail.description,
								image: productDetail.coverImage || productDetail.image,
								price: productDetail.price,
								bizType: productDetail.bizType,
								goodsMerchantType: productDetail.goodsMerchantType,
								unit: productDetail.unit || '份',
								notice: productDetail.usageDesc || productDetail.notice,
								specText: productDetail.specText || productDetail.specDesc
							})
						}
					} catch (err) {
						console.error(`获取商品${productId}详情失败:`, err)
					}
				}
				
				this.categories = [cartCategory]
			
			this.loadCartData()
			} catch (error) {
				console.error('加载商品失败:', error)
				this.categories = []
				this.loadCartData()
			} finally {
				uni.hideLoading()
			}
		},
		loadCartData() {
			// 保存当前的选中状态
			const previousSelectedItems = [...this.selectedItems]
			const previousCartItemIds = this.cartItems.map(item => item.id)
			
			// 加载新的购物车数据
			this.cartItems = loadCartItems(this.categories)
			const currentCartItemIds = this.cartItems.map(item => item.id)
			
			// 如果购物车为空，清空选中状态
			if (this.cartItems.length === 0) {
				this.selectedItems = []
				return
			}
			
			// 如果之前没有选中状态（首次加载），默认选中所有商品
			if (previousSelectedItems.length === 0 && previousCartItemIds.length === 0) {
				this.selectedItems = currentCartItemIds
				return
			}
			
			// 保留之前选中的商品（如果它们仍然在购物车中）
			// 同时添加新加入购物车的商品（默认选中）
			const newSelectedItems = []
			const newItemIds = currentCartItemIds.filter(id => !previousCartItemIds.includes(id))
			
			// 保留之前选中的商品
			previousSelectedItems.forEach(id => {
				if (currentCartItemIds.includes(id)) {
					newSelectedItems.push(id)
				}
			})
			
			// 新加入的商品默认选中
			newItemIds.forEach(id => {
				if (!newSelectedItems.includes(id)) {
					newSelectedItems.push(id)
				}
			})
			
			this.selectedItems = newSelectedItems
		},
		toggleEditMode() {
			this.isEditMode = !this.isEditMode
		},
		toggleItemSelection(itemId) {
			const index = this.selectedItems.indexOf(itemId)
			if (index > -1) {
				this.selectedItems.splice(index, 1)
			} else {
				this.selectedItems.push(itemId)
			}
		},
		toggleSelectAll() {
			if (this.isAllSelected) {
				this.selectedItems = []
			} else {
				this.selectedItems = this.cartItems.map(item => item.id)
			}
		},
		increaseQuantity(item) {
			const newQuantity = item.quantity + 1
			saveToCart(item.id, newQuantity)
			this.loadCartData()
		},
		decreaseQuantity(item) {
			if (item.quantity > 1) {
				const newQuantity = item.quantity - 1
				saveToCart(item.id, newQuantity)
				this.loadCartData()
			}
		},
		removeItem(itemId) {
			uni.showModal({
				title: '确认删除',
				content: '确定要删除这个商品吗？',
				success: (res) => {
					if (res.confirm) {
						// 使用新的API删除商品
						try {
							const success = removeFromCart(itemId)
							if (success) {
							// 重新加载购物车数据
							this.loadCartData()
							
							uni.showToast({
								title: '删除成功',
								icon: 'success'
							})
							} else {
								uni.showToast({
									title: '删除失败',
									icon: 'none'
								})
							}
						} catch (e) {
							console.error('删除商品失败:', e)
							uni.showToast({
								title: '删除失败',
								icon: 'none'
							})
						}
					}
				}
			})
		},
		goToProductDetail(item) {
			const productData = encodeURIComponent(JSON.stringify({
				id: item.id,
				name: item.name,
				price: item.price,
				image: item.image,
				description: item.description,
				unit: item.unit,
				specText: item.specText
			}))
			uni.navigateTo({
				url: `/pages/products/priducts_detail?product=${productData}`
			})
		},
		goShopping() {
			uni.navigateTo({
				url: '/pages/products/priducts_list'
			})
		},
		goToCheckout() {
			if (this.isEditMode) {
				// 编辑模式：删除选中的商品
				if (this.selectedItems.length === 0) {
					uni.showToast({
						title: '请选择要删除的商品',
						icon: 'none'
					})
					return
				}
				
				uni.showModal({
					title: '确认删除',
					content: `确定要删除选中的${this.selectedItems.length}个商品吗？`,
					success: (res) => {
						if (res.confirm) {
							try {
								// 使用新的API批量删除商品
								const success = removeFromCart(this.selectedItems)
								if (success) {
								// 重新加载购物车数据
								this.loadCartData()
								
								// 退出编辑模式
								this.isEditMode = false
								
								uni.showToast({
									title: '删除成功',
									icon: 'success'
								})
								} else {
									uni.showToast({
										title: '删除失败',
										icon: 'none'
									})
								}
							} catch (e) {
								console.error('批量删除失败:', e)
								uni.showToast({
									title: '删除失败',
									icon: 'none'
								})
							}
						}
					}
				})
			} else {
				// 正常模式：去结算
				if (this.selectedItems.length === 0) {
					uni.showToast({
						title: '请选择要结算的商品',
						icon: 'none'
					})
					return
				}
				
				// 检查是否已注册
				try {
					const userRegisterInfo = uni.getStorageSync(STORAGE_KEY_USER_REGISTER)
					if (!userRegisterInfo || !userRegisterInfo.realName) {
						// 未注册，跳转到注册页面
						uni.navigateTo({
							url: '/pages/register/register'
						})
						return
					}

					const selectedProducts = this.cartItems.filter(item => this.selectedItems.includes(item.id))
					const flow = resolveProductFlow(selectedProducts)
					if (!flow.valid) {
						uni.showToast({
							title: flow.message,
							icon: 'none'
						})
						return
					}

					const selectedItemIds = this.selectedItems.map(id => String(id))
					setCheckoutProductIds(selectedItemIds)
					uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
					uni.setStorageSync(
						STORAGE_KEY_CURRENT_ORDER,
						buildOrderInfo(this.cartItems, selectedItemIds)
					)

					if (flow.bizType === 2) {
						uni.navigateTo({
							url: `/pages/order/confirm?selectedItems=${selectedItemIds.join(',')}`
						})
						return
					}

					uni.navigateTo({
						url: `/pages/dispense/apply?selectedItems=${selectedItemIds.join(',')}`
					})
				} catch (e) {
					console.error('检查注册状态失败:', e)
					clearCheckoutProductIds()
					uni.navigateTo({
						url: '/pages/register/register'
					})
				}
			}
		},
		handleTabChange(tab) {
			this.currentTab = tab
		}
	}
}
</script>

<style scoped>
.cart-container {
  width: 100%;
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(  env(safe-area-inset-bottom));
}

/* Banner区域 */
.banner-section {
  width: 100%;
  margin-bottom: 20rpx;
  overflow: hidden;
  background: #ffffff;
}

.banner-image {
  width: 100%;
  height: 180rpx;
  display: block;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 30rpx 16rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #67B26F 100%);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.header-right {
  display: flex;
  align-items: center;
}

.edit-btn {
  font-size: 26rpx;
  color: #ffffff;
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 30rpx;
}

.header-decoration {
  display: flex;
  align-items: center;
  padding: 0 30rpx 20rpx;
  background: linear-gradient(135deg, #4A90E2 0%, #67B26F 100%);
}

.deco-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 16rpx;
}

.deco-dot.dot1 {
  background: rgba(255, 255, 255, 0.9);
}

.deco-dot.dot2 {
  background: rgba(255, 255, 255, 0.6);
  width: 8rpx;
  height: 8rpx;
}

.deco-dot.dot3 {
  background: rgba(255, 255, 255, 0.3);
  width: 6rpx;
  height: 6rpx;
}

.cart-content {
  flex: 1;
  padding: 0 20rpx calc(120rpx + 100rpx + env(safe-area-inset-bottom) + 20rpx) 20rpx; /* 底部内边距：结算栏高度(120rpx) + TabBar高度(100rpx + 安全区域) + 额外间距(40rpx) */
}

.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 240rpx 0;
  background: #ffffff;
  border-radius: 16rpx;
  margin: 20rpx 0;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.empty-icon {
  width: 220rpx;
  height: 220rpx;
  margin-bottom: 40rpx;
  opacity: 0.7;
  filter: drop-shadow(0 4rpx 12rpx rgba(74, 144, 226, 0.15));
}

.empty-text {
  font-size: 30rpx;
  color: #666666;
  margin-bottom: 60rpx;
  font-weight: 500;
  letter-spacing: 1rpx;
}

.go-shopping-btn {
  background: #4A90E2;
  color: #ffffff;
  font-size: 28rpx;
  padding: 16rpx 48rpx;
  border-radius: 999rpx;
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
  letter-spacing: 1rpx;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 0;
}

.cart-item {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 3rpx solid #e1e8ed;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  background: #ffffff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.checkbox.checked {
  background: #4A90E2;
  border-color: #4A90E2;
  box-shadow: 0 2rpx 8rpx rgba(74, 144, 226, 0.3);
}

.item-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.item-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background-color: #f5f5f5;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160rpx;
  padding: 4rpx 0;
}

.item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  letter-spacing: 0.5rpx;
}

.item-desc {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-bottom: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  font-weight: 400;
}

.item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.item-price {
  font-size: 34rpx;
  font-weight: bold;
  color: #e74c3c;
  text-shadow: 0 1rpx 2rpx rgba(231, 76, 60, 0.2);
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #f5f5f5;
  border-radius: 30rpx;
  padding: 6rpx 12rpx;
}

.quantity-btn {
  width: 44rpx;
  height: 44rpx;
  background: #4A90E2;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-weight: bold;
  padding: 0;
  flex-shrink: 0;
}

.quantity-text {
  font-size: 26rpx;
  color: #333333;
  min-width: 36rpx;
  text-align: center;
}

.delete-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #ff6b6b;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.checkout-bar {
  position: fixed;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  height: 120rpx;
  background: #ffffff;
  border-top: 1rpx solid #e5e5e5;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  z-index: 100;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.select-all-wrapper {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-right: 24rpx;
}

.select-all-text {
  font-size: 28rpx;
  color: #2c3e50;
  font-weight: 500;
}

.checkout-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.total-text {
  font-size: 24rpx;
  color: #7f8c8d;
  margin-bottom: 6rpx;
  font-weight: 400;
}

.total-price {
  font-size: 34rpx;
  font-weight: bold;
  color: #e74c3c;
  text-shadow: 0 1rpx 2rpx rgba(231, 76, 60, 0.2);
}

.total-count {
  font-size: 22rpx;
  color: #95a5a6;
  font-weight: 400;
}

.checkout-btn {
  background-color: #4A90E2;
  color: #ffffff;
  font-size: 32rpx;
  padding: 4rpx 60rpx;
  border-radius: 60rpx;
  border: none;
  font-weight: 500;
  min-width: auto;
}

.checkout-btn[disabled] {
  background-color: #cccccc;
  color: #999999;
}

/* Tab Bar 样式已移至组件中 */

/* 悬停效果 */
.cart-item:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.go-shopping-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 12rpx 32rpx rgba(74, 144, 226, 0.4);
}
</style>
