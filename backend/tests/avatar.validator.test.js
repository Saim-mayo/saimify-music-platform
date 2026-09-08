const mockFileTypeFromBuffer = jest.fn();

jest.mock('../src/utils/fileType', () => ({
   fileTypeFromBuffer: mockFileTypeFromBuffer
}));

describe('avatar.validator', () => {
   const createNext = () => jest.fn();
   const validateAvatarUpload = require('../src/validators/avatar.validator');

   beforeEach(() => {
      jest.clearAllMocks();
      mockFileTypeFromBuffer.mockResolvedValue(null);
   });

   it('rejects requests that do not include an avatar file', async () => {
      const req = { file: null };
      const res = {};
      const next = createNext();

      await validateAvatarUpload(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toHaveProperty('statusCode', 400);
      expect(next.mock.calls[0][0]).toHaveProperty('message', 'No avatar file provided');
   });

   it('rejects unsupported image types and preserves the reason from metadata detection', async () => {
      const req = {
         file: {
            buffer: Buffer.from('not-really-image'),
            originalname: 'avatar.png'
         }
      };
      const res = {};
      const next = createNext();

      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'text/plain', ext: 'txt' });

      await validateAvatarUpload(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toHaveProperty('statusCode', 400);
      expect(next.mock.calls[0][0].message).toContain('Invalid file type');
      expect(next.mock.calls[0][0].message).toContain('text/plain');
   });

   it('normalizes the avatar mimetype and renames the original name when extension is wrong', async () => {
      const req = {
         file: {
            buffer: Buffer.from('jpeg-data'),
            originalname: 'avatar.png'
         }
      };
      const res = {};
      const next = createNext();

      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });

      await validateAvatarUpload(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.file.mimetype).toBe('image/jpeg');
      expect(req.file.originalname).toMatch(/^\d{13}-avatar\.(jpeg|jpg)$/);
   });

   it('passes unexpected file-type failures through to the next error middleware', async () => {
      const req = {
         file: {
            buffer: Buffer.from('oops'),
            originalname: 'avatar.png'
         }
      };
      const res = {};
      const next = createNext();

      const failure = new Error('file-type exploded');
      mockFileTypeFromBuffer.mockRejectedValue(failure);

      await validateAvatarUpload(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBe(failure);
   });
});
