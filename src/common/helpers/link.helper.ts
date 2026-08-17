import crypto from 'node-forge'

export const createDownloadLinks = (encryptedMediaUrl: string) => {
  if (!encryptedMediaUrl) return []

  const qualities = [
    { id: '_12', bitrate: '12kbps' },
    { id: '_48', bitrate: '48kbps' },
    { id: '_96', bitrate: '96kbps' },
    { id: '_160', bitrate: '160kbps' },
    { id: '_320', bitrate: '320kbps' }
  ]

  const key = '38346591'
  const iv = '00000000'

  try {
    const encrypted = crypto.util.decode64(encryptedMediaUrl)
    const decipher = crypto.cipher.createDecipher('DES-ECB', crypto.util.createBuffer(key))
    decipher.start({ iv: crypto.util.createBuffer(iv) })
    decipher.update(crypto.util.createBuffer(encrypted))
    decipher.finish()
    const rawDecrypted = decipher.output.getBytes()
    const decryptedLink = rawDecrypted.replace(/^http:\/\//, 'https://')

    const bitrateRegex = /_(?:12|48|96|160|320|preview)(?=\.[a-z0-9]+$|$)/i

    return qualities.map((quality) => {
      let finalUrl = decryptedLink
      if (bitrateRegex.test(decryptedLink)) {
        finalUrl = decryptedLink.replace(bitrateRegex, quality.id)
      } else {
        const extIndex = decryptedLink.lastIndexOf('.')
        if (extIndex !== -1) {
          finalUrl = `${decryptedLink.slice(0, extIndex)}${quality.id}${decryptedLink.slice(extIndex)}`
        } else {
          finalUrl = `${decryptedLink}${quality.id}`
        }
      }
      return {
        quality: quality.bitrate,
        url: finalUrl
      }
    })
  } catch (error) {
    console.error('Failed to decrypt media url:', error);
    return []
  }
}

export const createImageLinks = (link: string) => {
  if (!link || typeof link !== 'string' || link.includes('/null/') || link.includes('null/null') || link.endsWith('/null')) return []

  const qualities = ['50x50', '150x150', '500x500']
  const qualityRegex = /150x150|50x50/
  const protocolRegex = /^http:\/\//

  return qualities.map((quality) => ({
    quality,
    url: link.replace(qualityRegex, quality).replace(protocolRegex, 'https://')
  }))
}
