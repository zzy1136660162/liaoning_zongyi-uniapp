/**
 * 公告模块API
 */

import { get } from '@/utils/request.js'
import { API_PATHS } from '@/utils/config.js'

/**
 * 获取公告列表
 */
export const getAnnouncementList = () => {
  return get(API_PATHS.ANNOUNCEMENT.LIST, {}, {
    needAuth: false,
    showLoading: true
  })
}

/**
 * 获取公告详情
 * @param {Number} id 公告ID
 */
export const getAnnouncementDetail = (id) => {
  return get(API_PATHS.ANNOUNCEMENT.DETAIL(id), {}, {
    needAuth: false,
    showLoading: true
  })
}
