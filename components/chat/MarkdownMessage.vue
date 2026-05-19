<template>
  <view class="markdown-message">
    <mp-html
      class="markdown-html"
      :content="renderedHtml"
      :copy-link="false"
      :preview-img="false"
      :show-img-menu="false"
      :scroll-table="true"
      container-style="white-space: normal; word-break: break-word; overflow: hidden;"
    />
  </view>
</template>

<script setup>
import { computed } from 'vue'
import mpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue'
import { renderMarkdown } from '@/utils/markdown.js'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const renderedHtml = computed(() => renderMarkdown(props.content))
</script>

<style scoped>
.markdown-message,
.markdown-html {
  width: 100%;
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.markdown-html :deep(p) {
  margin: 0 0 18rpx;
  line-height: 1.8;
  color: #24415f;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
}

.markdown-html :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-html :deep(h1),
.markdown-html :deep(h2),
.markdown-html :deep(h3),
.markdown-html :deep(h4) {
  margin: 0 0 18rpx;
  color: #15324d;
  line-height: 1.5;
  font-weight: 700;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
}

.markdown-html :deep(h1) {
  font-size: 36rpx;
}

.markdown-html :deep(h2) {
  font-size: 34rpx;
}

.markdown-html :deep(h3),
.markdown-html :deep(h4) {
  font-size: 32rpx;
}

.markdown-html :deep(ul),
.markdown-html :deep(ol) {
  margin: 0 0 18rpx;
  padding-left: 34rpx;
  max-width: 100%;
  box-sizing: border-box;
}

.markdown-html :deep(li) {
  margin-bottom: 10rpx;
  line-height: 1.8;
  color: #24415f;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
}

.markdown-html :deep(li:last-child) {
  margin-bottom: 0;
}

.markdown-html :deep(blockquote) {
  margin: 0 0 18rpx;
  padding: 16rpx 20rpx;
  border-left: 6rpx solid #4d8fd4;
  background: #f3f8fe;
  color: #45627e;
  border-radius: 0 16rpx 16rpx 0;
  max-width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
}

.markdown-html :deep(pre) {
  max-width: 100%;
  margin: 0 0 18rpx;
  padding: 18rpx 20rpx;
  background: #1d3043;
  color: #eff6ff;
  border-radius: 16rpx;
  overflow-x: auto;
  white-space: pre;
  line-height: 1.7;
}

.markdown-html :deep(pre code) {
  display: block;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  font-size: 24rpx;
  border-radius: 0;
}

.markdown-html :deep(code) {
  max-width: 100%;
  box-sizing: border-box;
  padding: 4rpx 10rpx;
  margin: 0 4rpx;
  background: rgba(77, 143, 212, 0.12);
  color: #245482;
  border-radius: 8rpx;
  font-size: 24rpx;
  word-break: break-all;
}

.markdown-html :deep(table) {
  width: 100%;
  max-width: 100%;
  margin: 0 0 18rpx;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 12rpx;
}

.markdown-html :deep(th),
.markdown-html :deep(td) {
  max-width: 100%;
  box-sizing: border-box;
  padding: 14rpx 16rpx;
  border: 1px solid #d7e4f0;
  text-align: left;
  vertical-align: top;
  color: #24415f;
  font-size: 26rpx;
  line-height: 1.7;
  word-break: break-word;
  white-space: normal;
}

.markdown-html :deep(th) {
  background: #f2f7fc;
  color: #163450;
  font-weight: 600;
}

.markdown-html :deep(a) {
  max-width: 100%;
  color: #2f6fb3;
  text-decoration: underline;
  word-break: break-all;
}

.markdown-html :deep(img) {
  max-width: 100%;
  box-sizing: border-box;
  border-radius: 12rpx;
}
</style>
