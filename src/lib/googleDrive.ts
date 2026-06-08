import { safeFileName } from './utils'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
let accessToken = ''
let tokenClient: any = null

function clientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

function rootFolderName() {
  return import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER || 'Garagem SaaS'
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()

    const found = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (found) {
      found.addEventListener('load', () => resolve())
      found.addEventListener('error', () => reject(new Error('Erro ao carregar Google Identity Services.')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Erro ao carregar Google Identity Services.'))
    document.head.appendChild(script)
  })
}

export function isGoogleDriveConfigured() {
  return !!clientId()
}

export async function connectGoogleDrive(): Promise<string> {
  if (!clientId()) throw new Error('Configure VITE_GOOGLE_CLIENT_ID no .env.')
  await loadGoogleScript()

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      prompt: 'consent',
      callback: (response: any) => {
        if (response?.error) return reject(new Error(response.error))
        accessToken = response.access_token
        resolve(accessToken)
      },
    })
    tokenClient.requestAccessToken()
  })
}

async function token() {
  if (accessToken) return accessToken
  return await connectGoogleDrive()
}

async function driveFetch(url: string, options: RequestInit = {}) {
  const t = await token()
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${t}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res
}

async function findFolder(name: string, parentId?: string) {
  const safe = name.replace(/'/g, "\\'")
  const parent = parentId ? ` and '${parentId}' in parents` : ''
  const q = `name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent}`
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`)
  const data = await res.json()
  return data.files?.[0]?.id || null
}

async function createFolder(name: string, parentId?: string) {
  const body: any = { name, mimeType: 'application/vnd.google-apps.folder' }
  if (parentId) body.parents = [parentId]
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return data.id
}

async function folder(name: string, parentId?: string) {
  return (await findFolder(name, parentId)) || (await createFolder(name, parentId))
}

async function makePublic(fileId: string) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
}

export async function uploadFileToGoogleDrive(file: File, opts?: { clientName?: string; osNumber?: string }) {
  await token()

  const root = await folder(rootFolderName())
  const client = await folder(opts?.clientName || 'Sem cliente', root)
  const os = await folder(opts?.osNumber || 'Sem OS', client)

  const metadata = { name: safeFileName(file.name), parents: [os] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    body: form,
  })

  const data = await res.json()
  await makePublic(data.id)

  return {
    id: data.id,
    name: data.name,
    viewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    downloadLink: data.webContentLink || `https://drive.google.com/uc?id=${data.id}&export=download`,
    folderId: os,
  }
}
