import {
  IPFS_DIRECTORY_MIMETYPE,
  IPFS_DEFAULT_THUMBNAIL_URI,
} from '../constants'
import { NFTStorage, File } from 'nft.storage'

const { create } = require('ipfs-http-client')
const Buffer = require('buffer').Buffer
const axios = require('axios')
const readJsonLines = require('read-json-lines-sync').default
const { getCoverImagePathFromBuffer } = require('../utils/html')

const infuraUrl = 'https://ipfs.infura.io:5001'
const apiKey = process.env.REACT_APP_IPFS_KEY

const storage = new NFTStorage({ token: apiKey })

// const useNFTStorage = true

// export const prepareFile100MB = async ({
//   name,
//   description,
//   tags,
//   address,
//   buffer,
//   mimeType,
//   cover,
//   thumbnail,
//   generateDisplayUri,
//   file
// }) => {

//   const ipfs = create(infuraUrl)

//   let formData = new FormData()
//   formData.append('file', file)

//   let info = await axios.post('https://hesychasm.herokuapp.com/post_file', formData, {
//     headers: { 'Content-Type': 'multipart/form-data' }
//   }).then(res => res.data)
//   const hash = info.path
//   const cid = `ipfs://${hash}`

//   // upload cover image
//   const displayUri = await uploadCoverImage({ generateDisplayUri })

//   // upload thumbnail image
//   let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI
//   // @crzypatch works wants the thumbnailUri to be the black circle
//   // if (generateDisplayUri) {
//   //   const thumbnailInfo = await ipfs.add(thumbnail.buffer)
//   //   const thumbnailHash = thumbnailInfo.path
//   //   thumbnailUri = `ipfs://${thumbnailHash}`
//   // }

//   return await uploadMetadataFile({
//     name,
//     description,
//     tags,
//     cid,
//     address,
//     mimeType,
//     displayUri,
//     thumbnailUri,
//   })
// }
const uploadCoverImage = async ({
  cover,
  generateDisplayUri,
  hashes = undefined
}) => {

  // upload cover image
  let displayUri = ''
  if (generateDisplayUri) {
    // const coverHash = await ipfs.add(new Blob([cover.buffer]))
    // console.log(coverHash)
    // displayUri = `ipfs://${coverHash.path}`
    const coverHash = await storage.storeBlob(new Blob([cover.buffer]))
    console.log(`Display (cover) Hash ${coverHash}`)
    displayUri = `ipfs://${coverHash}`
  }
  else if (hashes !== undefined) {
    if (hashes.cover) {
      // TODO: Remove this once generateDisplayUri option is gone
      displayUri = `ipfs://${hashes.cover}`
    }
  }
  return displayUri

}

export const prepareFile = async ({
  name,
  description,
  tags,
  address,
  buffer,
  mimeType,
  cover,
  thumbnail,
  generateDisplayUri,
}) => {
  const ipfs = create(infuraUrl)

  // upload main file
  // const ipfs = create(infuraUrl)

  // const hash = await ipfs.add(new Blob([buffer]))
  const hash = await storage.storeBlob(new Blob([buffer]))
  console.log(`OBJKT Hash: ${hash}`)
  // const cid = `ipfs://${hash.path}`
  const cid = `ipfs://${hash}`

  const displayUri = await uploadCoverImage({ cover,generateDisplayUri })

  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI
  // @crzypatch works wants the thumbnailUri to be the black circle
  // if (generateDisplayUri) {
  //   const thumbnailInfo = await ipfs.add(thumbnail.buffer)
  //   const thumbnailHash = thumbnailInfo.path
  //   thumbnailUri = `ipfs://${thumbnailHash}`
  // }

  return await uploadMetadataFile({
    name,
    description,
    tags,
    cid,
    address,
    mimeType,
    displayUri,
    thumbnailUri,
  })
}

export const prepareDirectory = async ({
  name,
  description,
  tags,
  address,
  files,
  cover,
  thumbnail,
  generateDisplayUri,
}) => {
  // upload directory of files
  // const hashes = await uploadFilesToDirectory(files)
  const hashes = await uploadFilesToDirectoryNFTStorage(files)
  const cid = `ipfs://${hashes.directory}`

  // upload cover image
  const displayUri = await uploadCoverImage({ cover,generateDisplayUri, hashes })

  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI

  return await uploadMetadataFile({
    name,
    description,
    tags,
    cid,
    address,
    mimeType: IPFS_DIRECTORY_MIMETYPE,
    displayUri,
    thumbnailUri,
  })
}

function not_directory(file) {
  return file.blob.type !== IPFS_DIRECTORY_MIMETYPE
}

async function uploadFilesToDirectoryNFTStorage(files) {
  files = files.filter(not_directory)

  // const form = new FormData()
  let directory_content = []
  files.forEach((file) => {

    directory_content.push(new File(
      [file.blob],
      encodeURIComponent(file.path)
    ))
    // console.log(file.blob)
  })
  console.log(directory_content)
  const cid = await storage.storeDirectory(directory_content)
  console.log(cid)
  const status = await storage.status(cid)
  console.log(status)
  // TODO: Remove this once generateDisplayUri option is gone
  // get cover hash
  let cover = null
  const indexFile = files.find((f) => f.path === 'index.html')
  if (indexFile) {
    const indexBuffer = await indexFile.blob.arrayBuffer()
    const coverImagePath = getCoverImagePathFromBuffer(indexBuffer)

    if (coverImagePath) {
      // const coverEntry = data.find((f) => f.Name === coverImagePath)
      // if (coverEntry) {
      //   cover = coverEntry.Hash
      // }
    }
  }

  // const rootDir = data.find((e) => e.Name === '')

  // const directory = rootDir.Hash

  // return { directory, cover }
  return { directory: cid, cover }
}








async function uploadFilesToDirectory(files) {
  files = files.filter(not_directory)

  const form = new FormData()

  files.forEach((file) => {
    form.append('file', file.blob, encodeURIComponent(file.path))
  })
  const endpoint = `${infuraUrl}/api/v0/add?pin=true&recursive=true&wrap-with-directory=true`
  const res = await axios.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  const data = readJsonLines(res.data)

  // TODO: Remove this once generateDisplayUri option is gone
  // get cover hash
  let cover = null
  const indexFile = files.find((f) => f.path === 'index.html')
  if (indexFile) {
    const indexBuffer = await indexFile.blob.arrayBuffer()
    const coverImagePath = getCoverImagePathFromBuffer(indexBuffer)

    if (coverImagePath) {
      const coverEntry = data.find((f) => f.Name === coverImagePath)
      if (coverEntry) {
        cover = coverEntry.Hash
      }
    }
  }

  const rootDir = data.find((e) => e.Name === '')

  const directory = rootDir.Hash

  return { directory, cover }
}

async function uploadMetadataFile({
  name,
  description,
  tags,
  cid,
  address,
  mimeType,
  displayUri = '',
  thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI,
}) {
  const ipfs = create(infuraUrl)

  return await ipfs.add(
    Buffer.from(
      JSON.stringify({
        name,
        description,
        tags: tags.replace(/\s/g, '').split(','),
        symbol: 'OBJKT',
        artifactUri: cid,
        displayUri,
        thumbnailUri,
        creators: [address],
        formats: [{ uri: cid, mimeType }],
        decimals: 0,
        isBooleanAmount: false,
        shouldPreferSymbol: false,
      })
    )
  )
}
