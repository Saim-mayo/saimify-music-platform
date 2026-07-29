const validateAudioFile = require('../src/validators/file.validator');

jest.mock('file-type', () => ({
   fileTypeFromBuffer: jest.fn()
}));

const { fileTypeFromBuffer } = require('file-type');

describe('file.validator', () => {
   const createNext = () => jest.fn();

   beforeEach(() => {
      jest.clearAllMocks();
   });

   it('rejects missing files with 400', async () => {
      const req = { file: null };
      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn().mockReturnThis()
      };
      const next = createNext();

      await validateAudioFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'File is required' });
      expect(next).not.toHaveBeenCalled();
   });

   it('rejects files with unsupported MIME signatures', async () => {
      const req = {
         file: {
            buffer: Buffer.from('hello'),
            originalname: 'track.mp3',
            size: 1024
         }
      };
      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn().mockReturnThis()
      };
      const next = createNext();

      fileTypeFromBuffer.mockResolvedValue({ mime: 'application/octet-stream', ext: 'bin' });

      await validateAudioFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Only audio files allowed' });
      expect(next).not.toHaveBeenCalled();
   });

   it('rejects non-mp3/wav file extensions', async () => {
      const req = {
         file: {
            buffer: Buffer.from('hello'),
            originalname: 'track.flac',
            size: 1024
         }
      };
      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn().mockReturnThis()
      };
      const next = createNext();

      fileTypeFromBuffer.mockResolvedValue({ mime: 'audio/mpeg', ext: 'mp3' });

      await validateAudioFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid file extension' });
      expect(next).not.toHaveBeenCalled();
   });

   it('rejects oversized files', async () => {
      const req = {
         file: {
            buffer: Buffer.from('hello'),
            originalname: 'track.mp3',
            size: 11 * 1024 * 1024
         }
      };
      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn().mockReturnThis()
      };
      const next = createNext();

      fileTypeFromBuffer.mockResolvedValue({ mime: 'audio/mpeg', ext: 'mp3' });

      await validateAudioFile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'File too large (max 10MB)' });
      expect(next).not.toHaveBeenCalled();
   });

   it('passes valid audio files through when MIME and extension match', async () => {
      const req = {
         file: {
            buffer: Buffer.from('hello'),
            originalname: 'track.mp3',
            size: 1024
         }
      };
      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn().mockReturnThis()
      };
      const next = createNext();

      fileTypeFromBuffer.mockResolvedValue({ mime: 'audio/mpeg', ext: 'mp3' });

      await validateAudioFile(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
   });
});
