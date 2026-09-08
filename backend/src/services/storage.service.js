const ImageKit = require("@imagekit/nodejs");
const path = require("path");
const env = require('../config/env');

if (
    !env.IMAGE_KIT_PUBLIC_KEY ||
    !env.IMAGE_KIT_PRIVATE_KEY ||
    !env.IMAGE_KIT_URL_ENDPOINT
) {
    throw new Error("ImageKit configuration missing");
}

const imagekitClient = new ImageKit({
    publicKey: env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: env.IMAGE_KIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGE_KIT_URL_ENDPOINT
});

async function uploadFile(
    fileBuffer,
    fileName,
    folder = "ytmusic-clone"
) {

    if (!fileBuffer)
        throw new Error("Missing file");

    const safeName = path
        .basename(fileName)
        .replace(/[^a-zA-Z0-9._-]/g, "_");

    const result = await imagekitClient.files.upload({

        file: fileBuffer.toString("base64"),

        fileName: `${Date.now()}_${safeName}`,

        folder
    });

    return {

        fileId: result.fileId,

        filePath: result.filePath,

        url: result.url,

        // ImageKit returns the uploaded file's byte size in its response —
        // cache it on the Music document so streaming doesn't need an
        // axios.head() round trip on every single Range request.
        fileSize: result.size

    };

}

/*
    DO NOT expose ImageKit URLs.

    Backend will proxy every request.
*/
function getInternalFileUrl(filePath) {

    if (!filePath)
        throw new Error("Missing filePath");

    return `${env.IMAGE_KIT_URL_ENDPOINT}${filePath}`;

}

module.exports = {

    uploadFile,

    getInternalFileUrl,

    imagekitClient

};