const mockStartSession = jest.fn();
const mockSession = {
   startTransaction: jest.fn(),
   commitTransaction: jest.fn(),
   abortTransaction: jest.fn(),
   endSession: jest.fn(),
   inTransaction: jest.fn()
};

jest.mock('mongoose', () => ({
   startSession: mockStartSession
}));

const { withTransactionRetry } = require('../src/utils/mongoTransaction');

describe('mongoTransaction.withTransactionRetry', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockStartSession.mockResolvedValue(mockSession);
      mockSession.startTransaction.mockImplementation(() => {});
      mockSession.commitTransaction.mockResolvedValue(undefined);
      mockSession.abortTransaction.mockResolvedValue(undefined);
      mockSession.endSession.mockResolvedValue(undefined);
      mockSession.inTransaction.mockReturnValue(true);
      jest.spyOn(console, 'warn').mockImplementation(() => {});
   });

   afterEach(() => {
      jest.restoreAllMocks();
   });

   it('commits the session and returns the callback result on the first try', async () => {
      const callback = jest.fn(async (session) => {
         expect(session).toBe(mockSession);
         return 'ok';
      });

      await expect(withTransactionRetry(callback)).resolves.toBe('ok');

      expect(mockStartSession).toHaveBeenCalledTimes(1);
      expect(mockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.abortTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
   });

   it('does not abort a session when the transaction never started and rethrows the error', async () => {
      mockSession.inTransaction.mockReturnValue(false);

      const callback = jest.fn(async () => {
         throw new Error('boom');
      });

      await expect(withTransactionRetry(callback)).rejects.toThrow('boom');

      expect(mockSession.abortTransaction).not.toHaveBeenCalled();
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
   });

   it('retries a transient transaction error and succeeds on the next attempt', async () => {
      const transientErr = new Error('write conflict');
      transientErr.errorLabels = ['TransientTransactionError'];

      const callback = jest
         .fn()
         .mockRejectedValueOnce(transientErr)
         .mockResolvedValueOnce('retry-success');

      await expect(withTransactionRetry(callback)).resolves.toBe('retry-success');

      expect(mockStartSession).toHaveBeenCalledTimes(2);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
         'Retrying transaction after write conflict (1/3)'
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(2);
   });

   it('retries up to the max attempts and rethrows the last transient write-conflict error', async () => {
      const transientErr = new Error('write conflict code 112');
      transientErr.code = 112;

      const callback = jest.fn(async () => {
         throw transientErr;
      });

      await expect(withTransactionRetry(callback, { maxAttempts: 3 })).rejects.toThrow('write conflict code 112');

      expect(mockStartSession).toHaveBeenCalledTimes(3);
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(3);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(2);
      expect(mockSession.endSession).toHaveBeenCalledTimes(3);
   });
});
