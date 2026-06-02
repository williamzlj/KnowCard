import { db } from './database'

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function collectAllData() {
  const [projects, pages, cards, cardGroups, pageElements, settings, stylePresets, contentPresets, cardSizePresets] =
    await Promise.all([
      db.projects.toArray(),
      db.pages.toArray(),
      db.cards.toArray(),
      db.cardGroups.toArray(),
      db.pageElements.toArray(),
      db.settings.toArray(),
      db.stylePresets.toArray(),
      db.contentPresets.toArray(),
      db.cardSizePresets.toArray(),
    ])
  return { projects, pages, cards, cardGroups, pageElements, settings, stylePresets, contentPresets, cardSizePresets }
}

export async function exportDatabase() {
  const data = await collectAllData()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `KnowCard_完整数据库_${timestamp()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importDatabase(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    const required = ['projects', 'pages', 'cards', 'cardGroups', 'pageElements']
    for (const key of required) {
      if (!Array.isArray(data[key])) {
        return { success: false, error: `文件格式无效：缺少 "${key}" 数组` }
      }
    }

    await db.transaction('rw',
      [db.projects, db.pages, db.cards, db.cardGroups, db.pageElements, db.settings, db.stylePresets, db.contentPresets, db.cardSizePresets, db.imageLibrary, db.regexPresets],
      async () => {
        await Promise.all([
          db.projects.clear(),
          db.pages.clear(),
          db.cards.clear(),
          db.cardGroups.clear(),
          db.pageElements.clear(),
          db.settings.clear(),
          db.stylePresets.clear(),
          db.contentPresets.clear(),
          db.cardSizePresets.clear(),
          db.imageLibrary.clear(),
          db.regexPresets.clear(),
        ])

        await Promise.all([
          db.projects.bulkAdd(data.projects || []),
          db.pages.bulkAdd(data.pages || []),
          db.cards.bulkAdd(data.cards || []),
          db.cardGroups.bulkAdd(data.cardGroups || []),
          db.pageElements.bulkAdd(data.pageElements || []),
          db.settings.bulkAdd(data.settings || []),
          db.stylePresets.bulkAdd(data.stylePresets || []),
          db.contentPresets.bulkAdd(data.contentPresets || []),
          db.cardSizePresets.bulkAdd(data.cardSizePresets || []),
          db.imageLibrary.bulkAdd(data.imageLibrary || []),
          db.regexPresets.bulkAdd(data.regexPresets || []),
        ])
      })

    return { success: true }
  } catch (e) {
    return { success: false, error: `导入失败：${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function resetDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    await exportDatabase()
  } catch {
    return { success: false, error: '重置前自动备份失败，已取消重置' }
  }

  try {
    await db.transaction('rw',
      [db.projects, db.pages, db.cards, db.cardGroups, db.pageElements, db.settings, db.stylePresets, db.contentPresets, db.cardSizePresets],
      async () => {
        await Promise.all([
          db.projects.clear(),
          db.pages.clear(),
          db.cards.clear(),
          db.cardGroups.clear(),
          db.pageElements.clear(),
        ])
      })
    return { success: true }
  } catch (e) {
    return { success: false, error: `重置失败：${e instanceof Error ? e.message : String(e)}` }
  }
}
