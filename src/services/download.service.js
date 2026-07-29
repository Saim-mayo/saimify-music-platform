const Download = require('../models/download.model');
const AppError = require('../utils/appError');
const { getPlanFeatures } = require('../utils/accessControl');
const { withTransactionRetry } = require('../utils/mongoTransaction');

const recordDownload = async ({
    user,          // full req.user object (has .subscription, .isBanned)
    songId,
    ipAddress,
    userAgent
}) => {

    if (!user?.userId || !songId) {
        throw new AppError('Invalid download information', 400);
    }

    const userId = user.userId;
    const features = getPlanFeatures(user);

    // If maxDownloads is null (unlimited), update or insert directly without transaction lock
    if (features.maxDownloads === null) {
        return await Download.findOneAndUpdate(
            { user: userId, song: songId },
            {
                $inc: { downloadCount: 1 },
                $set: { ipAddress, userAgent, downloadedAt: new Date() }
            },
            { upsert: true, returnDocument: "after" }
        );
    }

    return await withTransactionRetry(async (session) => {
        // 1. Check if this exact song was already downloaded (does not count against limit increase)
        const alreadyOwned = await Download.exists({ user: userId, song: songId }).session(session);

        if (!alreadyOwned) {
            // 2. Count distinct downloaded songs inside the transaction context
            const distinctCount = await Download.countDocuments({ user: userId }).session(session);

            if (distinctCount >= features.maxDownloads) {
                throw new AppError(
                    `Download limit reached (${features.maxDownloads} for your plan). Upgrade to download more.`,
                    403
                );
            }
        }

        // 3. Atomically update or insert the download tracking record
        const downloadRecord = await Download.findOneAndUpdate(
            { user: userId, song: songId },
            {
                $inc: { downloadCount: 1 },
                $set: { ipAddress, userAgent, downloadedAt: new Date() }
            },
            { upsert: true, returnDocument: "after", session }
        );

        return downloadRecord;
    });
};

const getUserDownloads = async (userId) => {
    return await Download.find({
        user: userId
    })
        .populate('song', 'title artist coverUrl')
        .sort({ downloadedAt: -1 });
};

module.exports = {
    recordDownload,
    getUserDownloads
};