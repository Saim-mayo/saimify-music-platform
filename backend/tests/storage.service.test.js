const mockUpload = jest.fn();
const mockImageKitClient = { files: { upload: mockUpload } };

jest.mock('@imagekit/nodejs', () => {
   return jest.fn().mockImplementation(() => mockImageKitClient);
});

jest.mock('../src/config/env', () => ({
   IMAGE_KIT_PUBLIC_KEY: 'public',
   IMAGE_KIT_PRIVATE_KEY: 'private',
   IMAGE_KIT_URL_ENDPOINT: 'https://ik.example.com/'
}));

describe('storage.service', () => {
   let uploadFile;
   let getInternalFileUrl;

   beforeAll(() => {
      ({ uploadFile, getInternalFileUrl } = require('../src/services/storage.service'));
   });

   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('throws when uploadFile is called without a buffer', async () => {
      await expect(uploadFile(undefined, 'song.mp3')).rejects.toThrow('Missing file');
   });

   it('uploads a file and returns sanitized metadata', async () => {
      mockUpload.mockResolvedValue({
         fileId: 'file_123',
         filePath: '/songs/test.mp3',
         url: 'https://ik.example.com/songs/test.mp3',
         size: 2048
      });

      const result = await uploadFile(Buffer.from('abc'), 'song@weird!.mp3', 'music');
      expect(result).toEqual(expect.objectContaining({
         fileId: 'file_123',
         filePath: '/songs/test.mp3',
         url: 'https://ik.example.com/songs/test.mp3',
         fileSize: 2048
      }));
      expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({
         folder: 'music',
         fileName: expect.stringMatching(/^\d+_song_weird_\.mp3$/)
      }));
   });

   it('throws when getInternalFileUrl is called without a filePath', () => {
      expect(() => getInternalFileUrl()).toThrow('Missing filePath');
   });

   it('builds an internal file URL from the configured ImageKit endpoint', () => {
      const result = getInternalFileUrl('/songs/test.mp3');
      expect(result).toBe('https://ik.example.com//songs/test.mp3');
   });
});
