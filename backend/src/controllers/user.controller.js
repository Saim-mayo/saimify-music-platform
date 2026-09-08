const asyncHandler = require('../utils/asyncHandler');
const { validationResult } = require('express-validator');
const User = require('../models/user.model');
const { createNotification } = require('../services/notification.service');
const {
   getMyProfileService,
   updateMyProfileService,
   uploadAvatarService,
   setPasswordService,
   getMyFeatureFlagsService
} = require('../services/user.service');

// 👤 GET PROFILE
const getMyProfile = asyncHandler(async (req, res) => {

   const user = await getMyProfileService(req.user.userId);

   return res.status(200).json({
      user
   });
});

// ✏️ UPDATE PROFILE
const updateMyProfile = asyncHandler(async (req, res) => {

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
   }

   const updated = await updateMyProfileService(
      req.user.userId,
      req.body
   );

   return res.status(200).json({
      message: 'Profile updated successfully',
      updated
   });
});

// 🖼️ UPLOAD AVATAR
const uploadAvatar = asyncHandler(async (req, res) => {
     
   const result = await uploadAvatarService(
      req.user.userId,
      req.file
   );

   return res.status(200).json({
      message: 'Avatar uploaded successfully',
      ...result
   });
});
// 🔑 SET PASSWORD
const setPassword = asyncHandler(

   async (req, res) => {

      const errors =
         validationResult(req);

      if (!errors.isEmpty()) {

         return res.status(400).json({

            errors:
               errors.array()

         });

      }

      await setPasswordService(

         req.user.userId,

         req.body.password

      );

      return res.status(200).json({

         success: true,

         message:
            'Password created successfully'

      });

   }

);
// =====================================
// 🎤 REQUEST ARTIST VERIFICATION
// =====================================
const requestArtistVerification = asyncHandler(async (req, res) => {

   const { userId } = req.user;

   const user = await User.findById(userId);

   if (!user) {
      return res.status(404).json({
         success: false,
         message: 'User not found'
      });
   }

   // Already an approved artist
   if (user.role === 'artist') {
      return res.status(409).json({
         success: false,
         message: 'You are already an artist'
      });
   }

     // Admin accounts should not submit artist requests
     if (user.role && user.role !== 'user') {
        return res.status(403).json({
           success: false,
           message: 'Only regular users can request artist verification'
        });
     }

   // Request already pending
   if (user.artistVerification.status === 'pending') {
      return res.status(409).json({
         success: false,
         message: 'Artist request already pending'
      });
   }

   user.artistVerification.status = 'pending';
   user.artistVerification.isVerified = false;
   user.artistRequestAt = new Date();

   await user.save();

   await createNotification({
      userId: user._id,
      type: 'artist_request_submitted',
      title: 'Artist request received',
      message: 'Your artist application has been received and is now pending review.',
      data: { reviewRoute: '/admin/artists' }
   });

   const admins = await User.find({ role: 'admin' }).select('_id').lean();
   if (admins.length) {
      await Promise.all(admins.map((admin) => createNotification({
         userId: admin._id,
         type: 'admin_alert',
         title: 'New artist application',
         message: `New artist application from ${user.username || user.email} needs review.`,
         data: { reviewRoute: '/admin/artists', applicantId: user._id.toString() }
      })));
   }

   return res.status(200).json({
      success: true,
      message: 'Artist request submitted successfully'
   });

});

// =====================================
// 🎛 GET MY FEATURE FLAGS (ads / downloads / play limit)
// =====================================
const getMyFeatures = asyncHandler(async (req, res) => {

   const features = await getMyFeatureFlagsService(req.user);

   return res.status(200).json({
      features
   });
});

module.exports = {
   getMyProfile,
   updateMyProfile,
   uploadAvatar,
   setPassword,
   requestArtistVerification,
   getMyFeatures
};