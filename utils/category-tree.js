const normalizeCategoryId = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  return String(value)
}

const normalizeParentId = (value) => {
  const normalized = normalizeCategoryId(value)
  return normalized || '0'
}

const buildCategoryTree = (categoryList = []) => {
  const source = Array.isArray(categoryList) ? categoryList : []
  const categoryMap = new Map()

  source.forEach((item) => {
    const id = normalizeCategoryId(item?.id)
    if (!id) {
      return
    }
    categoryMap.set(id, {
      ...item,
      id,
      parentId: normalizeParentId(item?.parentId),
      children: []
    })
  })

  const rootCategories = []

  categoryMap.forEach((category) => {
    if (category.parentId === '0' || !categoryMap.has(category.parentId)) {
      rootCategories.push(category)
      return
    }
    categoryMap.get(category.parentId).children.push(category)
  })

  return rootCategories
}

const findDefaultSubCategoryId = (category) => {
  const children = Array.isArray(category?.children) ? category.children : []
  return children.length > 0 ? normalizeCategoryId(children[0].id) : ''
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildCategoryTree,
    findDefaultSubCategoryId,
    normalizeCategoryId
  }
}

export {
  buildCategoryTree,
  findDefaultSubCategoryId,
  normalizeCategoryId
}
