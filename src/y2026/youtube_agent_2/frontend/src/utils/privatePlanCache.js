const DATABASE_NAME = 'youtube-learning-private-cache'
const STORE_NAME = 'users'
const DATABASE_VERSION = 1

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadPrivatePlanCache(userId) {
  const database = await openDatabase()
  if (!database) return { plans: [], pendingByPlan: {} }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(userId)
    request.onsuccess = () => resolve(request.result || { plans: [], pendingByPlan: {} })
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function savePrivatePlanCache(userId, plans, pendingByPlan) {
  const database = await openDatabase()
  if (!database) return
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({
      userId,
      plans,
      pendingByPlan,
      savedAt: new Date().toISOString(),
    })
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}
