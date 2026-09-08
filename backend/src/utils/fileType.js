let fileTypeModulePromise;

const fileTypeFromBuffer = async (buffer) => {
   fileTypeModulePromise ||= import('file-type');
   const fileTypeModule = await fileTypeModulePromise;
   return fileTypeModule.fileTypeFromBuffer(buffer);
};

module.exports = { fileTypeFromBuffer };
